import { describe, expect, it } from "vitest";

import { applyFilters, distinctValues } from "../filter-facets.js";

const rows = [
  { id: 1, brand: "Michelin", axle: "Tracción" },
  { id: 2, brand: "Hankook", axle: "Tracción" },
  { id: 3, brand: "Michelin", axle: "Direccional" },
  { id: 4, brand: "Goodyear", axle: "Libre" },
  { id: 5, brand: null, axle: "" },
];

const facets = [
  { key: "brand", label: "Marca", type: "enum", values: (r) => distinctValues(r, "brand"), match: (row, value) => row.brand === value },
  { key: "axle", label: "Eje", type: "enum", values: (r) => distinctValues(r, "axle"), match: (row, value) => row.axle === value },
];

describe("applyFilters", () => {
  it("sin chips devuelve el conjunto completo (copia, no la misma referencia)", () => {
    const result = applyFilters(rows, [], facets);
    expect(result).toEqual(rows);
    expect(result).not.toBe(rows);
  });

  it("un chip filtra por esa faceta", () => {
    expect(applyFilters(rows, [{ facet: "brand", value: "Michelin" }], facets))
      .toEqual([rows[0], rows[2]]);
  });

  it("dos chips de la misma faceta se combinan con OR", () => {
    expect(
      applyFilters(rows, [
        { facet: "brand", value: "Michelin" },
        { facet: "brand", value: "Hankook" },
      ], facets)
    ).toEqual([rows[0], rows[1], rows[2]]);
  });

  it("chips de facetas distintas se combinan con AND", () => {
    expect(
      applyFilters(rows, [
        { facet: "brand", value: "Michelin" },
        { facet: "axle", value: "Tracción" },
      ], facets)
    ).toEqual([rows[0]]);
  });

  it("combina OR dentro y AND entre facetas a la vez", () => {
    expect(
      applyFilters(rows, [
        { facet: "brand", value: "Michelin" },
        { facet: "brand", value: "Goodyear" },
        { facet: "axle", value: "Libre" },
      ], facets)
    ).toEqual([rows[3]]);
  });

  it("el orden de los chips no altera el resultado", () => {
    const a = applyFilters(rows, [
      { facet: "axle", value: "Tracción" },
      { facet: "brand", value: "Michelin" },
    ], facets);
    const b = applyFilters(rows, [
      { facet: "brand", value: "Michelin" },
      { facet: "axle", value: "Tracción" },
    ], facets);
    expect(a).toEqual(b);
  });

  it("faceta desconocida en un chip se ignora, no lanza", () => {
    expect(() => applyFilters(rows, [{ facet: "modelo", value: "XZA" }], facets)).not.toThrow();
    expect(applyFilters(rows, [{ facet: "modelo", value: "XZA" }], facets)).toEqual(rows);
  });

  it("fila con la columna de la faceta nula no coincide, no lanza", () => {
    expect(applyFilters(rows, [{ facet: "brand", value: "Michelin" }], facets)).not.toContainEqual(rows[4]);
  });

  it("dos chips idénticos dan el mismo resultado que uno", () => {
    const once = applyFilters(rows, [{ facet: "brand", value: "Michelin" }], facets);
    const twice = applyFilters(rows, [
      { facet: "brand", value: "Michelin" },
      { facet: "brand", value: "Michelin" },
    ], facets);
    expect(twice).toEqual(once);
  });

  it("todos los chips de una faceta sin coincidencias da conjunto vacío, no error", () => {
    expect(applyFilters(rows, [{ facet: "brand", value: "Pirelli" }], facets)).toEqual([]);
  });

  it("rows vacío da vacío", () => {
    expect(applyFilters([], [{ facet: "brand", value: "Michelin" }], facets)).toEqual([]);
  });
});

describe("distinctValues", () => {
  it("devuelve valores distintos, sin nulos ni vacíos, ordenados", () => {
    expect(distinctValues(rows, "brand")).toEqual(["Goodyear", "Hankook", "Michelin"]);
  });

  it("acepta un accesor función además de un nombre de columna", () => {
    expect(distinctValues(rows, (row) => row.brand)).toEqual(["Goodyear", "Hankook", "Michelin"]);
  });

  it("deduplica por texto normalizado conservando la primera grafía cruda", () => {
    const withCaseVariants = [{ brand: "michelin" }, { brand: "MICHELIN" }, { brand: "Michelin" }];
    expect(distinctValues(withCaseVariants, "brand")).toEqual(["michelin"]);
  });

  it("no inventa valores ausentes de los datos", () => {
    expect(distinctValues([], "brand")).toEqual([]);
    expect(distinctValues([{ brand: null }, { brand: "" }], "brand")).toEqual([]);
  });
});

describe("facetas de especificación de Inspecciones", () => {
  const inspectionRows = [
    { id: 1, brand_name: "Goodyear", model_name: "G658", size_name: "295/80R22.5", condition: "R1", retread_design: "IZE2W", axleName: "Tracción" },
    { id: 2, brand_name: "Michelin", model_name: "X Multi", size_name: "295/80R22.5", condition: "N", retread_design: null, axleName: "Direccional" },
  ];
  const inspectionFacets = [
    { key: "marca", match: (row, value) => row.brand_name === value },
    { key: "modelo", match: (row, value) => row.model_name === value },
    { key: "medida", match: (row, value) => row.size_name === value },
    { key: "condicion", match: (row, value) => row.condition === value },
    { key: "diseno", match: (row, value) => row.retread_design === value },
    { key: "eje", match: (row, value) => row.axleName === value },
  ];

  it("combina diseño, condición y eje para cuantificar el conjunto correcto", () => {
    const result = applyFilters(inspectionRows, [
      { facet: "diseno", value: "IZE2W" },
      { facet: "condicion", value: "R1" },
      { facet: "eje", value: "Tracción" },
    ], inspectionFacets);
    expect(result).toEqual([inspectionRows[0]]);
  });
});
