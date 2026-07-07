-- ============================================================================
-- RENOVA INSPECTOR — Run 2: demo vertical slice + modelo de ciclo de vida
-- Migración: 20260706120000_demo_vertical_slice.sql
-- ============================================================================
-- Subconjunto MÍNIMO y REAL para la demo del jueves:
--   teléfono/app → inspections/inspection_measurements → vistas SQL → dashboard
--
-- Incorpora la decisión de arquitectura de Run 2 (ver
-- docs/run2_tire_lifecycle_architecture.md y docs/ARCHITECTURE_DECISIONS.md):
--
--   tire_casings      = CASCO físico (identidad permanente, nunca se pierde)
--   tire_life_cycles  = CICLO de vida (Nuevo, R1, R2… — cada uno arranca en km 0)
--   tire_installations= una instalación de UN ciclo en UNA unidad+posición
--   inspections/…     = eventos de inspección (fuente primaria de datos)
--
-- Un casco tiene N ciclos; un ciclo tiene N instalaciones; una instalación
-- tiene N inspecciones. Los km NUNCA se almacenan como derivado manual:
-- se calculan en las vistas (supabase/views_demo.sql) a partir de eventos.
--
-- Difiere a propósito del borrador Run 1 (schema_draft.sql):
--   * `tires` se reemplaza por tire_casings + tire_life_cycles (OTD y costo
--     son atributos DEL CICLO, no del casco).
--   * Sin tablas de catálogo todavía: marca/modelo/medida viajan como texto
--     (igual que la app hoy). Catálogo normalizado = Run 3.
--   * RLS NO habilitada (demo con service key/SQL editor). Anotada al final.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

create type user_role as enum ('inspector', 'supervisor', 'fleet_manager', 'workshop_manager', 'admin');

create type unit_status as enum ('active', 'pending_validation', 'inactive');

create type casing_status as enum ('active', 'discarded');

-- Estado del ciclo de vida: activo → cerrado por reencauche (nace el ciclo
-- siguiente) o cerrado por descarte (muere el casco).
create type life_cycle_status as enum ('active', 'retreaded', 'discarded');

create type tire_condition as enum ('N', 'R1', 'R2', 'R3', 'R4');

create type rtd_state as enum ('Normal', 'Próximo a Reencauche', 'Para Reencauche');

create type pressure_state as enum ('Sin Medir', 'Normal', 'Alta Presión', 'Baja Presión');

create type temperature_mode as enum ('COLD', 'HOT');

create type removal_reason as enum ('retread', 'rotation', 'retention', 'discard', 'other');

create type discard_cause as enum (
  'Servicio', 'Neumático', 'Conducción-Ruta',
  'Mantenimiento Alineación', 'Proveedor', 'Otro'
);

-- Origen del odómetro de retiro (regla de negocio Run 2):
--   manual          → lo capturó una persona al desmontar
--   last_inspection → fallback: odómetro de la última inspección de la instalación
--   unknown         → no hay dato (el km de esa instalación queda NULL, jamás 0 inventado)
create type odometer_source as enum ('manual', 'last_inspection', 'unknown');

-- ─────────────────────────────────────────────────────────────────────────────
-- TENANCY
-- ─────────────────────────────────────────────────────────────────────────────

create table companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  legacy_code  text unique,       -- slug del SQLite local ('movil', 'cruz', …) para reconciliar el sync
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table companies is 'Empresas cliente (tenant raíz). Diseñada para N empresas: nunca hardcodear las 5 actuales.';

