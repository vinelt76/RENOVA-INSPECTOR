import { describe, expect, it } from "vitest";

import { filterRowsBySearchTokens, normalizeSearchText } from "../search.js";

const rows = [
  { code: "CAS-ALFA", brand: "Michelin", design: "Diseño Mixto" },
  { code: null, brand: "Goodyear", design: null },
];

describe("normalizeSearchText", () => {
  it("quita acentos, normaliza mayúsculas y colapsa espacios", () => {
    expect(normalizeSearchText("  NeumÁtico   Diseño  ")).toBe("neumatico diseno");
    expect(normalizeSearchText(null)).toBe("");
  });
});

describe("filterRowsBySearchTokens", () => {
  it("aplica AND y permite tokens en columnas distintas", () => {
    expect(filterRowsBySearchTokens(rows, "cas michelin mixto", ["code", "brand", "design"]))
      .toEqual([rows[0]]);
  });

  it("devuelve una copia completa para consultas vacías o de espacios", () => {
    const result = filterRowsBySearchTokens(rows, "   ", ["code"]);
    expect(result).toEqual(rows);
    expect(result).not.toBe(rows);
  });

  it("tolera columnas inexistentes y filas sin valores buscables", () => {
    expect(filterRowsBySearchTokens(rows, "continental", ["missing", "design"]))
      .toEqual([]);
    expect(filterRowsBySearchTokens([{ code: null }], "cas", ["code", "missing"]))
      .toEqual([]);
  });
});
