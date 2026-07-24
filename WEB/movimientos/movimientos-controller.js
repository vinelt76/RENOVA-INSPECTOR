import {
  loadAvailableInventory,
  loadCurrentMovementProfile,
  loadMovementExecutions,
  loadSupervisorMovementOrders,
  loadUnitPositionState,
  resolveUnitId,
} from "./data.js";
import { createBaselineModel } from "./baseline-model.js";
import { createBaselineUI } from "./baseline-ui.js";
import { createDiagramView } from "./diagram-view.js";
import { createModeToggle, MOVIMIENTOS_MODES } from "./mode-toggle.js";
import { createMovementOrder } from "./orders-rpc.js";
import {
  applyPendingBaselineBatch,
  classifyBatchError,
  isRetryableNetworkError,
} from "./rpc.js";
import {
  addRotation,
  addServiceFromInventory,
  createOrderDraft,
  createOrderId,
  orderDraftKey,
  orderRpcPayload,
  removeOrderPosition,
  SUPERVISOR_ORDER_ROLES,
  validateOrderDraft,
} from "./supervisor-order-model.js";
import { projectSupervisorOrder } from "./supervisor-order-projection.js";
import { createSupervisorOrdersUI } from "./supervisor-orders-ui.js";

const ALLOWED_ROLES = new Set(SUPERVISOR_ORDER_ROLES);
const REALTIME_TABLES = Object.freeze([
  "tire_movement_orders",
  "tire_movement_executions",
  "tire_installations",
  "tire_life_cycles",
]);

export const movimientosState = {
  mode: MOVIMIENTOS_MODES.INSPECTION,
  status: "idle",
  authorized: false,
  profile: null,
  unitId: null,
  remoteState: [],
  inventory: [],
  orders: [],
  executions: [],
  draft: createOrderDraft(),
  selected: null,
  projection: new Map(),
  error: null,
};

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

const subscribers = new Set();
let diagramView;
let modeToggle;
let ordersUI;
let loadPromise = null;
let loaded = false;
let activeScopeKey = null;
let activeClient = null;
let realtimeUnsubscribe = null;
let busy = false;
let baselineModel = null;
let baselineUI = null;
let baselineScope = null;
let baselineConfirming = false;

function emitState() {
  for (const listener of subscribers) listener(movimientosState);
}

function configuredPositions() {
  return movimientosState.remoteState.map((row) => Number(row.position_number));
}

function selectedRow() {
  return movimientosState.remoteState.find(
    (row) => Number(row.position_number) === movimientosState.selected,
  ) ?? null;
}

function isInstallationPending(position = movimientosState.selected) {
  const row = movimientosState.remoteState.find(
    (candidate) => Number(candidate.position_number) === Number(position),
  );
  return row?.is_empty === true && row?.baseline_pending === true;
}

function renderSidebar() {
  const row = selectedRow();
  const visual = movimientosState.projection.get(movimientosState.selected);
  const visible = movimientosState.mode === MOVIMIENTOS_MODES.MOVEMENTS && Boolean(row && visual);
  elements.details.hidden = !visible;
  elements.baselineOpen.hidden = !(visible && isInstallationPending());
  if (!visible) return;
  elements.selectedPosition.textContent = `POSICIÓN ${movimientosState.selected}`;
  elements.selectedIdentity.textContent = row.casing_code || row.last_inspection_tire_code ||
    (row.is_empty ? "SIN NEUMÁTICO REGISTRADO" : "CÓDIGO NO VISIBLE");
  elements.selectedState.textContent = visual.label;
}

function currentBaselineScope() {
  if (!movimientosState.profile?.id || !movimientosState.unitId) return null;
  return [
    movimientosState.profile.id,
    movimientosState.profile.company_id ?? "-",
    movimientosState.unitId,
  ].join(":");
}

