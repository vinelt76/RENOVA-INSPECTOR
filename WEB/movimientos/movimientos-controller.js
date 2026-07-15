import {
  loadAvailableInventory,
  loadUnitPositionState,
  resolveUnitId,
} from "./data.js";
import { createBatchModel } from "./batch-model.js";
import { createBaselineModel } from "./baseline-model.js";
import { createBaselineUI } from "./baseline-ui.js";
import {
  clearDraft,
  clearSealed,
  loadDraft,
  loadSealed,
  saveDraft,
  saveSealed,
} from "./batch-store.js";
import { project } from "./diagram-projection.js";
import { createDiagramView } from "./diagram-view.js";
import { createInventoryUI } from "./inventory-ui.js";
import { createMovementsUI } from "./movements-ui.js";
import {
  applyPendingBatch,
  applyPendingBaselineBatch,
  classifyBatchError,
  isRetryableNetworkError,
} from "./rpc.js";
import {
  createSummaryConfirmUI,
  defaultSummaryHeader,
} from "./summary-confirm.js";
import {
  createModeToggle,
  MOVIMIENTOS_MODES,
} from "./mode-toggle.js";

export const movimientosState = {
  mode: MOVIMIENTOS_MODES.INSPECTION,
  status: "idle",
  unitId: null,
  remoteState: [],
  inventory: [],
  draft: { movements: [], header: defaultSummaryHeader() },
  selected: null,
  projection: new Map(),
  error: null,
};

const subscribers = new Set();
let diagramView = null;
let modeToggle = null;
let loadPromise = null;
let hasLoaded = false;

// task_10: modelo y UI de movimientos, aislados del estado histórico de Inspección.
let task10BatchModel = null;
let task10MovementsUi = null;

// task_11: cajón derivado siempre del inventario vivo y del borrador actual.
let task11InventoryUi = null;

// task_13: cierre transaccional, persistencia y Realtime del editor.
const TASK13_REALTIME_TABLES = Object.freeze([
  "tire_installations",
  "tire_removals",
  "tire_life_cycles",
  "tire_casings",
]);
let task13SummaryUi = null;
let task13Scope = null;
let task13Client = null;
let task13PendingSealed = null;
let task13Confirming = false;
let task13RealtimeUnsubscribe = null;
let task13RealtimeScopeKey = null;
const task13UsedBatchIds = new Set();

// task_08: primer montaje confirmado desde evidencia de inspección.
let task08BaselineModel = null;
let task08BaselineUi = null;
let task08ScopeKey = null;
let task08PendingSealed = null;
let task08Confirming = false;
let task08RetryMode = "rpc";

const elements = {
  stage: document.getElementById("stage"),
  dock: document.getElementById("movimientos-pos-dock"),
  details: document.getElementById("movimientos-details"),
  selectedPosition: document.getElementById("movimientos-selected-position"),
  selectedIdentity: document.getElementById("movimientos-selected-identity"),
  selectedState: document.getElementById("movimientos-selected-state"),
  workspace: document.getElementById("movimientos-workspace"),
  baselineOpen: document.getElementById("movimientos-baseline-open"),
};

function emitState() {
  for (const listener of subscribers) listener(movimientosState);
}

function selectedRemoteRow() {
  return movimientosState.remoteState.find(
    (row) => Number(row.position_number) === movimientosState.selected,
  ) ?? null;
}

function renderSidebar() {
  const selectedRow = selectedRemoteRow();
  const visualState = movimientosState.projection.get(movimientosState.selected);
  const hasSelection = Boolean(selectedRow && visualState);
  elements.details.hidden = !hasSelection;
  if (hasSelection) {
    elements.selectedPosition.textContent = `POSICIÓN ${movimientosState.selected}`;
    elements.selectedIdentity.textContent = visualState.occupancy === "empty"
      ? "VACÍA · DISPONIBLE PARA MONTAJE"
      : selectedRow.casing_code || visualState.last_inspection_tire_code || "CÓDIGO NO VISIBLE";
    elements.selectedState.textContent = visualState.label;
  }
  elements.baselineOpen.hidden = !(hasSelection && task08PendingPosition());
}

function render() {
  movimientosState.projection = project(
    movimientosState.remoteState,
    movimientosState.draft,
    movimientosState.selected,
  );
  for (const wheel of elements.stage.querySelectorAll(".wheel.tc-baseline_pending")) {
    wheel.classList.remove("tc-baseline_pending");
  }
  diagramView?.render(movimientosState.projection, movimientosState.remoteState);
  renderSidebar();
  task10MovementsUi?.render(movimientosState);
  renderTask08Gate();
  task11InventoryUi?.render(movimientosState);
  task13SummaryUi?.render(movimientosState);
  task08BaselineUi?.render();
  emitState();
}

