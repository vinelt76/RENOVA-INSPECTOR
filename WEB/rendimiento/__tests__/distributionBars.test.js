import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// El mini-gráfico sigue inline porque la pantalla conserva handlers onclick
// globales. Cargamos exactamente el bloque de producción, sin una copia de la
// lógica de render mantenida en la prueba.
const HTML_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../rendimiento.html");
const CALCULATIONS_START = "const AXLE_BALANCE_THRESHOLD_PERCENT";
const CALCULATIONS_END = "const animateCount = RenovaAnimate.count;";
const CHARTS_START = "const nf = new Intl.NumberFormat";
const CHARTS_END = "function aggregateKpis(group){";
const LABEL_START = "function tireModelLabel(tire){";
const LABEL_END = "function resultRow(tire, index){";

function loadDistributionHelpers() {
  const html = readFileSync(HTML_PATH, "utf8");
  const calcStart = html.indexOf(CALCULATIONS_START);
  const calcEnd = html.indexOf(CALCULATIONS_END);
  const chartsStart = html.indexOf(CHARTS_START);
  const chartsEnd = html.indexOf(CHARTS_END);
  const labelStart = html.indexOf(LABEL_START);
  const labelEnd = html.indexOf(LABEL_END);
  if ([calcStart, calcEnd, chartsStart, chartsEnd, labelStart, labelEnd].some(index => index === -1)) {
    throw new Error("No se encontraron los bloques de mini-gráficos en rendimiento.html");
  }
  const context = {};
  vm.createContext(context);
  vm.runInContext(html.slice(calcStart, calcEnd), context, { filename: "rendimiento.html#calculo" });
  vm.runInContext(html.slice(chartsStart, chartsEnd), context, { filename: "rendimiento.html#distribution-bars" });
  vm.runInContext(html.slice(labelStart, labelEnd), context, { filename: "rendimiento.html#chart-label" });
  return context;
}

const { barRowFrom, distributionBars } = loadDistributionHelpers();

describe("mini-gráficos de Rendimiento", () => {
  it("desambigua en el eje X la misma posición de unidades distintas", () => {
    const row = {
      tire: { plate: "2134", pos: "P6", brand_name: "Marca", model_name: "Modelo" },
      m: { kmMm: 12345 },
    };
    expect(barRowFrom(row, "kmMm")).toMatchObject({
      label: "2134-P6",
      sub: "2134 · Marca Modelo",
      value: 12345,
    });
  });

  it("muestra el promedio fijo fuera de la línea y conserva la línea punteada", () => {
    const chart = distributionBars([
      { label: "2134-P3", value: 100 },
      { label: "2135-P3", value: 200 },
    ], { format: value => String(value) });

    expect(chart).toContain('class="metric-chart-average">Prom.: <b class="num">150</b>');
    expect(chart).toContain('class="metric-avg-line" style="bottom:75%" aria-hidden="true"></span>');
    expect(chart).not.toContain('class="metric-avg-line" style="bottom:75%"><b>Prom.');
  });

  it("mantiene las alturas proporcionales y permite explicar un rango estrecho de Costo/km", () => {
    const chart = distributionBars([
      { label: "2134-P3", value: 0.001 },
      { label: "2135-P3", value: 0.00098 },
    ], {
      format: value => value.toFixed(5),
      rangeSummary: ({ min, max }) => `Rango ${min.toFixed(5)}–${max.toFixed(5)}`,
    });

    expect(chart).toContain("--bar-height:100%");
    expect(chart).toContain("--bar-height:98%");
    expect(chart).toContain("Rango 0.00098–0.00100");
  });
});
