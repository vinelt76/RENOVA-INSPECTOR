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

const { buildTireRowsFromSupabase, computeTire, computeGroup, computeAxle } = loadCalculations();

// Neumático fuente sintético — misma forma que unit.tires[pos] en rendimiento.html.
function tire(overrides = {}) {
  return {
    plate: "225", casingCode: "241088", lastInspectionTireCode: "241088",
    rtdInstalacion: 16, rtdActual: 8, kmInstalacion: 0, kmActual: 80000,
    otd: 16, rtdRetiro: 4, costo: 100,
    modelo: "315/80R22.5", reencauche: null,
    ...overrides,
  };
}

describe("computeTire — paridad con la planilla RENOVA", () => {
  it("neumático sin datos fuente es inválido, sin inventar 0", () => {
    expect(computeTire(null)).toEqual({ valid: false });
    expect(computeTire(tire({ rtdActual: null })).valid).toBe(false);
  });

  it("neumático sin desgaste (rtdGastado <= 0) es inválido", () => {
    expect(computeTire(tire({ rtdActual: 16 })).valid).toBe(false);
  });

  it("costo fuente ausente permanece null y nunca se convierte en cero", () => {
    expect(computeTire(tire({ costo: null })).costoKm).toBeNull();
    expect(computeTire(tire({ costo: "" })).costoKm).toBeNull();
  });

  it("reproduce las filas reales 225 P3 y P5 sobre profundidad útil", () => {
    const p3 = computeTire(tire({
      rtdActual: 4, kmInstalacion: 553857, kmActual: 607467,
      rtdRetiro: 4, costo: 95,
    }));
    const p5 = computeTire(tire({
      rtdActual: 10, kmInstalacion: 553857, kmActual: 607467,
      rtdRetiro: 4, costo: 95,
    }));

    expect(p3.pctConsumo).toBe(100);
    expect(p5.pctConsumo).toBe(50);
    expect(Math.round(p3.kmMm)).toBe(4468);
    expect(Math.round(p5.kmMm)).toBe(8935);
    expect(Math.round(p3.kmProyectado)).toBe(53610);
    expect(Math.round(p5.kmProyectado)).toBe(107220);
  });

  // D1 (resuelta 2026-07-26 por el dueño de negocio): la base es el OTD del ciclo,
  // SIEMPRE. Da lo mismo que el neumático se rote dentro de la unidad, venga de otro
  // vehículo o salga del retén: el OTD es una propiedad del ciclo de vida y el ciclo
  // no cambia porque cambie el carro. Lo que viaja con el neumático es el kilometraje
  // que hizo en los vehículos anteriores dentro de su vida actual.
  //
  // Esta prueba estaba escrita al revés mientras D1 seguía abierta. Ahora afirma lo
  // decidido y corre: es el único caso donde OTD y RTD de instalación se separan, y
  // hoy no existe en los datos (las 14 llantas son R1 con rtd_at_install == otd).
  it("un casco montado usado proyecta desde el OTD del ciclo, no desde el RTD al montar", () => {
    const m = computeTire(tire({
      rtdInstalacion: 12, rtdActual: 8, otd: 16,
      rtdRetiro: 4, kmActual: 40000, kmCicloAcumulado: 80000,
    }));
    expect(m.utilMm).toBe(12);            // 16 − 4, la banda entera
    expect(m.kmProyectado).toBe(120000);  // 10 000 km/mm × 12 mm
    expect(m.kmProyectado).not.toBe(80000);
  });

  it("con un casco montado usado, km del ciclo + VUR llega al proyectado", () => {
    const m = computeTire(tire({
      rtdInstalacion: 12, rtdActual: 8, otd: 16,
      rtdRetiro: 4, kmActual: 40000, kmCicloAcumulado: 80000,
    }));
    expect(m.kmRecorrido + m.vur).toBeCloseTo(m.kmProyectado, 6);
  });

  it("montado nuevo, km recorrido + VUR sí cierra con el proyectado", () => {
    // Cuando el neumático nunca cambió de posición, no hay banda gastada antes y las
    // dos identidades coinciden. Es el caso de las 14 filas reales de hoy.
    const m = computeTire(tire({ rtdActual: 8, kmActual: 80000, rtdRetiro: 4 }));
    expect(m.kmRecorrido + m.vur).toBeCloseTo(m.kmProyectado, 6);
  });

  it("sin RTD de retiro no inventa vida útil, proyección ni costo", () => {
    const m = computeTire(tire({ rtdRetiro: null }));
    expect(m.valid).toBe(true);
    expect(m.kmMm).toBe(10000);
    expect(m.utilMm).toBeNull();
    expect(m.pctConsumo).toBeNull();
    expect(m.kmProyectado).toBeNull();
    expect(m.costoKm).toBeNull();
    expect(m.vur).toBeNull();
  });
});

