# task_05 — Quitar el voseo argentino de los textos visibles

**Hallazgo:** H-07 · **Prioridad:** Alta para la demo · **Tipo:** mecánico
**Bloquea la demo:** sí — tres de los siete están en el camino que se va a mostrar

## Problema

`CLAUDE.md` exige español neutro cercano al uso peruano y prohíbe explícitamente «podés»,
«revisá», «ingresá». Hay siete textos visibles con voseo, y los mensajes de las RPC llegan crudos
a la pantalla del operario (`ExecutionScreen.tsx:39` y `:68` muestran `cause.message` tal cual).

## Cambios exactos

| archivo:línea | actual | propuesto |
|---|---|---|
| `supabase/migrations/20260720012248_operator_movement_orders.sql:170` | Necesitás iniciar sesión para trabajar con movimientos. | Necesitas iniciar sesión para trabajar con movimientos. |
| `supabase/migrations/20260720012248_operator_movement_orders.sql:365` | Primero debés tomar esta orden. | Primero debes tomar esta orden. |
| `supabase/migrations/20260712000000_workshop_tire_operations_rpcs.sql:39` | Necesitás iniciar sesión para operar sobre neumáticos. | Necesitas iniciar sesión para operar sobre neumáticos. |
| `supabase/migrations/20260714120000_confirm_tire_change_batch_rpc.sql:391` | …desde que armaste el lote… Recargá el estado de la unidad y rearmá los movimientos. | …desde que armaste el lote… Recarga el estado de la unidad y rearma los movimientos. |
| `supabase/migrations/20260714120000_confirm_tire_change_batch_rpc.sql:396` | ídem | ídem |
| `supabase/migrations/20260714120000_confirm_tire_change_batch_rpc.sql:568` | Recargá el estado y reintentá. | Recarga el estado y reintenta. |
| `WEB/servicios/servicios-controller.js:239` | No se pudieron cargar los servicios. Verificá la conexión e intentá nuevamente. | No se pudieron cargar los servicios. Verifica la conexión e intenta nuevamente. |

`WEB/movimientos/storage-client.js:198` («Probá con otra imagen JPEG o WebP») entra en el mismo
barrido → «Prueba con otra imagen JPEG o WebP».

`app/src/db/sqlite.ts:3` tiene voseo pero es un comentario de código, no texto visible. Fuera de
alcance.

## Cómo, sin romper nada

Los tres archivos de migración **ya están aplicados en producción**. No se editan en su sitio: se
crea **una migración nueva** que hace `create or replace function` de las tres funciones afectadas
—`fn_require_tire_movement_profile`, la de taller y `confirm_tire_change_batch`— con el cuerpo
idéntico salvo el texto. Editar una migración histórica hace que el archivo versionado deje de
describir lo que se aplicó.

`WEB/` sí se edita directo.

## Criterio de cierre

- El grep de voseo sobre `app`, `app movimientos`, `WEB` y `supabase` (excluyendo `node_modules`,
  `dist` y comentarios de código) no devuelve nada visible.
- `sync-migration-reviewer` sobre la migración de texto: cambia cuerpos de función en producción,
  aunque solo sea una cadena.
- Las suites de `WEB/servicios` y `WEB/movimientos` siguen verdes (hay pruebas que comparan textos
  de error).