function task08PendingPosition(position = movimientosState.selected) {
  const row = movimientosState.remoteState.find(
    (candidate) => Number(candidate.position_number) === Number(position),
  );
  return row?.is_empty === true && row?.baseline_pending === true;
}

function renderTask08Gate() {
  if (!task08PendingPosition()) return;
  const button = elements.details.querySelector('[data-movement-action="mount"]');
  const copy = elements.details.querySelector('.tc-status[data-task="task-10-movements"]');
  if (button) {
    button.textContent = "Registrar primer montaje";
    button.classList.add("tc-baseline-open");
  }
  if (copy) {
    copy.textContent = "PENDIENTE DE LÍNEA BASE · CONFIRMÁ LOS DATOS DE LA INSPECCIÓN";
  }
}

// task_10: toda alta pasa por BatchModel; la UI nunca reconstruye invariantes.
function resetTask10BatchModel() {
  if (!movimientosState.unitId || !movimientosState.remoteState.length) {
    task10BatchModel = null;
    return;
  }
  task10BatchModel = createBatchModel({
    unitId: movimientosState.unitId,
    remoteState: movimientosState.remoteState,
    movements: movimientosState.draft.movements ?? [],
  });
  movimientosState.draft = {
    ...task10BatchModel.state,
    header: movimientosState.draft.header ?? defaultSummaryHeader(),
  };
}

function requireTask10BatchModel() {
  if (!task10BatchModel) resetTask10BatchModel();
  if (!task10BatchModel) {
    return {
      ok: false,
      violations: [{ message: "El estado de taller todavía no está listo." }],
    };
  }
  return null;
}

function commitTask10Result(result) {
  if (result?.ok) {
    task13CommitModelState();
    render();
  }
  return result;
}

function addTask10Retention(row, details) {
  const blocked = requireTask10BatchModel();
  if (blocked) return blocked;
  task13PrepareEditing();
  return commitTask10Result(task10BatchModel.addSendToRetention(row, details));
}

function addTask10Discard(row, details) {
  const blocked = requireTask10BatchModel();
  if (blocked) return blocked;
  task13PrepareEditing();
  return commitTask10Result(task10BatchModel.addDiscard(row, details));
}

function addTask10Swap(rowA, rowB, details) {
  const blocked = requireTask10BatchModel();
  if (blocked) return blocked;
  task13PrepareEditing();
  return commitTask10Result(task10BatchModel.addSwap(rowA, rowB, details));
}

function addTask10Mount(position, inventoryItem, details) {
  if (task08PendingPosition(position)) {
    void task08OpenPosition(position, document.activeElement);
    return task13Failure(
      "Esta posición requiere registrar el primer montaje antes de usar el lote normal.",
    );
  }
  const blocked = requireTask10BatchModel();
  if (blocked) return blocked;
  task13PrepareEditing();
  return commitTask10Result(
    task10BatchModel.addMount(position, inventoryItem, details),
  );
}

function requestTask10Mount(detail) {
  if (task08PendingPosition(detail?.position)) {
    void task08OpenPosition(detail.position, document.activeElement);
    return;
  }
  elements.workspace.dispatchEvent(new CustomEvent(
    "renova:movimientos:request-mount",
    { bubbles: true, detail },
  ));
}

// task_11: el evento de task_10 abre el cajón sin acoplar ambos módulos DOM.
function onTask11MountRequest(event) {
  if (task08PendingPosition(event.detail.position)) {
    void task08OpenPosition(event.detail.position, document.activeElement);
    return;
  }
  task11InventoryUi?.open(event.detail.position, document.activeElement);
}

function selectTask11InventoryItem(item, position) {
  if (task08PendingPosition(position)) {
    void task08OpenPosition(position, document.activeElement);
    return task13Failure(
      "Esta posición requiere registrar el primer montaje con la evidencia precargada.",
    );
  }
  return task10MovementsUi.addMount(item, { position });
}

// task_13: el borrador y el sellado viven separados; solo el segundo puede
// llegar al RPC y nunca se modifica durante un retry.
function task13ScopeKey(scope) {
  if (!scope) return null;
  return [scope.userId, scope.companyId ?? "-", scope.unitId].join(":");
}

