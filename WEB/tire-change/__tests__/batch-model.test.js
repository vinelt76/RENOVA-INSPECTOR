import { describe, expect, it, vi } from "vitest";

import {
  BATCH_STATUS,
  BatchValidationError,
  createBatchModel,
} from "../batch-model.js";

const UNIT_ID = "0ccc3098-d4c5-4a1f-b2cf-09b384c0d500";
const BATCH_ID = "9d0515b6-98d6-4b14-8b09-aadee10f816b";
const BATCH_ID_2 = "7a472609-ebf8-4a91-a037-0ab07535e87f";

const CYCLES = {
  p1: "ec82031c-ba0f-48be-a21b-975338cb5e56",
  p2: "031b9de6-aa7e-41de-bcfb-8db52beac003",
  inventory: "aef720a6-f634-478f-898c-ac8dab652f46",
  p4: "45ec521c-f459-4289-a2a8-6b1cf038b138",
  p5: "b94d9621-eddf-4071-bac1-9408be2353e7",
  inventory2: "08fa12e4-9c5c-4c16-ac3a-33e984186693",
};

const REMOTE_STATE = [
  row(1, CYCLES.p1),
  row(2, CYCLES.p2),
  row(3, null),
  row(4, CYCLES.p4),
  row(5, CYCLES.p5),
  row(6, null),
];

function row(position, lifeCycleId, extra = {}) {
  return {
    unit_id: UNIT_ID,
    position_number: position,
    is_empty: lifeCycleId === null,
    life_cycle_id: lifeCycleId,
    code_mismatch: false,
    ...extra,
  };
}

function model(remoteState = REMOTE_STATE) {
  return createBatchModel({ unitId: UNIT_ID, remoteState });
}

function expectCode(result, code) {
  expect(result.ok).toBe(false);
  expect(result.violations.map((item) => item.code)).toContain(code);
}

describe("batch model · state machine", () => {
  it("moves EMPTY → EDITING → SEALED → APPLIED", () => {
    const batch = model();
    expect(batch.status).toBe(BATCH_STATUS.EMPTY);

    expect(batch.addSendToRetention(REMOTE_STATE[0]).ok).toBe(true);
    expect(batch.status).toBe(BATCH_STATUS.EDITING);

    batch.seal({ performedAt: "2026-07-13" }, () => BATCH_ID);
    expect(batch.status).toBe(BATCH_STATUS.SEALED);

    expect(batch.markApplied({ applied: true }).ok).toBe(true);
    expect(batch.status).toBe(BATCH_STATUS.APPLIED);
    expect(batch.appliedResult).toEqual({ applied: true });
  });

  it("removes and edits movements while editing", () => {
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0], { notes: "Inicial" });

    expect(batch.editMovement(0, { notes: "Corregida", rtd_mm: 9.4 })).toMatchObject({
      ok: true,
      movement: { notes: "Corregida", rtd_mm: 9.4 },
    });
    expect(batch.removeMovement(0).ok).toBe(true);
    expect(batch.status).toBe(BATCH_STATUS.EMPTY);
    expect(batch.movements).toEqual([]);
  });

  it("does not expose a mutable movements array", () => {
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0]);
    const exposed = batch.movements;
    exposed[0].position = 99;
    exposed.push({ op: "mount" });

    expect(batch.movements).toHaveLength(1);
    expect(batch.movements[0].position).toBe(1);
  });
});

describe("batch model · movement construction", () => {
  it("copies expected_life_cycle_id from the viewed position", () => {
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0]);
    batch.addDiscard(REMOTE_STATE[1], {
      discard_cause: "Neumático",
      photo_url: "https://example.com/descarte.jpg",
    });
    batch.addSwap(REMOTE_STATE[3], REMOTE_STATE[4]);

    expect(batch.movements).toMatchObject([
      { expected_life_cycle_id: CYCLES.p1 },
      { expected_life_cycle_id: CYCLES.p2 },
      {
        expected_life_cycle_id_a: CYCLES.p4,
        expected_life_cycle_id_b: CYCLES.p5,
      },
    ]);
  });

  it("accepts mount on an already empty position", () => {
    const result = model().addMount(3, { life_cycle_id: CYCLES.inventory });
    expect(result).toMatchObject({ ok: true, movement: { op: "mount", position: 3 } });
  });

  it("accepts the single-object overloads used by form adapters", () => {
    const batch = model();
    expect(
      batch.addMount({ position: 3, life_cycle_id: CYCLES.inventory, rtd_mm: 16.8 }),
    ).toMatchObject({ ok: true });
    expect(
      batch.addSwap({
        position_a: 4,
        life_cycle_id_a: CYCLES.p4,
        position_b: 5,
        life_cycle_id_b: CYCLES.p5,
      }),
    ).toMatchObject({ ok: true });
  });
});