function ensureBaselineModel() {
  const scope = currentBaselineScope();
  if (!scope) return null;
  if (scope !== baselineScope || !baselineModel) {
    baselineScope = scope;
    baselineModel = createBaselineModel({ unitId: movimientosState.unitId, today: "" });
  }
  return baselineModel;
}

function resetBaselineModel() {
  baselineScope = currentBaselineScope();
  baselineModel = movimientosState.unitId
    ? createBaselineModel({ unitId: movimientosState.unitId, today: "" })
    : null;
}

function installationEvidence(row) {
  return {
    last_measurement_id: row?.last_measurement_id,
    last_inspected_on: row?.last_inspected_on,
    last_inspection_tire_code: row?.last_inspection_tire_code,
    last_brand_name: row?.last_brand_name,
    last_model_name: row?.last_model_name,
    last_size_name: row?.last_size_name,
    last_condition: row?.last_condition,
    last_retread_design: row?.last_retread_design,
  };
}

function openCurrentInstallation(position, trigger = document.activeElement) {
  const normalized = Number(position);
  const row = movimientosState.remoteState.find(
    (candidate) => Number(candidate.position_number) === normalized,
  );
  if (!row || !isInstallationPending(normalized)) return false;
  movimientosState.selected = normalized;
  const model = ensureBaselineModel();
  if (!model) return false;
  model.addFromProjection(normalized, installationEvidence(row));
  render();
  baselineUI?.setFeedback();
  baselineUI?.render();
  return baselineUI?.open({ trigger }) ?? false;
}

function updateBaselineHeader(changes) {
  const model = ensureBaselineModel();
  if (!model) return { ok: false, violations: [{ message: "La unidad todavía no está disponible." }] };
  model.editAfterSeal();
  model.updateHeader(changes);
  return { ok: true };
}

function updateBaselineMount(position, changes) {
  const model = ensureBaselineModel();
  if (!model) return { ok: false, violations: [{ message: "La unidad todavía no está disponible." }] };
  model.editAfterSeal();
  return model.updateMount(position, changes);
}

function removeBaselineMount(position) {
  const model = ensureBaselineModel();
  model?.editAfterSeal();
  return model?.remove(position) ?? false;
}

function baselineErrorMessage(error) {
  const classification = classifyBatchError(error);
  if (classification === "duplicate_code") {
    return error?.message || "Ese código ya existe. Revisa si corresponde a un neumático disponible.";
  }
  if (classification === "occupied_position") {
    return "La posición ya fue ocupada por otra operación. Actualizamos el estado para revisarlo.";
  }
  if (classification === "invalid_evidence") {
    return "La inspección usada como evidencia ya no corresponde a esta posición.";
  }
  if (classification === "forbidden") {
    return "Tu sesión no tiene permiso para completar instalaciones.";
  }
  if (classification === "invalid_batch") {
    return error?.message || "Revisa los datos de instalación antes de confirmar.";
  }
  if (isRetryableNetworkError(error)) {
    return "La red no respondió. Puedes volver a confirmar con los mismos datos.";
  }
  return error?.message || "No se pudo completar la instalación en esta unidad.";
}

async function confirmCurrentInstallation() {
  if (baselineConfirming || !activeClient?.supabase) return null;
  const model = ensureBaselineModel();
  if (!model) return null;
  let sealed;
  try {
    sealed = model.seal();
  } catch (error) {
    baselineUI?.setFeedback(
      error?.violations?.map(({ message }) => message).join(" ") ||
        error?.message || "Revisa los datos de instalación.",
      "error",
    );
    return null;
  }

  baselineConfirming = true;
  baselineUI?.setBusy(true);
  baselineUI?.setFeedback();
  try {
    const result = await applyPendingBaselineBatch(sealed, {
      client: activeClient.supabase,
      onClearSealed: async () => {},
      onDiscardDraft: async () => resetBaselineModel(),
      onReload: async () => {
        resetBaselineModel();
        const state = await loadMovimientosData({ force: true });
        if (state.status === "error") throw state.error;
      },
    });
    baselineUI?.setFeedback(
      "Instalación completada. El historial conocido de esta unidad quedó actualizado.",
      "success",
    );
    return result;
  } catch (error) {
    model.editAfterSeal();
    const classification = classifyBatchError(error);
    if (classification === "occupied_position") await loadMovimientosData({ force: true });
    baselineUI?.setFeedback(baselineErrorMessage(error), "error", {
      canRetry: isRetryableNetworkError(error),
      canSearch: classification === "duplicate_code",
    });
    return null;
  } finally {
    baselineConfirming = false;
    baselineUI?.setBusy(false);
    render();
  }
}

