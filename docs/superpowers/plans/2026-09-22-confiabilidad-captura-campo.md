# Confiabilidad de captura de campo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que las apps móviles comuniquen con veracidad el estado local, permitan retomar trabajo offline y guíen una captura válida sin inventar reglas de negocio.

**Architecture:** Se añaden utilidades puras para clasificar una posición y recuperar el perfil local de un inspector. Las pantallas consumen esos resultados para mostrar estados y validación; la persistencia SQLite y la cola remota siguen siendo la fuente de verdad.

**Tech Stack:** React 19, TypeScript, Vitest, Capacitor, SQLite y Supabase.

**Spec:** `specs/flujo_inspeccion.md`, `DESIGN.md`, `knowledge/ai/04 - Flujo de inspeccion y sincronizacion.md`.

## Global Constraints

- Mantener offline-first: la red no bloquea guardar o retomar una inspección existente.
- No definir una referencia de presión CALIENTE ni cambiar fórmulas o umbrales.
- Mantener la empresa derivada del perfil autenticado y preservar el aislamiento por empresa.
- Todo texto visible usa español neutro peruano y conserva el sistema visual industrial.

---

### Task 1: Recuperación local del inspector

**Files:**
- Modify: `app/src/auth/auth.ts`, `app/src/auth/auth.test.ts`, `app/src/state/AppContext.tsx`

**Interfaces:**
- Produces: `cacheInspectorProfile(profile)` y `cachedInspectorProfile(userId)` para recuperar un perfil validado asociado a la sesión local.

- [ ] Escribir pruebas que fallen para el perfil almacenado, perfil de otro usuario y pérdida de red.
- [ ] Hacer que el inicio use el perfil remoto cuando esté disponible y el perfil local cuando la sesión persiste sin red.
- [ ] Ejecutar `cd app && npm test && npm run build`.

### Task 2: Estados y validación de posición

**Files:**
- Create: `app/src/core/inspectionProgress.ts`, `app/src/core/inspectionProgress.test.ts`
- Modify: `app/src/screens/InspeccionScreen.tsx`, `app/src/screens/FormBody.tsx`

**Interfaces:**
- Produces: `assessInspectionPosition(data)` que devuelve `empty`, `partial`, `invalid` o `complete` y los campos inválidos.

- [ ] Escribir pruebas que fallen para posición vacía, parcial, inválida y completa con los rangos aprobados por la spec.
- [ ] Usar el resultado para el mapa, el resumen de finalización y el mensaje junto al campo inválido.
- [ ] Ejecutar `cd app && npm test && npm run build`.

### Task 3: Confirmación de persistencia y sincronización

**Files:**
- Modify: `app/src/screens/InspeccionScreen.tsx`, `app/src/sync/drainQueue.ts`, `app/src/sync/drainQueue.test.ts`

**Interfaces:**
- Produces: estados de guardado local `guardando`, `guardado`, `error` y conteo total de pendientes de la cola.

- [ ] Escribir pruebas que fallen para pendientes con backoff vigente.
- [ ] Mostrar guardado solo después de persistir y mantener pendientes reales visibles.
- [ ] Ejecutar `cd app && npm test && npm run build`.

### Task 4: Búsqueda y selector accesibles

**Files:**
- Modify: `app/src/screens/UnidadScreen.tsx`, `app/src/components/AutocompleteField.tsx`, `app/src/screens/InspeccionScreen.tsx`

- [ ] Eliminar el recorte del menú de unidades y explicar cuando la búsqueda remota no puede verificarse.
- [ ] Añadir nombres, roles y estados accesibles a autocompletados y selector de posiciones; incluir un cierre explícito del selector.
- [ ] Ejecutar `cd app && npm test && npm run build`.

### Task 5: Resultado operativo y borrador de Movimientos

**Files:**
- Modify: `app/src/screens/FormBody.tsx`, `app/src/screens/InspeccionScreen.tsx`, `app movimientos/src/screens/ExecutionScreen.tsx`

- [ ] Mostrar RTD MOVI, IDI y estado cuando hay datos suficientes, usando el motor existente.
- [ ] Mostrar el borrador de Movimientos como guardado solo después de escribirlo y dejar un error recuperable si falla.
- [ ] Ejecutar `cd app && npm test && npm run build` y `cd "app movimientos" && npm test && npm run build`.

### Task 6: Documentación y smoke

**Files:**
- Modify: `knowledge/ai/04 - Flujo de inspeccion y sincronizacion.md`, `knowledge/ai/09 - Diseno y UX.md`, `knowledge/ai/02 - Estado actual.md`

- [ ] Documentar los estados reales de recuperación, guardado, validación y límites pendientes.
- [ ] Ejecutar las comprobaciones de documentación y el smoke de las dos superficies móviles.
