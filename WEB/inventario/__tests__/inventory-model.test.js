import { describe, expect, it } from "vitest";

import {
  INVENTORY_TABS,
  filterInventoryRows,
  inventoryCounts,
  inventoryRowsForTab,
  normalizeSearchText,
} from "../inventory-model.js";

const data = {
  retention: [
    {
      casing_code: "RET-001",
      brand_name: "MICHELIN",
      model_name: "X MULTI Z",
      size_name: "295/80R22.5",
      condition: "R1",
      retread_design: "Diseño Ñandú",
      last_removal_reason: "retention",
    },
    {
      casing_code: "RET-002",
      brand_name: "Bridgestone",
      size_name: "11R22.5",
      condition: "N",
    },
  ],
  discarded: [
    {
      code: "DESC-001",
      brand_name: "Goodyear",
      model_name: "KMAX",
      last_removal_discard_cause: "Conducción-Ruta",
      last_unit_plate: "BUS-42",
    },
  ],
};

describe("normalizeSearchText", () => {
  it("ignora acentos, mayúsculas y espacios repetidos", () => {
    expect(normalizeSearchText("  NeumÁtico   Diseño  ")).toBe("neumatico diseno");
    expect(normalizeSearchText(null)).toBe("");
  });
});

describe("filterInventoryRows", () => {
  it("busca por tokens repartidos entre identidad, catálogo y condición", () => {
    expect(filterInventoryRows(data.retention, "michelin 295 r1")).toEqual([data.retention[0]]);
    expect(filterInventoryRows(data.retention, "diseno nandu")).toEqual([data.retention[0]]);
  });

  it("busca código y causa de descarte sin acentos", () => {
    expect(filterInventoryRows(data.discarded, "desc-001 conduccion ruta bus-42")).toEqual([
      data.discarded[0],
    ]);
  });

  it("conserva orden y no comparte el arreglo cuando no hay consulta", () => {
    const result = filterInventoryRows(data.retention, "   ");
    expect(result).toEqual(data.retention);
    expect(result).not.toBe(data.retention);
  });

  it("tolera entradas ausentes y devuelve cero resultados para una búsqueda sin coincidencia", () => {
    expect(filterInventoryRows(undefined, "michelin")).toEqual([]);
    expect(filterInventoryRows(data.retention, "continental")).toEqual([]);
  });
});

describe("pestañas de inventario", () => {
  it("cuenta cada colección sin mezclar estados", () => {
    expect(inventoryCounts(data)).toEqual({ reten: 2, descartados: 1 });
    expect(inventoryCounts()).toEqual({ reten: 0, descartados: 0 });
  });

  it("selecciona y filtra la pestaña solicitada", () => {
    expect(inventoryRowsForTab(data, INVENTORY_TABS.DISCARDED, "goodyear")).toEqual([
      data.discarded[0],
    ]);
    expect(inventoryRowsForTab(data, INVENTORY_TABS.RETENTION, "bridgestone")).toEqual([
      data.retention[1],
    ]);
  });

  it("usa Retén como pestaña segura ante un valor desconocido", () => {
    expect(inventoryRowsForTab(data, "otra")).toEqual(data.retention);
  });
});
