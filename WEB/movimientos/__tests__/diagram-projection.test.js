import { describe, expect, it, vi } from "vitest";

import { project } from "../diagram-projection.js";

function remotePositions(count = 6, overrides = {}) {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    return {
      position_number: position,
      is_empty: false,
      life_cycle_id: `cycle-${position}`,
      casing_code: `CAS-${position}`,
      code_mismatch: false,
      ...overrides[position],
    };
  });
}

const clearFlags = {
  mismatch: false,
  conflict: false,
  selected: false,
  retention: false,
  discard: false,
  mount: false,
  swap: false,
};

describe("project", () => {
  it.each([6, 8])("proyecta las %i posiciones remotas sin inventar otras", (count) => {
    const projection = project(remotePositions(count));

    expect(projection).toBeInstanceOf(Map);
    expect([...projection.keys()]).toEqual(
      Array.from({ length: count }, (_, index) => index + 1),
    );
    expect(projection.get(1)).toEqual({
      occupancy: "occupied",
      role: "none",
      flags: clearFlags,
      label: "OCUPADA",
    });
  });

  it("trata una columna baseline_pending ausente como el estado vacío histórico", () => {
    const remote = remotePositions(6, {
      3: {
        is_empty: true,
        life_cycle_id: null,
        casing_code: null,
        last_inspection_tire_code: "LEGACY-03",
      },
    });

    const projection = project(remote, { movements: [] }, 3);

    expect(projection.get(3)).toEqual({
      occupancy: "empty",
      role: "none",
      flags: { ...clearFlags, selected: true },
      label: "VACÍA",
    });
  });

  it("proyecta una posición pendiente con etiqueta, código y evidencia sin formatear", () => {
    const remote = remotePositions(6, {
      3: {
        is_empty: true,
        life_cycle_id: null,
        casing_code: null,
        baseline_pending: true,
        last_inspection_tire_code: "INS-003",
        last_inspected_on: "2026-07-10",
        last_measurement_id: "30000000-0000-4000-8000-000000000003",
        last_brand_name: "MICHELIN",
        last_model_name: "X MULTI Z",
        last_size_name: "295/80R22.5",
        last_condition: "R1",
        last_retread_design: "XZA",
        last_rtd_movi_mm: 8.5,
        last_odometer_km: 98765,
      },
    });

    expect(project(remote).get(3)).toEqual({
      occupancy: "baseline_pending",
      role: "none",
      flags: clearFlags,
      label: "PENDIENTE DE LÍNEA BASE · INS-003",
      last_inspection_tire_code: "INS-003",
      last_inspected_on: "2026-07-10",
      last_measurement_id: "30000000-0000-4000-8000-000000000003",
      last_brand_name: "MICHELIN",
      last_model_name: "X MULTI Z",
      last_size_name: "295/80R22.5",
      last_condition: "R1",
      last_retread_design: "XZA",
      last_rtd_movi_mm: 8.5,
      last_odometer_km: 98765,
    });
  });

  it("mantiene pendiente una medición sin código y omite el sufijo de identidad", () => {
    const remote = remotePositions(6, {
      2: {
        is_empty: true,
        life_cycle_id: null,
        casing_code: null,
        baseline_pending: true,
        last_inspection_tire_code: null,
        last_inspected_on: "2026-07-11",
        last_measurement_id: "20000000-0000-4000-8000-000000000002",
      },
    });

    expect(project(remote).get(2)).toMatchObject({
      occupancy: "baseline_pending",
      label: "PENDIENTE DE LÍNEA BASE",
      last_inspection_tire_code: null,
      last_inspected_on: "2026-07-11",
    });
  });

  it("etiqueta de forma neutra una instalación confirmada como línea base", () => {
    const remote = remotePositions(6, {
      4: { installation_origin: "baseline" },
    });

    expect(project(remote).get(4)).toEqual({
      occupancy: "occupied",
      role: "none",
      flags: clearFlags,
      label: "LÍNEA BASE",
      installation_origin: "baseline",
    });
  });

  it("prioriza occupied y avisa si el backend contradice baseline_pending", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const remote = remotePositions(6, {
      1: { baseline_pending: true, installation_origin: "workshop" },
    });

    expect(project(remote).get(1)).toMatchObject({
      occupancy: "occupied",
      label: "OCUPADA",
    });
    expect(warn).toHaveBeenCalledWith(
      "v_unit_position_state contradictorio: posición ocupada con baseline_pending=true",
      { position: 1 },
    );
    warn.mockRestore();
  });

  it("deja que el borrador mande visualmente sobre baseline_pending", () => {
    const remote = remotePositions(6, {
      5: {
        is_empty: true,
        life_cycle_id: null,
        casing_code: null,
        baseline_pending: true,
        last_inspection_tire_code: "INS-005",
        last_measurement_id: "50000000-0000-4000-8000-000000000005",
      },
    });
    const draft = {
      movements: [{ op: "mount", position: 5, life_cycle_id: "inventory-cycle-5" }],
    };

    expect(project(remote, draft).get(5)).toMatchObject({
      occupancy: "occupied",
      role: "destination",
      label: "MONTAR",
      last_inspection_tire_code: "INS-005",
    });
  });

  it.each([
    ["send_to_retention", "retention", "A RETÉN"],
    ["discard", "discard", "DESCARTE"],
  ])("marca %s como origen ocupado que quedará vacío", (op, actionFlag, label) => {
    const movement = {
      op,
      position: 2,
      expected_life_cycle_id: "cycle-2",
    };

    const position = project(remotePositions(), { movements: [movement] }).get(2);

    expect(position).toEqual({
      occupancy: "empty",
      role: "origin",
      flags: { ...clearFlags, [actionFlag]: true },
      label,
    });
  });

  it("marca mount como destino ocupado sobre una posición remota vacía", () => {
    const remote = remotePositions(6, {
      4: { is_empty: true, life_cycle_id: null, casing_code: null },
    });
    const draft = {
      movements: [{ op: "mount", position: 4, life_cycle_id: "inventory-cycle-1" }],
    };

    expect(project(remote, draft).get(4)).toEqual({
      occupancy: "occupied",
      role: "destination",
      flags: { ...clearFlags, mount: true },
      label: "MONTAR",
    });
  });

  it("proyecta como destino un mount sobre una posición liberada por el mismo lote", () => {
    const draft = {
      movements: [
        { op: "mount", position: 3, life_cycle_id: "inventory-cycle-1" },
        {
          op: "send_to_retention",
          position: 3,
          expected_life_cycle_id: "cycle-3",
        },
      ],
    };

    const position = project(remotePositions(), draft).get(3);

    expect(position.occupancy).toBe("occupied");
    expect(position.role).toBe("destination");
    expect(position.flags).toMatchObject({
      retention: true,
      mount: true,
      conflict: false,
    });
    expect(position.label).toBe("MONTAR");
  });

  it("marca ambos lados de swap sin cambiar su ocupación final", () => {
    const draft = {
      movements: [
        {
          op: "swap",
          position_a: 1,
          expected_life_cycle_id_a: "cycle-1",
          position_b: 6,
          expected_life_cycle_id_b: "cycle-6",
        },
      ],
    };

    const projection = project(remotePositions(), draft);

    expect(projection.get(1)).toEqual({
      occupancy: "occupied",
      role: "swapA",
      flags: { ...clearFlags, swap: true },
      label: "SWAP A",
    });
    expect(projection.get(6)).toEqual({
      occupancy: "occupied",
      role: "swapB",
      flags: { ...clearFlags, swap: true },
      label: "SWAP B",
    });
  });

  it("expone code_mismatch como REVISAR IDENTIDAD sin convertirlo en conflicto", () => {
    const remote = remotePositions(6, { 5: { code_mismatch: true } });

    const position = project(remote).get(5);

    expect(position.flags).toMatchObject({ mismatch: true, conflict: false });
    expect(position.label).toBe("REVISAR IDENTIDAD");
  });

  it("marca conflicto en todas las posiciones con doble uso de origen o destino", () => {
    const remote = remotePositions(6, {
      4: { is_empty: true, life_cycle_id: null, casing_code: null },
      5: { is_empty: true, life_cycle_id: null, casing_code: null },
    });
    const draft = {
      movements: [
        {
          op: "send_to_retention",
          position: 1,
          expected_life_cycle_id: "cycle-1",
        },
        { op: "discard", position: 1, expected_life_cycle_id: "cycle-1" },
        { op: "mount", position: 4, life_cycle_id: "inventory-cycle-1" },
        { op: "mount", position: 5, life_cycle_id: "inventory-cycle-1" },
      ],
    };

    const projection = project(remote, draft);

    for (const position of [1, 4, 5]) {
      expect(projection.get(position).flags.conflict).toBe(true);
      expect(projection.get(position).label).toBe("CONFLICTO");
    }
  });

  it("marca invariantes locales y conflictos de posición conocidos por la RPC", () => {
    const remote = remotePositions(6, {
      2: { is_empty: true, life_cycle_id: null, casing_code: null },
    });
    const draft = {
      movements: [
        {
          op: "discard",
          position: 2,
          expected_life_cycle_id: "cycle-stale",
        },
        {
          op: "send_to_retention",
          position: 3,
          expected_life_cycle_id: "another-cycle",
        },
      ],
      conflictPositions: [6, 99],
    };

    const projection = project(remote, draft);

    expect(projection.get(2).flags.conflict).toBe(true);
    expect(projection.get(3).flags.conflict).toBe(true);
    expect(projection.get(6).flags.conflict).toBe(true);
    expect(projection.has(99)).toBe(false);
  });

  it("no muta snapshot ni borrador y produce el mismo resultado para la misma entrada", () => {
    const remote = remotePositions();
    const draft = {
      movements: [
        {
          op: "send_to_retention",
          position: 1,
          expected_life_cycle_id: "cycle-1",
        },
      ],
    };
    const remoteBefore = structuredClone(remote);
    const draftBefore = structuredClone(draft);

    const first = project(remote, draft, 1);
    const second = project(remote, draft, 1);

    expect([...first.entries()]).toEqual([...second.entries()]);
    expect(remote).toEqual(remoteBefore);
    expect(draft).toEqual(draftBefore);
  });
});
