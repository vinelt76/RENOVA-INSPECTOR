import { describe, expect, it, vi } from "vitest";

import { BATCH_STATUS, createBatchModel } from "../batch-model.js";
import {
  clearSealed,
  loadDraft,
  loadSealed,
  saveDraft,
  saveSealed,
} from "../batch-store.js";
import { loadAvailableInventory, loadUnitPositionState } from "../data.js";
import { project } from "../diagram-projection.js";
import { applyPendingBatch, classifyBatchError } from "../rpc.js";
import { summaryRows, validateSummaryHeader } from "../summary-confirm.js";

// Todos los identificadores y URLs de este archivo son fixtures, no datos de producción.
const UNIT_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "20000000-0000-4000-8000-000000000001";
const COMPANY_ID = "30000000-0000-4000-8000-000000000001";
const BATCH_ID = "40000000-0000-4000-8000-000000000001";
const EDITED_BATCH_ID = "40000000-0000-4000-8000-000000000002";
const POSITION_CYCLES = Array.from(
  { length: 8 },
  (_, index) => `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const INVENTORY_CYCLE = "60000000-0000-4000-8000-000000000001";
const SECOND_INVENTORY_CYCLE = "60000000-0000-4000-8000-000000000002";
const PHOTO_PLACEHOLDER = "https://fixtures.invalid/tire-change/discard-p2.jpg";
const SCOPE = { userId: USER_ID, companyId: COMPANY_ID, unitId: UNIT_ID };

function positionRows(count = 6, { empty = [], mismatch = [] } = {}) {
  const emptyPositions = new Set(empty);
  const mismatchPositions = new Set(mismatch);
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    const isEmpty = emptyPositions.has(position);
    return {
      company_id: COMPANY_ID,
      unit_id: UNIT_ID,
      position_number: position,
      is_empty: isEmpty,
      life_cycle_id: isEmpty ? null : POSITION_CYCLES[index],
      casing_code: isEmpty ? null : `FIX-P${position}`,
      installed_at: isEmpty ? null : "2026-07-01",
      rtd_at_install_mm: isEmpty ? null : "18.5",
      last_rtd_movi_mm: isEmpty ? null : "12.25",
      last_pressure_psi: isEmpty ? null : "100",
      code_mismatch: mismatchPositions.has(position),
    };
  });
}

function inventoryItem(lifeCycleId = INVENTORY_CYCLE) {
  return {
    company_id: COMPANY_ID,
    life_cycle_id: lifeCycleId,
    casing_code: "FIX-INV-01",
    otd_mm: "18.75",
    last_rtd_mm: "14.5",
    last_removed_at: "2026-07-10",
    days_in_inventory: 4,
  };
}

function createMixedBatch(remoteState) {
  const batch = createBatchModel({ unitId: UNIT_ID, remoteState });
  batch.addSendToRetention(remoteState[0], { rtd_mm: 10.5, notes: "A retén" });
  batch.addDiscard(remoteState[1], {
    rtd_mm: 2,
    discard_cause: "Neumático",
    photo_url: PHOTO_PLACEHOLDER,
    notes: "Corte de fixture",
  });
  batch.addMount(3, inventoryItem(), {
    rtd_mm: 16.8,
    notes: "Montaje desde inventario",
  });
  batch.addSwap(remoteState[3], remoteState[4], {
    rtd_mm_a: 12.1,
    rtd_mm_b: 12.3,
    notes: "Intercambio preventivo",
  });
  return batch;
}

function seal(batch, batchId = BATCH_ID) {
  return batch.seal(
    {
      performedAt: "2026-07-14",
      odometer: 210000,
      notes: "Lote integral de fixture",
    },
    () => batchId,
  );
}

function supabaseError(code, message) {
  return { code, message, details: null, hint: null };
}

function rpcClient(...responses) {
  return {
    rpc: vi.fn().mockImplementation(() => {
      const response = responses.shift();
      if (response instanceof Error || response?.throw) {
        return Promise.reject(response?.throw ?? response);
      }
      return Promise.resolve(response);
    }),
  };
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
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
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

const RPC_ERROR_CASES = [
  [
    "estado desactualizado",
    supabaseError("40001", "[estado_desactualizado] P1 cambió."),
    "stale_state",
  ],
  [
    "ciclo no disponible",
    supabaseError("22023", "[no_disponible] El ciclo ya no está disponible."),
    "unavailable_cycle",
  ],
  [
    "posición ocupada",
    supabaseError("23505", "[posicion_ocupada] P3 ya está ocupada."),
    "occupied_position",
  ],
  [
    "sin permiso",
    supabaseError("42501", "[sin_permiso] El rol no está autorizado."),
    "forbidden",
  ],
  [
    "lote inválido",
    supabaseError("22023", "[lote_invalido] Versión incorrecta."),
    "invalid_batch",
  ],
  [
    "fecha anterior a instalación",
    supabaseError(
      "P0001",
      "La fecha de retiro no puede ser anterior a la fecha de instalación.",
    ),
    "unknown",
  ],
  ["error desconocido", supabaseError("XX000", "Fallo de dominio no reconocido."), "unknown"],
];

describe("integración · carga y proyección de configuraciones", () => {
  it.each([
    ["unidad de 6 posiciones", 6, []],
    ["unidad de 8 posiciones", 8, []],
    ["unidad de 6 con una posición vacía", 6, [3]],
  ])("conserva %s sin inventar posiciones", async (_, count, empty) => {
    const source = positionRows(count, { empty });
    const fetchView = vi.fn().mockResolvedValue(source);

    const loaded = await loadUnitPositionState(UNIT_ID, fetchView);
    const projection = project(loaded, { movements: [] }, empty[0] ?? null);

    expect(loaded).toHaveLength(count);
    expect([...projection.keys()]).toEqual(
      Array.from({ length: count }, (__, index) => index + 1),
    );
    expect(loaded[0].rtd_at_install_mm).toBe(18.5);
    if (empty.length) {
      expect(loaded[empty[0] - 1]).toMatchObject({ is_empty: true, life_cycle_id: null });
      expect(projection.get(empty[0])).toMatchObject({
        occupancy: "empty",
        label: "VACÍA",
        flags: { selected: true },
      });
    }
  });

  it.each(["0 filas", "unidad no autorizada", "configuración sin posiciones"])(
    "degrada %s al mismo estado vacío verificable",
    async () => {
      const loaded = await loadUnitPositionState(UNIT_ID, vi.fn().mockResolvedValue([]));

      expect(loaded).toEqual([]);
      expect(project(loaded).size).toBe(0);
    },
  );
});

describe("integración · movimientos, invariantes y diagrama", () => {
  it("proyecta retén y descarte con causa y URL placeholder", () => {
    const remoteState = positionRows(6, { empty: [3] });
    const batch = createBatchModel({ unitId: UNIT_ID, remoteState });

    expect(batch.addSendToRetention(remoteState[0], { rtd_mm: 10.5 }).ok).toBe(true);
    expect(
      batch.addDiscard(remoteState[1], {
        discard_cause: "Neumático",
        photo_url: PHOTO_PLACEHOLDER,
      }).ok,
    ).toBe(true);

    expect(batch.movements[1]).toMatchObject({
      discard_cause: "Neumático",
      photo_url: PHOTO_PLACEHOLDER,
    });
    expect(project(remoteState, batch.state).get(1)).toMatchObject({
      occupancy: "empty",
      label: "A RETÉN",
    });
    expect(project(remoteState, batch.state).get(2)).toMatchObject({
      occupancy: "empty",
      label: "DESCARTE",
    });
  });

  it("monta sobre una vacía y reemplaza en una ocupada liberada en el lote", () => {
    const remoteState = positionRows(6, { empty: [3] });
    const mountOnEmpty = createBatchModel({ unitId: UNIT_ID, remoteState });
    expect(mountOnEmpty.addMount(3, inventoryItem()).ok).toBe(true);
    expect(project(remoteState, mountOnEmpty.state).get(3)).toMatchObject({
      occupancy: "occupied",
      role: "destination",
      label: "MONTAR",
    });

    const replacement = createBatchModel({ unitId: UNIT_ID, remoteState });
    expect(replacement.addSendToRetention(remoteState[0]).ok).toBe(true);
    expect(replacement.addMount(1, inventoryItem(SECOND_INVENTORY_CYCLE)).ok).toBe(true);
    expect(replacement.validate()).toEqual([]);
    expect(project(remoteState, replacement.state).get(1)).toMatchObject({
      occupancy: "occupied",
      role: "destination",
      flags: { retention: true, mount: true, conflict: false },
    });
  });

  it("acepta un swap válido y rechaza selecciones vacías, iguales o duplicadas", () => {
    const remoteState = positionRows(6, { empty: [3, 6] });
    const batch = createBatchModel({ unitId: UNIT_ID, remoteState });

    expect(batch.addSwap(remoteState[3], remoteState[4]).ok).toBe(true);
    const projected = project(remoteState, batch.state);
    expect(projected.get(4)).toMatchObject({ role: "swapA", label: "SWAP A" });
    expect(projected.get(5)).toMatchObject({ role: "swapB", label: "SWAP B" });

    const samePosition = createBatchModel({ unitId: UNIT_ID, remoteState }).addSwap(
      remoteState[0],
      remoteState[0],
    );
    const emptySelection = createBatchModel({ unitId: UNIT_ID, remoteState }).addSwap(
      remoteState[0],
      remoteState[2],
    );
    const duplicatePosition = batch.addSendToRetention(remoteState[3]);
    const duplicateCycleBatch = createBatchModel({ unitId: UNIT_ID, remoteState });
    duplicateCycleBatch.addMount(3, inventoryItem());
    const duplicateCycle = duplicateCycleBatch.addMount(6, inventoryItem());

    expect(samePosition.violations.map(({ code }) => code)).toContain("same_swap_position");
    expect(emptySelection.violations.map(({ code }) => code)).toContain(
      "source_position_empty",
    );
    expect(duplicatePosition.violations.map(({ code }) => code)).toContain(
      "duplicate_origin",
    );
    expect(duplicateCycle.violations.map(({ code }) => code)).toContain(
      "duplicate_mount_cycle",
    );
    expect(batch.movements).toHaveLength(1);
  });

  it("mantiene code_mismatch como advertencia no bloqueante", () => {
    const remoteState = positionRows(6, { mismatch: [2] });
    const before = project(remoteState).get(2);
    const batch = createBatchModel({ unitId: UNIT_ID, remoteState });

    expect(before).toMatchObject({ label: "REVISAR IDENTIDAD", flags: { mismatch: true } });
    expect(batch.addSendToRetention(remoteState[1]).ok).toBe(true);
    expect(project(remoteState, batch.state).get(2)).toMatchObject({
      label: "A RETÉN",
      flags: { mismatch: true, retention: true, conflict: false },
    });
  });
});

describe("integración · lote mixto, persistencia y RPC", () => {
  it("recorre carga → cuatro operaciones → payload v1 exacto → RPC → limpieza", async () => {
    const storage = new MemoryStorage();
    const source = positionRows(6, { empty: [3] });
    const remoteState = await loadUnitPositionState(
      UNIT_ID,
      vi.fn().mockResolvedValue(source),
    );
    const batch = createMixedBatch(remoteState);

    expect(batch.validate()).toEqual([]);
    expect(batch.movements.map(({ op }) => op)).toEqual([
      "send_to_retention",
      "discard",
      "mount",
      "swap",
    ]);
    expect([...project(remoteState, batch.state).values()].map(({ label }) => label)).toEqual([
      "A RETÉN",
      "DESCARTE",
      "MONTAR",
      "SWAP A",
      "SWAP B",
      "OCUPADA",
    ]);

    saveDraft(SCOPE, batch.state, storage);
    expect(loadDraft(SCOPE, storage)?.movements).toEqual(batch.movements);

    const header = validateSummaryHeader({
      performedAt: "2026-07-14",
      odometer: "210000",
      notes: "Lote integral de fixture",
    });
    expect(header).toMatchObject({ valid: true, value: { odometer: 210000 } });
    const payload = batch.seal(header.value, () => BATCH_ID);

    const expectedPayload = {
      batch_version: 1,
      batch_id: BATCH_ID,
      unit_id: UNIT_ID,
      performed_at: "2026-07-14",
      odometer: 210000,
      notes: "Lote integral de fixture",
      movements: [
        {
          seq: 1,
          op: "send_to_retention",
          position: 1,
          expected_life_cycle_id: POSITION_CYCLES[0],
          rtd_mm: 10.5,
          notes: "A retén",
        },
        {
          seq: 2,
          op: "discard",
          position: 2,
          expected_life_cycle_id: POSITION_CYCLES[1],
          rtd_mm: 2,
          discard_cause: "Neumático",
          photo_url: PHOTO_PLACEHOLDER,
          notes: "Corte de fixture",
        },
        {
          seq: 3,
          op: "mount",
          position: 3,
          life_cycle_id: INVENTORY_CYCLE,
          rtd_mm: 16.8,
          notes: "Montaje desde inventario",
        },
        {
          seq: 4,
          op: "swap",
          position_a: 4,
          expected_life_cycle_id_a: POSITION_CYCLES[3],
          position_b: 5,
          expected_life_cycle_id_b: POSITION_CYCLES[4],
          rtd_mm_a: 12.1,
          rtd_mm_b: 12.3,
          notes: "Intercambio preventivo",
        },
      ],
    };
    expect(payload).toEqual(expectedPayload);
    expect(JSON.stringify(payload)).toBe(JSON.stringify(expectedPayload));
    expect(summaryRows(payload).map(({ seq, movement }) => [seq, movement.op])).toEqual([
      [1, "send_to_retention"],
      [2, "discard"],
      [3, "mount"],
      [4, "swap"],
    ]);

    saveSealed(SCOPE, payload, storage);
    const pending = loadSealed(SCOPE, storage);
    const result = { applied: true, batch_id: BATCH_ID, unit_id: UNIT_ID };
    const client = rpcClient({ data: result, error: null });

    await expect(
      applyPendingBatch(pending, {
        client,
        onClearSealed: (batchId) => clearSealed(batchId, storage),
      }),
    ).resolves.toEqual(result);
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith("confirm_tire_change_batch", {
      p_batch: pending,
    });
    expect(loadSealed(SCOPE, storage)).toBeNull();
  });

  it("clasifica [no_disponible] si el ciclo elegido desaparece del inventario", async () => {
    const storage = new MemoryStorage();
    const remoteState = positionRows(6, { empty: [3] });
    let available = true;
    const fetchView = vi.fn().mockImplementation(async () =>
      available ? [inventoryItem()] : [],
    );
    const inventory = await loadAvailableInventory(fetchView);
    const batch = createBatchModel({ unitId: UNIT_ID, remoteState });
    expect(batch.addMount(3, inventory[0]).ok).toBe(true);

    available = false;
    expect(await loadAvailableInventory(fetchView)).toEqual([]);

    const payload = seal(batch);
    saveSealed(SCOPE, payload, storage);
    const error = supabaseError(
      "22023",
      `[no_disponible] El ciclo ${INVENTORY_CYCLE} ya no está disponible.`,
    );
    const client = rpcClient({ data: null, error });

    await expect(
      applyPendingBatch(loadSealed(SCOPE, storage), {
        client,
        logger: { error: vi.fn() },
        onClearSealed: (batchId) => clearSealed(batchId, storage),
      }),
    ).rejects.toBe(error);
    expect(classifyBatchError(error)).toBe("unavailable_cycle");
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(loadSealed(SCOPE, storage)).toBeNull();
  });

  it("reintenta un timeout posterior al envío con el mismo payload y batch_id", async () => {
    const storage = new MemoryStorage();
    const remoteState = positionRows(6, { empty: [3] });
    const payload = seal(createMixedBatch(remoteState));
    saveSealed(SCOPE, payload, storage);
    const pending = loadSealed(SCOPE, storage);
    const timeout = Object.assign(new Error("request timed out after send"), {
      code: "ETIMEDOUT",
    });
    const success = {
      applied: true,
      already_applied: true,
      batch_id: BATCH_ID,
      unit_id: UNIT_ID,
    };
    const client = rpcClient({ throw: timeout }, { data: success, error: null });

    await expect(
      applyPendingBatch(pending, {
        client,
        logger: { error: vi.fn() },
        onClearSealed: (batchId) => clearSealed(batchId, storage),
      }),
    ).resolves.toEqual(success);
    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(client.rpc.mock.calls[0][1].p_batch).toBe(pending);
    expect(client.rpc.mock.calls[1][1].p_batch).toBe(pending);
    expect(client.rpc.mock.calls[1][1].p_batch.batch_id).toBe(BATCH_ID);
    expect(loadSealed(SCOPE, storage)).toBeNull();
  });
});

describe("integración · recarga y edición posterior al sellado", () => {
  it("reanuda un borrador editable y un payload sellado pendiente", () => {
    const storage = new MemoryStorage();
    const remoteState = positionRows(6, { empty: [3] });
    const original = createBatchModel({ unitId: UNIT_ID, remoteState });
    original.addSendToRetention(remoteState[0], { notes: "Antes de recargar" });
    saveDraft(SCOPE, original.state, storage);

    const restoredDraft = loadDraft(SCOPE, storage);
    const reloaded = createBatchModel({
      unitId: UNIT_ID,
      remoteState,
      movements: restoredDraft.movements,
    });
    expect(reloaded.status).toBe(BATCH_STATUS.EDITING);
    expect(reloaded.editMovement(0, { notes: "Editado tras recarga" }).ok).toBe(true);

    const payload = seal(reloaded);
    saveSealed(SCOPE, payload, storage);
    const restoredSealed = loadSealed(SCOPE, storage);
    expect(restoredSealed).toEqual(payload);
    expect(Object.isFrozen(restoredSealed)).toBe(true);
    expect(Object.isFrozen(restoredSealed.movements[0])).toBe(true);
  });

  it("genera un batch_id nuevo cuando se edita después de sellar", () => {
    const remoteState = positionRows(6, { empty: [3] });
    const batch = createBatchModel({ unitId: UNIT_ID, remoteState });
    batch.addSendToRetention(remoteState[0]);

    const first = seal(batch, BATCH_ID);
    expect(batch.editAfterSeal().ok).toBe(true);
    expect(batch.editMovement(0, { notes: "Movimiento corregido" }).ok).toBe(true);
    const edited = seal(batch, EDITED_BATCH_ID);

    expect(first.batch_id).toBe(BATCH_ID);
    expect(edited.batch_id).toBe(EDITED_BATCH_ID);
    expect(edited.batch_id).not.toBe(first.batch_id);
    expect(edited.movements[0].notes).toBe("Movimiento corregido");
  });
});

describe("integración · matriz completa de errores RPC", () => {
  it.each(RPC_ERROR_CASES)("clasifica %s como %s", (_, error, expected) => {
    expect(classifyBatchError(error)).toBe(expected);
  });

  it.each(RPC_ERROR_CASES)(
    "aplica la transición segura para %s",
    async (_, error, classification) => {
      const remoteState = positionRows(6, { empty: [3] });
      const payload = seal(createMixedBatch(remoteState));
      const client = rpcClient({ data: null, error });
      const onClearSealed = vi.fn();
      const onDiscardDraft = vi.fn();
      const onReload = vi.fn();
      const operation = applyPendingBatch(payload, {
        client,
        logger: { error: vi.fn() },
        onClearSealed,
        onDiscardDraft,
        onReload,
      });

      if (classification === "stale_state") {
        await expect(operation).resolves.toBeNull();
        expect(onDiscardDraft).toHaveBeenCalledWith({ unitId: UNIT_ID, error });
        expect(onReload).toHaveBeenCalledWith({
          reason: "stale_state",
          unitId: UNIT_ID,
          error,
        });
      } else {
        await expect(operation).rejects.toBe(error);
        expect(onDiscardDraft).not.toHaveBeenCalled();
        expect(onReload).not.toHaveBeenCalled();
      }

      expect(client.rpc).toHaveBeenCalledOnce();
      expect(onClearSealed).toHaveBeenCalledWith(BATCH_ID);
    },
  );
});