function searchBaselineInventory() {
  const model = ensureBaselineModel();
  const mount = model?.mounts.find((item) => item.casing_code);
  if (!mount) {
    baselineUI?.setFeedback("No hay un código pendiente para buscar.", "warning");
    return false;
  }
  const code = String(mount.casing_code).trim().toLocaleUpperCase();
  const item = movimientosState.inventory.find(
    (candidate) => String(candidate.casing_code ?? "").trim().toLocaleUpperCase() === code,
  );
  if (!item?.life_cycle_id) {
    baselineUI?.setFeedback(
      `El código ${mount.casing_code} no aparece disponible en inventario.`,
      "warning",
    );
    return false;
  }
  model.editAfterSeal();
  model.updateMount(mount.position, {
    life_cycle_id: item.life_cycle_id,
    ...(item.otd_mm != null ? { otd_mm: item.otd_mm } : {}),
  });
  baselineUI?.render();
  baselineUI?.setFeedback(
    `${mount.casing_code} conservará su ciclo existente y su historial anterior.`,
    "success",
  );
  return true;
}

function consumeRequestedInstallationAction() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("action") !== "complete-installation") return;
  const position = Number(params.get("pos"));
  if (isInstallationPending(position)) {
    openCurrentInstallation(position, elements.baselineOpen);
  } else {
    ordersUI?.setFeedback(
      "Esta posición ya no tiene una instalación pendiente. Se cargó su estado actual.",
      "warning",
    );
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("action");
  history.replaceState(history.state, "", url);
}

function render() {
  movimientosState.projection = projectSupervisorOrder(
    movimientosState.remoteState,
    movimientosState.draft,
    movimientosState.selected,
  );
  diagramView?.render(movimientosState.projection, movimientosState.remoteState);
  renderSidebar();
  ordersUI?.render(movimientosState);
  emitState();
}

function storageScope(profile = movimientosState.profile, unitId = movimientosState.unitId) {
  if (!profile?.id || !profile.company_id || !unitId) return null;
  return { userId: profile.id, companyId: profile.company_id, unitId };
}

function saveDraft() {
  const scope = storageScope();
  if (!scope) return;
  try {
    localStorage.setItem(orderDraftKey(scope), JSON.stringify(movimientosState.draft));
  } catch {
    // La orden sigue editable aunque el navegador bloquee localStorage.
  }
}

function restoreDraft() {
  const scope = storageScope();
  const key = scope ? orderDraftKey(scope) : null;
  if (key === activeScopeKey) return;
  activeScopeKey = key;
  try {
    movimientosState.draft = createOrderDraft(JSON.parse(localStorage.getItem(key) ?? "null") ?? {});
  } catch {
    movimientosState.draft = createOrderDraft();
  }
}

function clearDraft() {
  if (activeScopeKey) {
    try { localStorage.removeItem(activeScopeKey); } catch { /* no-op */ }
  }
  movimientosState.draft = createOrderDraft();
}

function commit(result) {
  if (result?.ok) {
    movimientosState.draft = result.draft;
    saveDraft();
    render();
  }
  return result;
}

function addInventoryService(position, reason, inventoryItem, notes) {
  return commit(addServiceFromInventory(
    movimientosState.draft,
    { position, reason, inventoryItem, notes },
    configuredPositions(),
  ));
}

