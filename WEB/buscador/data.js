// v2 agrega columnas de faceta a v_search_index; una copia v1 no puede
// alimentar la pantalla de neumáticos aunque siga siendo válida para buscar.
export const SEARCH_INDEX_CACHE_VERSION = "3";
export const SEARCH_INDEX_CACHE_KEY = `renova:search-index:v${SEARCH_INDEX_CACHE_VERSION}`;
export const SEARCH_FRECENCY_CACHE_VERSION = "1";
export const SEARCH_FRECENCY_CACHE_KEY = `renova:search-frecency:v${SEARCH_FRECENCY_CACHE_VERSION}`;
export const SEARCH_FRECENCY_MAX_ENTRIES = 100;
export const SEARCH_FRECENCY_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export const SEARCH_INDEX_STATES = Object.freeze({
  LOADING: "loading",
  READY: "ready",
  EMPTY: "empty",
  UNAUTHORIZED: "unauthorized",
  ERROR: "error",
  STALE: "stale",
});

const memoryCache = new Map();
const clientsWithInvalidationHook = new WeakSet();

function getClient(dependency) {
  const client = dependency ?? globalThis.RenovaSupabase;
  if (typeof client?.fetchView !== "function" || typeof client?.getSession !== "function") {
    throw new TypeError("RenovaSupabase.fetchView y getSession deben estar disponibles.");
  }
  return client;
}

function getSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function getLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredValue(storage, key) {
  try {
    if (typeof storage?.getItem !== "function") return memoryCache.get(key) ?? null;
    return storage.getItem(key);
  } catch {
    return memoryCache.get(key) ?? null;
  }
}

function writeStoredValue(storage, key, value) {
  memoryCache.set(key, value);
  try {
    storage?.setItem?.(key, value);
  } catch {
    // sessionStorage puede estar bloqueado o lleno; la caché en memoria basta.
  }
}

function removeStoredValue(storage, key) {
  memoryCache.delete(key);
  try {
    storage?.removeItem?.(key);
  } catch {
    // La copia en memoria ya fue eliminada.
  }
}

function normalizeSearchIndexRow(row) {
  const normalized = { ...row };
  if (normalized.position_number != null) {
    normalized.position_number = Number(normalized.position_number);
  }
  return normalized;
}

function companyIdFromRows(rows) {
  const companyIds = new Set(rows.map((row) => row?.company_id).filter(Boolean));
  if (companyIds.size > 1) {
    throw new Error("Contrato inválido: v_search_index devolvió más de una empresa.");
  }
  return companyIds.values().next().value ?? null;
}

function readCache(storage, userId) {
  const raw = readStoredValue(storage, SEARCH_INDEX_CACHE_KEY);
  if (!raw) return null;

  try {
    const cache = JSON.parse(raw);
    const valid = cache?.version === SEARCH_INDEX_CACHE_VERSION
      && cache?.user_id === userId
      && Array.isArray(cache?.rows)
      && cache?.company_id === companyIdFromRows(cache.rows);
    if (valid) return cache;
  } catch {
    // Una caché corrupta se trata igual que una versión vieja.
  }

  removeStoredValue(storage, SEARCH_INDEX_CACHE_KEY);
  return null;
}

function writeCache(storage, userId, rows) {
  const cache = {
    version: SEARCH_INDEX_CACHE_VERSION,
    user_id: userId,
    company_id: companyIdFromRows(rows),
    rows,
  };
  writeStoredValue(storage, SEARCH_INDEX_CACHE_KEY, JSON.stringify(cache));
  return cache;
}

function stateForRows(rows, extras = {}) {
  return {
    status: rows.length === 0 ? SEARCH_INDEX_STATES.EMPTY : SEARCH_INDEX_STATES.READY,
    rows,
    ...extras,
  };
}

function normalizedFrecencyEntries(entries, now = Date.now()) {
  const validEntries = Object.entries(entries ?? [])
    .map(([entityId, value]) => {
      const score = Number(value?.score);
      const samples = Number(value?.samples);
      const updatedAt = Number(value?.updated_at) || now;
      if (!entityId || !Number.isFinite(score) || !Number.isFinite(samples) || score <= 0 || samples <= 0) {
        return null;
      }
      if (updatedAt < now - SEARCH_FRECENCY_MAX_AGE_MS) return null;
      return [entityId, {
        score,
        samples,
        updated_at: Math.min(updatedAt, now),
      }];
    })
    .filter(Boolean)
    .sort(([, left], [, right]) => right.updated_at - left.updated_at || right.score - left.score)
    .slice(0, SEARCH_FRECENCY_MAX_ENTRIES);
  return Object.fromEntries(validEntries);
}

