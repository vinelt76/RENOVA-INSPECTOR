---
title: "Datos y Supabase"
updated: 2026-07-12
status: vigente
sources: [app/src/db/sqlite.ts, app/src/db/schema.ts, supabase/migrations, docs/run2_tire_lifecycle_architecture.md]
---

# Datos y Supabase

## Modelo local

- `empresa`, `unidad`: contexto de captura.
- `inspeccion_cabecera`: empresa, unidad, fecha, odómetro, sincronización.
- `inspeccion_neumatico`: una fila por posición con captura, derivados y snapshots.
- `cat_*`: marcas, modelos, medidas, reencauches, anomalías, válvulas, configuraciones y condiciones.
- `umbral_rtd`, `umbral_presion`: RTD activo; presión creada pero todavía inerte.
- `sync_queue`: una fila durable por cabecera pendiente.

## Modelo consolidado

```mermaid
erDiagram
  COMPANIES ||--o{ UNITS : posee
  COMPANIES ||--o{ PROFILES : autoriza
  UNITS ||--o{ INSPECTIONS : recibe
  INSPECTIONS ||--o{ INSPECTION_MEASUREMENTS : contiene
  TIRE_CASINGS ||--o{ TIRE_LIFE_CYCLES : atraviesa
  TIRE_LIFE_CYCLES ||--o{ TIRE_INSTALLATIONS : monta
  TIRE_INSTALLATIONS ||--o| TIRE_REMOVALS : cierra
  UNITS ||--o{ TIRE_INSTALLATIONS : aloja
  UNITS ||--o{ UNIT_ROUTE_ASSIGNMENTS : recorre
```

### Cuatro niveles del neumático

- **Casco:** identidad física permanente.
- **Ciclo:** banda N/R1/R2..., OTD y costo de esa vida.
- **Instalación:** tramo del ciclo en una unidad/posición.
- **Inspección:** observación fechada de la posición.

Separarlos permite medir rendimiento de una banda, posición y vida completa sin pisar historia.

## APIs SQL activas relevantes

- Captura: `save_inspection(jsonb)`.
- Lectura móvil: `get_unidad_preload(text,text)`, `get_umbrales_rtd(text)`.
- Taller: `register_full_installation`, `register_removal`, `transfer_tire`.
- Rutas: `assign_unit_route`.
- Seguridad interna: `fn_require_workshop_profile`, `fn_validate_free_position`, `current_company_id`.

## Vistas principales

- Captura/flota: `v_inspection_dashboard_rows`, `v_unit_tire_status`, `v_fleet_unit_status`, `v_fleet_status_summary`.
- Rendimiento: `v_rendimiento_dashboard_rows`, `v_axle_performance`, vistas de ciclo/casco/instalación definidas en la migración base.
- Taller/historial: `v_inventory_status` (usada por `v_casing_history_summary`, ya no tiene pantalla propia), `v_casing_history_summary`, `v_casing_installations`, `v_casing_inspections`.
- Rutas: `v_unit_current_route`, `v_installation_route_attribution`.

`v_removal_cause_ranking` y `v_comparison_cycle_rows` (junto con las RPCs `reinstall_tire`/
`retread_casing`) se eliminaron de Supabase al retirar `inventario.html`/`comparativo.html`
del dashboard web.

## RLS

Las tablas de negocio se filtran por `company_id` derivado del perfil autenticado. Catálogos estructurales son legibles por usuarios autenticados. Excepciones móviles acotadas permiten a `anon` listar empresas y llamar RPCs específicos mientras la app no tenga login. Las vistas expuestas deben usar `security_invoker=true`.

No confundir `GRANT` con RLS: el primero permite acceder al objeto; RLS decide qué filas puede ver. Ver [[08 - Infraestructura seguridad y despliegue]].

