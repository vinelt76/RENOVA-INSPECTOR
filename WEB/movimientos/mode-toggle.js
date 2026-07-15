export const MOVIMIENTOS_MODES = Object.freeze({
  INSPECTION: "inspeccion",
  MOVEMENTS: "movimientos",
});

const LEGACY_MOVEMENTS_MODE = "cambios";

export function modeFromSearch(search = "") {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  return mode === MOVIMIENTOS_MODES.MOVEMENTS || mode === LEGACY_MOVEMENTS_MODE
    ? MOVIMIENTOS_MODES.MOVEMENTS
    : MOVIMIENTOS_MODES.INSPECTION;
}

function updateUrl(mode, locationObject, historyObject) {
  if (!locationObject?.href || typeof historyObject?.replaceState !== "function") return;

  const url = new URL(locationObject.href);
  if (mode === MOVIMIENTOS_MODES.MOVEMENTS) {
    url.searchParams.set("mode", MOVIMIENTOS_MODES.MOVEMENTS);
  } else {
    url.searchParams.delete("mode");
  }
  historyObject.replaceState(historyObject.state, "", url);
}

/**
 * Controla exclusivamente la visibilidad y URL de los dos modos. No dispara
 * recargas ni conoce las fuentes de datos de Inspección o Movimientos.
 */
export function createModeToggle({
  documentObject = globalThis.document,
  locationObject = globalThis.location,
  historyObject = globalThis.history,
  onChange = () => {},
} = {}) {
  const inspectionTab = documentObject.getElementById("tab-inspeccion");
  const movementsTab = documentObject.getElementById("tab-movimientos");
  const inspectionPanel = documentObject.getElementById("panel");
  const movementsPanel = documentObject.getElementById("modo-movimientos");
  const inspectionDock = documentObject.getElementById("pos-dock");
  const movementsDock = documentObject.getElementById("movimientos-pos-dock");
  const stage = documentObject.getElementById("stage");

  const required = [
    inspectionTab,
    movementsTab,
    inspectionPanel,
    movementsPanel,
    inspectionDock,
    movementsDock,
    stage,
  ];
  if (required.some((element) => !element)) {
    throw new Error("No se encontró la estructura HTML de los modos Inspección/Movimientos.");
  }

  let currentMode = null;

  function applyMode(nextMode, { reflectUrl = true, notify = true } = {}) {
    const mode = nextMode === MOVIMIENTOS_MODES.MOVEMENTS
      ? MOVIMIENTOS_MODES.MOVEMENTS
      : MOVIMIENTOS_MODES.INSPECTION;
    const showingMovements = mode === MOVIMIENTOS_MODES.MOVEMENTS;

    inspectionTab.setAttribute("aria-selected", String(!showingMovements));
    inspectionTab.tabIndex = showingMovements ? -1 : 0;
    movementsTab.setAttribute("aria-selected", String(showingMovements));
    movementsTab.tabIndex = showingMovements ? 0 : -1;

    inspectionPanel.hidden = showingMovements;
    inspectionDock.hidden = showingMovements;
    movementsPanel.hidden = !showingMovements;
    movementsPanel.setAttribute("aria-hidden", String(!showingMovements));
    movementsDock.hidden = !showingMovements;
    stage.classList.toggle("movimientos-mode", showingMovements);
    documentObject.documentElement.dataset.renovaMode = mode;

    if (reflectUrl) updateUrl(mode, locationObject, historyObject);

    const changed = currentMode !== mode;
    currentMode = mode;
    if (notify && changed) onChange(mode);
    return mode;
  }

  function onInspectionClick() {
    applyMode(MOVIMIENTOS_MODES.INSPECTION);
  }

  function onMovementsClick() {
    applyMode(MOVIMIENTOS_MODES.MOVEMENTS);
  }

  function onTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "ArrowLeft" || event.key === "Home"
      ? MOVIMIENTOS_MODES.INSPECTION
      : MOVIMIENTOS_MODES.MOVEMENTS;
    applyMode(nextMode);
    (nextMode === MOVIMIENTOS_MODES.MOVEMENTS ? movementsTab : inspectionTab).focus();
  }

  function onPopState() {
    applyMode(modeFromSearch(locationObject?.search), {
      reflectUrl: false,
    });
  }

  inspectionTab.addEventListener("click", onInspectionClick);
  movementsTab.addEventListener("click", onMovementsClick);
  inspectionTab.addEventListener("keydown", onTabKeydown);
  movementsTab.addEventListener("keydown", onTabKeydown);
  globalThis.addEventListener?.("popstate", onPopState);

  const initialSearch = locationObject?.search ?? "";
  applyMode(modeFromSearch(initialSearch), {
    reflectUrl: new URLSearchParams(initialSearch).get("mode") === LEGACY_MOVEMENTS_MODE,
  });

  return {
    get mode() {
      return currentMode;
    },
    setMode: applyMode,
    destroy() {
      inspectionTab.removeEventListener("click", onInspectionClick);
      movementsTab.removeEventListener("click", onMovementsClick);
      inspectionTab.removeEventListener("keydown", onTabKeydown);
      movementsTab.removeEventListener("keydown", onTabKeydown);
      globalThis.removeEventListener?.("popstate", onPopState);
    },
  };
}
