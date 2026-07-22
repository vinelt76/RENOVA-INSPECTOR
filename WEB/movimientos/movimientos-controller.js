import {
  loadCurrentMovementProfile,
  loadMovementExecutions,
  loadSupervisorMovementOrders,
  loadUnitPositionState,
  resolveUnitId,
} from "./data.js";
import { createDiagramView } from "./diagram-view.js";
import { createModeToggle, MOVIMIENTOS_MODES } from "./mode-toggle.js";
import { createMovementOrder } from "./orders-rpc.js";
import {
  addOrderItem,
  addRotation,
  createOrderDraft,
  createOrderId,
  orderDraftKey,
  orderRpcPayload,
  removeOrderItem,
  SUPERVISOR_ORDER_ROLES,
  validateOrderDraft,
} from "./supervisor-order-model.js";
import { projectSupervisorOrder } from "./supervisor-order-projection.js";
import { createSupervisorOrdersUI } from "./supervisor-orders-ui.js";

const ALLOWED_ROLES = new Set(SUPERVISOR_ORDER_ROLES);
const REALTIME_TABLES = Object.freeze(["tire_movement_orders", "tire_movement_executions"]);

export const movimientosState = {
  mode: MOVIMIENTOS_MODES.INSPECTION,
  status: "idle",
  authorized: false,
  profile: null,
  unitId: null,
  remoteState: [],
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

function renderSidebar() {
  const row = selectedRow();
  const visual = movimientosState.projection.get(movimientosState.selected);
  const visible = movimientosState.mode === MOVIMIENTOS_MODES.MOVEMENTS && Boolean(row && visual);
  elements.details.hidden = !visible;
  elements.baselineOpen.hidden = true;
  if (!visible) return;
  elements.selectedPosition.textContent = `POSICIÓN ${movimientosState.selected}`;
  elements.selectedIdentity.textContent = row.casing_code || row.last_inspection_tire_code ||
    (row.is_empty ? "SIN NEUMÁTICO REGISTRADO" : "CÓDIGO NO VISIBLE");
  elements.selectedState.textContent = visual.label;
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

function addExit(position, reason, notes) {
  return commit(addOrderItem(
    movimientosState.draft,
    { direction: "exit", position, reason, notes },
    configuredPositions(),
  ));
}

function addEntry(position, notes) {
  return commit(addOrderItem(
    movimientosState.draft,
    { direction: "entry", position, notes },
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

function removeItem(index) {
  movimientosState.draft = removeOrderItem(movimientosState.draft, index);
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
        movimientosState.orders = [];
        movimientosState.executions = [];
        movimientosState.selected = null;
        movimientosState.status = "empty";
        loaded = true;
        render();
        return movimientosState;
      }

      const [remoteState, orderData] = await Promise.all([
        loadUnitPositionState(unitId, client),
        loadOrders(client, unitId),
      ]);
      movimientosState.unitId = unitId;
      movimientosState.remoteState = remoteState;
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
    onAddExit: addExit,
    onAddEntry: addEntry,
    onAddRotation: addOrderRotation,
    onRemoveItem: removeItem,
    onDraftHeader: updateDraftHeader,
    onEmit: emitOrder,
    onReload: () => loadMovimientosData({ force: true }),
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
  setMode: (mode) => modeToggle.setMode(mode),
};

init();
window.RenovaMovimientos = movimientosController;
export default movimientosController;
