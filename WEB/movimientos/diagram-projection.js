const EMPTY_FLAGS = Object.freeze({
  mismatch: false,
  conflict: false,
  selected: false,
  retention: false,
  discard: false,
  mount: false,
  swap: false,
});

const BASELINE_EVIDENCE_COLUMNS = Object.freeze([
  "last_inspection_tire_code",
  "last_inspected_on",
  "last_measurement_id",
  "last_brand_name",
  "last_model_name",
  "last_size_name",
  "last_condition",
  "last_retread_design",
  "last_rtd_movi_mm",
  "last_odometer_km",
]);

function toPosition(value) {
  if (value == null || value === "") return null;
  const position = Number(value);
  return Number.isInteger(position) ? position : null;
}

function rowsFrom(remoteState) {
  if (Array.isArray(remoteState)) return remoteState;
  if (Array.isArray(remoteState?.positions)) return remoteState.positions;
  return [];
}

function movementsFrom(draft) {
  if (Array.isArray(draft)) return draft;
  return Array.isArray(draft?.movements) ? draft.movements : [];
}

function markConflict(state) {
  if (state) state.flags.conflict = true;
}

function addOrigin(states, positionValue, op, expectedLifeCycleId, swapSide = null) {
  const state = states.get(toPosition(positionValue));
  if (!state) return;

  state.origins.push(op);
  if (swapSide) state.swapSides.add(swapSide);

  if (state.baseEmpty || !expectedLifeCycleId || expectedLifeCycleId !== state.lifeCycleId) {
    markConflict(state);
  }
}

function addDestination(states, positionValue, op, swapSide = null) {
  const state = states.get(toPosition(positionValue));
  if (!state) return;

  state.destinations.push(op);
  if (swapSide) state.swapSides.add(swapSide);
}

function applyMovement(states, movement, mountedCycles) {
  if (!movement || typeof movement !== "object") return;

  if (movement.op === "send_to_retention" || movement.op === "discard") {
    addOrigin(
      states,
      movement.position,
      movement.op,
      movement.expected_life_cycle_id,
    );
    return;
  }

  if (movement.op === "mount") {
    const position = toPosition(movement.position);
    const state = states.get(position);
    if (!state) return;

    addDestination(states, position, "mount");
    if (!movement.life_cycle_id) {
      markConflict(state);
      return;
    }

    const destinations = mountedCycles.get(movement.life_cycle_id) ?? [];
    destinations.push(position);
    mountedCycles.set(movement.life_cycle_id, destinations);
    return;
  }

  if (movement.op === "swap") {
    const positionA = toPosition(movement.position_a);
    const positionB = toPosition(movement.position_b);

    addOrigin(
      states,
      positionA,
      "swap",
      movement.expected_life_cycle_id_a,
      "A",
    );
    addDestination(states, positionA, "swap", "A");
    addOrigin(
      states,
      positionB,
      "swap",
      movement.expected_life_cycle_id_b,
      "B",
    );
    addDestination(states, positionB, "swap", "B");

    if (positionA == null || positionB == null || positionA === positionB) {
      markConflict(states.get(positionA));
      markConflict(states.get(positionB));
    }
  }
}

function markDuplicateMountedCycles(states, mountedCycles) {
  for (const positions of mountedCycles.values()) {
    if (positions.length < 2) continue;
    for (const position of positions) markConflict(states.get(position));
  }
}

function applyLocalInvariants(states) {
  for (const state of states.values()) {
    if (state.origins.length > 1 || state.destinations.length > 1) {
      markConflict(state);
    }

    const hasMount = state.destinations.includes("mount");
    const isFreedByDraft = state.origins.length > 0;
    if (hasMount && !state.baseEmpty && !isFreedByDraft) {
      markConflict(state);
    }
  }
}

function applyKnownPositionConflicts(states, draft) {
  const positions = draft?.conflictPositions;
  if (!positions || typeof positions[Symbol.iterator] !== "function") return;

  for (const position of positions) {
    markConflict(states.get(toPosition(position)));
  }
}

function roleFor(state) {
  if (state.swapSides.has("A")) return "swapA";
  if (state.swapSides.has("B")) return "swapB";
  if (state.destinations.length > 0) return "destination";
  if (state.origins.length > 0) return "origin";
  return "none";
}

