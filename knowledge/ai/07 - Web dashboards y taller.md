---
title: "Web, dashboards y taller"
updated: 2026-07-14
status: vigente
sources: [WEB/movimientos, supabase/migrations/20260716100000_baseline_provenance_and_helper.sql, supabase/migrations/20260716110000_baseline_mount_rpc_and_gate.sql, supabase/diagnostics/baseline_profile.sql, tasks_cambios_neumaticos/CONTRATOS_UI.md]
---

# Web, dashboards y taller

## Superficies

| Archivo | Propósito | Fuente principal |
|---|---|---|
| `INSPECCIONES POR FECHA.html` | Estado agregado de flota por fecha | `v_fleet_unit_status` |
| `Inspecciones por unidad.html` | Detalle de inspecciones/posiciones | `v_inspection_dashboard_rows` |
| `rendimiento.html` | Rendimiento de instalaciones | `v_rendimiento_dashboard_rows` |
| `historial-neumatico.html` | Historia completa de un casco | vistas `v_casing_*` (incluye `v_inventory_status`) |
| `instalacion.html` | Instalación, retiro y transferencia | vistas + RPCs de taller |
| `importar.html` | Importar inspecciones | `save_inspection` |

`inventario.html` y `comparativo.html` (junto con las RPCs `reinstall_tire`/`retread_casing`
y las vistas `v_removal_cause_ranking`/`v_comparison_cycle_rows`) se retiraron del dashboard
web y de Supabase — decisión del negocio, no un bug. `v_inventory_status` se conservó porque
`historial-neumatico.html` depende de ella.

El modo **Movimientos de neumáticos** vive en `WEB/movimientos/` (módulos ES puros +
`movimientos-controller.js`) y se integra en `Inspecciones por unidad.html` como un segundo modo
del gemelo digital. Un selector accesible **Inspección / Movimientos** (persistido en
`?mode=movimientos`, sin recarga) alterna panel, dock y selección sin tocar el flujo histórico de
Inspección. El enlace histórico `?mode=cambios` sigue abriendo Movimientos y se canonicaliza a la
URL nueva. Sus contratos siguen en `tasks_cambios_neumaticos/CONTRATOS_UI.md`.

## Patrón común

- `supabase-config.public.js` contiene configuración pública, nunca secretos.
- Una configuración local ignorada por Git puede reemplazarla para desarrollo.
- `supabase-demo.js` maneja cliente, sesión, `requireAuth`, lectura de vistas y suscripciones.
- Los dashboards muestran un badge que diferencia Supabase, mock/vacío y error.
- Las superficies de inspección escuchan cambios Realtime sin resetear la navegación del usuario.

## Operaciones de taller

Las escrituras complejas no se hacen como varias llamadas desde el navegador. Los RPCs del 12 de julio validan rol, posición libre e invariantes dentro de una transacción. Si una parte falla, no debe quedar medio retiro o media instalación.

- Instalar: crea/resuelve casco y ciclo y abre instalación.
- Retirar: cierra instalación con motivo y fuente de odómetro.
- Transferir: cierra origen y abre destino atómicamente.

Para confirmar varios movimientos de una unidad, la UI usa
`confirm_tire_change_batch`, no encadena los RPCs anteriores. El flujo implementado es:

1. Leer el diagrama completo desde `v_unit_position_state`, incluidas posiciones vacías.
2. Buscar ciclos montables en `v_tire_inventory_available`.
3. Mantener retiros a retén, descartes, montajes e intercambios como un borrador local.
4. Generar una sola vez el `batch_id` y confirmar todo el lote con la RPC.
5. Recargar ambas vistas tras el éxito; ante `[estado_desactualizado]`, descartar el borrador y
   pedir al usuario que lo reconstruya sobre el estado vigente.

La confirmación es transaccional e idempotente: aplica todos los movimientos o ninguno, y un
reintento con el mismo `batch_id` no duplica historia. La empresa se deriva de la sesión y el
backend exige rol de taller.

### Posiciones pendientes de línea base

`v_unit_position_state` distingue una posición realmente vacía de una que conserva evidencia de
inspección: `baseline_pending=true` significa `is_empty=true` **y** que hay una medición fuente.
No se ofrece montaje normal desde inventario en ese caso. El formulario de primer montaje precarga
la identidad y medición, pero una persona las confirma frente a la unidad y confirma un payload
idempotente mediante `confirm_baseline_mount`. La OTD original del ciclo se puede ingresar si se
conoce; queda nula cuando no se conoce y no se deriva de la RTD medida en la inspección.

La instalación resultante guarda `origin='baseline'` y `source_measurement_id`. Eso declara una
identidad confirmada, no una fecha de montaje observada. La línea base es perezosa: no hay backfill
masivo y el indicador Q6 de `supabase/diagnostics/baseline_profile.sql` muestra el progreso por
posición. El modo conserva `?mode=movimientos` como URL canónica; `?mode=cambios` es un alias de
lectura que se canonicaliza sin recargar.

El render de posiciones vacías/estados provisionales y la captura/subida de la foto obligatoria
de descarte a Storage (bucket privado `tire-discard-photos`, ruta `<company>/<batch_id>/<seq>`)
ya están implementados. El smoke real E2E se ejecutó con una sesión de taller sobre una unidad
de prueba dedicada (`QA-CN16`, empresa MÓVIL BUS): lote mixto de los cuatro tipos —retén,
descarte con foto real, intercambio y montaje desde inventario— confirmado con una sola RPC,
persistencia verificada tras recarga, borrador editable restaurado y manejo del estado
concurrente (banner "el estado de la unidad cambió" + bloqueo del retiro sobre posición vacía sin
perder el borrador). Ver `tasks_cambios_neumaticos_ui/REVISION_FINAL.md`.

## Rutas

La ruta es temporal, no un texto fijo en `units`. `unit_route_assignments` conserva vigencia desde/hasta; `v_installation_route_attribution` atribuye rendimiento según solapamiento temporal.

## Regla de evolución

Los HTML nacieron como prototipos con mocks y algunas fórmulas duplicadas. El destino es presentación fina sobre vistas/RPCs auditados. No eliminar fallbacks ni cálculos viejos hasta demostrar paridad y luego hacerlo en un cambio explícito.
