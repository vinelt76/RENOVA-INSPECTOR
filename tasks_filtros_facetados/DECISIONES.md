# DECISIONES — Filtros facetados

Decisiones vigentes de la fase. Numeración `F` (filtros) para no colisionar con las `D` de
`tasks_buscador_global/`. **Ningún ejecutor deroga una decisión.** Si una tarea parece exigirlo, se
detiene y se registra acá con aprobación humana explícita.

Origen: sesión de planificación con la persona responsable, 2026-07-19.

---

## F1 — Un componente, dos configuraciones

El filtro es **un solo módulo** (`WEB/shared/filter-bar.js`) parametrizado por pantalla. No hay una
versión para Inspecciones y otra para Rendimiento.

**Por qué.** Petición humana explícita: «mismo componente reutilizado, no dos sistemas separados».
La divergencia entre las dos copias de la primitiva de búsqueda que `task_04` de la fase anterior
tuvo que unificar es el precedente que se evita repetir.

## F2 — El filtro reduce, el buscador enruta

Esta fase **no toca** `WEB/buscador/`. El buscador global encuentra un objeto y navega hacia él; el
filtro acota un conjunto en la pantalla actual y recalcula sobre lo que queda.

Comparten `WEB/shared/search.js` y el vocabulario de facetas. No comparten overlay, ni destino, ni
estado.

**Por qué.** Mezclarlos produce un componente que hace dos cosas a medias. La fase anterior cerró con
ADR-0005 y la regla «enruta, no ejecuta»; esta fase respeta esa frontera desde el otro lado.

## F3 — Rendimiento pasa a ser una pantalla de búsqueda

Decisión humana literal: la pantalla arranca **solo con el buscador**, sin unidad preseleccionada ni
elementos de detalle visibles. Al escribir se acumulan filtros y aparecen sugerencias; los cálculos
de rendimiento se recalculan **sobre el conjunto que queda**.

Ejemplo de la persona responsable: buscar `tracción` da el rendimiento agregado de todos los
neumáticos de tracción; agregar `Michelin` lo reduce a esa marca.

**Por qué.** Las facetas pedidas (marca, modelo, condición, medida, reencauche) no tienen
significado sobre una sola posición. Ver `AUDIT.md` §2.1.

**Consecuencia.** El detalle actual (eje, posición, panel de datos fuente) no desaparece: pasa a ser
lo que se abre al elegir una fila del resultado.

## F4 — Inspecciones lista neumáticos

Las filas pasan de unidades a **neumáticos**, con unidad y posición como atributos de la fila.

**Por qué.** Decisión humana. Los chips de estado y de observación de reencauche aplican directo a la
fila, sin la lógica ambigua de «unidad que contiene al menos un neumático que cumple».

## F5 — Autocomplete tipado, sin prefijos obligatorios

Cuando un texto puede ser placa de unidad o código de neumático, el desplegable muestra ambas
opciones **agrupadas por tipo** y la persona elige. El chip resultante queda tipado.

**Por qué.** Decisión humana. Es el mismo criterio que ya usa el buscador global y no obliga a
aprender sintaxis. No se prohíben prefijos como atajo futuro, pero **no son requisito de uso**.

## F6 — Sin interpretación silenciosa

Todo filtro aplicado es un chip visible y removible. Nada se infiere del texto libre sin mostrarlo.

**Por qué.** Hereda D8 de la fase anterior. Si el usuario no ve por qué el conjunto se redujo, el
número agregado que ve al lado no es interpretable.

## F7 — Las sugerencias salen de los datos cargados

El autocomplete ofrece **solo valores que existen** en las filas efectivamente cargadas para la
empresa activa. No hay catálogo hardcodeado de marcas ni de diseños.

**Por qué.** `CLAUDE.md`: catálogos viven en datos, no en componentes. Además evita ofrecer un filtro
que devuelve cero resultados siempre.

**Consecuencia aceptada.** Si la empresa no tiene ningún Hankook, «Hankook» no se sugiere. Es
correcto: refleja los datos reales, no un catálogo aspiracional.

## F8 — Semántica de combinación: OR dentro, AND entre

Dos chips de la misma faceta se combinan con **OR** (`Michelin` ∪ `Hankook`). Chips de facetas
distintas se combinan con **AND** (`Michelin` ∩ `tracción`).

**Por qué.** Es la semántica estándar de filtros facetados y la que ya usa `WEB/neumaticos/`. Lo
contrario (`Michelin` ∩ `Hankook`) da vacío siempre y ningún usuario lo pide.

## F9 — Todo el filtrado ocurre en cliente