function task08StorageKey(kind, scopeKey = task08ScopeKey) {
  return scopeKey ? `renova:movimientos:baseline-${kind}:${encodeURIComponent(scopeKey)}` : null;
}

function task08ReadStored(kind) {
  const key = task08StorageKey(kind);
  if (!key) return null;
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(key) ?? "null");
    return value?.unit_id === task13Scope?.unitId ? value : null;
  } catch {
    return null;
  }
}

function task08WriteStored(kind, value) {
  const key = task08StorageKey(kind);
  if (!key) return;
  try {
    if (value == null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // El editor activo continúa aunque el navegador bloquee localStorage.
  }
}

function task08RestoreScope() {
  const nextKey = task13ScopeKey(task13Scope);
  if (nextKey === task08ScopeKey && task08BaselineModel) return;
  task08ScopeKey = nextKey;
  if (!nextKey || !task13Scope) {
    task08BaselineModel = null;
    task08PendingSealed = null;
    return;
  }
  const draft = task08ReadStored("draft");
  task08PendingSealed = task08ReadStored("sealed");
  task08BaselineModel = createBaselineModel({
    unitId: task13Scope.unitId,
    draft,
  });
  if (task08PendingSealed?.batch_id) task08RetryMode = "rpc";
}

function task08RequireModel() {
  if (!task08BaselineModel && task13Scope) {
    task08BaselineModel = createBaselineModel({ unitId: task13Scope.unitId });
  }
  return task08BaselineModel;
}

function task08PersistDraft() {
  const model = task08RequireModel();
  if (!model?.mounts.length) task08WriteStored("draft", null);
  else task08WriteStored("draft", model.toDraft());
}

function task08ClearSealed() {
  task08PendingSealed = null;
  task08WriteStored("sealed", null);
}

function task08PrepareEditing() {
  task08ClearSealed();
  task08RequireModel()?.editAfterSeal();
  task08RetryMode = "rpc";
  task08BaselineUi?.setFeedback();
}

function task08ResetDraft() {
  task08WriteStored("draft", null);
  task08ClearSealed();
  task08BaselineModel = task13Scope
    ? createBaselineModel({ unitId: task13Scope.unitId })
    : null;
}

function task08HeaderChange(changes) {
  task08PrepareEditing();
  task08RequireModel().updateHeader(changes);
  task08PersistDraft();
  return { ok: true };
}

function task08MountChange(position, changes) {
  task08PrepareEditing();
  const result = task08RequireModel().updateMount(position, changes);
  if (result.ok) task08PersistDraft();
  return result;
}

function task08Remove(position) {
  task08PrepareEditing();
  const removed = task08RequireModel().remove(position);
  task08PersistDraft();
  return removed;
}

function task08OpenPosition(position, trigger = document.activeElement) {
  const normalized = Number(position);
  const evidence = movimientosState.projection.get(normalized);
  if (!task08PendingPosition(normalized) || !evidence || !task13Scope) return false;
  const model = task08RequireModel();
  model.addFromProjection(normalized, evidence);
  task08PersistDraft();
  task08BaselineUi?.setFeedback();
  task08BaselineUi?.render();
  return task08BaselineUi?.open({ trigger }) ?? false;
}

function task08ErrorMessage(error) {
  const classification = classifyBatchError(error);
  if (classification === "duplicate_code") return error?.message || "El código ya está en uso.";
  if (classification === "occupied_position") {
    return "Otra operación ya ocupó la posición. Recargamos el estado para que la revises.";
  }
  if (classification === "invalid_evidence") {
    return "La evidencia precargada no corresponde a la unidad o posición. El error fue registrado.";
  }
  if (classification === "forbidden") {
    return "Tu sesión no tiene permiso para confirmar primeros montajes.";
  }
  if (classification === "invalid_batch") {
    return error?.message || "El primer montaje no es válido. Revisá los campos.";
  }
  if (isRetryableNetworkError(error)) {
    return "La red sigue sin responder. El payload sellado quedó guardado para reintentar.";
  }
  return error?.message || "No se pudo confirmar el primer montaje.";
}

async function task08ApplyPending() {
  if (task08Confirming || !task08PendingSealed || !task13Client?.supabase) return null;
  task08Confirming = true;
  task08RetryMode = "rpc";
  task08BaselineUi?.setBusy(true);
  task08BaselineUi?.setFeedback();
  let rpcApplied = false;

  try {
    const result = await applyPendingBaselineBatch(task08PendingSealed, {
      client: task13Client.supabase,
      onClearSealed: async () => task08ClearSealed(),
      onDiscardDraft: async () => task08ResetDraft(),
      onReload: async ({ reason }) => {
        rpcApplied = reason === "success";
        if (rpcApplied) task08ResetDraft();
        task08BaselineUi?.showRealtimeBanner(false);
        const state = await loadMovimientosData({ force: true });
        if (state.status === "error") {
          throw state.error ?? new Error("No se pudo recargar el estado de taller.");
        }
      },
    });
    task08BaselineUi?.setFeedback(
      "Primer montaje confirmado. El estado de taller quedó actualizado.",
      "success",
    );
    return result;
  } catch (error) {
    if (rpcApplied) {
      task08RetryMode = "reload";
      task08BaselineUi?.setFeedback(
        "El primer montaje ya quedó confirmado, pero falló la recarga. Reintentá solo la lectura.",
        "warning",
        { canRetry: true },
      );
      return null;
    }

    const classification = classifyBatchError(error);
    if (!isRetryableNetworkError(error)) task08RequireModel()?.editAfterSeal();
    if (classification === "occupied_position") {
      task08ResetDraft();
      await loadMovimientosData({ force: true });
    }
    task08BaselineUi?.setFeedback(task08ErrorMessage(error), "error", {
      canRetry: isRetryableNetworkError(error),
      canSearch: classification === "duplicate_code",
    });
    return null;
  } finally {
    task08Confirming = false;
    task08BaselineUi?.setBusy(false);
  }
}

async function task08Confirm() {
  const model = task08RequireModel();
  if (!model || !task13Scope) return null;
  if (!task08PendingSealed) {
    try {
      task08PendingSealed = model.seal();
      task08WriteStored("sealed", task08PendingSealed);
    } catch (error) {
      const message = error?.violations?.map(({ message: item }) => item).join(" ") ||
        error?.message || "No se pudo sellar el primer montaje.";
      task08BaselineUi?.setFeedback(message, "error");
      return null;
    }
  }
  return task08ApplyPending();
}

async function task08Retry() {
  if (task08RetryMode === "reload") {
    try {
      const state = await loadMovimientosData({ force: true });
      if (state.status === "error") {
        throw state.error ?? new Error("No se pudo recargar el estado de taller.");
      }
      task08BaselineUi?.setFeedback("Estado de taller actualizado.", "success");
    } catch (error) {
      task08BaselineUi?.setFeedback(error?.message || "La recarga volvió a fallar.", "error", {
        canRetry: true,
      });
    }
    return;
  }
  await task08ApplyPending();
}

function task08SearchInventory() {
  const model = task08RequireModel();
  const mount = model?.mounts.find((item) => item.casing_code);
  if (!mount) {
    task08BaselineUi?.setFeedback("No hay un código pendiente para buscar.", "warning");
    return false;
  }
  const code = String(mount.casing_code).trim().toLocaleLowerCase();
  const item = movimientosState.inventory.find(
    (candidate) => String(candidate.casing_code ?? "").trim().toLocaleLowerCase() === code,
  );
  if (!item?.life_cycle_id) {
    task08BaselineUi?.setFeedback(
      `El código ${mount.casing_code} no aparece disponible en el inventario cargado.`,
      "warning",
    );
    return false;
  }
  task08PrepareEditing();
  model.updateMount(mount.position, { life_cycle_id: item.life_cycle_id });
  task08PersistDraft();
  task08BaselineUi?.render();
  task08BaselineUi?.setFeedback(
    `${mount.casing_code} se montará con su ciclo disponible del inventario.`,
    "success",
  );
  return true;
}

function task13CreateScope(session, unitId, remoteState) {
  const userId = String(session?.user?.id ?? "").trim();
  if (!userId || !unitId) return null;
  return {
    userId,
    companyId: remoteState[0]?.company_id ?? null,
    unitId,
  };
}

function task13EditableDraft(movements = [], header = defaultSummaryHeader()) {
  return {
    movements: movements.map(({ seq: _seq, ...movement }) => movement),
    sealed: null,
    header: {
      performedAt: header?.performedAt ?? header?.performed_at ?? defaultSummaryHeader().performedAt,
      odometer: header?.odometer == null ? "" : String(header.odometer),
      notes: header?.notes ?? "",
    },
  };
}

function task13RestoreScope(session, unitId, remoteState) {
  const nextScope = task13CreateScope(session, unitId, remoteState);
  const nextKey = task13ScopeKey(nextScope);
  const changed = nextKey !== task13ScopeKey(task13Scope);
  task13Scope = nextScope;
  if (!changed || !nextScope) {
    movimientosState.draft.header ??= defaultSummaryHeader();
    return;
  }

  const storedDraft = loadDraft(nextScope);
  task13PendingSealed = loadSealed(nextScope);
  if (task13PendingSealed?.batch_id) {
    task13UsedBatchIds.add(task13PendingSealed.batch_id);
  }

  const movements = storedDraft?.movements ?? task13PendingSealed?.movements ?? [];
  const header = storedDraft?.header ?? task13PendingSealed ?? defaultSummaryHeader();
  movimientosState.draft = task13EditableDraft(movements, header);
}

function task13PersistDraft() {
  if (!task13Scope) return;
  const movements = movimientosState.draft.movements ?? [];
  if (!movements.length) {
    clearDraft(task13Scope);
    return;
  }
  saveDraft(task13Scope, {
    unit_id: task13Scope.unitId,
    movements,
    sealed: null,
    header: movimientosState.draft.header ?? defaultSummaryHeader(),
  });
}

function task13CommitModelState() {
  if (!task10BatchModel) return;
  const header = movimientosState.draft.header ?? defaultSummaryHeader();
  movimientosState.draft = { ...task10BatchModel.state, header };
  task13PersistDraft();
}

function task13PrepareEditing() {
  if (task13PendingSealed?.batch_id) {
    task13UsedBatchIds.add(task13PendingSealed.batch_id);
    clearSealed(task13PendingSealed.batch_id);
    task13PendingSealed = null;
  }
  if (task10BatchModel?.sealed) task10BatchModel.editAfterSeal();
  task13SummaryUi?.setFeedback();
}

function task13HeaderChange(header) {
  task13PrepareEditing();
  movimientosState.draft.header = { ...header };
  task13PersistDraft();
}

function task13Failure(message) {
  return { ok: false, violations: [{ message }] };
}

async function task13UndoMovement(index) {
  const blocked = requireTask10BatchModel();
  if (blocked) return blocked;
  const movement = task10BatchModel.movements[index];
  if (!movement) return task13Failure("El movimiento indicado ya no existe.");

  if (movement.op === "discard" && movement.photo_url) {
    try {
      await task10MovementsUi.cleanupDiscardPhoto(movement.photo_url);
    } catch (error) {
      const message = error?.message ?? "No se pudo eliminar la evidencia del descarte.";
      task13SummaryUi?.setFeedback(message, "error");
      return task13Failure(message);
    }
  }

  task13PrepareEditing();
  const result = task10BatchModel.removeMovement(index);
  if (result.ok) {
    task13CommitModelState();
    render();
  }
  return result;
}

async function task13EditMovement(index, changes) {
  const blocked = requireTask10BatchModel();
  if (blocked) return blocked;
  task13PrepareEditing();
  const result = task10BatchModel.editMovement(index, changes);
  if (result.ok) {
    task13CommitModelState();
    render();
  } else {
    const message = result.violations?.map((violation) => violation.message).join(" ");
    task13SummaryUi?.setFeedback(message || "No se pudo editar el movimiento.", "error");
  }
  return result;
}

function task13CreateBatchId() {
  const reservedPhotoBatchId = task10MovementsUi?.getDiscardPhotoBatchId();
  if (reservedPhotoBatchId && !task13UsedBatchIds.has(reservedPhotoBatchId)) {
    return reservedPhotoBatchId;
  }
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("El navegador no puede generar el identificador del lote.");
  }
  return globalThis.crypto.randomUUID();
}

