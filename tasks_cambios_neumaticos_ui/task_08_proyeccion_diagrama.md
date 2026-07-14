# task_08 — Proyección pura del diagrama

1. **Propietario y alcance**: CODEX. Función pura que combina snapshot remoto + borrador en un
   estado visual por posición. **Sin DOM.**
2. **Objetivo y resultado observable**: `diagram-projection.js` devuelve, por posición, su estado
   visual (ocupada/vacía/seleccionada/origen/destino/retén/descarte/montaje/swap/discrepancia/
   conflicto) de forma determinista; con pruebas por estado.
3. **Dependencias**: `task_02`, `task_05`. **Bloquea**: `task_09`.
4. **Decisiones**: aplica Decisión 2 (marcas visuales), 7 (`code_mismatch`=REVISAR sin alarma). No
   bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/diagram-projection.js`,
   `WEB/tire-change/__tests__/diagram-projection.test.js`. **Solo lectura**: `PLAN.md §4`,
   `CONTRATOS_UI.md §2.3`. **Prohibido**: DOM, CSS, HTML.
6. **Estado inicial verificado**: `is_empty` y `code_mismatch` semántica (`CONTRATOS_UI.md:77-87`);
   invariantes de origen/destino (`:416-428`); paleta de un solo foco naranja (`knowledge/ai/09:16-22`).
7. **Contratos**: `project(remoteState, draft, selected)` → `Map<position_number, {occupancy,
   role, flags, label}>` donde `occupancy∈{occupied,empty}`, `role∈{none,origin,destination,swapA,
   swapB}`, `flags` incluye `mismatch`, `conflict`, `selected`. No decide colores CSS (eso es
   `diagram-view.js`), pero sí el estado semántico y el `label` textual.
8. **Pasos**: (1) Mapear cada posición del snapshot. (2) Aplicar los movimientos del borrador para
   derivar roles. (3) Marcar `mismatch` si `code_mismatch=true` (sin bloquear). (4) Marcar
   `conflict` si el borrador viola una invariante que toca esa posición o si se conoce un error de
   posición de la RPC. (5) Determinista y puro.
9. **Estados**: posición vacía sigue seleccionable para mount; posición con dos intenciones →
   `conflict`; sin borrador → proyección = snapshot puro.
10. **Consistencia/seguridad**: no inventar posiciones; no derivar de la inspección; no afirmar
    identidad física en `mismatch` (solo "REVISAR").
11. **Pruebas**: unidad de 6, de 8, con vacía; origen sobre ocupada; destino sobre libre-tras-
    retiro; swap A/B; `code_mismatch=true`; conflicto por doble uso de posición; sin borrador.
12. **Smoke real**: en `task_16` (render real).
13. **Aceptación**: proyección determinista y cubierta por pruebas de cada estado.
14. **Comandos**: `cd WEB/tire-change && npm test -- diagram-projection`.
15. **Rollback**: N/A.
16. **Handoff**: fila `task_08` con el diccionario de estados/roles y casos cubiertos.
