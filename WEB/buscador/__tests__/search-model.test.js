import { describe, expect, it } from "vitest";

import {
  groupSearchResults,
  parseSearchScope,
  recentSearchRows,
  recordSearchFrecency,
  resolveSearchDestination,
  rowsForSearchScope,
  searchIndexRows,
} from "../search-model.js";

const rows = [
  { kind: "casing", entity_id: "c-1", label: "CAS-100", haystack: "CAS-100 Michelin X Multi", casing_code: "CAS-100", unit_plate: "ABC 123" },
  { kind: "unit", entity_id: "u-1", label: "CAS-200", haystack: "CAS-200 BUS 2-4", casing_code: null, unit_plate: "CAS-200" },
  { kind: "casing", entity_id: "c-2", label: "OTRO", haystack: "código CAS-300 Goodyear", casing_code: null, unit_plate: "DEF 456" },
  { kind: "casing", entity_id: "c-3", label: null, haystack: "sin codigo hankook", casing_code: null, unit_plate: null },
];

describe("searchIndexRows", () => {
  it("normaliza, aplica tokens AND sobre haystack y no muta las filas", () => {
    const source = rows.map((row) => ({ ...row }));
    expect(searchIndexRows(source, "michelín cas")).toEqual([source[0]]);
    expect(source).toEqual(rows);
  });

  it("prioriza prefijo de label, palabra completa y substring con desempate estable", () => {
    expect(searchIndexRows(rows, "cas").map((row) => row.entity_id)).toEqual(["c-1", "u-1", "c-2"]);
  });

  it("reordena por frecency solo con ventaja sostenida y sin eliminar resultados", () => {
    const frecency = { "u-1": { score: 4, samples: 2 } };
    expect(searchIndexRows(rows, "cas", { frecency }).map((row) => row.entity_id))
      .toEqual(["u-1", "c-1", "c-2"]);
    expect(searchIndexRows(rows, "cas", { frecency, pinnedFirstEntityId: "c-1" }).map((row) => row.entity_id))
      .toEqual(["c-1", "u-1", "c-2"]);
    expect(searchIndexRows(rows, "cas", { frecency: { "u-1": { score: 1, samples: 1 } } }).map((row) => row.entity_id))
      .toEqual(["c-1", "u-1", "c-2"]);
  });
});

describe("prefijos de alcance explícitos", () => {
  it("acepta uni:/neu: sin interpretar atributos ni texto posterior", () => {
    expect(parseSearchScope("UNI: cas")).toEqual({ kind: "unit", prefix: "uni:", query: "cas" });
    expect(parseSearchScope("Neu: Michelin")).toEqual({ kind: "casing", prefix: "neu:", query: "Michelin" });
    expect(rowsForSearchScope(rows, "unit").map((row) => row.entity_id)).toEqual(["u-1"]);
    expect(rowsForSearchScope(rows, "casing").map((row) => row.entity_id)).toEqual(["c-1", "c-2", "c-3"]);
  });

  it("trata prefijos desconocidos o fuera del inicio como texto literal", () => {
    expect(parseSearchScope("xyz: cas")).toEqual({ kind: null, prefix: null, query: "xyz: cas" });
    expect(parseSearchScope("cas uni:")).toEqual({ kind: null, prefix: null, query: "cas uni:" });
    expect(parseSearchScope("uni: neu:")).toEqual({ kind: "unit", prefix: "uni:", query: "neu:" });
  });
});

describe("groupSearchResults y recientes", () => {
  it("agrupa con conteos y ofrece objetos recientes sin mutar ni crear resultados", () => {
    const grouped = groupSearchResults(rows);
    expect(grouped.unit.count).toBe(1);
    expect(grouped.casing.count).toBe(3);
    expect(recentSearchRows(rows, { "c-2": { score: 3, samples: 2 } }, 2).map((row) => row.entity_id))
      .toEqual(["c-2", "c-3"]);
  });

  it("registra frecency de forma inmutable", () => {
    const frecency = recordSearchFrecency({}, "c-1");
    expect(recordSearchFrecency(frecency, "c-1")).toEqual({ "c-1": { score: 2, samples: 2 } });
  });
});

describe("resolveSearchDestination", () => {
  it("resuelve los cuatro destinos y nunca inventa enlace con casing_code nulo", () => {
    expect(resolveSearchDestination(rows[1])).toBe("Inspecciones por unidad.html?plate=CAS-200");
    expect(resolveSearchDestination(rows[0])).toBe("historial-neumatico.html?serie=CAS-100&from=buscador");
    expect(resolveSearchDestination(rows[2])).toBe("Inspecciones por unidad.html?plate=DEF%20456");
    expect(resolveSearchDestination(rows[3])).toBeNull();
  });

  it("abre una medición sin casco en su inspección y posición exactas", () => {
    expect(resolveSearchDestination({
      kind: "inspection",
      inspection_id: "inspection-1",
      unit_plate: "BUS 10",
      position_number: 4,
    })).toBe("Inspecciones por unidad.html?inspection_id=inspection-1&plate=BUS+10&pos=4");
  });
});