function task13Seal(header) {
  const payload = task10BatchModel.seal({
    performedAt: header.performedAt,
    odometer: header.odometer,
    notes: header.notes,
  }, task13CreateBatchId);
  task13UsedBatchIds.add(payload.batch_id);
  task13PendingSealed = saveSealed(task13Scope, payload);
  return task13PendingSealed;
}

async function task13DiscardPhotos(movements) {
  for (const movement of movements ?? []) {
    if (movement.op !== "discard" || !movement.photo_url) continue;
    try {
      await task10MovementsUi.cleanupDiscardPhoto(movement.photo_url);
    } catch (error) {
      console.warn("Movimientos de neumáticos: no se pudo limpiar una evidencia obsoleta.", error);
    }
  }
}

function task13ResetDraft() {
  movimientosState.draft = task13EditableDraft();
  task10BatchModel = null;
  if (task13Scope) clearDraft(task13Scope);
}

function task13ErrorFeedback(error) {
  const classification = classifyBatchError(error);
  if (classification === "baseline_pending") {
    return [
      "La posición requiere registrar su primer montaje antes de montar desde inventario.",
      false,
      false,
    ];
  }
  if (classification === "invalid_batch") {
    return ["El lote no es válido. Corregí los movimientos y volvé a confirmar.", false, false];
  }
  if (classification === "unavailable_cycle") {
    return ["Un neumático elegido ya no está disponible. Revisá el inventario actualizado.", false, false];
  }
  if (classification === "occupied_position") {
    return ["Una posición de montaje ya está ocupada. Revisá el estado actualizado.", false, false];
  }
  if (classification === "forbidden") {
    return ["Tu sesión no tiene permiso para confirmar movimientos de neumáticos.", false, true];
  }
  if (isRetryableNetworkError(error)) {
    return ["No pudimos confirmar por un problema de red. El lote sellado sigue guardado.", true, false];
  }
  if (/performed_at|installed_at|fecha/i.test(error?.message ?? "")) {
    return ["La fecha no es compatible con una instalación visible. Corregila y volvé a confirmar.", false, false];
  }
  return ["No se pudo confirmar el lote. Revisá los datos antes de volver a intentar.", false, false];
}

