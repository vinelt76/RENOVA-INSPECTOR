import { describe, expect, it } from "vitest";

import { BATCH_STATUS, createBatchModel } from "../batch-model.js";
import {
  clearDraft,
  clearSealed,
  loadDraft,
  loadSealed,
  saveDraft,
  saveSealed,
} from "../batch-store.js";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "10000000-0000-4000-8000-000000000002";
const COMPANY_ID = "20000000-0000-4000-8000-000000000001";
const OTHER_COMPANY_ID = "20000000-0000-4000-8000-000000000002";
const UNIT_ID = "30000000-0000-4000-8000-000000000001";
const OTHER_UNIT_ID = "30000000-0000-4000-8000-000000000002";
const BATCH_ID = "40000000-0000-4000-8000-000000000001";
const OTHER_BATCH_ID = "40000000-0000-4000-8000-000000000002";
const LIFE_CYCLE_ID = "50000000-0000-4000-8000-000000000001";

const SCOPE = { userId: USER_ID, companyId: COMPANY_ID, unitId: UNIT_ID };
const REMOTE_STATE = [
  {
    unit_id: UNIT_ID,
    position_number: 1,
    is_empty: false,
    life_cycle_id: LIFE_CYCLE_ID,
    code_mismatch: false,
  },
];

class StorageMock {
  constructor() {
    this.values = new Map();
    this.setCalls = 0;
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.get(String(key)) ?? null;
  }

