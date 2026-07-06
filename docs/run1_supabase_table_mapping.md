# Run 1 — Mapeo local → Supabase (tabla por tabla)

Cómo se traduce cada estructura existente (SQLite local, mocks, spec) al borrador
`supabase/schema_draft.sql`. Sentido del sync fase 1 (task_14): **push** de inspecciones desde el
teléfono, **pull** aditivo de catálogo hacia el teléfono.

## Tablas con origen REAL en la app (sync push)

| Local (SQLite) | Supabase | Notas de mapeo |
|---|---|---|
| `empresa` (id slug, nombre, flota) | `companies` (+ `fleets`) | El slug local (`movil`, `cruz`, …) va a `companies.legacy_code`; el id servidor es uuid. `flota` (texto nullable) se normaliza a `fleets` cuando exista dato real. |
| `unidad` (PK numero+empresa_id) | `units` | PK compuesta → uuid + `UNIQUE(company_id, plate)`. `tipo_vehiculo`+`configuracion` → FK `config_id` a `vehicle_configs`. `odometro_ultimo`/`ultima_fecha` → caches `last_odometer`/`last_inspected_at`. `status` (activo/pendiente/inactivo) viene del plan, hoy no existe local. |
| `inspeccion_cabecera` | `inspections` | **id UUID del dispositivo se conserva** (sin default server). `numero_unidad`+`empresa_id` → FK `unit_id` (el drainer resuelve placa→uuid). `fecha` → `inspected_on` + `UNIQUE(unit_id, inspected_on)` (una inspección/unidad/día). `foto_unidad` dataURL → Storage + `unit_photo_url`. `sincronizado` no viaja (es estado local de la cola). LWW por `updated_at`. |
| `inspeccion_neumatico` | `inspection_measurements` | id de dispositivo conservado. `posicion`→`position_number`; `r1..r4`→`rtd_a_mm..rtd_d_mm`; `presion`→`pressure_psi`; `tapa_valvula`→`valve_cap`; `anomalia`→`anomaly`; calculados `rtd_movi/idi/estado_rtd/desecho` → `rtd_movi_mm/idi_mm/rtd_state/is_discard`. `UNIQUE(inspection_id, position_number)` espeja `idx_neumatico_cab_pos`. Identidad del neumático queda en columnas de texto (`tire_code`, `brand_name`, …) + `tire_id` nullable para el futuro. |
| `sync_queue` | — (no viaja) | Infraestructura local del push; el servidor no la necesita. |
| `app_meta`, `schema_version` | — | Solo locales. |

## Catálogo PATRON (sync pull, compartido sin company_id)

| Local | Supabase | Notas |
|---|---|---|
| `cat_marca` | `catalog_brands` | Slug local → `slug` (clave de reconciliación del pull INSERT-OR-IGNORE). Las altas de campo suben por push. |
| `cat_modelo` | `catalog_models` | FK a marca. `UNIQUE(brand_id, name)`. |
| `cat_medida` | `catalog_sizes` | + `default_otd` (dato nuevo pendiente de RENOVA). |
| `cat_reencauche` | `catalog_retread_designs` | — |
| `cat_anomalia` | `catalog_anomalies` | `posible_causa`→`probable_cause`, `desecho`→`is_discard`. |
| `cat_valvula` | `catalog_valve_caps` | — |
| `cat_condicion` | `catalog_conditions` | PK = código (N/R1..R4). |
| `cat_configuracion` (plana: tipo, notación, posición, tipo_eje, lado, piso, mvp) | `vehicle_configs` + `axles` + `tire_positions` | Se normaliza en 3 niveles: config → ejes → posiciones. `tipo_eje` sube al eje (es propiedad del eje, y determina 3 vs 4 canales); `lado`/`piso` quedan en la posición; `mvp` en la config. El pull hacia el teléfono puede seguir aplanando a `cat_configuracion` — la app no cambia. |

## Tablas NUEVAS (sin origen local — cubren los mocks y la spec)

| Supabase | Origen del requisito | Qué resuelve |
|---|---|---|
| `profiles` | task_14 (`app_user`), implementation_plan (`usuario`) | Usuario auth ↔ empresa ↔ rol. Base de RLS. |
| `tires` | mocks `TIRES/POSICIONES` (otd, costo, kmPrevioAcumulado, reencauche, código), panel taller (reenc/MÁX, descarte) | Identidad física del neumático: casco con condición, OTD, costo, km acumulado, estado de inventario. |
| `tire_installations` | mocks (`rtdInstalacion`, `kmInstalacion`) | Evento de montaje — datos fuente de TODO el rendimiento. Índice parcial: una instalación activa por unidad+posición. |
| `tire_removals` | modal "Descartar" (causa+foto obligatorias), reglas §11 | Evento de retiro; actualiza `tires.accumulated_km` y estado; registra descarte con causa/foto. |
| `tire_inventory_movements` | acciones "Enviar a Retén"/"Descartar" del panel taller | Bitácora auditable de movimientos de inventario; el estado actual vive en `tires.status`. |
| `rtd_thresholds` | reglas §2 (`umbral_rtd`), deuda de `inspeccionRepo` (4/7 hardcodeados) | Umbrales RTD por empresa+medida + `rtd_removal_mm` (RTD Retiro del rendimiento). |
| `pressure_thresholds` | reglas §3 (`umbral_presion`) | Referencias de presión por empresa/medida/eje. `hot_psi` NULL hasta decisión CALIENTE. |
| `axle_balance_thresholds` | `AXLE_BALANCE_THRESHOLD_PERCENT=15` en rendimiento.html ("editar SOLO aquí") | El 15% pasa a ser configurable por empresa. |
| `isa_weights` | reglas §6 | Pesos ISA por empresa. |
| `import_batches` / `import_errors` | requisito Run 1 (empresas futuras importables) + Excels golden de `docs/` | Alta masiva de empresas/unidades/histórico con trazabilidad de errores fila a fila. |
| Vistas `v_tire_performance`, `v_axle_performance`, `v_fleet_status` | fórmulas de los 3 dashboards HTML | Métricas derivadas server-side; los HTML pasarán a solo renderizar. |

## Reglas transversales aplicadas

1. **IDs**: `inspections` e `inspection_measurements` aceptan el UUID v4 generado en el
   dispositivo (regla CLAUDE.md — jamás autoincrement). El resto usa `gen_random_uuid()`.
2. **Tenancy**: `company_id` en toda tabla de negocio; catálogo PATRON sin tenant
   (ADR 0001 + task_14). RLS anotada como comentario, se implementa al crear migraciones.
3. **Timestamps**: `created_at`/`updated_at timestamptz` en todo; además
   `device_created_at`/`device_updated_at` preservan el reloj del teléfono para el LWW.
4. **Sin hardcodes**: ni umbrales (4/7/8, ±%, 15%) ni listas de catálogo ni las 5 empresas.
   Defaults del negocio viven como DATOS (filas de thresholds sembradas por empresa), no como
   constantes del esquema.
5. **Estados**: enums Postgres para roles, estados de unidad/neumático/RTD/presión, causas de
   retiro e importaciones — legibles y validados por la DB.
