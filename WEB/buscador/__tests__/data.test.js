import { describe, expect, it, vi } from "vitest";

import {
  SEARCH_INDEX_CACHE_KEY,
  SEARCH_INDEX_CACHE_VERSION,
  SEARCH_FRECENCY_CACHE_KEY,
  SEARCH_FRECENCY_CACHE_VERSION,
  SEARCH_FRECENCY_MAX_ENTRIES,
  SEARCH_INDEX_STATES,
  clearSearchFrecency,
  clearSearchIndexCache,
  createSearchIndexLoadingState,
  loadSearchIndex,
  readSearchFrecency,
  registerSearchIndexCacheInvalidation,
  writeSearchFrecency,
} from "../data.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
  };
}

function createClient({ session = { user: { id: "user-a" } }, rows = [], error = null } = {}) {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    fetchView: error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(rows),
  };
}

const row = {
  kind: "casing",
  entity_id: "casing-1",
  company_id: "company-a",
  label: "CAS-01",
  haystack: "CAS-01 Michelin",
  position_number: "4",
  casing_code: "CAS-01",
};

describe("loadSearchIndex", () => {
  it("carga una vez, conserva columnas canónicas y normaliza solo position_number", async () => {
    const storage = createStorage();
    const client = createClient({ rows: [row] });

    await expect(loadSearchIndex({ client, storage })).resolves.toMatchObject({
      status: SEARCH_INDEX_STATES.READY,
      source: "network",
      companyId: "company-a",
      rows: [{ ...row, position_number: 4 }],
    });
    expect(client.fetchView).toHaveBeenCalledWith("v_search_index", {
      order: "kind.asc,label.asc.nullslast",
    });

    const cached = await loadSearchIndex({ client, storage });
    expect(cached).toMatchObject({ status: SEARCH_INDEX_STATES.READY, source: "cache" });
    expect(client.fetchView).toHaveBeenCalledOnce();
  });

  it("descarta versión vieja o una caché de otra sesión antes de refetch", async () => {
    const oldCache = JSON.stringify({
      version: "old",
      user_id: "user-a",
      company_id: "company-a",
      rows: [row],
    });
    const storage = createStorage({ [SEARCH_INDEX_CACHE_KEY]: oldCache });
    const client = createClient({ session: { user: { id: "user-b" } }, rows: [{ ...row, company_id: "company-b" }] });

    const result = await loadSearchIndex({ client, storage });
    expect(result).toMatchObject({ source: "network", companyId: "company-b" });
    expect(client.fetchView).toHaveBeenCalledOnce();
    expect(JSON.parse(storage.setItem.mock.calls.at(-1)[1])).toMatchObject({
      version: SEARCH_INDEX_CACHE_VERSION,
      user_id: "user-b",
      company_id: "company-b",
    });
  });

  it("rechaza silenciosamente una caché cuyo company_id no coincide con sus filas", async () => {
    const invalid = JSON.stringify({
      version: SEARCH_INDEX_CACHE_VERSION,
      user_id: "user-a",
      company_id: "company-b",
      rows: [row],
    });
    const storage = createStorage({ [SEARCH_INDEX_CACHE_KEY]: invalid });
    const client = createClient({ rows: [row] });

    await expect(loadSearchIndex({ client, storage })).resolves.toMatchObject({ source: "network" });
    expect(storage.removeItem).toHaveBeenCalledWith(SEARCH_INDEX_CACHE_KEY);
  });

  it("distingue empty, unauthorized y error", async () => {
    await expect(loadSearchIndex({ client: createClient() , storage: createStorage() }))
      .resolves.toMatchObject({ status: SEARCH_INDEX_STATES.EMPTY, source: "network" });
    await expect(loadSearchIndex({
      client: createClient({ session: null }), storage: createStorage(),
    })).resolves.toEqual({ status: SEARCH_INDEX_STATES.UNAUTHORIZED, rows: [] });
    const error = new Error("sin red");
    await expect(loadSearchIndex({
      client: createClient({ error }), storage: createStorage(),
    })).resolves.toMatchObject({ status: SEARCH_INDEX_STATES.ERROR, rows: [], error });
  });

  it("mantiene caché previa como stale cuando un refresh falla", async () => {
    const storage = createStorage();
    await loadSearchIndex({ client: createClient({ rows: [row] }), storage });
    const client = createClient({ error: new Error("sin red") });

    await expect(loadSearchIndex({ client, storage, forceRefresh: true })).resolves.toMatchObject({
      status: SEARCH_INDEX_STATES.STALE,
      source: "cache",
      rows: [{ ...row, position_number: 4 }],
    });
  });

  it("degrada a memoria si sessionStorage falla y se purga al cambiar autenticación", async () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error("bloqueado"); }),
      setItem: vi.fn(() => { throw new Error("lleno"); }),
      removeItem: vi.fn(() => { throw new Error("bloqueado"); }),
    };
    const client = createClient({ rows: [row] });
    clearSearchIndexCache({ storage });
    let onAuth;
    const subscription = { unsubscribe: vi.fn() };
    client.onAuthStateChange = vi.fn((callback) => {
      onAuth = callback;
      return { data: { subscription } };
    });
    await loadSearchIndex({ client, storage });
    await expect(loadSearchIndex({ client, storage })).resolves.toMatchObject({ source: "cache" });
    expect(client.onAuthStateChange).toHaveBeenCalledOnce();
    onAuth("SIGNED_OUT");
    await loadSearchIndex({ client, storage });
    expect(client.fetchView).toHaveBeenCalledTimes(2);
    const stop = registerSearchIndexCacheInvalidation({ client, storage });
    stop();
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("cache helpers", () => {
  it("expone loading y permite limpiar la caché explícitamente", () => {
    const storage = createStorage({ [SEARCH_INDEX_CACHE_KEY]: "value" });
    expect(createSearchIndexLoadingState()).toEqual({ status: SEARCH_INDEX_STATES.LOADING, rows: [] });
    clearSearchIndexCache({ storage });
    expect(storage.removeItem).toHaveBeenCalledWith(SEARCH_INDEX_CACHE_KEY);
  });
});

