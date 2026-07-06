-- ============================================================================
-- RENOVA INSPECTOR — Supabase schema DRAFT (Run 1)
-- ============================================================================
-- BORRADOR PARA REVISIÓN. NO es una migración final ni destructiva.
-- No ejecutar contra un proyecto con datos. Cuando se apruebe, se convertirá
-- en migraciones versionadas en supabase/migrations/.
--
-- Principios (ver CLAUDE.md y specs/reglas_negocio.md):
--   * Offline-first: los IDs de inspección se generan como UUID v4 EN EL
--     DISPOSITIVO. El servidor acepta el id del cliente (nunca autoincrement).
--   * Multi-tenant row-level: empresa_id (company_id) en toda tabla de negocio.
--     RLS por empresa (se define al implementar; aquí solo se anota).
--   * Umbrales SIEMPRE configurables por empresa/medida — nunca hardcodeados.
--   * El catálogo PATRON es compartido (sin company_id) y se sincroniza a los
--     dispositivos; fase 1 del pull solo agrega, nunca borra.
--   * Diseñado para N empresas: las 5 actuales se cargan vía import_batches,
--     no se siembran hardcodeadas.
--
-- Convención de nombres: tablas/columnas en inglés snake_case (convención
-- Supabase); los términos de dominio en español se documentan en COMMENT.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

create type user_role as enum ('inspector', 'supervisor', 'fleet_manager', 'workshop_manager', 'admin');

create type unit_status as enum ('active', 'pending_validation', 'inactive');

-- Ciclo de vida del neumático físico (inventario)
create type tire_status as enum (
  'in_stock',      -- en almacén, disponible
  'installed',     -- montado en una unidad
  'retained',      -- en retén (retirado temporalmente, reutilizable)
  'in_retread',    -- enviado a reencauche
  'discarded'      -- descartado/desecho (fin de vida)
);

-- Condición del casco al instalar: nuevo o número de reencauche
create type tire_condition as enum ('N', 'R1', 'R2', 'R3', 'R4');

-- ESTADO RTD — resultado del if/elif secuencial (reglas_negocio §2)
create type rtd_state as enum ('Normal', 'Próximo a Reencauche', 'Para Reencauche');

-- ESTADO PRESIÓN (reglas_negocio §3)
create type pressure_state as enum ('Sin Medir', 'Normal', 'Alta Presión', 'Baja Presión');

-- Modo de medición de presión. CALIENTE existe en el dominio pero su referencia
-- NO está definida (decisión abierta) — el estado de presión en HOT queda NULL.
create type temperature_mode as enum ('COLD', 'HOT');

create type removal_reason as enum (
  'retread',          -- va a reencauche
  'rotation',         -- rotación de posición
  'retention',        -- a retén
  'discard',          -- desecho
  'other'
);

-- Causa de retiro/descarte (del modal "Descartar" del panel de taller)
create type discard_cause as enum (
  'Servicio', 'Neumático', 'Conducción-Ruta',
  'Mantenimiento Alineación', 'Proveedor', 'Otro'
);

create type import_status as enum ('pending', 'processing', 'completed', 'completed_with_errors', 'failed');

-- ─────────────────────────────────────────────────────────────────────────────
-- TENANCY: companies / fleets / profiles
-- ─────────────────────────────────────────────────────────────────────────────

create table companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  legacy_code  text unique,              -- id local actual ('movil','cruz','civa','ittsa','cta') para mapear el SQLite existente
  ruc          text,                     -- identificación fiscal (Perú), opcional
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table companies is
  'Empresas cliente (tenant raíz). ~5 hoy, diseñada para N: nuevas empresas entran por import o alta manual, nunca hardcodeadas. RLS futura: todas las tablas de negocio filtran por company_id.';

create table fleets (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);
comment on table fleets is
  'Flotas/operaciones dentro de una empresa (campo "flota" del SQLite local, hoy nullable). Opcional: una unidad puede no tener flota asignada.';

