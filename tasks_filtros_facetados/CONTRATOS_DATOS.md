# CONTRATOS DE DATOS — Filtros facetados

Estado: **CONGELADO 2026-07-20** contra el proyecto real `fbxupwwgiebhlciqftpw` (evidencia en
`AUDIT.md` §7 y `STATE.md` fila 01). Dos facetas quedan retiradas o bloqueadas con motivo explícito;
ninguna queda en `POR VERIFICAR`.

Motivo del borrador original: `v_tire_performance` no está en la cadena de migraciones y la única
definición versionada (`supabase/schema_draft.sql`) estaba desactualizada (`AUDIT.md` §2.5). Su
definición real ahora está volcada en `AUDIT.md` §7.1 vía `pg_get_viewdef`.

---

## 1. Contrato del componente de filtro

Independiente de la pantalla y de la fuente de datos.

### 1.1 Chip

```js
{ facet: 'brand', value: 'MICHELIN', label: 'Marca: MICHELIN' }
```

- `facet` — clave estable de la faceta. No se muestra.
- `value` — valor **crudo**, tal como viene de los datos. La normalización es para comparar y
  buscar, nunca para almacenar ni mostrar.
- `label` — texto visible. Incluye el tipo de faceta, que es lo que resuelve la ambigüedad de F5.

### 1.2 Definición de faceta

```js
{
  key: 'brand',
  label: 'Marca',
  type: 'enum',              // 'enum' | 'text' | 'date' | 'daterange'
  values: (rows) => [...],   // valores presentes en los datos (F7). Solo para 'enum'.
  match: (row, value) => boolean,
}
```

`values` recibe las filas cargadas y devuelve los valores distintos presentes. Nunca una constante
del módulo (F7).

`match` es el predicado por fila. Se declara por faceta para que el componente no conozca la forma de
los datos de cada pantalla.

### 1.3 Combinación

Por F8, con `chips` agrupados por `facet`:

```
resultado = rows.filter(row =>
  cada grupo de facet =>  algún chip del grupo satisface match(row, chip.value)
)
```

OR dentro del grupo, AND entre grupos. Sin chips, devuelve el conjunto completo.

### 1.4 Invariantes

- Puro: sin DOM, sin red, sin estado global, sin dependencias npm nuevas.
- `values` no inventa opciones ausentes de los datos.
- Un `value` nulo o vacío no genera opción de faceta y no coincide con nada. No lanza.
- El orden de los chips no altera el resultado.

---

## 2. Facetas de Rendimiento

Fuente: `v_rendimiento_dashboard_rows` (52 columnas verificadas por `information_schema.columns`,
`AUDIT.md` §7.2).

| Faceta | Columna real | Estado | Notas |
|---|---|---|---|
| Unidad | `plate` | **Confirmada** | Consumida hoy por `buildUnitsFromSupabase`. Ver D-BLOQ-2. |
| Medida | `size_name` | **Confirmada** | Probada por el join `rt1.size_name = p.size_name`. |
| Modelo | `model_name` | **Confirmada** | Consumida hoy (`modelo` en el mapeo). |
| Condición | `condition` | **Confirmada** | `N`, `R1`, `R2`, `R3`, `R4`. Consumida hoy. |
| Diseño de reencauche | `retread_design` | **Confirmada** | Consumida hoy. |
| Eje | `axle_type` | **Confirmada** | `Direccional`, `Tracción`, `Libre`. De la migración vigente. |
| **Marca** | `brand_name` | **Confirmada** | Existe en la vista real (ordinal 15), heredada de `tire_casings.brand_name` vía `v_tire_performance` (`AUDIT.md` §7.1). `rendimiento.html` no la consume hoy, pero la columna está presente y pobla sin código nuevo. |
| Mes de última inspección | `last_inspection_on` | **Confirmada** | Agrupa por mes/año solo para acotar el conjunto; no representa consumo ocurrido en ese mes. |
| **Configuración** (`2-4-2`, `2-4`) | — | **RETIRADA del alcance de esta fase** | `vehicle_configs.notation` existe como tabla/columna, pero ningún join la trae a `v_rendimiento_dashboard_rows` ni a `v_tire_performance` (`AUDIT.md` §7.1, confirmado por `pg_get_viewdef`). Exponerla exige una migración aditiva (`join vehicle_configs vc on vc.id = u.config_id`), y **ninguna tarea de `STATE.md` (01–10) tiene permiso de archivo para escribirla** — task_01 no aplica DDL y task_07/08 tienen alcance propio (frescura, ventana temporal). Se retira en vez de ampliar el alcance de una tarea en silencio. Si el humano la quiere igual, es una migración de una línea a autorizar como las demás (`sync-migration-reviewer` + aprobación). |