describe("frecency persistida", () => {
  const now = Date.UTC(2026, 6, 19);

  it("persiste solo para el mismo usuario y empresa, y conserva el orden reciente", () => {
    const storage = createStorage();
    const entries = writeSearchFrecency({
      userId: "user-a",
      companyId: "company-a",
      storage,
      now,
      entries: {
        "unit-1": { score: 3, samples: 2 },
        "casing-1": { score: 1, samples: 1, updated_at: now - 10 },
      },
    });

    expect(entries["unit-1"].updated_at).toBe(now);
    expect(readSearchFrecency({ userId: "user-a", companyId: "company-a", storage, now }))
      .toEqual(entries);
    expect(readSearchFrecency({ userId: "user-a", companyId: "company-b", storage, now })).toEqual({});
    expect(readSearchFrecency({ userId: "user-b", companyId: "company-a", storage, now })).toEqual({});
    expect(storage.removeItem).toHaveBeenCalledWith(SEARCH_FRECENCY_CACHE_KEY);
  });

  it("descarta datos corruptos o vencidos y limita el tamaño", () => {
    const old = now - (91 * 24 * 60 * 60 * 1000);
    const storage = createStorage({
      [SEARCH_FRECENCY_CACHE_KEY]: JSON.stringify({
        version: SEARCH_FRECENCY_CACHE_VERSION,
        user_id: "user-a",
        company_id: "company-a",
        entries: Object.fromEntries([
          ["expired", { score: 4, samples: 2, updated_at: old }],
          ...Array.from({ length: SEARCH_FRECENCY_MAX_ENTRIES + 2 }, (_, index) => [
            `item-${index}`,
            { score: 1, samples: 1, updated_at: now - index },
          ]),
        ]),
      }),
    });

    const entries = readSearchFrecency({ userId: "user-a", companyId: "company-a", storage, now });
    expect(entries.expired).toBeUndefined();
    expect(Object.keys(entries)).toHaveLength(SEARCH_FRECENCY_MAX_ENTRIES);

    const corruptStorage = createStorage({ [SEARCH_FRECENCY_CACHE_KEY]: "no es json" });
    expect(readSearchFrecency({ userId: "user-a", companyId: "company-a", storage: corruptStorage, now }))
      .toEqual({});
    expect(corruptStorage.removeItem).toHaveBeenCalledWith(SEARCH_FRECENCY_CACHE_KEY);
  });

  it("purga frecency al cambio de autenticación", () => {
    const storage = createStorage();
    writeSearchFrecency({
      userId: "user-a",
      companyId: "company-a",
      storage,
      now,
      entries: { "unit-1": { score: 1, samples: 1 } },
    });
    let onAuth;
    const client = createClient();
    client.onAuthStateChange = vi.fn((callback) => {
      onAuth = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    });

    registerSearchIndexCacheInvalidation({ client, storage, frecencyStorage: storage });
    onAuth("SIGNED_OUT");
    expect(storage.removeItem).toHaveBeenCalledWith(SEARCH_FRECENCY_CACHE_KEY);
    clearSearchFrecency({ storage });
  });
});
