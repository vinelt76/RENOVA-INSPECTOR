import { DISCARD_CAUSES } from "./batch-model.js";
import { createFocusTrap } from "./a11y.js";
import {
  deleteDiscardPhoto,
  discardPhotoPathFromUrl,
  uploadDiscardPhoto,
} from "./storage-client.js";

function selectedRow(state) {
  return state.remoteState.find(
    (row) => Number(row.position_number) === Number(state.selected),
  ) ?? null;
}

function positionRow(state, position) {
  return state.remoteState.find(
    (row) => Number(row.position_number) === Number(position),
  ) ?? null;
}

function movementError(result) {
  const messages = result?.violations
    ?.map((violation) => violation?.message)
    .filter(Boolean);
  return messages?.length ? messages.join(" ") : "No se pudo agregar el movimiento.";
}

function createButton(documentObject, action, label, { danger = false } = {}) {
  const button = documentObject.createElement("button");
  button.type = "button";
  button.className = `btn-accion${danger ? " danger" : ""}`;
  button.dataset.movementAction = action;
  button.textContent = label;
  return button;
}

function identity(row) {
  return row?.casing_code || row?.last_inspection_tire_code || "CÓDIGO NO VISIBLE";
}

function createPhotoBatchId() {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("El navegador no puede generar el identificador de la evidencia.");
  }
  return globalThis.crypto.randomUUID();
}

