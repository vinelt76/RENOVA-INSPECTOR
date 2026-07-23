import { groupDraftByPosition, MOVEMENT_REASONS } from "./supervisor-order-model.js";
import { filterRowsBySearchTokens } from "../shared/search.js";

const INVENTORY_SEARCH_FIELDS = [
  "casing_code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
];

const STATUS_LABELS = Object.freeze({
  issued: "EMITIDA",
  in_progress: "EN EJECUCIÓN",
  completed: "COMPLETADA",
  cancelled: "CANCELADA",
});

function element(documentObject, tag, className, text) {
  const node = documentObject.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function itemLabel(item) {
  if (item.direction === "entry") {
    return `INSTALAR ${item.casing_code || "DESDE INVENTARIO"} · P${item.position}`;
  }
  return `${MOVEMENT_REASONS[item.reason] ?? "SALIDA"} · P${item.position}`;
}

function inventoryIdentity(item) {
  return item?.casing_code || "CÓDIGO NO VISIBLE";
}

function inventoryDetail(item) {
  return [item?.brand_name, item?.model_name, item?.size_name, item?.condition]
    .filter(Boolean)
    .join(" · ") || "SIN DETALLE DE CATÁLOGO";
}

export function inventoryOptionsForService(inventory, draft, query = "") {
  const selected = new Set(
    (draft?.items ?? [])
      .filter((item) => item?.direction === "entry" && item?.life_cycle_id)
      .map((item) => item.life_cycle_id),
  );
  return filterRowsBySearchTokens(inventory ?? [], query, INVENTORY_SEARCH_FIELDS).map((item) => ({
    item,
    disabled: selected.has(item.life_cycle_id),
  }));
}

function formatDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date);
}

function executionIdentity(row) {
  if (row.code_unreadable) return "SIN CÓDIGO LEGIBLE";
  return row.casing_code || "CÓDIGO PENDIENTE";
}

