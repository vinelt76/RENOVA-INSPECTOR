# task_06 — Persistencia local: borrador editable + payload sellado idempotente

1. **Propietario y alcance**: CODEX. Persistencia en `localStorage` del borrador y del payload
   sellado. Sin DOM de UI (solo `localStorage`).
2. **Objetivo y resultado observable**: `batch-store.js` guarda/recupera borrador y sellado con
   claves aisladas por usuario+empresa+unidad; reanuda tras recarga validando la sesión/unidad; con
   pruebas de recarga y retry.
3. **Dependencias**: `task_02`, `task_05`. **Bloquea**: `task_13`.
4. **Decisiones**: aplica Decisión 4 (dos artefactos separados). No bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/batch-store.js`,
   `WEB/tire-change/__tests__/batch-store.test.js`. **Solo lectura**: `CONTRATOS_UI.md §8.2`,
   `batch-model.js` (tipos). **Prohibido**: otros módulos, HTML.
6. **Estado inicial verificado**: patrón sugerido `renova:tire-change:${batch_id}` en
   `CONTRATOS_UI.md:592-599`; persistir antes de llamar (`:597`); idempotencia por `batch_id`
   (`:514-519`).
7. **Contratos**: claves namespaced con `userId+companyId?+unitId+batch_id`;
   `saveDraft(scope, draft)`, `loadDraft(scope)`, `clearDraft(scope)`;
   `saveSealed(scope, payload)`, `loadSealed(scope)`, `clearSealed(payload.batch_id)`. La empresa
   puede no estar en el cliente (la deriva el JWT); usar `userId`+`unitId` como mínimo y validar
   `unit_id` al reanudar.
8. **Pasos**: (1) Serializar/deserializar JSON. (2) Namespacing y validación de coincidencia de
   `unit_id`/sesión al `load`. (3) `saveSealed` congela y no re-escribe con distinto `batch_id`.
   (4) Al reanudar un sellado pendiente, exponerlo para retry inmutable. (5) `clearSealed` tras
   éxito o error de dominio (`CONTRATOS_UI.md:620`, `:661`).
9. **Estados**: reanudación con `unit_id` distinto → ignorar/limpiar; `localStorage` lleno/no
   disponible → degradar (mantener en memoria) sin romper el flujo; borrador de otro usuario → no
   cargar.
10. **Consistencia/seguridad**: no mezclar borradores entre usuario/empresa/unidad
    (`AUDIT.md §3.1`); no guardar tokens/secretos; el payload sellado nunca se muta.
11. **Pruebas** (mock de `localStorage`): guardar/recuperar borrador; recarga con borrador
    editable; recarga con payload sellado pendiente; aislamiento por unidad/usuario; retry lee el
    mismo `batch_id`; limpieza tras éxito.
12. **Smoke real**: recarga del navegador con borrador y con sellado (en `task_16`).
13. **Aceptación**: pruebas verdes; aislamiento demostrado; sellado inmutable.
14. **Comandos**: `cd WEB/tire-change && npm test -- batch-store`.
15. **Rollback**: N/A.
16. **Handoff**: fila `task_06` con el esquema de claves y los casos de reanudación cubiertos.
