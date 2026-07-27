import { loadActiveCompanyName, loadInventoryScreenData } from "./data.js";
import { INVENTORY_TABS, filterInventoryRows } from "./inventory-model.js";

const TABS = Object.freeze({
  RETENTION: INVENTORY_TABS.RETENTION,
  DISCARDED: INVENTORY_TABS.DISCARDED,
});

const REALTIME_TABLES = Object.freeze([
  "tire_installations",
  "tire_removals",
  "tire_life_cycles",
  "tire_casings",
]);

const state = {
  activeTab: tabFromSearch(globalThis.location?.search),
  retention: [],
  discarded: [],
  status: "loading",
  query: "",
  requestId: 0,
};

const elements = {
  tabs: [...document.querySelectorAll("[data-inventory-tab]")],
  retentionPanel: document.getElementById("inventory-panel-retention"),
  discardedPanel: document.getElementById("inventory-panel-discarded"),
  retentionList: document.getElementById("inventory-list-retention"),
  discardedList: document.getElementById("inventory-list-discarded"),
  retentionCount: document.getElementById("inventory-count-retention"),
  discardedCount: document.getElementById("inventory-count-discarded"),
  search: document.getElementById("inventory-search"),
  status: document.getElementById("inventory-status"),
  main: document.querySelector(".inventory-main"),
};

let unsubscribeRealtime = null;
let activeClient = null;

function tabFromSearch(search = "") {
  const requested = new URLSearchParams(search).get("tab");
  return [TABS.DISCARDED, "discarded", "descartado"].includes(requested)
    ? TABS.DISCARDED
    : TABS.RETENTION;
}

function reflectTabInUrl(tab) {
  if (!globalThis.history?.replaceState || !globalThis.location?.href) return;
  const url = new URL(globalThis.location.href);
  if (tab === TABS.DISCARDED) url.searchParams.set("tab", TABS.DISCARDED);
  else url.searchParams.delete("tab");
  globalThis.history.replaceState(globalThis.history.state, "", url);
}

function value(row, ...keys) {
  for (const key of keys) {
    if (row?.[key] != null && row[key] !== "") return row[key];
  }
  return null;
}

function identity(row) {
  return value(row, "casing_code", "code", "serie") || "CÓDIGO NO VISIBLE";
}

function formatDate(input) {
  if (!input) return "SIN REGISTRO";
  const raw = String(input).slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return raw;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day))).toLocaleUpperCase("es-PE");
}

function formatMillimeters(input) {
  if (input == null || input === "") return "SIN REGISTRO";
  const number = Number(input);
  return Number.isFinite(number) ? `${number.toLocaleString("es-PE")} MM` : String(input);
}

function formatAge(row) {
  const input = value(row, "days_in_inventory");
  if (input == null) return "SIN RETIRO PREVIO";
  const days = Number(input);
  if (!Number.isFinite(days)) return String(input);
  return `${days} ${days === 1 ? "DÍA" : "DÍAS"}`;
}

