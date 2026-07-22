import { SEARCH_INDEX_STATES, createSearchIndexLoadingState, loadSearchIndex } from "./data.js";
import {
  TIRE_FACETS,
  availableTireFacetValues,
  casingHistoryHref,
  facetLabel,
  filterTireRows,
  tireFacetFromSearch,
  tireFacetSearch,
} from "./neumaticos-model.js";

const state = {
  index: createSearchIndexLoadingState(),
  facets: tireFacetFromSearch(globalThis.location?.search),
  query: "",
};

const elements = {
  main: document.querySelector(".tires-main"),
  count: document.getElementById("tires-visible-count"),
  countLabel: document.getElementById("tires-visible-label"),
  activeFilters: document.getElementById("tires-active-filters"),
  availableFilters: document.getElementById("tires-available-filters"),
  search: document.getElementById("tires-search"),
  status: document.getElementById("tires-status"),
  list: document.getElementById("tires-list"),
};

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function displayValue(value, fallback = "SIN REGISTRO") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function casingIdentity(row) {
  return displayValue(row?.casing_code, "SIN CÓDIGO");
}

function locationWithFacets(facets) {
  const url = new URL(globalThis.location.href);
  url.search = tireFacetSearch(facets);
  return url;
}

function setFacets(nextFacets, { push = true } = {}) {
  state.facets = nextFacets;
  if (push && globalThis.history?.pushState) {
    const url = locationWithFacets(state.facets);
    globalThis.history.pushState({ tireFacets: state.facets }, "", url);
  }
  render();
}

function activeRows() {
  return filterTireRows(state.index.rows, {
    facets: state.facets,
    query: state.query,
  });
}

function renderActiveFilters() {
  elements.activeFilters.replaceChildren();
  const entries = Object.entries(state.facets);
  if (!entries.length) {
    elements.activeFilters.hidden = true;
    return;
  }
  elements.activeFilters.hidden = false;
  elements.activeFilters.append(createElement("span", "tires-filter-heading", "FILTROS ACTIVOS"));
  for (const [param, value] of entries) {
    const chip = createElement("button", "tires-filter-chip", `${facetLabel(param)}: ${value} ×`);
    chip.type = "button";
    chip.setAttribute("aria-label", `Quitar filtro ${facetLabel(param)}: ${value}`);
    chip.addEventListener("click", () => {
      const next = { ...state.facets };
      delete next[param];
      setFacets(next);
    });
    elements.activeFilters.append(chip);
  }
}

