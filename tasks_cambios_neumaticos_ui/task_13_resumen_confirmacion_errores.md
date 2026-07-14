# task_13 — Resumen/deshacer/editar + confirmación + errores + retry + Realtime

1. **Propietario y alcance**: CLAUDE. Cierre transaccional del editor: resumen editable, encabezado
   del lote, confirmación única, manejo de errores, retry y política Realtime.
2. **Objetivo y resultado observable**: el usuario revisa la lista de movimientos, deshace/edita,
   completa fecha/odómetro/notas, confirma con una sola llamada a `confirm_tire_change_batch`, y ve
   feedback correcto para éxito y cada clase de error; el borrador persiste ante recarga.
3. **Dependencias**: `task_11`, `task_06`, `task_07`, `task_12`. **Bloquea**: `task_14`, `task_15`.
4. **Decisiones**: aplica Decisión 5 (banner Realtime sin recargar borrador), 6 (fecha hoy
   editable, **odómetro OBLIGATORIO**, notas opcionales). RESUELTAS — no bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/summary-confirm.js` y una **sección namespaced** en
   `WEB/tire-change/cambios-controller.js`. **Solo lectura**: `batch-model.js`, `batch-store.js`,
   `rpc.js`, `CONTRATOS_UI.md §5,§6,§7,§8`. **Prohibido**: HTML, otros submódulos. Encadenada tras
   task_11.
6. **Estado inicial verificado**: idempotencia por `batch_id` (`CONTRATOS_UI.md:514-519`);
   respuesta de éxito/reintento (`:429-519`); errores (`:521-546`); Realtime actual solo escucha
   inspección (`Inspecciones por unidad.html:1059-1063`).
7. **Contratos**: `seal(...)` de `batch-model` → payload v1; `saveSealed` de `batch-store`;
   `confirmTireChangeBatch`/`applyPendingBatch`/`classifyBatchError` de `rpc`. Encabezado:
   `performed_at` (default hoy, editable), `odometer` (**entero obligatorio por regla de UI**;
   el contrato acepta null pero la UI exige valor, Decisión 6), `notes` (opcional).
8. **Pasos**: (1) Render del resumen ordenado por `seq` con deshacer/editar (editar → nuevo
   `batch_id` en el próximo sellado). (2) Campos de encabezado con validación de cliente:
   **confirmar deshabilitado sin odómetro entero válido** (Decisión 6); advertencia (sin bloqueo)
   si `performed_at` < `installed_at` visible. (3) Confirmar →
   `seal` → `saveSealed` → `confirmTireChangeBatch` una sola vez. (4) Éxito → limpiar borrador/
   sellado, recargar vistas, feedback. (5) Errores → mapa de `PLAN.md §6`. (6) Realtime en Cambios:
   con borrador, banner "el estado cambió, revisá"; sin borrador, recargar.
9. **Estados**: cargando/confirmando (deshabilitar botón); vacío (sin movimientos → confirmar
   deshabilitado); error por clase (`invalid_batch`/`stale_state`/`unavailable_cycle`/
   `occupied_position`/`forbidden`/fecha/desconocido); recuperación tras red/timeout (retry mismo
   payload); recarga del navegador con borrador editable y con sellado pendiente.
10. **Consistencia/seguridad**: una sola llamada; nunca encadenar RPCs individuales
    (`CONTRATOS_UI.md`, `knowledge/ai/07:46-47`); `error.message` escapado; no reintentar dominio a
    ciegas; no pisar borrador por Realtime.
11. **Pruebas**: la clasificación/estado ya está en task_05/06/07; aquí, smoke + un test del
    reductor de resumen si se extrae puro (orden por `seq`, deshacer).
12. **Smoke real**: en `task_16` (lote mixto real, retry, un error, recarga).
13. **Aceptación**: confirmación única; feedback por cada clase de error; borrador persistente;
    banner Realtime; sin regresión de Inspección.
14. **Comandos**: smoke desde `WEB/`; `npm test` verde.
15. **Rollback**: quitar `import`/sección desactiva la confirmación; sin efectos en Inspección.
16. **Handoff**: fila `task_13` con el mapa de errores manejados y el log del smoke parcial.