No hay endpoints nuevos, ni índices nuevos, ni `pg_trgm`, ni parámetros de filtro enviados a
PostgREST. Las filas se traen como hoy y se filtran en memoria.

**Por qué.** Los volúmenes lo permiten (`v_rendimiento_dashboard_rows` son cientos de filas por
empresa; Inspecciones ya carga su dataset completo). Filtrar en servidor agrega latencia por
pulsación y complejidad de estado sin beneficio medible a esta escala.

**Límite explícito.** Si `task_01` mide un payload que hace inviable el filtrado en cliente, se
detiene y se decide de nuevo. No se «arregla» paginando en silencio.

## F10 — Los inválidos se excluyen y se cuentan a la vista

Al agregar sobre un conjunto, los neumáticos con `valid:false` quedan fuera del promedio —como hoy
hace `computeAxle`— y la cantidad excluida **se muestra**.

**Por qué.** Promediar 40 neumáticos y mostrar el resultado de 12 sin decirlo es un dato falso. El
invariante de `computeTire` de no inventar 0 se vuelve más importante, no menos, cuando el conjunto
es grande y nadie puede verificarlo a ojo.

## F11 — Frescura y ventana temporal son cosas distintas

**Frescura** (`task_07`): excluir del agregado los neumáticos cuya última inspección supera N días.
Filtra filas; no cambia el cálculo.

**Ventana temporal** (`task_08`): calcular el consumo *ocurrido dentro* de un rango de fechas. Exige
dos mediciones de RTD dentro de la ventana y una vista nueva sobre `inspection_measurements`.

**Por qué.** `v_rendimiento_dashboard_rows` colapsa el historial a la última inspección
(`AUDIT.md` §2.3). Filtrar por fecha sobre ella esconde filas, no recalcula nada. Tratarlas como una
sola cosa produciría una pantalla que responde «de mayo a junio» con datos que no son de ese rango.

**Consecuencia.** Hasta que `task_08` esté aprobada, la UI **no ofrece** selección de rango en
Rendimiento. Ofrecer un control que miente es peor que no ofrecerlo.

## F12 — Umbral de frescura configurable, con default de 30 días

El valor por defecto es 30 días, alineado con la intención humana («que no sean de más de 1 mes»),
pero vive en configuración, no en el componente.

**Por qué.** `CLAUDE.md`: umbrales en datos. Además, 30 días es una hipótesis operativa razonable,
no una regla de negocio aprobada en `specs/`.

## F13 — Historial reciente en `localStorage`, por pantalla

Sin backend, sin tabla nueva. Aislado por `user_id` + `company_id` y purgado en `SIGNED_OUT`, igual
que la frecency de `task_10` de la fase anterior.

**Por qué.** La web estática no tiene identidad propia más allá de la sesión Supabase. Persistir por
usuario en servidor exigiría tabla, RLS y sync para un beneficio marginal.

## F14 — La deuda de `v_tire_performance` se registra, no se arregla

Que la vista no esté en la cadena de migraciones (`AUDIT.md` §2.5) es deuda preexistente. Esta fase
la documenta y verifica sus columnas reales; **no** la migra.

**Por qué.** Regularizarla es una fase de esquema con su propia revisión. Mezclarla acá amplía el
alcance y el riesgo sin relación con lo pedido.

## F15 — Inspecciones representa el último estado salvo fecha explícita

Decisión humana del 2026-07-19. Sin chip de fecha ni unidad, `INSPECCIONES POR FECHA.html` muestra
solo los neumáticos de la fecha de inspección global más reciente. Con una o varias unidades,
muestra únicamente la última inspección disponible de cada unidad. El resumen siempre se calcula
sobre ese mismo corte visible.

Un chip de fecha tiene precedencia y es la salida explícita para consultar historia. Así, buscar
una unidad no mezcla neumáticos que pasaron por ella en meses distintos, pero el histórico sigue
siendo alcanzable cuando la persona lo pide.

**Por qué.** El uso normal es revisar cómo quedó la unidad en su inspección más reciente o entrar a
Movimientos. Mezclar inspecciones históricas parece un estado actual duplicado y puede inducir a
actuar sobre una posición vieja. Además, el cliente deja de descargar las 2.247 filas completas:
carga un índice liviano de 288 inspecciones y luego solo las 15 filas de la última fecha actual.

---

## Decisiones abiertas — bloquean tareas

### D-BLOQ-1 — Bandas de observación de reencauche