describe("computeGroup", () => {
  it("conjunto vacío: total/valid/excluded en 0, métricas null, no NaN", () => {
    const g = computeGroup([]);
    expect(g).toEqual({
      total: 0, valid: 0, excluded: 0,
      inconsistent: 0,
      rows: [], valids: [],
      avgKmMm: null, avgPct: null, avgKmProyectado: null, totalKmAcumulado: null, avgCostoKm: null,
      medianVur: null, vurCount: 0,
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
    const g = computeGroup([tire({ kmCicloAcumulado: 81000 }), tire({ kmCicloAcumulado: 82000 })]);
    const expected = computeTire(tire({ kmCicloAcumulado: 81000 })).kmAcumulado
      + computeTire(tire({ kmCicloAcumulado: 82000 })).kmAcumulado;
    expect(g.totalKmAcumulado).toBe(expected);
  });

  it("kmAcumulado conserva solo la vida actual, no vidas anteriores del casco", () => {
    const [mapped] = buildTireRowsFromSupabase([{
      plate: "225", position_number: 3,
      rtd_at_install_mm: 16, current_rtd_mm: 14,
      odometer_at_install: 100000, current_odometer_km: 120000,
      otd_mm: 16, rtd_removal_mm: 4,
      cycle_km_accumulated: 60000,
      casing_km_accumulated: 160000,
      km_run: 20000,
    }]);

    expect(mapped.kmCicloAcumulado).toBe(60000);
    expect(computeTire(mapped).kmAcumulado).toBe(60000);
  });

  it("best/worst identifican el kmMm más alto/más bajo entre los válidos", () => {
    const bajo = tire({ id: "bajo", rtdActual: 12 });   // menos desgaste → más km/mm
    const alto = tire({ id: "alto", rtdActual: 2 });    // más desgaste → menos km/mm
    const g = computeGroup([bajo, alto]);
    expect(g.best.id).toBe("bajo");
    expect(g.worst.id).toBe("alto");
  });

  it("conjunto grande no desborda ni cuelga", () => {
    const many = Array.from({ length: 3000 }, (_, i) => tire({ id: i, plate: String(i % 100), rtdActual: 4 + (i % 10) }));
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

/**
 * Estadística de las tarjetas del panel (auditoría 2026-07-25).
 *
 * Hasta esta fase TODAS las tarjetas hacían \`mean()\` del valor por neumático.
 * Para las métricas de TASA eso no es "menos preciso": es incorrecto. Promediar
 * razones sobrepondera a los neumáticos con denominador chico, que es justo lo
 * que hacía que 5 cascos de prueba definieran el KPI de la flota.
 */
describe("estadística del panel: tasas y proyección ponderadas, magnitudes por mediana", () => {
  it("km/mm es Σkm / Σmm, no el promedio de los km/mm individuales", () => {
    // A: 90 000 km con 9 mm gastados → 10 000 km/mm
    // B:  1 000 km con 0.1 mm gastados → 10 000 km/mm también, pero con un
    //     denominador 90 veces menor. El promedio simple les da el mismo peso.
    const a = tire({ rtdInstalacion: 16, rtdActual: 7, kmInstalacion: 0, kmActual: 90000 });
    const b = tire({ rtdInstalacion: 16, rtdActual: 15.9, kmInstalacion: 0, kmActual: 1000 });
    const g = computeGroup([a, b]);
    // Σkm = 91 000 · Σmm = 9.1 → 10 000 km/mm exactos.
    expect(g.avgKmMm).toBeCloseTo(91000 / 9.1, 6);
  });

  it("un neumático con desgaste mínimo no arrastra el km/mm de la flota", () => {
    const normal = tire({ rtdInstalacion: 16, rtdActual: 8, kmInstalacion: 0, kmActual: 80000 });
    // Caso patológico: mucho km, casi nada de desgaste → 500 000 km/mm.
    const raro = tire({ rtdInstalacion: 16, rtdActual: 15.9, kmInstalacion: 0, kmActual: 50000 });
    const g = computeGroup([normal, raro]);
    const promedioIngenuo = (80000 / 8 + 50000 / 0.1) / 2; // 255 000
    expect(g.avgKmMm).toBeLessThan(promedioIngenuo / 10);
    expect(g.avgKmMm).toBeCloseTo(130000 / 8.1, 6);
  });

  it("consumo es Σmm gastados / Σprofundidad útil vigente", () => {
    const a = tire({ otd: 22, rtdInstalacion: 20, rtdActual: 10, rtdRetiro: 4 }); // 12 de 18 útiles
    const b = tire({ otd: 14, rtdInstalacion: 10, rtdActual: 8, rtdRetiro: 4 });  //  6 de 10 útiles
    const g = computeGroup([a, b]);
    // D1: desgaste y profundidad útil cubren el ciclo. Σútil = (22-4)+(14-4)=28.
    expect(g.avgPct).toBeCloseTo((18 / 28) * 100, 6);
  });

  it("costo/km es Σsoles / Σkm, no el promedio de los costos unitarios", () => {
    const barato = tire({ costo: 100, kmInstalacion: 0, kmActual: 100000 }); // 0.001
    const caro   = tire({ costo: 100, kmInstalacion: 0, kmActual: 10000, rtdActual: 15 }); // 0.01
    const g = computeGroup([barato, caro]);
    expect(g.avgCostoKm).toBeCloseTo(200 / 110000, 9);
  });

  it("km proyectado es Σ(proyectado × mm gastados) / Σmm gastados", () => {
    // A: 78 394 km con 4 mm gastados → 19 598.5 km/mm → proyecta 235 182
    // B: 50 149 km con 12 mm gastados →  4 179.1 km/mm → proyecta  50 149
    // Datos reales de las placas 225 P6 y 256 P8 (auditoria_lunes/TRASPASO.md §4).
    const a = tire({ otd: 16, rtdInstalacion: 16, rtdActual: 12, kmInstalacion: 0, kmActual: 78394 });
    const b = tire({ otd: 16, rtdInstalacion: 16, rtdActual: 4,  kmInstalacion: 0, kmActual: 50149 });
    const g = computeGroup([a, b]);
    // Σ(km × span) / Σmm = ((78 394 + 50 149) × 12) / 16
    expect(g.avgKmProyectado).toBeCloseTo(((78394 + 50149) * 12) / 16, 6);
  });

  it("el neumático con menos mm gastados no domina la proyección del conjunto", () => {
    // Mismo par: el promedio simple de las proyecciones queda 22 % por encima de
    // la ponderada, porque le da a los 4 mm de evidencia el mismo peso que a 12.
    const a = tire({ otd: 16, rtdInstalacion: 16, rtdActual: 12, kmInstalacion: 0, kmActual: 78394 });
    const b = tire({ otd: 16, rtdInstalacion: 16, rtdActual: 4,  kmInstalacion: 0, kmActual: 50149 });
    const g = computeGroup([a, b]);
    const proyectados = g.valids.map(r => r.m.kmProyectado);
    const promedioIngenuo = (proyectados[0] + proyectados[1]) / 2;
    expect(g.avgKmProyectado).toBeLessThan(promedioIngenuo);
    // Y sigue dentro del rango observado: un ponderado nunca sale de [mín, máx].
    expect(g.avgKmProyectado).toBeGreaterThan(Math.min(...proyectados));
    expect(g.avgKmProyectado).toBeLessThan(Math.max(...proyectados));
  });

  it("reconcilia exacto con km/mm cuando el span es igual para todo el conjunto", () => {
    // Es la razón por la que se eligió la ponderada sobre la mediana: quien
    // multiplique el km/mm de la tarjeta de al lado por (OTD − RTD retiro)
    // obtiene el número que está viendo, no otro.
    const tires = [
      tire({ otd: 16, rtdInstalacion: 16, rtdActual: 12, kmInstalacion: 0, kmActual: 78394 }),
      tire({ otd: 16, rtdInstalacion: 16, rtdActual: 11, kmInstalacion: 0, kmActual: 78394 }),
      tire({ otd: 16, rtdInstalacion: 16, rtdActual: 6,  kmInstalacion: 0, kmActual: 50835 }),
      tire({ otd: 16, rtdInstalacion: 16, rtdActual: 4,  kmInstalacion: 0, kmActual: 50149 }),
    ];
    const g = computeGroup(tires);
    expect(g.avgKmProyectado).toBeCloseTo(g.avgKmMm * (16 - 4), 6);
  });

  it("con profundidades útiles distintas sigue siendo un ponderado válido, no la identidad anterior", () => {
    // La 5021 P5 tiene RTD inicial 10 mientras el resto tiene 16: el span deja de ser
    // constante y la igualdad km/mm × span ya no aplica. La cifra sigue siendo
    // interpretable (promedio ponderado de las proyecciones), pero no debe
    // afirmarse la reconciliación exacta en ese caso.
    const tires = [
      tire({ otd: 16, rtdInstalacion: 16, rtdActual: 7, kmInstalacion: 0, kmActual: 93734 }),
      tire({ otd: 10, rtdInstalacion: 10, rtdActual: 4, kmInstalacion: 0, kmActual: 93734 }),
    ];
    const g = computeGroup(tires);
    const esperado = (93734 * 12 + 93734 * 6) / (9 + 6);
    expect(g.avgKmProyectado).toBeCloseTo(esperado, 6);
    expect(g.avgKmProyectado).not.toBeCloseTo(g.avgKmMm * 12, 0);
  });
});

describe("VUR — vida útil remanente", () => {
  it("son los km que faltan para el umbral de retiro, al ritmo actual", () => {
    // 80 000 km gastando 8 mm → 10 000 km/mm. Del RTD actual (8) al retiro (4)
    // quedan 4 mm → 40 000 km.
    const m = computeTire(tire({ rtdInstalacion: 16, rtdActual: 8, kmActual: 80000, rtdRetiro: 4 }));
    expect(m.vur).toBeCloseTo(40000, 6);
  });

  it("un neumático ya en el umbral da 0, no negativo: es cambio inmediato", () => {
    const m = computeTire(tire({ rtdInstalacion: 16, rtdActual: 4, kmActual: 80000, rtdRetiro: 4 }));
    expect(m.vur).toBe(0);
    const pasado = computeTire(tire({ rtdInstalacion: 16, rtdActual: 3, kmActual: 80000, rtdRetiro: 4 }));
    expect(pasado.vur).toBe(0);
  });

  it("sin umbral de retiro no se inventa un VUR", () => {
    expect(computeTire(tire({ rtdRetiro: null })).vur).toBeNull();
  });

  it("el grupo reporta la mediana y cuántos neumáticos la sostienen", () => {
    const g = computeGroup([
      tire({ rtdActual: 8 }),   // 40 000
      tire({ rtdActual: 6 }),   // 24 000
      tire({ rtdActual: 12 }),  // 64 000
    ]);
    expect(g.vurCount).toBe(3);
    expect(g.medianVur).toBeCloseTo(40000, 6);
  });

  it("los neumáticos sin VUR no cuentan como 0 en la mediana", () => {
    const g = computeGroup([tire({ rtdActual: 8 }), tire({ rtdRetiro: null, rtdActual: 8 })]);
    expect(g.vurCount).toBe(1);
    expect(g.medianVur).toBeCloseTo(40000, 6);
  });
});

describe("agregación uniforme — también pondera dentro de una unidad", () => {
  it("las cuatro filas de la 225 no vuelven al promedio simple de la planilla", () => {
    const rows = [4, 10, 4, 4].map((rtdActual, index) => tire({
      id: index,
      plate: "225",
      rtdActual,
      kmInstalacion: 553857,
      kmActual: 607467,
      rtdRetiro: 4,
      costo: 95,
    }));
    const g = computeGroup(rows);
    expect(g.avgKmMm).toBeCloseTo((53610 * 4) / 42, 6);
    expect(g.avgKmProyectado).toBeCloseTo(((53610 * 4) * 12) / 42, 6);
    expect(g.avgPct).toBeCloseTo(87.5, 6);
    expect(g.avgKmMm).not.toBeCloseTo(5584.75, 2);
  });

  it("una medición con poca evidencia no domina aunque todas las filas sean de la misma placa", () => {
    const estable = tire({ plate: "225", rtdActual: 8, kmActual: 80000 });
    const incipiente = tire({ plate: "225", rtdActual: 15.9, kmActual: 50000 });
    const g = computeGroup([estable, incipiente]);
    const simple = (10000 + 500000) / 2;
    expect(g.avgKmMm).toBeCloseTo(130000 / 8.1, 6);
    expect(g.avgKmMm).toBeLessThan(simple / 10);
  });

  it("si todos tienen el mismo rendimiento, promedio y ponderado coinciden", () => {
    const rows = [
      tire({ plate: "225", rtdActual: 12, kmActual: 40000 }),
      tire({ plate: "225", rtdActual: 8, kmActual: 80000 }),
      tire({ plate: "225", rtdActual: 4, kmActual: 120000 }),
    ];
    const g = computeGroup(rows);
    expect(g.avgKmMm).toBe(10000);
    expect(g.avgKmMm).toBe(meanForTest(rows.map(row => computeTire(row).kmMm)));
  });
});

function meanForTest(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("mediciones inconsistentes", () => {
  it("RTD 9 → 11 se excluye de la agregación y conserva el motivo", () => {
    const row = tire({ prevInspectionRtd: 9, rtdActual: 11 });
    const metric = computeTire(row);
    const group = computeGroup([row]);
    expect(metric.valid).toBe(false);
    expect(metric.inconsistente).toBe(true);
    expect(group.valid).toBe(0);
    expect(group.inconsistent).toBe(1);
  });

  it("RTD 12 → 11 es consistente", () => {
    expect(computeTire(tire({ prevInspectionRtd: 12, rtdActual: 11 })).valid).toBe(true);
  });

  it("sin inspección anterior es consistente", () => {
    expect(computeTire(tire({ prevInspectionRtd: null, rtdActual: 11 })).valid).toBe(true);
  });

  it("distingue cambio sin registrar, medición a revisar y ausencia de código", () => {
    const cambio = computeTire(tire({
      prevInspectionRtd: 9, rtdActual: 11,
      casingCode: "241088", lastInspectionTireCode: "241679",
    }));
    const medicion = computeTire(tire({
      prevInspectionRtd: 9, rtdActual: 11,
      casingCode: "20887", lastInspectionTireCode: "20887",
    }));
    const sinCodigo = computeTire(tire({
      prevInspectionRtd: 9, rtdActual: 11,
      casingCode: null, lastInspectionTireCode: null,
    }));
    expect(cambio.inconsistency.reason).toBe("Cambio de neumático sin registrar");
    expect(medicion.inconsistency.reason).toBe("Medición a revisar");
    expect(sinCodigo.inconsistency.reason).toBe("Sin código: no se puede distinguir");
  });
});
