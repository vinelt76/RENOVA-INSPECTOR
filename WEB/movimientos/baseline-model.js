const CONDITIONS = new Set(["N", "R1", "R2", "R3", "R4"]);

const MOUNT_FIELDS = Object.freeze([
  "seq",
  "position",
  "source_measurement_id",
  "source_inspected_on",
  "casing_code",
  "life_cycle_id",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
  "otd_mm",
  "rtd_mm",
  "notes",
]);

function localToday(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function nullableNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function cloneMount(mount = {}) {
  return Object.fromEntries(MOUNT_FIELDS.map((field) => [field, mount[field] ?? null]));
}

function prefilledMount(position, evidence, seq) {
  return cloneMount({
    seq,
    position: Number(position),
    source_measurement_id: evidence?.last_measurement_id,
    source_inspected_on: evidence?.last_inspected_on,
    casing_code: evidence?.last_inspection_tire_code,
    life_cycle_id: null,
    brand_name: evidence?.last_brand_name,
    model_name: evidence?.last_model_name,
    size_name: evidence?.last_size_name,
    condition: evidence?.last_condition ?? "N",
    retread_design: evidence?.last_retread_design,
    otd_mm: null,
    rtd_mm: evidence?.last_rtd_movi_mm,
    notes: null,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function violation(code, message, position = null) {
  return { code, message, ...(position == null ? {} : { position }) };
}

function validateDraft(state) {
  const violations = [];
  if (!nullableText(state.unit_id)) {
    violations.push(violation("unit_required", "No se pudo identificar la unidad."));
  }
  if (!nullableText(state.performed_at)) {
    violations.push(violation("performed_at_required", "La fecha de confirmación es obligatoria."));
  }
  if (!state.mounts.length) {
    violations.push(violation("mounts_required", "Agrega al menos una posición pendiente."));
  }
  if (state.odometer !== null && state.odometer !== "") {
    const odometer = Number(state.odometer);
    if (!Number.isInteger(odometer) || odometer < 0) {
      violations.push(violation("odometer_invalid", "El odómetro debe ser un entero no negativo."));
    }
  }

  const positions = new Set();
  const sequences = new Set();
  for (const mount of state.mounts) {
    const position = Number(mount.position);
    const seq = Number(mount.seq);
    if (!Number.isInteger(position) || position <= 0) {
      violations.push(violation("position_invalid", "La posición debe ser un entero positivo.", position));
    } else if (positions.has(position)) {
      violations.push(violation("position_duplicate", `La posición P${position} está repetida.`, position));
    }
    positions.add(position);

    if (!Number.isInteger(seq) || seq <= 0) {
      violations.push(violation("seq_invalid", `La secuencia de P${position} no es válida.`, position));
    } else if (sequences.has(seq)) {
      violations.push(violation("seq_duplicate", `La secuencia ${seq} está repetida.`, position));
    }
    sequences.add(seq);

    if (!nullableText(mount.source_measurement_id)) {
      violations.push(violation(
        "source_measurement_required",
        `P${position} no tiene una medición fuente válida.`,
        position,
      ));
    }

    const condition = nullableText(mount.condition)?.toUpperCase();
    if (!CONDITIONS.has(condition)) {
      violations.push(violation(
        "condition_invalid",
        `La condición de P${position} debe ser N, R1, R2, R3 o R4.`,
        position,
      ));
    } else if (condition !== "N" && !nullableText(mount.retread_design)) {
      violations.push(violation(
        "retread_design_required",
        `La condición ${condition} de P${position} requiere diseño de reencauche.`,
        position,
      ));
    }

    const hasCode = Boolean(nullableText(mount.casing_code));
    const hasCycle = Boolean(nullableText(mount.life_cycle_id));
    if (hasCode === hasCycle) {
      violations.push(violation(
        "identity_xor",
        `P${position} requiere exactamente un código nuevo o un ciclo de inventario.`,
        position,
      ));
    }

    const otd = Number(mount.otd_mm);
    if (mount.otd_mm === null || mount.otd_mm === "") {
      violations.push(violation(
        "otd_required",
        `La OTD de P${position} es obligatoria.`,
        position,
      ));
    } else if (!Number.isFinite(otd) || otd <= 0) {
      violations.push(violation(
        "otd_invalid",
        `La OTD de P${position} debe ser un número mayor que cero.`,
        position,
      ));
    }

    const rtd = Number(mount.rtd_mm);
    if (mount.rtd_mm === null || mount.rtd_mm === "") {
      violations.push(violation(
        "rtd_required",
        `El RTD al instalar de P${position} es obligatorio.`,
        position,
      ));
    } else if (!Number.isFinite(rtd) || rtd <= 0) {
      violations.push(violation(
        "rtd_invalid",
        `El RTD al instalar de P${position} debe ser un número mayor que cero.`,
        position,
      ));
    }
  }
  return violations;
}

function mountPayload(mount) {
  const payload = {
    seq: Number(mount.seq),
    position: Number(mount.position),
    source_measurement_id: nullableText(mount.source_measurement_id),
    condition: nullableText(mount.condition)?.toUpperCase(),
    brand_name: nullableText(mount.brand_name),
    model_name: nullableText(mount.model_name),
    size_name: nullableText(mount.size_name),
    retread_design: nullableText(mount.retread_design),
    otd_mm: nullableNumber(mount.otd_mm),
    rtd_mm: nullableNumber(mount.rtd_mm),
    notes: nullableText(mount.notes),
  };
  const lifeCycleId = nullableText(mount.life_cycle_id);
  if (lifeCycleId) payload.life_cycle_id = lifeCycleId;
  else payload.casing_code = nullableText(mount.casing_code);
  return payload;
}

export class BaselineValidationError extends Error {
  constructor(violations) {
    super("El borrador de primer montaje no es válido.");
    this.name = "BaselineValidationError";
    this.violations = violations;
  }
}

/** Máquina de estados pura del primer montaje. */
export function createBaselineModel({
  unitId,
  draft,
  today = localToday(),
  uuidFn = () => globalThis.crypto.randomUUID(),
} = {}) {
  let state = {
    unit_id: draft?.unit_id ?? unitId ?? null,
    performed_at: draft?.performed_at ?? today,
    odometer: draft?.odometer ?? null,
    mounts: Array.isArray(draft?.mounts) ? draft.mounts.map(cloneMount) : [],
  };
  let sealed = null;

  function invalidateSeal() {
    sealed = null;
  }

  function snapshot() {
    return structuredClone(state);
  }

  function addFromProjection(position, evidence = {}) {
    const normalized = Number(position);
    const existing = state.mounts.find((mount) => Number(mount.position) === normalized);
    if (existing) return { ok: true, mount: structuredClone(existing), added: false };
    const nextSeq = Math.max(0, ...state.mounts.map((mount) => Number(mount.seq) || 0)) + 1;
    const mount = prefilledMount(normalized, evidence, nextSeq);
    state.mounts.push(mount);
    if (state.odometer == null && evidence?.last_odometer_km != null) {
      state.odometer = evidence.last_odometer_km;
    }
    invalidateSeal();
    return { ok: true, mount: structuredClone(mount), added: true };
  }

  function updateHeader(changes = {}) {
    if (Object.hasOwn(changes, "performed_at")) state.performed_at = changes.performed_at;
    if (Object.hasOwn(changes, "odometer")) state.odometer = changes.odometer;
    invalidateSeal();
    return snapshot();
  }

  function updateMount(position, changes = {}) {
    const mount = state.mounts.find((candidate) => Number(candidate.position) === Number(position));
    if (!mount) return { ok: false, violations: [violation("mount_missing", "La posición no está en el borrador.")] };
    for (const field of MOUNT_FIELDS) {
      if (field !== "position" && field !== "seq" && Object.hasOwn(changes, field)) {
        mount[field] = changes[field];
      }
    }
    if (Object.hasOwn(changes, "life_cycle_id") && nullableText(changes.life_cycle_id)) {
      mount.casing_code = null;
    }
    if (Object.hasOwn(changes, "casing_code") && nullableText(changes.casing_code)) {
      mount.life_cycle_id = null;
    }
    invalidateSeal();
    return { ok: true, mount: structuredClone(mount) };
  }

  function remove(position) {
    const before = state.mounts.length;
    state.mounts = state.mounts.filter(
      (mount) => Number(mount.position) !== Number(position),
    );
    if (state.mounts.length !== before) invalidateSeal();
    return state.mounts.length !== before;
  }

  function validate() {
    return validateDraft(state);
  }

  function seal() {
    const violations = validate();
    if (violations.length) throw new BaselineValidationError(violations);
    if (sealed) return sealed;
    sealed = deepFreeze({
      batch_version: 1,
      batch_id: uuidFn(),
      unit_id: state.unit_id,
      performed_at: state.performed_at,
      odometer: state.odometer == null || state.odometer === ""
        ? null
        : Number(state.odometer),
      mounts: state.mounts.map(mountPayload),
    });
    return sealed;
  }

  return {
    addFromProjection,
    updateHeader,
    updateMount,
    remove,
    validate,
    seal,
    editAfterSeal: invalidateSeal,
    toDraft: snapshot,
    get state() {
      return snapshot();
    },
    get mounts() {
      return snapshot().mounts;
    },
    get sealed() {
      return sealed;
    },
  };
}

export { localToday };