/** Estado inicial para que la futura capa de DOM pueda anunciar aria-busy. */
export function createSearchIndexLoadingState() {
  return { status: SEARCH_INDEX_STATES.LOADING, rows: [] };
}

/** Borra tanto sessionStorage como el fallback de memoria. */
export function clearSearchIndexCache({ storage = getSessionStorage() } = {}) {
  removeStoredValue(storage, SEARCH_INDEX_CACHE_KEY);
}

/** Lee recientes persistidos solo para la misma combinación usuario/empresa. */
export function readSearchFrecency({
  userId,
  companyId,
  storage = getLocalStorage(),
  now = Date.now(),
} = {}) {
  if (!userId || !companyId) return {};
  const raw = readStoredValue(storage, SEARCH_FRECENCY_CACHE_KEY);
  if (!raw) return {};

  try {
    const cache = JSON.parse(raw);
    const valid = cache?.version === SEARCH_FRECENCY_CACHE_VERSION
      && cache?.user_id === userId
      && cache?.company_id === companyId
      && cache?.entries && typeof cache.entries === "object";
    if (valid) return normalizedFrecencyEntries(cache.entries, now);
  } catch {
    // Un historial corrupto no debe impedir buscar.
  }

  removeStoredValue(storage, SEARCH_FRECENCY_CACHE_KEY);
  return {};
}

/** Persiste un historial acotado. `updated_at` solo se renueva para la entrada navegada. */
export function writeSearchFrecency({
  userId,
  companyId,
  entries,
  storage = getLocalStorage(),
  now = Date.now(),
} = {}) {
  if (!userId || !companyId) return {};
  const normalizedEntries = normalizedFrecencyEntries(entries, now);
  writeStoredValue(storage, SEARCH_FRECENCY_CACHE_KEY, JSON.stringify({
    version: SEARCH_FRECENCY_CACHE_VERSION,
    user_id: userId,
    company_id: companyId,
    entries: normalizedEntries,
  }));
  return normalizedEntries;
}

/** Borra localStorage y su fallback de memoria al cerrar o cambiar de empresa. */
export function clearSearchFrecency({ storage = getLocalStorage() } = {}) {
  removeStoredValue(storage, SEARCH_FRECENCY_CACHE_KEY);
}

/**
 * Carga el índice una vez por sesión. La identidad del usuario autenticado
 * delimita la caché; `profiles.company_id` es escalar y la fila obtenida por
 * RLS confirma el company_id almacenado. Un login/logout siempre la invalida.
 */
export async function loadSearchIndex({
  client: clientDependency,
  storage = getSessionStorage(),
  forceRefresh = false,
} = {}) {
  const client = getClient(clientDependency);
  if (!clientsWithInvalidationHook.has(client)) {
    registerSearchIndexCacheInvalidation({ client, storage });
    clientsWithInvalidationHook.add(client);
  }
  const session = await client.getSession();
  const userId = session?.user?.id;
  if (!userId) return { status: SEARCH_INDEX_STATES.UNAUTHORIZED, rows: [] };

  const cached = readCache(storage, userId);
  if (cached && !forceRefresh) {
    return stateForRows(cached.rows, {
      source: "cache",
      companyId: cached.company_id,
    });
  }

  try {
    const remoteRows = await client.fetchView("v_search_index", {
      order: "kind.asc,label.asc.nullslast",
    });
    if (!Array.isArray(remoteRows)) {
      throw new Error("Contrato inválido: v_search_index no devolvió una lista.");
    }

    const rows = remoteRows.map(normalizeSearchIndexRow);
    const cache = writeCache(storage, userId, rows);
    return stateForRows(rows, { source: "network", companyId: cache.company_id });
  } catch (error) {
    if (cached) {
      return {
        status: SEARCH_INDEX_STATES.STALE,
        rows: cached.rows,
        source: "cache",
        companyId: cached.company_id,
      };
    }
    return { status: SEARCH_INDEX_STATES.ERROR, rows: [], error };
  }
}

/**
 * Invalida el índice cuando se cierra sesión o se inicia otra. No invalida en
 * TOKEN_REFRESHED, porque el usuario y su empresa siguen siendo los mismos.
 */
export function registerSearchIndexCacheInvalidation({
  client: clientDependency,
  storage = getSessionStorage(),
  frecencyStorage = getLocalStorage(),
} = {}) {
  const client = getClient(clientDependency);
  if (typeof client.onAuthStateChange !== "function") return () => {};

  const result = client.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
      clearSearchIndexCache({ storage });
      clearSearchFrecency({ storage: frecencyStorage });
    }
  });
  const subscription = result?.data?.subscription ?? result?.subscription ?? result;
  return typeof subscription?.unsubscribe === "function"
    ? () => subscription.unsubscribe()
    : () => {};
}
