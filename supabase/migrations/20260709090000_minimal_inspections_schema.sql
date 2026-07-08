-- ============================================================================
-- RENOVA INSPECTOR — Esquema MÍNIMO para demo: vehicles + inspections + inspection_items
-- Migración: 20260709090000_minimal_inspections_schema.sql
-- ============================================================================
-- Alcance a propósito, SOLO esto (ver docs/supabase_minimal_integration.md):
--   guardar inspecciones reales capturadas por la app, con cabecera + detalle por posición.
-- Fuera de alcance en esta fase: almacén virtual, retén, retiradas, movimientos de neumático,
-- tabla `tires` normalizada, catálogos normalizados, umbrales RTD por empresa, multiempresa,
-- auth avanzada, RLS complejo.
--
-- ⚠️ COLISIÓN CONOCIDA: si el proyecto Supabase de destino ya tiene aplicada
-- supabase/migrations/20260706120000_demo_vertical_slice.sql (Run 2 — modelo de ciclo de vida
-- casco/ciclo/instalación), esa migración YA crea una tabla `inspections` con esquema
-- INCOMPATIBLE (FK a `units`, id sin default, columna `inspected_on` en vez de
-- `inspection_date`). Este archivo es un modelo ALTERNATIVO y más simple, pensado para
-- NO depender de ese modelo. NO ejecutar ambas migraciones sobre la misma base sin resolver
-- el choque de nombres antes (renombrar una de las dos, o elegir un solo modelo). Verificar:
--   select table_name from information_schema.tables where table_name = 'inspections';
-- antes de correr esto contra el proyecto real. Si ya existe, avisar antes de continuar.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. vehicles — unidades/placas inspeccionadas
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists vehicles (
  id             uuid primary key default gen_random_uuid(),
  plate_number   text unique not null,
  operation      text,        -- OPERACIÓN del Excel — sin fuente en la app hoy; queda NULL salvo carga manual
  vehicle_type   text,        -- TIPO VEHÍCULO — viene de la unidad local (unidad.tipo_vehiculo)
  configuration  text,        -- CONFIGURACIÓN — viene de la unidad local (unidad.configuracion)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table vehicles is
  'Unidades/placas inspeccionadas. Mínimo para demo: vehicle_type/configuration como texto plano, sin catálogo normalizado todavía.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. inspections — cabecera de cada inspección
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists inspections (
  id               uuid primary key default gen_random_uuid(),
  vehicle_id       uuid references vehicles(id),
  plate_number     text not null,          -- snapshot para consultas rápidas sin JOIN
  inspection_date  date not null,
  inspection_month text,                   -- derivado de inspection_date (formato YYYY-MM), lo fija save_inspection()
  odometer_km      numeric,
  source           text not null default 'apk',   -- 'apk' | 'html_demo' | 'manual_import'
  sync_status      text not null default 'synced',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (vehicle_id, inspection_date)
);
comment on table inspections is
  'Cabecera de inspección. UNIQUE(vehicle_id, inspection_date) refleja la regla ya vigente en la app local (una inspección por unidad por día) y permite reenvíos idempotentes del mismo día.';

create index if not exists inspections_plate_date_idx on inspections (plate_number, inspection_date desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. inspection_items — detalle por posición/neumático
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists inspection_items (
  id               uuid primary key default gen_random_uuid(),
  inspection_id    uuid not null references inspections(id) on delete cascade,
  vehicle_id       uuid references vehicles(id),
  plate_number     text not null,
  position         text not null,
  axle_type        text,      -- catálogo/config — snapshot por ahora (ver auditoría §10.4)
  tire_code        text,
  tire_size        text,
  tire_brand       text,
  original_design  text,      -- DISEÑO ORIGINAL ("modelo" en el código de la app)
  current_design   text,      -- DISEÑO ACTUAL (reencauche)
  tire_condition   text,
  rtd_a            numeric,
  rtd_b            numeric,
  rtd_c            numeric,
  rtd_d            numeric,
  rtd_movi         numeric,   -- calculado en el dispositivo (calculations.ts) — nunca editable
  pressure         numeric,
  valve_cap        text,
  not_measured     boolean not null default false,
  tire_anomaly     text,
  rtd_for_change   numeric,   -- umbral vigente al guardar — hoy constante de código (4), no de tabla (auditoría §10.4)
  rtd_next_change  numeric,   -- ídem (7)
  rtd_normal       numeric,   -- ídem (8, informativo — reglas_negocio.md §2)
  scrap            boolean,   -- DESECHO — calculado (anomalía con desecho=TRUE, o manual)
  rtd_status       text,      -- ESTADO RTD — calculado (if/elif secuencial, reglas_negocio.md §2)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (inspection_id, position)
);
comment on table inspection_items is
  'Detalle por posición/neumático. UNIQUE(inspection_id, position) refleja el índice antiduplicados ya vigente en SQLite local (idx_neumatico_cab_pos). Medida/marca/diseño/condición viajan como snapshot de texto — sin tabla tires todavía (fuera de alcance de esta fase).';

create index if not exists inspection_items_inspection_idx on inspection_items (inspection_id);
create index if not exists inspection_items_plate_idx on inspection_items (plate_number);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. save_inspection(payload) — guardado transaccional (vehicle + inspection + items)
-- ─────────────────────────────────────────────────────────────────────────────
-- Una función de Postgres corre en una sola transacción implícita: todo o nada.
-- Idempotente: reintentar con el mismo payload actualiza (upsert), nunca duplica.
--
-- Payload esperado (ver docs/supabase_minimal_integration.md para el ejemplo completo):
--   { plate_number, inspection_date, odometer_km, vehicle_type?, configuration?, operation?,
--     items: [ { position, tire_code, tire_size, tire_brand, original_design, current_design,
--                tire_condition, rtd_a, rtd_b, rtd_c, rtd_d, rtd_movi, pressure, valve_cap,
--                not_measured, tire_anomaly, axle_type?, rtd_for_change?, rtd_next_change?,
--                rtd_normal?, scrap, rtd_status } ] }
create or replace function save_inspection(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id     uuid;
  v_inspection_id  uuid;
  v_item           jsonb;
begin
  if payload->>'plate_number' is null or trim(payload->>'plate_number') = '' then
    raise exception 'plate_number es obligatorio';
  end if;
  if payload->>'inspection_date' is null then
    raise exception 'inspection_date es obligatorio';
  end if;

  insert into vehicles (plate_number, operation, vehicle_type, configuration)
  values (
    payload->>'plate_number',
    payload->>'operation',
    payload->>'vehicle_type',
    payload->>'configuration'
  )
  on conflict (plate_number) do update set
    operation      = coalesce(excluded.operation, vehicles.operation),
    vehicle_type   = coalesce(excluded.vehicle_type, vehicles.vehicle_type),
    configuration  = coalesce(excluded.configuration, vehicles.configuration),
    updated_at     = now()
  returning id into v_vehicle_id;

  insert into inspections (vehicle_id, plate_number, inspection_date, inspection_month, odometer_km)
  values (
    v_vehicle_id,
    payload->>'plate_number',
    (payload->>'inspection_date')::date,
    to_char((payload->>'inspection_date')::date, 'YYYY-MM'),
    nullif(payload->>'odometer_km', '')::numeric
  )
  on conflict (vehicle_id, inspection_date) do update set
    odometer_km = excluded.odometer_km,
    updated_at  = now()
  returning id into v_inspection_id;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
  loop
    insert into inspection_items (
      inspection_id, vehicle_id, plate_number, position, axle_type,
      tire_code, tire_size, tire_brand, original_design, current_design, tire_condition,
      rtd_a, rtd_b, rtd_c, rtd_d, rtd_movi, pressure, valve_cap, not_measured, tire_anomaly,
      rtd_for_change, rtd_next_change, rtd_normal, scrap, rtd_status
    ) values (
      v_inspection_id, v_vehicle_id, payload->>'plate_number',
      v_item->>'position', v_item->>'axle_type',
      nullif(v_item->>'tire_code', ''), nullif(v_item->>'tire_size', ''), nullif(v_item->>'tire_brand', ''),
      nullif(v_item->>'original_design', ''), nullif(v_item->>'current_design', ''), nullif(v_item->>'tire_condition', ''),
      nullif(v_item->>'rtd_a', '')::numeric, nullif(v_item->>'rtd_b', '')::numeric,
      nullif(v_item->>'rtd_c', '')::numeric, nullif(v_item->>'rtd_d', '')::numeric,
      nullif(v_item->>'rtd_movi', '')::numeric, nullif(v_item->>'pressure', '')::numeric,
      nullif(v_item->>'valve_cap', ''), coalesce((v_item->>'not_measured')::boolean, false),
      nullif(v_item->>'tire_anomaly', ''),
      nullif(v_item->>'rtd_for_change', '')::numeric, nullif(v_item->>'rtd_next_change', '')::numeric,
      nullif(v_item->>'rtd_normal', '')::numeric,
      (v_item->>'scrap')::boolean, nullif(v_item->>'rtd_status', '')
    )
    on conflict (inspection_id, position) do update set
      axle_type        = excluded.axle_type,
      tire_code        = excluded.tire_code,
      tire_size        = excluded.tire_size,
      tire_brand       = excluded.tire_brand,
      original_design  = excluded.original_design,
      current_design   = excluded.current_design,
      tire_condition   = excluded.tire_condition,
      rtd_a            = excluded.rtd_a,
      rtd_b            = excluded.rtd_b,
      rtd_c            = excluded.rtd_c,
      rtd_d            = excluded.rtd_d,
      rtd_movi         = excluded.rtd_movi,
      pressure         = excluded.pressure,
      valve_cap        = excluded.valve_cap,
      not_measured     = excluded.not_measured,
      tire_anomaly     = excluded.tire_anomaly,
      rtd_for_change   = excluded.rtd_for_change,
      rtd_next_change  = excluded.rtd_next_change,
      rtd_normal       = excluded.rtd_normal,
      scrap            = excluded.scrap,
      rtd_status       = excluded.rtd_status,
      updated_at       = now();
  end loop;

  return v_inspection_id;
end;
$$;
comment on function save_inspection is
  'Guarda una inspección completa (vehicle upsert + inspection upsert + items upsert) en una sola transacción de Postgres. Idempotente: reintentar con el mismo payload no duplica filas.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — a propósito DESACTIVADA para esta fase
-- ─────────────────────────────────────────────────────────────────────────────
-- Sin auth todavía (fuera de alcance de esta fase, igual que Run 2). Para que la app pueda
-- leer/escribir con la anon key sin bloquear el demo, se deja RLS desactivada — es deuda de
-- demo documentada, NO usar así con clientes reales. Habilitar + política por empresa queda
-- para task_14/Run 3 (ver docs/supabase_minimal_integration.md, sección "Fuera de alcance").
-- alter table vehicles enable row level security;
-- alter table inspections enable row level security;
-- alter table inspection_items enable row level security;
