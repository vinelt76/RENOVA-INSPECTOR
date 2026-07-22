# AUDIT — Filtros facetados en Inspecciones y Rendimiento

Fecha: 2026-07-19. Auditoría local previa al plan. Evidencia obtenida leyendo código y migraciones
del repositorio; lo que requiere confirmación contra la base remota está marcado como tal y es
trabajo de `task_01`.

## 1. Reencuadre del pedido

La petición humana pide «dos buscadores con el mismo componente de filtro con autocomplete tipo
chips», configurado distinto por pantalla. La auditoría concluye que **el componente es la parte
fácil y no es donde está el riesgo**. El riesgo está en que las dos pantallas destino no son listas
filtrables hoy, y en que una de las capacidades pedidas no tiene datos que la soporten.

Distinción que gobierna toda la fase, y que no debe perderse:

- El **buscador global** (fase anterior, `tasks_buscador_global/`) **enruta**: encuentra un objeto y
  te lleva a él. Un resultado, una navegación.
- El **filtro facetado** (esta fase) **reduce**: acota un conjunto y recalcula sobre lo que queda.
  Muchos resultados, ninguna navegación obligatoria.

Comparten el vocabulario de facetas y la mecánica de chips. **No comparten destino ni modelo.** No
son «dos buscadores»: son un filtro reutilizado en dos pantallas, y ya existe un buscador aparte.

## 2. Estado de Rendimiento (`WEB/rendimiento.html`)

### 2.1 Lo que la pantalla es hoy

No es una lista. Es un detalle jerárquico de tres niveles:

```text
unitSelect (una unidad)  →  tabs de eje  →  pills de posición  →  detalle de 1 neumático
```

Referencias: `unitSelect` en `WEB/rendimiento.html:353`, `axleSelectorBlock` en `:361`,
`posSelectorBlock` en `:371`, `initSelectionForUnit()` en `:981`.

Filtrar por marca, modelo, condición, medida o diseño de reencauche **no tiene significado sobre una
sola posición**. Las facetas pedidas presuponen un conjunto. Por eso la fase convierte la pantalla,
no le agrega una barra.

### 2.2 Lo que sí se puede reutilizar tal cual

`computeTire(t)` (`WEB/rendimiento.html:~500`) es una **función pura por neumático**: recibe los
datos fuente de una posición y devuelve `{valid, rtdGastado, kmRecorrido, pctConsumo, kmMm,
kmProyectado, costoKm, kmAcumulado}`. No depende de la unidad seleccionada ni del eje. Se puede
invocar sobre cualquier conjunto sin tocarla.

`computeAxle(unit, axle)` ya hace exactamente la agregación que la fase necesita —promedio de
`kmMm`, `pctConsumo`, `kmProyectado`, suma de `kmAcumulado`, mejor y peor posición, balance
izquierda/derecha— pero **acoplada a `axle.positions`**. Generalizarla a `computeGroup(tires[])` es
cambiar la fuente de entrada, no la matemática.

Esto es el hallazgo favorable de la auditoría: **la agregación pedida ya está escrita y validada.**
Lo que falta es desacoplarla de la jerarquía unidad→eje→posición.

Invariantes de `computeTire` que la fase no puede degradar:

- `valid:false` cuando faltan datos fuente, con métricas en `null`. **Nunca 0 como reemplazo.**
- `rtdGastado > 0` y `kmRecorrido > 0` son condición de validez. Un neumático sin desgaste o sin
  recorrido no rinde «0», no rinde **nada**, y queda fuera del promedio.
- `rtdRetiro` viene de `rtd_thresholds` por empresa. Nunca hardcodeado (`CLAUDE.md`).

Al agregar sobre un conjunto arbitrario, la regla de exclusión de inválidos debe conservarse y el
conteo de excluidos debe ser **visible**, no silencioso: promediar 40 neumáticos mostrando el
resultado de 12 sin decirlo es un dato falso.

### 2.3 Origen de datos y su límite duro

`loadSupabaseData()` consume `v_rendimiento_dashboard_rows` vía `RenovaSupabase.fetchView`, ordenado
por `plate.asc,position_number.asc`. Sin paginación explícita.

La vista se define en `supabase/migrations/20260710160000_rendimiento_view_has_anomaly.sql`. Su
propio comentario la describe: **«Fila por instalación activa con datos FUENTE (instalación + última
inspección)»**. El `left join lateral` que trae la inspección termina en `order by i.inspected_on
desc limit 1`.

Consecuencia, y es el hallazgo central de la auditoría:

