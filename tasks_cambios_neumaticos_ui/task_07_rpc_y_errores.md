# task_07 — Cliente RPC + clasificación de errores + pin de supabase-js

1. **Propietario y alcance**: CLAUDE. Módulo de confirmación del lote y clasificación de errores; y
   el pin de versión de supabase-js.
2. **Objetivo y resultado observable**: `rpc.js` llama `confirm_tire_change_batch` una sola vez,
   clasifica las 5+ clases de error y hace retry inmutable; `supabase-demo.js` fija la versión de
   supabase-js. Pruebas verdes.
3. **Dependencias**: `task_02`, `task_05`. **Bloquea**: `task_13`.
4. **Decisiones**: aplica Decisión 8 (pin + retry idempotente). **Confirmar la versión exacta con el
   humano** antes de fijar.
5. **Archivos permitidos**: `WEB/tire-change/rpc.js`, `WEB/tire-change/__tests__/rpc.test.js`, y
   **una** edición en `WEB/supabase-demo.js` (línea de `import`). **Solo lectura**:
   `CONTRATOS_UI.md §5,§7,§8`. **Prohibido**: HTML, otros módulos. **Ninguna** otra tarea edita
   `supabase-demo.js`.
6. **Estado inicial verificado**: cliente `RenovaSupabase.supabase.rpc(...)`
   (`supabase-demo.js:22`, `:194`); import sin pin (`supabase-demo.js:18`); patrón `.rpc()` +
   `if(error) throw error` en `instalacion.html` (`CONTRATOS_UI.md:721`); errores reales
   (`:521-546`).
7. **Contratos**:
   - `confirmTireChangeBatch(p_batch)` → `data` o lanza `error` (registrar objeto completo).
   - `classifyBatchError(error)` → `stale_state|unavailable_cycle|occupied_position|forbidden|invalid_batch|unknown`
     exactamente como `CONTRATOS_UI.md:628-645`.
   - `applyPendingBatch(pendingBatch, {onReload})` → maneja `stale_state` limpiando el sellado
     (`:650-674`); red/timeout → retry mismo payload.
   - Nunca generar UUID aquí (`:625`).
8. **Pasos**: (1) Implementar la llamada con inyección del cliente para test. (2)
   `classifyBatchError` con code+prefijo. (3) `applyPendingBatch` con la política de retry. (4)
   Fijar el `import` de supabase-js a la versión exacta acordada (≥2.102.0) conservando retry.
   (5) Verificar que los demás dashboards siguen cargando (el pin es global).
9. **Estados**: red/timeout → retry inmutable; dominio → sin retry; `stale_state` → descartar y
   pedir rearmar; éxito → limpiar sellado y recargar vistas.
10. **Consistencia/seguridad**: mostrar `error.message` **escapado** (`CONTRATOS_UI.md:546`); no
    loguear tokens; no reintentar a ciegas lotes rechazados por dominio.
11. **Pruebas** (mock del cliente): éxito; reintento idempotente (mismo `batch_id`,
    `already_applied`); cada uno de los 5 errores (`22023` lote/no_disponible, `40001`, `23505`,
    `42501`); error de fecha sin prefijo; error desconocido; retry de red no cambia `batch_id`.
12. **Smoke real**: en `task_16` (confirmación real + un error provocado).
13. **Aceptación**: pruebas verdes; pin aplicado; dashboards existentes sin regresión de carga.
14. **Comandos**: `cd WEB/tire-change && npm test -- rpc`; smoke manual de que
    `INSPECCIONES POR FECHA.html` y `Inspecciones por unidad.html` cargan con el pin.
15. **Rollback**: revertir la línea de `import` de `supabase-demo.js` a `@2` si el pin rompe algo.
16. **Handoff**: fila `task_07` con la versión fijada y el mapa de clases de error cubiertas.
