export const TIRE_CHANGE_MODES = Object.freeze({
  INSPECTION: "inspeccion",
  CHANGES: "cambios",
});

export function modeFromSearch(search = "") {
  const params = new URLSearchParams(search);
  return params.get("mode") === TIRE_CHANGE_MODES.CHANGES
    ? TIRE_CHANGE_MODES.CHANGES
    : TIRE_CHANGE_MODES.INSPECTION;
}

function updateUrl(mode, locationObject, historyObject) {
  if (!locationObject?.href || typeof historyObject?.replaceState !== "function") return;

  const url = new URL(locationObject.href);
  if (mode === TIRE_CHANGE_MODES.CHANGES) {
    url.searchParams.set("mode", TIRE_CHANGE_MODES.CHANGES);
  } else {
    url.searchParams.delete("mode");
  }
  historyObject.replaceState(historyObject.state, "", url);
}

/**
 * Controla exclusivamente la visibilidad y URL de los dos modos. No dispara
 * recargas ni conoce las fuentes de datos de Inspección o Cambios.
 */
export function createModeToggle({
  documentObject = globalThis.document,
  locationObject = globalThis.location,
  historyObject = globalThis.history,
  onChange = () => {},
} = {}) {
  const inspectionTab = documentObject.getElementById("tab-inspeccion");
  const changesTab = documentObject.getElementById("tab-cambios");
  const inspectionPanel = documentObject.getElementById("panel");
  const changesPanel = documentObject.getElementById("modo-cambios");
  const inspectionDock = documentObject.getElementById("pos-dock");
  const changesDock = documentObject.getElementById("cambios-pos-dock");
  const stage = documentObject.getElementById("stage");

  const required = [
    inspectionTab,
    changesTab,
    inspectionPanel,
    changesPanel,
    inspectionDock,
    changesDock,
    stage,
  ];
  if (required.some((element) => !element)) {
    throw new Error("No se encontró la estructura HTML de los modos Inspección/Cambios.");
  }

  let currentMode = null;

  function applyMode(nextMode, { reflectUrl = true, notify = true } = {}) {
    const mode = nextMode === TIRE_CHANGE_MODES.CHANGES
      ? TIRE_CHANGE_MODES.CHANGES
      : TIRE_CHANGE_MODES.INSPECTION;
    const showingChanges = mode === TIRE_CHANGE_MODES.CHANGES;

    inspectionTab.setAttribute("aria-selected", String(!showingChanges));
    inspectionTab.tabIndex = showingChanges ? -1 : 0;
    changesTab.setAttribute("aria-selected", String(showingChanges));
    changesTab.tabIndex = showingChanges ? 0 : -1;

    inspectionPanel.hidden = showingChanges;
    inspectionDock.hidden = showingChanges;
    changesPanel.hidden = !showingChanges;
    changesPanel.setAttribute("aria-hidden", String(!showingChanges));
    changesDock.hidden = !showingChanges;
    stage.classList.toggle("tire-change-mode", showingChanges);
    documentObject.documentElement.dataset.renovaMode = mode;

    if (reflectUrl) updateUrl(mode, locationObject, historyObject);

    const changed = currentMode !== mode;
    currentMode = mode;
    if (notify && changed) onChange(mode);
    return mode;
  }

  function onInspectionClick() {
    applyMode(TIRE_CHANGE_MODES.INSPECTION);
  }

  function onChangesClick() {
    applyMode(TIRE_CHANGE_MODES.CHANGES);
  }

  function onTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "ArrowLeft" || event.key === "Home"
      ? TIRE_CHANGE_MODES.INSPECTION
      : TIRE_CHANGE_MODES.CHANGES;
    applyMode(nextMode);
    (nextMode === TIRE_CHANGE_MODES.CHANGES ? changesTab : inspectionTab).focus();
  }

  function onPopState() {
    applyMode(modeFromSearch(locationObject?.search), {
      reflectUrl: false,
    });
  }

  inspectionTab.addEventListener("click", onInspectionClick);
  changesTab.addEventListener("click", onChangesClick);
  inspectionTab.addEventListener("keydown", onTabKeydown);
  changesTab.addEventListener("keydown", onTabKeydown);
  globalThis.addEventListener?.("popstate", onPopState);

  applyMode(modeFromSearch(locationObject?.search), {
    reflectUrl: false,
  });

  return {
    get mode() {
      return currentMode;
    },
    setMode: applyMode,
    destroy() {
      inspectionTab.removeEventListener("click", onInspectionClick);
      changesTab.removeEventListener("click", onChangesClick);
      inspectionTab.removeEventListener("keydown", onTabKeydown);
      changesTab.removeEventListener("keydown", onTabKeydown);
      globalThis.removeEventListener?.("popstate", onPopState);
    },
  };
}
