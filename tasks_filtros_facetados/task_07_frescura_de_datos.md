# task_07 — Frescura de datos en Rendimiento

## 1. Propietario

**CLAUDE + USUARIO** (aplica DDL remoto: requiere autorización explícita).

## 2. Objetivo y resultado observable

Exponer la fecha de la última inspección de cada fila de rendimiento, y excluir del agregado los
neumáticos cuyos datos superen un umbral de antigüedad — **diciéndolo**.

Resultado observable: el agregado de Rendimiento se calcula por defecto sobre inspecciones de los
últimos 30 días, la pantalla indica cuántas filas excluyó por antigüedad, y un chip permite
incluirlas.

## 3. Dependencias y bloqueos

Depende de `task_05`. Bloquea `task_08`.

## 4. Archivos exclusivos

- `supabase/migrations/<ts>_rendimiento_last_inspected_on.sql` (nuevo)
- La sección de frescura de `WEB/rendimiento.html` (punto de extensión que `task_05` dejó)

Solo lectura: el resto de `supabase/migrations/`.

## 5. Contratos

### El problema que resuelve, y el que no

Hoy la fila de un neumático existe aunque su última inspección sea de hace seis meses, y
`computeTire` usa ese RTD viejo igual. El agregado mezcla datos frescos con rancios sin distinguir.

Esta tarea **filtra filas**. **No recalcula nada** (F11). Es una mejora de honestidad, no de
exactitud: dejás de promediar datos de antigüedad heterogénea. Calcular el consumo *ocurrido dentro*
de un período es `task_08`, y necesita otra vista.

Esta distinción no puede difuminarse en la UI. El texto que acompañe al filtro debe decir «basado en
inspecciones de los últimos 30 días», no «consumo de los últimos 30 días». Lo segundo sería falso.

### La migración

`v_rendimiento_dashboard_rows` trae `last_inspection_id` pero **no la fecha**: el `left join lateral`
ordena por `i.inspected_on` y no lo proyecta.

Cambio **aditivo**: agregar `li.inspected_on as last_inspected_on` **al final** del `select`.
Precedente exacto: `20260719180841_search_index_facets.sql`.

Restricciones:

- Aditivo puro. Las columnas existentes conservan **orden y tipo idénticos**.
- La vista se recrea con `drop view` + `create view`, no `create or replace`: expande `p.*` y
  Postgres no permite insertar una columna en medio. Ya está documentado en la migración vigente.
- `security_invoker = true` se conserva.
- **Los grants se conservan tal cual.** La vista hoy concede a `anon, authenticated`
  (`AUDIT.md` §2.6). Esta tarea **no los cambia**: reducirlos es una corrección de seguridad
  legítima pero **ajena a esta fase**, y hacerla de paso dentro de otra migración esconde el cambio.
  Si `task_01` encontró que `anon` efectivamente recupera filas, eso ya detuvo la fase antes.

### El umbral

Por F12: default 30 días, **configurable, no hardcodeado en el componente**. Preferible junto al
resto de configuración por empresa. Si no hay un lugar natural, dejarlo como constante nombrada en
un punto único y registrarlo como deuda — pero no esparcido por la UI.

### Conteos separados (F10)

Excluidos por `valid:false` y excluidos por antigüedad son **razones distintas** y se cuentan
aparte. Fundirlos oculta cuál es el problema real de los datos: «faltan mediciones» y «nadie
inspecciona hace meses» piden acciones opuestas.

## 6. Pasos

1. Leer la migración vigente completa y `tasks_buscador_global/task_12` (precedente de extensión
   aditiva ya aprobada).
2. Confirmar contra `task_01` cuántas filas superan 30 días. Si fueran casi todas, el default de 30
   dejaría la pantalla vacía: **reportarlo al humano** antes de aplicarlo, no elegir otro número por
   cuenta propia.
3. Escribir la migración aditiva.
4. **Revisar con el agente `sync-migration-reviewer`.** Obligatorio (`CLAUDE.md`).
5. **Pedir autorización explícita** antes de aplicar.
6. Aplicar y verificar: conteos sin moverse, columnas previas en el mismo orden, grants sin cambios,
   `last_inspected_on` no nulo donde hay inspección.
7. Consumir la columna en `rendimiento.html`: excluir del agregado, mostrar el conteo, ofrecer el
   chip de inclusión.
8. Smoke.

## 7. Invariantes

- **Aditiva y reversible.** Reversión verificada: recrear la vista sin la columna nueva.
- No cambiar el orden ni el tipo de las columnas existentes: `buildUnitsFromSupabase` las consume.
- **No modificar grants** en esta migración.
- No tocar otras vistas, tablas, RPCs ni policies.
- No aplicar sin revisión del agente y autorización humana.
- No hardcodear el umbral en el componente (F12).
- La UI no debe sugerir que calcula consumo por período. Solo filtra por frescura.

## 8. Casos de error

- Neumático sin ninguna inspección → `last_inspected_on` nulo. Decidir explícitamente si cuenta como
  rancio (probablemente sí) y **documentarlo**; no dejarlo al azar de una comparación con `null`.
- Todas las filas rancias → agregado vacío con explicación y chip para incluirlas. Nunca ceros.
- Fecha futura por dato mal cargado → no romper. Registrarlo como anomalía de datos.
- La migración cambia el orden de columnas → bloqueo, se revierte.

## 9. Aceptación

- `sync-migration-reviewer`: APPROVE, con su salida registrada.
- Autorización humana registrada.
- Post-aplicación: conteos idénticos a antes, columnas previas en orden y tipo idénticos, grants sin
  cambios, `last_inspected_on` presente.
- `rendimiento.html`: excluye por defecto >30 días, muestra el conteo separado del de datos
  insuficientes, y el chip de inclusión funciona.
- Suites verdes, `npm run docs:check`, `git diff --check`.

## 10. Rollback

Recrear la vista sin `last_inspected_on` y revertir el consumo en `rendimiento.html`. La columna es
aditiva y nada más la consume: la reversión es limpia.

## 11. Handoff

Actualizar fila 07 con: salida de `sync-migration-reviewer`, autorización registrada, verificación
post-aplicación (conteos, orden de columnas, grants), distribución real de frescura y decisión
documentada sobre las filas sin inspección.
