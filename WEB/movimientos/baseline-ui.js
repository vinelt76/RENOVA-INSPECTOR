import { createFocusTrap } from "./a11y.js";

const CONDITIONS = ["N", "R1", "R2", "R3", "R4"];

function createElement(documentObject, tag, className, text) {
  const element = documentObject.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function formatInspectionDate(value) {
  if (!value) return "fecha no disponible";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function appendField(documentObject, container, {
  label,
  field,
  value,
  position,
  type = "text",
  required = false,
  options,
  step,
  min,
}) {
  const wrapper = createElement(documentObject, "label", "tc-baseline-field");
  const caption = createElement(documentObject, "span", null, label);
  const input = options
    ? createElement(documentObject, "select")
    : createElement(documentObject, "input");
  input.dataset.baselineField = field;
  if (position != null) input.dataset.position = String(position);
  input.required = required;
  if (!options) {
    input.type = type;
    if (step != null) input.step = step;
    if (min != null) input.min = min;
  } else {
    for (const optionValue of options) {
      const option = createElement(documentObject, "option", null, optionValue);
      option.value = optionValue;
      input.append(option);
    }
  }
  input.value = value ?? "";
  wrapper.append(caption, input);
  container.append(wrapper);
  return input;
}

function validationMessage(result) {
  return result?.violations
    ?.map(({ message }) => message)
    .filter(Boolean)
    .join(" ") || "No se pudo actualizar el primer montaje.";
}

export function createBaselineUI({
  documentObject = globalThis.document,
  getModel,
  onHeaderChange,
  onMountChange,
  onRemove,
  onConfirm,
  onRetry,
  onSearchInventory,
} = {}) {
  for (const callback of [
    getModel,
    onHeaderChange,
    onMountChange,
    onRemove,
    onConfirm,
    onRetry,
    onSearchInventory,
  ]) {
    if (typeof callback !== "function") {
      throw new TypeError("baseline-ui requiere el modelo y todos sus callbacks.");
    }
  }

  const elements = {
    overlay: documentObject.getElementById("movimientos-baseline-overlay"),
    dialog: documentObject.getElementById("movimientos-baseline-dialog"),
    form: documentObject.getElementById("movimientos-baseline-form"),
    mounts: documentObject.getElementById("movimientos-baseline-mounts"),
    performedAt: documentObject.getElementById("movimientos-baseline-performed-at"),
    odometer: documentObject.getElementById("movimientos-baseline-odometer"),
    source: documentObject.getElementById("movimientos-baseline-source"),
    realtime: documentObject.getElementById("movimientos-baseline-realtime"),
    feedback: documentObject.getElementById("movimientos-baseline-feedback"),
    close: documentObject.getElementById("movimientos-baseline-close"),
    addAnother: documentObject.getElementById("movimientos-baseline-add-another"),
    confirm: documentObject.getElementById("movimientos-baseline-confirm"),
    retry: documentObject.getElementById("movimientos-baseline-retry"),
    search: documentObject.getElementById("movimientos-baseline-search-inventory"),
  };
  if (Object.values(elements).some((element) => !element)) {
    throw new Error("No se encontró la estructura HTML del primer montaje.");
  }

  let active = false;
  let busy = false;
  const focusTrap = createFocusTrap({
    container: elements.overlay,
    documentObject,
    initialFocus: elements.performedAt,
    onEscape: () => close(),
  });

  function setFeedback(message = "", kind = "info", {
    canRetry = false,
    canSearch = false,
  } = {}) {
    elements.feedback.textContent = message;
    elements.feedback.dataset.kind = kind;
    elements.retry.hidden = !canRetry;
    elements.search.hidden = !canSearch;
  }

  function buildMountCard(mount) {
    const card = createElement(documentObject, "fieldset", "tc-baseline-mount");
    card.dataset.position = String(mount.position);
    const legend = createElement(
      documentObject,
      "legend",
      null,
      `POSICIÓN ${mount.position} · según la inspección del ${formatInspectionDate(mount.source_inspected_on)}`,
    );
    card.append(legend);

    const grid = createElement(documentObject, "div", "tc-baseline-grid");
    appendField(documentObject, grid, {
      label: "Código del casco",
      field: "casing_code",
      value: mount.casing_code,
      position: mount.position,
      required: !mount.life_cycle_id,
    });
    appendField(documentObject, grid, {
      label: "Marca",
      field: "brand_name",
      value: mount.brand_name,
      position: mount.position,
    });
    appendField(documentObject, grid, {
      label: "Modelo",
      field: "model_name",
      value: mount.model_name,
      position: mount.position,
    });
    appendField(documentObject, grid, {
      label: "Medida",
      field: "size_name",
      value: mount.size_name,
      position: mount.position,
    });
    appendField(documentObject, grid, {
      label: "Condición",
      field: "condition",
      value: mount.condition,
      position: mount.position,
      required: true,
      options: CONDITIONS,
    });
    appendField(documentObject, grid, {
      label: "Diseño de reencauche",
      field: "retread_design",
      value: mount.retread_design,
      position: mount.position,
      required: mount.condition !== "N",
    });
    appendField(documentObject, grid, {
      label: "OTD original (mm, opcional)",
      field: "otd_mm",
      value: mount.otd_mm,
      position: mount.position,
      type: "number",
      step: "0.1",
      min: "0",
    });
    appendField(documentObject, grid, {
      label: "RTD MOVI (mm)",
      field: "rtd_mm",
      value: mount.rtd_mm,
      position: mount.position,
      type: "number",
      step: "0.1",
    });
    appendField(documentObject, grid, {
      label: "Medición fuente",
      field: "source_measurement_id",
      value: mount.source_measurement_id,
      position: mount.position,
      required: true,
    });
    appendField(documentObject, grid, {
      label: "Notas",
      field: "notes",
      value: mount.notes,
      position: mount.position,
    });
    card.append(grid);

    if (mount.life_cycle_id) {
      card.append(createElement(
        documentObject,
        "p",
        "tc-baseline-cycle",
        `CICLO DE INVENTARIO: ${mount.life_cycle_id}`,
      ));
    }

    const remove = createElement(documentObject, "button", "btn-accion", "Quitar posición");
    remove.type = "button";
    remove.dataset.baselineAction = "remove";
    remove.dataset.position = String(mount.position);
    card.append(remove);
    return card;
  }

  function render() {
    const model = getModel();
    const state = model?.state;
    if (!state) return;
    elements.performedAt.value = state.performed_at ?? "";
    elements.odometer.value = state.odometer ?? "";
    elements.mounts.replaceChildren();
    for (const mount of state.mounts) elements.mounts.append(buildMountCard(mount));
    const sources = state.mounts.map(
      (mount) => `P${mount.position}: ${formatInspectionDate(mount.source_inspected_on)}`,
    );
    elements.source.textContent = sources.length
      ? `Datos precargados según la inspección de ${sources.join(" · ")}. Revisalos antes de confirmar.`
      : "Seleccioná una posición pendiente para comenzar.";
    elements.confirm.disabled = busy || !state.mounts.length;
    elements.addAnother.disabled = busy;
    elements.close.disabled = busy;
  }

  function open({ trigger = documentObject.activeElement } = {}) {
    if (!active || !getModel()) return false;
    render();
    elements.overlay.classList.add("open");
    elements.overlay.setAttribute("aria-hidden", "false");
    focusTrap.activate({ trigger });
    return true;
  }

  function close({ restore = true, force = false } = {}) {
    if (busy && !force) return false;
    elements.overlay.classList.remove("open");
    elements.overlay.setAttribute("aria-hidden", "true");
    focusTrap.deactivate({ restore });
    return true;
  }

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    elements.form.setAttribute("aria-busy", String(busy));
    for (const control of elements.form.querySelectorAll("input, select, button")) {
      control.disabled = busy;
    }
    elements.confirm.textContent = busy ? "Confirmando…" : "Confirmar primer montaje";
    if (!busy) render();
  }

  function showRealtimeBanner(show = true) {
    elements.realtime.hidden = !show;
  }

  function onChange(event) {
    const field = event.target.dataset.baselineField;
    if (!field) return;
    let result;
    if (event.target.dataset.position) {
      result = onMountChange(Number(event.target.dataset.position), {
        [field]: event.target.value,
      });
    } else {
      result = onHeaderChange({ [field]: event.target.value });
    }
    if (result?.ok === false) setFeedback(validationMessage(result), "error");
    else setFeedback();
    render();
  }

  function onClick(event) {
    const action = event.target.closest("[data-baseline-action]")?.dataset.baselineAction;
    if (action !== "remove") return;
    onRemove(Number(event.target.closest("[data-position]").dataset.position));
    setFeedback();
    render();
  }

  async function onSubmit(event) {
    event.preventDefault();
    await onConfirm();
  }

  elements.form.addEventListener("change", onChange);
  elements.form.addEventListener("click", onClick);
  elements.form.addEventListener("submit", onSubmit);
  elements.close.addEventListener("click", () => close());
  elements.addAnother.addEventListener("click", () => close());
  elements.retry.addEventListener("click", () => void onRetry());
  elements.search.addEventListener("click", () => void onSearchInventory());

  return {
    open,
    close,
    render,
    setBusy,
    setFeedback,
    showRealtimeBanner,
    setActive(nextActive) {
      active = Boolean(nextActive);
      if (!active) close({ restore: false, force: true });
    },
    get isOpen() {
      return elements.overlay.classList.contains("open");
    },
    destroy() {
      close({ restore: false, force: true });
      focusTrap.destroy();
      elements.form.removeEventListener("change", onChange);
      elements.form.removeEventListener("click", onClick);
      elements.form.removeEventListener("submit", onSubmit);
    },
  };
}

export { formatInspectionDate };