function renderAvailableFilters() {
  elements.availableFilters.replaceChildren();
  const values = availableTireFacetValues(state.index.rows, state.facets);
  for (const facet of TIRE_FACETS) {
    const options = values[facet.param] ?? [];
    if (!options.length) continue;
    const section = createElement("section", "tires-facet-set");
    section.append(createElement("h2", "tires-facet-title", facet.label));
    const optionList = createElement("div", "tires-facet-options");
    for (const value of options) {
      const active = state.facets[facet.param] != null
        && String(state.facets[facet.param]).localeCompare(value, "es", { sensitivity: "base" }) === 0;
      const button = createElement("button", "tires-facet-option", value);
      button.type = "button";
      button.dataset.active = String(active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", `${active ? "Quitar" : "Filtrar por"} ${facet.label}: ${value}`);
      button.addEventListener("click", () => {
        const next = { ...state.facets };
        if (active) delete next[facet.param];
        else next[facet.param] = value;
        setFacets(next);
      });
      optionList.append(button);
    }
    section.append(optionList);
    elements.availableFilters.append(section);
  }
}

function appendFact(facts, label, value) {
  const fact = createElement("div", "tires-fact");
  fact.append(
    createElement("dt", null, label),
    createElement("dd", null, displayValue(value)),
  );
  facts.append(fact);
}

function createCard(row) {
  const card = createElement("article", "tires-card");
  const href = casingHistoryHref(row);
  const identity = createElement(href ? "a" : "div", "tires-identity");
  if (href) {
    identity.href = href;
    identity.setAttribute("aria-label", `Ver historial del neumático ${casingIdentity(row)}`);
  }
  identity.append(
    createElement("span", "tires-code", casingIdentity(row)),
    createElement("span", "tires-history-hint", href ? "VER HISTORIAL ›" : "SIN HISTORIAL"),
  );
  const body = createElement("div", "tires-card-body");
  body.append(
    createElement("h2", "tires-card-title", displayValue(row.brand_name, "MARCA SIN REGISTRO")),
    createElement("p", "tires-card-subtitle", displayValue(row.model_name, "MODELO SIN REGISTRO")),
  );
  const facts = createElement("dl", "tires-facts");
  appendFact(facts, "Medida", row.size_name);
  appendFact(facts, "Condición", row.condition);
  appendFact(facts, "Reencauche", row.retread_design);
  appendFact(facts, "Estado", row.status);
  appendFact(
    facts,
    "Ubicación",
    row.unit_plate ? `${row.unit_plate}${row.position_number != null ? ` · P${row.position_number}` : ""}` : "EN RETÉN",
  );
  body.append(facts);
  card.append(identity, body);
  return card;
}

function renderList(rows) {
  elements.list.replaceChildren();
  if (rows.length) {
    const fragment = document.createDocumentFragment();
    for (const row of rows) fragment.append(createCard(row));
    elements.list.append(fragment);
    return;
  }
  const message = Object.keys(state.facets).length || state.query.trim()
    ? "Ningún neumático coincide con los filtros y la búsqueda actuales."
    : "No hay neumáticos disponibles para esta empresa.";
  elements.list.append(createElement("p", "tires-empty", message));
}

function renderStatus() {
  const { status } = state.index;
  elements.status.hidden = status === SEARCH_INDEX_STATES.READY || status === SEARCH_INDEX_STATES.STALE;
  elements.status.replaceChildren();
  if (status === SEARCH_INDEX_STATES.LOADING) {
    elements.status.append(createElement("span", "tires-spinner"), createElement("span", null, "Cargando índice de neumáticos…"));
  } else if (status === SEARCH_INDEX_STATES.UNAUTHORIZED) {
    elements.status.append(createElement("span", null, "Iniciá sesión para consultar los neumáticos de tu empresa."));
  } else if (status === SEARCH_INDEX_STATES.ERROR) {
    elements.status.append(createElement("span", null, "No se pudo cargar el índice. Verificá la conexión e intentá nuevamente."));
    const retry = createElement("button", "tires-retry", "Reintentar");
    retry.type = "button";
    retry.addEventListener("click", () => void reload());
    elements.status.append(retry);
  }
}

function render() {
  const ready = [SEARCH_INDEX_STATES.READY, SEARCH_INDEX_STATES.STALE].includes(state.index.status);
  elements.main?.setAttribute("aria-busy", String(state.index.status === SEARCH_INDEX_STATES.LOADING));
  renderStatus();
  if (!ready) {
    elements.count.textContent = "—";
    elements.countLabel.textContent = state.index.status === SEARCH_INDEX_STATES.UNAUTHORIZED ? "SIN SESIÓN" : "CARGANDO";
    elements.activeFilters.hidden = true;
    elements.availableFilters.replaceChildren();
    elements.list.replaceChildren();
    return;
  }
  const rows = activeRows();
  const filtered = Object.keys(state.facets).length > 0;
  elements.count.textContent = String(rows.length);
  elements.countLabel.textContent = filtered
    ? `${rows.length === 1 ? "NEUMÁTICO FILTRADO" : "NEUMÁTICOS FILTRADOS"}`
    : `${rows.length === 1 ? "NEUMÁTICO" : "NEUMÁTICOS"}`;
  renderActiveFilters();
  renderAvailableFilters();
  renderList(rows);
}

async function reload() {
  state.index = createSearchIndexLoadingState();
  render();
  try {
    if (typeof globalThis.RenovaSupabase?.requireAuth === "function") {
      await globalThis.RenovaSupabase.requireAuth();
    }
    state.index = await loadSearchIndex({ client: globalThis.RenovaSupabase });
  } catch {
    state.index = { status: SEARCH_INDEX_STATES.ERROR, rows: [] };
  }
  render();
}

elements.search.addEventListener("input", () => {
  state.query = elements.search.value;
  render();
});

globalThis.addEventListener("popstate", () => {
  state.facets = tireFacetFromSearch(globalThis.location.search);
  render();
});

render();
globalThis.onRenovaSupabaseReady(() => void reload());