**Estado: RESUELTA 2026-07-20.** Confirmado con la persona responsable: «desecho» no es un tercer
corte de RTD, es la misma condición que ya decide `is_critical` (`is_discard` o anomalía grave del
catálogo, `fn_anomaly_is_severe`). «Para reencauche» y «próximo a reencauche» salen de los umbrales
`rtd_change_mm`/`rtd_next_mm` ya configurables por empresa/medida en `rtd_thresholds` (el ejemplo dado
por la persona responsable — «a 4mm para reencauche, de 4 a 8 próximo a reencauche» — coincide con
esos dos umbrales). Ningún valor nuevo ni hardcodeado. Implementado en la columna
`retread_observation` de `v_inspection_dashboard_rows`
(`supabase/migrations/20260720100000_inspection_dashboard_tire_status_and_retread.sql`), **APLICADA
al remoto 2026-07-20** con autorización explícita del humano (ver evidencia en `STATE.md` fila 01).

<details><summary>Redacción original (histórico)</summary>

**Estado: SIN RESUELTO. Bloqueaba parcialmente `task_06`.**

La petición pide en Inspecciones un filtro de «observación de reencauche» con valores *para
reencauche*, *próximo a reencauche*, *desecho*.

Verificación hecha: esos valores **no existen** en ninguna migración, spec, catálogo ni módulo del
repositorio. No hay enum, ni columna, ni función que los produzca. Son una clasificación derivada de
RTD contra los umbrales de `rtd_thresholds`, y las bandas que separan una categoría de otra no están
definidas en ningún lado.

`CLAUDE.md` prohíbe inventar o hardcodear umbrales.

**Se necesita del humano una de dos:** los cortes de RTD que separan las tres categorías, o el campo
existente que ya las decide si la clasificación la hace otra persona o sistema.

**Mientras no se resuelva:** `task_06` implementa las demás facetas y **omite** esta. No se inventa
una banda provisional «para probar»: una vez en pantalla, un umbral inventado se convierte en el
umbral real de la operación.

</details>

### D-BLOQ-2 — Desaparición del selector de unidad en Rendimiento

**Estado: RESUELTA 2026-07-20.** Confirmado con la persona responsable: el selector dedicado
desaparece; conservar la capacidad como **faceta** `unidad` (F3, propuesta de la auditoría). `task_05`
queda desbloqueada.

<details><summary>Redacción original (histórico)</summary>

**Estado: SIN RESUELTO. Bloqueaba `task_05`.**

F3 elimina el selector de unidad. La persona responsable lo indicó explícitamente («cosa que ya no se
hará»).

La auditoría señala el riesgo (R1): es la forma en que la pantalla se usa hoy, y quien entra a mirar
una unidad concreta perdería su flujo.

**Propuesta de la auditoría:** conservar la capacidad como **faceta** —un chip `unidad: ABC-123`
reduce el conjunto a esa unidad y el agregado se vuelve el de esa unidad— en vez de eliminarla. El
flujo sobrevive, sin selector dedicado y sin excepción en el modelo.

**Se necesita del humano:** confirmar que la faceta `unidad` cubre el caso, o indicar que el flujo
por unidad debe conservarse como acceso propio.

`task_05` no arranca sin esta respuesta.

</details>

### D-BLOQ-3 — Estado del neumático en Inspecciones: falta la columna, no el dato

**Estado: RESUELTA 2026-07-20 (opción 1: migración aditiva).** La persona responsable eligió extender
`v_inspection_dashboard_rows` con la misma lógica de `v_unit_tire_status.tire_status`, en vez de
derivar en cliente o retirar la faceta. Implementado junto con D-BLOQ-1 en
`supabase/migrations/20260720100000_inspection_dashboard_tire_status_and_retread.sql`, revisado por
`sync-migration-reviewer` (aprobado con observaciones menores de documentación, corregidas),
**APLICADA al remoto 2026-07-20**. Verificado sobre las 2247 filas reales: `tire_status` coincide
**exactamente** con `v_unit_tire_status.tire_status` en las 4 categorías (`normal` 1626,
`warning` 565, `critical` 50, `no_data` 6) — cero divergencias. Grants sin cambio; `anon` sigue sin
ver filas (verificado con REST real post-migración). `task_06` puede implementar la faceta «Estado».

<details><summary>Redacción original (histórico)</summary>

**Estado: SIN RESUELTO. Bloqueaba la faceta «Estado» de `task_06`. Añadida por `task_01`, 2026-07-20.**

Hallazgo de la verificación remota (`CONTRATOS_DATOS.md` §3.3, `AUDIT.md` §7.6): la vista que
`task_06` debe usar para listar neumáticos (`v_inspection_dashboard_rows`) no tiene el campo
tri-estado (`critical`/`warning`/`normal`) que la pantalla ya muestra hoy. Ese cálculo vive en otra
vista (`v_unit_tire_status.tire_status`), que compara contra los umbrales de RTD **vigentes en el
momento de la consulta**. La única señal de estado que sí trae `v_inspection_dashboard_rows`
(`rtd_state`) quedó **congelada en el momento de la captura** — puede desalinearse si los umbrales de
la empresa cambian después, y este repositorio ya corrigió una vez un bug de exactamente esa clase
(`20260710220000_fix_tire_status_anomaly_warning_floor.sql`).