async function task13ApplyPending() {
  if (task13Confirming || !task13PendingSealed || !task13Client?.supabase) return null;
  task13Confirming = true;
  task13SummaryUi?.setBusy(true);
  task13SummaryUi?.setFeedback();

  try {
    const result = await applyPendingBatch(task13PendingSealed, {
      client: task13Client.supabase,
      onClearSealed: async (batchId) => {
        clearSealed(batchId);
        if (task13PendingSealed?.batch_id === batchId) task13PendingSealed = null;
      },
      onDiscardDraft: async () => {
        await task13DiscardPhotos(movimientosState.draft.movements);
        task13ResetDraft();
      },
      onReload: async ({ reason }) => {
        if (reason === "success") task13ResetDraft();
        task13SummaryUi?.showRealtimeBanner(false);
        await loadMovimientosData({ force: true });
      },
    });

    if (result === null) {
      task13SummaryUi?.setFeedback(
        "El estado de la unidad cambió. Se descartó el borrador obsoleto y se recargaron los datos.",
        "warning",
      );
    } else {
      task13SummaryUi?.setFeedback("Lote confirmado y estado de taller actualizado.", "success");
    }
    return result;
  } catch (error) {
    const classification = classifyBatchError(error);
    const networkError = isRetryableNetworkError(error);
    if (!networkError) {
      task10BatchModel?.editAfterSeal();
      task13CommitModelState();
    }
    if (["unavailable_cycle", "occupied_position"].includes(classification)) {
      await loadMovimientosData({ force: true });
    }
    const [message, canRetry, lock] = task13ErrorFeedback(error);
    task13SummaryUi?.setFeedback(message, "error", { canRetry, lock });
    if (classification === "baseline_pending") {
      const position = movimientosState.draft.movements
        ?.find((movement) => movement.op === "mount" && task08PendingPosition(movement.position))
        ?.position ?? movimientosState.selected;
      if (task08PendingPosition(position)) {
        movimientosState.selected = Number(position);
        render();
        task08OpenPosition(position, document.activeElement);
      }
    }
    return null;
  } finally {
    task13Confirming = false;
    task13SummaryUi?.setBusy(false);
  }
}