export function createMovementsUI({
  container,
  documentObject = globalThis.document,
  getState,
  onRetention,
  onDiscard,
  onSwap,
  onMount,
  onRequestMount = () => {},
  uploadPhoto = uploadDiscardPhoto,
  deletePhoto = deleteDiscardPhoto,
  photoBatchIdFn = createPhotoBatchId,
  objectUrlApi = documentObject?.defaultView?.URL ?? globalThis.URL,
} = {}) {
  if (!container || typeof getState !== "function") {
    throw new TypeError("movements-ui requiere container y getState.");
  }
  for (const callback of [onRetention, onDiscard, onSwap, onMount]) {
    if (typeof callback !== "function") {
      throw new TypeError("movements-ui requiere callbacks para las cuatro operaciones.");
    }
  }

  const card = documentObject.createElement("section");
  card.className = "tc-card";
  card.dataset.task = "task-10-movements";

  const eyebrow = documentObject.createElement("div");
  eyebrow.className = "tc-eyebrow";
  eyebrow.textContent = "ACCIONES DEL BORRADOR";

  const title = documentObject.createElement("h2");
  title.textContent = "ELEGÍ UNA OPERACIÓN";

  const copy = documentObject.createElement("p");
  copy.className = "tc-status";

  const actions = documentObject.createElement("div");
  actions.className = "acciones-row";

  const feedback = documentObject.createElement("p");
  feedback.className = "tc-status";
  feedback.id = "cambios-movement-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");

  card.append(eyebrow, title, copy, actions, feedback);
  container.replaceChildren(card);

  const modal = {
    overlay: documentObject.getElementById("overlay-descartar"),
    sub: documentObject.getElementById("ds-sub"),
    photo: documentObject.getElementById("ds-foto-btn"),
    cause: documentObject.getElementById("ds-causa"),
    cancel: documentObject.getElementById("ds-cancelar"),
    confirm: documentObject.getElementById("ds-confirmar"),
  };
  if (Object.values(modal).some((element) => !element)) {
    throw new Error("No se encontró el modal de descarte reutilizable.");
  }

  modal.overlay.setAttribute("role", "dialog");
  modal.overlay.setAttribute("aria-modal", "true");
  modal.overlay.setAttribute("aria-hidden", "true");
  modal.overlay.tabIndex = -1;
  const discardTitle = modal.overlay.querySelector("h3");
  if (discardTitle) {
    discardTitle.id ||= "cambios-discard-title";
    modal.overlay.setAttribute("aria-labelledby", discardTitle.id);
  }

  // El HTML histórico conserva el botón visual. El input real se crea aquí
  // para mantener task_12 acotada al módulo de descarte.
  const photoInput = documentObject.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.setAttribute("capture", "environment");
  photoInput.hidden = true;
  photoInput.tabIndex = -1;
  photoInput.setAttribute("aria-hidden", "true");
  modal.photo.insertAdjacentElement("afterend", photoInput);

  let active = false;
  let swapOrigin = null;
  let discardRow = null;
  let discardPhotoUrl = null;
  let discardPhotoPath = null;
  let discardFile = null;
  let discardPreviewUrl = null;
  let discardUploadStatus = "idle";
  let discardUploadError = null;
  let discardUploadPromise = null;
  let discardUploadBatchId = null;
  let discardUploadSequence = null;
  let discardClosing = false;
  let toastTimer = null;
  const discardFocusTrap = createFocusTrap({
    container: modal.overlay,
    documentObject,
    initialFocus: modal.photo,
    onEscape: () => void cancelDiscard(),
  });

  function setFeedback(message = "", kind = "info") {
    feedback.textContent = message;
    feedback.dataset.kind = kind;
  }

  function showToast(message) {
    const toast = documentObject.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function handleResult(result, successMessage) {
    if (!result?.ok) {
      setFeedback(movementError(result), "error");
      return result;
    }
    setFeedback(successMessage, "success");
    showToast(successMessage);
    return result;
  }

  function updateDiscardValidity() {
    modal.confirm.disabled = !(
      discardRow &&
      discardPhotoUrl &&
      discardUploadStatus === "success" &&
      DISCARD_CAUSES.includes(modal.cause.value)
    );
  }

  function revokeDiscardPreview() {
    if (discardPreviewUrl) objectUrlApi?.revokeObjectURL?.(discardPreviewUrl);
    discardPreviewUrl = null;
  }

  function renderDiscardPhoto() {
    const labels = {
      idle: "📷 Adjuntar foto del daño (obligatorio)",
      uploading: "Subiendo evidencia…",
      deleting: "Eliminando evidencia anterior…",
      success: "✓ Evidencia lista · tocar para reemplazar",
      error: "No se pudo subir · tocar para reintentar",
    };
    const label = documentObject.createElement("span");
    label.textContent = labels[discardUploadStatus] ?? labels.idle;

    if (discardPreviewUrl) {
      const preview = documentObject.createElement("img");
      preview.src = discardPreviewUrl;
      preview.alt = "Vista previa de la evidencia de descarte";
      preview.setAttribute(
        "style",
        "display:block;width:100%;max-height:180px;object-fit:cover;margin-bottom:10px;border-radius:6px",
      );
      modal.photo.replaceChildren(preview, label);
    } else {
      modal.photo.replaceChildren(label);
    }

    modal.photo.classList.toggle("taken", discardUploadStatus === "success");
    modal.photo.disabled = ["uploading", "deleting"].includes(discardUploadStatus);
    modal.photo.setAttribute(
      "aria-busy",
      String(["uploading", "deleting"].includes(discardUploadStatus)),
    );
    modal.photo.title = discardUploadError?.message ?? "";
    modal.cancel.disabled = ["uploading", "deleting"].includes(discardUploadStatus);
    updateDiscardValidity();
  }

  function setDiscardUploadStatus(status, error = null) {
    discardUploadStatus = status;
    discardUploadError = error;
    renderDiscardPhoto();
  }

  function resetDiscardEvidence() {
    revokeDiscardPreview();
    discardPhotoUrl = null;
    discardPhotoPath = null;
    discardFile = null;
    discardUploadStatus = "idle";
    discardUploadError = null;
    discardUploadPromise = null;
    discardUploadSequence = null;
    discardClosing = false;
    photoInput.value = "";
  }

  function draftDiscardBatchId(state = getState()) {
    for (const movement of state.draft.movements ?? []) {
      if (movement?.op !== "discard" || !movement.photo_url) continue;
      try {
        return discardPhotoPathFromUrl(movement.photo_url).split("/")[1];
      } catch {
        // Un borrador antiguo con URL inválida lo rechazará BatchModel; no
        // debe impedir que el usuario abra el selector de una evidencia nueva.
      }
    }
    return null;
  }

  function releaseUnusedPhotoBatchId(state = getState()) {
    if (!discardRow && !draftDiscardBatchId(state)) discardUploadBatchId = null;
  }

  function openDiscard(row, trigger) {
    resetDiscardEvidence();
    discardRow = row;
    const state = getState();
    discardUploadBatchId ??= draftDiscardBatchId(state) ?? photoBatchIdFn();
    discardUploadSequence = (state.draft.movements?.length ?? 0) + 1;
    modal.sub.textContent = `POS ${row.position_number} · ${identity(row)}`;
    modal.cause.value = "";
    renderDiscardPhoto();
    modal.overlay.classList.add("open");
    modal.overlay.setAttribute("aria-hidden", "false");
    discardFocusTrap.activate({ trigger: trigger ?? documentObject.activeElement });
  }

  function closeDiscard({ restore = true } = {}) {
    modal.overlay.classList.remove("open");
    modal.overlay.setAttribute("aria-hidden", "true");
    discardRow = null;
    resetDiscardEvidence();
    releaseUnusedPhotoBatchId();
    discardFocusTrap.deactivate({ restore });
  }

  async function removePendingDiscardPhoto() {
    const pendingUpload = discardUploadPromise;
    if (pendingUpload) {
      try {
        await pendingUpload;
      } catch {
        // startDiscardUpload conserva orphanPath cuando la limpieza automática falla.
      }
    }

    const reference = discardPhotoUrl ?? discardPhotoPath;
    if (!reference) return;
    await deletePhoto(reference);
    discardPhotoUrl = null;
    discardPhotoPath = null;
  }

  async function startDiscardUpload() {
    if (!discardRow || !discardFile || discardClosing) return;

    const row = discardRow;
    setDiscardUploadStatus(discardPhotoUrl || discardPhotoPath ? "deleting" : "uploading");
    try {
      await removePendingDiscardPhoto();
    } catch (error) {
      setDiscardUploadStatus("error", error);
      setFeedback(error?.message ?? "No se pudo reemplazar la evidencia anterior.", "error");
      return;
    }
    if (discardRow !== row || discardClosing) return;

    setDiscardUploadStatus("uploading");
    const request = Promise.resolve().then(() => uploadPhoto({
      file: discardFile,
      companyScope: row.company_id,
      batchId: discardUploadBatchId,
      seq: discardUploadSequence,
    }));
    discardUploadPromise = request;

    try {
      const photoUrl = await request;
      discardPhotoUrl = photoUrl;
      discardPhotoPath = discardPhotoPathFromUrl(photoUrl);
      setDiscardUploadStatus("success");
      setFeedback("Evidencia de descarte subida correctamente.", "success");
    } catch (error) {
      discardPhotoUrl = null;
      discardPhotoPath = error?.orphanPath ?? null;
      setDiscardUploadStatus("error", error);
      setFeedback(error?.message ?? "No se pudo subir la evidencia.", "error");
    } finally {
      if (discardUploadPromise === request) discardUploadPromise = null;
    }
  }

  function onPhotoClick(event) {
    if (!active || !discardRow) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (discardUploadStatus === "error" && discardFile) {
      void startDiscardUpload();
      return;
    }
    photoInput.click();
  }

  function onPhotoChange(event) {
    event.stopImmediatePropagation();
    const [file] = photoInput.files ?? [];
    photoInput.value = "";
    if (!active || !discardRow || !file) return;

    discardFile = file;
    revokeDiscardPreview();
    try {
      discardPreviewUrl = objectUrlApi.createObjectURL(file);
    } catch (error) {
      discardFile = null;
      setDiscardUploadStatus("error", error);
      setFeedback("El navegador no pudo mostrar la vista previa de la foto.", "error");
      return;
    }
    setDiscardUploadStatus("uploading");
    void startDiscardUpload();
  }

  function onCauseChange(event) {
    if (!active || !discardRow) return;
    event.stopImmediatePropagation();
    updateDiscardValidity();
  }

  async function cancelDiscard({ restore = true } = {}) {
    if (!discardRow || discardClosing) return;
    discardClosing = true;
    const hadPendingObject = Boolean(
      discardUploadPromise || discardPhotoUrl || discardPhotoPath,
    );
    if (hadPendingObject) setDiscardUploadStatus("deleting");
    try {
      await removePendingDiscardPhoto();
      closeDiscard({ restore });
      if (hadPendingObject) setFeedback("Evidencia pendiente eliminada.", "info");
    } catch (error) {
      discardClosing = false;
      setDiscardUploadStatus("error", error);
      setFeedback(error?.message ?? "No se pudo limpiar la evidencia pendiente.", "error");
    }
  }

  function onCancelClick(event) {
    if (!active || !discardRow) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void cancelDiscard();
  }

  function onConfirmClick(event) {
    if (!active || !discardRow) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (modal.confirm.disabled) return;

    const row = discardRow;
    const result = onDiscard(row, {
      discard_cause: modal.cause.value,
      photo_url: discardPhotoUrl,
    });
    handleResult(result, `P${row.position_number} agregada como descarte.`);
    // Desde este punto el objeto pertenece al borrador; task_13 podrá usar
    // cleanupDiscardPhoto al deshacer o editar ese movimiento.
    if (result?.ok) closeDiscard();
  }

  function beginSwap(row) {
    if (row.is_empty === true) {
      setFeedback("El origen del intercambio debe estar ocupado.", "error");
      return;
    }
    swapOrigin = Number(row.position_number);
    setFeedback(
      `Origen P${swapOrigin} listo. Elegí otra posición ocupada en el diagrama o dock.`,
      "info",
    );
    render(getState());
  }

  function cancelSwap() {
    swapOrigin = null;
    setFeedback("Intercambio cancelado.", "info");
    render(getState());
  }

  function onActionClick(event) {
    const button = event.target.closest("[data-movement-action]");
    if (!active || !button || !container.contains(button)) return;

    const state = getState();
    const row = selectedRow(state);
    if (!row || state.status !== "ready") return;

    const action = button.dataset.movementAction;
    if (action === "retention") {
      handleResult(
        onRetention(row, {}),
        `P${row.position_number} agregada para enviar a retén.`,
      );
    } else if (action === "discard") {
      openDiscard(row, button);
    } else if (action === "swap") {
      beginSwap(row);
    } else if (action === "cancel-swap") {
      cancelSwap();
    } else if (action === "mount") {
      onRequestMount({
        position: Number(row.position_number),
        row,
        inventory: state.inventory,
      });
      setFeedback("Elegí un neumático del inventario para completar el montaje.", "info");
    }
  }

  function render(state = getState()) {
    releaseUnusedPhotoBatchId(state);
    const row = selectedRow(state);
    actions.replaceChildren();

    if (state.status !== "ready" || !row) {
      title.textContent = "ELEGÍ UNA OPERACIÓN";
      copy.textContent = "Las acciones se habilitan cuando el estado de taller está listo.";
      return;
    }

    title.textContent = `POSICIÓN ${row.position_number}`;
    if (swapOrigin != null) {
      copy.textContent = `INTERCAMBIO: P${swapOrigin} ES EL ORIGEN. SELECCIONÁ OTRO NEUMÁTICO OCUPADO.`;
      actions.append(createButton(documentObject, "cancel-swap", "Cancelar intercambio"));
      return;
    }

    if (row.is_empty === true) {
      copy.textContent = "POSICIÓN VACÍA · DISPONIBLE PARA MONTAJE";
      actions.append(createButton(documentObject, "mount", "Elegir para montar"));
      return;
    }

    copy.textContent = `${identity(row)} · CICLO ACTUAL CONSERVADO EN EL BORRADOR`;
    actions.append(
      createButton(documentObject, "retention", "Enviar a retén"),
      createButton(documentObject, "discard", "Descartar", { danger: true }),
      createButton(documentObject, "swap", "Intercambiar"),
    );
  }

  function handleSelection(position) {
    if (!active || swapOrigin == null || Number(position) === swapOrigin) return null;
    const state = getState();
    const origin = positionRow(state, swapOrigin);
    const destination = positionRow(state, position);
    if (!origin || !destination || destination.is_empty === true) {
      setFeedback("El destino del intercambio debe ser otra posición ocupada.", "error");
      return { ok: false };
    }

    swapOrigin = null;
    return handleResult(
      onSwap(origin, destination, {}),
      `Intercambio P${origin.position_number} ↔ P${destination.position_number} agregado.`,
    );
  }

  function addMount(inventoryItem, {
    position = getState().selected,
    rtd_mm,
    notes,
  } = {}) {
    const state = getState();
    const row = positionRow(state, position);
    if (!row) {
      const result = { ok: false, violations: [{ message: "La posición de montaje no existe." }] };
      return handleResult(result, "");
    }
    const result = onMount(Number(position), inventoryItem, { rtd_mm, notes });
    return handleResult(
      result,
      `Montaje de ${identity(inventoryItem)} en P${position} agregado.`,
    );
  }

  container.addEventListener("click", onActionClick);
  modal.photo.addEventListener("click", onPhotoClick, true);
  photoInput.addEventListener("change", onPhotoChange, true);
  modal.cause.addEventListener("change", onCauseChange, true);
  modal.cancel.addEventListener("click", onCancelClick, true);
  modal.confirm.addEventListener("click", onConfirmClick, true);

  render();

  return {
    render,
    handleSelection,
    addMount,
    cleanupDiscardPhoto(pathOrUrl) {
      return deletePhoto(pathOrUrl);
    },
    getDiscardPhotoBatchId() {
      return discardUploadBatchId ?? draftDiscardBatchId();
    },
    cancelSwap,
    setActive(nextActive) {
      active = Boolean(nextActive);
      if (!active) {
        swapOrigin = null;
        if (discardRow) {
          discardFocusTrap.deactivate({ restore: false });
          void cancelDiscard({ restore: false });
        }
      }
      render(getState());
    },
    destroy() {
      clearTimeout(toastTimer);
      if (discardRow) {
        discardFocusTrap.deactivate({ restore: false });
        void cancelDiscard({ restore: false });
      }
      discardFocusTrap.destroy();
      container.removeEventListener("click", onActionClick);
      modal.photo.removeEventListener("click", onPhotoClick, true);
      photoInput.removeEventListener("change", onPhotoChange, true);
      modal.cause.removeEventListener("change", onCauseChange, true);
      modal.cancel.removeEventListener("click", onCancelClick, true);
      modal.confirm.removeEventListener("click", onConfirmClick, true);
      photoInput.remove();
      container.replaceChildren();
    },
  };
}
