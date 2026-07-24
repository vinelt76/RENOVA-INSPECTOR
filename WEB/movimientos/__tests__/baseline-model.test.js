import { describe, expect, it } from "vitest";

import { BaselineValidationError, createBaselineModel } from "../baseline-model.js";

const UNIT_ID = "0ccc3098-d4c5-4a1f-b2cf-09b384c0d500";
const MEASUREMENT_1 = "30000000-0000-4000-8000-000000000003";
const MEASUREMENT_2 = "30000000-0000-4000-8000-000000000004";

function evidence(overrides = {}) {
  return {
    last_inspection_tire_code: "INS-003",
    last_inspected_on: "2026-07-10",
    last_measurement_id: MEASUREMENT_1,
    last_brand_name: "Michelin",
    last_model_name: "X Multi",
    last_size_name: "295/80R22.5",
    last_condition: "R1",
    last_retread_design: "Mixto",
    last_rtd_movi_mm: 14.2,
    last_odometer_km: 98765,
    ...overrides,
  };
}

describe("baseline-model", () => {
  it("precarga todos los campos editables desde la proyección", () => {
    const model = createBaselineModel({ unitId: UNIT_ID, today: "2026-07-14" });
    model.addFromProjection(3, evidence());

    expect(model.state).toEqual({
      unit_id: UNIT_ID,
      performed_at: "2026-07-14",
      odometer: 98765,
      mounts: [{
        seq: 1,
        position: 3,
        source_measurement_id: MEASUREMENT_1,
        source_inspected_on: "2026-07-10",
        casing_code: "INS-003",
        life_cycle_id: null,
        brand_name: "Michelin",
        model_name: "X Multi",
        size_name: "295/80R22.5",
        condition: "R1",
        retread_design: "Mixto",
        otd_mm: null,
        rtd_mm: 14.2,
        notes: null,
      }],
    });
  });

  it("exige XOR entre código nuevo y ciclo existente", () => {
    const model = createBaselineModel({ unitId: UNIT_ID });
    model.addFromProjection(3, evidence({ last_inspection_tire_code: null }));
    expect(model.validate()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "identity_xor", position: 3 }),
    ]));

    model.updateMount(3, { casing_code: "CAS-3" });
    model.updateMount(3, { life_cycle_id: "aef720a6-f634-478f-898c-ac8dab652f46" });
    expect(model.state.mounts[0]).toMatchObject({ casing_code: null });
    expect(model.validate().map(({ code }) => code)).not.toContain("identity_xor");
  });

  it("no duplica una posición ni reemplaza su evidencia al volver a agregarla", () => {
    const model = createBaselineModel({ unitId: UNIT_ID });
    const first = model.addFromProjection(3, evidence());
    const repeated = model.addFromProjection(3, evidence({
      last_measurement_id: MEASUREMENT_2,
      last_inspection_tire_code: "OTRO-CODIGO",
    }));

    expect(first).toMatchObject({ added: true, mount: { seq: 1 } });
    expect(repeated).toMatchObject({ added: false, mount: {
      source_measurement_id: MEASUREMENT_1,
      casing_code: "INS-003",
    } });
    expect(model.mounts).toHaveLength(1);
  });

  it("rechaza R1 sin diseño de reencauche", () => {
    const model = createBaselineModel({ unitId: UNIT_ID });
    model.addFromProjection(3, evidence({ last_retread_design: null }));
    expect(model.validate()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "retread_design_required", position: 3 }),
    ]));
  });

  it("sella un payload inmutable con N posiciones", () => {
    const model = createBaselineModel({
      unitId: UNIT_ID,
      today: "2026-07-14",
      uuidFn: () => "11111111-1111-4111-8111-111111111111",
    });
    model.addFromProjection(3, evidence());
    model.updateMount(3, { otd_mm: "18.7" });
    model.addFromProjection(4, evidence({
      last_measurement_id: MEASUREMENT_2,
      last_inspection_tire_code: "INS-004",
    }));
    model.updateMount(4, { otd_mm: "19.1" });

    const payload = model.seal();
    expect(payload).toMatchObject({
      batch_version: 1,
      batch_id: "11111111-1111-4111-8111-111111111111",
      unit_id: UNIT_ID,
      performed_at: "2026-07-14",
      odometer: 98765,
    });
    expect(payload.mounts.map(({ seq, position }) => ({ seq, position }))).toEqual([
      { seq: 1, position: 3 },
      { seq: 2, position: 4 },
    ]);
    expect(payload.mounts[0].otd_mm).toBe(18.7);
    expect(payload.mounts[1].otd_mm).toBe(19.1);
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.mounts)).toBe(true);
    expect(Object.isFrozen(payload.mounts[0])).toBe(true);
  });

  it("editar después de sellar descarta el sello y genera otro batch_id", () => {
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ];
    const model = createBaselineModel({ unitId: UNIT_ID, uuidFn: () => ids.shift() });
    model.addFromProjection(3, evidence());
    model.updateMount(3, { otd_mm: 18.7 });
    const first = model.seal();
    expect(model.seal()).toBe(first);

    model.updateMount(3, { rtd_mm: 13.9 });
    expect(model.sealed).toBeNull();
    const second = model.seal();
    expect(second.batch_id).not.toBe(first.batch_id);
    expect(second.mounts[0].rtd_mm).toBe(13.9);
  });

  it("expone todas las infracciones juntas al intentar sellar", () => {
    const model = createBaselineModel({ unitId: UNIT_ID });
    model.addFromProjection(3, evidence({
      last_inspection_tire_code: null,
      last_condition: "R1",
      last_retread_design: null,
    }));
    expect(() => model.seal()).toThrow(BaselineValidationError);
    try {
      model.seal();
    } catch (error) {
      expect(error.violations.map(({ code }) => code)).toEqual(expect.arrayContaining([
        "identity_xor",
        "retread_design_required",
      ]));
    }
  });

  it("valida evidencia, condición y odómetro inválidos sin alterar el borrador", () => {
    const model = createBaselineModel({ unitId: UNIT_ID });
    model.addFromProjection(3, evidence({
      last_measurement_id: null,
      last_condition: "R9",
    }));
    model.updateHeader({ odometer: "12.5" });

    expect(model.validate().map(({ code }) => code)).toEqual(expect.arrayContaining([
      "source_measurement_required",
      "condition_invalid",
      "odometer_invalid",
    ]));
    expect(model.state.mounts[0]).toMatchObject({
      source_measurement_id: null,
      condition: "R9",
    });
  });

  it("exige OTD y RTD positivos", () => {
    const model = createBaselineModel({ unitId: UNIT_ID });
    model.addFromProjection(3, evidence());

    model.updateMount(3, { otd_mm: "desconocida" });
    expect(model.validate()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "otd_invalid", position: 3 }),
    ]));

    model.updateMount(3, { otd_mm: "" });
    expect(model.validate()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "otd_required", position: 3 }),
    ]));

    model.updateMount(3, { otd_mm: "18.7", rtd_mm: "" });
    expect(model.validate()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "rtd_required", position: 3 }),
    ]));

    model.updateMount(3, { rtd_mm: "0" });
    expect(model.validate()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "rtd_invalid", position: 3 }),
    ]));

    model.updateMount(3, { rtd_mm: "14.2" });
    expect(model.seal().mounts[0]).toMatchObject({ otd_mm: 18.7, rtd_mm: 14.2 });
  });
});