create table profiles (
  id          uuid primary key,          -- = auth.users.id (FK a auth.users al implementar)
  company_id  uuid not null references companies(id),
  full_name   text not null,
  role        user_role not null default 'inspector',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table profiles is
  'Perfil de usuario asociado a auth.users (task_14: tabla app_user). Un usuario pertenece a UNA empresa. RLS futura: base de toda política (company_id del perfil del jwt).';

-- ─────────────────────────────────────────────────────────────────────────────
-- CATÁLOGO PATRON (compartido, sin company_id, legible por autenticados)
-- ─────────────────────────────────────────────────────────────────────────────

create table catalog_brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text unique,               -- id slug del SQLite local (mapeo de sync)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table catalog_brands is 'Marcas de neumático (cat_marca local). El inspector puede crear nuevas desde campo → suben por sync.';

create table catalog_models (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references catalog_brands(id),
  name       text not null,
  slug       text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name)
);
comment on table catalog_models is 'Modelos/diseños originales por marca (cat_modelo local).';

create table catalog_sizes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,      -- ej: 295/80R22.5
  slug        text unique,
  default_otd numeric(5,2),              -- OTD (profundidad original, mm) típico de la medida — DATO FALTANTE hoy, ver run1_missing_data_questions.md
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table catalog_sizes is 'Medidas (cat_medida local). default_otd es fallback; el OTD real vive en tires.otd_mm.';

create table catalog_retread_designs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table catalog_retread_designs is 'Diseños de reencauche (cat_reencauche local).';

create table catalog_anomalies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  slug           text unique,
  probable_cause text,                   -- "posible causa" del PATRON
  is_discard     boolean not null default false,  -- desecho=TRUE → auto-marca desecho en la medición
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table catalog_anomalies is 'Anomalías del PATRON (cat_anomalia local, 65+ tipos). is_discard dispara el DESECHO automático (reglas_negocio §5).';

create table catalog_valve_caps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table catalog_valve_caps is 'Tapas de válvula (cat_valvula local).';

create table catalog_conditions (
  code text primary key,                 -- 'N','R1','R2','R3','R4'
  name text not null
);
comment on table catalog_conditions is 'Condición del neumático (cat_condicion local). Redundante con el enum tire_condition; se mantiene como catálogo visible/sincronizable.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIGURACIÓN DE VEHÍCULO: vehicle_configs → axles → tire_positions
-- (normaliza cat_configuracion, que hoy es una tabla plana por posición)
-- ─────────────────────────────────────────────────────────────────────────────

create table vehicle_configs (
  id           uuid primary key default gen_random_uuid(),
  vehicle_type text not null,            -- BUS, TRACTO, CARRETA, SEMIREMOLQUE, FURGON
  notation     text not null,            -- '2-4', '2-4-2', '2-2-2', …
  is_mvp       boolean not null default false,  -- MVP = solo BUS 2-4 y 2-4-2
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (vehicle_type, notation)
);
comment on table vehicle_configs is 'Configuraciones del PATRON (BUS 2-4-2, etc.). is_mvp replica el flag mvp local: la app solo ofrece configs MVP.';

create table axles (
  id          uuid primary key default gen_random_uuid(),
  config_id   uuid not null references vehicle_configs(id),
  axle_number smallint not null,         -- 1 = delantero
  axle_type   text not null,             -- Direccional | Tracción | Libre | Dual (determina 3 o 4 canales RTD)
  created_at  timestamptz not null default now(),
  unique (config_id, axle_number)
);
comment on table axles is 'Ejes de una configuración. axle_type determina el nº de canales RTD (Dir/Tracción=3, Libre/Dual=4 — reglas_negocio §1) y agrupa posiciones para el análisis de balance del dashboard Rendimiento.';

