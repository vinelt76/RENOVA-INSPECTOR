# task_03 — Sacar la orden QA colgada de la bandeja del operario

**Hallazgo:** H-05 · **Prioridad:** Alta para la demo · **Tipo:** operación de datos
**Bloquea la demo:** sí, visualmente — es la primera pantalla del operario

## Problema

La orden `63b5ccf7-a095-443d-b056-82601ff3e456` está `in_progress` desde el 2026-07-20 sobre la
unidad de prueba `QA-CN16` (MÓVIL BUS). `loadMovementOrders`
(`app movimientos/src/lib/supabase.ts:42`) trae `issued`, `in_progress` y `completed` sin filtrar,
así que el operario la ve al abrir la app, junto a la orden QA completada del 2026-07-21.

Evidencia: `../evidencia/D-supabase-lecturas.md` §D3.

## Trabajo

**Mínimo para el lunes:** cancelar esa orden. No hay RPC de cancelación —
`tire_movement_order_status` incluye `'cancelled'` pero ninguna función lo escribe. Opciones:

- `UPDATE` puntual sobre esa fila (requiere aprobación explícita: es escritura en producción).
- O crear la RPC `cancel_tire_movement_order` que falta, si se prefiere no tocar datos a mano.
  Es una carencia real del modelo: hoy una orden emitida por error no se puede deshacer desde
  ninguna pantalla.

**No hacer de oficio:** borrar los 9 cascos y 14 mediciones `QA-TEST`. El roadmap lo marca como
decisión humana explícita y ADR-D8 ya rechazó filtrarlos por patrón inventado (prefijo de placa,
nombre de unidad): esconder filas hace que el problema deje de verse sin dejar de contaminar. Si
se decide limpiarlos, es borrado real o una columna `is_test`/`environment`, no un filtro en una
vista.

## Criterio de cierre

- La bandeja del operario de MÓVIL BUS no muestra órdenes sobre `QA-CN16`.
- Si se creó la RPC de cancelación: revisada con `sync-migration-reviewer` y con la orden
  cancelada dejando rastro de quién y cuándo.
- Queda escrito en `knowledge/ai/15 - Bitacora diaria.md` qué se tocó en producción.
