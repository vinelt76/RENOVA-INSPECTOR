# PLAN — Fase 2 UI · Modo Cambios de Neumáticos

Fecha: 2026-07-13. Basado en `AUDIT.md` y `DECISIONES.md` (misma carpeta) y en la fuente canónica
de contratos `tasks_cambios_neumaticos/CONTRATOS_UI.md`. Esta fase entrega **solo frontend** sobre
la arquitectura estática real de `WEB/` (sin cambiar el stack) más **un** prerrequisito de backend
acotado y revisable: el bucket de Storage para la foto de descarte. No toca `app/`, SQLite,
Capacitor ni el flujo móvil, ni las fórmulas/umbrales/semáforos del modo Inspección.

---

## 1. Arquitectura propuesta y límites de módulos

Se extraen módulos ES pequeños bajo `WEB/tire-change/` (Decisión 9), importados desde
`WEB/Inspecciones por unidad.html` con `type="module"`. Regla: **la lógica pura no toca el DOM; la
UI no reimplementa reglas de negocio.** Todos los archivos nuevos viven bajo `WEB/tire-change/`
salvo dos ediciones puntuales en archivos existentes (marcadas abajo).

| Módulo | Responsabilidad | Toca DOM | Testeable puro |
|---|---|---|---|
| `data.js` | `resolveUnitId`, `loadUnitPositionState`, `loadAvailableInventory`, normalización de filas | No | Sí (con mock de `fetchView`) |
| `batch-model.js` | Máquina de estados del lote: agregar/quitar/editar movimientos, invariantes, sellado (`crypto.randomUUID` inyectable), construcción del payload v1 exacto | No | Sí |
| `batch-store.js` | Persistencia `localStorage` de borrador y payload sellado; scoping usuario+empresa+unidad; reanudación | No (usa `localStorage`) | Sí (con mock de storage) |
| `rpc.js` | Llamada a `confirm_tire_change_batch`, `classifyBatchError`, retry inmutable, recarga tras éxito | No | Sí (con mock de cliente) |
| `diagram-projection.js` | Función pura `(remoteState, draft) → estado visual por posición` (ocupada/vacía/origen/destino/retén/descarte/montaje/swap/discrepancia/conflicto) | No | Sí |
| `storage-client.js` | Captura/preview/upload/borrado de foto de descarte a Storage; limpieza de huérfanos | Parcial (input file) | Parcial |
| `diagram-view.js` | Render de ruedas/dock desde la proyección; estados cromáticos y etiquetas | Sí | No (smoke) |
| `movements-ui.js` | Modales retén/descarte/montaje/swap; selección origen→destino; fallback teclado | Sí | No (smoke) |
| `inventory-ui.js` | Cajón de inventario/retén, buscador, prevención de selección duplicada | Sí | No (smoke) |
| `summary-confirm.js` | Resumen de movimientos, deshacer/editar, encabezado (fecha/odómetro/notas), confirmación y feedback de errores | Sí | No (smoke) |
| `mode-toggle.js` | Selector Inspección/Cambios; conservación total del modo Inspección | Sí | No (smoke) |
| `cambios-controller.js` | Orquestador: cablea submódulos, mantiene el estado vivo, suscribe store y Realtime | Sí | No (smoke) |
| `tire-change.css` | Tokens/estilos del modo Cambios reutilizando la paleta vigente | — | — |

Ediciones en archivos existentes (mínimas, exclusivas de una tarea cada una):
- `WEB/Inspecciones por unidad.html`: agregar el contenedor del modo, el toggle y el `import` del
  controlador. **Dueño único: `task_09`.** Ninguna otra tarea edita el HTML en paralelo.
- `WEB/supabase-demo.js`: fijar la versión de supabase-js (Decisión 8). **Dueño único: `task_07`.**

**Acoplamiento conocido y mitigación**: `cambios-controller.js` es el punto de coordinación que
varias tareas de UI extienden. Para no violar "sin escrituras paralelas sobre el mismo archivo",
esas tareas están **encadenadas por dependencias** (nunca activas a la vez) y cada una agrega su
sección con un espacio de nombres propio. La mayor parte de la lógica de cada tarea vive en su
submódulo disjunto (`movements-ui.js`, `inventory-ui.js`, `summary-confirm.js`, etc.).

