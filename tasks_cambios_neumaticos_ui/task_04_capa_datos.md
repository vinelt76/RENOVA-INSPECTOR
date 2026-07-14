# task_04 — Capa de datos: resolución de unidad + carga de vistas + normalización

1. **Propietario y alcance**: CODEX. Módulo puro de acceso a datos del modo Cambios. No toca DOM.
2. **Objetivo y resultado observable**: `data.js` resuelve `unit_id` desde la navegación y carga en
   paralelo `v_unit_position_state` y `v_tire_inventory_available`, normalizando filas; con pruebas
   verdes de los casos límite.
3. **Dependencias**: `task_02`. **Bloquea**: `task_09`, `task_11`.
4. **Decisiones**: aplica Decisión 7 (semántica `code_mismatch` la consume la proyección, no esta
   capa). No bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/data.js`,
   `WEB/tire-change/__tests__/data.test.js`. **Solo lectura**: `CONTRATOS_UI.md §2,§3,§4`,
   `WEB/supabase-demo.js` (API `fetchView`). **Prohibido**: `WEB/*.html`, otros módulos.
6. **Estado inicial verificado**: navegación pasa `inspection_id`+`plate`
   (`INSPECCIONES POR FECHA.html:381-388`); `fetchView(name, params)` hace GET REST con sesión
   (`supabase-demo.js:24-37`); la vista de inspección no expone `unit_id` (`CONTRATOS_UI.md:113-114`).
7. **Contratos de entrada/salida** (canónico `CONTRATOS_UI.md`):
   - `resolveUnitId({inspectionId, plate})` → `unit_id | null`. Preferir `plate` directo; si falta,
     leer `v_inspection_dashboard_rows?select=plate&inspection_id=eq.…&limit=1` y luego
     `v_unit_position_state?select=unit_id,plate&plate=eq.…&limit=1` (`CONTRATOS_UI.md:122-147`).
   - `loadUnitPositionState(unitId)` → filas ordenadas `position_number.asc` (28 columnas, `:44-75`).
   - `loadAvailableInventory()` → filas (`last_removed_at.desc.nullslast,casing_code.asc`, `:192-206`).
   - Normalización: tipar `numeric`→Number, conservar `NULL` válidos, no inventar posiciones.
8. **Pasos**: (1) Implementar las tres funciones usando `RenovaSupabase.fetchView`. (2) `fetchView`
   debe recibir `select` con las columnas exactas. (3) Normalizar sin recalcular reglas de negocio.
   (4) 0 filas de estado → devolver `[]` y que el caller lo trate como unidad inexistente/no
   autorizada (`:102-103`). (5) Inyectar el cliente/fetchView para testear con mock.
9. **Estados**: 0 filas = vacío/no autorizado; error de red = propagar para que la UI degrade;
   sesión ausente = no llamar (la UI exige `requireAuth` antes).
10. **Consistencia/seguridad**: nunca enviar `company_id` (RLS lo aísla, `CONTRATOS_UI.md:27`); no
    cachear `plate→unit_id` global sin contexto de sesión (`:150-151`).
11. **Pruebas** (`data.test.js`, mock de `fetchView`): resolución por `plate`; resolución por
    `inspection_id`; 0 filas → `null`/`[]`; unidad con 6 y con 8 posiciones; posición vacía
    presente; inventario con `NULL` válidos; orden correcto.
12. **Smoke real**: cubierto en `task_16` (lecturas reales tras login).
13. **Aceptación**: pruebas verdes; sin recálculo de umbrales; sin `company_id` en requests.
14. **Comandos**: `cd WEB/tire-change && npm test -- data`.
15. **Rollback**: N/A (módulo nuevo aislado).
16. **Handoff**: fila `task_04` con lista de casos cubiertos y forma de inyección del cliente.
