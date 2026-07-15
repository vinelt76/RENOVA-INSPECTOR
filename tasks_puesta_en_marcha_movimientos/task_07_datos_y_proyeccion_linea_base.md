# task_07 — Capa de datos y proyección de línea base en la UI

**1. Propietario**: CODEX.

**2. Objetivo y resultado observable**
Que la UI deje de mentir: una posición vacía **con** evidencia de inspección tiene que verse como
**pendiente de línea base**, no como "disponible para montaje". Es lógica pura y testeable; no toca
DOM ni RPCs. Resultado observable: con un fixture de `v_unit_position_state` que trae
`baseline_pending=true`, `project()` devuelve un estado visual distinto de `empty`, con el código de
la inspección y su fecha.

**3. Dependencias y tareas que bloquea**
Depende de: `task_02` (nombres finales), `task_03` (**el contrato de columnas**, no su aplicación),
**D1**. Bloquea: `task_08`.

> **Corrección del 2026-07-14**: esta tarea dependía de `task_06` en la versión original del
> `PLAN`. Era un error de dependencia: `task_07` es **lógica pura con fixtures** — necesita saber
> cómo se llaman las columnas (`task_03`), no que estén aplicadas en el remoto. Además la propia
> tarea exige compatibilidad hacia atrás (columna ausente → se comporta como hoy), así que puede
> desarrollarse, testearse y hasta desplegarse antes que `task_06`. Lo que sí espera a `task_06` es
> el **smoke con datos reales**, que vive en `task_09`. Con la corrección, `task_07` corre en
> paralelo con `task_04`.

**4. Archivos**
- Permitidos (exclusivos):
  - `WEB/movimientos/data.js`
  - `WEB/movimientos/diagram-projection.js`
  - `WEB/movimientos/__tests__/data.test.js`
  - `WEB/movimientos/__tests__/diagram-projection.test.js`
- Prohibidos: `movimientos-controller.js`, `diagram-view.js`, `rpc.js`, `batch-model.js`,
  `movimientos.css`, `WEB/Inspecciones por unidad.html` (todos de `task_08`), `supabase/**`.

**5. Contratos**
Consume las 9 columnas nuevas de `v_unit_position_state` creadas por `task_03` y aplicadas por
`task_06` (`PLAN.md §3.2`): `installation_origin`, `baseline_pending`, `last_measurement_id`,
`last_brand_name`, `last_model_name`, `last_size_name`, `last_condition`, `last_retread_design`,
`last_odometer_km`. **Los nombres exactos salen del handoff de `task_03`, no de este documento.**

**6. Pasos**
1. `data.js`: agregar las 9 columnas a `UNIT_POSITION_STATE_COLUMNS` (hoy `data.js:1-30`). Sumar
   `last_odometer_km` a `POSITION_NUMERIC_COLUMNS` (`:50-54`) para que llegue como número, igual que
   `last_rtd_movi_mm`. **No** cambiar `resolveUnitId` ni `loadAvailableInventory`.
2. `diagram-projection.js`: agregar el estado de ocupación **`baseline_pending`** entre `empty` y
   `occupied`. Reglas (deterministas, en este orden):
   - hay instalación activa → `occupied`; si `installation_origin === 'baseline'`, etiqueta
     adicional **"LÍNEA BASE"** (D1: neutra, no bloquea, no colorea como alarma — mismo criterio que
     `code_mismatch`, `tasks_cambios_neumaticos_ui/DECISIONES.md:136-141`).
   - `is_empty` **y** `baseline_pending` → `baseline_pending`, etiqueta
     **"PENDIENTE DE LÍNEA BASE"** + el código de `last_inspection_tire_code`.
   - `is_empty` y no `baseline_pending` → `empty` ("VACÍA · DISPONIBLE PARA MONTAJE"), como hoy.