---

## 2. Flujo de usuario paso a paso

1. El usuario llega desde `INSPECCIONES POR FECHA.html` (`openInspection`) con
   `?inspection_id=…&plate=…`. La pantalla arranca en **modo Inspección** (comportamiento actual,
   intacto).
2. Las **tabs "Inspección | Cambios" sobre el diagrama** (Decisión 1) permiten cambiar de modo. Al
   entrar por primera vez a **Cambios**, se resuelve `unit_id` (desde `plate`) y se cargan en
   paralelo `v_unit_position_state` y `v_tire_inventory_available`.
3. El diagrama muestra **todas** las posiciones de la configuración, incluidas las vacías
   (seleccionables para montar). El estado de cada posición sale de `v_unit_position_state`, no de
   la inspección.
4. El usuario selecciona una posición y una acción:
   - **Enviar a retén** (posición ocupada) → agrega movimiento `send_to_retention`.
   - **Descartar** (posición ocupada) → modal con causa (enum) + **foto real obligatoria** →
     `discard`.
   - **Montar** (posición que quedará libre) → abre el cajón de inventario/retén, elige un ciclo →
     `mount`.
   - **Intercambiar** (dos posiciones ocupadas) → selecciona A, luego B → `swap`.
5. Cada movimiento se agrega al **borrador** (nada persiste en Supabase). El diagrama muestra la
   **proyección provisional** (§4). Las invariantes (§4.2) impiden combinaciones inválidas.
6. El usuario revisa el **resumen** de movimientos: puede deshacer/editar. Completa fecha
   (default hoy, editable), **odómetro (obligatorio, Decisión 6)** y notas (opcional).
7. **Confirmar** → se genera `batch_id` una vez, se sella el payload v1, se persiste, y se llama
   `confirm_tire_change_batch({ p_batch })` una sola vez.
8. Éxito → se recargan ambas vistas, se limpia el borrador/sellado, feedback claro (toast +
   resumen aplicado). El diagrama refleja el nuevo estado real.
9. Error → manejo por clase (§6). El usuario nunca pierde su trabajo salvo en
   `[estado_desactualizado]`, donde se descarta el borrador y se pide rearmar sobre el estado
   recargado.
10. El usuario puede volver a **modo Inspección** sin perder ni contaminar los datos históricos.

---

## 3. Modelo de estado provisional y transiciones

Estados del editor (`batch-model.js` + `cambios-controller.js`):

```
EMPTY ──addMovement──▶ EDITING ──addMovement/undo/edit──▶ EDITING
EDITING ──seal(confirm)──▶ SEALED ──rpc ok──▶ APPLIED ──reload──▶ EMPTY
SEALED ──rpc network/timeout──▶ SEALED (retry mismo batch_id, mismo payload)
SEALED ──rpc domain error (lote_invalido/no_disponible/posicion_ocupada/sin_permiso)──▶ EDITING (payload roto, corregir; NO retry ciego)
SEALED ──rpc [estado_desactualizado]──▶ EMPTY (descartar borrador, recargar, rearmar)
EDITING ──editAfterSeal──▶ EDITING (nuevo batch_id en el próximo sellado)
```

Artefactos (ver `AUDIT.md §3`): `remoteState` (inmutable hasta recarga), `draft.movements`
(editable), `projection` (derivada pura), `sealedBatch` (inmutable), `result`.

### 3.1 Datos que viajan

- `unit_id` sale de `v_unit_position_state` (nunca de la inspección).
- Cada movimiento conserva `expected_life_cycle_id(_a/_b)` copiado del `life_cycle_id` visto en la
  posición al momento de agregarlo. No se re-lee al sellar.
- La empresa **nunca** se envía; la deriva el backend del JWT.

---

## 4. Proyección del diagrama e invariantes

### 4.1 Estados visuales por posición (Decisión 2, 7; paleta `knowledge/ai/09`)

