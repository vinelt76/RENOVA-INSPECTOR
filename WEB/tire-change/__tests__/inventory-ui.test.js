import { describe, expect, it } from "vitest";

import {
  filterInventoryRows,
  inventoryOptions,
  mountedLifeCycleIds,
} from "../inventory-ui.js";

const INVENTORY = [
  {
    life_cycle_id: "10000000-0000-4000-8000-000000000001",
    casing_code: "CAS-ALFA",
    brand_name: "Michelin",
    model_name: "X Multi",
    size_name: "295/80R22.5",
    condition: "R1",
    cycle_number: 1,
    retread_design: "Mixto",
    last_removed_at: "2026-07-10",
    last_removal_reason: "retention",
    last_rtd_mm: 14,
    days_in_inventory: 4,
  },
  {
    life_cycle_id: "10000000-0000-4000-8000-000000000002",
    casing_code: null,
    brand_name: "Goodyear",
    model_name: null,
    size_name: "275/80R22.5",
    condition: "N",
    cycle_number: 0,
    retread_design: null,
    last_removed_at: null,
    last_removal_reason: null,
    last_rtd_mm: null,
    days_in_inventory: null,
  },
];

describe("inventory-ui helpers", () => {
  it("filtra por texto, medida y condición con tokens combinados", () => {
    expect(filterInventoryRows(INVENTORY, "michelin 295 r1")).toEqual([INVENTORY[0]]);
    expect(filterInventoryRows(INVENTORY, "CAS alfa mixto")).toEqual([INVENTORY[0]]);
    expect(filterInventoryRows(INVENTORY, "goodyear 275 n")).toEqual([INVENTORY[1]]);
  });

  it("tolera campos NULL válidos y no muta el inventario", () => {
    const before = structuredClone(INVENTORY);
    expect(filterInventoryRows(INVENTORY, "")).toEqual(INVENTORY);
    expect(filterInventoryRows(INVENTORY, "sin-coincidencia")).toEqual([]);
    expect(INVENTORY).toEqual(before);
  });

  it("deriva solo los life_cycle_id usados por movimientos mount", () => {
    const used = mountedLifeCycleIds({
      movements: [
        { op: "send_to_retention", expected_life_cycle_id: INVENTORY[0].life_cycle_id },
        { op: "mount", life_cycle_id: INVENTORY[0].life_cycle_id },
        { op: "mount", life_cycle_id: null },
      ],
    });

    expect([...used]).toEqual([INVENTORY[0].life_cycle_id]);
  });

  it("mantiene visible pero deshabilita un ciclo ya elegido", () => {
    const options = inventoryOptions(INVENTORY, {
      movements: [{ op: "mount", life_cycle_id: INVENTORY[0].life_cycle_id }],
    });

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      item: INVENTORY[0],
      disabled: true,
      reason: "Este ciclo ya se usa en otro montaje del lote.",
    });
    expect(options[1]).toMatchObject({ item: INVENTORY[1], disabled: false, reason: null });
  });

  it("aplica búsqueda y elegibilidad sin alterar el orden remoto", () => {
    const reversed = [...INVENTORY].reverse();
    const options = inventoryOptions(reversed, { movements: [] }, "22.5");
    expect(options.map(({ item }) => item.life_cycle_id)).toEqual(
      reversed.map(({ life_cycle_id }) => life_cycle_id),
    );
  });
});