create table tire_positions (
  id              uuid primary key default gen_random_uuid(),
  config_id       uuid not null references vehicle_configs(id),
  axle_id         uuid not null references axles(id),
  position_number smallint not null,     -- P1..Pn, orden del PATRON
  side            text,                  -- 'Izq' | 'Der' | null
  is_ground       boolean not null default true,  -- piso: false = repuesto elevado
  created_at      timestamptz not null default now(),
  unique (config_id, position_number)
);
comment on table tire_positions is 'Posiciones de neumático por configuración (cat_configuracion local). Las mediciones referencian position_number dentro de la config de la unidad.';

-- ─────────────────────────────────────────────────────────────────────────────
-- UMBRALES CONFIGURABLES (nunca hardcodear 4/7/8 ni %)
-- ─────────────────────────────────────────────────────────────────────────────

create table rtd_thresholds (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id),
  size_id         uuid references catalog_sizes(id),   -- null = default de la empresa para toda medida
  rtd_change_mm   numeric(4,1) not null,  -- rtd_cambio  (default negocio hoy: 4)
  rtd_next_mm     numeric(4,1) not null,  -- rtd_proximo (default negocio hoy: 7)
  rtd_normal_mm   numeric(4,1),           -- rtd_normal_min informativo (8)
  rtd_removal_mm  numeric(4,1),           -- "RTD Retiro recomendado" usado por Km Proyectado (Rendimiento)
  updated_at      timestamptz not null default now(),
  unique (company_id, size_id)
);
comment on table rtd_thresholds is 'Umbrales de ESTADO RTD por empresa y medida (umbral_rtd del plan). La app hoy usa defaults 4/7 hardcodeados como deuda documentada; esta tabla los vuelve configurables.';

create table pressure_thresholds (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id),
  size_id        uuid references catalog_sizes(id),
  axle_type      text,                    -- Direccional/Tracción/Libre/Dual; null = todos
  cold_psi       numeric(5,1) not null,   -- presion_frio de referencia
  hot_psi        numeric(5,1),            -- ⚠ ABIERTA: referencia CALIENTE sin definir — dejar NULL, NO inventar
  delta_high_pct numeric(4,1) not null default 5.0,
  delta_low_pct  numeric(4,1) not null default 10.0,
  updated_at     timestamptz not null default now(),
  unique (company_id, size_id, axle_type)
);
comment on table pressure_thresholds is 'Umbrales de presión por empresa/medida/tipo de eje (umbral_presion del plan). hot_psi queda NULL hasta que RENOVA defina la referencia CALIENTE (decisión abierta en CLAUDE.md).';

create table axle_balance_thresholds (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id),
  max_diff_pct numeric(4,1) not null default 15.0,
  updated_at  timestamptz not null default now(),
  unique (company_id)
);
comment on table axle_balance_thresholds is 'Umbral de desbalance de eje del dashboard Rendimiento (AXLE_BALANCE_THRESHOLD_PERCENT=15 en rendimiento.html, marcado ahí como "pendiente de definir con RENOVA"). Configurable por empresa.';

create table isa_weights (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id),
  discard_weight     numeric(4,1) not null default 5,
  non_discard_weight numeric(4,1) not null default 1,
  updated_at         timestamptz not null default now(),
  unique (company_id)
);
comment on table isa_weights is 'Pesos del Índice de Severidad de Anomalías (reglas_negocio §6), configurables por empresa.';

-- ─────────────────────────────────────────────────────────────────────────────
-- UNIDADES
-- ─────────────────────────────────────────────────────────────────────────────

create table units (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id),
  fleet_id       uuid references fleets(id),
  plate          text not null,           -- "numero" local: placa/número interno alfanumérico (ej AAV-803)
  vehicle_type   text not null default 'BUS',
  config_id      uuid not null references vehicle_configs(id),
  status         unit_status not null default 'active',
  last_odometer  integer,                 -- cache de la última inspección (odometro_ultimo local)
  last_inspected_at date,                 -- ultima_fecha local
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, plate)
);
comment on table units is 'Unidades/vehículos (tabla unidad local, PK compuesta numero+empresa_id → aquí uuid + UNIQUE(company_id,plate)). status=pending_validation para altas de campo que un supervisor valida después (flujo_inspeccion.md).';

