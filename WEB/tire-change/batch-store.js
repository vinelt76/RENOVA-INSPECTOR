const STORE_PREFIX = "renova:tire-change";
const STORE_VERSION = 1;
const memoryFallback = new Map();

function normalizeScope(scope) {
  if (!scope || typeof scope !== "object") {
    throw new TypeError("El scope de persistencia es obligatorio");
  }

  return {
    userId: requireScopePart(scope.userId, "userId"),
    companyId:
      scope.companyId == null || scope.companyId === ""
        ? null
        : requireScopePart(scope.companyId, "companyId"),
    unitId: requireScopePart(scope.unitId, "unitId"),
  };
}

function requireScopePart(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`scope.${name} es obligatorio`);
  return normalized;
}

function encodePart(value) {
  return encodeURIComponent(value ?? "-");
}

function scopeKey(scope) {
  return [scope.userId, scope.companyId, scope.unitId].map(encodePart).join(":");
}

function draftKey(scope) {
  return `${STORE_PREFIX}:draft:${scopeKey(scope)}`;
}

function sealedPrefix(scope) {
  return `${STORE_PREFIX}:sealed:${scopeKey(scope)}:`;
}

function sealedKey(scope, batchId) {
  return `${sealedPrefix(scope)}${encodePart(batchId)}`;
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function writeValue(key, serialized, storage) {
  const target = resolveStorage(storage);
  if (target) {
    try {
      target.setItem(key, serialized);
      memoryFallback.delete(key);
      return;
    } catch {
      // A quota/security failure must not interrupt the active editor session.
    }
  }
  memoryFallback.set(key, serialized);
}

function readValue(key, storage) {
  if (memoryFallback.has(key)) return memoryFallback.get(key);

  const target = resolveStorage(storage);
  if (target) {
    try {
      const value = target.getItem(key);
      if (value != null) return value;
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return null;
}

function removeValue(key, storage) {
  const target = resolveStorage(storage);
  if (!target) {
    memoryFallback.delete(key);
    return;
  }
  try {
    target.removeItem(key);
    memoryFallback.delete(key);
  } catch {
    // A tombstone prevents an old persistent value from reviving this session.
    memoryFallback.set(key, null);
  }
}

function listKeys(storage) {
  const keys = new Set(memoryFallback.keys());
  const target = resolveStorage(storage);
  if (!target) return [...keys];

  try {
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (typeof key === "string") keys.add(key);
    }
  } catch {
    // An unavailable localStorage leaves only the in-memory keys.
  }
  return [...keys];
}

function createEnvelope(kind, scope, value) {
  return {
    version: STORE_VERSION,
    kind,
    scope,
    value,
  };
}

function serializeEnvelope(kind, scope, value) {
  const serialized = JSON.stringify(createEnvelope(kind, scope, value));
  if (serialized === undefined) {
    throw new TypeError(`No se pudo serializar el ${kind}`);
  }
  return serialized;
}

function readEnvelope(key, kind, scope, storage) {
  const serialized = readValue(key, storage);
  if (serialized == null) return null;

  try {
    const envelope = JSON.parse(serialized);
    if (
      envelope?.version !== STORE_VERSION ||
      envelope?.kind !== kind ||
      !sameScope(envelope?.scope, scope) ||
      !matchesUnit(envelope?.value, scope.unitId)
    ) {
      removeValue(key, storage);
      return null;
    }
    return envelope.value;
  } catch {
    removeValue(key, storage);
    return null;
  }
}

function sameScope(candidate, expected) {
  return (
    candidate?.userId === expected.userId &&
    (candidate?.companyId ?? null) === expected.companyId &&
    candidate?.unitId === expected.unitId
  );
}

function matchesUnit(value, unitId) {
  if (!value || typeof value !== "object") return false;
  const embeddedUnitId = value.unit_id ?? value.unitId;
  return embeddedUnitId == null || embeddedUnitId === unitId;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} debe ser un objeto`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

/** Guarda un snapshot editable. El payload sellado se persiste por separado. */
export function saveDraft(scope, draft, storage) {
  const normalizedScope = normalizeScope(scope);
  assertObject(draft, "draft");
  if (draft.sealed != null) {
    throw new TypeError("El borrador editable no puede contener un payload sellado");
  }
  if (!matchesUnit(draft, normalizedScope.unitId)) {
    throw new TypeError("El unit_id del borrador no coincide con el scope");
  }

  const serialized = serializeEnvelope("draft", normalizedScope, draft);
  writeValue(draftKey(normalizedScope), serialized, storage);
  return JSON.parse(serialized).value;
}

/** Recupera un snapshot editable o null si la sesión/unidad no coincide. */
export function loadDraft(scope, storage) {
  const normalizedScope = normalizeScope(scope);
  return readEnvelope(draftKey(normalizedScope), "draft", normalizedScope, storage);
}

export function clearDraft(scope, storage) {
  const normalizedScope = normalizeScope(scope);
  removeValue(draftKey(normalizedScope), storage);
}

/**
 * Persiste el primer payload sellado del scope. Mientras siga pendiente no
 * permite reemplazarlo por otro batch_id ni reescribir su contenido.
 */
export function saveSealed(scope, payload, storage) {
  const normalizedScope = normalizeScope(scope);
  assertObject(payload, "payload");
  const batchId = requireScopePart(payload.batch_id, "batch_id");
  if (payload.unit_id !== normalizedScope.unitId) {
    throw new TypeError("El unit_id del payload no coincide con el scope");
  }

  const pending = loadSealed(normalizedScope, storage);
  if (pending) {
    if (pending.batch_id !== batchId) {
      throw new Error(
        `Ya existe un payload sellado pendiente (${pending.batch_id}); debe limpiarse antes de guardar ${batchId}`,
      );
    }
    return pending;
  }

  const serialized = serializeEnvelope("sealed", normalizedScope, payload);
  writeValue(sealedKey(normalizedScope, batchId), serialized, storage);
  return deepFreeze(JSON.parse(serialized).value);
}

/** Devuelve el payload pendiente profundamente congelado para un retry idéntico. */
export function loadSealed(scope, storage) {
  const normalizedScope = normalizeScope(scope);
  const prefix = sealedPrefix(normalizedScope);
  const candidates = listKeys(storage)
    .filter((key) => key.startsWith(prefix))
    .sort();

  for (const key of candidates) {
    const payload = readEnvelope(key, "sealed", normalizedScope, storage);
    if (!payload || typeof payload.batch_id !== "string") {
      removeValue(key, storage);
      continue;
    }
    if (key !== sealedKey(normalizedScope, payload.batch_id)) {
      removeValue(key, storage);
      continue;
    }
    return deepFreeze(payload);
  }

  return null;
}

/** Limpia un payload tras éxito o error de dominio usando su batch_id global. */
export function clearSealed(batchId, storage) {
  const normalizedBatchId = requireScopePart(batchId, "batch_id");
  const suffix = `:${encodePart(normalizedBatchId)}`;
  for (const key of listKeys(storage)) {
    if (key.startsWith(`${STORE_PREFIX}:sealed:`) && key.endsWith(suffix)) {
      removeValue(key, storage);
    }
  }
}
