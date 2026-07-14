import { describe, expect, it } from "vitest";

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

  it("conserva una posición vacía visible, seleccionable y sin identidad inventada", () => {
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