### 2.1 Datos fuente del cálculo — no son facetas

Consumidos por `computeTire`, no filtrables:

`rtd_at_install_mm`, `current_rtd_mm`, `odometer_at_install`, `current_odometer_km`, `otd_mm`,
`rtd_removal_mm`, `cost`, `casing_km_accumulated`, `km_run`.

### 2.2 Columna de fecha requerida por `task_07` — ya existe

La frescura necesita la fecha de la última inspección de cada fila. **No hace falta migración**: la
columna ya existe como `last_inspection_on` (ordinal 21, `date`), heredada de `v_tire_performance`
(`k.last_inspection_on` en `AUDIT.md` §7.1). El nombre real es `last_inspection_on`, **no**
`last_inspected_on` como proponía el borrador — corregir antes de escribir `task_07`.

Distribución de frescura medida (única empresa con filas en esta vista, `AUDIT.md` §7.4): de 38
filas, 3 sin fecha, 11 con ≤30 días, **24 (63%) con más de 30 días** (rango 2026-02-20 a 2026-07-15,
hoy 2026-07-20). Un default de 30 días excluiría a la mayoría del conjunto ya pequeño. F12 lo permite
(default configurable, no fijo), pero el conteo de excluidos debe ser muy visible — no es un caso
de borde, es el caso típico con los datos actuales.

---

## 3. Facetas de Inspecciones

**Hallazgo de `task_01`, corrige la premisa del borrador.** `INSPECTIONS` en
`WEB/INSPECCIONES POR FECHA.html:313` se alimenta hoy de `v_fleet_unit_status`, que **ya es una fila
por unidad** (agregado server-side: `worst_rtd_mm`, `unit_status` = peor caso entre sus neumáticos).
No es la fuente correcta para F4 (Inspecciones lista **neumáticos**): agregar por unidad y luego
"desagregar" para filtrar sería derivar por heurística lo que ya está aplanado en otra vista.

La fuente correcta, verificada, es **`v_inspection_dashboard_rows`** (una fila por posición
medida; ya la consume `Inspecciones por unidad.html:817` con el mismo aislamiento
`security_invoker=true` + RLS, `AUDIT.md` §7.2–§7.3). `task_06` debe cambiar la fuente de
`v_fleet_unit_status` a `v_inspection_dashboard_rows` como parte del cambio estructural, no solo
aplanar el diccionario por fecha.

| Faceta | Columna real | Estado | Notas |
|---|---|---|---|
| Código de unidad | `plate` | **Confirmada** | Placa y código son equivalentes (petición humana). Una sola faceta, no dos. |
| Código de neumático | `tire_code` + `casing_code` | **Confirmada** | Ver §3.1. |
| Estado | `tire_status` | **Confirmada** | `critical`/`warning`/`normal`/`no_data`. D-BLOQ-3 resuelta y aplicada (§3.3): migración `20260720100000...sql`, verificado idéntico a `v_unit_tire_status.tire_status` sobre las 2247 filas reales. |
| Marca | `brand_name` | **Confirmada** | Valor capturado en la medición. |
| Modelo | `model_name` | **Pendiente de aplicar migración** | La migración `20260720154725_inspection_dashboard_model_facet.sql` lo expone de forma aditiva en la vista. |
| Medida | `size_name` | **Confirmada** | Valor capturado en la medición. |
| Condición | `condition` | **Confirmada** | `N`, `R1`, `R2`, etc. |
| Diseño de reencauche | `retread_design` | **Confirmada** | Por ejemplo, `IZE2W`. |
| Eje | `axle_type` | **Confirmada** | Direccional, Tracción o Libre, según la configuración de la unidad. |
| Fecha de inspección | `inspected_on` | **Confirmada** | Fecha exacta. Ver §3.2. |
| Mes de inspección | `inspected_on` | **Confirmada** | Mes/año que resuelve a sus fechas. Ver §3.2. |
| Estado de reencauche | `retread_observation` | **Confirmada** | `para_reencauche`/`proximo_a_reencauche`; las dos acciones se pueden buscar aunque el corte actual no tenga casos. |
| Desecho | `retread_observation` + `anomaly` | **Confirmada** | Ítem separado: `desecho` deriva de descarte manual o anomalía con `anomaly_catalog.desecho=true`; muestra la razón capturada. |

