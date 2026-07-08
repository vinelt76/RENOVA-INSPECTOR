# RUN 6 — Mapeo app → Supabase (Fase 6)

Payload construido por `app/src/sync/pushInspeccion.ts` → RPC `save_inspection(payload)`.

## Nivel inspección (→ `inspections`)

| App (local SQLite) | Payload | Supabase | Nota |
|---|---|---|---|
| `cabecera.id` (UUID dispositivo) | `local_id` | `inspections.id` | idempotencia: mismo id, mismo registro |
| `empresa.nombre` | `company_name` | `inspections.company_id` | resuelto por nombre; fallback: única empresa activa |
| `cabecera.numero_unidad` | `plate_number` | `units` → `inspections.unit_id` | upsert (company, plate); unidad nueva = `pending_validation` |
| `cabecera.fecha` (YYYY-MM-DD) | `inspection_date` | `inspections.inspected_on` | UNIQUE (unit, fecha): 1 inspección/unidad/día |
| `cabecera.km_odometro` | `odometer_km` | `inspections.odometer_km` + `units.last_odometer` | requerido |
| `unidad.tipo_vehiculo` / `configuracion` | `vehicle_type` / `configuration` | `units` (solo al crear unidad) | config por `notation`; default demo 2-4-2 |
| inspector | — | `inspector_id` NULL | sin auth todavía |
| `cabecera.foto_unidad` | — | `unit_photo_url` NULL | subida de fotos fuera de alcance run6 |

## Nivel medición (→ `inspection_measurements`, una por posición)

| App | Payload | Supabase | Nota |
|---|---|---|---|
| `posicion` | `position` | `position_number` | acepta "3" o "P3" (se extraen dígitos) |
| `codigo` | `tire_code` | `tire_code` | **N/V → NULL** (ver estrategia N/V) |
| `marca` | `tire_brand` | `brand_name` | snapshot observado — la fuente de verdad del casco sigue en `tire_casings` |
| `modelo` | `original_design` | `model_name` | ídem |
| `medida` | `tire_size` | `size_name` | también se usa para resolver umbrales |
| `condicion` | `tire_condition` | `condition` (enum N/R1..R4) | "NUEVO" → 'N'; no mapeable → NULL |
| `reencauche` | `current_design` | `retread_design` | |
| `r1..r4` | `rtd_a..rtd_d` | `rtd_a_mm..rtd_d_mm` | |
| `rtd_movi` | `rtd_movi` | `rtd_movi_mm` | si falta, el server calcula MIN(canales) |
| `estado_rtd` | `rtd_status` (informativo) | `rtd_state` | **recalculado server-side** con `fn_rtd_state` + `rtd_thresholds` (nunca se confía en el snapshot del cliente) |
| `presion` | `pressure` | `pressure_psi`; NULL → `pressure_state='Sin Medir'` | referencia de presión por empresa: pendiente (no se inventa) |
| `tapa_valvula` | `valve_cap` | `valve_cap` | |
| `anomalia` | `tire_anomaly` | `anomaly` | |
| `desecho` | `scrap` | `is_discard` | |
| — (resuelto server-side) | — | `life_cycle_id` | instalación ACTIVA por unidad+posición |
| foto anomalía | — | `anomaly_photo_url` NULL | fuera de alcance run6 |

## Umbrales que viajan en el payload (`rtd_for_change` etc.)

Se siguen enviando (compatibilidad), pero el server **los ignora** y usa
`rtd_thresholds` por empresa — consistente con "NUNCA hardcodear 4/7/8".
