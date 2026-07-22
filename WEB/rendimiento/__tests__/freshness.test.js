import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const HTML_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../rendimiento.html");
const START_MARKER = "const AXLE_BALANCE_THRESHOLD_PERCENT";
const END_MARKER = "const animateCount = RenovaAnimate.count;";

function loadFreshness() {
  const html = readFileSync(HTML_PATH, "utf8");
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1) throw new Error("No se encontró el bloque de frescura en rendimiento.html");
  const context = {};
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: "rendimiento.html#freshness" });
  return context.partitionByFreshness;
}

const partitionByFreshness = loadFreshness();
const NOW = new Date("2026-07-19T18:00:00-05:00");

describe("partitionByFreshness", () => {
  it("usa el umbral configurable de 30 días e incluye el borde", () => {
    const rows = [
      { id: "today", lastInspectionOn: "2026-07-19" },
      { id: "edge", lastInspectionOn: "2026-06-19" },
      { id: "old", lastInspectionOn: "2026-06-18" },
    ];
    const result = partitionByFreshness(rows, NOW);
    expect(result.fresh.map((row) => row.id)).toEqual(["today", "edge"]);
    expect(result.stale.map((row) => row.id)).toEqual(["old"]);
    expect(result.maxAgeDays).toBe(30);
  });

  it("trata sin inspección o fecha ilegible como rancio, nunca como fresco accidental", () => {
    const rows = [
      { id: "null", lastInspectionOn: null },
      { id: "missing" },
      { id: "bad", lastInspectionOn: "ayer" },
    ];
    const result = partitionByFreshness(rows, NOW);
    expect(result.fresh).toHaveLength(0);
    expect(result.stale.map((row) => row.id)).toEqual(["null", "missing", "bad"]);
  });

  it("una fecha futura no rompe: queda incluida y contada como anomalía", () => {
    const future = { id: "future", lastInspectionOn: "2026-07-20" };
    const result = partitionByFreshness([future], NOW);
    expect(result.fresh).toEqual([future]);
    expect(result.stale).toHaveLength(0);
    expect(result.future).toEqual([future]);
  });

  it("admite umbral distinto sin hardcodearlo en la comparación", () => {
    const row = { id: "ten-days", lastInspectionOn: "2026-07-09" };
    expect(partitionByFreshness([row], NOW, 10).fresh).toHaveLength(1);
    expect(partitionByFreshness([row], NOW, 9).stale).toHaveLength(1);
  });

  it("no muta filas ni el arreglo y tolera entrada no-array", () => {
    const row = { id: "a", lastInspectionOn: "2026-07-01" };
    const rows = [row];
    partitionByFreshness(rows, NOW);
    expect(rows).toEqual([row]);
    expect(partitionByFreshness(null, NOW)).toMatchObject({ total: 0, fresh: [], stale: [] });
  });
});