-- ─────────────────────────────────────────────────────────────────────────────
-- NEUMÁTICOS FÍSICOS (identidad + inventario + montaje)
-- Hoy la app captura el neumático como texto dentro de la medición; estas
-- tablas dan identidad propia al neumático para rendimiento e historial.
-- ─────────────────────────────────────────────────────────────────────────────

create table tires (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id),
  code              text,                 -- código de fuego/grabado; puede ser 'No visible'/'Sin código' → NULL + nota
  brand_id          uuid references catalog_brands(id),
  model_id          uuid references catalog_models(id),
  size_id           uuid references catalog_sizes(id),
  condition         tire_condition not null default 'N',   -- N/R1..R4 actual del casco
  retread_design_id uuid references catalog_retread_designs(id),  -- diseño del último reencauche (null si N)
  otd_mm            numeric(5,2),         -- OTD del casco en su ciclo actual — insumo de % de Consumo y Km Proyectado
  cost              numeric(12,2),        -- costo del neumático/reencauche — insumo de Costo/Km
  currency          text default 'PEN',
  accumulated_km    integer not null default 0,  -- km_previo_acumulado: lo actualiza el sistema en cada retiro
  status            tire_status not null default 'in_stock',
  discarded_at      timestamptz,
  discard_cause     discard_cause,
  discard_photo_url text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index tires_company_code_uidx on tires (company_id, code) where code is not null;
comment on table tires is 'Neumático físico (casco). Identidad persistente entre inspecciones/instalaciones/reencauches. Los campos de descarte se completan al pasar a status=discarded (modal "Descartar" del panel de taller: causa + foto obligatorias).';

create table tire_installations (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id),
  tire_id              uuid not null references tires(id),
  unit_id              uuid not null references units(id),
  position_number      smallint not null,      -- posición dentro de la config de la unidad
  installed_at         date not null,
  odometer_at_install  integer,                -- Km Instalación (insumo de Km Recorrido)
  rtd_at_install_mm    numeric(5,2),           -- RTD Instalación (insumo de RTD Gastado)
  condition            tire_condition not null default 'N',  -- condición al momento de instalar
  retread_design_id    uuid references catalog_retread_designs(id),
  installed_by         uuid references profiles(id),
  removed              boolean not null default false,  -- true cuando existe el tire_removal correspondiente
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index tire_installations_active_pos_uidx
  on tire_installations (unit_id, position_number) where not removed;
comment on table tire_installations is 'Evento de montaje. Aporta los datos fuente rtdInstalacion/kmInstalacion de TODAS las fórmulas de Rendimiento. Índice parcial: una sola instalación activa por unidad+posición.';

create table tire_removals (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id),
  installation_id      uuid not null unique references tire_installations(id),
  tire_id              uuid not null references tires(id),
  removed_at           date not null,
  odometer_at_removal  integer,
  rtd_at_removal_mm    numeric(5,2),
  reason               removal_reason not null,
  discard_cause        discard_cause,          -- obligatorio en la app cuando reason=discard
  photo_url            text,                   -- obligatorio en la app cuando reason=discard
  premature_discard    boolean,                -- reglas_negocio §11 (requiere VUR previa; fase futura)
  removed_by           uuid references profiles(id),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table tire_removals is 'Evento de desmontaje/retiro. Cierra la instalación, actualiza tires.accumulated_km (+= odómetro_retiro − odómetro_instalación) y, si reason=discard, pasa el neumático a discarded. La obligatoriedad causa+foto en descarte se valida en la app (el borrador no usa CHECK cruzado).';

