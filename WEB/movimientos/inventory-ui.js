import { createFocusTrap } from "./a11y.js";
import { filterRowsBySearchTokens } from "../shared/search.js";

const SEARCH_FIELDS = [
  "casing_code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
  "last_removal_reason",
  "cycle_number",
];

export function filterInventoryRows(inventory, query = "") {
  return filterRowsBySearchTokens(inventory, query, SEARCH_FIELDS);
}

export function mountedLifeCycleIds(draft) {
  return new Set(
    (draft?.movements ?? [])
      .filter((movement) => movement?.op === "mount")
      .map((movement) => movement.life_cycle_id)
      .filter((lifeCycleId) => typeof lifeCycleId === "string" && lifeCycleId),
  );
}

export function inventoryOptions(inventory, draft, query = "") {
  const usedCycles = mountedLifeCycleIds(draft);
  return filterInventoryRows(inventory, query).map((item) => ({
    item,
    disabled: usedCycles.has(item?.life_cycle_id),
    reason: usedCycles.has(item?.life_cycle_id)
      ? "Este ciclo ya se usa en otro montaje del lote."
      : null,
  }));
}

function createElement(documentObject, tagName, className, text) {
  const element = documentObject.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function itemIdentity(item) {
  return item?.casing_code || "CÓDIGO NO VISIBLE";
}

function itemDetails(item) {
  return [
    item?.brand_name,
    item?.model_name,
    item?.size_name,
    item?.condition,
  ].filter(Boolean).join(" · ") || "SIN DETALLE DE CATÁLOGO";
}

function inventoryAge(item) {
  if (item?.days_in_inventory == null) return "SIN RETIRO PREVIO";
  const days = Number(item.days_in_inventory);
  return `${days} ${days === 1 ? "DÍA" : "DÍAS"} EN INVENTARIO`;
}

function resultMessage(result) {
  return result?.violations
    ?.map((violation) => violation?.message)
    .filter(Boolean)
    .join(" ") || "No se pudo agregar el montaje.";
}

export function createInventoryUI({
  container,
  documentObject = globalThis.document,
  getState,
  onSelect,
} = {}) {
  if (!container || typeof getState !== "function" || typeof onSelect !== "function") {
    throw new TypeError("inventory-ui requiere container, getState y onSelect.");
  }

  const card = createElement(documentObject, "section", "tc-card");
  card.dataset.task = "task-11-inventory";
  card.hidden = true;
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-hidden", "true");

  const head = createElement(documentObject, "div", "tc-card-head");
  const heading = createElement(documentObject, "div");
  const eyebrow = createElement(documentObject, "div", "tc-eyebrow", "INVENTARIO / RETÉN");
  const title = createElement(documentObject, "h2", null, "ELEGIR NEUMÁTICO");
  title.id = "movimientos-inventory-title";
  card.setAttribute("aria-labelledby", title.id);
  heading.append(eyebrow, title);
  const closeButton = createElement(documentObject, "button", "btn-accion", "Cerrar");
  closeButton.type = "button";
  closeButton.dataset.inventoryAction = "close";
  head.append(heading, closeButton);

  const note = createElement(
    documentObject,
    "p",
    "tc-status",
    "La disponibilidad se vuelve a validar al confirmar el lote.",
  );
  note.style.minHeight = "auto";

  const search = createElement(documentObject, "input");
  search.type = "search";
  search.placeholder = "Buscar código, marca, medida o condición";
  search.setAttribute("aria-label", "Buscar en inventario de neumáticos");
  search.autocomplete = "off";
  search.style.cssText = [
    "width:100%",
    "margin:10px 0",
    "padding:10px 12px",
    "border:2px solid var(--border)",
    "border-radius:8px",
    "background:var(--screen)",
    "color:var(--ice)",
    "font-family:var(--mono)",
    "font-size:11px",
    "font-weight:800",
  ].join(";");

  const summary = createElement(documentObject, "p", "tc-eyebrow");
  summary.setAttribute("aria-live", "polite");

  const list = createElement(documentObject, "div");
  list.setAttribute("role", "region");
  list.setAttribute("aria-label", "Neumáticos disponibles para montaje");
  list.style.cssText = "display:flex;flex-direction:column;gap:8px;max-height:310px;overflow:auto";

  const feedback = createElement(documentObject, "p", "tc-status");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.style.minHeight = "20px";

  card.append(head, note, search, summary, list, feedback);
  container.append(card);

  let targetPosition = null;
  let active = false;
  const focusTrap = createFocusTrap({
    container: card,
    documentObject,
    initialFocus: search,
    onEscape: () => close(),
  });

  function setFeedback(message = "", kind = "info") {
    feedback.textContent = message;
    feedback.dataset.kind = kind;
  }

  function buildItemButton(option) {
    const { item, disabled, reason } = option;
    const button = createElement(documentObject, "button", "tc-position");
    button.type = "button";
    button.dataset.lifeCycleId = item.life_cycle_id;
    button.disabled = disabled;
    button.setAttribute(
      "aria-label",
      `${itemIdentity(item)}. ${itemDetails(item)}. ${inventoryAge(item)}${disabled ? ". Ya usado en este lote" : ""}`,
    );
    button.title = reason || "Elegir para montaje";
    button.style.cssText = "width:100%;min-height:64px;flex:none";

    const condition = createElement(
      documentObject,
      "span",
      "tc-position-number num",
      item.condition || "?",
    );
    const content = createElement(documentObject, "span", "tc-position-copy");
    const code = createElement(
      documentObject,
      "span",
      "tc-position-identity",
      `${itemIdentity(item)}${disabled ? " · YA USADO" : ""}`,
    );
    const details = createElement(documentObject, "span", "tc-position-label", itemDetails(item));
    const age = createElement(documentObject, "span", "tc-position-label", inventoryAge(item));
    content.append(code, details, age);
    button.append(condition, content);
    return button;
  }

  function render(state = getState()) {
    if (targetPosition == null) return;
    const options = inventoryOptions(state.inventory, state.draft, search.value);
    const eligibleCount = options.filter((option) => !option.disabled).length;
    list.replaceChildren();

    if (!state.inventory.length) {
      list.append(createElement(
        documentObject,
        "p",
        "tc-status",
        "No hay neumáticos disponibles en inventario/retén.",
      ));
      summary.textContent = "0 DISPONIBLES";
      return;
    }

    if (!options.length) {
      list.append(createElement(
        documentObject,
        "p",
        "tc-status",
        "No hay resultados para esta búsqueda.",
      ));
      summary.textContent = "0 RESULTADOS";
      return;
    }

    const fragment = documentObject.createDocumentFragment();
    for (const option of options) fragment.append(buildItemButton(option));
    list.append(fragment);
    summary.textContent = `${eligibleCount} ELEGIBLES · ${options.length} MOSTRADOS`;
  }

  function open(position, trigger = documentObject.activeElement) {
    const normalizedPosition = Number(position);
    const state = getState();
    if (!state.remoteState.some(
      (row) => Number(row.position_number) === normalizedPosition,
    )) return false;

    focusTrap.deactivate({ restore: false });
    targetPosition = normalizedPosition;
    title.textContent = `MONTAR EN POSICIÓN ${targetPosition}`;
    search.value = "";
    setFeedback();
    card.hidden = false;
    card.setAttribute("aria-hidden", "false");
    render(state);
    focusTrap.activate({ trigger });
    return true;
  }

  function close({ restore = true } = {}) {
    card.hidden = true;
    card.setAttribute("aria-hidden", "true");
    targetPosition = null;
    search.value = "";
    setFeedback();
    focusTrap.deactivate({ restore });
  }

  function onSearchInput() {
    render(getState());
  }

  function onContainerClick(event) {
    const closeTarget = event.target.closest('[data-inventory-action="close"]');
    if (active && closeTarget && card.contains(closeTarget)) {
      close();
      return;
    }

    const button = event.target.closest("[data-life-cycle-id]");
    if (!active || !button || !card.contains(button) || button.disabled) return;
    const state = getState();
    const item = state.inventory.find(
      (row) => row.life_cycle_id === button.dataset.lifeCycleId,
    );
    if (!item) {
      setFeedback("Este ciclo ya no aparece en el inventario cargado.", "error");
      render(state);
      return;
    }
    if (mountedLifeCycleIds(state.draft).has(item.life_cycle_id)) {
      setFeedback("Este ciclo ya se usa en otro montaje del lote.", "error");
      render(state);
      return;
    }

    const result = onSelect(item, targetPosition);
    if (result?.ok) close();
    else setFeedback(resultMessage(result), "error");
  }

  search.addEventListener("input", onSearchInput);
  container.addEventListener("click", onContainerClick);

  return {
    open,
    close,
    render,
    setActive(nextActive) {
      active = Boolean(nextActive);
      if (!active && !card.hidden) close({ restore: false });
    },
    destroy() {
      close({ restore: false });
      focusTrap.destroy();
      search.removeEventListener("input", onSearchInput);
      container.removeEventListener("click", onContainerClick);
      card.remove();
    },
  };
}