| Estado | Origen | Marca visual propuesta (a validar con Diseño) |
|---|---|---|
| Ocupada normal | `is_empty=false`, sin movimiento | Borde sólido, color de estado si aplica |
| Vacía | `is_empty=true` | Borde punteado tenue, rótulo "VACÍA" |
| Seleccionada (foco) | selección actual | **Anillo/relleno naranja** — único foco (regla de paleta) |
| Origen (retén/descarte/swap A) | movimiento agrega origen | Borde punteado + etiqueta ("A RETÉN"/"DESCARTE"/"SWAP") |
| Destino (mount/swap B) | movimiento agrega destino | Borde punteado + etiqueta ("MONTAR"/"SWAP") |
| Discrepancia | `code_mismatch=true` | Etiqueta textual "REVISAR IDENTIDAD" (no alarma, no rojo) |
| Conflicto | invariante violada / RPC error de posición | Etiqueta "CONFLICTO" + amarillo (no un segundo naranja) |

El **dock dinámico** (ya existente, `renderDock`) es la superficie accesible primaria; el twin 3D
se conserva para MVP (bus 2-4/2-4-2, ≤8 posiciones) pero su visibilidad/etiquetas se derivan de la
proyección, no de la inspección.

### 4.2 Invariantes (puras, en `batch-model.js`; probadas en `task_05`/`task_15`)

Derivadas de `CONTRATOS_UI.md:416-428` (ver `AUDIT.md §3.1`): no operar sobre vacía; mount solo
sobre posición que quedará libre; un `life_cycle_id` de inventario a lo sumo un mount; cada
posición a lo sumo un origen y un destino (swap cuenta ambos); no perder `expected_life_cycle_id`;
no mutar payload tras `batch_id`; no regenerar UUID en retry; no reintentar lote rechazado por
dominio; aislar borrador por usuario/empresa/unidad; no pisar borrador por Realtime.

---

## 5. Persistencia, retry y Realtime

- **Persistencia** (`batch-store.js`, Decisión 4): dos claves separadas en `localStorage`,
  namespaced con usuario+empresa+unidad+`batch_id`. Borrador editable y payload sellado no se
  mezclan. Al reanudar tras recarga se valida que `unit_id`/sesión coincidan antes de restaurar.
- **Retry** (`rpc.js`, `CONTRATOS_UI.md:592-674`): persistir **antes** de llamar. Ante red/timeout,
  reenviar el **mismo** payload sellado sin cambiar `batch_id`. Ante error de dominio, no retry
  ciego. supabase-js fija su versión y conserva retry automático solo por su seguridad idempotente
  (Decisión 8).
- **Realtime** (`cambios-controller.js`, Decisión 5): en modo Cambios se suscribe a las tablas de
  taller; si hay borrador, **no** auto-recarga: muestra banner "el estado cambió, revisá". Sin
  borrador, recarga el estado. Nunca sobrescribe un borrador en silencio.

---

## 6. Manejo exacto de cada clase de error

Clasificación por `error.code` + prefijo de `error.message` (`CONTRATOS_UI.md:521-546`,
`:628-645`). Siempre registrar el objeto `error` completo en consola; mostrar `error.message`
**escapado** (nunca HTML sin escapar).

| Clase | `error.code` / prefijo | Acción de UI |
|---|---|---|
| `invalid_batch` | prefijo `[lote_invalido]` (`22023`) | Conservar borrador; señalar el movimiento/campo; corregir; **no** retry automático. |
| `stale_state` | `40001` / `[estado_desactualizado]` | Descartar borrador y sellado; recargar `v_unit_position_state`; pedir rearmar. |
| `unavailable_cycle` | prefijo `[no_disponible]` (`22023`) | Recargar inventario; quitar/reemplazar ese `mount`; no retry ciego. |
| `occupied_position` | `23505` / `[posicion_ocupada]` | Recargar estado; señalar el destino ocupado. |
| `forbidden` | `42501` / `[sin_permiso]` | Bloquear confirmación; pedir sesión/rol autorizado. |
| Fecha < instalación | mensaje sin prefijo estable | Mostrar el mensaje; sugerir corregir `performed_at`. |
| `unknown` | resto | Mostrar mensaje genérico + `error.message`; conservar borrador; ofrecer reintento manual solo si fue de red. |
| Fallo de upload de foto | error de Storage | No sellar el lote; permitir reintentar upload o cancelar; limpiar objeto huérfano. |

---

## 7. Mapa de archivos que se crean/modifican