create table tire_inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id),
  tire_id     uuid not null references tires(id),
  from_status tire_status,
  to_status   tire_status not null,
  moved_at    timestamptz not null default now(),
  moved_by    uuid references profiles(id),
  reference_installation_id uuid references tire_installations(id),
  reference_removal_id      uuid references tire_removals(id),
  notes       text
);
comment on table tire_inventory_movements is 'Bitácora de inventario (almacén → instalado → retén → reencauche → desecho). El estado ACTUAL vive en tires.status; esta tabla es el historial auditable ("Enviar a Retén"/"Descartar" del panel de taller).';

-- ─────────────────────────────────────────────────────────────────────────────
-- INSPECCIONES (espejo del SQLite local — IDs generados en el dispositivo)
-- ─────────────────────────────────────────────────────────────────────────────

create table inspections (
  id             uuid primary key,        -- ⚠ UUID v4 del DISPOSITIVO (inspeccion_cabecera.id). Sin default: el cliente manda.
  company_id     uuid not null references companies(id),
  unit_id        uuid not null references units(id),
  inspected_on   date not null,           -- fecha (una inspección por unidad/día — decisión task_12)
  odometer_km    integer not null,        -- km_odometro
  unit_photo_url text,                    -- foto_unidad: en local es dataURL; en servidor, path en Storage
  inspector_id   uuid references profiles(id),
  device_created_at timestamptz,          -- created_at local
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),   -- LWW del sync (task_14)
  unique (unit_id, inspected_on)
);
comment on table inspections is 'Cabecera de inspección (inspeccion_cabecera local). Llega por push del sync_queue; upsert por id con last-write-wins sobre updated_at. UNIQUE(unit_id,inspected_on) refleja la regla "una inspección por unidad por día".';

create table inspection_measurements (
  id               uuid primary key,      -- ⚠ UUID v4 del DISPOSITIVO (inspeccion_neumatico.id)
  company_id       uuid not null references companies(id),
  inspection_id    uuid not null references inspections(id),
  position_number  smallint not null,     -- posicion (P1..P8)
  tire_id          uuid references tires(id),  -- null hasta que exista identidad de neumático; hoy la app manda texto

  -- Identidad capturada como TEXTO (estado actual de la app; se conserva tal
  -- cual para no perder datos aunque tire_id llegue después):
  tire_code        text,                  -- codigo ('1234', 'No visible', 'Sin código')
  brand_name       text,                  -- marca
  model_name       text,                  -- modelo
  size_name        text,                  -- medida
  condition        text,                  -- condicion (N/R1/R2…)
  retread_design   text,                  -- reencauche (diseño)

  -- Mediciones crudas del inspector:
  rtd_a_mm         numeric(4,1),          -- r1 (canal A) — validar ≥ 0; >22 advertencia
  rtd_b_mm         numeric(4,1),          -- r2
  rtd_c_mm         numeric(4,1),          -- r3
  rtd_d_mm         numeric(4,1),          -- r4 (solo ejes Libre/Dual)
  pressure_psi     numeric(5,1),          -- presion (null = sin medir)
  temperature_mode temperature_mode,      -- FRÍO/CALIENTE — la app aún no lo captura (spec sí lo pide)
  valve_cap        text,                  -- tapa_valvula (texto del catálogo)
  anomaly          text,                  -- anomalia (texto del catálogo; null = sin anomalía)
  anomaly_photo_url text,                 -- foto de anomalía/desecho (Sprint 3, aún no capturada)

  -- Derivados calculados EN EL DISPOSITIVO (paridad calculations.ts ↔ .py).
  -- Fase 1: el servidor los recibe, no los recalcula. Las vistas los consumen.
  rtd_movi_mm      numeric(4,1),          -- MIN de canales medidos
  idi_mm           numeric(4,1),          -- MAX − MIN
  rtd_state        rtd_state,             -- estado_rtd (secuencial §2)
  pressure_state   pressure_state,        -- estado_presion (la app aún no lo persiste; el panel taller lo deriva)
  is_discard       boolean not null default false,  -- desecho (auto por anomalía is_discard, o manual)

  device_updated_at timestamptz,          -- updated_at local (LWW)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (inspection_id, position_number)
);
comment on table inspection_measurements is 'Medición por posición (inspeccion_neumatico local). UNIQUE(inspection_id,position_number) espeja idx_neumatico_cab_pos (fix del bug de duplicados v2). Los campos *_name en texto son puente hasta que el sync resuelva tire_id/catálogo por id.';

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORTS (carga histórica de Excels y altas masivas de nuevas empresas)
-- ─────────────────────────────────────────────────────────────────────────────