3. Exponer en la proyección los datos de precarga que `task_08` va a necesitar (`last_*` +
   `last_inspected_on` + `last_measurement_id`), sin formatearlos: **la proyección no arma
   formularios**, solo describe el estado.
4. La proyección debe seguir componiendo `(remoteState, draft)` como hoy: un movimiento del borrador
   **sigue mandando** sobre el estado remoto en lo visual.
5. Tests puros con fixtures inline (sin red, sin DOM), cubriendo los casos de §8.

**7. Invariantes**
- **`diagram-projection.js` es lógica pura**: no toca DOM, no llama a la red, no lee
  `localStorage`. Regla de oro del módulo (`WEB/movimientos/README.md`).
- **No reimplementar reglas de negocio**: `baseline_pending` lo decide la vista SQL
  (`PLAN.md §3.2`), no la UI. El JavaScript **no** recalcula "¿hay código en la última inspección?".
  Si la vista dice `false`, la UI dice `false`.
- El estado `empty` conserva su significado exacto para las posiciones sin evidencia: no se puede
  degradar el montaje legítimo del retén.
- La etiqueta de línea base es **neutra**: no afirma que el neumático fue verificado hoy ni que hay
  un problema.
- Cero cambios de comportamiento en Inspección.
- Las 28 columnas que `data.js` ya pedía siguen pidiéndose igual.

**8. Casos de error, ambigüedad y concurrencia**
| Caso | Comportamiento exigido |
|---|---|
| `baseline_pending` ausente (backend viejo, despliegue gradual) | `undefined` → tratar como `false`: la UI se comporta **exactamente como hoy**. El despliegue de UI no puede exigir el de la base. |
| `baseline_pending=true` y `last_inspection_tire_code` nulo | Contradice a la vista; ganar por lo seguro: mostrar "PENDIENTE DE LÍNEA BASE" sin código. |
| `installation_origin` ausente | Sin etiqueta "LÍNEA BASE"; la posición se ve ocupada normal. |
| Posición ocupada **y** `baseline_pending=true` | Imposible por definición de la vista; si llega, gana `occupied` y se registra un `console.warn`. |
| Borrador con un movimiento sobre una posición `baseline_pending` | No debería existir (`task_08` no lo permite); si llega, la proyección lo muestra y el gate del backend lo rechaza. Fallar seguro, no romper. |

**9. Criterios de aceptación**
- `npm test` en `WEB/movimientos` → todo verde, incluidas las suites vigentes sin cambios de
  aserción.
- Tests nuevos obligatorios: (a) `baseline_pending=true` → estado `baseline_pending` con código;
  (b) `is_empty` sin evidencia → `empty`, idéntico a hoy; (c) `installation_origin='baseline'` →
  etiqueta "LÍNEA BASE"; (d) columna ausente → se comporta como hoy (compatibilidad hacia atrás);
  (e) `data.js` pide las 37 columnas y normaliza `last_odometer_km` a número.
- `diagram-projection.js` sigue sin importar nada del DOM (verificable por lectura del import list).
- Cero cambios en `rpc.js`, `batch-model.js` ni el controlador.

**10. Comandos y verificación**
```bash
cd WEB/movimientos && npm test
node --check data.js diagram-projection.js
```
El smoke real con datos es de `task_08`/`task_09`: acá la lógica es pura y los fixtures alcanzan.

**11. Rollback / limpieza**
`git revert`. No escribe datos ni cambia rutas públicas. La compatibilidad hacia atrás (columna
ausente → como hoy) hace que revertir la UI sin revertir la base sea seguro, y viceversa.

**12. Handoff a `STATE.md`**
Fila `task_07` → `Resultado`: **la forma exacta del objeto que devuelve `project()`** para una
posición `baseline_pending`, con los campos de precarga disponibles (`task_08` construye el
formulario a partir de esto), y los literales de las etiquetas. `Revisión`: salida de `npm test`
(N/N), `node --check`, y la lista de los tests nuevos con lo que prueban.
