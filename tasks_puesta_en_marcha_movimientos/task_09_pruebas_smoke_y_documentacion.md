# task_09 — Suite de pruebas, smoke real y documentación

**1. Propietario**: CODEX.

**2. Objetivo y resultado observable**
Cerrar la suite del módulo, hacer el smoke completo del recorrido real y dejar la documentación
alineada con lo que quedó implementado. Resultado observable: `npm test` verde en
`WEB/movimientos`, `npm run docs:check` verde, y una nota de knowledge que le permite a alguien
nuevo entender qué es Movimientos, qué es la línea base y por qué es perezosa.

**3. Dependencias y tareas que bloquea**
Depende de: `task_08`. Bloquea: `task_10`.

**4. Archivos**
- Permitidos (exclusivos):
  - `WEB/movimientos/__tests__/baseline-model.test.js`, `__tests__/baseline-rpc.test.js`
  - `WEB/movimientos/README.md`
  - `knowledge/ai/07 - Web dashboards y taller.md`
  - `knowledge/ai/13 - Glosario.md`
  - `knowledge/ai/02 - Estado actual.md`
- Prohibidos: todo módulo `.js` de producción (son de `task_07`/`task_08`; si un test encuentra un
  bug, la tarea dueña vuelve a `EN CORRECCIÓN`), `supabase/**`,
  `tasks_cambios_neumaticos*/**` y `tasks_opencode/**` (historia, `knowledge/ai/00:43`).

**5. Contratos**
Ninguno nuevo. Documenta los de `PLAN.md §3`, `§4` y `§5` tal como quedaron **implementados y
verificados** — no como los planeó este documento. Si difieren, manda lo implementado y se dice.

**6. Pasos**
1. Completar la cobertura pura que `task_08` no haya cubierto: casos límite de `baseline-model.js`
   y clasificación de errores de `rpc.js`.
2. **Smoke real completo** (`PRUEBA_CAMPO.md` es el modelo), con placa real y usuario de taller de
   prueba, consola limpia:
   - Una unidad CIVA (sin ninguna instalación): todas sus posiciones pendientes; primer montaje de
     **una** posición; luego un `swap` normal entre esa y otra ya con línea base → **funciona**.
   - Una posición **sin código** en la inspección: formulario con código vacío y obligatorio.
   - Una posición con **código duplicado**: `[codigo_en_uso]` y la salida por inventario funciona.
   - Enlace viejo `?mode=cambios` → Movimientos, URL canonicalizada.
   - Borrador de primer montaje + F5 → persiste.
   - Recorrido completo por teclado y en viewport móvil.
3. `WEB/movimientos/README.md`: actualizar la tabla de módulos con `baseline-model.js` y
   `baseline-ui.js`; documentar el flujo de línea base y **por qué es perezosa**; anotar la vigencia
   del alias (D3).
4. `knowledge/ai/07 - Web dashboards y taller.md`: reemplazar la descripción del modo Cambios por
   Movimientos; la URL canónica; y **el hecho central**: una posición vacía con evidencia de
   inspección está *pendiente de línea base*, no *disponible*; la línea base nace al operar.
5. `knowledge/ai/13 - Glosario.md`: entradas **Movimientos** (ex "Cambios"), **línea base**,
   **procedencia (`origin`)**. Y la equivalencia técnica: el lote sigue llamándose
   `tire_change_batches` / `confirm_tire_change_batch` en el esquema (`PLAN.md §7.2`).
6. `knowledge/ai/02 - Estado actual.md`: qué existe de verdad ahora. **Con honestidad**: la flota
   **no** está toda con línea base; se completa a medida que taller opera; el indicador es
   `supabase/diagnostics/baseline_profile.sql` (Q6).
7. `npm run docs:check` (`knowledge/ai/14 - Mantenimiento documental.md`).

**7. Invariantes**
- **La documentación describe lo implementado, no lo planeado.** Si `PLAN.md` y el código difieren,
  manda el código y se registra la diferencia (`knowledge/ai/00:35-44`).
- **No prometer lo que no hay**: la nota de estado debe decir que la puesta en marcha es gradual y
  que el tablero consolidado llega de a poco (`AUDIT.md` B12). Nada de "la flota ya está cargada".
- No duplicar especificaciones extensas en knowledge: resumir y enlazar (`CLAUDE.md`).
- Los tests no cambian código de producción.
- El smoke escribe historia real: usar la unidad/usuario de prueba acordados y registrar lo creado.
- Historia (`tasks_*`, `docs/run*`) no se reescribe.

**8. Casos de error, ambigüedad y concurrencia**
- Si el smoke encuentra un bug → la tarea dueña (`task_07`/`task_08`) vuelve a `EN CORRECCIÓN`;
  `task_09` **no** parchea código ajeno.
- Si `docs:check` falla por un enlace `[[wiki]]` roto, arreglar el enlace, no borrar la nota.
- Si no hay credenciales de prueba, el smoke **no se hace con datos reales de cliente**: se detiene
  y se pide el insumo (`tasks_cambios_neumaticos_ui/DECISIONES.md:201-205`).
- Concurrencia: ninguna otra tarea toca estos archivos.

**9. Criterios de aceptación**
- `npm test` en `WEB/movimientos` → todo verde, con el total declarado.
- `npm run docs:check` → verde.
- Los 6 recorridos del smoke, ejecutados y documentados con su resultado real (incluido lo que
  falle).
- `knowledge/ai/02`, `07` y `13` actualizados, con `updated:` y `sources:` correctos en el
  frontmatter (`knowledge/ai/14`).
- El README refleja los 18 módulos reales de `WEB/movimientos/`.

**10. Comandos y verificación**
```bash
cd WEB/movimientos && npm test
cd ../.. && npm run docs:check && npm run docs:sync   # sync solo si el proyecto lo pide
python3 -m http.server 8765 --directory WEB
```

**11. Rollback / limpieza**
`git revert` para docs y tests: sin efecto en datos. Las instalaciones que cree el smoke son
historia real de la unidad de prueba: limpiarlas o dejarlas registradas, según lo acordado
(`tasks_cambios_neumaticos_ui/DECISIONES.md:167-185`).

**12. Handoff a `STATE.md`**
Fila `task_09` → `Resultado`: total de la suite, notas de knowledge actualizadas, y **la lista de
diferencias entre `PLAN.md` y lo implementado** (si las hay) — es lo que `task_10` audita.
`Revisión`: `npm test` (N/N), `docs:check` verde, y el detalle de los 6 recorridos del smoke con su
resultado real.