create table import_batches (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id),   -- null si el batch crea la empresa
  source        text not null,           -- 'excel_historico', 'csv_unidades', 'seed_catalogo', …
  file_name     text,
  status        import_status not null default 'pending',
  total_rows    integer,
  ok_rows       integer,
  error_rows    integer,
  imported_by   uuid references profiles(id),
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);
comment on table import_batches is 'Lotes de importación (Excels golden de docs/, altas de nuevas empresas). Clave para NO hardcodear las 5 empresas actuales: cualquier empresa futura entra por aquí.';

create table import_errors (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references import_batches(id),
  row_number   integer,
  raw_data     jsonb,                    -- fila original tal cual
  error_code   text,
  error_detail text not null,
  created_at   timestamptz not null default now()
);
comment on table import_errors is 'Errores fila a fila de un import, con el dato crudo para reprocesar.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RENDIMIENTO (performance) — VISTAS SQL, no tablas
-- Las fórmulas de rendimiento.html / rendimiento-por-neumatico.html se
-- convierten en vistas derivadas; el HTML pasa a solo renderizar.
-- ─────────────────────────────────────────────────────────────────────────────

create view v_tire_performance as
select
  ti.id                                  as installation_id,
  ti.company_id,
  ti.unit_id,
  ti.position_number,
  ti.tire_id,
  t.code                                 as tire_code,
  t.condition,
  t.otd_mm,
  t.cost,
  t.accumulated_km                       as previous_accumulated_km,
  ti.rtd_at_install_mm,
  ti.odometer_at_install,
  li.rtd_movi_mm                         as current_rtd_mm,     -- de la ÚLTIMA inspección
  li.odometer_km                         as current_odometer_km,
  rt.rtd_removal_mm,
  -- RTD Gastado = RTD Instalación − RTD Actual
  (ti.rtd_at_install_mm - li.rtd_movi_mm)                       as rtd_worn_mm,
  -- Km Recorrido = Km Actual − Km Instalación
  (li.odometer_km - ti.odometer_at_install)                     as km_run,
  -- % de Consumo = RTD Gastado / OTD × 100
  case when t.otd_mm > 0
       then (ti.rtd_at_install_mm - li.rtd_movi_mm) / t.otd_mm * 100 end        as consumption_pct,
  -- Km/mm = Km Recorrido / RTD Gastado
  case when (ti.rtd_at_install_mm - li.rtd_movi_mm) > 0
       then (li.odometer_km - ti.odometer_at_install)
            / (ti.rtd_at_install_mm - li.rtd_movi_mm) end                        as km_per_mm,
  -- Km Proyectado = Km/mm × (OTD − RTD Retiro recomendado)
  case when (ti.rtd_at_install_mm - li.rtd_movi_mm) > 0 and rt.rtd_removal_mm is not null
       then (li.odometer_km - ti.odometer_at_install)
            / (ti.rtd_at_install_mm - li.rtd_movi_mm)
            * (t.otd_mm - rt.rtd_removal_mm) end                                 as km_projected,
  -- Costo/Km = Costo / Km Recorrido
  case when (li.odometer_km - ti.odometer_at_install) > 0
       then t.cost / (li.odometer_km - ti.odometer_at_install) end               as cost_per_km,
  -- Km Acumulado = km_previo_acumulado + Km Recorrido
  t.accumulated_km + (li.odometer_km - ti.odometer_at_install)                   as km_accumulated
