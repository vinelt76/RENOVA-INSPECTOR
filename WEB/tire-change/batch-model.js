/**
 * Pure domain model for a tire-change batch.
 *
 * This module deliberately has no DOM, storage or network dependencies. The
 * position snapshot and UUID generator are injected so every transition can be
 * covered with deterministic tests.
 */

export const BATCH_STATUS = Object.freeze({
  EMPTY: "EMPTY",
  EDITING: "EDITING",
  SEALED: "SEALED",
  APPLIED: "APPLIED",
});

export const DISCARD_CAUSES = Object.freeze([
  "Servicio",
  "Neumático",
  "Conducción-Ruta",
  "Mantenimiento Alineación",
  "Proveedor",
  "Otro",
]);

const OPERATIONS = new Set([
  "send_to_retention",
  "discard",
  "mount",
  "swap",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BatchValidationError extends Error {
  constructor(violations) {
    super("El lote contiene violaciones y no puede sellarse.");
    this.name = "BatchValidationError";
    this.violations = violations;
  }
}

export class BatchModel {
  constructor({ unitId, remoteState, movements = [] } = {}) {
    this.unitId = unitId;
    this.remoteState = deepFreeze(cloneValue(remoteState ?? []));
    this._movements = cloneValue(movements);
    this._sealed = null;
    this._status = this._movements.length
      ? BATCH_STATUS.EDITING
      : BATCH_STATUS.EMPTY;
    this._appliedResult = null;
    this._usedBatchIds = new Set();
  }

  get status() {
    return this._status;
  }

  get movements() {
    return cloneValue(this._movements);
  }

  get sealed() {
    return this._sealed;
  }

  get appliedResult() {
    return cloneValue(this._appliedResult);
  }

  get state() {
    return {
      movements: this.movements,
      sealed: this._sealed,
    };
  }

  addSendToRetention(positionState, details = {}) {
    const source = { ...positionState, ...details };
    return this._append({
      op: "send_to_retention",
      position: readPosition(positionState),
      expected_life_cycle_id: positionState?.life_cycle_id,
      rtd_mm: nullable(source.rtd_mm),
      notes: nullable(source.notes),
    });
  }

  addDiscard(positionState, details = {}) {
    const source = { ...positionState, ...details };
    return this._append({
      op: "discard",
      position: readPosition(positionState),
      expected_life_cycle_id: positionState?.life_cycle_id,
      rtd_mm: nullable(source.rtd_mm),
      discard_cause: source.discard_cause,
      photo_url: source.photo_url,
      notes: nullable(source.notes),
    });
  }

  addMount(positionOrInput, inventoryItem, details = {}) {
    let position;
    let cycle;
    let source;

    if (arguments.length === 1 && isObject(positionOrInput)) {
      position = readPosition(positionOrInput);
      cycle = positionOrInput.life_cycle_id;
      source = positionOrInput;
    } else {
      position = readPosition(positionOrInput);
      cycle = inventoryItem?.life_cycle_id;
      source = { ...inventoryItem, ...details };
    }

    return this._append({
      op: "mount",
      position,
      life_cycle_id: cycle,
      rtd_mm: nullable(source?.rtd_mm),
      notes: nullable(source?.notes),
    });
  }

  addSwap(positionStateA, positionStateB, details = {}) {
    let a = positionStateA;
    let b = positionStateB;
    let source = details;

    if (arguments.length === 1 && isObject(positionStateA)) {
      source = positionStateA;
      a = {
        position: positionStateA.position_a,
        life_cycle_id: positionStateA.life_cycle_id_a,
      };
      b = {
        position: positionStateA.position_b,
        life_cycle_id: positionStateA.life_cycle_id_b,
      };
    }

    return this._append({
      op: "swap",
      position_a: readPosition(a),
      expected_life_cycle_id_a: a?.life_cycle_id,
      position_b: readPosition(b),
      expected_life_cycle_id_b: b?.life_cycle_id,
      rtd_mm_a: nullable(source?.rtd_mm_a ?? a?.rtd_mm),
      rtd_mm_b: nullable(source?.rtd_mm_b ?? b?.rtd_mm),
      notes: nullable(source?.notes),
    });
  }

  removeMovement(index) {
    const blocked = this._editingViolation();
    if (blocked) return failure([blocked]);
    if (!isValidIndex(index, this._movements)) {
      return failure([
        violation("movement_not_found", "El movimiento indicado no existe.", {
          movementIndex: index,
        }),
      ]);
    }

    const candidate = this._movements.filter((_, current) => current !== index);
    this._commit(candidate);
    return success({ removedIndex: index });
  }

  editMovement(index, changes) {
    const blocked = this._editingViolation();
    if (blocked) return failure([blocked]);
    if (!isValidIndex(index, this._movements)) {
      return failure([
        violation("movement_not_found", "El movimiento indicado no existe.", {
          movementIndex: index,
        }),
      ]);
    }
    if (!isObject(changes)) {
      return failure([
        violation("invalid_edit", "La edición del movimiento no es válida.", {
          movementIndex: index,
        }),
      ]);
    }

    const current = this._movements[index];
    const replacement = canonicalizeEdit(current, changes);
    const candidate = this._movements.map((movement, currentIndex) =>
      currentIndex === index ? replacement : movement,
    );
    const violations = validateMovements(candidate, this.remoteState);
    if (violations.length) return failure(violations);

    this._commit(candidate);
    return success({ movement: cloneValue(replacement), index });
  }

  validate(remoteState = this.remoteState) {
    return validateMovements(this._movements, remoteState);
  }

  seal({ performedAt, odometer = null, notes = null } = {}, uuidFn = defaultUuid) {
    if (this._sealed) return this._sealed;

    const violations = [
      ...validateMovements(this._movements, this.remoteState),
      ...validateHeader({ performedAt, odometer, notes }, this.unitId),
    ];
    if (violations.length) throw new BatchValidationError(violations);

    const batchId = uuidFn();
    if (typeof batchId !== "string" || !UUID_PATTERN.test(batchId)) {
      throw new BatchValidationError([
        violation("invalid_batch_id", "El generador no devolvió un UUID válido."),
      ]);
    }
    if (this._usedBatchIds.has(batchId)) {
      throw new BatchValidationError([
        violation("reused_batch_id", "Un batch_id anterior no puede reutilizarse."),
      ]);
    }

    const payload = {
      batch_version: 1,
      batch_id: batchId,
      unit_id: this.unitId,
      performed_at: performedAt,
      odometer,
      notes,
      movements: this._movements.map((movement, index) =>
        serializeMovement(movement, index + 1),
      ),
    };

    this._usedBatchIds.add(batchId);
    this._sealed = deepFreeze(payload);
    this._status = BATCH_STATUS.SEALED;
    return this._sealed;
  }

  editAfterSeal() {
    if (this._status === BATCH_STATUS.APPLIED) {
      return failure([
        violation("batch_applied", "Un lote ya aplicado no puede volver a editarse."),
      ]);
    }

    this._sealed = null;
    this._status = this._movements.length
      ? BATCH_STATUS.EDITING
      : BATCH_STATUS.EMPTY;
    return success();
  }

  markApplied(result) {
    if (!this._sealed || this._status !== BATCH_STATUS.SEALED) {
      return failure([
        violation("batch_not_sealed", "Solo un lote sellado puede marcarse como aplicado."),
      ]);
    }

    this._appliedResult = cloneValue(result);
    this._status = BATCH_STATUS.APPLIED;
    return success({ result: this.appliedResult });
  }

  _append(movement) {
    const blocked = this._editingViolation();
    if (blocked) return failure([blocked]);

    const candidate = [...this._movements, movement];
    const violations = validateMovements(candidate, this.remoteState);
    if (violations.length) return failure(violations);

    this._commit(candidate);
    return success({
      movement: cloneValue(movement),
      index: this._movements.length - 1,
    });
  }

  _commit(movements) {
    this._movements = cloneValue(movements);
    this._status = this._movements.length
      ? BATCH_STATUS.EDITING
      : BATCH_STATUS.EMPTY;
  }

  _editingViolation() {
    if (this._status === BATCH_STATUS.APPLIED) {
      return violation("batch_applied", "Un lote ya aplicado no puede editarse.");
    }
    if (this._sealed) {
      return violation(
        "batch_sealed",
        "Descartá el sellado con editAfterSeal antes de editar el lote.",
      );
    }
    return null;
  }
}

export function createBatchModel(options) {
  return new BatchModel(options);
}

function validateMovements(movements, remoteState) {
  const violations = [];
  const positions = positionMap(remoteState);
  const origins = new Map();
  const destinations = new Map();
  const mountedCycles = new Map();
  const freeingOrigins = new Set();

  if (!Array.isArray(movements) || movements.length === 0) {
    return [violation("empty_batch", "El lote debe contener al menos un movimiento.")];
  }

  movements.forEach((movement, movementIndex) => {
    if (!isObject(movement) || !OPERATIONS.has(movement.op)) {
      violations.push(
        violation("invalid_operation", "El tipo de movimiento no es válido.", {
          movementIndex,
        }),
      );
      return;
    }

    validateCommonFields(movement, movementIndex, violations);

    if (movement.op === "send_to_retention" || movement.op === "discard") {
      recordPosition(origins, movement.position, movementIndex);
      freeingOrigins.add(movement.position);
      validateSource(
        positions,
        movement.position,
        movement.expected_life_cycle_id,
        movementIndex,
        violations,
      );
      validateRtd(movement.rtd_mm, "rtd_mm", movementIndex, violations);

      if (movement.op === "discard") {
        if (!DISCARD_CAUSES.includes(movement.discard_cause)) {
          violations.push(
            violation("invalid_discard_cause", "La causa de descarte no es válida.", {
              movementIndex,
            }),
          );
        }
        if (
          typeof movement.photo_url !== "string" ||
          movement.photo_url.trim() === ""
        ) {
          violations.push(
            violation("missing_photo_url", "El descarte requiere una foto.", {
              movementIndex,
            }),
          );
        }
      }
    }

    if (movement.op === "mount") {
      recordPosition(destinations, movement.position, movementIndex);
      recordPosition(mountedCycles, movement.life_cycle_id, movementIndex);
      validatePositionNumber(movement.position, movementIndex, violations);
      validateCycleId(
        movement.life_cycle_id,
        "missing_mount_cycle",
        "El montaje requiere un life_cycle_id.",
        movementIndex,
        violations,
      );
      validateRtd(movement.rtd_mm, "rtd_mm", movementIndex, violations);
    }

    if (movement.op === "swap") {
      recordPosition(origins, movement.position_a, movementIndex);
      recordPosition(destinations, movement.position_a, movementIndex);
      recordPosition(origins, movement.position_b, movementIndex);
      recordPosition(destinations, movement.position_b, movementIndex);

      if (movement.position_a === movement.position_b) {
        violations.push(
          violation("same_swap_position", "Las posiciones A y B deben ser diferentes.", {
            movementIndex,
            position: movement.position_a,
          }),
        );
      }
      validateSource(
        positions,
        movement.position_a,
        movement.expected_life_cycle_id_a,
        movementIndex,
        violations,
        "a",
      );
      validateSource(
        positions,
        movement.position_b,
        movement.expected_life_cycle_id_b,
        movementIndex,
        violations,
        "b",
      );
      validateRtd(movement.rtd_mm_a, "rtd_mm_a", movementIndex, violations);
      validateRtd(movement.rtd_mm_b, "rtd_mm_b", movementIndex, violations);
    }
  });

  appendDuplicates(origins, "duplicate_origin", "La posición ya tiene un origen.", violations);
  appendDuplicates(
    destinations,
    "duplicate_destination",
    "La posición ya tiene un destino.",
    violations,
  );
  appendDuplicates(
    mountedCycles,
    "duplicate_mount_cycle",
    "El ciclo de inventario ya se usa en otro montaje.",
    violations,
    "lifeCycleId",
  );

  movements.forEach((movement, movementIndex) => {
    if (movement?.op !== "mount" || !Number.isInteger(movement.position)) return;
    const row = positions.get(movement.position);
    if (!row) {
      violations.push(
        violation("remote_position_missing", "La posición no existe en el estado remoto.", {
          movementIndex,
          position: movement.position,
        }),
      );
      return;
    }
    if (row.is_empty !== true && !freeingOrigins.has(movement.position)) {
      violations.push(
        violation(
          "mount_position_not_free",
          "El montaje solo puede usar una posición vacía o retirada en el mismo lote.",
          { movementIndex, position: movement.position },
        ),
      );
    }
  });

  return deduplicateViolations(violations);
}

function validateSource(
  positions,
  position,
  expectedCycle,
  movementIndex,
  violations,
  side,
) {
  validatePositionNumber(position, movementIndex, violations, side);
  validateCycleId(
    expectedCycle,
    "missing_expected_cycle",
    "El movimiento debe conservar el expected_life_cycle_id visto.",
    movementIndex,
    violations,
    side,
  );
  if (!Number.isInteger(position)) return;

  const row = positions.get(position);
  if (!row) {
    violations.push(
      violation("remote_position_missing", "La posición no existe en el estado remoto.", {
        movementIndex,
        position,
        side,
      }),
    );
    return;
  }
  if (row.is_empty === true) {
    violations.push(
      violation("source_position_empty", "No se puede retirar desde una posición vacía.", {
        movementIndex,
        position,
        side,
      }),
    );
    return;
  }
  if (
    typeof expectedCycle === "string" &&
    typeof row.life_cycle_id === "string" &&
    expectedCycle !== row.life_cycle_id
  ) {
    violations.push(
      violation(
        "expected_cycle_mismatch",
        "El ciclo esperado no coincide con el snapshot remoto.",
        { movementIndex, position, side },
      ),
    );
  }
}

function validateHeader(header, unitId) {
  const violations = [];
  if (typeof unitId !== "string" || unitId.trim() === "") {
    violations.push(violation("missing_unit_id", "El lote requiere unit_id."));
  }
  if (!isValidDate(header.performedAt)) {
    violations.push(
      violation("invalid_performed_at", "performed_at debe ser una fecha YYYY-MM-DD válida."),
    );
  }
  if (header.odometer !== null && !Number.isInteger(header.odometer)) {
    violations.push(
      violation("invalid_odometer", "El odómetro debe ser un entero o null."),
    );
  }
  if (header.notes !== null && typeof header.notes !== "string") {
    violations.push(violation("invalid_batch_notes", "Las notas deben ser texto o null."));
  }
  return violations;
}

function validateCommonFields(movement, movementIndex, violations) {
  if (movement.notes !== null && typeof movement.notes !== "string") {
    violations.push(
      violation("invalid_notes", "Las notas deben ser texto o null.", { movementIndex }),
    );
  }
}

function validatePositionNumber(position, movementIndex, violations, side) {
  if (!Number.isInteger(position) || position <= 0) {
    violations.push(
      violation("invalid_position", "La posición debe ser un entero positivo.", {
        movementIndex,
        side,
      }),
    );
  }
}

function validateCycleId(
  cycleId,
  code,
  message,
  movementIndex,
  violations,
  side,
) {
  if (typeof cycleId !== "string" || cycleId.trim() === "") {
    violations.push(violation(code, message, { movementIndex, side }));
  }
}

function validateRtd(value, field, movementIndex, violations) {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    violations.push(
      violation("invalid_rtd", `${field} debe ser number o null.`, {
        movementIndex,
        field,
      }),
    );
  }
}

function canonicalizeEdit(current, changes) {
  const merged = { ...current, ...changes, op: changes.op ?? current.op };
  if (merged.op === "send_to_retention") {
    return {
      op: merged.op,
      position: merged.position,
      expected_life_cycle_id:
        changes.life_cycle_id ?? merged.expected_life_cycle_id,
      rtd_mm: nullable(merged.rtd_mm),
      notes: nullable(merged.notes),
    };
  }
  if (merged.op === "discard") {
    return {
      op: merged.op,
      position: merged.position,
      expected_life_cycle_id:
        changes.life_cycle_id ?? merged.expected_life_cycle_id,
      rtd_mm: nullable(merged.rtd_mm),
      discard_cause: merged.discard_cause,
      photo_url: merged.photo_url,
      notes: nullable(merged.notes),
    };
  }
  if (merged.op === "mount") {
    return {
      op: merged.op,
      position: merged.position,
      life_cycle_id: merged.life_cycle_id,
      rtd_mm: nullable(merged.rtd_mm),
      notes: nullable(merged.notes),
    };
  }
  if (merged.op === "swap") {
    return {
      op: merged.op,
      position_a: merged.position_a,
      expected_life_cycle_id_a:
        changes.life_cycle_id_a ?? merged.expected_life_cycle_id_a,
      position_b: merged.position_b,
      expected_life_cycle_id_b:
        changes.life_cycle_id_b ?? merged.expected_life_cycle_id_b,
      rtd_mm_a: nullable(merged.rtd_mm_a),
      rtd_mm_b: nullable(merged.rtd_mm_b),
      notes: nullable(merged.notes),
    };
  }
  return merged;
}

function serializeMovement(movement, seq) {
  if (movement.op === "send_to_retention") {
    return {
      seq,
      op: movement.op,
      position: movement.position,
      expected_life_cycle_id: movement.expected_life_cycle_id,
      rtd_mm: movement.rtd_mm,
      notes: movement.notes,
    };
  }
  if (movement.op === "discard") {
    return {
      seq,
      op: movement.op,
      position: movement.position,
      expected_life_cycle_id: movement.expected_life_cycle_id,
      rtd_mm: movement.rtd_mm,
      discard_cause: movement.discard_cause,
      photo_url: movement.photo_url,
      notes: movement.notes,
    };
  }
  if (movement.op === "mount") {
    return {
      seq,
      op: movement.op,
      position: movement.position,
      life_cycle_id: movement.life_cycle_id,
      rtd_mm: movement.rtd_mm,
      notes: movement.notes,
    };
  }
  return {
    seq,
    op: movement.op,
    position_a: movement.position_a,
    expected_life_cycle_id_a: movement.expected_life_cycle_id_a,
    position_b: movement.position_b,
    expected_life_cycle_id_b: movement.expected_life_cycle_id_b,
    rtd_mm_a: movement.rtd_mm_a,
    rtd_mm_b: movement.rtd_mm_b,
    notes: movement.notes,
  };
}

function positionMap(remoteState) {
  let rows = remoteState;
  if (isObject(remoteState) && !Array.isArray(remoteState)) {
    rows =
      remoteState.positions ??
      remoteState.positionState ??
      remoteState.rows ??
      remoteState;
  }

  if (rows instanceof Map) return new Map(rows);
  if (!Array.isArray(rows) && isObject(rows)) rows = Object.values(rows);
  if (!Array.isArray(rows)) return new Map();

  return new Map(
    rows
      .map((row) => [readPosition(row), row])
      .filter(([position]) => Number.isInteger(position)),
  );
}

function recordPosition(map, key, movementIndex) {
  if (key === undefined || key === null || key === "") return;
  const indexes = map.get(key) ?? [];
  indexes.push(movementIndex);
  map.set(key, indexes);
}

function appendDuplicates(map, code, message, violations, valueField = "position") {
  for (const [value, movementIndexes] of map) {
    if (movementIndexes.length <= 1) continue;
    violations.push(
      violation(code, message, {
        [valueField]: value,
        movementIndexes,
      }),
    );
  }
}

function readPosition(value) {
  if (Number.isInteger(value)) return value;
  return value?.position ?? value?.position_number;
}

function nullable(value) {
  return value === undefined ? null : value;
}

function violation(code, message, details = {}) {
  return { code, message, ...details };
}

function success(details = {}) {
  return { ok: true, violations: [], ...details };
}

function failure(violations) {
  return { ok: false, violations };
}

function isValidIndex(index, movements) {
  return Number.isInteger(index) && index >= 0 && index < movements.length;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isObject(value)) return value;
  if (value instanceof Map) {
    return new Map([...value].map(([key, item]) => [key, cloneValue(item)]));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
  );
}

function deepFreeze(value) {
  if (!isObject(value) || Object.isFrozen(value)) return value;
  if (value instanceof Map) {
    for (const item of value.values()) deepFreeze(item);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

function deduplicateViolations(violations) {
  const seen = new Set();
  return violations.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function defaultUuid() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("crypto.randomUUID no está disponible.");
  }
  return globalThis.crypto.randomUUID();
}