describe("batch model · invariants", () => {
  it.each([
    ["send_to_retention", (batch) => batch.addSendToRetention(REMOTE_STATE[2])],
    [
      "discard",
      (batch) =>
        batch.addDiscard(REMOTE_STATE[2], {
          discard_cause: "Otro",
          photo_url: "https://example.com/p3.jpg",
        }),
    ],
  ])("does not allow %s from an empty position", (_, operation) => {
    const batch = model();
    expectCode(operation(batch), "source_position_empty");
    expect(batch.movements).toEqual([]);
  });

  it("does not allow swap when either source is empty", () => {
    const batch = model();
    expectCode(batch.addSwap(REMOTE_STATE[0], REMOTE_STATE[2]), "source_position_empty");
    expect(batch.movements).toEqual([]);
  });

  it("requires different swap positions", () => {
    expectCode(model().addSwap(REMOTE_STATE[0], REMOTE_STATE[0]), "same_swap_position");
  });

  it("allows removing P1 and mounting another cycle on P1", () => {
    const batch = model();
    expect(batch.addSendToRetention(REMOTE_STATE[0]).ok).toBe(true);
    expect(batch.addMount(1, { life_cycle_id: CYCLES.inventory }).ok).toBe(true);
    expect(batch.validate()).toEqual([]);
  });

  it("rejects mount on an occupied position that will not be freed", () => {
    expectCode(
      model().addMount(1, { life_cycle_id: CYCLES.inventory }),
      "mount_position_not_free",
    );
  });

  it("uses an inventory cycle in at most one mount", () => {
    const batch = model();
    expect(batch.addMount(3, { life_cycle_id: CYCLES.inventory }).ok).toBe(true);
    expectCode(
      batch.addMount(6, { life_cycle_id: CYCLES.inventory }),
      "duplicate_mount_cycle",
    );
    expect(batch.movements).toHaveLength(1);
  });

  it("allows each position at most once as origin", () => {
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0]);
    expectCode(
      batch.addDiscard(REMOTE_STATE[0], {
        discard_cause: "Otro",
        photo_url: "https://example.com/p1.jpg",
      }),
      "duplicate_origin",
    );
  });

  it("allows each position at most once as destination", () => {
    const batch = model();
    batch.addMount(3, { life_cycle_id: CYCLES.inventory });
    expectCode(
      batch.addMount(3, { life_cycle_id: CYCLES.inventory2 }),
      "duplicate_destination",
    );
  });

  it("counts both swap positions as one origin and one destination", () => {
    const batch = model();
    expect(batch.addSwap(REMOTE_STATE[3], REMOTE_STATE[4]).ok).toBe(true);
    expectCode(batch.addSendToRetention(REMOTE_STATE[3]), "duplicate_origin");
    expectCode(
      batch.addMount(4, { life_cycle_id: CYCLES.inventory }),
      "duplicate_destination",
    );
  });

  it("never omits the expected cycle for a removal", () => {
    const withoutCycle = row(1, CYCLES.p1);
    delete withoutCycle.life_cycle_id;
    expectCode(model().addSendToRetention(withoutCycle), "missing_expected_cycle");
  });

  it("detects an expected cycle that differs from the snapshot", () => {
    const wrong = { ...REMOTE_STATE[0], life_cycle_id: CYCLES.p2 };
    expectCode(model().addSendToRetention(wrong), "expected_cycle_mismatch");
  });

  it("does not block operations because of code_mismatch", () => {
    const mismatchState = [row(1, CYCLES.p1, { code_mismatch: true })];
    const batch = model(mismatchState);
    expect(batch.addSendToRetention(mismatchState[0]).ok).toBe(true);
    expect(batch.validate()).toEqual([]);
  });

  it("requires exact discard cause and a non-empty photo_url", () => {
    expectCode(
      model().addDiscard(REMOTE_STATE[0], {
        discard_cause: "Desgaste",
        photo_url: " ",
      }),
      "invalid_discard_cause",
    );
    expectCode(
      model().addDiscard(REMOTE_STATE[0], {
        discard_cause: "Otro",
        photo_url: " ",
      }),
      "missing_photo_url",
    );
  });
});

