# Run 1 — Inventario de fórmulas

Toda fórmula existente hoy, dónde vive, qué consume, dónde se muestra y dónde debería vivir
cuando los datos fluyan por Supabase. **Ninguna fórmula se elimina en este run** — esto es el
plano de migración.

Leyenda "Futuro": `SQL view` = vista en Postgres (ya bosquejada en `supabase/schema_draft.sql`) ·
`SQL func` = función/trigger Postgres · `Edge Fn` = Edge Function · `Cliente` = queda en el
dispositivo (paridad calculations.ts/py) · `Front` = solo presentación en el dashboard.

## A. Motor de cálculo de la app (real, se ejecuta al guardar)

`app/src/core/calculations.ts` (paridad con `reference/calculations.py`; fuente: `specs/reglas_negocio.md`).

| # | Métrica | Archivo | Inputs | Output / dónde se ve | Explicación | Futuro |
|---|---|---|---|---|---|---|
| A1 | RTD MOVI | `calculations.ts:calcularRtdMovi` (invocada en `inspeccionRepo.upsertNeumatico`) | r1..r3 (+r4 si eje Libre/Dual) | `inspeccion_neumatico.rtd_movi`; hero del panel taller; semáforos | El remanente operativo es el MÍNIMO de los canales medidos. Canales según tipo de eje (3 o 4). | **Cliente** (fase 1 el servidor lo recibe calculado). Fase 2 opcional: `SQL func` de verificación server-side. |
| A2 | IDI | `calculations.ts:calcularIdi` | mismos canales | `inspeccion_neumatico.idi` | Índice de desgaste irregular = MAX − MIN de canales. ≥4 mm = alerta. | **Cliente**; umbrales de color en `Front`. |
| A3 | ESTADO RTD | `calculations.ts:calcularEstadoRtd` | rtd_movi, rtd_cambio, rtd_proximo | `inspeccion_neumatico.estado_rtd`; badges de todos los dashboards | If/elif SECUENCIAL: ≤cambio → "Para Reencauche"; ≤próximo → "Próximo"; sino "Normal". ⚠ La app hoy pasa 4/7 hardcodeados (deuda); deben salir de `rtd_thresholds`. | **Cliente** (con umbrales sincronizados desde `rtd_thresholds`). |
| A4 | ESTADO PRESIÓN | `calculations.ts:calcularEstadoPresion` (no invocada aún en el guardado) | presion, presion_ref, delta_alto_pct, delta_bajo_pct, sin_medir | Aún no persistido; mock en panel taller | Sin medir → "Sin Medir"; > ref×(1+alto%) → "Alta"; < ref×(1−bajo%) → "Baja"; sino "Normal". Referencia CALIENTE **sin definir** — no implementar. | **Cliente** + persistir en `inspection_measurements.pressure_state`. Refs desde `pressure_thresholds`. |
| A5 | Tasa de desgaste | `calculations.ts:calcularTasaDesgaste` (sin llamador aún) | rtd_movi anterior/actual, km anterior/actual | (fase futura) | mm consumidos por 1000 km entre dos inspecciones del mismo neumático en la misma posición. NULL si Δkm ≤ 0. | **SQL view/func** sobre `inspection_measurements` consecutivas (necesita `tire_id` confiable). |
| A6 | VUR | `calculations.ts:calcularVur` (sin llamador aún) | rtd_movi, rtd_cambio, tasa acumulada | (fase futura) | Km proyectados hasta llegar a rtd_cambio: (MOVI−cambio)/tasa×1000. NULL sin datos; 0 si ya está en límite. | **SQL view/func** (server-side, agrega histórico). |
| A7 | Peso ISA | `calculations.ts:calcularIsaPeso` | desecho bool | (fase futura) | Peso 5 si la anomalía es de desecho, 1 si no, 0 sin anomalía. Configurable por empresa. | **SQL view** con `isa_weights`. |
| A8 | DESECHO automático | `inspeccionRepo.calcularDesecho` | anomalia → `cat_anomalia.desecho` | `inspeccion_neumatico.desecho`; "DESECHO: SÍ" panel taller | Si la anomalía elegida tiene desecho=TRUE en el catálogo, se marca solo. | **Cliente** (lookup local); server valida contra `catalog_anomalies.is_discard` (fase 2, `SQL func`/trigger). |

