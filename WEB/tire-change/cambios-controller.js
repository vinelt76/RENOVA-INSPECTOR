import {
  loadAvailableInventory,
  loadUnitPositionState,
  resolveUnitId,
} from "./data.js";
import { createBatchModel } from "./batch-model.js";
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
  classifyBatchError,
  isRetryableNetworkError,
} from "./rpc.js";
import {
  createSummaryConfirmUI,
  defaultSummaryHeader,
} from "./summary-confirm.js";
import {
  createModeToggle,
  TIRE_CHANGE_MODES,
} from "./mode-toggle.js";

export const tireChangeState = {
  mode: TIRE_CHANGE_MODES.INSPECTION,
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

const elements = {
  stage: document.getElementById("stage"),
  dock: document.getElementById("cambios-pos-dock"),
  status: document.getElementById("cambios-status"),
  retry: document.getElementById("cambios-retry"),
  details: document.getElementById("cambios-details"),
  selectedPosition: document.getElementById("cambios-selected-position"),
  selectedIdentity: document.getElementById("cambios-selected-identity"),
  selectedState: document.getElementById("cambios-selected-state"),
  positionCount: document.getElementById("cambios-position-count"),
  inventoryCount: document.getElementById("cambios-inventory-count"),
  draftCount: document.getElementById("cambios-draft-count"),
  workspace: document.getElementById("cambios-workspace"),
};

function emitState() {
  for (const listener of subscribers) listener(tireChangeState);
}

function selectedRemoteRow() {
  return tireChangeState.remoteState.find(
    (row) => Number(row.position_number) === tireChangeState.selected,
  ) ?? null;
}

function statusMessage() {
  if (tireChangeState.status === "loading") {
    return "Cargando estado actual de taller…";
  }
  if (tireChangeState.status === "empty") {
    return "No hay posiciones visibles para esta unidad o tu sesión no tiene acceso.";
  }
  if (tireChangeState.status === "error") {
    return "No pudimos cargar el estado de taller. La inspección permanece disponible.";
  }
  if (tireChangeState.status === "ready") {
    return "Estado de taller cargado. Seleccioná una posición para preparar el lote.";
  }
  return "Entrá a Cambios para cargar el estado actual de la unidad.";
}

function renderSidebar() {
  elements.status.textContent = statusMessage();
  elements.status.dataset.status = tireChangeState.status;
  elements.status.classList.toggle("is-loading", tireChangeState.status === "loading");
  elements.retry.hidden = tireChangeState.status !== "error";

  const selectedRow = selectedRemoteRow();
  const visualState = tireChangeState.projection.get(tireChangeState.selected);
  const hasSelection = Boolean(selectedRow && visualState);
  elements.details.hidden = !hasSelection;
  if (hasSelection) {
    elements.selectedPosition.textContent = `POSICIÓN ${tireChangeState.selected}`;
    elements.selectedIdentity.textContent = visualState.occupancy === "empty"
      ? "VACÍA · DISPONIBLE PARA MONTAJE"
      : selectedRow.casing_code || "CÓDIGO NO VISIBLE";
    elements.selectedState.textContent = visualState.label;
  }

  elements.positionCount.textContent = String(tireChangeState.remoteState.length);
  elements.inventoryCount.textContent = String(tireChangeState.inventory.length);
  elements.draftCount.textContent = String(tireChangeState.draft.movements?.length ?? 0);
}

function render() {
  tireChangeState.projection = project(
    tireChangeState.remoteState,
    tireChangeState.draft,
    tireChangeState.selected,
  );
  diagramView?.render(tireChangeState.projection, tireChangeState.remoteState);
  renderSidebar();
  task10MovementsUi?.render(tireChangeState);
  task11InventoryUi?.render(tireChangeState);
  task13SummaryUi?.render(tireChangeState);
  emitState();
}

// task_10: toda alta pasa por BatchModel; la UI nunca reconstruye invariantes.
function resetTask10BatchModel() {
  if (!tireChangeState.unitId || !tireChangeState.remoteState.length) {
    task10BatchModel = null;
    return;
  }
  task10BatchModel = createBatchModel({
    unitId: tireChangeState.unitId,
    remoteState: tireChangeState.remoteState,
    movements: tireChangeState.draft.movements ?? [],
  });
  tireChangeState.draft = {
    ...task10BatchModel.state,
    header: tireChangeState.draft.header ?? defaultSummaryHeader(),
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
  const blocked = requireTask10BatchModel();
  if (blocked) return blocked;
  task13PrepareEditing();
  return commitTask10Result(
    task10BatchModel.addMount(position, inventoryItem, details),
  );
}

function requestTask10Mount(detail) {
  elements.workspace.dispatchEvent(new CustomEvent(
    "renova:tire-change:request-mount",
    { bubbles: true, detail },
  ));
}

// task_11: el evento de task_10 abre el cajón sin acoplar ambos módulos DOM.
function onTask11MountRequest(event) {
  task11InventoryUi?.open(event.detail.position, document.activeElement);
}

function selectTask11InventoryItem(item, position) {
  return task10MovementsUi.addMount(item, { position });
}

// task_13: el borrador y el sellado viven separados; solo el segundo puede
// llegar al RPC y nunca se modifica durante un retry.
function task13ScopeKey(scope) {
  if (!scope) return null;
  return [scope.userId, scope.companyId ?? "-", scope.unitId].join(":");
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
    tireChangeState.draft.header ??= defaultSummaryHeader();
    return;
  }

  const storedDraft = loadDraft(nextScope);
  task13PendingSealed = loadSealed(nextScope);
  if (task13PendingSealed?.batch_id) {
    task13UsedBatchIds.add(task13PendingSealed.batch_id);
  }

  const movements = storedDraft?.movements ?? task13PendingSealed?.movements ?? [];
  const header = storedDraft?.header ?? task13PendingSealed ?? defaultSummaryHeader();
  tireChangeState.draft = task13EditableDraft(movements, header);
}

function task13PersistDraft() {
  if (!task13Scope) return;
  const movements = tireChangeState.draft.movements ?? [];
  if (!movements.length) {
    clearDraft(task13Scope);
    return;
  }
  saveDraft(task13Scope, {
    unit_id: task13Scope.unitId,
    movements,
    sealed: null,
    header: tireChangeState.draft.header ?? defaultSummaryHeader(),
  });
}

function task13CommitModelState() {
  if (!task10BatchModel) return;
  const header = tireChangeState.draft.header ?? defaultSummaryHeader();
  tireChangeState.draft = { ...task10BatchModel.state, header };
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
  tireChangeState.draft.header = { ...header };
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
      console.warn("Cambios de neumáticos: no se pudo limpiar una evidencia obsoleta.", error);
    }
  }
}

