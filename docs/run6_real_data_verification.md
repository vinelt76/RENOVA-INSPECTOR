# RUN 6 — Verificación de datos reales en Supabase (Fase 1)

Fecha: 2026-07-07 · Proyecto verificado: **fbxupwwgiebhlciqftpw** (us-east-1)

## Hallazgo importante: hay DOS proyectos Supabase

| Proyecto | Estado | Contenido |
|---|---|---|
| `fbxupwwgiebhlciqftpw` ("a20233413-wq's Project", 2026-06-28) | ACTIVE_HEALTHY | **TODO el backend demo** (14 tablas, 16 vistas, datos CIVA, migraciones run1–run4) |
| `zkifhlayacqexksrfdxc` ("RENOVA-INSPECTOR", creado 2026-07-07) | ACTIVE_HEALTHY | **VACÍO** (0 tablas) |

Toda la integración run6 apunta a `fbxupwwgiebhlciqftpw`. El proyecto nuevo con
nombre "RENOVA-INSPECTOR" no tiene nada; decidir después si se migra ahí o se elimina.

## Tablas (todas existen, todas con filas salvo profiles/vacías por diseño)

| Tabla | Filas | Nota |
|---|---|---|
| companies | 1 | **CIVA** ✓ |
| units | 7 | placas 2134, 2145, 2151, 225, 256, 5021, 5032 — **exactamente las del PDF/Excel real** |
| vehicle_configs | 2 | BUS 2-4 y 2-4-2 (MVP) |
| axles / tire_positions | 5 / 14 | Direccional/Tracción/Libre, lados Izq/Der |
| tire_casings | 28 | con `code_status` (valid / not_visible / pending_review) |
| tire_life_cycles | 29 | condición N/R1..R4, OTD, costo |
| tire_installations | 29 | activas por unidad+posición |
| tire_removals | 1 | |
| inspections | 10 | cabeceras reales |
| inspection_measurements | 28 | RTD A–D, MOVI, estado |
| rtd_thresholds | 1 | cambio 4 / próximo 7 / retiro 4 (por empresa, configurable) |
| company_settings / profiles | 1 / 0 | profiles vacío → inspector "sin dato" |

## Vistas (16, todas devuelven filas)

`v_tire_performance` (28), `v_axle_performance` (8), `v_inspection_dashboard_rows` (28),
`v_fleet_unit_status` (10), `v_fleet_status_summary`, `v_casing_lifetime_performance` (28),
`v_code_quality`, `v_installation_km`, `v_unit_tire_status`, `v_inventory_status`,
`v_casing_history_summary`, `v_casing_inspections`, `v_casing_installations`,
`v_installation_activity`, `v_life_cycle_performance`, `v_removal_cause_ranking`.

RUN6 agrega: **`v_rendimiento_dashboard_rows`** (ver `run6_rendimiento_source_data_visibility.md`).

## Validación contra el PDF real (RENDIMIENTO MOVIL BUS 1-1.pdf)

Unidad 2145, posiciones 3–6 (MARSHAL KRS50 → IZE2W R1):

| Métrica | PDF (Excel real) | v_tire_performance | ¿Coincide? |
|---|---|---|---|
| Km acumulado | 67,430 | 67,430 | ✓ |
| Km × mm | 5,619 | 5,619.17 | ✓ |
| Km proyectado | 67,430 | 67,430 | ✓ |
| $ × Km | $0.0014 | 0.00140886 | ✓ |
| % desgaste | **100%** | **75%** | ✗ — ver abajo |

### Discrepancia de fórmula: % DESGASTE

- **Excel/PDF:** `% desgaste = RTD consumido / (RTD inicial − RTD retiro)` → 12/12 = **100%**
- **Vista SQL y HTML mock:** `% consumo = RTD consumido / OTD` → 12/16 = **75%**

La vista y el HTML son consistentes entre sí, pero difieren del Excel. Es una
decisión de negocio, no un bug: `specs/reglas_negocio.md` es la fuente de verdad
y no define esta fórmula para el dashboard. **NO se cambió unilateralmente** —
queda abierta para confirmar con RENOVA (registrada en `run6_known_limits.md`).

### Diferencia puntual de seed

- Unidad 225 pos 3 (casco 241088): el PDF muestra RTD min 4; el seed cargó 9.0.
  Diferencia menor del seed de run2, no afecta la demo (los cálculos derivados
  son coherentes con el dato cargado).
- PDF con RTD 1–4 en tracción: el seed sigue la regla de negocio (Tracción = 3
  canales A/B/C), por eso `rtd_d_mm` es NULL en tracción. No es dato faltante.

## Seguridad (advisory del linter de Supabase)

**RLS está deshabilitado en las 14 tablas** — cualquiera con la clave anon puede
leer/escribir todo. Aceptado SOLO para demo privada/local (decisión explícita del
run). **Bloqueante antes de cualquier deploy público.** El SQL de remediación
(`ALTER TABLE … ENABLE ROW LEVEL SECURITY` + políticas) queda para la fase RLS.
