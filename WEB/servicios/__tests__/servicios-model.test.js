import { describe, expect, it } from "vitest";
import {
  casingHistoryHref,
  chipsFromSearch,
  filterServices,
  searchForChips,
  segmentsFromSummary,
  SERVICE_FACETS,
  SERVICE_TYPES,
  summarizeServices,
  unitHref,
} from "../servicios-model.js";

const rows = [
  { service_id: "s1", order_id: "o1", unit_id: "u1", service_type: "rotation", plate: "ABC-123", position_number: 3, pair_position_number: 7, brand_key: "MICHELIN", captured_on: "2026-07-12", captured_by_name: "Ana", requested_by_name: "Sol", reconciliation_status: "pending" },
  { service_id: "s2", order_id: "o2", unit_id: "u1", service_type: "installation", direction: "entry", plate: "ABC-123", position_number: 4, brand_key: "GOODYEAR", captured_on: "2026-07-13", captured_by_name: "Luis", requested_by_name: "Sol", reconciliation_status: "pending" },
  { service_id: "s3", order_id: "o3", unit_id: "u2", service_type: "repair", plate: "XYZ-900", position_number: 10, brand_key: null, captured_on: "2026-06-01", captured_by_name: "Ana", requested_by_name: "Max", reconciliation_status: "needs_review", observations: "parche lateral" },
];

describe("resumen y segmentos", () => {
  it("cuenta una rotación pareada una vez y no inventa una instalación", () => {
    const summary = summarizeServices([rows[0]]);
    expect(summary.total).toBe(1);
    expect(summary.byType).toEqual([expect.objectContaining({ key: "rotation", count: 1 })]);
  });

  it("cuenta un entry installation como instalación", () => {
    expect(summarizeServices([rows[1]]).byType[0]).toMatchObject({ key: "installation", count: 1 });
  });

  it("conserva el contrato exacto sin datos", () => {
    expect(summarizeServices([])).toEqual({ total: 0, firstDate: null, byType: [] });
    expect(summarizeServices(null)).toEqual({ total: 0, firstDate: null, byType: [] });
  });

  it("resume unidades, órdenes y periodo", () => {
    expect(summarizeServices(rows)).toMatchObject({ total: 3, units: 2, orders: 3, firstDate: "2026-06-01", lastDate: "2026-07-13" });
  });

  it("suma exactamente 100.0 con tres tipos", () => {
    const segments = segmentsFromSummary({ byType: [
      { key: "repair", count: 1 }, { key: "claim", count: 1 }, { key: "rotation", count: 1 },
    ] });
    expect(segments.reduce((sum, item) => sum + item.percentage, 0)).toBe(100);
  });

  it("suma exactamente 100.0 con siete tipos", () => {
    const segments = segmentsFromSummary({ byType: SERVICE_TYPES.slice(0, 7).map((type) => ({ ...type, count: 1 })) });
    expect(segments.reduce((sum, item) => sum + item.percentage, 0)).toBe(100);
  });

  it("un solo tipo queda en 100.0", () => {
    expect(segmentsFromSummary({ byType: [{ key: "repair", count: 4 }] })[0].percentage).toBe(100);
  });

  it("nunca emite segmentos de conteo cero", () => {
    expect(segmentsFromSummary({ byType: [{ key: "repair", count: 0 }, { key: "claim", count: 2 }] })).toEqual([
      { key: "claim", count: 2, percentage: 100 },
    ]);
  });

  it("tiene exactamente un tipo alert", () => {
    expect(SERVICE_TYPES.filter((type) => type.tone === "alert")).toHaveLength(1);
    expect(SERVICE_TYPES.find((type) => type.tone === "alert")?.key).toBe("discard");
  });

  it("da etiqueta y tono a los ocho tipos", () => {
    expect(SERVICE_TYPES).toHaveLength(8);
    expect(SERVICE_TYPES.every((type) => type.label && type.tone)).toBe(true);
  });
});