function task13ResetDraft() {
  tireChangeState.draft = task13EditableDraft();
  task10BatchModel = null;
  if (task13Scope) clearDraft(task13Scope);
}

function task13ErrorFeedback(error) {
  const classification = classifyBatchError(error);
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
    return ["Tu sesión no tiene permiso para confirmar cambios de neumáticos.", false, true];
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
        await task13DiscardPhotos(tireChangeState.draft.movements);
        task13ResetDraft();
      },
      onReload: async ({ reason }) => {
        if (reason === "success") task13ResetDraft();
        task13SummaryUi?.showRealtimeBanner(false);
        await loadTireChangeData({ force: true });
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
      await loadTireChangeData({ force: true });
    }
    const [message, canRetry, lock] = task13ErrorFeedback(error);
    task13SummaryUi?.setFeedback(message, "error", { canRetry, lock });
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
    Boolean(tireChangeState.draft.movements?.length);
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
      return;
    }
    void loadTireChangeData({ force: true });
  });
}

function setStatus(status, error = null) {
  tireChangeState.status = status;
  tireChangeState.error = error;
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

  // El init histórico de Inspección es el único dueño del modal de login.
  // Cambios espera esa misma sesión para no crear un segundo modal.
  return new Promise((resolve) => {
    let authListener = null;
    authListener = client.onAuthStateChange((_event, session) => {
      if (!session) return;
      authListener?.data?.subscription?.unsubscribe();
      resolve(session);
    });
  });
}

