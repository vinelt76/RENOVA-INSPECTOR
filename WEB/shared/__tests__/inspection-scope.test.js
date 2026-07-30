import { describe, expect, it } from "vitest";
import {
  createInspectionScopeIndex,
  postgrestFilterForScope,
  resolveInspectionScope,
} from "../inspection-scope.js";

const units = [
  { id: "u1", plate: "BUS-1" },
  { id: "u2", plate: "BUS-2" },
];
const inspections = [
  { id: "i1-old", unit_id: "u1", inspected_on: "2026-06-01", created_at: "2026-06-01T10:00:00Z" },
  { id: "i1-new", unit_id: "u1", inspected_on: "2026-07-10", created_at: "2026-07-10T10:00:00Z" },
  { id: "i2-old", unit_id: "u2", inspected_on: "2026-06-20", created_at: "2026-06-20T10:00:00Z" },
  { id: "i2-new", unit_id: "u2", inspected_on: "2026-07-15", created_at: "2026-07-15T10:00:00Z" },
];
const formatDate = (iso) => ({
  "2026-06-01": "1 junio 2026",
  "2026-06-20": "20 junio 2026",
  "2026-07-10": "10 julio 2026",
  "2026-07-15": "15 julio 2026",
})[iso];

describe("inspection scope", () => {
  it("sin chips usa únicamente la última fecha global", () => {
    const index = createInspectionScopeIndex(inspections, units);
    expect(resolveInspectionScope(index, [], formatDate)).toEqual({
      kind: "global-latest",
      column: "inspected_on",
      values: ["2026-07-15"],
      label: "Última fecha · 15 julio 2026",
    });
  });

  it("unidad seleccionada usa sólo su inspection_id más reciente", () => {
    const index = createInspectionScopeIndex(inspections, units);
    const scope = resolveInspectionScope(index, [{ facet: "unidad", value: "BUS-1" }], formatDate);
    expect(scope.values).toEqual(["i1-new"]);
    expect(scope.label).toBe("Última inspección de la unidad BUS-1");
  });

  it("varias unidades toman la última inspección de cada una", () => {
    const index = createInspectionScopeIndex(inspections, units);
    const scope = resolveInspectionScope(index, [
      { facet: "unidad", value: "BUS-1" },
      { facet: "unidad", value: "BUS-2" },
    ], formatDate);
    expect(scope.values).toEqual(["i2-new", "i1-new"]);
  });

  it("una faceta analítica consulta la última inspección de cada unidad", () => {
    const index = createInspectionScopeIndex(inspections, units);
    expect(resolveInspectionScope(index, [{ facet: "diseno", value: "IZE2W" }], formatDate))
      .toMatchObject({ kind: "fleet-latest", column: "inspection_id", values: ["i2-new", "i1-new"] });
  });

  it("fecha explícita tiene precedencia y permite consultar historia", () => {
    const index = createInspectionScopeIndex(inspections, units);
    const scope = resolveInspectionScope(index, [
      { facet: "unidad", value: "BUS-1" },
      { facet: "fecha", value: "1 junio 2026" },
    ], formatDate);
    expect(scope).toMatchObject({ kind: "dates", column: "inspected_on", values: ["2026-06-01"] });
  });

  it("un mes explícito carga las fechas de ese mes", () => {
    const index = createInspectionScopeIndex(inspections, units);
    const scope = resolveInspectionScope(index, [{ facet: "mes", value: "junio 2026" }], formatDate,
      (month) => ({ "2026-06": "junio 2026", "2026-07": "julio 2026" })[month]);
    expect(scope).toMatchObject({ kind: "dates", values: ["2026-06-20", "2026-06-01"], label: "Mes junio 2026" });
  });

  it("genera filtros PostgREST eq/in sin pedir todo el historial pesado", () => {
    expect(postgrestFilterForScope({ column: "inspected_on", values: ["2026-07-15"] }))
      .toEqual({ column: "inspected_on", value: "eq.2026-07-15" });
    expect(postgrestFilterForScope({ column: "inspection_id", values: ["a", "b"] }))
      .toEqual({ column: "inspection_id", value: "in.(a,b)" });
    expect(postgrestFilterForScope({ column: "inspection_id", values: [] })).toBeNull();
  });

  it("ignora inspecciones inválidas y unidades sin inspecciones", () => {
    const index = createInspectionScopeIndex([
      ...inspections,
      { id: "bad", unit_id: "u1", inspected_on: null },
    ], [...units, { id: "u3", plate: "BUS-3" }]);
    expect(index.dates).toHaveLength(4);
    expect(index.plates).toEqual(["BUS-1", "BUS-2"]);
  });

  it("combina últimas inspecciones compactas con el catálogo histórico de fechas", () => {
    const latestByUnit = [inspections[1], inspections[3]];
    const index = createInspectionScopeIndex(
      latestByUnit,
      units,
      ["2026-07-15", "2026-07-10", "2026-06-20", "2026-06-01", "fecha-inválida"],
    );

    expect(index.rows.map((row) => row.id)).toEqual(["i2-new", "i1-new"]);
    expect(index.dates).toEqual(["2026-07-15", "2026-07-10", "2026-06-20", "2026-06-01"]);
    expect(resolveInspectionScope(index, [{ facet: "unidad", value: "BUS-1" }], formatDate).values)
      .toEqual(["i1-new"]);
    expect(resolveInspectionScope(index, [{ facet: "fecha", value: "1 junio 2026" }], formatDate).values)
      .toEqual(["2026-06-01"]);
  });
});