export function createSupervisorOrdersUI({
  details,
  workspace,
  getState,
  onAddServiceFromInventory,
  onAddRotation,
  onRemovePosition,
  onDraftHeader,
  onEmit,
  onReload,
  documentObject = globalThis.document,
} = {}) {
  if (!details || !workspace) throw new TypeError("La UI de órdenes necesita panel y workspace.");

  const actions = element(documentObject, "div", "tc-order-actions");
  actions.dataset.supervisorOrderActions = "";
  details.append(actions);

  const root = element(documentObject, "div", "tc-supervisor-workspace");
  const editor = element(documentObject, "section", "tc-card tc-order-editor");
  const editorHead = element(documentObject, "div", "tc-card-head");
  const editorTitle = element(documentObject, "div");
  editorTitle.append(
    element(documentObject, "div", "tc-eyebrow", "ORDEN DEL SUPERVISOR"),
    element(documentObject, "h2", "", "Indicaciones para el operario"),
  );
  editorHead.append(editorTitle, element(documentObject, "span", "tc-readonly-badge", "SIN CAPTURA TÉCNICA"));

  const headerGrid = element(documentObject, "div", "tc-order-header-grid");
  const dateLabel = element(documentObject, "label", "tc-field-label", "FECHA PROGRAMADA");
  const date = element(documentObject, "input", "tc-order-input");
  date.type = "date";
  date.name = "scheduled_for";
  dateLabel.append(date);
  const instructionsLabel = element(documentObject, "label", "tc-field-label", "INSTRUCCIÓN GENERAL");
  const instructions = element(documentObject, "textarea", "tc-order-input");
  instructions.name = "instructions";
  instructions.rows = 2;
  instructions.maxLength = 600;
  instructions.placeholder = "Ej. atender antes de la salida del turno";
  instructionsLabel.append(instructions);
  headerGrid.append(dateLabel, instructionsLabel);

  const items = element(documentObject, "div", "tc-order-items");
  const feedback = element(documentObject, "p", "tc-status tc-order-feedback");
  feedback.setAttribute("role", "status");
  const emit = element(documentObject, "button", "btn-accion tc-order-emit", "EMITIR ORDEN AL OPERARIO");
  emit.type = "button";
  editor.append(editorHead, headerGrid, items, feedback, emit);

  const tracking = element(documentObject, "section", "tc-card tc-order-tracking");
  const trackingHead = element(documentObject, "div", "tc-card-head");
  const trackingTitle = element(documentObject, "div");
  trackingTitle.append(
    element(documentObject, "div", "tc-eyebrow", "SEGUIMIENTO"),
    element(documentObject, "h2", "", "Órdenes de esta unidad"),
  );
  const reload = element(documentObject, "button", "tc-order-refresh", "ACTUALIZAR");
  reload.type = "button";
  trackingHead.append(trackingTitle, reload);
  const orderList = element(documentObject, "div", "tc-order-list");
  tracking.append(trackingHead, orderList);
  root.append(editor, tracking);
  workspace.replaceChildren(root);

  let active = false;
  let busy = false;

  function setFeedback(message = "", kind = "info") {
    feedback.textContent = message;
    feedback.dataset.kind = kind;
  }

  function positionOptions(state, excludedPosition) {
    const select = element(documentObject, "select", "tc-order-input");
    select.setAttribute("aria-label", "Posición destino de rotación");
    const placeholder = element(documentObject, "option", "", "POSICIÓN DESTINO");
    placeholder.value = "";
    select.append(placeholder);
    for (const row of state.remoteState ?? []) {
      const position = Number(row.position_number);
      if (position === Number(excludedPosition)) continue;
      const option = element(documentObject, "option", "", `P${position}`);
      option.value = String(position);
      select.append(option);
    }
    return select;
  }

  function renderActions(state) {
    actions.replaceChildren();
    if (!active || state.status !== "ready" || !state.selected || !state.authorized) return;

    const title = element(documentObject, "div", "tc-action-title", "DIRIGIR MOVIMIENTO");
    const reason = element(documentObject, "select", "tc-order-input");
    reason.setAttribute("aria-label", "Destino o razón de salida");
    for (const [value, label] of Object.entries(MOVEMENT_REASONS)) {
      const option = element(documentObject, "option", "", label);
      option.value = value;
      reason.append(option);
    }
    const notes = element(documentObject, "input", "tc-order-input");
    notes.type = "text";
    notes.maxLength = 240;
    notes.placeholder = "Nota para el operario (opcional)";
    const target = positionOptions(state, state.selected);
    const rotate = element(documentObject, "button", "btn-accion tc-order-rotate", "AGREGAR ROTACIÓN");
    rotate.type = "button";
    rotate.addEventListener("click", () => {
      const result = onAddRotation(state.selected, target.value, notes.value);
      setFeedback(
        result?.ok ? "Rotación agregada al borrador." : result?.errors?.join(" "),
        result?.ok ? "success" : "error",
      );
    });

    const inventory = element(documentObject, "section", "tc-order-inventory");
    const inventoryTitle = element(documentObject, "div", "tc-action-title", "NEUMÁTICO QUE ENTRA DESDE INVENTARIO");
    const inventoryHelp = element(
      documentObject,
      "p",
      "tc-order-inventory-help",
      "Haz clic en la llanta que reemplazará a la actual en esta misma posición.",
    );
    const search = element(documentObject, "input", "tc-order-input");
    search.type = "search";
    search.placeholder = "Buscar código, marca, modelo o medida";
    search.setAttribute("aria-label", "Buscar neumático disponible en inventario");
    const inventoryList = element(documentObject, "div", "tc-order-inventory-list");
    inventoryList.setAttribute("aria-live", "polite");
    inventory.append(inventoryTitle, inventoryHelp, search, inventoryList);

    function renderInventory() {
      inventoryList.replaceChildren();
      const options = inventoryOptionsForService(state.inventory, state.draft, search.value);
      if (!state.inventory?.length) {
        inventoryList.append(element(documentObject, "p", "tc-order-empty", "No hay llantas disponibles en inventario/retén."));
        return;
      }
      if (!options.length) {
        inventoryList.append(element(documentObject, "p", "tc-order-empty", "No hay resultados para esta búsqueda."));
        return;
      }
      for (const { item, disabled } of options) {
        const button = element(documentObject, "button", "tc-order-inventory-item");
        button.type = "button";
        button.disabled = disabled;
        button.dataset.lifeCycleId = item.life_cycle_id;
        button.setAttribute(
          "aria-label",
          `${inventoryIdentity(item)}. ${inventoryDetail(item)}${disabled ? ". Ya elegida en este borrador" : ""}`,
        );
        const copy = element(documentObject, "span", "tc-order-inventory-copy");
        copy.append(
          element(documentObject, "strong", "", `${inventoryIdentity(item)}${disabled ? " · YA ELEGIDA" : ""}`),
          element(documentObject, "span", "", inventoryDetail(item)),
          element(
            documentObject,
            "span",
            "",
            `RTD ${item.last_rtd_mm ?? "—"} mm · ${item.days_in_inventory ?? "—"} días en inventario`,
          ),
        );
        button.append(copy, element(
          documentObject,
          "span",
          "tc-order-inventory-pick",
          disabled ? "ELEGIDA" : "ELEGIR",
        ));
        button.addEventListener("click", () => {
          const result = onAddServiceFromInventory(
            state.selected,
            reason.value,
            item,
            notes.value,
          );
          setFeedback(
            result?.ok
              ? `${inventoryIdentity(item)} entrará en P${state.selected}.`
              : result?.errors?.join(" "),
            result?.ok ? "success" : "error",
          );
        });
        inventoryList.append(button);
      }
    }

    function updateFlow() {
      const rotation = reason.value === "rotation";
      target.hidden = !rotation;
      rotate.hidden = !rotation;
      inventory.hidden = rotation;
      if (!rotation) renderInventory();
    }

    reason.addEventListener("change", updateFlow);
    search.addEventListener("input", renderInventory);
    actions.append(title, reason, target, notes, rotate, inventory);
    updateFlow();
  }

  // Una fila por posición atendida, como la planilla: P una sola vez, luego lo que
  // sale y lo que entra. Quitar retira la posición entera; quitar media dejaría un
  // borrador que no se puede emitir.
  function renderItems(state) {
    items.replaceChildren();
    const groups = groupDraftByPosition(state.draft);
    if (!groups.length) {
      items.append(element(documentObject, "p", "tc-order-empty", "Selecciona una posición y agrega la instrucción. El operario completará los datos técnicos."));
      return;
    }
    groups.forEach((group) => {
      const row = element(documentObject, "div", "tc-order-item");
      const copy = element(documentObject, "div");
      copy.append(element(documentObject, "strong", "", `P${group.position}`));

      if (group.exit) {
        copy.append(element(documentObject, "span", "", `SALE · ${MOVEMENT_REASONS[group.exit.reason] ?? "SALIDA"}`));
      }
      if (group.entry) {
        copy.append(element(
          documentObject,
          "span",
          "",
          `ENTRA · ${group.entry.casing_code || "ROTACIÓN ENTRE POSICIONES"}`,
        ));
      } else if (group.exit?.without_entry) {
        copy.append(element(documentObject, "span", "tc-order-warn", "ENTRA · SIN REEMPLAZO (declarado)"));
      } else if (group.exit) {
        copy.append(element(documentObject, "span", "tc-order-warn", "ENTRA · FALTA INDICAR"));
      }

      const notes = group.exit?.notes || group.entry?.notes;
      copy.append(element(documentObject, "span", "", notes || "Sin nota adicional"));

      const buttons = element(documentObject, "div", "tc-order-item-actions");
      const remove = element(documentObject, "button", "tc-order-remove", "QUITAR");
      remove.type = "button";
      remove.setAttribute("aria-label", `Quitar P${group.position}`);
      remove.addEventListener("click", () => onRemovePosition(group.position));
      buttons.append(remove);

      row.append(copy, buttons);
      items.append(row);
    });
  }

  function renderExecutions(order, executions) {
    if (!executions.length) return null;
    const list = element(documentObject, "div", "tc-execution-list");
    executions.forEach((row) => {
      const item = element(documentObject, "div", "tc-execution-row");
      const direction = row.direction === "exit"
        ? MOVEMENT_REASONS[row.movement_reason] ?? "SALIDA"
        : "INSTALADO";
      item.append(
        element(documentObject, "strong", "", `P${row.position_number} · ${direction}`),
        element(documentObject, "span", "", `${executionIdentity(row)} · ${row.brand_name || "SIN MARCA"} · ${row.size_name || "SIN MEDIDA"}`),
        element(documentObject, "span", "", `RTD ${row.rtd_min_mm ?? "—"} mm · ${row.condition || "—"}${row.retread_design ? ` · ${row.retread_design}` : ""}`),
      );
      list.append(item);
    });
    return list;
  }

  function renderOrders(state) {
    orderList.replaceChildren();
    if (state.status === "loading") {
      orderList.append(element(documentObject, "p", "tc-status is-loading", "Cargando órdenes…"));
      return;
    }
    if (!state.authorized) {
      orderList.append(element(documentObject, "p", "tc-status", state.error?.message || "Este panel requiere un perfil autorizado para emitir órdenes."));
      return;
    }
    if (!state.orders.length) {
      orderList.append(element(documentObject, "p", "tc-order-empty", "Todavía no hay órdenes emitidas para esta unidad."));
      return;
    }
    for (const order of state.orders) {
      const card = element(documentObject, "article", "tc-order-card");
      card.dataset.status = order.status;
      const head = element(documentObject, "div", "tc-order-card-head");
      const status = element(documentObject, "span", "tc-order-status", STATUS_LABELS[order.status] ?? order.status);
      const scheduled = element(documentObject, "span", "", formatDate(order.scheduled_for));
      head.append(status, scheduled);
      const meta = order.status === "issued"
        ? "Esperando que un operario la tome"
        : order.status === "in_progress"
          ? `Tomada por ${order.assigned_to_name || "operario"}`
          : order.status === "completed"
            ? `Completada por ${order.assigned_to_name || "operario"} · ${Number(order.odometer_km).toLocaleString("es-PE")} km`
            : "Orden cancelada";
      card.append(head, element(documentObject, "p", "tc-order-meta", meta));
      if (order.instructions) card.append(element(documentObject, "p", "tc-order-instructions", order.instructions));
      const requested = element(documentObject, "div", "tc-order-requested");
      for (const item of order.request_items ?? []) requested.append(element(documentObject, "span", "", itemLabel(item)));
      card.append(requested);
      const executionRows = state.executions.filter((row) => row.order_id === order.id);
      const executionList = renderExecutions(order, executionRows);
      if (executionList) card.append(executionList);
      orderList.append(card);
    }
  }

  date.addEventListener("change", () => onDraftHeader({ scheduledFor: date.value }));
  instructions.addEventListener("input", () => onDraftHeader({ instructions: instructions.value }));
  emit.addEventListener("click", () => void onEmit());
  reload.addEventListener("click", () => void onReload());

  return {
    setActive(value) {
      active = Boolean(value);
      root.hidden = !active;
    },
    setBusy(value) {
      busy = Boolean(value);
      emit.disabled = busy;
      reload.disabled = busy;
      emit.textContent = busy ? "EMITIENDO…" : "EMITIR ORDEN AL OPERARIO";
    },
    setFeedback,
    render(state = getState()) {
      root.hidden = !active;
      date.value = state.draft.scheduledFor ?? "";
      if (instructions.value !== state.draft.instructions) instructions.value = state.draft.instructions ?? "";
      editor.hidden = !state.authorized;
      emit.disabled = busy || state.status !== "ready" || !state.draft.items?.length;
      renderActions(state);
      renderItems(state);
      renderOrders(state);
    },
  };
}