### 3.1 Código de neumático y `code_mismatch`

Medido sobre las 2247 filas actuales de `v_inspection_dashboard_rows` (`AUDIT.md` §7.5): **12 casos**
de `code_mismatch` (`casing_code` y `tire_code` ambos no nulos y distintos), 2189 filas sin
`casing_code` (sin ciclo de vida activo enlazado — dato real de este dataset, no un defecto del
filtro) y 331 sin `tire_code`.

El filtro de Inspecciones busca por ambos: un código encuentra el neumático por `tire_code` o por
`casing_code`. Un casco sin ningún código se muestra como `SIN CÓDIGO` y **no genera enlace falso**
(precedente de la fase anterior).

### 3.2 Fecha

Por F11, en Inspecciones la fecha es un filtro legítimo sobre `inspected_on` de cada fila: acá **sí**
existe la dimensión temporal. La limitación de `task_08` es de Rendimiento, no de Inspecciones.

Contrato actualizado por decisión humana F15: sin chip de fecha/unidad, se muestra la última fecha
global; con unidad, su última inspección. El corte se declara en el resumen y en el título del
conjunto. Un chip removible de fecha exacta o mes/año tiene precedencia y abre el histórico
explícitamente; el mes se resuelve a sus fechas reales desde el índice.

La carga usa un índice liviano de cabeceras (`inspections` + `units`) y consulta
`v_inspection_dashboard_rows` solo por la fecha o los `inspection_id` resueltos. No descarga las
2.247 mediciones históricas completas al entrar.

Riesgo (R3), resuelto: el alcance temporal vive en `WEB/shared/inspection-scope.js`, probado de
forma independiente; resumen y tarjetas reciben el mismo objeto de alcance.

### 3.3 D-BLOQ-1 y D-BLOQ-3 — Estado y observación de reencauche, RESUELTAS y APLICADAS 2026-07-20

`v_inspection_dashboard_rows` ahora expone `tire_status` y `retread_observation`
(`supabase/migrations/20260720100000_inspection_dashboard_tire_status_and_retread.sql`). Queda el
razonamiento original como registro de por qué hacía falta una migración y no alcanzaba con derivar
en cliente.

**Antes de la migración**, `v_inspection_dashboard_rows` no tenía un campo tri-estado. Lo que sí
tenía, verificado (`AUDIT.md` §7.6):

- `rtd_state` (enum): `Normal` / `Próximo a Reencauche` / `Para Reencauche` / `null`. Se calcula **una
  vez, al capturar la medición**, con `fn_rtd_state` sobre los umbrales efectivos de ese momento
  (`20260707120000...sql`, RPC `save_inspection`).
- `is_critical` (bool) = `is_discard OR fn_anomaly_is_severe(anomaly)`.
- `has_anomaly` (bool).

El tri-estado que la pantalla **ya muestra hoy** (`critical`/`warning`/`normal`, `STATUS_LABEL` en
`INSPECCIONES POR FECHA.html:356`) sale de `v_unit_tire_status.tire_status`
(`20260710200000...sql:119-131`), cuya rama principal compara `rtd_movi_mm` contra los umbrales
**vigentes ahora** (`fn_effective_rtd_thresholds`, evaluados en cada consulta) y solo cae al `enum`
congelado si no hay `rtd_movi_mm`/umbral disponible.