  setItem(key, value) {
    this.setCalls += 1;
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

class FailingMutationStorage extends StorageMock {
  setItem(key, value) {
    if (this.failWrites) throw new Error("quota exceeded");
    super.setItem(key, value);
  }

  removeItem(key) {
    if (this.failRemoves) throw new Error("storage blocked");
    super.removeItem(key);
  }
}

class UnavailableStorage {
  get length() {
    throw new Error("storage blocked");
  }

  key() {
    throw new Error("storage blocked");
  }

  getItem() {
    throw new Error("storage blocked");
  }

  setItem() {
    throw new Error("quota exceeded");
  }

  removeItem() {
    throw new Error("storage blocked");
  }
}

function editableModel() {
  const model = createBatchModel({ unitId: UNIT_ID, remoteState: REMOTE_STATE });
  expect(model.addSendToRetention(REMOTE_STATE[0], { notes: "Revisar" }).ok).toBe(true);
  return model;
}

function sealedPayload(batchId = BATCH_ID) {
  return editableModel().seal({ performedAt: "2026-07-13", odometer: 210000 }, () => batchId);
}

describe("batch store · borrador editable", () => {
  it("guarda un snapshot y reanuda sus movements en un BatchModel nuevo", () => {
    const storage = new StorageMock();
    const original = editableModel();

    const saved = saveDraft(SCOPE, original.state, storage);
    saved.movements[0].notes = "Cambio fuera del store";

    const restored = loadDraft(SCOPE, storage);
    expect(restored).toEqual(original.state);
    expect(Object.isFrozen(restored)).toBe(false);

    const reloadedModel = createBatchModel({
      unitId: SCOPE.unitId,
      remoteState: REMOTE_STATE,
      movements: restored.movements,
    });
    expect(reloadedModel.status).toBe(BATCH_STATUS.EDITING);
    expect(reloadedModel.editMovement(0, { notes: "Editado tras recarga" }).ok).toBe(true);
  });

  it("usa una clave namespaced y aísla usuario, empresa y unidad", () => {
    const storage = new StorageMock();
    saveDraft(SCOPE, editableModel().state, storage);

    expect([...storage.values.keys()]).toEqual([
      `renova:movimientos:draft:${USER_ID}:${COMPANY_ID}:${UNIT_ID}`,
    ]);
    expect(loadDraft({ ...SCOPE, userId: OTHER_USER_ID }, storage)).toBeNull();
    expect(loadDraft({ ...SCOPE, companyId: OTHER_COMPANY_ID }, storage)).toBeNull();
    expect(loadDraft({ ...SCOPE, unitId: OTHER_UNIT_ID }, storage)).toBeNull();
  });

  it("ignora y limpia un borrador cuyo sobre no coincide con la sesión/unidad", () => {
    const storage = new StorageMock();
    saveDraft(SCOPE, editableModel().state, storage);
    const [key] = storage.values.keys();
    const corrupted = JSON.parse(storage.getItem(key));
    corrupted.scope.unitId = OTHER_UNIT_ID;
    storage.setItem(key, JSON.stringify(corrupted));

    expect(loadDraft(SCOPE, storage)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("limpia el borrador sin afectar otros scopes", () => {
    const storage = new StorageMock();
    const otherScope = { userId: OTHER_USER_ID, unitId: UNIT_ID };
    saveDraft(SCOPE, editableModel().state, storage);
    saveDraft(otherScope, editableModel().state, storage);

    clearDraft(SCOPE, storage);

    expect(loadDraft(SCOPE, storage)).toBeNull();
    expect(loadDraft(otherScope, storage)).not.toBeNull();
  });

  it("migra un borrador legacy al prefijo nuevo sin perderlo", () => {
    const storage = new StorageMock();
    const draft = editableModel().state;
    saveDraft(SCOPE, draft, storage);
    const [currentKey] = storage.values.keys();
    const legacyKey = currentKey.replace("renova:movimientos", "renova:tire-change");
    storage.values.set(legacyKey, storage.getItem(currentKey));
    storage.values.delete(currentKey);

    expect(loadDraft(SCOPE, storage)).toEqual(draft);
    expect(storage.getItem(legacyKey)).toBeNull();
    expect(storage.getItem(currentKey)).not.toBeNull();
  });

  it("prioriza el borrador nuevo y elimina una copia legacy concurrente", () => {
    const storage = new StorageMock();
    const current = editableModel().state;
    const legacy = structuredClone(current);
    legacy.movements[0].notes = "Versión legacy";
    saveDraft(SCOPE, current, storage);
    const [currentKey] = storage.values.keys();
    const legacyKey = currentKey.replace("renova:movimientos", "renova:tire-change");
    storage.values.set(legacyKey, JSON.stringify({
      version: 1,
      kind: "draft",
      scope: SCOPE,
      value: legacy,
    }));

    expect(loadDraft(SCOPE, storage)).toEqual(current);
    expect(storage.getItem(legacyKey)).toBeNull();
  });

  it("rechaza mezclar un payload sellado dentro del borrador", () => {
    const storage = new StorageMock();
    expect(() =>
      saveDraft(SCOPE, { movements: [], sealed: sealedPayload() }, storage),
    ).toThrow(/no puede contener un payload sellado/);
  });
});

describe("batch store · payload sellado", () => {
  it("reanuda el payload real de BatchModel profundamente congelado", () => {
    const storage = new StorageMock();
    const payload = sealedPayload();

    saveSealed(SCOPE, payload, storage);
    const restored = loadSealed(SCOPE, storage);

    expect(restored).toEqual(payload);
    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored.movements)).toBe(true);
    expect(Object.isFrozen(restored.movements[0])).toBe(true);
    expect(() => {
      restored.movements[0].position = 99;
    }).toThrow(TypeError);
  });

  it("un retry conserva el primer contenido y el mismo batch_id sin reescribir", () => {
    const storage = new StorageMock();
    const payload = sealedPayload();
    saveSealed(SCOPE, payload, storage);
    const rawBeforeRetry = [...storage.values.values()][0];

    const attemptedRewrite = {
      ...payload,
      performed_at: "2030-01-01",
      movements: payload.movements.map((movement) => ({ ...movement, notes: "Mutado" })),
    };
    const retry = saveSealed(SCOPE, attemptedRewrite, storage);

    expect(retry).toEqual(payload);
    expect(retry.batch_id).toBe(BATCH_ID);
    expect(retry.performed_at).toBe("2026-07-13");
    expect([...storage.values.values()][0]).toBe(rawBeforeRetry);
    expect(storage.setCalls).toBe(1);
  });

  it("impide reemplazar un sellado pendiente por un batch_id distinto", () => {
    const storage = new StorageMock();
    saveSealed(SCOPE, sealedPayload(), storage);

    expect(() => saveSealed(SCOPE, sealedPayload(OTHER_BATCH_ID), storage)).toThrow(
      /Ya existe un payload sellado pendiente/,
    );
    expect(loadSealed(SCOPE, storage)?.batch_id).toBe(BATCH_ID);
  });

  it("valida unit_id y aísla la reanudación por scope", () => {
    const storage = new StorageMock();
    const payload = sealedPayload();
    saveSealed(SCOPE, payload, storage);

    expect(loadSealed({ ...SCOPE, userId: OTHER_USER_ID }, storage)).toBeNull();
    expect(loadSealed({ ...SCOPE, companyId: OTHER_COMPANY_ID }, storage)).toBeNull();
    expect(loadSealed({ ...SCOPE, unitId: OTHER_UNIT_ID }, storage)).toBeNull();
    expect(() =>
      saveSealed({ ...SCOPE, unitId: OTHER_UNIT_ID }, payload, storage),
    ).toThrow(/unit_id del payload no coincide/);
  });

  it("clearSealed elimina el lote por batch_id tras éxito/error de dominio", () => {
    const storage = new StorageMock();
    saveSealed(SCOPE, sealedPayload(), storage);

    clearSealed(BATCH_ID, storage);

    expect(loadSealed(SCOPE, storage)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it("migra y limpia un payload sellado legacy", () => {
    const storage = new StorageMock();
    const payload = sealedPayload();
    saveSealed(SCOPE, payload, storage);
    const [currentKey] = storage.values.keys();
    const legacyKey = currentKey.replace("renova:movimientos", "renova:tire-change");
    storage.values.set(legacyKey, storage.getItem(currentKey));
    storage.values.delete(currentKey);

    expect(loadSealed(SCOPE, storage)).toEqual(payload);
    expect(storage.getItem(legacyKey)).toBeNull();
    expect(storage.getItem(currentKey)).not.toBeNull();
    clearSealed(BATCH_ID, storage);
    expect(storage.length).toBe(0);
  });

  it("prioriza el sellado nuevo y limpia la copia legacy durante el barrido", () => {
    const storage = new StorageMock();
    const payload = sealedPayload();
    saveSealed(SCOPE, payload, storage);
    const [currentKey] = storage.values.keys();
    const legacyKey = currentKey.replace("renova:movimientos", "renova:tire-change");
    storage.values.set(legacyKey, storage.getItem(currentKey));

    expect(loadSealed(SCOPE, storage)).toEqual(payload);
    expect(storage.getItem(legacyKey)).toBeNull();

    storage.values.set(legacyKey, storage.getItem(currentKey));
    clearSealed(BATCH_ID, storage);
    expect(storage.length).toBe(0);
  });
});

describe("batch store · degradación sin localStorage", () => {
  it("mantiene borrador y sellado en memoria cuando storage lanza", () => {
    const storage = new UnavailableStorage();
    const scope = { userId: "fallback-user", unitId: UNIT_ID };
    const draft = editableModel().state;
    const payload = sealedPayload();

    expect(() => saveDraft(scope, draft, storage)).not.toThrow();
    expect(loadDraft(scope, storage)).toEqual(draft);
    expect(() => saveSealed(scope, payload, storage)).not.toThrow();
    expect(loadSealed(scope, storage)).toEqual(payload);

    clearDraft(scope, storage);
    clearSealed(BATCH_ID, storage);
    expect(loadDraft(scope, storage)).toBeNull();
    expect(loadSealed(scope, storage)).toBeNull();
  });

  it("prioriza la versión en memoria si una actualización excede cuota", () => {
    const storage = new FailingMutationStorage();
    const first = editableModel().state;
    saveDraft(SCOPE, first, storage);
    const persistedBeforeQuota = [...storage.values.values()][0];

    const updated = structuredClone(first);
    updated.movements[0].notes = "Versión nueva en memoria";
    storage.failWrites = true;
    saveDraft(SCOPE, updated, storage);

    expect([...storage.values.values()][0]).toBe(persistedBeforeQuota);
    expect(loadDraft(SCOPE, storage)?.movements[0].notes).toBe("Versión nueva en memoria");
  });

  it("no revive un dato persistente si removeItem falla", () => {
    const storage = new FailingMutationStorage();
    saveDraft(SCOPE, editableModel().state, storage);
    storage.failRemoves = true;

    clearDraft(SCOPE, storage);

    expect(storage.values.size).toBe(1);
    expect(loadDraft(SCOPE, storage)).toBeNull();
  });
});