async function loadTireChangeData({ force = false } = {}) {
  if (loadPromise) return loadPromise;
  if (hasLoaded && !force) return tireChangeState;

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
        tireChangeState.unitId = null;
        tireChangeState.remoteState = [];
        tireChangeState.inventory = [];
        tireChangeState.draft = task13EditableDraft();
        tireChangeState.selected = null;
        task13Scope = null;
        task13PendingSealed = null;
        task13RealtimeUnsubscribe?.();
        task13RealtimeUnsubscribe = null;
        task13RealtimeScopeKey = null;
        resetTask10BatchModel();
        hasLoaded = true;
        setStatus("empty");
        return tireChangeState;
      }

      const [remoteState, inventory] = await Promise.all([
        loadUnitPositionState(unitId, client),
        loadAvailableInventory(client),
      ]);

      const unitChanged = tireChangeState.unitId !== unitId;
      tireChangeState.unitId = unitId;
      tireChangeState.remoteState = remoteState;
      tireChangeState.inventory = inventory;
      if (unitChanged) tireChangeState.draft = task13EditableDraft();
      task13RestoreScope(session, unitId, remoteState);
      resetTask10BatchModel();
      if (!remoteState.some(
        (row) => Number(row.position_number) === tireChangeState.selected,
      )) {
        tireChangeState.selected = remoteState.length
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
      return tireChangeState;
    } catch (error) {
      console.warn("Cambios de neumáticos: no se pudo cargar el estado de taller.", error);
      tireChangeState.remoteState = [];
      tireChangeState.inventory = [];
      tireChangeState.selected = null;
      hasLoaded = false;
      setStatus("error", error);
      return tireChangeState;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function getTireChangeState() {
  return tireChangeState;
}

export function subscribeTireChangeState(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("El suscriptor del modo Cambios debe ser una función.");
  }
  subscribers.add(listener);
  listener(tireChangeState);
  return () => subscribers.delete(listener);
}

export function selectTireChangePosition(position) {
  const normalized = Number(position);
  if (!tireChangeState.remoteState.some(
    (row) => Number(row.position_number) === normalized,
  )) return false;

  tireChangeState.selected = normalized;
  render();
  task10MovementsUi?.handleSelection(normalized);
  return true;
}

export function setTireChangeDraft(nextDraft) {
  const draft = typeof nextDraft === "function"
    ? nextDraft(tireChangeState.draft)
    : nextDraft;
  if (!draft || !Array.isArray(draft.movements)) {
    throw new TypeError("El borrador debe exponer un array movements.");
  }

  task13PrepareEditing();
  tireChangeState.draft = {
    ...draft,
    header: draft.header ?? tireChangeState.draft.header ?? defaultSummaryHeader(),
  };
  resetTask10BatchModel();
  task13PersistDraft();
  render();
  return tireChangeState.draft;
}

export function reloadTireChangeData() {
  return loadTireChangeData({ force: true });
}

function onModeChange(mode) {
  tireChangeState.mode = mode;
  const changesActive = mode === TIRE_CHANGE_MODES.CHANGES;
  diagramView.setActive(changesActive);
  task10MovementsUi?.setActive(changesActive);
  task11InventoryUi?.setActive(changesActive);
  task13SummaryUi?.setActive(changesActive);

  if (changesActive) {
    render();
    void loadTireChangeData();
  } else {
    emitState();
  }
}

function init() {
  if (Object.values(elements).some((element) => !element)) {
    throw new Error("No se encontró la estructura HTML del modo Cambios.");
  }

  diagramView = createDiagramView({
    dock: elements.dock,
    stage: elements.stage,
    onSelect: selectTireChangePosition,
  });
  task10MovementsUi = createMovementsUI({
    container: elements.workspace,
    getState: getTireChangeState,
    onRetention: addTask10Retention,
    onDiscard: addTask10Discard,
    onSwap: addTask10Swap,
    onMount: addTask10Mount,
    onRequestMount: requestTask10Mount,
  });
  task11InventoryUi = createInventoryUI({
    container: elements.workspace,
    getState: getTireChangeState,
    onSelect: selectTask11InventoryItem,
  });
  task13SummaryUi = createSummaryConfirmUI({
    container: elements.workspace,
    getState: getTireChangeState,
    onHeaderChange: task13HeaderChange,
    onUndo: task13UndoMovement,
    onEdit: task13EditMovement,
    onConfirm: task13Confirm,
    onRetry: task13ApplyPending,
  });
  elements.workspace.addEventListener(
    "renova:tire-change:request-mount",
    onTask11MountRequest,
  );
  elements.retry.addEventListener("click", reloadTireChangeData);
  modeToggle = createModeToggle({ onChange: onModeChange });
  renderSidebar();
}

export const tireChangeController = {
  state: tireChangeState,
  getState: getTireChangeState,
  subscribe: subscribeTireChangeState,
  selectPosition: selectTireChangePosition,
  setDraft: setTireChangeDraft,
  reload: reloadTireChangeData,
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
  setMode(mode) {
    return modeToggle.setMode(mode);
  },
};

init();
window.RenovaTireChange = tireChangeController;