> **La vista no tiene dimensión temporal. Tiene una foto del estado actual.**

Lo que se puede preguntar hoy: «¿cuánto lleva consumido este neumático **desde que se instaló**?».

Lo que **no** se puede preguntar: «¿cuánto consumieron los Michelin **en mayo**?». Eso exige dos
mediciones de RTD dentro de la ventana, y la vista colapsa el historial a la última. El dato existe
en `inspection_measurements` —la vista lo descarta al hacer `limit 1`—, pero recuperarlo es una vista
nueva, no un filtro.

### 2.4 Frescura: por qué filtrar por fecha aquí no alcanza

La petición humana propone «que los rendimientos se basen en inspecciones que no sean de más de
1 mes, así mantenemos los datos actualizados». La intención es correcta y el problema que señala es
real, pero el mecanismo no funciona sobre esta vista.

Hoy la fila de un neumático existe aunque su última inspección sea de hace seis meses, y
`computeTire` usa ese RTD viejo igual. Filtrar por fecha sobre `v_rendimiento_dashboard_rows`
**esconde filas, no recalcula nada**. Es una mejora de honestidad —dejás de mezclar datos rancios
con frescos—, no de exactitud del cálculo.

Ambas cosas valen la pena y son tareas distintas. La fase las separa (`task_07` frescura,
`task_08` ventana temporal) en vez de fingir que una resuelve la otra.

### 2.5 Deuda de esquema descubierta

**`v_tire_performance` no se crea en ninguna migración.** Se referencia en
`20260707120000_run6_...sql` y `20260710160000_...sql`, y `v_rendimiento_dashboard_rows` la expande
con `p.*`, pero su DDL no está en la cadena versionada.

La única definición en el repo está en `supabase/schema_draft.sql` y **está desactualizada**: usa
una tabla `tires` con `size_id`, mientras la vista real expone `size_name` (lo prueba el join
`rt1.size_name = p.size_name` en la migración vigente) y `casing_id`/`casing_code`/
`casing_km_accumulated` (los consume `buildUnitsFromSupabase`).

Impacto para esta fase: **la lista de columnas disponibles para facetas no se puede deducir del
repositorio.** `task_01` la verifica contra la base real antes de que nadie escriba una faceta.
Impacto general: es deuda preexistente y ajena a esta fase; se registra, no se arregla acá.

### 2.6 Observación de seguridad, preexistente

`20260710160000_rendimiento_view_has_anomaly.sql` cierra con:

```sql
grant select on public.v_rendimiento_dashboard_rows to anon, authenticated;
```

Concede a `anon`, a diferencia de `v_search_index` (solo `authenticated`, límite duro de la fase
anterior). Con `security_invoker = true` y RLS por empresa, un `anon` sin `current_company_id()` no
debería recuperar filas — pero la concesión es más amplia de lo necesario y contradice el criterio
ya adoptado.

**No es alcance de esta fase.** Se registra como deuda y se verifica empíricamente en `task_01`
(REST con clave anónima debe devolver 401 o 0 filas). Si devolviera datos, deja de ser deuda y pasa
a incidente: la fase se detiene y se reporta.

## 3. Estado de Inspecciones (`WEB/INSPECCIONES POR FECHA.html`)

`dateSelect` (`:255`) no es un filtro: es la **llave del render**. `INSPECTIONS` es un diccionario
indexado por fecha y `currentUnits()` devuelve `INSPECTIONS[selectedDate] || []` (`:359`). Sin fecha
seleccionada no hay nada que mostrar; el listener en `:514` reconstruye toda la pantalla.

Las filas son **unidades**. La decisión humana de esta fase es que pasen a ser **neumáticos**, con su
unidad y posición como atributos. Eso reordena el render y elimina la lógica de «unidad que contiene
al menos un neumático que cumple».

Convertir la fecha en un chip más exige desacoplarla de la indexación. Es la tarea de mayor riesgo de
regresión de la fase, porque toca una pantalla en uso.

## 4. Activos reutilizables de la fase anterior

- `WEB/shared/search.js` — normalización (`NFD`, strip de diacríticos, `toLocaleLowerCase("es")`,
  colapso de espacios) y tokenización con AND entre tokens. Unificada y con pruebas propias
  (`task_04` de la fase anterior). **Se reutiliza; no se vuelve a copiar.**
- `WEB/buscador/finder-controller.js` — patrón de teclado y `combobox`/`listbox` accesible ya
  validado en 390×844. Sirve de referencia de comportamiento para el autocomplete, no de
  dependencia: el filtro no abre overlay.