function addOrderRotation(source, target, notes) {
  return commit(addRotation(
    movimientosState.draft,
    source,
    target,
    notes,
    configuredPositions(),
  ));
}

function removePosition(position) {
  movimientosState.draft = removeOrderPosition(movimientosState.draft, position);
  saveDraft();
  render();
}

function updateDraftHeader(changes) {
  movimientosState.draft = { ...movimientosState.draft, ...changes };
  saveDraft();
}

function supabaseReady() {
  return new Promise((resolve) => window.onRenovaSupabaseReady(() => resolve(window.RenovaSupabase)));
}

async function authenticatedSession(client) {
  if (!client?.enabled) throw new Error("Supabase no está configurado para este dashboard.");
  return (await client.getSession()) ?? client.requireAuth();
}

async function loadOrders(client, unitId) {
  const orders = await loadSupervisorMovementOrders(unitId, client);
  const executions = await loadMovementExecutions(orders.map(({ id }) => id), client);
  return { orders, executions };
}

function configureRealtime(client) {
  if (activeClient === client && realtimeUnsubscribe) return;
  realtimeUnsubscribe?.();
  activeClient = client;
  realtimeUnsubscribe = client.onDataChange(REALTIME_TABLES, () => void loadMovimientosData({ force: true }));
}

function setError(error) {
  movimientosState.status = "error";
  movimientosState.error = error;
  render();
}

