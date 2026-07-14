# task_11 — Inventario/buscador + prevención de duplicados

1. **Propietario y alcance**: CODEX. Cajón de inventario/retén para montar, con buscador y bloqueo
   de selección duplicada.
2. **Objetivo y resultado observable**: al montar, se abre un cajón con `v_tire_inventory_available`;
   el usuario filtra y elige un ciclo; un ciclo ya usado en el lote no puede volver a elegirse.
3. **Dependencias**: `task_10`, `task_04`. **Bloquea**: `task_13`.
4. **Decisiones**: — (usa contratos). No bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/inventory-ui.js` y una **sección namespaced** en
   `WEB/tire-change/cambios-controller.js`. **Solo lectura**: `data.js`, `batch-model.js`,
   `CONTRATOS_UI.md §4`. **Prohibido**: HTML, `movements-ui.js`, `summary-confirm.js`. Encadenada
   tras task_10 (no paralela sobre el controlador).
6. **Estado inicial verificado**: 15 columnas de inventario y `NULL` válidos
   (`CONTRATOS_UI.md:171-190`); la disponibilidad final la revalida la RPC (`:207-208`).
7. **Contratos**: lista de `v_tire_inventory_available`; para montar se envía `life_cycle_id`
   (`CONTRATOS_UI.md:322-326`). Filtrable por `size_name`/`condition`/texto (`:207`).
8. **Pasos**: (1) Renderizar el cajón con los ciclos disponibles (código, marca, medida,
   condición, días en inventario). (2) Buscador por texto/medida/condición. (3) Excluir/inhabilitar
   los `life_cycle_id` ya presentes en algún `mount` del borrador. (4) Al elegir, invocar el
   `addMount` de task_10. (5) No asumir que una fila sigue disponible (la RPC revalida).
9. **Estados**: inventario vacío → mensaje; ciclo que desaparece mientras se edita → al confirmar,
   la RPC devuelve `[no_disponible]` y se maneja en task_13; búsqueda sin resultados → aviso.
10. **Consistencia/seguridad**: no permitir el mismo ciclo dos veces (`AUDIT.md §3.1`); no cachear
    inventario como verdad; datos sin secretos.
11. **Pruebas**: helper puro de filtrado y de "ciclos elegibles" (excluye ya usados) → testeable;
    casos con `NULL` en campos finales.
12. **Smoke real**: montar sobre una vacía eligiendo del cajón; intentar reusar el mismo ciclo →
    bloqueado; filtrar por medida.
13. **Aceptación**: montaje desde inventario funciona; duplicado imposible; filtro correcto.
14. **Comandos**: smoke desde `WEB/`; `npm test -- inventory` si hay helper puro.
15. **Rollback**: quitar `import`/sección desactiva el cajón.
16. **Handoff**: fila `task_11` con el log del smoke de montaje y del bloqueo de duplicado.