create table profiles (
  id          uuid primary key,   -- = auth.users.id (FK a auth.users se agrega al activar Auth; omitida aquí para poder validar la migración fuera de Supabase)
  company_id  uuid not null references companies(id),
  full_name   text not null,
  role        user_role not null default 'inspector',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table profiles is 'Usuario ↔ empresa ↔ rol. Base de la RLS futura. En la demo puede quedar vacía (inspector_id NULL).';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIGURACIÓN DE VEHÍCULO (solo lo necesario para BUS 2-4 / 2-4-2)
-- ─────────────────────────────────────────────────────────────────────────────

create table vehicle_configs (
  id           uuid primary key default gen_random_uuid(),
  vehicle_type text not null,     -- 'BUS', …
  notation     text not null,     -- '2-4', '2-4-2', …
  is_mvp       boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (vehicle_type, notation)
);
comment on table vehicle_configs is 'Configuraciones del PATRON. MVP: BUS 2-4 y 2-4-2.';

create table axles (
  id          uuid primary key default gen_random_uuid(),
  config_id   uuid not null references vehicle_configs(id),
  axle_number smallint not null,
  axle_type   text not null,      -- Direccional | Tracción | Libre | Dual (Dir/Tracción=3 canales RTD, Libre/Dual=4)
  unique (config_id, axle_number)
);
comment on table axles is 'Ejes por configuración. axle_type determina 3 vs 4 canales RTD y agrupa el análisis de balance.';

create table tire_positions (
  id              uuid primary key default gen_random_uuid(),
  config_id       uuid not null references vehicle_configs(id),
  axle_id         uuid not null references axles(id),
  position_number smallint not null,  -- P1..Pn (orden PATRON)
  side            text,               -- 'Izq' | 'Der'
  is_ground       boolean not null default true,
  unique (config_id, position_number)
);
comment on table tire_positions is 'Posiciones por configuración. Las mediciones e instalaciones referencian position_number (entero, tal como viaja desde el teléfono).';

-- ─────────────────────────────────────────────────────────────────────────────
-- UNIDADES
-- ─────────────────────────────────────────────────────────────────────────────

create table units (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id),
  plate             text not null,   -- "numero" local (placa/número interno, ej AAV-803)
  vehicle_type      text not null default 'BUS',
  config_id         uuid not null references vehicle_configs(id),
  status            unit_status not null default 'active',
  last_odometer     integer,
  last_inspected_at date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_id, plate)
);
comment on table units is 'Vehículos. El sync resuelve (company, plate) → unit_id con upsert.';

-- ─────────────────────────────────────────────────────────────────────────────
-- UMBRALES CONFIGURABLES (mínimo demo: RTD por empresa; medida opcional)
-- ─────────────────────────────────────────────────────────────────────────────

create table rtd_thresholds (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id),
  size_name      text,                 -- NULL = default de la empresa para toda medida (texto en la demo; FK a catálogo en Run 3)
  rtd_change_mm  numeric(4,1) not null,   -- rtd_cambio
  rtd_next_mm    numeric(4,1) not null,   -- rtd_proximo
  rtd_removal_mm numeric(4,1),            -- RTD Retiro recomendado (insumo de Km Proyectado)
  updated_at     timestamptz not null default now(),
  unique (company_id, size_name)
);
comment on table rtd_thresholds is 'Umbrales RTD por empresa (+medida). NUNCA hardcodear 4/7/8: son datos, no constantes.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CICLO DE VIDA DEL NEUMÁTICO
-- ─────────────────────────────────────────────────────────────────────────────

create table tire_casings (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id),
  code              text,             -- código de fuego/grabado ('No visible'/'Sin código' → NULL + nota)
  brand_name        text,
  model_name        text,
  size_name         text,             -- ej '295/80R22.5' (texto en la demo; FK catálogo en Run 3)
  status            casing_status not null default 'active',
  discarded_at      timestamptz,
  discard_cause     discard_cause,
  discard_photo_url text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index tire_casings_company_code_uidx
  on tire_casings (company_id, code) where code is not null;
comment on table tire_casings is
  'CASCO físico: identidad permanente del neumático. Su historia jamás se pierde: aunque se reencauche N veces, el casco es la misma fila. Se descarta UNA vez (status=discarded) y ahí termina toda su historia.';

create table tire_life_cycles (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id),
  casing_id          uuid not null references tire_casings(id),
  cycle_number       smallint not null,   -- 0 = Nuevo, 1 = R1, 2 = R2, …
  condition          tire_condition not null,  -- 'N','R1',… (redundante legible con cycle_number)
  retread_design     text,                -- diseño del reencauche (NULL si condition='N'); FK catálogo en Run 3
  otd_mm             numeric(5,2),        -- profundidad ORIGINAL de banda de ESTE ciclo (base de % consumo)
  cost               numeric(12,2),       -- costo de ESTE ciclo: neumático nuevo (ciclo 0) o reencauche (ciclo 1+)
  currency           text default 'PEN',
  status             life_cycle_status not null default 'active',
  started_at         date not null,
  ended_at           date,                -- se cierra al reencauchar (nace el ciclo n+1) o al descartar
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (casing_id, cycle_number)
);
create unique index tire_life_cycles_active_uidx
  on tire_life_cycles (casing_id) where status = 'active';
comment on table tire_life_cycles is
  'CICLO de vida: banda de rodamiento N/R1/R2… de un casco. Cada ciclo arranca con km 0 (el km del ciclo es la SUMA de los km de sus instalaciones — derivado en vistas, nunca almacenado a mano). OTD y costo pertenecen al ciclo, no al casco. Índice parcial: un solo ciclo activo por casco.';

