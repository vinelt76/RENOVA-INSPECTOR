---
title: "Web, dashboards y taller"
updated: 2026-07-12
status: vigente
sources: [WEB, supabase/migrations/20260710*, supabase/migrations/20260712*]
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

## Rutas

La ruta es temporal, no un texto fijo en `units`. `unit_route_assignments` conserva vigencia desde/hasta; `v_installation_route_attribution` atribuye rendimiento según solapamiento temporal.

## Regla de evolución

Los HTML nacieron como prototipos con mocks y algunas fórmulas duplicadas. El destino es presentación fina sobre vistas/RPCs auditados. No eliminar fallbacks ni cálculos viejos hasta demostrar paridad y luego hacerlo en un cambio explícito.