from tire_installations ti
join tires t on t.id = ti.tire_id
left join rtd_thresholds rt on rt.company_id = ti.company_id and rt.size_id = t.size_id
left join lateral (
  -- última medición de esta unidad+posición (con RTD MOVI presente)
  select im.rtd_movi_mm, i.odometer_km, i.inspected_on
  from inspection_measurements im
  join inspections i on i.id = im.inspection_id
  where i.unit_id = ti.unit_id
    and im.position_number = ti.position_number
    and im.rtd_movi_mm is not null
    and i.inspected_on >= ti.installed_at
  order by i.inspected_on desc
  limit 1
) li on true
where not ti.removed;
comment on view v_tire_performance is
  'Métricas por neumático de rendimiento-por-neumatico.html, derivadas de instalación + última inspección. Si faltan datos fuente los campos quedan NULL ("Sin datos") — nunca se inventa 0, igual que computeTire() del mock.';

create view v_axle_performance as
select
  u.company_id,
  vp.unit_id,
  a.id                                   as axle_id,
  a.axle_number,
  a.axle_type,
  avg(vp.km_per_mm)                      as avg_km_per_mm,
  avg(vp.consumption_pct)                as avg_consumption_pct,
  count(vp.km_per_mm)                    as valid_positions,
  -- Diferencia % = (máx − mín) / promedio × 100 (con 2 posiciones equivale a |A−B|/prom)
  case when count(vp.km_per_mm) >= 2 and avg(vp.km_per_mm) > 0
       then (max(vp.km_per_mm) - min(vp.km_per_mm)) / avg(vp.km_per_mm) * 100 end as diff_pct
from units u
join tire_positions tp on tp.config_id = u.config_id
join axles a on a.id = tp.axle_id
left join v_tire_performance vp
       on vp.unit_id = u.id and vp.position_number = tp.position_number
group by u.company_id, vp.unit_id, a.id, a.axle_number, a.axle_type;
comment on view v_axle_performance is
  'Agregados por eje de rendimiento.html (modo "Ver por eje"). El veredicto balanceado/desbalanceado se resuelve comparando diff_pct contra axle_balance_thresholds de la empresa (no se hardcodea el 15%).';

create view v_fleet_status as
select
  i.company_id,
  i.id                                   as inspection_id,
  i.unit_id,
  i.inspected_on,
  min(im.rtd_movi_mm)                    as worst_rtd_mm,
  count(*) filter (where im.rtd_state = 'Para Reencauche' or im.is_discard)      as critical_tires,
  count(*) filter (where im.rtd_state = 'Próximo a Reencauche')                  as warning_tires,
  case
    when bool_or(im.is_discard) or bool_or(im.rtd_state = 'Para Reencauche') then 'critical'
    when bool_or(im.rtd_state = 'Próximo a Reencauche')                      then 'warning'
    else 'normal'
  end                                    as unit_status
from inspections i
join inspection_measurements im on im.inspection_id = i.id
group by i.company_id, i.id, i.unit_id, i.inspected_on;
comment on view v_fleet_status is
  'Semáforo por unidad de vista-flota.html (peor caso entre neumáticos). Usa rtd_state calculado con umbrales de empresa en el dispositivo — corrige el hardcode 4/8 mm del mock.';

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTAS RLS (futuras — NO incluidas en el borrador)
-- ─────────────────────────────────────────────────────────────────────────────
-- * companies/fleets/units/tires/*installations/*removals/*movements/
--   inspections/inspection_measurements/import_*/thresholds:
--     ENABLE ROW LEVEL SECURITY;
--     política: company_id = (select company_id from profiles where id = auth.uid())
-- * catalog_*, vehicle_configs, axles, tire_positions, catalog_conditions:
--     SELECT para todo usuario autenticado; escritura solo service_role/admin.
--     (Las altas de catálogo desde campo suben vía sync con INSERT controlado.)
-- * profiles: cada usuario lee su propia fila; admin de empresa lee su empresa.
-- * Vistas: heredan RLS de las tablas base (security_invoker) al implementar.