create table tire_installations (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id),
  life_cycle_id       uuid not null references tire_life_cycles(id),
  unit_id             uuid not null references units(id),
  position_number     smallint not null,
  installed_at        date not null,
  odometer_at_install integer,           -- punto de partida del rendimiento a nivel instalación
  rtd_at_install_mm   numeric(5,2),      -- RTD al montar (≈ OTD en la 1ª instalación del ciclo)
  installed_by        uuid references profiles(id),
  removed             boolean not null default false,  -- true cuando existe su tire_removal
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index tire_installations_active_pos_uidx
  on tire_installations (unit_id, position_number) where not removed;
create unique index tire_installations_active_cycle_uidx
  on tire_installations (life_cycle_id) where not removed;
comment on table tire_installations is
  'Instalación = UN ciclo de vida montado en UNA unidad+posición durante un intervalo. odometer_at_install es el punto 0 del rendimiento de la instalación. Índices parciales: una instalación activa por posición y una por ciclo (un neumático no puede estar en dos lugares).';

create table tire_removals (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id),
  installation_id     uuid not null unique references tire_installations(id),
  removed_at          date not null,
  odometer_at_removal integer,           -- capturado a mano cuando existe; si no, fallback en vistas
  odometer_source     odometer_source not null default 'unknown',
  rtd_at_removal_mm   numeric(5,2),
  reason              removal_reason not null,
  discard_cause       discard_cause,     -- la app lo exige cuando reason='discard'
  photo_url           text,              -- ídem
  removed_by          uuid references profiles(id),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table tire_removals is
  'Retiro: cierra la instalación (marca removed=true). El km de retiro puede faltar: odometer_source registra si fue manual, fallback de última inspección, o unknown. Con unknown el km de esa instalación queda NULL — nunca se inventa 0.';

-- ─────────────────────────────────────────────────────────────────────────────
-- INSPECCIONES (espejo del teléfono — IDs UUID v4 generados en el dispositivo)
-- ─────────────────────────────────────────────────────────────────────────────

create table inspections (
  id                uuid primary key,    -- ⚠ SIN default: el id lo genera el DISPOSITIVO (inspeccion_cabecera.id)
  company_id        uuid not null references companies(id),
  unit_id           uuid not null references units(id),
  inspected_on      date not null,
  odometer_km       integer not null,
  unit_photo_url    text,
  inspector_id      uuid references profiles(id),
  device_created_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),   -- LWW del sync (task_14)
  unique (unit_id, inspected_on)
);
comment on table inspections is 'Cabecera de inspección (inspeccion_cabecera local). Upsert por id del dispositivo, last-write-wins por updated_at. Una inspección por unidad por día.';

create table inspection_measurements (
  id                uuid primary key,    -- ⚠ id del DISPOSITIVO (inspeccion_neumatico.id)
  company_id        uuid not null references companies(id),
  inspection_id     uuid not null references inspections(id),
  position_number   smallint not null,
  life_cycle_id     uuid references tire_life_cycles(id),  -- opcional: se resuelve server-side vía instalación activa (Run 3); la app NO lo manda

  -- Identidad texto (lo que la app manda hoy — se conserva siempre):
  tire_code         text,
  brand_name        text,
  model_name        text,
  size_name         text,
  condition         text,
  retread_design    text,

  -- Crudos del inspector:
  rtd_a_mm          numeric(4,1),
  rtd_b_mm          numeric(4,1),
  rtd_c_mm          numeric(4,1),
  rtd_d_mm          numeric(4,1),
  pressure_psi      numeric(5,1),
  temperature_mode  temperature_mode,    -- la app aún no lo captura
  valve_cap         text,
  anomaly           text,
  anomaly_photo_url text,

  -- Derivados calculados EN EL DISPOSITIVO (paridad calculations.ts/py — el server los recibe, no los recalcula en fase 1):
  rtd_movi_mm       numeric(4,1),
  idi_mm            numeric(4,1),
  rtd_state         rtd_state,
  pressure_state    pressure_state,
  is_discard        boolean not null default false,

  device_updated_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (inspection_id, position_number)
);
comment on table inspection_measurements is 'Medición por posición (inspeccion_neumatico local). UNIQUE(inspection_id,position_number) espeja el índice antiduplicados del SQLite (fix v2).';

create index inspections_unit_date_idx on inspections (unit_id, inspected_on desc);
create index inspection_measurements_inspection_idx on inspection_measurements (inspection_id);
create index tire_installations_unit_pos_idx on tire_installations (unit_id, position_number);
create index tire_life_cycles_casing_idx on tire_life_cycles (casing_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — PENDIENTE (a propósito fuera de la demo)
-- ─────────────────────────────────────────────────────────────────────────────
-- La demo opera vía SQL editor / service role. Antes de dar acceso real a
-- clientes: ENABLE ROW LEVEL SECURITY en todas las tablas + política
--   company_id = (select company_id from profiles where id = auth.uid())
-- y FK profiles.id → auth.users(id). Ver docs/run2_risks_and_fallback.md.
