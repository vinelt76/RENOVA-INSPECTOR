# task_02 — Renombre integral Cambios → Movimientos (UI, rutas, módulos, docs)

**1. Propietario**: CODEX.

**2. Objetivo y resultado observable**
Renombrar el módulo de producto de "Cambios" a "Movimientos" en UI, textos, URL, carpeta, nombres de
módulo, CSS, storage y documentación, **sin un solo cambio de comportamiento**, preservando enlaces
guardados y borradores en curso. Resultado observable: la pantalla muestra la tab **Movimientos**,
la URL canónica es `?mode=movimientos`, un enlace viejo `?mode=cambios` abre el mismo modo y se
auto-canonicaliza, y las 10 suites vigentes pasan **sin cambiar ninguna aserción de comportamiento**
(solo rutas e ids).

**3. Dependencias y tareas que bloquea**
Depende de: nada (D3 solo fija el párrafo de vigencia del alias; el resto avanza igual).
Bloquea: `task_07`, `task_08`, `task_09`. Corre **en paralelo** con `task_01`/`task_03`.

**4. Archivos**
- Permitidos (exclusivos):
  - `WEB/tire-change/**` → `WEB/movimientos/**` (usar `git mv` para conservar historia).
  - `WEB/Inspecciones por unidad.html` (líneas `11`, `528-578`, `644`, `1121`).
- Prohibidos: `supabase/**` (el esquema **no** se renombra — `PLAN.md §7.2`), `app/**`,
  `tasks_cambios_neumaticos*/**`, `tasks_opencode/**`, `docs/run*` (son historia),
  `WEB/supabase-demo.js`, el resto de los dashboards.

**5. Contratos**
Ninguno nuevo. Los contratos SQL consumidos (`confirm_tire_change_batch`, `v_unit_position_state`,
`v_tire_inventory_available`) **conservan su nombre** (`PLAN.md §7.2`): `rpc.js:9` y `data.js:101`,
`:113`, `:124` **no cambian de literal**.

**6. Pasos**
1. `git mv WEB/tire-change WEB/movimientos`; dentro, `git mv cambios-controller.js
   movimientos-controller.js` y `git mv tire-change.css movimientos.css`.
2. Actualizar imports relativos entre módulos y `WEB/movimientos/vitest.config.js`.
3. `mode-toggle.js`:
   - `TIRE_CHANGE_MODES` → `MOVIMIENTOS_MODES`; `CHANGES: "cambios"` → `MOVEMENTS: "movimientos"`
     (`mode-toggle.js:1-11`).
   - `modeFromSearch` acepta **`movimientos` y `cambios`** y devuelve el modo Movimientos para
     ambos.
   - `updateUrl` escribe **siempre** `?mode=movimientos` vía `history.replaceState` (`:13-23`), así
     un enlace viejo se canonicaliza sin recargar.
   - ids: `tab-cambios`→`tab-movimientos`, `modo-cambios`→`modo-movimientos`,
     `cambios-pos-dock`→`movimientos-pos-dock` (`:36-40`).
4. `Inspecciones por unidad.html`: ids `cambios-*` → `movimientos-*`; textos "Cambios" →
   "Movimientos" (`:539`, `:578`); `href`/`src` a `movimientos/movimientos.css` y
   `movimientos/movimientos-controller.js` (`:11`, `:1121`).
5. `movimientos.css`: `html[data-renova-mode="cambios"]` → `"movimientos"` (`:49`, `:60-64`);
   `.tire-change-panel`→`.movimientos-panel` (`:68`), `.tire-change-dock`→`.movimientos-dock`
   (`:228`), `.stage.tire-change-mode`→`.stage.movimientos-mode` (`:306-377`). El prefijo `tc-` de
   los estados de rueda (`tc-empty`, `tc-origin`…) **se conserva**: es interno, no dice "cambios" y
   tocarlo multiplica el diff sin beneficio.
6. `movimientos-controller.js`: ids del DOM (`:74-87`), textos de estado (`:99-113`), mensajes de
   consola (`:625`) y de error (`:646`). Renombrar `tireChangeState`→`movimientosState`,
   `subscribeTireChangeState`→`subscribeMovimientosState`, `loadTireChangeData`→`loadMovimientosData`,
   y el export por defecto.
7. `inventory-ui.js:110` y `movements-ui.js:90`, `:115`: ids `cambios-*` → `movimientos-*`.
8. `batch-store.js:1`: `STORE_PREFIX = "renova:movimientos"`. **Migración de claves**: al leer
   (`loadDraft`/`loadSealed`), si la clave nueva no está, buscar la vieja (`renova:tire-change:*`),
   reescribirla con el prefijo nuevo y borrar la vieja. Cubrir también el barrido de `:264`. Un
   borrador o un lote sellado en curso al desplegar **no se puede perder**.