Crea (todos bajo `WEB/tire-change/`):
`data.js`, `batch-model.js`, `batch-store.js`, `rpc.js`, `diagram-projection.js`,
`storage-client.js`, `diagram-view.js`, `movements-ui.js`, `inventory-ui.js`,
`summary-confirm.js`, `mode-toggle.js`, `cambios-controller.js`, `tire-change.css`, y
`WEB/tire-change/__tests__/*.test.js` con `vitest.config.js` + `package.json` de scope de test.

Backend (prerrequisito acotado): `supabase/migrations/2026NNNN_tire_discard_photos_bucket.sql`
(bucket + policies de `storage.objects`) y `supabase/tests/tire_discard_photos.test.sql`.

Modifica (una tarea dueña cada uno): `WEB/Inspecciones por unidad.html` (`task_09`),
`WEB/supabase-demo.js` (`task_07`).

Documentación (`task_16`): `knowledge/ai/05 - Datos y Supabase.md`,
`knowledge/ai/07 - Web dashboards y taller.md`, y `docs:check`.

---

## 8. Grafo de dependencias (sin ciclos)

```
task_01 (cierre de decisiones humanas bloqueantes)
task_02 (andamiaje módulos + runner de tests)
   ├── task_04 (data.js)          [dep: task_02]
   ├── task_05 (batch-model.js)   [dep: task_02]
   ├── task_06 (batch-store.js)   [dep: task_02, task_05]
   ├── task_07 (rpc.js + pin supabase-js) [dep: task_02, task_05]
   └── task_08 (diagram-projection.js)    [dep: task_02, task_05]
task_03 (Storage bucket+RLS)  [dep: task_01·Decisión 3 RESUELTA] — aplicar migración requiere aprobación humana
task_09 (mode-toggle + controlador + edición HTML mínima) [dep: task_04, task_08]
task_10 (movements-ui: retén/descarte/montaje/swap)       [dep: task_09, task_05]
task_11 (inventory-ui + prevención duplicados)            [dep: task_10, task_04]
task_12 (foto real a Storage en descarte) [dep: task_03, task_10] — Decisión 3 RESUELTA
task_13 (resumen/deshacer/confirmar/errores/retry/Realtime) [dep: task_11, task_06, task_07, task_12]
task_14 (accesibilidad + responsive)   [dep: task_13]
task_15 (suite de pruebas automatizadas integrales) [dep: task_04..task_08, task_13]
task_16 (smoke real E2E + documentación + revisión cruzada final) [dep: task_14, task_15] — Decisión 10 RESUELTA; falta insumo humano (placa/credenciales de prueba)
```

No hay ciclos. Ninguna pareja de tareas activas en paralelo edita el mismo archivo: los módulos
son disjuntos y las tareas que tocan `cambios-controller.js`/HTML están encadenadas (09→10→11→13→14).

---

## 9. Hitos de entrega y definición de terminado

- **H0 — Desbloqueo**: `task_01` (decisiones) + `task_02` (andamiaje) + `task_03` (Storage,
  cuando la Decisión 3 esté aprobada).
- **H1 — Núcleo puro**: `task_04`+`task_05`+`task_06`+`task_07`+`task_08` con pruebas verdes
  (datos, modelo, persistencia, RPC/errores, proyección). Verificable sin navegador.
- **H2 — UI del modo**: `task_09`+`task_10`+`task_11` — selector, flujos de movimiento, inventario;
  modo Inspección intacto. Smoke parcial en navegador.
- **H3 — Cierre transaccional**: `task_12` (foto)+`task_13` (confirmación/errores/retry/Realtime).
- **H4 — Calidad y verificación**: `task_14` (a11y/responsive)+`task_15` (suite)+`task_16` (smoke
  real, docs, revisión cruzada).

**Definición de terminado de la fase**: modo Cambios funcional con lote mixto confirmable por una
sola llamada a la RPC; posiciones vacías renderizadas; borrador persistente y payload sellado
idempotente; manejo de las 5+ clases de error; foto real de descarte en Storage; accesibilidad por
teclado y objetivos táctiles; modo Inspección sin regresiones; pruebas automatizadas verdes; y un
smoke real de navegador con sesión autenticada, consola limpia, estado persistido tras recarga y
sin secretos en logs. La última tarea es una revisión independiente con checklist; la fase no se
aprueba sin esa evidencia.
