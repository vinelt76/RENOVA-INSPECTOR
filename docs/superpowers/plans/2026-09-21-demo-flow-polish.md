# Demo Flow Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer más claro y verificable el flujo de Movimientos para la demo, sin inferir conciliaciones físicas que no estén confirmadas por una persona.

**Architecture:** La app del operario conserva las cuatro ejecuciones técnicas que exige la RPC, pero las presenta agrupadas por posición y resume una rotación como dos servicios. Servicios web mostrará el estado de conciliación de forma explícita, filtrará órdenes por estado y recibirá cambios de ejecuciones mediante Realtime, manteniendo el sondeo como respaldo.

**Tech Stack:** React + TypeScript + Capacitor en `app movimientos/`, HTML/JavaScript modular en `WEB/`, Vitest, Supabase RPC/RLS/Realtime y migraciones SQL.

**Spec:** `knowledge/ai/09 - Diseno y UX.md` y `knowledge/ai/07 - Web dashboards y taller.md`

## Global Constraints

- No inferir un montaje, ciclo de vida u origen externo desde una inspección o una ejecución.
- Mantener la unidad visual del operario como posición atendida, aunque la RPC conserve cuatro ejecuciones para una rotación.
- Mantener el sondeo de Servicios como respaldo hasta comprobar Realtime en producción.
- No borrar órdenes completadas: la limpieza operativa debe conservar trazabilidad.
- Todo texto visible debe estar en español neutro y los controles táctiles deben conservar al menos 44 px.
- Ejecutar pruebas unitarias, `npm run verify`, build de ambas apps y una prueba headless autenticada.

### Task 1: Resumen de cierre para el operario

**Files:**
- Modify: `app movimientos/src/screens/ExecutionScreen.tsx`
- Modify: `app movimientos/src/components/ServiceCard.tsx`
- Modify: `app movimientos/src/styles.css`
- Test: `app movimientos/src/lib/model.test.ts`

**Interfaces:**
- Consume: `groupExecutionServices`, `MovementDraft` y `ExecutionService`.
- Produces: resumen de cierre con posiciones atendidas, cantidad de servicios visuales y cantidad de ejecuciones técnicas.

- [x] **Step 1: Write the failing test** para que una rotación cuente como dos servicios visuales y cuatro ejecuciones técnicas.
- [x] **Step 2: Run the focused test and verify it fails.**
- [x] **Step 3: Implement the summary without changing the RPC payload.**
- [x] **Step 4: Add a visible pending-reconciliation note on completion.**
- [x] **Step 5: Run focused app-movimientos tests and build.**

### Task 2: Estados y filtros operativos en Servicios

**Files:**
- Modify: `WEB/servicios/data.js`
- Modify: `WEB/servicios/servicios-model.js`
- Modify: `WEB/servicios/servicios-controller.js`
- Modify: `WEB/servicios.html`
- Modify: `WEB/servicios/servicios.css`
- Test: `WEB/servicios/__tests__/data.test.js`
- Test: `WEB/servicios/__tests__/servicios-model.test.js`

**Interfaces:**
- Consume: `loadCurrentMovementOrders`, `summarizeCurrentOrders` y los estados `issued`, `in_progress`, `completed`, `cancelled`.
- Produces: filtro explícito de órdenes actuales por estado y etiqueta visible de `PENDIENTE DE CONCILIACIÓN`.

- [x] **Step 1: Write failing model tests** para filtrar órdenes por estado y preservar el resumen completo.
- [x] **Step 2: Run the focused tests and verify the expected failure.**
- [x] **Step 3: Implement the pure filtering/model helpers.**
- [x] **Step 4: Render the filter with accessible buttons and an empty state.**
- [x] **Step 5: Mark pending reconciliation in service rows without implying a physical error.**
- [x] **Step 6: Run Servicios tests and a static smoke check.**

### Task 3: Realtime de ejecuciones

**Files:**
- Create: `supabase/migrations/20260921100000_publish_movement_executions_realtime.sql`
- Modify: `WEB/servicios/servicios-controller.js` only if the current subscription needs event-specific handling.
- Test: `WEB/servicios/__tests__/data.test.js` or controller-level subscription test if the existing harness supports it.

**Interfaces:**
- Consume: la publicación `supabase_realtime` y `client.onDataChange(["tire_movement_executions", "tire_movement_orders"], ...)`.
- Produces: eventos de ejecución visibles en Servicios sin esperar al intervalo de respaldo.

- [x] **Step 1: Add the migration that idempotently adds `tire_movement_executions` to `supabase_realtime`.**
- [x] **Step 2: Validate grants, publication membership and RLS through read-only SQL checks.**
- [x] **Step 3: Apply the migration to the configured Supabase project only after the local migration is reviewed.**
- [x] **Step 4: Keep and test the existing ten-second fallback.**

### Task 4: Document the reconciliation boundary

**Files:**
- Modify: `knowledge/ai/07 - Web dashboards y taller.md`
- Modify: `knowledge/ai/09 - Diseno y UX.md`
- Modify: `knowledge/ai/10 - Roadmap deuda y riesgos.md`

**Interfaces:**
- Consume: the current `reconciliation_status = pending` contract.
- Produces: consistent copy that says the service was captured but its physical lifecycle remains pending confirmation.

- [x] **Step 1: Add the approved wording and explicitly prohibit automatic inference.**
- [x] **Step 2: Run `npm run docs:check`.**

### Task 5: Full verification and demo rehearsal

**Files:**
- No production file changes beyond the tasks above.

- [x] **Step 1: Run focused tests for app Movimientos and Servicios.**
- [x] **Step 2: Run `npm run verify`.**
- [x] **Step 3: Build both APKs.**
- [x] **Step 4: Run a headless CIVA flow: issue → claim → complete → verify Services → delete only the controlled test records.**
- [x] **Step 5: Confirm no demo marker remains in `tire_movement_orders` or `tire_movement_executions`.**
