# task_14 — Accesibilidad y responsive

1. **Propietario y alcance**: CODEX. Accesibilidad por teclado, foco y objetivos táctiles, y
   comportamiento móvil/escritorio del modo Cambios.
2. **Objetivo y resultado observable**: todos los controles del modo Cambios son operables por
   teclado; los modales atrapan foco y cierran con Escape restaurando el foco; los objetivos
   táctiles toleran uso de campo; el layout funciona en móvil y escritorio.
3. **Dependencias**: `task_13`. **Bloquea**: `task_16`.
4. **Decisiones**: aplica Decisión 2 (fallback accesible obligatorio). No bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/a11y.js` (helpers de foco/teclado) + ediciones en los
   submódulos de UI **propios de esta tarea** y `WEB/tire-change/tire-change.css`. **Solo lectura**:
   `knowledge/ai/09`, `AUDIT.md §1.6`. **Prohibido**: `supabase-demo.js`, HTML (el toggle ya está),
   la lógica pura. Encadenada tras task_13.
6. **Estado inicial verificado**: ruedas hoy no accesibles por teclado
   (`Inspecciones por unidad.html:1008`); modales sin trap/Escape/foco (`:911`); patrón accesible
   de `#id-codigo` (`:472`, `:1037-1039`); objetivos táctiles del 3D poco fiables (`AUDIT.md §1.6`).
7. **Contratos**: `role`/`tabindex`/handlers de teclado en controles no nativos; trap de foco +
   Escape + restauración en modales; objetivos táctiles ≥ tamaño usable; breakpoints móviles.
8. **Pasos**: (1) Hacer las ruedas/selecciones operables por teclado (patrón `#id-codigo`). (2)
   Trap de foco y Escape en los modales de descarte/inventario/confirmación, restaurando el foco al
   disparador. (3) Asegurar que el **dock** (accesible) permite todo el flujo sin depender del 3D.
   (4) Estilos responsive: panel colapsable/apilado en móvil, objetivos táctiles amplios. (5)
   Respetar `prefers-reduced-motion` para las animaciones del modo Cambios.
9. **Estados**: navegación con teclado en cada modal; Escape/cancelar; foco visible; layout angosto
   sin scroll horizontal del body.
10. **Consistencia/seguridad**: no romper la paleta ni el foco único naranja; no introducir
    dependencias externas.
11. **Pruebas**: si hay helpers de foco puros, testearlos; el resto por smoke con teclado.
12. **Smoke real**: recorrer todo el flujo solo con teclado; probar en viewport móvil y escritorio;
    foco de modal correcto; Escape cierra y restaura foco.
13. **Aceptación**: flujo completo por teclado; modales accesibles; táctil y responsive OK; consola
    limpia.
14. **Comandos**: smoke manual con teclado en dos viewports; `npm test` verde.
15. **Rollback**: revertir ediciones de a11y no afecta la lógica.
16. **Handoff**: fila `task_14` con checklist de a11y (teclado, foco, Escape, táctil, responsive).
