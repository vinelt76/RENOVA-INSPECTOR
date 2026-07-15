# task_08 — Flujo guiado de primer montaje y bloqueo en la UI

**1. Propietario**: CODEX.

**2. Objetivo y resultado observable**
Que una persona pueda convertir una posición "pendiente de línea base" en una instalación real, con
los datos de la inspección precargados y editables, en una confirmación transaccional. Resultado
observable: abrir Movimientos con una placa real, tocar una posición pendiente, ver el formulario
precargado con el código y la fecha de la inspección fuente, confirmar, y ver la posición ocupada
tras la recarga del estado — con consola limpia y persistencia tras F5.

**3. Dependencias y tareas que bloquea**
Depende de: `task_07`, **D2**. Bloquea: `task_09`.

**4. Archivos**
- Permitidos (exclusivos):
  - `WEB/movimientos/baseline-model.js` (**nuevo**: máquina de estados y sellado del payload,
    lógica **pura**)
  - `WEB/movimientos/baseline-ui.js` (**nuevo**: formulario, modal, feedback)
  - `WEB/movimientos/rpc.js` (agrega `confirmBaselineMount` y la clase de error nueva)
  - `WEB/movimientos/movimientos-controller.js` (cableado)
  - `WEB/movimientos/movimientos.css`
  - `WEB/Inspecciones por unidad.html`
- Prohibidos: `data.js`, `diagram-projection.js` (de `task_07`, ya cerrada), `batch-model.js`,
  `movements-ui.js`, `inventory-ui.js`, `summary-confirm.js` (el lote de cambios **no se toca**),
  `supabase/**`, `WEB/supabase-demo.js`.

**5. Contratos**
Consume `confirm_baseline_mount(p_batch jsonb)` — **payload y retorno literales del handoff de
`task_04`**, no de este documento — y los prefijos de error de `PLAN.md §4.2`:
`[lote_invalido]`, `[sin_permiso]`, `[posicion_ocupada]`, `[codigo_en_uso]`, `[no_disponible]`,
`[evidencia_invalida]`, más `[linea_base_pendiente]` que puede venir del lote normal
(`PLAN.md §5`). La proyección de entrada es la de `task_07`.

**6. Pasos**
1. `baseline-model.js` (**puro**, sin DOM ni red):
   - Estado del borrador de primer montaje: N posiciones de **una** unidad.
   - Precarga desde la proyección: `casing_code ← last_inspection_tire_code`,
     `brand/model/size/condition/retread_design ← last_*`, `rtd_mm ← last_rtd_movi_mm`,
     `odometer ← last_odometer_km`, `source_measurement_id ← last_measurement_id`. **Todos
     editables.**
   - Invariantes de cliente antes de sellar: `condition` dentro de `{N,R1..R4}`; `condition<>'N'`
     ⇒ `retread_design`; XOR `casing_code`/`life_cycle_id`; `performed_at` obligatorio (default
     hoy); posiciones no repetidas; `seq` únicos. **Espejo** de las validaciones del RPC
     (`PLAN.md §4.2`) para dar feedback inmediato — el RPC sigue siendo la autoridad.
   - Sellado: `batch_id` con `crypto.randomUUID()`, payload inmutable. Editar tras sellar descarta
     el sellado y genera un `batch_id` nuevo — mismo contrato que el lote
     (`tasks_cambios_neumaticos_ui/DECISIONES.md:96-104`).
2. `rpc.js`: `confirmBaselineMount(pBatch, {client, logger})` con la misma forma que
   `confirmTireChangeBatch` (`rpc.js:37-60`). Sumar `baseline_pending` a `DOMAIN_ERROR_CLASSES`
   (`:10-16`) y mapear `[linea_base_pendiente]` en `classifyBatchError` (`:65-80`), más
   `invalid_evidence` para `[evidencia_invalida]`. Reutilizar `applyPendingBatch` (`:89-161`): su
   política de reintento (solo red, nunca dominio, payload idéntico) vale igual acá porque el RPC es
   idempotente por `batch_id`.
3. `baseline-ui.js`: modal accesible con el formulario precargado. Debe decir **de dónde salen los
   datos**: "según la inspección del `<last_inspected_on>`". Permite **varias posiciones en una
   confirmación** (un bus completo = una confirmación, no ocho). Ante `[codigo_en_uso]`, ofrecer la
   salida real: buscar ese código en el inventario y montarlo por `life_cycle_id`.
4. `movimientos-controller.js`: cablear selección → si la posición está `baseline_pending`, la acción
   ofrecida es **"Registrar primer montaje"**, no "Montar del retén". Tras confirmar, recargar el
   estado con `loadMovimientosData({force:true})`. Persistir el borrador en `localStorage` con el
   patrón vigente (`batch-store.js:35-39`).
5. Bloqueo en la UI (D2): una posición `baseline_pending` **no ofrece** `mount` del inventario. Si
   aun así el backend responde `[linea_base_pendiente]`, mostrar el mensaje del servidor y abrir el
   primer montaje. La UI no es la autoridad: es la comodidad.
6. `movimientos.css`: estado visual de la rueda pendiente, reutilizando los tokens vigentes y el
   patrón `tc-*` existente. Un solo foco naranja (`knowledge/ai/09:16-22`); **no inventar rojo**: no
   es un error, es un dato faltante.
