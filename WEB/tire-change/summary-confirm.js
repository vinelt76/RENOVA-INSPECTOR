import { DISCARD_CAUSES } from "./batch-model.js";
import { focusFirst } from "./a11y.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createElement(documentObject, tagName, className, text) {
  const element = documentObject.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function localToday(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultSummaryHeader(now = new Date()) {
  return { performedAt: localToday(now), odometer: "", notes: "" };
}

export function summaryRows(draftOrPayload) {
  return (draftOrPayload?.movements ?? [])
    .map((movement, index) => ({
      movement,
      index,
      seq: Number.isInteger(Number(movement?.seq)) && Number(movement.seq) > 0
        ? Number(movement.seq)
        : index + 1,
    }))
    .sort((a, b) => a.seq - b.seq || a.index - b.index);
}

export function validateSummaryHeader(header) {
  const performedAt = String(header?.performedAt ?? "").trim();
  const odometerText = String(header?.odometer ?? "").trim();
  const notes = String(header?.notes ?? "").trim();
  const errors = [];

  if (!isValidDate(performedAt)) {
    errors.push("Elegí una fecha válida.");
  }
  if (!/^\d+$/.test(odometerText) || !Number.isSafeInteger(Number(odometerText))) {
    errors.push("El odómetro es obligatorio y debe ser un entero válido.");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      performedAt,
      odometer: errors.some((message) => message.startsWith("El odómetro"))
        ? null
        : Number(odometerText),
      notes: notes || null,
    },
  };
}

