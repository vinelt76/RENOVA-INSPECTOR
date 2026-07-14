# task_05 — Modelo puro del lote: máquina de estados + invariantes + payload v1

1. **Propietario y alcance**: CLAUDE. Núcleo de dominio del editor de lote. **Sin DOM, sin red.**
2. **Objetivo y resultado observable**: `batch-model.js` permite agregar/quitar/editar movimientos,
   impone las invariantes, sella el payload de forma inmutable y construye el JSON v1 exacto; con
   pruebas por cada invariante.
3. **Dependencias**: `task_02`. **Bloquea**: `task_06`, `task_07`, `task_08`, `task_10`, `task_13`,
   `task_15`.
4. **Decisiones**: aplica Decisión 4 (sellado inmutable) y 7 (no bloquear por `code_mismatch`). No
   bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/batch-model.js`,
   `WEB/tire-change/__tests__/batch-model.test.js`. **Solo lectura**: `CONTRATOS_UI.md §5`,
   `AUDIT.md §3`. **Prohibido**: otros módulos, HTML.
6. **Estado inicial verificado**: reglas de lote y payload v1 exacto en `CONTRATOS_UI.md:227-428`;
   idempotencia por `batch_id` (`:514-519`); orden por `seq` (`:245`, `:692`).
7. **Contratos de entrada/salida** (canónico `CONTRATOS_UI.md`):
   - Estado interno: `{ movements: [...], sealed: null|batch }`. Movimiento con `expected_life_cycle_id(_a/_b)`.
   - `addSendToRetention`, `addDiscard`, `addMount`, `addSwap`, `removeMovement`, `editMovement`.
   - `validate(remoteState)` → lista de violaciones (invariantes §4.2 de `PLAN.md`).
   - `seal({performedAt, odometer, notes}, uuidFn)` → payload v1 congelado: `batch_version:1`,
     `batch_id` (via `uuidFn`, inyectable), `unit_id`, `performed_at`, `odometer|null`, `notes|null`,
     `movements` con `seq` únicos (`CONTRATOS_UI.md:227-409`).
   - `editAfterSeal()` → descarta `sealed`, vuelve a EDITING (próximo sellado genera nuevo `batch_id`).
8. **Pasos**: (1) Modelar estados EMPTY/EDITING/SEALED/APPLIED (`PLAN.md §3`). (2) Implementar cada
   `add*` copiando `expected_life_cycle_id` del ciclo visto. (3) `validate` con las invariantes.
   (4) `seal` que congela (Object.freeze) y asigna `seq` 1..n; `uuidFn` inyectable para pruebas.
   (5) Garantizar que un payload sellado no muta y que editar exige nuevo sellado.
9. **Estados**: intento de operar sobre vacía/duplicar ciclo/duplicar posición → violación
   devuelta, no excepción silenciosa; sellar con violaciones pendientes → rechazado.
10. **Consistencia/seguridad**: no generar UUID salvo en `seal`; nunca reciclar un `batch_id`; no
    incluir `company_id`. Números como `number`, versión `1` numérica (`CONTRATOS_UI.md:231`).
11. **Pruebas** (`batch-model.test.js`, `uuidFn` mock): cada invariante de `AUDIT.md §3.1`; payload
    v1 byte-a-byte contra el ejemplo de `CONTRATOS_UI.md:362-409` (con UUIDs de fixture); retiro P3
    + mount en P3 válido; swap A≠B; edición tras sellado → nuevo `batch_id`; sellado inmutable
    (mutación lanza/no afecta).
12. **Smoke real**: indirecto en `task_16` (lote mixto real).
13. **Aceptación**: todas las invariantes probadas; payload exacto; inmutabilidad demostrada.
14. **Comandos**: `cd WEB/tire-change && npm test -- batch-model`.
15. **Rollback**: N/A.
16. **Handoff**: fila `task_05` con la lista de invariantes cubiertas y confirmación de payload v1.
