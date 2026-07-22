import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * computeTire/computeGroup/computeAxle viven inline en WEB/rendimiento.html
 * (script clásico, no ES module): convertirlo a módulo rompería los
 * `onclick="selectAxle(...)"` que dependen de scope global (task_04,
 * "si por la estructura del HTML resulta inviable, dejarlo en el archivo y
 * testear igual"). Este test carga el bloque de cálculo puro (sin DOM, sin
 * RenovaSupabase) directamente desde el archivo real con `vm`, así valida el
 * código de producción tal cual, sin una segunda copia mantenida a mano.
 */
const HTML_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../rendimiento.html");
const START_MARKER = "const AXLE_BALANCE_THRESHOLD_PERCENT";
const END_MARKER = "const animateCount = RenovaAnimate.count;";

function loadCalculations() {
  const html = readFileSync(HTML_PATH, "utf8");
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1) {
    throw new Error(
      "No se encontró el bloque de cálculo puro en rendimiento.html. " +
      "Si se movieron los marcadores de inicio/fin, actualizar START_MARKER/END_MARKER de este test."
    );
  }
  const context = {};
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { filename: "rendimiento.html#calculo" });
  return context;
}

const { computeTire, computeGroup, computeAxle } = loadCalculations();

// Neumático fuente sintético — misma forma que unit.tires[pos] en rendimiento.html.
function tire(overrides = {}) {
  return {
    rtdInstalacion: 16, rtdActual: 8, kmInstalacion: 0, kmActual: 80000,
    otd: 16, rtdRetiro: 4, costo: 100, kmPrevioAcumulado: 0,
    modelo: "315/80R22.5", reencauche: null,
    ...overrides,
  };
}

describe("computeTire (sin cambios, verificación de referencia)", () => {
  it("neumático sin datos fuente es inválido, sin inventar 0", () => {
    expect(computeTire(null)).toEqual({ valid: false });
    expect(computeTire(tire({ rtdActual: null })).valid).toBe(false);
  });

  it("neumático sin desgaste (rtdGastado <= 0) es inválido", () => {
    expect(computeTire(tire({ rtdActual: 16 })).valid).toBe(false);
  });
});

describe("computeGroup", () => {
  it("conjunto vacío: total/valid/excluded en 0, métricas null, no NaN", () => {
    const g = computeGroup([]);
    expect(g).toEqual({
      total: 0, valid: 0, excluded: 0,
      rows: [], valids: [],
      avgKmMm: null, avgPct: null, avgKmProyectado: null, totalKmAcumulado: null, avgCostoKm: null,
      best: null, worst: null,
    });
  });

  it("todos inválidos: métricas null, excluded === total", () => {
    const tires = [tire({ rtdActual: 16 }), tire({ rtdActual: null })];
    const g = computeGroup(tires);
    expect(g.total).toBe(2);
    expect(g.valid).toBe(0);
    expect(g.excluded).toBe(2);
    expect(g.avgKmMm).toBeNull();
    expect(g.avgCostoKm).toBeNull();
    expect(g.best).toBeNull();
    expect(g.worst).toBeNull();
  });

  it("un solo válido: promedio igual a ese valor, best === worst (misma referencia)", () => {
    const t = tire({ id: "unico" });
    const g = computeGroup([t]);
    expect(g.valid).toBe(1);
    expect(g.avgKmMm).toBe(computeTire(t).kmMm);
    expect(g.best).toBe(t);
    expect(g.worst).toBe(t);
  });

  it("costo nulo en algunos: avgCostoKm promedia solo los que lo tienen (no vale 0 soles)", () => {
    const conCosto = tire({ id: "a", costo: 100 });
    const sinCosto = tire({ id: "b", costo: null });
    const g = computeGroup([conCosto, sinCosto]);
    expect(g.valid).toBe(2);
    expect(g.avgCostoKm).toBe(computeTire(conCosto).costoKm);
  });

  it("todos sin costo: avgCostoKm es null, no 0", () => {
    const g = computeGroup([tire({ costo: null }), tire({ costo: null })]);
    expect(g.avgCostoKm).toBeNull();
  });

  it("kmAcumulado se suma sobre los válidos (totalKmAcumulado)", () => {
    const g = computeGroup([tire({ kmPrevioAcumulado: 1000 }), tire({ kmPrevioAcumulado: 2000 })]);
    const expected = computeTire(tire({ kmPrevioAcumulado: 1000 })).kmAcumulado
      + computeTire(tire({ kmPrevioAcumulado: 2000 })).kmAcumulado;
    expect(g.totalKmAcumulado).toBe(expected);
  });

  it("best/worst identifican el kmMm más alto/más bajo entre los válidos", () => {
    const bajo = tire({ id: "bajo", rtdActual: 12 });   // menos desgaste → más km/mm
    const alto = tire({ id: "alto", rtdActual: 2 });    // más desgaste → menos km/mm
    const g = computeGroup([bajo, alto]);
    expect(g.best.id).toBe("bajo");
    expect(g.worst.id).toBe("alto");
  });

  it("conjunto grande no desborda ni cuelga", () => {
    const many = Array.from({ length: 3000 }, (_, i) => tire({ id: i, rtdActual: 4 + (i % 10) }));
    const g = computeGroup(many);
    expect(g.total).toBe(3000);
    expect(Number.isFinite(g.avgKmMm)).toBe(true);
  });

  it("no muta los objetos de entrada", () => {
    const t = tire();
    const clone = { ...t };
    computeGroup([t]);
    expect(t).toEqual(clone);
  });
});

