# WEB/movimientos — Órdenes web de Movimientos

Módulos ES del **modo Movimientos** del dashboard `WEB/Inspecciones por unidad.html`. Se importan desde
el HTML con `type="module"`. Arquitectura estática (sin cambiar el stack). Fuente canónica de
contratos backend: `tasks_cambios_neumaticos/CONTRATOS_UI.md`. Plan y tareas:
`tasks_cambios_neumaticos_ui/`.

Regla de oro: **la web dirige y sigue órdenes; el operario ejecuta y captura los datos técnicos en
`app movimientos/`.** La pestaña web no llama `confirm_tire_change_batch`.

## Módulos activos

| Módulo | Responsabilidad | Toca DOM | Testeable puro | Crea |
|---|---|---|---|---|
| `data.js` | Unidad, perfil, órdenes y ejecuciones por RLS | No | Sí | — |
| `supervisor-order-model.js` | Borrador e invariantes de indicaciones | No | Sí | — |
| `supervisor-order-projection.js` | Proyección de la orden sobre el gemelo digital | No | Sí | — |
| `orders-rpc.js` | Única escritura activa: `create_tire_movement_order` | No | Sí | — |
| `supervisor-orders-ui.js` | Editor de indicaciones y bandeja de seguimiento | Sí | No (smoke) | — |
| `diagram-view.js` | Render de ruedas/dock desde la proyección | Sí | No (smoke) | task_09 |
| `mode-toggle.js` | Tabs Inspección/Movimientos; Inspección intacto | Sí | No (smoke) | task_09 |
| `movimientos-controller.js` | Auth de supervisor, borrador, RPC, lectura y Realtime | Sí | No (smoke) | — |
| `movimientos.css` | Estilos RENOVA y estados de órdenes | — | — | — |

Los módulos antiguos de ejecución en taller permanecen temporalmente para conservar su suite y
trazabilidad, pero ya no forman parte del grafo de imports del controlador web.

## Compatibilidad de despliegue y rollback

- `?mode=cambios` sigue siendo un alias de lectura de `?mode=movimientos` y se
  canonicaliza sin recargar.
- Al abrir un borrador o lote sellado legado, `batch-store.js` lo migra de
  `renova:tire-change:*` a `renova:movimientos:*` y elimina la clave anterior.
  Por ello, un revert a una versión previa durante esa ventana **no recupera**
  borradores no confirmados que ya hayan sido migrados. Antes de revertir,
  confirmar o descartar esos borradores; no hay datos remotos afectados.

## Separación de responsabilidades

- Supervisor web (`tire_supervisor`, `fleet_manager` histórico o `admin`): posición, dirección,
  razón, nota y fecha.
- Operario Android (`operator`): toma la orden y captura código, marca, medida, diseño, RTD,
  condición, reencauche, observaciones y un único odómetro de máquina.
- Web: sigue estado, operario asignado y renglones técnicos completados.
- La captura nace pendiente de reconciliación para no inventar instalaciones mientras falte la
  importación masiva de línea base.

## Pruebas

- Runner: **vitest 4.1.9** (versión exacta, igual que `app/`). Entorno **`node`**.
- La lógica pura se prueba con vitest; los módulos de UI se validan con el **smoke test real de
  navegador** (task_16), no con vitest.
- `localStorage`, el cliente Supabase (`RenovaSupabase`/`.rpc()`), `fetchView` y `crypto.randomUUID`
  se **inyectan o mockean** en cada test. Sin red ni datos reales en las pruebas.
- La suite cubre además el modelo de orden, la proyección y el contrato exacto de
  `create_tire_movement_order`; nunca usa datos reales.

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
- El ID de orden usa `crypto.randomUUID()` y cae a UUID v4 con
  `crypto.getRandomValues()` para navegadores/contextos HTTP compatibles antiguos.