## B. Rendimiento por neumático (`rendimiento.html` · `rendimiento-por-neumatico.html`, funciones `computeTire()`/`derive()`)

Datos fuente: instalación + última inspección + inventario (hoy 100% mock).

| # | Métrica | Inputs | Output / dónde se ve | Explicación | Futuro |
|---|---|---|---|---|---|
| B1 | RTD Gastado | rtdInstalacion − rtdActual | Card "RTD Gastado" (mm) | Milímetros de banda consumidos desde el montaje. | **SQL view** `v_tire_performance.rtd_worn_mm` |
| B2 | Km Recorrido | kmActual − kmInstalacion | Card "Km Recorrido" | Km rodados por el neumático en la instalación actual. | **SQL view** `.km_run` |
| B3 | % de Consumo | RTD Gastado / OTD (×100) | Card "% de Consumo" | Porcentaje de la banda original ya consumido. | **SQL view** `.consumption_pct` |
| B4 | Km/mm | Km Recorrido / RTD Gastado | Card "Km/mm"; barras por posición | Rendimiento: km que rinde cada mm de banda. | **SQL view** `.km_per_mm` |
| B5 | Km Proyectado | Km/mm × (OTD − RTD Retiro) | Card "Km Proyectado" | Vida total estimada al ritmo actual, hasta el RTD de retiro recomendado. | **SQL view** `.km_projected` |
| B6 | Costo/Km | Costo / Km Recorrido | Card "Costo/Km" | Costo por km rodado de este casco/ciclo. | **SQL view** `.cost_per_km` |
| B7 | Km Acumulado | km_previo_acumulado + Km Recorrido | Card "Km Acumulado" | Km de toda la vida del casco (ciclos anteriores + actual). | **SQL view** `.km_accumulated` (con `tires.accumulated_km` mantenido por retiros — `SQL func`/trigger) |
| B8 | Validez ("Sin datos") | presencia de fuentes; RTD Gastado>0 y Km Recorrido>0 | Pills `.no-data`; "Sin datos suficientes" | Si falta cualquier fuente o no hay desgaste/recorrido, NO se inventa 0: todo queda null. | **SQL view** (NULLs naturales) + `Front` para el rótulo |

## C. Rendimiento por eje (`rendimiento.html`, `computeAxle()`)

| # | Métrica | Inputs | Output / dónde se ve | Explicación | Futuro |
|---|---|---|---|---|---|
| C1 | Km/mm promedio del eje | Km/mm de posiciones válidas del eje | KPI "Km/mm promedio" | Promedio excluyendo posiciones sin datos. | **SQL view** `v_axle_performance.avg_km_per_mm` |
| C2 | % Consumo promedio del eje | % Consumo de posiciones válidas | KPI "% Consumo promedio" | Ídem. | **SQL view** `.avg_consumption_pct` |
| C3 | Diferencia % (balance) | Km/mm de las posiciones | Veredicto Balance + métrica "Diferencia" | 2 posiciones: \|A−B\|/promedio×100; >2: (máx−mín)/promedio×100. | **SQL view** `.diff_pct` |
| C4 | Veredicto balanceado/desbalance | diff_pct vs `AXLE_BALANCE_THRESHOLD_PERCENT = 15` | Banner verde/rojo | Umbral marcado en el propio HTML como "pendiente de definir con RENOVA — configurable". | Comparación en **Front** (o view) contra `axle_balance_thresholds.max_diff_pct` — nunca 15 fijo |
| C5 | Posición de menor rendimiento | min(Km/mm) del eje | Barra amarilla `is-min` | Señala la posición que peor rinde. | **Front** (sobre datos de la view) |

## D. Vista de flota (`vista-flota.html`)