export async function loadMovimientosData({ force = false } = {}) {
  if (loadPromise) return loadPromise;
  if (loaded && !force) return movimientosState;

  loadPromise = (async () => {
    movimientosState.status = "loading";
    movimientosState.error = null;
    render();
    try {
      const client = await supabaseReady();
      const session = await authenticatedSession(client);
      const profile = await loadCurrentMovementProfile(session?.user?.id, client);
      movimientosState.profile = profile;
      movimientosState.authorized = Boolean(profile?.active && ALLOWED_ROLES.has(profile.role));
      if (!movimientosState.authorized) {
        throw new Error(`Tu perfil (${profile?.role ?? "sin rol"}) no puede emitir órdenes de movimientos.`);
      }

      const params = new URLSearchParams(window.location.search);
      const unitId = await resolveUnitId({
        inspectionId: params.get("inspection_id"),
        plate: params.get("plate"),
      }, client);
      if (!unitId) {
        movimientosState.unitId = null;
        movimientosState.remoteState = [];
        movimientosState.inventory = [];
        movimientosState.orders = [];
        movimientosState.executions = [];
        movimientosState.selected = null;
        movimientosState.status = "empty";
        loaded = true;
        render();
        return movimientosState;
      }

      const [remoteState, inventory, orderData] = await Promise.all([
        loadUnitPositionState(unitId, client),
        loadAvailableInventory(client),
        loadOrders(client, unitId),
      ]);
      movimientosState.unitId = unitId;
      movimientosState.remoteState = remoteState;
      movimientosState.inventory = inventory;
      movimientosState.orders = orderData.orders;
      movimientosState.executions = orderData.executions;
      restoreDraft();
      if (!remoteState.some((row) => Number(row.position_number) === movimientosState.selected)) {
        movimientosState.selected = remoteState[0] ? Number(remoteState[0].position_number) : null;
      }
      movimientosState.status = remoteState.length ? "ready" : "empty";
      loaded = true;
      configureRealtime(client);
      render();
      consumeRequestedInstallationAction();
      return movimientosState;
    } catch (error) {
      loaded = false;
      setError(error);
      return movimientosState;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

async function emitOrder() {
  if (busy || !activeClient?.supabase || !movimientosState.unitId) return null;
  const errors = validateOrderDraft(movimientosState.draft, configuredPositions());
  if (errors.length) {
    ordersUI.setFeedback(errors.join(" "), "error");
    return null;
  }
  let orderId;
  try {
    orderId = createOrderId();
  } catch (error) {
    ordersUI.setFeedback(error?.message || "No se pudo generar el identificador de la orden.", "error");
    return null;
  }

  busy = true;
  ordersUI.setBusy(true);
  ordersUI.setFeedback();
  try {
    const result = await createMovementOrder({
      orderId,
      unitId: movimientosState.unitId,
      scheduledFor: movimientosState.draft.scheduledFor,
      instructions: movimientosState.draft.instructions,
      items: orderRpcPayload(movimientosState.draft),
    }, activeClient.supabase);
    clearDraft();
    await loadMovimientosData({ force: true });
    ordersUI.setFeedback(`Orden emitida para ${result?.plate ?? "la unidad"}. Ya aparece en la app del operario.`, "success");
    return result;
  } catch (error) {
    const forbidden = error?.code === "42501";
    ordersUI.setFeedback(
      forbidden ? "Tu sesión no tiene permiso para emitir órdenes." : error?.message || "No se pudo emitir la orden.",
      "error",
    );
    return null;
  } finally {
    busy = false;
    ordersUI.setBusy(false);
    render();
  }
}

export function selectMovimientosPosition(position) {
  const normalized = Number(position);
  if (!movimientosState.remoteState.some((row) => Number(row.position_number) === normalized)) return false;
  movimientosState.selected = normalized;
  render();
  return true;
}

function onModeChange(mode) {
  movimientosState.mode = mode;
  const active = mode === MOVIMIENTOS_MODES.MOVEMENTS;
  diagramView.setActive(active);
  ordersUI.setActive(active);
  baselineUI?.setActive(active);
  if (active) {
    render();
    void loadMovimientosData();
  } else {
    renderSidebar();
    emitState();
  }
}

function init() {
  if (Object.values(elements).some((element) => !element)) throw new Error("No se encontró la estructura HTML del modo Movimientos.");
  diagramView = createDiagramView({ dock: elements.dock, stage: elements.stage, onSelect: selectMovimientosPosition });
  ordersUI = createSupervisorOrdersUI({
    details: elements.details,
    workspace: elements.workspace,
    getState: () => movimientosState,
    onAddServiceFromInventory: addInventoryService,
    onAddRotation: addOrderRotation,
    onRemovePosition: removePosition,
    onDraftHeader: updateDraftHeader,
    onEmit: emitOrder,
    onReload: () => loadMovimientosData({ force: true }),
  });
  baselineUI = createBaselineUI({
    getModel: () => baselineModel,
    onHeaderChange: updateBaselineHeader,
    onMountChange: updateBaselineMount,
    onRemove: removeBaselineMount,
    onConfirm: confirmCurrentInstallation,
    onRetry: confirmCurrentInstallation,
    onSearchInventory: searchBaselineInventory,
  });
  elements.baselineOpen.addEventListener("click", () => {
    openCurrentInstallation(movimientosState.selected, elements.baselineOpen);
  });
  modeToggle = createModeToggle({ onChange: onModeChange });
  renderSidebar();
}

export function getMovimientosState() { return movimientosState; }
export function subscribeMovimientosState(listener) {
  if (typeof listener !== "function") throw new TypeError("El suscriptor debe ser una función.");
  subscribers.add(listener);
  listener(movimientosState);
  return () => subscribers.delete(listener);
}

export const movimientosController = {
  state: movimientosState,
  getState: getMovimientosState,
  subscribe: subscribeMovimientosState,
  selectPosition: selectMovimientosPosition,
  reload: () => loadMovimientosData({ force: true }),
  emit: emitOrder,
  installation: {
    open: (position = movimientosState.selected) => openCurrentInstallation(position),
    confirm: confirmCurrentInstallation,
  },
  setMode: (mode) => modeToggle.setMode(mode),
};

init();
window.RenovaMovimientos = movimientosController;
export default movimientosController;