7. HTML: los nodos que el modal necesite, con los ids `movimientos-*` fijados por `task_02`.

**7. Invariantes**
- **Cero lógica transaccional en JavaScript**: crear casco+ciclo+instalación es del RPC. La UI arma
  el payload y lo manda.
- **Nunca afirmar lo que no se sabe**: el formulario dice que los datos vienen de la inspección del
  `<fecha>` y que la persona los está confirmando. `performed_at` es la fecha de **la confirmación**,
  no la de la inspección.
- **Idempotencia**: el `batch_id` nace en el cliente y se reintenta idéntico; nunca se genera uno
  nuevo para reintentar un fallo de red.
- Un error de dominio **nunca** se reintenta (`rpc.js:131-134`).
- Recuperable tras recarga: el borrador sobrevive F5 (`PROMPT_ORQUESTADOR §6`).
- Accesible y móvil: modal con foco atrapado, `aria-modal`, cierre con `Esc`, operable **por
  teclado**; objetivos táctiles usables. Mismo estándar que `movements-ui.js`.
- El lote de cambios vigente **no se toca**: `batch-model.js`, `movements-ui.js`,
  `summary-confirm.js` quedan intactos. Sus suites deben pasar sin cambios.
- Modo Inspección intacto.

**8. Casos de error, ambigüedad y concurrencia**
| Caso | Comportamiento exigido |
|---|---|
| `[codigo_en_uso]` (123 posiciones, `AUDIT.md §4.4`) | Mensaje del servidor + acción "buscar ese código en el inventario" → montar por `life_cycle_id` |
| `[posicion_ocupada]` | Alguien la ocupó mientras tanto: recargar el estado y avisar |
| `[evidencia_invalida]` | Bug de cliente. Mostrar error, descartar el sellado, log completo |
| Sin código en la evidencia (309 posiciones) | Formulario igual, campo código **vacío y obligatorio** |
| Fallo de red al confirmar | Reintentar **el mismo payload** una vez (`rpc.js:136-139`); si sigue, dejarlo sellado y ofrecer reintento manual |
| Éxito pero falla la recarga | El lote **ya se aplicó**: no reintentar el RPC (`rpc.js:150-152`); avisar y reintentar solo la lectura |
| Realtime durante el borrador | Banner "el estado cambió, revisá", sin auto-recargar — misma regla que el lote (`tasks_cambios_neumaticos_ui/DECISIONES.md:106-117`) |
| Dos pestañas con la misma unidad | Cada una con su `batch_id`; la segunda choca con `[posicion_ocupada]` y recarga |
| Backend sin las migraciones | `baseline_pending` ausente → la UI se comporta como hoy (`task_07`) y el primer montaje no se ofrece |

**9. Criterios de aceptación**
- `npm test` verde, incluidas **todas** las suites vigentes sin cambios de aserción.
- Tests puros obligatorios sobre `baseline-model.js`: precarga desde la proyección; XOR
  código/ciclo; `R1` sin diseño rechazado; sellado inmutable; editar tras sellar → `batch_id` nuevo;
  payload con N posiciones.
- Tests de `rpc.js`: `[linea_base_pendiente]` → `baseline_pending` y **no** se reintenta;
  `[evidencia_invalida]` → `invalid_evidence`; error de red → un reintento con payload idéntico.
- **Smoke real** con una placa real y un usuario de taller de prueba
  (`tasks_cambios_neumaticos_ui/DECISIONES.md:167-185`), consola limpia:
  1. Posición pendiente se ve como tal, con el código de la inspección.
  2. El formulario abre precargado y dice de qué inspección salen los datos.
  3. Confirmar → la posición pasa a ocupada con etiqueta "LÍNEA BASE".
  4. F5 → el estado persiste.
  5. Intentar montar del retén en otra posición pendiente → la UI ofrece primer montaje.
  6. Una posición vacía **sin** evidencia sigue aceptando montaje del retén.
  7. Recorrido completo por teclado.

**10. Comandos y verificación**
```bash
cd WEB/movimientos && npm test
node --check baseline-model.js baseline-ui.js rpc.js movimientos-controller.js
python3 -m http.server 8765 --directory WEB
# http://localhost:8765/Inspecciones%20por%20unidad.html?plate=<placa real>&mode=movimientos
```

**11. Rollback / limpieza**
`git revert`. Las instalaciones ya creadas por el flujo **no se revierten**: las confirmó una
persona con el neumático delante; son historia legítima igual que cualquier operación de taller
(`PLAN.md §8.2`). Si una está mal, se corrige con `register_removal`, nunca con un borrado. El
smoke escribe historia real: usar la unidad/usuario de prueba acordados y registrar lo que quede.

**12. Handoff a `STATE.md`**
Fila `task_08` → `Resultado`: módulos creados con su responsabilidad, forma del payload que
efectivamente se manda, clases de error nuevas de `rpc.js`, y **qué se confirmó de verdad en el
smoke** (placa, posiciones, ids de instalación creados) para que `task_09` y `task_10` verifiquen
sobre datos concretos. `Revisión`: `npm test` (N/N), `node --check`, y el detalle de los 7 pasos del
smoke con su resultado real. Si un paso no se pudo hacer, se dice.
