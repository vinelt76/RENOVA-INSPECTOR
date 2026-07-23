# WEB/movimientos — Órdenes web de Servicios

Módulos ES del modo visible **Servicios** del dashboard `WEB/Inspecciones por unidad.html`. Se importan desde
el HTML con `type="module"`. Arquitectura estática (sin cambiar el stack). Fuente canónica de
contratos backend: `tasks_cambios_neumaticos/CONTRATOS_UI.md`. Plan y tareas:
`tasks_cambios_neumaticos_ui/`.

Regla de oro: **la web dirige y sigue órdenes; el operario ejecuta y captura los datos técnicos.**
La rotación elige otra posición. Cualquier otro servicio elige desde
`v_tire_inventory_available` el neumático que entrará y agrega salida+entrada como una pareja.

## Módulos activos

| Módulo | Responsabilidad | Toca DOM | Testeable puro | Crea |
|---|---|---|---|---|
| `data.js` | Unidad, inventario, perfil, órdenes y ejecuciones por RLS | No | Sí | — |
| `supervisor-order-model.js` | Borrador, rotaciones y pareja servicio+inventario | No | Sí | — |
| `supervisor-order-projection.js` | Proyección de la orden sobre el gemelo digital | No | Sí | — |
| `orders-rpc.js` | Única escritura activa: `create_tire_movement_order` | No | Sí | — |
| `supervisor-orders-ui.js` | Dropdown, selector de inventario y seguimiento | Sí | Helpers puros | — |
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

- Supervisor web (`tire_supervisor`, `fleet_manager` histórico o `admin`): posición, servicio,
  neumático de inventario que entra, nota y fecha.
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
- La suite cubre además rotación, selección única de inventario, el modelo de orden y el contrato exacto de
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
