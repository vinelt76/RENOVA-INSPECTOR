# task_09 — Selector de modo + controlador + integración HTML mínima

1. **Propietario y alcance**: CLAUDE. Spine de la UI: **tabs Inspección/Cambios sobre el diagrama**,
   orquestador y render del diagrama; **única** tarea que edita el HTML.
2. **Objetivo y resultado observable**: la pantalla tiene **tabs "Inspección | Cambios" sobre el
   diagrama/gemelo** (Decisión 1); al entrar a Cambios carga el estado de taller y renderiza
   **todas** las posiciones (incl. vacías); el modo Inspección queda intacto.
3. **Dependencias**: `task_04`, `task_08`. **Bloquea**: `task_10`, `task_11`, `task_13`, `task_14`.
4. **Decisiones**: aplica Decisión 1 (**tabs sobre el diagrama**, `?mode=cambios`; NO header),
   2 (superficie accesible primaria = dock), 7. RESUELTAS — no bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/mode-toggle.js`,
   `WEB/tire-change/cambios-controller.js`, `WEB/tire-change/diagram-view.js`,
   `WEB/tire-change/tire-change.css`, y **una** edición de `WEB/Inspecciones por unidad.html`
   (contenedor + toggle + `import type="module"`). **Solo lectura**: `data.js`,
   `diagram-projection.js`, `AUDIT.md §1`. **Prohibido**: `supabase-demo.js`, otros submódulos de
   UI (los crean tasks 10/11/13).
6. **Estado inicial verificado**: pantalla monomodo; `init()` con `onRenovaSupabaseReady` +
   `requireAuth` + `loadSupabaseInspection` (`Inspecciones por unidad.html:1051-1066`); dock
   dinámico (`:971-977`); twin 3D hardcodea P1–P8 (`:561-584`).
7. **Contratos**: consume `data.js` (`resolveUnitId`, `loadUnitPositionState`,
   `loadAvailableInventory`) y `diagram-projection.js` (`project`). Expone en
   `cambios-controller.js` un estado vivo `{remoteState, draft, selected}` y hooks para submódulos.
8. **Pasos**: (1) Agregar en el HTML **tabs "Inspección | Cambios" sobre el diagrama** (dentro del
   `.stage`, sin chocar con `.stage-eyebrow`, `Inspecciones por unidad.html:274-279`), con
   `role="tab"`/`aria-selected`, y un contenedor `#modo-cambios` oculto por defecto; importar
   `cambios-controller.js`. (2) `mode-toggle.js` cambia de modo, refleja `?mode=cambios`, y **no**
   recarga Inspección. (3) Al entrar a Cambios por
   primera vez: `resolveUnitId` → cargar ambas vistas en paralelo. (4) `diagram-view.js` renderiza
   dock + ruedas desde la proyección; el dock (accesible) es primario; las ruedas hardcodeadas se
   muestran/ocultan y etiquetan según proyección (MVP ≤8 posiciones). (5) Estilos en
   `tire-change.css` reutilizando tokens de paleta.
9. **Estados**: cargando (spinner/placeholder); vacío/no autorizado (0 filas → mensaje, sin romper
   sesión, `CONTRATOS_UI.md:102-103`); error de red (degradar con aviso); éxito (diagrama pintado);
   volver a Inspección sin recargar sus datos.
10. **Consistencia/seguridad**: no contaminar `POSICIONES`/estado de Inspección; no derivar
    posiciones de la inspección; un solo foco naranja (`knowledge/ai/09:16-22`); `?mode=` no expone
    datos sensibles.
11. **Pruebas**: la lógica pura ya está en task_04/08; aquí se valida por smoke. Añadir, si aplica,
    un test de `mode-toggle` de sincronización con `?mode=` (mock DOM).
12. **Smoke real**: login → abrir unidad → cambiar a Cambios → ver todas las posiciones incl. una
    vacía → volver a Inspección y confirmar datos históricos intactos; consola limpia; recargar con
    `?mode=cambios` mantiene el modo. Precondición: sesión de prueba (Decisión 10).
13. **Aceptación**: toggle funcional; posiciones vacías visibles; Inspección sin regresión; consola
    sin errores.
14. **Comandos**: servir `WEB/` (p. ej. `python3 -m http.server` desde `WEB/`) y recorrer el flujo;
    `cd WEB/tire-change && npm test` sigue verde.
15. **Rollback**: revertir la edición del HTML restaura la pantalla monomodo; los módulos nuevos
    quedan inertes si no se importan.
16. **Handoff**: fila `task_09` con capturas/log del smoke parcial y confirmación de no-regresión
    de Inspección.