| # | Métrica | Inputs | Output / dónde se ve | Explicación | Futuro |
|---|---|---|---|---|---|
| D1 | Estado del neumático (semáforo flota) | rtd, withdrawalAnomaly | Color del neumático en el esquema | ⚠ Mock hardcodea: anomalía causal→crítico; <4→crítico; ≤8→observación; >8→normal. Producción: usar `rtd_state`+`is_discard` calculados con umbrales de empresa. | **SQL view** `v_fleet_status` (por unidad) + `Front` por neumático |
| D2 | Estado de la unidad | estados de sus neumáticos | Borde/badge de la card; orden del grid | Peor caso entre todos los neumáticos. | **SQL view** `v_fleet_status.unit_status` |
| D3 | RTD mínimo de la unidad | min(rtd) | "RTD mín" en pie de card; orden secundario | Peor remanente de la unidad. | **SQL view** `.worst_rtd_mm` |
| D4 | Conteos crít./obs. por unidad | estados por neumático | "N llantas crít." / "N en obs." | Cuántos neumáticos en cada estado. | **SQL view** `.critical_tires`, `.warning_tires` |
| D5 | KPIs de flota | estados de todas las unidades de la fecha | Cards: total, críticas, observación, normales, **% flota en riesgo** = (crít+obs)/total×100 | Resumen del día para el jefe de flota. | **SQL view** agregada sobre `v_fleet_status` (o `Front` con GROUP BY) |

## E. Panel de taller (`UI/renova_dashboard_taller_v1.html`)

| # | Métrica | Inputs | Output / dónde se ve | Explicación | Futuro |
|---|---|---|---|---|---|
| E1 | `rtdMovi` | canales A–D | Hero RTD MOVI; tag MIN por canal | Duplicado de A1 en el mock. | Leer `rtd_movi_mm` guardado — el dashboard NO recalcula |
| E2 | `estadoRTD` | movi + cfg empresa | Badge de estado; color de rueda 3D; medidor de umbrales | Duplicado de A3. | Leer `rtd_state` guardado; zonas del medidor desde `rtd_thresholds` |
| E3 | `estadoPresion` + Δ% | psi, ref, deltas | Card presión (Δ −6.7%, badge) | Δ% = (psi−ref)/ref×100 comparado contra +alto/−bajo. | `pressure_state` guardado + Δ% en **Front** con `pressure_thresholds` |
| E4 | `estadoWheel` | anomalía causal OR estadoRTD | Color de rueda en gemelo 3D | Anomalía causal de retiro manda sobre el RTD. | **Front** sobre `rtd_state`+`is_discard` |

## F. Definidas solo en spec (sin código todavía) — `specs/reglas_negocio.md`

| # | Métrica | Spec | Explicación | Futuro |
|---|---|---|---|---|
| F1 | ISA | §6 | Σ(pesos de anomalías)/total inspecciones del período. | **SQL view** con `isa_weights` |
| F2 | Cumplimiento de presión % | §9 | normales / medidos × 100, segmentado por eje/vehículo/empresa/período. | **SQL view** |
| F3 | Distribución ESTADO RTD | §10 | % normal / próximo / para reencauche, comparado con período anterior. | **SQL view** |
| F4 | Desecho prematuro | §11 | (VUR proyectada − km efectivos) > umbral configurable al momento del desecho. | **SQL func/Edge Fn** al registrar `tire_removals` con reason=discard |

## Criterio general de ubicación

- **Se queda en el cliente** todo lo que el inspector necesita ver al instante y offline
  (A1–A4, A8): la paridad calculations.ts/py sigue siendo ley; el servidor de fase 1 **recibe,
  no recalcula** (task_14).
- **Va a SQL views** todo lo que agrega historia o cruza entidades que el teléfono no tiene
  completas (rendimiento B/C, flota D, spec F): una fuente de verdad consultable por cualquier
  dashboard.
- **SQL func/trigger** para efectos de estado (actualizar `tires.accumulated_km` y `tires.status`
  al registrar un retiro; validación server de DESECHO en fase 2).
- **Edge Functions**: no se identifican necesidades en esta fase (quedarían para reportes
  Excel/notificaciones futuras). Preferir views mientras alcance.
- **Front** solo formato, colores y comparación contra umbrales ya provistos por la consulta.