function historyHref(row) {
  const code = value(row, "casing_code", "code", "serie");
  return code
    ? `historial-neumatico.html?serie=${encodeURIComponent(code)}&from=inventario`
    : null;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function appendFact(list, label, factValue, { wide = false, condition = false } = {}) {
  const wrapper = createElement("div", `inventory-fact${wide ? " is-wide" : ""}`);
  const term = createElement("dt", null, label);
  const description = createElement("dd");
  if (condition) {
    description.append(createElement("span", "inventory-condition", factValue || "SIN REGISTRO"));
  } else {
    description.textContent = factValue || "SIN REGISTRO";
  }
  wrapper.append(term, description);
  list.append(wrapper);
}

function createIdentity(row) {
  const href = historyHref(row);
  const header = createElement(href ? "a" : "div", "inventory-identity");
  if (href) {
    header.href = href;
    header.setAttribute("aria-label", `Ver historial del neumático ${identity(row)}`);
  }
  header.append(
    createElement("span", "inventory-code", identity(row)),
    createElement("span", "inventory-history-hint", href ? "VER HISTORIAL ›" : "SIN HISTORIAL"),
  );
  return header;
}

function createCard(row, tab) {
  const discarded = tab === TABS.DISCARDED;
  const card = createElement("article", `inventory-card${discarded ? " is-discarded" : ""}`);
  const body = createElement("div", "inventory-card-body");
  const brand = value(row, "brand_name", "marca") || "MARCA SIN REGISTRO";
  const model = value(row, "model_name", "modelo") || "MODELO SIN REGISTRO";
  body.append(
    createElement("h2", "inventory-card-title", brand),
    createElement("p", "inventory-card-subtitle", model),
  );

  const facts = createElement("dl", "inventory-facts");
  appendFact(facts, "Medida", value(row, "size_name", "medida") || "SIN REGISTRO");
  appendFact(facts, "Condición", value(row, "condition", "estado") || "SIN REGISTRO", {
    condition: true,
  });

  if (discarded) {
    appendFact(
      facts,
      "Fecha de descarte",
      formatDate(value(row, "discarded_at", "last_removed_at", "fecha_descarte")),
    );
    const lastUnit = value(row, "last_unit_plate", "ultima_unidad");
    const position = value(row, "last_position_number", "ultima_posicion");
    appendFact(
      facts,
      "Última ubicación",
      lastUnit ? `${lastUnit}${position != null ? ` · P${position}` : ""}` : "SIN REGISTRO",
    );
  } else {
    appendFact(facts, "RTD al retiro", formatMillimeters(value(row, "last_rtd_mm")));
    appendFact(facts, "Tiempo en retén", formatAge(row));
    appendFact(
      facts,
      "Último retiro",
      formatDate(value(row, "last_removed_at")),
      { wide: true },
    );
  }
  body.append(facts);

  if (discarded) {
    const cause = value(
      row,
      "discard_cause",
      "last_removal_discard_cause",
      "last_discard_cause",
      "causa",
    );
    const causeBox = createElement("div", "inventory-discard-cause");
    causeBox.append(
      createElement("span", null, "CAUSA DE DESCARTE"),
      createElement("strong", null, cause || "SIN CAUSA REGISTRADA"),
    );
    body.append(causeBox);
  }

  card.append(createIdentity(row), body);
  if (discarded) {
    const seal = createElement("div", "inventory-final-seal");
    seal.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg><span>BAJA DEFINITIVA</span>';
    card.append(seal);
  }
  return card;
}

function rowsFor(tab = state.activeTab) {
  return tab === TABS.DISCARDED ? state.discarded : state.retention;
}

function filteredRows(tab = state.activeTab) {
  return filterInventoryRows(rowsFor(tab), state.query);
}

function emptyMessage(tab) {
  const hasRowsBeforeSearch = rowsFor(tab).length > 0;
  if (hasRowsBeforeSearch) return "Ningún neumático coincide con la búsqueda.";
  return tab === TABS.DISCARDED
    ? "No hay neumáticos descartados registrados."
    : "No hay neumáticos disponibles en retén.";
}

function renderList(tab, container) {
  const rows = filteredRows(tab);
  container.replaceChildren();
  if (!rows.length) {
    container.append(createElement("p", "inventory-empty", emptyMessage(tab)));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const row of rows) fragment.append(createCard(row, tab));
  container.append(fragment);
}

function renderStatus() {
  elements.status.hidden = state.status === "ready";
  elements.status.dataset.kind = state.status;
  elements.status.replaceChildren();
  if (state.status === "ready") return;
  if (state.status === "loading") {
    elements.status.append(
      createElement("span", "inventory-spinner"),
      createElement("span", null, "Cargando inventario…"),
    );
  } else {
    elements.status.append(createElement(
      "span",
      null,
      "No se pudo cargar el inventario. Verifica la conexión e intenta nuevamente.",
    ));
    const retry = createElement("button", "inventory-retry", "Reintentar");
    retry.type = "button";
    retry.addEventListener("click", () => void reload(activeClient));
    elements.status.append(retry);
  }
}

function render() {
  elements.main.setAttribute("aria-busy", String(state.status === "loading"));
  const showingRetention = state.activeTab === TABS.RETENTION;
  for (const tab of elements.tabs) {
    const selected = tab.dataset.inventoryTab === state.activeTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  elements.retentionPanel.hidden = !showingRetention;
  elements.discardedPanel.hidden = showingRetention;
  elements.retentionCount.textContent = String(state.retention.length);
  elements.discardedCount.textContent = String(state.discarded.length);
  renderStatus();
  if (state.status !== "ready") {
    elements.retentionList.replaceChildren();
    elements.discardedList.replaceChildren();
    return;
  }
  renderList(TABS.RETENTION, elements.retentionList);
  renderList(TABS.DISCARDED, elements.discardedList);
}

function setActiveTab(tab, { focus = false, reflectUrl = true } = {}) {
  state.activeTab = tab === TABS.DISCARDED ? TABS.DISCARDED : TABS.RETENTION;
  state.query = "";
  elements.search.value = "";
  if (reflectUrl) reflectTabInUrl(state.activeTab);
  render();
  if (focus) {
    elements.tabs.find((candidate) => candidate.dataset.inventoryTab === state.activeTab)?.focus();
  }
}

function onTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "ArrowLeft" || event.key === "Home"
    ? TABS.RETENTION
    : TABS.DISCARDED;
  setActiveTab(next, { focus: true });
}

async function reload(client) {
  const requestId = ++state.requestId;
  state.status = "loading";
  render();
  try {
    const data = await loadInventoryScreenData(client);
    if (requestId !== state.requestId) return;
    state.retention = Array.isArray(data?.retention) ? data.retention : [];
    state.discarded = Array.isArray(data?.discarded) ? data.discarded : [];
    state.status = "ready";
  } catch (error) {
    if (requestId !== state.requestId) return;
    console.warn("Inventario: no se pudo cargar la pantalla.", error);
    state.retention = [];
    state.discarded = [];
    state.status = "error";
  }
  render();
}

async function init(client) {
  activeClient = client;
  if (!client?.enabled) {
    state.status = "error";
    render();
    client?.showBadge?.("empty");
    return;
  }
  const session = await client.requireAuth();
  // La insignia muestra la EMPRESA activa, como las demás pantallas. Nunca el correo de la
  // cuenta: no es información de empresa y queda proyectado durante una demo con cliente.
  const companyName = await loadActiveCompanyName(session?.user?.id, client);
  client.showBadge("supabase", companyName || "");
  await reload(client);
  unsubscribeRealtime?.();
  unsubscribeRealtime = client.onDataChange(REALTIME_TABLES, () => void reload(client));
}

for (const tab of elements.tabs) {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.inventoryTab));
  tab.addEventListener("keydown", onTabKeydown);
}

elements.search.addEventListener("input", () => {
  state.query = elements.search.value;
  render();
});

globalThis.addEventListener("popstate", () => {
  setActiveTab(tabFromSearch(globalThis.location.search), { reflectUrl: false });
});

globalThis.addEventListener("pagehide", () => unsubscribeRealtime?.(), { once: true });
render();
globalThis.onRenovaSupabaseReady(() => void init(globalThis.RenovaSupabase));