- `WEB/movimientos/a11y.js` — utilidades de foco. Aplicables si el desplegable las necesita.
- `WEB/neumaticos/` (`task_13` anterior) — **precedente directo**: ya implementa facetas AND con
  chips removibles y estado en URL con `pushState`. La fase debe leerlo antes de diseñar nada y
  **convergir con él**, no inventar una segunda mecánica de chips.
- `v_search_index` con facetas (`20260719180841_search_index_facets.sql`) — expone `brand_name`,
  `model_name`, `size_name`, `condition`, `retread_design`. Es el vocabulario de facetas que pide
  Rendimiento, ya modelado, aunque para otro consumidor.

## 5. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Rendimiento pierde el flujo unidad→eje→posición que alguien usa a diario | `task_05` conserva el detalle como destino al abrir una fila, y «unidad» queda como faceta. Requiere confirmación humana (D-BLOQ-2). |
| R2 | Promediar sobre conjuntos con muchos `valid:false` da una cifra engañosa | Conteo de excluidos visible junto a cada agregado. Invariante de `task_04`. |
| R3 | Desacoplar `dateSelect` rompe Inspecciones en producción | `task_06` aislada, con smoke obligatorio y rollback de un solo archivo. |
| R4 | Se implementa «consumo de mayo» sobre datos que no lo soportan | `task_08` separada y explícitamente bloqueada hasta tener la vista temporal. Ninguna tarea anterior promete ventanas. |
| R5 | Nace una segunda mecánica de chips divergente de `WEB/neumaticos/` | `task_02` obliga a leer y converger; si diverge, se detiene. |
| R6 | Las facetas se escriben contra columnas que no existen | `task_01` verifica contra la base real antes de escribir código. |
| R7 | Las bandas de reencauche se inventan | D-BLOQ-1: `CLAUDE.md` prohíbe inventar umbrales. La sub-faceta se omite hasta que un humano las defina. |

## 6. Conclusión

El componente de filtro es trabajo acotado y de bajo riesgo, apoyado en primitivas ya escritas y
probadas. Lo que la fase realmente decide es **qué es cada pantalla**: Rendimiento deja de ser un
detalle jerárquico y pasa a ser una agregación sobre un conjunto filtrado; Inspecciones deja de
listar unidades y pasa a listar neumáticos.

De las capacidades pedidas, todas son alcanzables salvo el consumo por ventana temporal, que
requiere modelo de datos nuevo y queda aislado al final para no bloquear el resto.

## 7. Evidencia remota — `task_01`, 2026-07-20, proyecto `fbxupwwgiebhlciqftpw`

Consultas de solo lectura (`information_schema`, `pg_get_viewdef`, conteos) más peticiones REST
reales con la clave `anon` publicable. Sin `service_role`, sin volcar filas completas.

### 7.1 `v_tire_performance` — definición real (F14, se documenta, no se migra)

No está en la cadena de migraciones (confirma AUDIT §2.5). `pg_get_viewdef` sobre el objeto real:

Fuente `v_installation_km` (tampoco versionada) filtrada `where not removed`, join a
`tire_life_cycles`, `tire_casings` (de acá salen `brand_name`, `model_name`, `size_name`,
`casing_code`), `units`, más laterales a `rtd_thresholds` (para `rtd_removal_mm`) y a sí misma dos
veces para acumular km de ciclo y de casco. Expone `last_inspection_on` (`date`) directo desde
`v_installation_km.last_inspection_on`. **No** hace join a `vehicle_configs`: la notación
(`2-4-2`/`2-4`) no está disponible en ningún punto de esta cadena.

### 7.2 Columnas reales confirmadas

- `v_rendimiento_dashboard_rows`: 52 columnas. Incluye `brand_name`, `model_name`, `size_name`,
  `condition`, `retread_design`, `axle_type`, `casing_code`, `code_status`, `last_inspection_on`. No
  incluye ninguna columna de configuración/notación.
- `v_inspection_dashboard_rows`: 41 columnas. Incluye `tire_code`, `casing_code`, `code_status`,
  `brand_name`, `size_name`, `condition`, `retread_design`, `rtd_state`, `rtd_a_state..d_state`,
  `pressure_state`, `pressure_state_fixed`, `has_anomaly`, `anomaly_is_severe`, `is_critical`,
  `is_discard`. No incluye un campo tri-estado equivalente a `tire_status`.
- `v_unit_tire_status`: 23 columnas, incluye `tire_status` (`critical`/`warning`/`normal`/`no_data`,
  calculado contra umbrales vigentes) pero no incluye `casing_code`/`code_status`.