No es una decisión que ninguna tarea vigente pueda resolver dentro de su alcance de archivos:
`task_01` no aplica DDL, y `task_06` solo tiene permiso sobre
`WEB/INSPECCIONES POR FECHA.html` — ninguna migración incluida.

**Opciones para el humano:**

1. **Extender `v_inspection_dashboard_rows`** con el mismo `case` que ya usa `v_unit_tire_status`
   (aditivo, mismo patrón que `20260719180841_search_index_facets.sql`). Cero riesgo de divergencia,
   pero exige una migración nueva y su propia autorización de aplicación remota — mismo trámite que
   `task_07`/`task_08` (`sync-migration-reviewer` + aprobación explícita).
2. **Aceptar el derivado en cliente** desde `rtd_state` + `is_critical` + `has_anomaly`, documentando
   el riesgo de desalineación si cambian los umbrales, como limitación conocida a revisar después.
3. **Retirar la faceta «Estado»** de `task_06` por ahora, igual que se retiró «Configuración» de
   Rendimiento (ver más abajo), y agregarla en una fase posterior junto con la migración.

`task_06` no implementa la faceta «Estado» hasta que el humano elija una de las tres.

</details>

## Deuda observada por `sync-migration-reviewer` al revisar `20260720100000...sql`

No bloquean la migración; se registran para no perderlas (equivalentes a F14 — se documentan, no se
arreglan acá):

- **`fn_effective_rtd_thresholds` no tiene `CREATE FUNCTION` en ninguna migración versionada** — solo
  se usa desde `20260710170000...sql` en adelante. Ya existe en el remoto (las vistas que la usan
  llevan en producción desde julio), pero la cadena de migraciones no es autocontenida: un `supabase
  db reset` desde cero fallaría en esa migración. Deuda preexistente, ajena a esta fase.
- **Sin test SQL** para `tire_status`/`v_unit_tire_status.tire_status` que detecte una futura
  desalineación entre ambas vistas (la lógica queda intencionalmente duplicada por diseño de
  `security_invoker`/una-vista-por-consumidor). Sugerido para `task_09`, no bloqueante.
- **Rollback de la migración no es simétrico**: `CREATE OR REPLACE VIEW` no puede quitar columnas;
  revertir `tire_status`/`retread_observation` exige `DROP VIEW` + recrear `GRANT`/`COMMENT`. Sin
  vistas dependientes de `v_inspection_dashboard_rows`, así que es seguro, pero no es un solo comando.

---

## Faceta retirada — Configuración (`2-4-2`, `2-4`) en Rendimiento

**No bloquea nada; ya resuelta por `task_01`, 2026-07-20.** `vehicle_configs.notation` existe pero
ninguna vista de esta fase la expone, y exponerla (join aditivo a `vehicle_configs` desde
`v_rendimiento_dashboard_rows`) tampoco tiene una tarea con permiso de archivo para escribir esa
migración. En vez de ampliar el alcance de `task_01` o de `task_04` en silencio, la faceta queda
fuera de esta fase. Detalle en `CONTRATOS_DATOS.md` §2. Si el humano la quiere igual, es una
migración de una línea, autorizable con el mismo trámite que `task_07`/`task_08`.

## F16 — Mes en Rendimiento; fecha y mes en Inspecciones

Rendimiento expone solo `Mes de última inspección`: el valor mensual agrupa por el mes de
`last_inspection_on` de cada fila, no inventa una ventana de consumo. Al elegirlo se incluyen
automáticamente filas antiguas, porque la selección temporal explícita debe ser útil aun cuando el
corte por defecto de frescura sea de 30 días. Inspecciones conserva las fechas exactas y agrega sus
meses/año; un mes elegido resuelve a las fechas de inspección de ese mes desde su índice liviano.

## F17 — Inspecciones como búsqueda analítica

Inspecciones concentra las facetas de especificación operativa: marca, modelo, medida, condición,
diseño de reencauche y eje, además de unidad, código, estado y corte temporal. `Desecho` no se
mezcla con “Para/Próximo a reencauche”: es un item separado cuya clasificación llega de la vista
(`is_discard` o `anomaly_catalog.desecho=true`) y muestra la anomalía registrada. Esto permite
cuantificar, por ejemplo, los `IZE2W` `R1` del eje Tracción sin duplicar la regla de negocio en JS.