async function task13Confirm(header) {
  const blocked = requireTask10BatchModel();
  if (blocked || !task13Scope) {
    task13SummaryUi?.setFeedback(
      blocked?.violations?.[0]?.message ?? "No se pudo identificar la sesión del lote.",
      "error",
    );
    return null;
  }
  if (!task13PendingSealed) {
    try {
      task13Seal(header);
    } catch (error) {
      const message = error?.violations?.map((violation) => violation.message).join(" ") ||
        error?.message || "No se pudo sellar el lote.";
      task13SummaryUi?.setFeedback(message, "error");
      return null;
    }
  }
  return task13ApplyPending();
}

function task13HasProtectedDraft() {
  return task13Confirming || Boolean(task13PendingSealed) ||
    Boolean(movimientosState.draft.movements?.length) ||
    task08Confirming || Boolean(task08PendingSealed) ||
    Boolean(task08BaselineModel?.mounts.length);
}

function task13ConfigureRealtime(client) {
  const scopeKey = task13ScopeKey(task13Scope);
  if (!scopeKey || (task13RealtimeScopeKey === scopeKey && task13Client === client)) return;
  task13RealtimeUnsubscribe?.();
  task13RealtimeScopeKey = scopeKey;
  task13Client = client;
  task13RealtimeUnsubscribe = client.onDataChange(TASK13_REALTIME_TABLES, () => {
    if (task13HasProtectedDraft()) {
      task13SummaryUi?.showRealtimeBanner(true);
      task08BaselineUi?.showRealtimeBanner(true);
      return;
    }
    void loadMovimientosData({ force: true });
  });
}