describe("facetas, chips y búsqueda", () => {
  const facet = (key) => SERVICE_FACETS.find((item) => item.key === key);

  it("mantiene las doce facetas y mes antes que fecha", () => {
    expect(SERVICE_FACETS.map((item) => item.key)).toEqual([
      "tipo", "unidad", "posicion", "marca", "medida", "condicion", "reencauche", "operario", "supervisor", "mes", "fecha", "reconciliacion",
    ]);
  });

  it("ofrece tipos presentes en orden canónico", () => {
    expect(facet("tipo").values([rows[1], rows[0], rows[2]])).toEqual([
      "PARA REPARACIÓN", "ROTACIÓN / INTERCAMBIO", "INSTALACIÓN",
    ]);
  });

  it("ordena posiciones numéricamente", () => {
    expect(facet("posicion").values(rows)).toEqual(["P3", "P4", "P10"]);
  });

  it("no ofrece una marca null ni descarta por ello sin filtro", () => {
    expect(facet("marca").values(rows)).toEqual(["GOODYEAR", "MICHELIN"]);
    expect(filterServices(rows)).toHaveLength(3);
  });

  it("filtra tipo, unidad, marca y mes", () => {
    const chips = [
      { facet: "tipo", value: "ROTACIÓN / INTERCAMBIO" },
      { facet: "unidad", value: "ABC-123" },
      { facet: "marca", value: "MICHELIN" },
      { facet: "mes", value: "julio 2026" },
    ];
    expect(filterServices(rows, { chips })).toEqual([rows[0]]);
  });

  it("hace OR dentro de una faceta y AND entre facetas", () => {
    const chips = [
      { facet: "tipo", value: "ROTACIÓN / INTERCAMBIO" },
      { facet: "tipo", value: "INSTALACIÓN" },
      { facet: "unidad", value: "ABC-123" },
    ];
    expect(filterServices(rows, { chips })).toEqual([rows[0], rows[1]]);
  });

  it("ignora una faceta desconocida de una URL vieja", () => {
    expect(() => filterServices(rows, { chips: [{ facet: "antigua", value: "x" }] })).not.toThrow();
    expect(filterServices(rows, { chips: [{ facet: "antigua", value: "x" }] })).toHaveLength(3);
  });

  it("combina chips con búsqueda por tokens", () => {
    const result = filterServices(rows, {
      chips: [{ facet: "operario", value: "Ana" }],
      query: "xyz lateral",
    });
    expect(result).toEqual([rows[2]]);
  });

  it("tolera rows undefined", () => {
    expect(filterServices(undefined, { query: "algo" })).toEqual([]);
  });

  it("serializa y recupera chips multivalor de forma idempotente", () => {
    const chips = [
      { facet: "tipo", value: "PARA REPARACIÓN" },
      { facet: "tipo", value: "INSTALACIÓN" },
      { facet: "unidad", value: "ABC-123" },
      { facet: "vieja", value: "ignorar" },
    ];
    const search = searchForChips(chips);
    expect(chipsFromSearch(search).map(({ facet: key, value }) => ({ facet: key, value }))).toEqual(chips.slice(0, 3));
    expect(searchForChips(chipsFromSearch(search))).toBe(search);
  });
});

describe("enlaces", () => {
  it("no enlaza un casco no registrado", () => {
    expect(casingHistoryHref({ casing_code: "ABC", casing_exists: false })).toBeNull();
  });

  it("no enlaza un código ilegible", () => {
    expect(casingHistoryHref({ casing_code: "ABC", casing_exists: true, code_unreadable: true })).toBeNull();
  });

  it("enlaza un casco legible y registrado", () => {
    expect(casingHistoryHref({ casing_code: " AB/C 1 ", casing_exists: true })).toBe("historial-neumatico.html?serie=AB%2FC%201&from=servicios");
  });

  it("codifica placas con espacios y barra", () => {
    expect(unitHref({ plate: " AB/C 1 " })).toBe("Inspecciones por unidad.html?plate=AB%2FC%201");
  });
});
