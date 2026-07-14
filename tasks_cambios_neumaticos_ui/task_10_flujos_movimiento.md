# task_10 — Flujos de movimiento: retén, descarte, montaje, swap

1. **Propietario y alcance**: CLAUDE. UI de las cuatro operaciones y su alta al borrador.
2. **Objetivo y resultado observable**: el usuario puede enviar a retén, iniciar descarte (causa +
   placeholder de foto, la real llega en task_12), montar (destino) e intercambiar (A→B), y cada
   acción agrega el movimiento correcto al borrador vía `batch-model.js`.
3. **Dependencias**: `task_09`, `task_05`. **Bloquea**: `task_11`, `task_12`.
4. **Decisiones**: aplica Decisión 2 (selección origen→destino primaria; D&D opcional). No
   bloqueada (arranca con selección por toques).
5. **Archivos permitidos**: `WEB/tire-change/movements-ui.js` y una **sección namespaced** en
   `WEB/tire-change/cambios-controller.js`. **Solo lectura**: `batch-model.js`,
   `diagram-projection.js`, `CONTRATOS_UI.md §5.4-5.7`. **Prohibido**: HTML,
   `inventory-ui.js`/`summary-confirm.js`/`storage-client.js`. No editar en paralelo con task_11/13.
6. **Estado inicial verificado**: modal descartar existente con causas del enum
   (`Inspecciones por unidad.html:611-634`, `:619-627`); botones retén/descarte hoy simulados
   (`:927-963`); el link de código es el patrón accesible reutilizable (`:472`, `:1037-1039`).
7. **Contratos** (canónico `CONTRATOS_UI.md`): `send_to_retention` (`position`,
   `expected_life_cycle_id`, `rtd_mm?`, `:254-263`); `discard` (+`discard_cause` enum exacto,
   `photo_url` no vacío, `:275-305`); `mount` (`position`, `life_cycle_id`, `rtd_mm?`, `:311-329`);
   `swap` (`position_a/b`, `expected_life_cycle_id_a/b`, `rtd_mm_a/b?`, `:333-358`).
8. **Pasos**: (1) Al seleccionar una posición ocupada, ofrecer retén/descarte/swap; vacía →
   montar. (2) Retén → `addSendToRetention` con el `life_cycle_id` visto. (3) Descarte → modal con
   causa (reutilizar el `<select>` existente) + placeholder de `photo_url` (marcado como pendiente
   hasta task_12) → `addDiscard`. (4) Swap → seleccionar A, luego B (fallback botón/teclado) →
   `addSwap`. (5) Montar → delega la elección de ciclo a `inventory-ui.js` (task_11) → `addMount`.
   (6) Reflejar en la proyección tras cada alta.
9. **Estados**: intento inválido (retén sobre vacía, swap A=B, duplicado) → bloquear con mensaje de
   `validate`; modal sin causa/foto → confirmar deshabilitado; cancelar → sin alta.
10. **Consistencia/seguridad**: nunca perder `expected_life_cycle_id`; causa debe coincidir
    exactamente con el enum (`CONTRATOS_UI.md:298-305`); mensajes escapados; controles no nativos
    con `role`/`tabindex`/teclado.
11. **Pruebas**: la lógica de alta y validación vive en `batch-model` (task_05); aquí, smoke. Si se
    extrae un helper puro (mapeo selección→movimiento), testearlo.
12. **Smoke real**: agregar un retén, un descarte (con placeholder), un mount y un swap; ver la
    proyección provisional; deshacer uno; consola limpia. (En `task_16` con foto real.)
13. **Aceptación**: los cuatro movimientos se agregan correctamente; inválidos bloqueados;
    accesible por teclado.
14. **Comandos**: smoke servido desde `WEB/`; `npm test` verde.
15. **Rollback**: quitar el `import`/sección del controlador desactiva los flujos sin afectar
    Inspección.
16. **Handoff**: fila `task_10` con el log del smoke de los cuatro movimientos.
