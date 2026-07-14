# WEB/tire-change — Modo Cambios de Neumáticos

Módulos ES del **modo Cambios** del dashboard `WEB/Inspecciones por unidad.html`. Se importan desde
el HTML con `type="module"`. Arquitectura estática (sin cambiar el stack). Fuente canónica de
contratos backend: `tasks_cambios_neumaticos/CONTRATOS_UI.md`. Plan y tareas:
`tasks_cambios_neumaticos_ui/`.

Regla de oro: **la lógica pura no toca el DOM; la UI no reimplementa reglas de negocio.**

## Límites de módulos (ver `tasks_cambios_neumaticos_ui/PLAN.md §1`)

| Módulo | Responsabilidad | Toca DOM | Testeable puro | Crea |
|---|---|---|---|---|
| `data.js` | Resolución de unidad, carga de vistas, normalización | No | Sí | task_04 |
| `batch-model.js` | Máquina de estados del lote, invariantes, payload v1, sellado | No | Sí | task_05 |
| `batch-store.js` | Persistencia `localStorage` de borrador y payload sellado | No¹ | Sí | task_06 |
| `rpc.js` | Llamada a `confirm_tire_change_batch`, clasificación de errores, retry | No | Sí | task_07 |
| `diagram-projection.js` | Proyección pura `(remoteState, draft) → estado por posición` | No | Sí | task_08 |
| `storage-client.js` | Foto de descarte: captura/preview/upload/limpieza (Storage) | Parcial | Parcial | task_12 |
| `diagram-view.js` | Render de ruedas/dock desde la proyección | Sí | No (smoke) | task_09 |
| `mode-toggle.js` | Tabs Inspección/Cambios sobre el diagrama; Inspección intacto | Sí | No (smoke) | task_09 |
| `cambios-controller.js` | Orquestador: cablea submódulos, estado vivo, Realtime | Sí | No (smoke) | task_09 |
| `movements-ui.js` | Modales retén/descarte/montaje/swap; selección origen→destino | Sí | No (smoke) | task_10 |
| `inventory-ui.js` | Cajón de inventario/retén, buscador, prevención de duplicados | Sí | No (smoke) | task_11 |
| `summary-confirm.js` | Resumen, deshacer/editar, encabezado, confirmación, errores | Sí | No (smoke) | task_13 |
| `tire-change.css` | Tokens/estilos reutilizando la paleta vigente | — | — | task_09 |

¹ `batch-store.js` usa `localStorage`, que se mockea en los tests (entorno `node`).

## Pruebas

- Runner: **vitest 4.1.9** (versión exacta, igual que `app/`). Entorno **`node`**.
- La lógica pura se prueba con vitest; los módulos de UI se validan con el **smoke test real de
  navegador** (task_16), no con vitest.
- `localStorage`, el cliente Supabase (`RenovaSupabase`/`.rpc()`), `fetchView` y `crypto.randomUUID`
  se **inyectan o mockean** en cada test. Sin red ni datos reales en las pruebas.

### Comandos

```bash
cd WEB/tire-change
npm install      # instala vitest en este scope (no toca app/ ni la raíz)
npm test         # vitest run
npm run test:watch
```

## Convenciones

- ES modules (`import`/`export`), sin bundler.
- No agregar dependencias de runtime del dashboard (vitest es sólo dev).
- Nunca `service_role`, secretos ni datos de sesión en módulos, fixtures o logs.
- UUIDs de fixture en tests; nunca UUIDs de producción.
