# Mapa de flujos verificables

Referencia rápida de qué archivo/tabla/RPC pertenece a cada capa de `SKILL.md`. No duplica
`knowledge/ai/03 - Arquitectura del sistema.md` ni `04 - Flujo de inspeccion y sincronizacion.md`
— léelos primero para el panorama completo; esto es solo el índice de "qué tocar para verificar
qué".

## Captura y persistencia local

- `app/src/db/sqlite.ts` — DDL y `runMigrations()`.
- `app/src/db/schema.ts` — tipos de las tablas locales.
- `app/src/db/repos/inspeccionRepo.ts` — cálculo de RTD/IDI/estado/desecho/ISA por fila,
  encolado de sync (líneas 65, 88, 195).
- `app/src/db/repos/umbralRepo.ts` — umbrales por empresa+medida, con fallback documentado.
- `app/src/db/repos/syncQueueRepo.ts` — cola durable, guard anti-carrera.

## Motor de cálculo

- `app/src/core/calculations.ts` / `reference/calculations.py` — 7 funciones, deben tener
  paridad exacta (capa 1 de `SKILL.md`).
- `fixtures/golden.json` — único fixture compartido.

## Sync app → Supabase

- `app/src/sync/pushInspeccion.ts` — payload de `save_inspection`. Punto donde `idi` e
  `isa_peso_snap` se pierden (ver `verificacion/T05.md`).
- `app/src/sync/drainQueue.ts` — backoff, drenado.
- `app/src/sync/pullUmbrales.ts` — pull de `get_umbrales_rtd`, mapeo `rtd_removal_mm → rtd_normal`.
- `app/src/sync/readInspecciones.ts` — `get_unidad_preload`.
- RPCs remotas invocadas: `save_inspection(payload jsonb)`, `get_umbrales_rtd(p_company_name)`,
  `get_unidad_preload(p_company_name, p_plate)`.

## Reglas de negocio duplicadas en SQL

- `fn_rtd_state(p_company_id, p_size_name, p_rtd_mm)` — recalcula estado RTD server-side con
  umbral VIGENTE de la empresa, no con el snapshot que envía el dispositivo. No está definida en
  ningún archivo de `supabase/migrations/` (existe en producción desde antes del tracking local).
- `fn_channel_rtd_state(p_company_id, p_size_name, p_channel_mm)` — igual, por canal individual.
- `fn_pressure_state_fixed(p_psi)` — regla FIJA 100/130 PSI, ignora medida/eje/empresa. Usada por
  `WEB/Inspecciones por unidad.html` (comentario explícito reconociéndola como provisional).
- `fn_effective_rtd_thresholds(p_company_id, p_size_name)` — resuelve el umbral vigente que usa
  `fn_rtd_state`.

## Vistas consumidas por WEB/

`v_inspection_dashboard_rows`, `v_rendimiento_dashboard_rows`, `v_tire_inventory_available`,
`v_inventory_status`, `v_tire_services`, `v_search_index`, `v_operator_movement_orders`,
`v_casing_history_summary`, `v_casing_installations`, `v_casing_inspections`,
`v_unit_position_state`. Todas deben tener `security_invoker=on` (verificado en 8/8 revisadas) y
NO deben tener grants de escritura a `anon` (4 de 8 revisadas sí los tienen — ver
`verificacion/T09.md`).

## Tablas núcleo (para conteos de coherencia)

`companies`, `units`, `inspections`, `inspection_measurements`, `tire_casings`,
`tire_life_cycles`, `tire_installations`, `tire_removals`, `rtd_thresholds`,
`tire_movement_orders`, `tire_movement_executions`.