function setStatus(status, error = null) {
  movimientosState.status = status;
  movimientosState.error = error;
  render();
}

function supabaseReady() {
  return new Promise((resolve) => {
    window.onRenovaSupabaseReady(() => resolve(window.RenovaSupabase));
  });
}

async function waitForAuthenticatedSession(client) {
  if (!client?.enabled) {
    throw new Error("Supabase no está configurado para este dashboard.");
  }

  const currentSession = await client.getSession();
  if (currentSession) return currentSession;

  // Si el panel histórico todavía no abrió login (por ejemplo, entrada directa
  // a ?mode=movimientos), este módulo debe poder autenticarse por sí mismo.
  if (typeof client.requireAuth === "function") {
    return client.requireAuth();
  }

  return new Promise((resolve) => {
    let authListener = null;
    authListener = client.onAuthStateChange((_event, session) => {
      if (!session) return;
      authListener?.data?.subscription?.unsubscribe();
      resolve(session);
    });
  });
}

export async function loadMovimientosData({ force = false } = {}) {
  if (loadPromise) return loadPromise;
  if (hasLoaded && !force) return movimientosState;

  loadPromise = (async () => {
    setStatus("loading");
    try {
      const client = await supabaseReady();
      const session = await waitForAuthenticatedSession(client);

      const params = new URLSearchParams(window.location.search);
      const unitId = await resolveUnitId(
        {
          inspectionId: params.get("inspection_id"),
          plate: params.get("plate"),
        },
        client,
      );

      if (!unitId) {
        movimientosState.unitId = null;
        movimientosState.remoteState = [];
        movimientosState.inventory = [];
        movimientosState.draft = task13EditableDraft();
        movimientosState.selected = null;
        task13Scope = null;
        task13PendingSealed = null;
        task08ScopeKey = null;
        task08BaselineModel = null;
        task08PendingSealed = null;
        task13RealtimeUnsubscribe?.();
        task13RealtimeUnsubscribe = null;
        task13RealtimeScopeKey = null;
        resetTask10BatchModel();
        hasLoaded = true;
        setStatus("empty");
        return movimientosState;
      }

      const [remoteState, inventory] = await Promise.all([
        loadUnitPositionState(unitId, client),
        loadAvailableInventory(client),
      ]);

      const unitChanged = movimientosState.unitId !== unitId;
      movimientosState.unitId = unitId;
      movimientosState.remoteState = remoteState;
      movimientosState.inventory = inventory;
      if (unitChanged) movimientosState.draft = task13EditableDraft();
      task13RestoreScope(session, unitId, remoteState);
      task08RestoreScope();
      resetTask10BatchModel();
      if (!remoteState.some(
        (row) => Number(row.position_number) === movimientosState.selected,
      )) {
        movimientosState.selected = remoteState.length
          ? Number(remoteState[0].position_number)
          : null;
      }
      hasLoaded = true;
      setStatus(remoteState.length ? "ready" : "empty");
      task13ConfigureRealtime(client);
      if (task13PendingSealed) {
        task13SummaryUi?.setFeedback(
          "Hay un lote sellado pendiente. Reintentá el mismo payload o editá el borrador.",
          "warning",
          { canRetry: true },
        );
      }
      if (task08PendingSealed) {
        task08BaselineUi?.setFeedback(
          "Hay un primer montaje sellado pendiente. Reintentá el mismo payload o editá el formulario.",
          "warning",
          { canRetry: true },
        );
      }
      return movimientosState;
    } catch (error) {
      console.warn("Movimientos de neumáticos: no se pudo cargar el estado de taller.", error);
      movimientosState.remoteState = [];
      movimientosState.inventory = [];
      movimientosState.selected = null;
      hasLoaded = false;
      setStatus("error", error);
      return movimientosState;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function getMovimientosState() {
  return movimientosState;
}

export function subscribeMovimientosState(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("El suscriptor del modo Movimientos debe ser una función.");
  }
  subscribers.add(listener);
  listener(movimientosState);
  return () => subscribers.delete(listener);
}

export function selectMovimientosPosition(position) {
  const normalized = Number(position);
  if (!movimientosState.remoteState.some(
    (row) => Number(row.position_number) === normalized,
  )) return false;

  movimientosState.selected = normalized;
  render();
  task10MovementsUi?.handleSelection(normalized);
  return true;
}

export function setMovimientosDraft(nextDraft) {
  const draft = typeof nextDraft === "function"
    ? nextDraft(movimientosState.draft)
    : nextDraft;
  if (!draft || !Array.isArray(draft.movements)) {
    throw new TypeError("El borrador debe exponer un array movements.");
  }

  task13PrepareEditing();
  movimientosState.draft = {
    ...draft,
    header: draft.header ?? movimientosState.draft.header ?? defaultSummaryHeader(),
  };
  resetTask10BatchModel();
  task13PersistDraft();
  render();
  return movimientosState.draft;
}

export function reloadMovimientosData() {
  return loadMovimientosData({ force: true });
}

function onModeChange(mode) {
  movimientosState.mode = mode;
  const movementsActive = mode === MOVIMIENTOS_MODES.MOVEMENTS;
  diagramView.setActive(movementsActive);
  task10MovementsUi?.setActive(movementsActive);
  task11InventoryUi?.setActive(movementsActive);
  task13SummaryUi?.setActive(movementsActive);
  task08BaselineUi?.setActive(movementsActive);

  if (movementsActive) {
    render();
    void loadMovimientosData();
  } else {
    emitState();
  }
}

function init() {
  if (Object.values(elements).some((element) => !element)) {
    throw new Error("No se encontró la estructura HTML del modo Movimientos.");
  }

  diagramView = createDiagramView({
    dock: elements.dock,
    stage: elements.stage,
    onSelect: selectMovimientosPosition,
  });
  task10MovementsUi = createMovementsUI({
    container: elements.details,
    getState: getMovimientosState,
    onRetention: addTask10Retention,
    onDiscard: addTask10Discard,
    onSwap: addTask10Swap,
    onMount: addTask10Mount,
    onRequestMount: requestTask10Mount,
  });
  task11InventoryUi = createInventoryUI({
    container: elements.workspace,
    getState: getMovimientosState,
    onSelect: selectTask11InventoryItem,
  });
  task13SummaryUi = createSummaryConfirmUI({
    container: elements.workspace,
    getState: getMovimientosState,
    onHeaderChange: task13HeaderChange,
    onUndo: task13UndoMovement,
    onEdit: task13EditMovement,
    onConfirm: task13Confirm,
    onRetry: task13ApplyPending,
  });
  task08BaselineUi = createBaselineUI({
    getModel: () => task08BaselineModel,
    onHeaderChange: task08HeaderChange,
    onMountChange: task08MountChange,
    onRemove: task08Remove,
    onConfirm: task08Confirm,
    onRetry: task08Retry,
    onSearchInventory: task08SearchInventory,
  });
  elements.workspace.addEventListener(
    "renova:movimientos:request-mount",
    onTask11MountRequest,
  );
  elements.baselineOpen.addEventListener("click", () => {
    task08OpenPosition(movimientosState.selected, elements.baselineOpen);
  });
  modeToggle = createModeToggle({ onChange: onModeChange });
  renderSidebar();
}

export const movimientosController = {
  state: movimientosState,
  getState: getMovimientosState,
  subscribe: subscribeMovimientosState,
  selectPosition: selectMovimientosPosition,
  setDraft: setMovimientosDraft,
  reload: reloadMovimientosData,
  movements: {
    addMount(inventoryItem, options) {
      return task10MovementsUi.addMount(inventoryItem, options);
    },
    cancelSwap() {
      return task10MovementsUi.cancelSwap();
    },
  },
  inventory: {
    open(position) {
      return task11InventoryUi.open(position);
    },
    close() {
      return task11InventoryUi.close();
    },
  },
  baseline: {
    open(position = movimientosState.selected) {
      return task08OpenPosition(position, document.activeElement);
    },
    confirm: task08Confirm,
    retry: task08Retry,
  },
  setMode(mode) {
    return modeToggle.setMode(mode);
  },
};

init();
window.RenovaMovimientos = movimientosController;

export default movimientosController;
