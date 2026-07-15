# task_10 — Revisión cruzada final

**1. Propietario**: CLAUDE + CODEX (**cruzada**: CLAUDE revisa lo que hizo CODEX y viceversa. Nadie
firma su propio trabajo).

**2. Objetivo y resultado observable**
Probar, sobre el sistema real, que la puesta en marcha funciona, que no rompió nada y que lo
documentado coincide con lo implementado. Resultado observable: `REVISION_FINAL.md` con veredicto
por invariante, evidencia concreta, y la lista de deuda que queda abierta.

**3. Dependencias y tareas que bloquea**
Depende de: `task_06` y `task_09` APROBADAS. Bloquea: nada (cierra el proyecto).

**4. Archivos**
- Permitidos (exclusivos): `tasks_puesta_en_marcha_movimientos/REVISION_FINAL.md`.
- Prohibidos: **todo el resto**. Si la revisión encuentra un defecto, la tarea dueña vuelve a
  `EN CORRECCIÓN`; el revisor **no** arregla lo que audita.

**5. Contratos**
Verifica los de `PLAN.md §2.1`, `§3`, `§4`, `§5` y `§7` contra el remoto y el código reales.

**6. Pasos**
1. **Compatibilidad del renombre** (revisa CLAUDE):
   - `?mode=cambios` abre Movimientos y canonicaliza a `?mode=movimientos`.
   - Un borrador guardado con el prefijo `renova:tire-change:*` se migra y **no se pierde**.
   - Los nombres SQL vigentes **no** cambiaron: `confirm_tire_change_batch`, `tire_change_batches`,
     `v_unit_position_state`, `v_tire_inventory_available` siguen ahí (`PLAN.md §7.2`).
   - `grep -rn "tire-change" WEB/ --exclude-dir=node_modules` → solo lo justificado.
2. **No regresión del taller** (revisa CLAUDE): las 4 suites SQL vigentes → `TESTS_PASSED`, **sin
   editar**. `pg_proc` tiene **una sola** `register_full_installation` y **una sola**
   `confirm_tire_change_batch`.
3. **Datos reales controlados** (revisa CLAUDE, con la unidad/usuario de prueba):
   - Una posición pendiente → primer montaje → ocupada con `origin='baseline'` y
     `source_measurement_id` poblado.
   - `inspection_measurements` de esa medición: **todos** sus campos idénticos salvo `life_cycle_id`.
     Compararlos uno por uno. **La evidencia histórica no se reescribió.**
   - Reintentar el mismo `batch_id` → `already_applied=true`, cero filas nuevas.
   - `mount` del lote normal sobre una posición pendiente → `[linea_base_pendiente]`, cero
     escrituras.
   - `mount` sobre una posición vacía sin evidencia → **funciona**.
   - Tras la línea base, un `swap` normal sobre esa posición → **funciona**.
   - `v_tire_inventory_available` no creció por el primer montaje.
4. **UI** (revisa CODEX sobre lo de CODEX **no**: revisa CLAUDE):
   - Consola limpia, datos visibles, persistencia tras recarga.
   - Recorrido por teclado y en móvil.
   - Una posición vacía sin evidencia sigue ofreciendo montaje del retén (no se rompió el flujo
     legítimo).
5. **Seguridad** (revisa CLAUDE): `get_advisors security` sin lints nuevos salvo el WARN esperado
   (`BASELINE_REMOTO.md:171-174`); `anon` sin acceso a `baseline_mount_batches` ni a
   `confirm_baseline_mount`; `fn_create_casing_cycle_installation` no ejecutable por
   `authenticated`; RLS por empresa activa. Probar con un usuario de **otra** empresa que no ve ni
   toca nada.
6. **Documentación vs. implementación** (revisa CODEX): recorrer `PLAN.md` contrato por contrato y
   marcar coincide / difiere / no se hizo. Toda diferencia se registra; ninguna se silencia
   (`knowledge/ai/00:35-44`).
7. **Deuda abierta**: listar lo que queda, con dueño sugerido. Como mínimo:
   - La flota **no** está toda con línea base y puede no estarlo nunca (`AUDIT.md` B12, D0). Medir
     con `baseline_profile.sql` (Q6) y decir el número real.
   - El gate no cubre las 309 posiciones sin código (D2, contrapunto).
   - Los ciclos de línea base sin `otd_mm` no tienen % de consumo (`AUDIT.md` B3).
   - Derivas D-A/D-B/D-C de `BASELINE_REMOTO.md:195-197`, si siguen abiertas.
8. Escribir `REVISION_FINAL.md`: veredicto por invariante, evidencia (comando + salida real), deuda.

**7. Invariantes**
- **Cruzada de verdad**: quien implementó no firma su propia verificación.
- **Evidencia, no adjetivos**: cada veredicto trae el comando y su salida real. "Funciona bien" no
  es evidencia.
- **Reportar lo que falla.** Una revisión final sin hallazgos es sospechosa, no exitosa.
- El revisor no arregla: devuelve a `EN CORRECCIÓN`.
- Cero credenciales en el documento.

**8. Casos de error, ambigüedad y concurrencia**
- Defecto encontrado → tarea dueña a `EN CORRECCIÓN`; `task_10` vuelve a `PENDIENTE` hasta que se
  cierre.
- Diferencia intención/implementación → **no se resuelve en silencio**: se muestra la evidencia y se
  pide al humano decidir si se corrige el código o se aprueba el cambio (`CLAUDE.md`).
- Sin credenciales de prueba → la parte de datos reales no se ejecuta con datos de cliente: se
  detiene y se pide el insumo.

**9. Criterios de aceptación**
- Los 7 bloques del paso 6 tienen veredicto con evidencia.
- Las 4 suites SQL vigentes + `baseline_mount.test.sql` → `TESTS_PASSED`.
- `npm test` en `WEB/movimientos` → N/N. `npm run docs:check` → verde.
- La prueba con datos reales controlados está hecha y documentada, incluida la comparación campo por
  campo que prueba que la inspección no se reescribió.
- La deuda abierta está listada con dueño.

**10. Comandos y verificación**
MCP Supabase (`execute_sql`, `get_advisors`, `list_migrations`), `npm test`, `npm run docs:check`,
y el navegador con la unidad/usuario de prueba.

**11. Rollback / limpieza**
La tarea no cambia código ni esquema. Limpiar (o registrar) los datos que genere la prueba en la
unidad de prueba, según lo acordado (`tasks_cambios_neumaticos_ui/DECISIONES.md:167-185`).

**12. Handoff a `STATE.md`**
Fila `task_10` → `Resultado`: ruta de `REVISION_FINAL.md`, veredicto global y la deuda abierta con
dueño. `Revisión`: firma cruzada — quién revisó qué y con qué evidencia.