describe("batch model · payload v1 and immutable sealing", () => {
  function completeBatch() {
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0], { rtd_mm: 10.5, notes: "A retén" });
    batch.addDiscard(REMOTE_STATE[1], {
      rtd_mm: 2.0,
      discard_cause: "Neumático",
      photo_url: "https://example.com/descarte.jpg",
      notes: "Corte profundo",
    });
    batch.addMount(3, { life_cycle_id: CYCLES.inventory }, {
      rtd_mm: 16.8,
      notes: "Montaje desde retén",
    });
    batch.addSwap(REMOTE_STATE[3], REMOTE_STATE[4], {
      rtd_mm_a: 12.1,
      rtd_mm_b: 12.3,
      notes: "Intercambio preventivo",
    });
    return batch;
  }

  it("builds the canonical payload v1 exactly and assigns seq 1..n", () => {
    const batch = completeBatch();
    const payload = batch.seal(
      {
        performedAt: "2026-07-13",
        odometer: 210000,
        notes: "Cambio general del turno",
      },
      () => BATCH_ID,
    );

    const expectedPayload = {
      batch_version: 1,
      batch_id: BATCH_ID,
      unit_id: UNIT_ID,
      performed_at: "2026-07-13",
      odometer: 210000,
      notes: "Cambio general del turno",
      movements: [
        {
          seq: 1,
          op: "send_to_retention",
          position: 1,
          expected_life_cycle_id: CYCLES.p1,
          rtd_mm: 10.5,
          notes: "A retén",
        },
        {
          seq: 2,
          op: "discard",
          position: 2,
          expected_life_cycle_id: CYCLES.p2,
          rtd_mm: 2.0,
          discard_cause: "Neumático",
          photo_url: "https://example.com/descarte.jpg",
          notes: "Corte profundo",
        },
        {
          seq: 3,
          op: "mount",
          position: 3,
          life_cycle_id: CYCLES.inventory,
          rtd_mm: 16.8,
          notes: "Montaje desde retén",
        },
        {
          seq: 4,
          op: "swap",
          position_a: 4,
          expected_life_cycle_id_a: CYCLES.p4,
          position_b: 5,
          expected_life_cycle_id_b: CYCLES.p5,
          rtd_mm_a: 12.1,
          rtd_mm_b: 12.3,
          notes: "Intercambio preventivo",
        },
      ],
    };
    expect(payload).toEqual(expectedPayload);
    expect(JSON.stringify(payload)).toBe(JSON.stringify(expectedPayload));
    expect(payload).not.toHaveProperty("company_id");
    expect(typeof payload.batch_version).toBe("number");
    expect(typeof payload.odometer).toBe("number");
  });

  it("deep-freezes a sealed payload", () => {
    const payload = completeBatch().seal({ performedAt: "2026-07-13" }, () => BATCH_ID);

    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.movements)).toBe(true);
    expect(Object.isFrozen(payload.movements[0])).toBe(true);
    expect(() => {
      payload.movements[0].position = 99;
    }).toThrow(TypeError);
    expect(payload.movements[0].position).toBe(1);
  });

  it("generates no UUID before seal and reuses the same payload on repeated seal", () => {
    const uuidFn = vi.fn(() => BATCH_ID);
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0]);
    expect(uuidFn).not.toHaveBeenCalled();

    const first = batch.seal({ performedAt: "2026-07-13" }, uuidFn);
    const retry = batch.seal({ performedAt: "2030-01-01", odometer: 1 }, uuidFn);

    expect(uuidFn).toHaveBeenCalledTimes(1);
    expect(retry).toBe(first);
    expect(retry.performed_at).toBe("2026-07-13");
  });

  it("rejects seal with pending violations before invoking uuidFn", () => {
    const uuidFn = vi.fn(() => BATCH_ID);
    const batch = model();

    expect(() => batch.seal({ performedAt: "2026-07-13" }, uuidFn)).toThrow(
      BatchValidationError,
    );
    expect(uuidFn).not.toHaveBeenCalled();
  });

  it("rejects invalid header values before invoking uuidFn", () => {
    const uuidFn = vi.fn(() => BATCH_ID);
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0]);

    expect(() =>
      batch.seal({ performedAt: "2026-02-30", odometer: "210000" }, uuidFn),
    ).toThrow(BatchValidationError);
    expect(uuidFn).not.toHaveBeenCalled();
  });

  it("requires editAfterSeal and generates a new batch_id after editing", () => {
    const uuidFn = vi.fn().mockReturnValueOnce(BATCH_ID).mockReturnValueOnce(BATCH_ID_2);
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0]);
    const first = batch.seal({ performedAt: "2026-07-13" }, uuidFn);

    expectCode(batch.editMovement(0, { notes: "Nueva" }), "batch_sealed");
    expect(batch.editAfterSeal().ok).toBe(true);
    expect(batch.editMovement(0, { notes: "Nueva" }).ok).toBe(true);
    const second = batch.seal({ performedAt: "2026-07-13" }, uuidFn);

    expect(first.batch_id).toBe(BATCH_ID);
    expect(second.batch_id).toBe(BATCH_ID_2);
    expect(second).not.toBe(first);
    expect(uuidFn).toHaveBeenCalledTimes(2);
  });

  it("never allows a previous batch_id to be recycled", () => {
    const batch = model();
    batch.addSendToRetention(REMOTE_STATE[0]);
    batch.seal({ performedAt: "2026-07-13" }, () => BATCH_ID);
    batch.editAfterSeal();
    batch.editMovement(0, { notes: "Nueva" });

    expect(() => batch.seal({ performedAt: "2026-07-13" }, () => BATCH_ID)).toThrow(
      BatchValidationError,
    );
  });
});