function flagsFor(state, selectedPosition) {
  return {
    ...EMPTY_FLAGS,
    mismatch: state.mismatch,
    conflict: state.flags.conflict,
    selected: state.position === selectedPosition,
    retention: state.origins.includes("send_to_retention"),
    discard: state.origins.includes("discard"),
    mount: state.destinations.includes("mount"),
    swap: state.swapSides.size > 0,
  };
}

function pendingLabel(lastInspectionTireCode) {
  return lastInspectionTireCode
    ? `PENDIENTE DE LÍNEA BASE · ${lastInspectionTireCode}`
    : "PENDIENTE DE LÍNEA BASE";
}

function labelFor(occupancy, role, flags, state) {
  if (flags.conflict) return "CONFLICTO";
  if (role === "swapA") return "SWAP A";
  if (role === "swapB") return "SWAP B";
  if (flags.mount) return "MONTAR";
  if (flags.discard) return "DESCARTE";
  if (flags.retention) return "A RETÉN";
  if (flags.mismatch) return "REVISAR IDENTIDAD";
  if (occupancy === "baseline_pending") {
    return pendingLabel(state.evidence.last_inspection_tire_code);
  }
  if (occupancy === "occupied" && state.installationOrigin === "baseline") {
    return "LÍNEA BASE";
  }
  return occupancy === "empty" ? "VACÍA" : "OCUPADA";
}

function evidenceFrom(row) {
  return Object.fromEntries(
    BASELINE_EVIDENCE_COLUMNS.map((column) => [column, row?.[column] ?? null]),
  );
}

/**
 * Combina el snapshot de v_unit_position_state con el borrador editable.
 *
 * `draft.conflictPositions` puede contener posiciones señaladas por una
 * validación o error de RPC. Las posiciones que no existen en el snapshot se
 * ignoran: la proyección nunca crea configuración de vehículo en el cliente.
 *
 * @param {Array<object>|{positions: Array<object>}} remoteState
 * @param {{movements?: Array<object>, conflictPositions?: Iterable<number>}|Array<object>} draft
 * @param {number|null} selected
 * @returns {Map<number, {occupancy: "occupied"|"baseline_pending"|"empty", role: "none"|"origin"|"destination"|"swapA"|"swapB", flags: object, label: string}>}
 */
export function project(remoteState, draft = { movements: [] }, selected = null) {
  const states = new Map();
  const sortedRows = [...rowsFrom(remoteState)].sort(
    (left, right) => toPosition(left?.position_number) - toPosition(right?.position_number),
  );

  for (const row of sortedRows) {
    const position = toPosition(row?.position_number);
    if (position == null) continue;

    if (states.has(position)) {
      markConflict(states.get(position));
      continue;
    }

    const baseEmpty = row.is_empty === true;
    const baselinePending = row.baseline_pending === true;
    if (!baseEmpty && baselinePending) {
      globalThis.console?.warn?.(
        "v_unit_position_state contradictorio: posición ocupada con baseline_pending=true",
        { position },
      );
    }

    states.set(position, {
      position,
      baseEmpty,
      baselinePending,
      installationOrigin: row.installation_origin ?? null,
      evidence: evidenceFrom(row),
      lifeCycleId: row.life_cycle_id ?? null,
      mismatch: row.code_mismatch === true,
      origins: [],
      destinations: [],
      swapSides: new Set(),
      flags: { conflict: false },
    });
  }

  const mountedCycles = new Map();
  for (const movement of movementsFrom(draft)) {
    applyMovement(states, movement, mountedCycles);
  }

  markDuplicateMountedCycles(states, mountedCycles);
  applyLocalInvariants(states);
  applyKnownPositionConflicts(states, draft);

  const selectedPosition = toPosition(selected);
  const projection = new Map();
  for (const [position, state] of states) {
    const hasOrigin = state.origins.length > 0;
    const hasDestination = state.destinations.length > 0;
    const remoteOccupancy = state.baseEmpty
      ? state.baselinePending
        ? "baseline_pending"
        : "empty"
      : "occupied";
    const occupancy = hasDestination
      ? "occupied"
      : hasOrigin
        ? "empty"
        : remoteOccupancy;
    const role = roleFor(state);
    const flags = flagsFor(state, selectedPosition);

    projection.set(position, {
      occupancy,
      role,
      flags,
      label: labelFor(occupancy, role, flags, state),
      ...(state.installationOrigin != null
        ? { installation_origin: state.installationOrigin }
        : {}),
      ...(state.baselinePending ? state.evidence : {}),
    });
  }

  return projection;
}