- `vehicle_configs`: `id, vehicle_type, notation, is_mvp, created_at`. La tabla y la columna
  `notation` existen; ninguna vista de esta fase la expone.

### 7.3 Volumen por empresa

- `v_rendimiento_dashboard_rows`: **una sola empresa con filas** (38 filas, ~13.6 KB). Las otras
  empresas activas no tienen instalaciones que la vista considere (`where not removed` sobre
  `v_installation_km`) — dato real del dataset actual, deuda preexistente ajena a esta fase.
- `v_inspection_dashboard_rows`: 3 empresas, 903 / 824 / 520 filas (total 2247).

Ambos volúmenes son triviales para filtrado en cliente (F9); no hay indicio de que haga falta
paginar ni mover el filtrado a servidor.

### 7.4 Distribución de frescura (`v_rendimiento_dashboard_rows.last_inspection_on`)

De 38 filas: 3 sin fecha, 11 con ≤30 días, **24 (63%) con más de 30 días**. Rango 2026-02-20 a
2026-07-15 (consulta corrida 2026-07-20). Detalle y consecuencia para `task_07` en
`CONTRATOS_DATOS.md` §2.2.

### 7.5 `code_mismatch` en `v_inspection_dashboard_rows`

Sobre 2247 filas: 12 con `casing_code` y `tire_code` ambos no nulos y distintos; 2189 sin
`casing_code`; 331 sin `tire_code`. Detalle en `CONTRATOS_DATOS.md` §3.1.

### 7.6 Valores crudos de estado

- `condition` (Inspecciones/Rendimiento): `N`, `R1`, `R2`, `R3`, `R4`.
- `rtd_state`: `Normal`, `Próximo a Reencauche`, `Para Reencauche`, `null`.
- `pressure_state` observado en los datos actuales: `Sin Medir`, `null` (ninguna fila con presión
  medida cae en `Normal`/`Baja Presión`/`Alta Presión` todavía — dato del dataset, no del enum).
- Distribución `is_critical` × `rtd_state` × `has_anomaly` sobre 2247 filas: 0 filas con
  `is_critical=true`; `rtd_state='Para Reencauche'` en 50 filas (47 sin anomalía + 3 con); resto
  `Normal`/`Próximo a Reencauche`/`null`. Detalle de por qué esto no basta para armar el tri-estado de
  la UI en `CONTRATOS_DATOS.md` §3.3 (D-BLOQ-3).
- El tri-estado hoy visible en pantalla (`critical`/`warning`/`normal`) son los valores reales de
  `v_unit_tire_status.tire_status` / `v_fleet_unit_status.unit_status`, ya usados por
  `STATUS_LABEL` en `INSPECCIONES POR FECHA.html:356`. Confirmados como los "tres valores" que
  pedía el enunciado humano, aunque la vista de origen que `task_06` debe usar (`v_inspection_dashboard_rows`)
  no los trae listos — ver D-BLOQ-3.

### 7.7 Grants y verificación anónima real

`information_schema.role_table_grants` confirma `SELECT` a `anon` en las cinco vistas de esta fase
(`v_rendimiento_dashboard_rows`, `v_inspection_dashboard_rows`, `v_unit_tire_status`,
`v_fleet_unit_status`, `v_fleet_status_summary`) — el mismo patrón ya señalado como deuda en §2.6,
ahora confirmado también en las vistas de Inspecciones, no solo en Rendimiento.

Verificación empírica con REST real (clave `anon`, sin sesión), no solo grants declarados:

```
GET .../v_rendimiento_dashboard_rows?select=installation_id&limit=5  → 200, []
GET .../v_inspection_dashboard_rows?select=inspection_id&limit=5     → 200, []
GET .../v_fleet_unit_status?select=unit_id&limit=5                   → 200, []
```

RLS bloquea correctamente sin `current_company_id()`. **No es incidente**; sigue siendo deuda de
alcance amplio en el `GRANT`, fuera del alcance de esta fase.

### 7.8 No verificado (limitación de esta tarea)

Sin credenciales de una sesión autenticada de empresa real, no se pudo repetir el paso de
aislamiento cruzado entre dos empresas ni la comparación fila-a-fila contra `count(*)` para
descartar truncado por `max-rows` (precedente `tasks_buscador_global/task_03`). Volúmenes medidos
(§7.3) muy por debajo de límites típicos de PostgREST; riesgo estimado bajo. Queda como verificación
pendiente del smoke autenticado en `task_09`.
