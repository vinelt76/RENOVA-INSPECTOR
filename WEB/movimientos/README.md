# WEB/movimientos — Modo Movimientos de Neumáticos

Módulos ES del **modo Movimientos** del dashboard `WEB/Inspecciones por unidad.html`. Se importan desde
el HTML con `type="module"`. Arquitectura estática (sin cambiar el stack). Fuente canónica de
contratos backend: `tasks_cambios_neumaticos/CONTRATOS_UI.md`. Plan y tareas:
`tasks_cambios_neumaticos_ui/`.

Regla de oro: **la lógica pura no toca el DOM; la UI no reimplementa reglas de negocio.**

## Límites de módulos (ver `tasks_cambios_neumaticos_ui/PLAN.md §1`)

| Módulo | Responsabilidad | Toca DOM | Testeable puro | Crea |
|---|---|---|---|---|
| `data.js` | Resolución de unidad, carga de vistas, normalización | No | Sí | task_04 |
| `a11y.js` | Anuncio accesible y foco de los mensajes del editor | Sí | No (smoke) | task_14 |
| `batch-model.js` | Máquina de estados del lote, invariantes, payload v1, sellado | No | Sí | task_05 |
| `batch-store.js` | Persistencia `localStorage` de borrador y payload sellado | No¹ | Sí | task_06 |
| `rpc.js` | Llamada a `confirm_tire_change_batch`, clasificación de errores, retry | No | Sí | task_07 |
| `baseline-model.js` | Máquina pura del primer montaje, precarga, validación y sellado | No | Sí | task_08 |
| `baseline-ui.js` | Diálogo guiado, formulario y foco del primer montaje | Sí | No (smoke) | task_08 |
| `diagram-projection.js` | Proyección pura `(remoteState, draft) → estado por posición` | No | Sí | task_08 |
| `storage-client.js` | Foto de descarte: captura/preview/upload/limpieza (Storage) | Parcial | Parcial | task_12 |
| `diagram-view.js` | Render de ruedas/dock desde la proyección | Sí | No (smoke) | task_09 |
| `mode-toggle.js` | Tabs Inspección/Movimientos sobre el diagrama; Inspección intacto | Sí | No (smoke) | task_09 |
| `movimientos-controller.js` | Orquestador: cablea submódulos, estado vivo, Realtime | Sí | No (smoke) | task_09 |
| `movements-ui.js` | Modales retén/descarte/montaje/swap; selección origen→destino | Sí | No (smoke) | task_10 |
| `inventory-ui.js` | Cajón de inventario/retén, buscador, prevención de duplicados | Sí | No (smoke) | task_11 |
| `summary-confirm.js` | Resumen, deshacer/editar, encabezado, confirmación, errores | Sí | No (smoke) | task_13 |
| `movimientos.css` | Tokens/estilos reutilizando la paleta vigente | — | — | task_09 |
| `vitest.config.js` | Configuración del runner de pruebas | — | — | task_02 |

¹ `batch-store.js` usa `localStorage`, que se mockea en los tests (entorno `node`).

## Compatibilidad de despliegue y rollback

- `?mode=cambios` sigue siendo un alias de lectura de `?mode=movimientos` y se
  canonicaliza sin recargar.
- Al abrir un borrador o lote sellado legado, `batch-store.js` lo migra de
  `renova:tire-change:*` a `renova:movimientos:*` y elimina la clave anterior.
  Por ello, un revert a una versión previa durante esa ventana **no recupera**
  borradores no confirmados que ya hayan sido migrados. Antes de revertir,
  confirmar o descartar esos borradores; no hay datos remotos afectados.

## Línea base perezosa

Una posición `is_empty=true` con `baseline_pending=true` no está disponible para montar desde el
retén: una inspección dejó evidencia de que había un neumático físico. El taller debe registrar el
**primer montaje** y confirmar los datos frente a la unidad. El flujo crea casco, ciclo e
instalación con `origin='baseline'`, cita `source_measurement_id` y usa
`confirm_baseline_mount`; la fecha de instalación es declarada, no una observación histórica.
El formulario permite registrar la OTD original del ciclo cuando se conoce; es opcional y jamás
se infiere desde la medición RTD de la inspección.

La línea base es perezosa para no convertir por lote una medición histórica en historia de taller.
La flota se completa a medida que se opera cada posición; una posición sin evidencia sí conserva el
montaje normal. El contrato de esquema y el indicador de avance están en
`supabase/diagnostics/baseline_profile.sql` (Q6).

## Pruebas

- Runner: **vitest 4.1.9** (versión exacta, igual que `app/`). Entorno **`node`**.
- La lógica pura se prueba con vitest; los módulos de UI se validan con el **smoke test real de
  navegador** (task_16), no con vitest.
- `localStorage`, el cliente Supabase (`RenovaSupabase`/`.rpc()`), `fetchView` y `crypto.randomUUID`
  se **inyectan o mockean** en cada test. Sin red ni datos reales en las pruebas.
- La suite cubre el modelo de primer montaje y el adaptador de `confirm_baseline_mount`; el smoke
  autenticado con datos de prueba se ejecuta por separado y nunca contra una unidad de cliente.

### Comandos

```bash
cd WEB/movimientos
npm install      # instala vitest en este scope (no toca app/ ni la raíz)
npm test         # vitest run
npm run test:watch
```

## Convenciones

- ES modules (`import`/`export`), sin bundler.
- No agregar dependencias de runtime del dashboard (vitest es sólo dev).
- Nunca `service_role`, secretos ni datos de sesión en módulos, fixtures o logs.
- UUIDs de fixture en tests; nunca UUIDs de producción.