**El problema:** `rtd_state` en `v_inspection_dashboard_rows` es el valor **congelado en el momento de
captura**. Si los umbrales de RTD de una empresa cambian después (son configurables por
`specs/reglas_fijas_vs_configurables.md`), un neumático puede quedar mostrando un estado que ya no
coincide con lo que `v_unit_tire_status` — la misma fuente que hoy pinta de rojo/amarillo el resto del
dashboard — diría en este momento. Recalcular el tri-estado en el cliente combinando `rtd_state` +
`is_critical` + `has_anomaly` **duplicaría** una lógica que este mismo repositorio ya tuvo que mover a
SQL por un bug de exactamente este tipo (`20260710220000...sql`, título: *"tire_status ignoraba
anomalías no-críticas"*). Repetirla en JS reabre la misma clase de bug que esa migración cerró.

Con los datos actuales el riesgo es medible pero no cero: 0 filas con `is_critical=true` en todo el
dataset (2247 filas), 50 filas en `rtd_state='Para Reencauche'` — que en un derivado ingenuo serían
"crítico", coincidiendo hoy con la rama de umbral congelado, pero sin garantía de seguir coincidiendo
si los umbrales cambian.

**No es una decisión que `task_01` pueda tomar sola** (no aplica DDL) **ni que `task_06` pueda resolver
dentro de su alcance de archivos** (solo `WEB/INSPECCIONES POR FECHA.html`, sin migración). Se
registra como decisión abierta en `DECISIONES.md`.

---

## 4. Contrato de agregación (`computeGroup`)

```js
computeGroup(tires) → {
  total, valid, excluded,            // F10: excluidos visibles
  avgKmMm, avgPct, avgKmProyectado,
  totalKmAcumulado,
  avgCostoKm,
  best, worst,
}
```

- Matemática **idéntica** a `computeAxle`: promedio simple sobre los válidos, suma para acumulado.
  Esta fase no cambia fórmulas.
- `valid === 0` → métricas en `null`, nunca `0`, y la UI dice que no hay datos suficientes.
- `excluded` es obligatorio en el retorno y debe mostrarse (F10).
- El balance izquierda/derecha de `computeAxle` **se conserva solo donde el conjunto es un eje**.
  Sobre un conjunto arbitrario (todos los Michelin de la flota) no tiene significado y se omite.
- Cualquier divergencia numérica contra `computeAxle` sobre el mismo eje invalida la refactorización
  (`task_04`).

---

## 5. Contrato de frescura

```js
{ key: 'freshness', days: 30 }   // F12: default 30, configurable, no hardcodeado en el componente
```

- Excluye del **agregado** las filas cuya `last_inspection_on` (nombre real, §2.2) supere `days`.
- Las filas excluidas por frescura se cuentan aparte de las excluidas por `valid:false` (F10). Son
  dos razones distintas y confundirlas oculta cuál es el problema real de los datos.
- Chip para incluir las rancias explícitamente.

---

## 6. Fuera de contrato

- Ventana temporal de consumo: `task_08`, con vista propia. No se promete antes.
- Escritura de cualquier tipo. Esta fase es de lectura, como la anterior.
- Fuzzy matching, stemming y sinónimos. `WEB/shared/search.js` es substring con AND entre tokens, y
  eso no cambia acá.

---

## 7. Seguridad — grant a `anon` (AUDIT.md §2.6), verificado empíricamente

Petición REST real con la clave `anon` publicable del proyecto, sin sesión, contra las tres vistas
involucradas en esta fase:

```
GET /rest/v1/v_rendimiento_dashboard_rows?select=installation_id&limit=5   → HTTP 200, []
GET /rest/v1/v_inspection_dashboard_rows?select=inspection_id&limit=5      → HTTP 200, []
GET /rest/v1/v_fleet_unit_status?select=unit_id&limit=5                    → HTTP 200, []
```

Cero filas en las tres. El `grant ... to anon` a nivel de objeto sigue siendo más amplio de lo
necesario (deuda ya registrada en `AUDIT.md` §2.6), pero RLS por empresa bloquea correctamente sin
sesión. **No es incidente.** No se corrige acá — fuera de alcance de esta fase, igual que antes.

No verificado en esta tarea (requiere sesión autenticada de una empresa real, que `task_01` no tiene):
aislamiento cruzado entre dos empresas y comparación fila-a-fila contra `count(*)` para descartar
truncado por `max-rows`. Los volúmenes medidos (§ arriba, máximo 903 filas) están muy por debajo de
cualquier límite típico, así que el riesgo es bajo, pero queda como verificación pendiente para el
smoke autenticado de `task_09`.