describe("computeAxle — envoltorio delgado sobre computeGroup, mismo shape que antes", () => {
  function unitWithAxle(positions) {
    const tires = {};
    positions.forEach(({ pos, ...t }) => { tires[pos] = tire(t); });
    return { tires };
  }

  it("eje balanceado: bestPos/worstPos por posición, lr con ambos lados", () => {
    const unit = unitWithAxle([
      { pos: "P3", lado: "Izq", rtdActual: 8 },
      { pos: "P4", lado: "Izq", rtdActual: 8 },
      { pos: "P5", lado: "Der", rtdActual: 8 },
      { pos: "P6", lado: "Der", rtdActual: 8 },
    ]);
    const axle = { positions: [{ pos: "P3", lado: "Izq" }, { pos: "P4", lado: "Izq" }, { pos: "P5", lado: "Der" }, { pos: "P6", lado: "Der" }] };
    const agg = computeAxle(unit, axle);
    expect(agg.rows.map(r => r.pos)).toEqual(["P3", "P4", "P5", "P6"]);
    expect(agg.valids).toHaveLength(4);
    expect(agg.lr).not.toBeNull();
    expect(agg.lr.balanced).toBe(true);
    expect(typeof agg.bestPos).toBe("string");
    expect(typeof agg.worstPos).toBe("string");
  });

  it("eje desbalanceado: lr.balanced en false por encima del umbral", () => {
    const unit = unitWithAxle([
      { pos: "P3", lado: "Izq", rtdActual: 14 },
      { pos: "P5", lado: "Der", rtdActual: 2 },
    ]);
    const axle = { positions: [{ pos: "P3", lado: "Izq" }, { pos: "P5", lado: "Der" }] };
    const agg = computeAxle(unit, axle);
    expect(agg.lr.balanced).toBe(false);
  });

  it("un solo lado con datos: lr es null (no se inventa el otro lado)", () => {
    const unit = unitWithAxle([{ pos: "P3", lado: "Izq", rtdActual: 8 }]);
    const axle = { positions: [{ pos: "P3", lado: "Izq" }] };
    const agg = computeAxle(unit, axle);
    expect(agg.lr).toBeNull();
    expect(agg.bestPos).toBe("P3");
    expect(agg.worstPos).toBe("P3");
  });

  it("eje sin ningún válido: agregados null, rows conserva las posiciones", () => {
    const unit = unitWithAxle([{ pos: "P3", lado: "Izq", rtdActual: 16 }]);
    const axle = { positions: [{ pos: "P3", lado: "Izq" }] };
    const agg = computeAxle(unit, axle);
    expect(agg.avgKmMm).toBeNull();
    expect(agg.bestPos).toBeNull();
    expect(agg.rows).toHaveLength(1);
  });

  /**
   * Regresión contra datos reales (evidencia registrada en
   * tasks_filtros_facetados/STATE.md fila 04, no embebida acá por la regla
   * de no volcar datos reales en fixtures): computeAxle() sobre las 12
   * agregaciones de eje de 9 unidades reales de `v_rendimiento_dashboard_rows`
   * dio resultado IDÉNTICO byte a byte antes y después de este refactor,
   * incluyendo los casos de eje 100% inválido, un solo lado con datos, costo
   * nulo (QA-CN16) y desbalance real (5021).
   */
  it("computeAxle no cambia la matemática de computeGroup (misma fuente, mismo resultado)", () => {
    const unit = unitWithAxle([
      { pos: "P3", lado: "Izq", rtdActual: 8, costo: null },
      { pos: "P4", lado: "Der", rtdActual: 6, costo: 50 },
    ]);
    const axle = { positions: [{ pos: "P3", lado: "Izq" }, { pos: "P4", lado: "Der" }] };
    const agg = computeAxle(unit, axle);
    const group = computeGroup(axle.positions.map(p => ({ ...unit.tires[p.pos], pos: p.pos, lado: p.lado })));
    expect(agg.avgKmMm).toBe(group.avgKmMm);
    expect(agg.avgPct).toBe(group.avgPct);
    expect(agg.avgKmProyectado).toBe(group.avgKmProyectado);
    expect(agg.totalKmAcumulado).toBe(group.totalKmAcumulado);
  });
});
