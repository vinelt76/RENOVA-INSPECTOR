import { createFocusTrap } from "../movimientos/a11y.js";
import {
  SEARCH_INDEX_STATES,
  createSearchIndexLoadingState,
  loadSearchIndex,
  readSearchFrecency,
  writeSearchFrecency,
} from "./data.js";
import {
  groupSearchResults,
  parseSearchScope,
  recentSearchRows,
  recordSearchFrecency,
  resolveSearchDestination,
  rowsForSearchScope,
  searchIndexRows,
} from "./search-model.js";

const KIND_LABELS = Object.freeze({
  unit: "UNIDADES",
  casing: "NEUMÁTICOS",
  inspection: "MEDICIONES SIN CASCO",
});

const KIND_HINTS = Object.freeze({
  unit: "ALIAS: UNI: · PLACA · CONFIGURACIÓN",
  casing: "ALIAS: NEU: · CÓDIGO · ESTADO · UNIDAD",
  inspection: "ALIAS: MED: · CÓDIGO AÚN SIN HISTORIAL",
});

const SCOPE_LABELS = Object.freeze({
  unit: "UNIDADES",
  casing: "NEUMÁTICOS",
  inspection: "MEDICIONES SIN CASCO",
});

function createElement(documentObject, tagName, className, text) {
  const element = documentObject.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function statusLabel(status) {
  return String(status ?? "sin estado").replaceAll("_", " ").toUpperCase();
}

function flattenedRows(groups) {
  return ["unit", "casing", "inspection"].flatMap((kind) => groups[kind]?.rows ?? []);
}

/**
 * Overlay reutilizable del buscador global. El punto de entrada (task_07)
 * decide en qué pantalla se monta y qué disparador lo abre.
 */
export function createFinderController({
  documentObject = globalThis.document,
  windowObject = globalThis.window,
  client = globalThis.RenovaSupabase,
  loadIndex = loadSearchIndex,
  onNavigate,
} = {}) {
  if (!documentObject?.body) {
    throw new TypeError("finder-controller requiere un document con body.");
  }

  const overlay = createElement(documentObject, "section", "finder-overlay");
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Buscador global");
  overlay.tabIndex = -1;

  const panel = createElement(documentObject, "div", "finder-panel");
  const heading = createElement(documentObject, "h2", "finder-title", "BUSCADOR GLOBAL");
  const closeButton = createElement(documentObject, "button", "finder-close", "CERRAR");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Cerrar buscador");

  const headingRow = createElement(documentObject, "div", "finder-heading");
  headingRow.append(heading, closeButton);

  const searchField = createElement(documentObject, "div", "finder-search-field");
  const scopeChip = createElement(documentObject, "button", "finder-scope-chip");
  scopeChip.type = "button";
  scopeChip.hidden = true;
  const input = createElement(documentObject, "input", "finder-input");
  input.type = "search";
  input.placeholder = "Buscar placa, código, marca, medida o diseño";
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "finder-results");
  input.setAttribute("aria-label", "Buscar unidades y neumáticos");
  searchField.append(scopeChip, input);

  const status = createElement(documentObject, "p", "finder-status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");

  const results = createElement(documentObject, "div", "finder-results");
  results.id = "finder-results";
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "Resultados del buscador");

  panel.append(headingRow, searchField, status, results);
  overlay.append(panel);
  documentObject.body.append(overlay);

  let indexState = createSearchIndexLoadingState();
  let visibleRows = [];
  let activeIndex = -1;
  let frecency = {};
  let frecencyScope = null;
  let searchScope = null;
  let isOpen = false;
  let resultAnnouncementTimer = null;

  function announce(message) {
    status.textContent = message;
  }

  function renderScopeChip() {
    scopeChip.hidden = !searchScope;
    if (!searchScope) return;
    const label = SCOPE_LABELS[searchScope] ?? "ALCANCE";
    scopeChip.textContent = `${label} ×`;
    scopeChip.setAttribute("aria-label", `Quitar alcance ${label.toLocaleLowerCase("es")}`);
  }

  function clearSearchScope({ focus = false } = {}) {
    searchScope = null;
    renderScopeChip();
    if (focus) input.focus();
    render();
  }

  function scheduleResultAnnouncement(count) {
    if (resultAnnouncementTimer != null) globalThis.clearTimeout(resultAnnouncementTimer);
    resultAnnouncementTimer = globalThis.setTimeout(() => {
      announce(`${count} ${count === 1 ? "resultado" : "resultados"} disponibles.`);
      resultAnnouncementTimer = null;
    }, 250);
  }

  function setActiveIndex(index) {
    if (!visibleRows.length) {
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    activeIndex = Math.max(0, Math.min(index, visibleRows.length - 1));
    input.setAttribute("aria-activedescendant", `finder-option-${activeIndex}`);
  }

  function navigate(row) {
    const destination = resolveSearchDestination(row);
    if (!destination) return false;
    frecency = recordSearchFrecency(frecency, row.entity_id);
    if (frecencyScope) {
      frecency = writeSearchFrecency({ ...frecencyScope, entries: frecency });
    }
    if (typeof onNavigate === "function") onNavigate(destination, row);
    else if (typeof windowObject?.location?.assign === "function") windowObject.location.assign(destination);
    else if (windowObject?.location) windowObject.location.href = destination;
    return true;
  }

  function appendOption(group, row, index) {
    const destination = resolveSearchDestination(row);
    const option = createElement(documentObject, "button", "finder-option");
    option.id = `finder-option-${index}`;
    option.type = "button";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === activeIndex));
    option.dataset.active = String(index === activeIndex);
    if (!destination) {
      option.disabled = true;
      option.setAttribute("aria-disabled", "true");
    }

    const identity = createElement(documentObject, "span", "finder-option-identity");
    identity.textContent = row.label ?? "SIN CÓDIGO";
    const detail = createElement(documentObject, "span", "finder-option-detail");
    detail.textContent = row.sublabel || (row.kind === "casing" ? "SIN DETALLE DE CATÁLOGO" : row.kind === "inspection" ? "SIN CASCO VINCULADO" : "SIN CONFIGURACIÓN");
    const badge = createElement(documentObject, "span", "finder-option-status", statusLabel(row.status));
    option.append(identity, detail, badge);
    option.addEventListener("click", () => navigate(row));
    group.append(option);

  }

  function renderRows(rows, { recent = false } = {}) {
    const groups = groupSearchResults(rows);
    visibleRows = flattenedRows(groups);
    setActiveIndex(visibleRows.length ? Math.min(activeIndex, visibleRows.length - 1) : -1);
    results.replaceChildren();
    input.setAttribute("aria-expanded", String(visibleRows.length > 0));

    if (!visibleRows.length) {
      results.append(createElement(
        documentObject,
        "p",
        "finder-empty",
        recent ? "AÚN NO HAY OBJETOS RECIENTES." : "SIN COINCIDENCIAS CON ESTA BÚSQUEDA.",
      ));
      return;
    }

    let optionIndex = 0;
    for (const kind of ["unit", "casing", "inspection"]) {
      const group = groups[kind];
      if (!group.count) continue;
      const section = createElement(documentObject, "section", "finder-group");
      const groupHeading = createElement(
        documentObject,
        "h3",
        "finder-group-heading",
        `${KIND_LABELS[kind]} · ${group.count}`,
      );
      const hint = createElement(documentObject, "p", "finder-group-hint", KIND_HINTS[kind]);
      const list = createElement(documentObject, "div", "finder-group-list");
      for (const row of group.rows) appendOption(list, row, optionIndex++);
      section.append(groupHeading, hint, list);
      results.append(section);
    }

    if (!recent) scheduleResultAnnouncement(visibleRows.length);
  }

  function render() {
    overlay.dataset.status = indexState.status;
    overlay.setAttribute("aria-busy", String(indexState.status === SEARCH_INDEX_STATES.LOADING));
    if (indexState.status === SEARCH_INDEX_STATES.LOADING) {
      // `disabled` expulsa el foco del combobox. Solo lectura conserva el foco
      // dentro del diálogo mientras el índice termina de cargar.
      input.readOnly = true;
      input.setAttribute("aria-disabled", "true");
      results.replaceChildren(createElement(documentObject, "p", "finder-message", "CARGANDO ÍNDICE…"));
      input.setAttribute("aria-expanded", "false");
      announce("Cargando índice de búsqueda.");
      return;
    }

    input.readOnly = false;
    input.removeAttribute("aria-disabled");
    if (indexState.status === SEARCH_INDEX_STATES.UNAUTHORIZED) {
      results.replaceChildren(createElement(documentObject, "p", "finder-message", "INICIÁ SESIÓN PARA USAR EL BUSCADOR."));
      input.setAttribute("aria-expanded", "false");
      announce("Se requiere iniciar sesión.");
      return;
    }

    if (indexState.status === SEARCH_INDEX_STATES.ERROR) {
      const message = createElement(documentObject, "p", "finder-message", "NO SE PUDO CARGAR EL ÍNDICE.");
      const retry = createElement(documentObject, "button", "finder-retry", "REINTENTAR");
      retry.type = "button";
      retry.addEventListener("click", () => void refresh({ forceRefresh: true }));
      results.replaceChildren(message, retry);
      input.setAttribute("aria-expanded", "false");
      announce("No se pudo cargar el índice. Puedes intentarlo de nuevo.");
      return;
    }

    const query = input.value;
    if (indexState.status === SEARCH_INDEX_STATES.EMPTY) {
      visibleRows = [];
      setActiveIndex(-1);
      input.setAttribute("aria-expanded", "false");
      results.replaceChildren(createElement(
        documentObject,
        "p",
        "finder-message",
        "NO HAY OBJETOS DISPONIBLES PARA ESTA EMPRESA.",
      ));
      announce("No hay objetos disponibles para esta empresa.");
      return;
    }
    if (!searchScope && !query.trim() && !Object.keys(frecency).length) {
      visibleRows = [];
      setActiveIndex(-1);
      input.setAttribute("aria-expanded", "false");
      results.replaceChildren(createElement(
        documentObject,
        "p",
        "finder-empty",
        "AÚN NO HAY OBJETOS RECIENTES. BUSCÁ UNA UNIDAD O NEUMÁTICO.",
      ));
      announce("Todavía no hay objetos recientes.");
      return;
    }
    const scopedRows = rowsForSearchScope(indexState.rows, searchScope);
    const rows = searchScope
      ? searchIndexRows(scopedRows, query, { frecency })
      : query.trim()
        ? searchIndexRows(scopedRows, query, { frecency })
        : recentSearchRows(scopedRows, frecency);
    renderRows(rows, { recent: !searchScope && !query.trim() });
    if (indexState.status === SEARCH_INDEX_STATES.STALE) {
      announce("Mostrando una copia desactualizada del índice.");
    } else if (searchScope) {
      announce(`${rows.length} ${rows.length === 1 ? "resultado" : "resultados"} en ${SCOPE_LABELS[searchScope].toLocaleLowerCase("es")}.`);
    } else if (!query.trim()) {
      announce("Mostrando objetos recientes.");
    }
  }

  async function refresh({ forceRefresh = false } = {}) {
    indexState = createSearchIndexLoadingState();
    activeIndex = -1;
    render();
    try {
      const requiredSession = typeof client?.requireAuth === "function" ? await client.requireAuth() : null;
      indexState = await loadIndex({ client, forceRefresh });
      const session = requiredSession ?? await client?.getSession?.();
      const userId = session?.user?.id;
      const companyId = indexState.companyId;
      frecencyScope = userId && companyId ? { userId, companyId } : null;
      frecency = frecencyScope ? readSearchFrecency(frecencyScope) : {};
    } catch {
      indexState = { status: SEARCH_INDEX_STATES.ERROR, rows: [] };
      frecency = {};
      frecencyScope = null;
    }
    render();
  }

  function onInput() {
    const parsed = parseSearchScope(input.value);
    if (parsed.kind) {
      searchScope = parsed.kind;
      input.value = parsed.query;
      renderScopeChip();
    }
    activeIndex = 0;
    render();
  }

  function onScopeChipClick() {
    clearSearchScope({ focus: true });
  }

  function onKeydown(event) {
    if (event.key === "Backspace" && !input.value && searchScope) {
      event.preventDefault();
      clearSearchScope({ focus: true });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(activeIndex + 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(activeIndex - 1);
      render();
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      render();
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(visibleRows.length - 1);
      render();
    } else if (event.key === "Enter") {
      const activeRow = visibleRows[activeIndex];
      if (activeRow) {
        event.preventDefault();
        navigate(activeRow);
      }
    }
  }

  const focusTrap = createFocusTrap({
    container: overlay,
    documentObject,
    initialFocus: input,
    onEscape: () => close(),
  });

  function open(trigger = documentObject.activeElement) {
    if (isOpen) return;
    isOpen = true;
    overlay.hidden = false;
    input.value = "";
    searchScope = null;
    renderScopeChip();
    activeIndex = -1;
    focusTrap.activate({ trigger, focus: true });
    void refresh();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.hidden = true;
    input.value = "";
    input.removeAttribute("aria-activedescendant");
    focusTrap.deactivate({ restore: true });
  }

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeydown);
  scopeChip.addEventListener("click", onScopeChipClick);
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  return {
    open,
    close,
    refresh,
    destroy() {
      close();
      if (resultAnnouncementTimer != null) globalThis.clearTimeout(resultAnnouncementTimer);
      focusTrap.destroy();
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeydown);
      scopeChip.removeEventListener("click", onScopeChipClick);
      overlay.remove();
    },
    get element() {
      return overlay;
    },
    get openState() {
      return isOpen;
    },
  };
}

/**
 * Puente de arranque para la futura integración de pantallas. No monta ningún
 * disparador: task_07 decide dónde abrir el overlay, pero asegura que el
 * controlador nazca después de `onRenovaSupabaseReady`.
 */
export function createFinderWhenSupabaseReady({
  onReady = globalThis.onRenovaSupabaseReady,
  ...options
} = {}) {
  if (typeof onReady !== "function") {
    throw new TypeError("onRenovaSupabaseReady debe estar disponible para montar el buscador.");
  }

  let controller = null;
  onReady(() => {
    controller = createFinderController({
      ...options,
      client: options.client ?? globalThis.RenovaSupabase,
    });
  });

  return {
    get controller() {
      return controller;
    },
  };
}
