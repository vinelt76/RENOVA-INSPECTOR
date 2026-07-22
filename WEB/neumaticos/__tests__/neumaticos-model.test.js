import { describe, expect, it } from "vitest";

import {
  availableTireFacetValues,
  casingHistoryHref,
  filterTireFacetRows,
  filterTireRows,
  tireFacetFromSearch,
  tireFacetSearch,
} from "../neumaticos-model.js";

const rows = [
  { kind: "unit", label: "UNI-01", haystack: "UNI-01" },
  { kind: "casing", casing_code: "CAS-1", label: "CAS-1", haystack: "CAS-1 GOODYEAR KMAX 315/80R22.5", brand_name: "GOODYEAR", model_name: "KMAX", size_name: "315/80R22.5", condition: "R2", retread_design: "D-1", status: "installed" },
  { kind: "casing", casing_code: "CAS-2", label: "CAS-2", haystack: "CAS-2 goodyear KMAX 315/80R22.5", brand_name: "goodyear", model_name: "KMAX", size_name: "315/80R22.5", condition: "N", retread_design: null, status: "in_inventory" },
  { kind: "casing", casing_code: null, label: null, haystack: "MICHELIN 295/80R22.5", brand_name: "MICHELIN", model_name: "X MULTI", size_name: "295/80R22.5", condition: "R1", retread_design: "D-2", status: "discarded" },
];

describe("contrato de facetas de neumáticos", () => {
  it("lee solo parámetros conocidos y serializa medidas de forma compartible", () => {
    expect(tireFacetFromSearch("?marca=GOODYEAR&medida=315%2F80R22.5&extra=x")).toEqual({ marca: "GOODYEAR", medida: "315/80R22.5" });
    expect(tireFacetSearch({ medida: "315/80R22.5", condicion: "R2" })).toBe("medida=315%2F80R22.5&condicion=R2");
  });

  it("aplica AND y normaliza caja sin inferir facetas desde la prosa", () => {
    expect(filterTireFacetRows(rows, { marca: "Goodyear", medida: "315/80R22.5" }).map((row) => row.casing_code))
      .toEqual(["CAS-1", "CAS-2"]);
    expect(filterTireFacetRows(rows, { marca: "GOODYEAR", condicion: "R2" }).map((row) => row.casing_code))
      .toEqual(["CAS-1"]);
    expect(filterTireFacetRows(rows, { marca: "ninguna" })).toEqual([]);
    expect(filterTireRows(rows, { facets: { marca: "GOODYEAR" }, query: "kmax" }).map((row) => row.casing_code))
      .toEqual(["CAS-1", "CAS-2"]);
  });

  it("deriva opciones sin duplicar variantes y no inventa enlaces sin código", () => {
    expect(availableTireFacetValues(rows).marca).toEqual(["GOODYEAR", "MICHELIN"]);
    expect(casingHistoryHref(rows[1])).toBe("historial-neumatico.html?serie=CAS-1&from=neumaticos");
    expect(casingHistoryHref(rows[3])).toBeNull();
  });
});