9. `package.json:2` → `"name": "renova-movimientos"`. `README.md` → título y tabla de módulos.
10. Docs: `knowledge/ai/07 - Web dashboards y taller.md:29` (nombre del modo y URL canónica) y
    `knowledge/ai/13 - Glosario.md` (entrada **Movimientos** = ex "Cambios"; y la equivalencia
    técnica: el lote sigue llamándose `tire_change_batches`/`confirm_tire_change_batch` en el
    esquema). Ejecutar `npm run docs:check`.
11. Renombrar las suites de `__tests__/` solo en lo que sea ruta/id. **No** cambiar aserciones de
    comportamiento.

**7. Invariantes**
- **Cero cambio funcional.** Si una suite necesita una aserción nueva, la tarea está mal: eso es
  `task_08`.
- El esquema remoto **no se toca**: `confirm_tire_change_batch`, `tire_change_batches`,
  `v_unit_position_state` y `v_tire_inventory_available` conservan su nombre (`PLAN.md §7.2`).
- `?mode=cambios` **debe seguir funcionando** (`PROMPT_ORQUESTADOR §6`).
- El borrador en `localStorage` **no se pierde** en el despliegue.
- El modo Inspección queda intacto: ni un id, ni una clase, ni un texto suyo cambia.
- Accesibilidad: `aria-selected`, `aria-controls`, `aria-labelledby` y el orden de foco de las tabs
  se conservan exactos (`Inspecciones por unidad.html:529`, `:577-578`).
- Historia: `tasks_cambios_neumaticos*/` y `tasks_opencode/` **no se reescriben**.

**8. Casos de error, ambigüedad y concurrencia**
- URL con **ambos** (`?mode=cambios&mode=movimientos`): `URLSearchParams.get` toma el primero;
  documentar y cubrir con un test — no debe romper.
- `?mode=` con basura: cae en Inspección, como hoy (`mode-toggle.js:8-11`).
- `localStorage` no disponible: el módulo ya tolera esto (`batch-store.js:110`); la migración de
  claves no debe romper ese camino.
- Claves viejas **y** nuevas presentes (usuario con dos pestañas durante el despliegue): gana la
  nueva; la vieja se borra. Cubrir con test.
- Concurrencia entre tareas: ninguna otra tarea toca estos archivos mientras `task_02` corre.

**9. Criterios de aceptación**
- `grep -rn "tire-change" WEB/ --exclude-dir=node_modules` → solo aciertos justificados: el nombre
  del RPC/tabla (`rpc.js:9`) y la lectura de compatibilidad de `batch-store.js`.
- `grep -rniE "\bcambios\b" WEB/movimientos/*.js "WEB/Inspecciones por unidad.html"` → solo el alias
  de URL y la migración de claves.
- `npm test` en `WEB/movimientos` → **10 archivos, 91/91** (mismo total que hoy; ver
  `tasks_cambios_neumaticos_ui/STATE.md:25`) más los tests nuevos de alias y migración de claves.
- Tests nuevos obligatorios: (a) `?mode=cambios` → modo Movimientos; (b) la URL se canonicaliza a
  `?mode=movimientos`; (c) un borrador guardado con el prefijo viejo se lee y se reescribe con el
  nuevo.
- `npm run docs:check` verde.
- Smoke real (consola limpia): sin `mode` → Inspección; `?mode=movimientos` → Movimientos;
  `?mode=cambios` → Movimientos **y la barra de direcciones muestra `?mode=movimientos`**; volver a
  Inspección quita el parámetro; recargar conserva el modo.

**10. Comandos y verificación**
```bash
cd WEB/movimientos && npm install && npm test
node --check movimientos-controller.js mode-toggle.js batch-store.js
cd ../.. && npm run docs:check
# Smoke:
python3 -m http.server 8765 --directory WEB
# http://localhost:8765/Inspecciones%20por%20unidad.html?plate=QA-CN16&mode=cambios
```

**11. Rollback / limpieza**
`git revert` del commit. Es un renombre puro: revertir no pierde datos. Los borradores migrados a
`renova:movimientos:*` quedarían huérfanos tras un revert ⇒ la lectura de compatibilidad debe ser
**bidireccional durante el despliegue** o, más simple, el revert asume la pérdida de borradores no
confirmados de esa ventana (documentarlo en el commit). Ningún dato de la base se ve afectado.

**12. Handoff a `STATE.md`**
Fila `task_02` → `Resultado`: rutas finales de los 16 módulos, **lista literal de los ids del DOM
finales** (`task_08` los necesita), nombre exacto de los exports renombrados del controlador,
prefijo nuevo de `localStorage`, y la decisión de vigencia del alias (D3) tal como se resolvió.
`Revisión`: salida de `npm test` (N/N), `node --check`, `npm run docs:check` y el detalle del smoke
con las 5 URLs probadas.