export function installationDateWarning(performedAt, remoteState, draft) {
  if (!isValidDate(performedAt)) return null;
  const positions = affectedInstalledPositions(draft);
  const laterRows = (remoteState ?? []).filter((row) => {
    const installedOn = String(row?.installed_at ?? "").slice(0, 10);
    return positions.has(Number(row?.position_number)) &&
      isValidDate(installedOn) &&
      installedOn > performedAt;
  });
  if (!laterRows.length) return null;

  const labels = laterRows
    .map((row) => `P${Number(row.position_number)}`)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return `Revisá la fecha: es anterior a la instalación visible de ${labels.join(", ")}.`;
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function affectedInstalledPositions(draft) {
  const positions = new Set();
  for (const movement of draft?.movements ?? []) {
    if (["send_to_retention", "discard"].includes(movement?.op)) {
      positions.add(Number(movement.position));
    } else if (movement?.op === "swap") {
      positions.add(Number(movement.position_a));
      positions.add(Number(movement.position_b));
    }
  }
  return positions;
}

function movementTitle(movement) {
  if (movement.op === "send_to_retention") return `Enviar P${movement.position} a retén`;
  if (movement.op === "discard") return `Descartar P${movement.position}`;
  if (movement.op === "mount") return `Montar en P${movement.position}`;
  if (movement.op === "swap") {
    return `Intercambiar P${movement.position_a} ↔ P${movement.position_b}`;
  }
  return "Movimiento no reconocido";
}

function movementDetails(movement) {
  const details = [];
  if (movement.op === "discard" && movement.discard_cause) {
    details.push(movement.discard_cause);
  }
  if (movement.op === "mount") details.push("ciclo de inventario reservado");
  if (movement.rtd_mm != null) details.push(`RTD ${movement.rtd_mm} mm`);
  if (movement.rtd_mm_a != null) details.push(`RTD A ${movement.rtd_mm_a} mm`);
  if (movement.rtd_mm_b != null) details.push(`RTD B ${movement.rtd_mm_b} mm`);
  if (movement.notes) details.push(movement.notes);
  return details.join(" · ") || "Sin datos adicionales";
}

function inputStyle() {
  return [
    "width:100%",
    "padding:9px 10px",
    "border:2px solid var(--border)",
    "border-radius:7px",
    "background:var(--screen)",
    "color:var(--ice)",
    "font-family:var(--mono)",
    "font-size:11px",
    "font-weight:800",
  ].join(";");
}

function createField(documentObject, labelText, input) {
  const label = createElement(documentObject, "label", "tc-status", labelText);
  label.style.cssText = "display:flex;flex-direction:column;gap:5px;min-height:auto";
  input.style.cssText = inputStyle();
  label.append(input);
  return label;
}

function optionalNumber(value) {
  const normalized = String(value ?? "").trim();
  return normalized === "" ? null : Number(normalized);
}

export function createSummaryConfirmUI({
  container,
  documentObject = globalThis.document,
  getState,
  onHeaderChange,
  onUndo,
  onEdit,
  onConfirm,
  onRetry,
} = {}) {
  const callbacks = [getState, onHeaderChange, onUndo, onEdit, onConfirm, onRetry];
  if (!container || callbacks.some((callback) => typeof callback !== "function")) {
    throw new TypeError("summary-confirm requiere container y todos sus callbacks.");
  }

  const card = createElement(documentObject, "section", "tc-card");
  card.dataset.task = "task-13-summary-confirm";

  const eyebrow = createElement(documentObject, "div", "tc-eyebrow", "CIERRE DEL LOTE");
  const title = createElement(documentObject, "h2", null, "REVISAR Y CONFIRMAR");
  title.id = "cambios-summary-title";
  card.setAttribute("aria-labelledby", title.id);
  const realtimeBanner = createElement(documentObject, "p", "tc-status");
  realtimeBanner.hidden = true;
  realtimeBanner.dataset.kind = "warning";
  realtimeBanner.setAttribute("role", "status");
  realtimeBanner.textContent = "El estado de la unidad cambió. Revisá el borrador antes de confirmar.";

  const list = createElement(documentObject, "div");
  list.setAttribute("role", "region");
  list.setAttribute("aria-labelledby", title.id);
  list.style.cssText = "display:flex;flex-direction:column;gap:8px;margin:12px 0";

  const fields = createElement(documentObject, "div");
  fields.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:9px";
  const dateInput = createElement(documentObject, "input");
  dateInput.type = "date";
  dateInput.required = true;
  const odometerInput = createElement(documentObject, "input");
  odometerInput.type = "number";
  odometerInput.min = "0";
  odometerInput.step = "1";
  odometerInput.required = true;
  odometerInput.inputMode = "numeric";
  fields.append(
    createField(documentObject, "FECHA REALIZADA", dateInput),
    createField(documentObject, "ODÓMETRO OBLIGATORIO", odometerInput),
  );

  const notesInput = createElement(documentObject, "textarea");
  notesInput.rows = 2;
  notesInput.maxLength = 1000;
  notesInput.style.resize = "vertical";
  const notesField = createField(documentObject, "NOTAS DEL LOTE (OPCIONAL)", notesInput);
  notesField.style.marginTop = "9px";

  const warning = createElement(documentObject, "p", "tc-status");
  warning.dataset.kind = "warning";
  warning.setAttribute("role", "status");
  warning.style.minHeight = "20px";
  const validation = createElement(documentObject, "p", "tc-status");
  validation.dataset.kind = "error";
  validation.setAttribute("aria-live", "polite");
  validation.style.minHeight = "20px";
  const feedback = createElement(documentObject, "p", "tc-status");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.style.minHeight = "20px";

  const confirmButton = createElement(documentObject, "button", "tc-retry", "CONFIRMAR LOTE");
  confirmButton.type = "button";
  confirmButton.dataset.summaryAction = "confirm";
  const retryButton = createElement(documentObject, "button", "tc-retry", "REINTENTAR MISMO LOTE");
  retryButton.type = "button";
  retryButton.dataset.summaryAction = "retry";
  retryButton.hidden = true;

  card.append(
    eyebrow,
    title,
    realtimeBanner,
    list,
    fields,
    notesField,
    warning,
    validation,
    feedback,
    confirmButton,
    retryButton,
  );
  container.append(card);

  let active = false;
  let editingIndex = null;
  let busy = false;
  let forbidden = false;
  let retryable = false;

  function headerFromInputs() {
    return {
      performedAt: dateInput.value,
      odometer: odometerInput.value,
      notes: notesInput.value,
    };
  }

  function updateValidity(state = getState()) {
    const checked = validateSummaryHeader(headerFromInputs());
    const movementCount = state.draft?.movements?.length ?? 0;
    validation.textContent = checked.errors.join(" ");
    warning.textContent = installationDateWarning(
      checked.value.performedAt,
      state.remoteState,
      state.draft,
    ) ?? "";
    confirmButton.disabled = !active || busy || forbidden || !movementCount || !checked.valid;
    retryButton.disabled = !active || busy || !retryable;
    return checked;
  }

  function buildEditor(row) {
    const { movement, index } = row;
    const editor = createElement(documentObject, "div");
    editor.dataset.summaryEditor = String(index);
    editor.id = `cambios-summary-editor-${index}`;
    editor.setAttribute("role", "group");
    editor.setAttribute("aria-label", `Editar ${movementTitle(movement)}`);
    editor.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px";

    const addNumber = (name, labelText, value) => {
      const input = createElement(documentObject, "input");
      input.type = "number";
      input.min = "0";
      input.step = "0.1";
      input.name = name;
      input.value = value ?? "";
      editor.append(createField(documentObject, labelText, input));
    };

    if (["send_to_retention", "discard", "mount"].includes(movement.op)) {
      addNumber("rtd_mm", "RTD (MM)", movement.rtd_mm);
    } else if (movement.op === "swap") {
      addNumber("rtd_mm_a", "RTD A (MM)", movement.rtd_mm_a);
      addNumber("rtd_mm_b", "RTD B (MM)", movement.rtd_mm_b);
    }

    if (movement.op === "discard") {
      const cause = createElement(documentObject, "select");
      cause.name = "discard_cause";
      for (const optionValue of DISCARD_CAUSES) {
        const option = createElement(documentObject, "option", null, optionValue);
        option.value = optionValue;
        option.selected = optionValue === movement.discard_cause;
        cause.append(option);
      }
      editor.append(createField(documentObject, "CAUSA", cause));
    }

    const notes = createElement(documentObject, "input");
    notes.type = "text";
    notes.name = "notes";
    notes.maxLength = 1000;
    notes.value = movement.notes ?? "";
    const notesLabel = createField(documentObject, "NOTAS", notes);
    notesLabel.style.gridColumn = "1 / -1";
    editor.append(notesLabel);

    const save = createElement(documentObject, "button", "btn-accion", "Guardar cambios");
    save.type = "button";
    save.dataset.summaryAction = "save-edit";
    save.dataset.index = String(index);
    const cancel = createElement(documentObject, "button", "btn-accion", "Cancelar");
    cancel.type = "button";
    cancel.dataset.summaryAction = "cancel-edit";
    cancel.dataset.index = String(index);
    editor.append(save, cancel);
    return editor;
  }

  function buildMovementRow(row) {
    const wrapper = createElement(documentObject, "article", "tc-position");
    wrapper.style.cssText = "width:100%;min-height:64px;align-items:flex-start;cursor:default";
    const seq = createElement(documentObject, "span", "tc-position-number", String(row.seq));
    const content = createElement(documentObject, "div", "tc-position-copy");
    content.style.cssText = "flex:1;max-width:none";
    const name = createElement(documentObject, "strong", "tc-position-identity", movementTitle(row.movement));
    name.style.maxWidth = "none";
    const details = createElement(documentObject, "span", "tc-position-label", movementDetails(row.movement));
    details.style.cssText = "max-width:none;white-space:normal";
    const actions = createElement(documentObject, "div");
    actions.style.cssText = "display:flex;gap:6px;margin-top:7px;flex-wrap:wrap";
    const edit = createElement(documentObject, "button", "btn-accion", "Editar");
    edit.type = "button";
    edit.dataset.summaryAction = "edit";
    edit.dataset.index = String(row.index);
    edit.setAttribute("aria-label", `Editar ${movementTitle(row.movement)}`);
    edit.setAttribute("aria-expanded", String(editingIndex === row.index));
    edit.setAttribute("aria-controls", `cambios-summary-editor-${row.index}`);
    const undo = createElement(documentObject, "button", "btn-accion danger", "Deshacer");
    undo.type = "button";
    undo.dataset.summaryAction = "undo";
    undo.dataset.index = String(row.index);
    undo.setAttribute("aria-label", `Deshacer ${movementTitle(row.movement)}`);
    edit.disabled = busy;
    undo.disabled = busy;
    actions.append(edit, undo);
    content.append(name, details, actions);
    if (editingIndex === row.index) content.append(buildEditor(row));
    wrapper.append(seq, content);
    return wrapper;
  }

  function render(state = getState()) {
    const header = state.draft?.header ?? defaultSummaryHeader();
    if (documentObject.activeElement !== dateInput) dateInput.value = header.performedAt ?? "";
    if (documentObject.activeElement !== odometerInput) odometerInput.value = header.odometer ?? "";
    if (documentObject.activeElement !== notesInput) notesInput.value = header.notes ?? "";
    list.replaceChildren();
    const rows = summaryRows(state.draft);
    if (!rows.length) {
      list.append(createElement(
        documentObject,
        "p",
        "tc-status",
        "Todavía no hay movimientos. Prepará al menos uno para confirmar.",
      ));
    } else {
      const fragment = documentObject.createDocumentFragment();
      for (const row of rows) fragment.append(buildMovementRow(row));
      list.append(fragment);
    }
    updateValidity(state);
  }

  function notifyHeaderChange() {
    onHeaderChange(headerFromInputs());
    updateValidity();
  }

  function readEdit(index) {
    const editor = list.querySelector(`[data-summary-editor="${index}"]`);
    if (!editor) return null;
    const changes = { notes: editor.querySelector('[name="notes"]')?.value.trim() || null };
    for (const name of ["rtd_mm", "rtd_mm_a", "rtd_mm_b"]) {
      const input = editor.querySelector(`[name="${name}"]`);
      if (input) changes[name] = optionalNumber(input.value);
    }
    const cause = editor.querySelector('[name="discard_cause"]');
    if (cause) changes.discard_cause = cause.value;
    return changes;
  }

  async function onCardClick(event) {
    const button = event.target.closest("[data-summary-action]");
    if (!active || !button || !card.contains(button) || button.disabled) return;
    const action = button.dataset.summaryAction;
    const index = Number(button.dataset.index);

    if (action === "edit") {
      editingIndex = index;
      render();
      focusFirst(list.querySelector(`[data-summary-editor="${index}"]`));
    } else if (action === "cancel-edit") {
      editingIndex = null;
      render();
      list.querySelector(`[data-summary-action="edit"][data-index="${index}"]`)?.focus();
    } else if (action === "save-edit") {
      const result = await onEdit(index, readEdit(index));
      if (result?.ok) editingIndex = null;
      render();
      if (result?.ok) {
        list.querySelector(`[data-summary-action="edit"][data-index="${index}"]`)?.focus();
      } else {
        focusFirst(list.querySelector(`[data-summary-editor="${index}"]`), confirmButton);
      }
    } else if (action === "undo") {
      await onUndo(index);
      if (editingIndex === index) editingIndex = null;
      render();
      focusFirst(list, confirmButton);
    } else if (action === "confirm") {
      const checked = updateValidity();
      if (checked.valid) await onConfirm(checked.value);
    } else if (action === "retry") {
      await onRetry();
    }
  }

  dateInput.addEventListener("input", notifyHeaderChange);
  odometerInput.addEventListener("input", notifyHeaderChange);
  notesInput.addEventListener("input", notifyHeaderChange);
  card.addEventListener("click", onCardClick);

  return {
    render,
    getHeaderValidation() {
      return validateSummaryHeader(headerFromInputs());
    },
    setBusy(nextBusy) {
      busy = Boolean(nextBusy);
      card.setAttribute("aria-busy", String(busy));
      confirmButton.textContent = busy ? "CONFIRMANDO…" : "CONFIRMAR LOTE";
      updateValidity();
      render();
    },
    setFeedback(message = "", kind = "info", { canRetry = false, lock = false } = {}) {
      feedback.textContent = message;
      feedback.dataset.kind = kind;
      retryable = Boolean(canRetry);
      forbidden = Boolean(lock);
      retryButton.hidden = !retryable;
      updateValidity();
    },
    showRealtimeBanner(show = true) {
      realtimeBanner.hidden = !show;
    },
    setActive(nextActive) {
      active = Boolean(nextActive);
      updateValidity();
    },
    destroy() {
      dateInput.removeEventListener("input", notifyHeaderChange);
      odometerInput.removeEventListener("input", notifyHeaderChange);
      notesInput.removeEventListener("input", notifyHeaderChange);
      card.removeEventListener("click", onCardClick);
      card.remove();
    },
  };
}
