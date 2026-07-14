# task_15 — Suite de pruebas automatizadas integrales

1. **Propietario y alcance**: CODEX. Suite que cruza los módulos puros en escenarios end-to-end de
   lógica (sin navegador).
2. **Objetivo y resultado observable**: una suite que ejercita proyección + modelo + persistencia +
   RPC juntos en los escenarios exigidos, en verde.
3. **Dependencias**: `task_04`, `task_05`, `task_06`, `task_07`, `task_08`, `task_13`. **Bloquea**:
   `task_16`.
4. **Decisiones**: — (verifica invariantes de todas). No bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/__tests__/integration.test.js`. **Solo lectura**:
   todos los módulos `WEB/tire-change/*.js`, `CONTRATOS_UI.md`. **Prohibido**: modificar los
   módulos (si un test falla por un bug, se devuelve como ⚠ a la tarea dueña, no se corrige aquí).
6. **Estado inicial verificado**: cada módulo trae sus tests unitarios (tasks 04–08); esta suite es
   el cruce. Casos exigidos en el prompt de la fase y en `CONTRATOS_UI.md §5-§7`.
7. **Contratos**: usa los módulos reales con mocks de `fetchView`/cliente RPC/`localStorage`/
   `uuidFn`.
8. **Pasos** — cubrir al menos: unidad de 6, de 8 y con una vacía; 0 filas/no autorizada/config sin
   posiciones; retén simple; descarte con causa+foto (placeholder de URL en test); montaje sobre
   vacía y reemplazo (retiro+montaje en la misma posición); swap válido y selecciones inválidas/
   duplicadas; **lote mixto con los cuatro tipos**; ciclo que desaparece del inventario (→
   `[no_disponible]`); timeout tras enviar (mismo payload y `batch_id`); edición posterior (nuevo
   `batch_id`); recarga con borrador editable y con sellado; cada error
   (`[estado_desactualizado]`, `[no_disponible]`, `[posicion_ocupada]`, `[sin_permiso]`,
   `[lote_invalido]`, fecha, desconocido); `code_mismatch=true`. Validar el **payload v1 exacto**
   contra `CONTRATOS_UI.md:362-409` con UUIDs de fixture.
9. **Estados**: cada escenario asevera estado esperado (violaciones, payload, clasificación).
10. **Consistencia/seguridad**: sin datos reales ni secretos en fixtures; UUIDs de fixture, no de
    producción.
11. **Pruebas**: es la propia suite.
12. **Smoke real**: N/A (el smoke de navegador es task_16).
13. **Aceptación**: suite verde cubriendo todos los casos listados; payload exacto verificado.
14. **Comandos**: `cd WEB/tire-change && npm test`.
15. **Rollback**: N/A.
16. **Handoff**: fila `task_15` con la matriz caso→resultado; los fallos se devuelven como ⚠ a la
    tarea dueña del módulo.
