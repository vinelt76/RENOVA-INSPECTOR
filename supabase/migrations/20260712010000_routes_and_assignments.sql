-- RENOVA — Rutas y contexto operativo (Fase 3 del módulo web).
--
-- La ruta NO se guarda como texto en units: una unidad cambia de ruta y de
-- configuración de servicio a lo largo del tiempo, y el rendimiento de un
-- neumático depende de la ruta vigente DURANTE su instalación, no de la actual.
--
--   route_types            → catálogo por empresa ('Costa', 'Sierra', …)
--   routes                 → ruta concreta (origen/destino) con tipo
--   unit_route_assignments → historial: unidad ↔ ruta con vigencia, odómetros
--                            y configuración de servicio (asientos)
--
-- Atribución de km (v_installation_route_attribution): a cada instalación se
-- le asigna ruta SOLO cuando una única asignación cubre todo el periodo
-- ('full'). Overlap parcial → la ruta se muestra pero el km atribuible queda
-- NULL ('partial'); varias rutas → NULL ('mixed'); sin datos → NULL ('none').
-- NUNCA se adjudica el rendimiento histórico completo a la ruta actual.

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.route_types (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);
comment on table public.route_types is
  'Tipos de ruta por empresa (Costa/Sierra/Mixta…). Catálogo en DB, nunca hardcodeado en la UI.';

create table public.routes (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  route_type_id uuid references public.route_types(id),
  name          text not null,          -- ej. 'Lima - Trujillo'
  origin        text,
  destination   text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, name)
);
comment on table public.routes is 'Rutas concretas por empresa, con tipo de ruta opcional.';

create table public.unit_route_assignments (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  unit_id        uuid not null references public.units(id),
  route_id       uuid not null references public.routes(id),
  started_on     date not null,
  ended_on       date,                  -- NULL = asignación vigente
  odometer_start integer,
  odometer_end   integer,
  seats_count    smallint,              -- nº de asientos / config de servicio vigente
  service_config text,                  -- ej. '160°', 'cama 2 pisos' (texto libre)
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  check (odometer_end is null or odometer_start is null or odometer_end >= odometer_start),
  -- Una unidad no puede tener dos asignaciones que se solapen en el tiempo.
  exclude using gist (
    unit_id with =,
    daterange(started_on, coalesce(ended_on, 'infinity'::date), '[]') with &&
  )
);
comment on table public.unit_route_assignments is
  'Historial de asignación unidad↔ruta. El periodo decide qué ruta explica los km de cada instalación de neumático.';

create index unit_route_assignments_unit_idx on public.unit_route_assignments (unit_id, started_on desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: lectura por empresa; escritura SOLO vía RPC (sin policies de escritura).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.route_types enable row level security;
alter table public.routes enable row level security;
alter table public.unit_route_assignments enable row level security;

create policy "select_own_company" on public.route_types
  for select to authenticated
  using (company_id = (select public.current_company_id()));
create policy "select_own_company" on public.routes
  for select to authenticated
  using (company_id = (select public.current_company_id()));
create policy "select_own_company" on public.unit_route_assignments
  for select to authenticated
  using (company_id = (select public.current_company_id()));

revoke insert, update, delete, truncate, references, trigger
  on public.route_types, public.routes, public.unit_route_assignments
  from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC transaccional: asignar ruta a una unidad.
-- Cierra la asignación vigente (ended_on / odometer_end) y crea la nueva.
-- Upserta tipo y ruta por nombre para no exigir IDs desde el navegador.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.assign_unit_route(
  p_unit_id         uuid,
  p_route_name      text,
  p_started_on      date,
  p_route_type_name text default null,
  p_origin          text default null,
  p_destination     text default null,
  p_odometer_start  integer default null,
  p_seats_count     smallint default null,
  p_service_config  text default null,
  p_notes           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  public.profiles%rowtype;
  v_unit     public.units%rowtype;
  v_type_id  uuid;
  v_route_id uuid;
  v_asg_id   uuid;
begin
  v_profile := public.fn_require_workshop_profile();
  if p_started_on is null then raise exception 'La fecha de inicio es obligatoria.'; end if;
  if nullif(trim(coalesce(p_route_name,'')),'') is null then
    raise exception 'El nombre de la ruta es obligatorio.';
  end if;

  select * into v_unit from public.units
   where id = p_unit_id and company_id = v_profile.company_id;
  if v_unit.id is null then
    raise exception 'La unidad no existe o no pertenece a tu empresa.';
  end if;

  if nullif(trim(coalesce(p_route_type_name,'')),'') is not null then
    insert into public.route_types (company_id, name)
    values (v_profile.company_id, trim(p_route_type_name))
    on conflict (company_id, name) do update set updated_at = now()
    returning id into v_type_id;
  end if;

  insert into public.routes (company_id, route_type_id, name, origin, destination)
  values (v_profile.company_id, v_type_id, trim(p_route_name),
          nullif(trim(coalesce(p_origin,'')),''), nullif(trim(coalesce(p_destination,'')),''))
  on conflict (company_id, name) do update
    set route_type_id = coalesce(excluded.route_type_id, public.routes.route_type_id),
        origin        = coalesce(excluded.origin, public.routes.origin),
        destination   = coalesce(excluded.destination, public.routes.destination),
        updated_at    = now()
  returning id into v_route_id;

  -- Cierra la asignación vigente el día anterior al inicio de la nueva.
  update public.unit_route_assignments
     set ended_on = p_started_on - 1,
         odometer_end = coalesce(odometer_end, p_odometer_start),
         updated_at = now()
   where unit_id = p_unit_id and ended_on is null and started_on < p_started_on;

  if exists (
    select 1 from public.unit_route_assignments
     where unit_id = p_unit_id and ended_on is null
  ) then
    raise exception 'La unidad % ya tiene una asignación vigente que empieza en esa fecha o después. Corregí las fechas.', v_unit.plate;
  end if;

  insert into public.unit_route_assignments (
    company_id, unit_id, route_id, started_on, odometer_start,
    seats_count, service_config, notes
  ) values (
    v_profile.company_id, p_unit_id, v_route_id, p_started_on, p_odometer_start,
    p_seats_count, p_service_config, p_notes
  ) returning id into v_asg_id;

  return jsonb_build_object(
    'assignment_id', v_asg_id, 'route_id', v_route_id,
    'plate', v_unit.plate, 'route', trim(p_route_name)
  );
end;
$$;

revoke all on function public.assign_unit_route(uuid,text,date,text,text,text,integer,smallint,text,text) from public, anon;
grant execute on function public.assign_unit_route(uuid,text,date,text,text,text,integer,smallint,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vistas de contexto de ruta
-- ─────────────────────────────────────────────────────────────────────────────

-- Ruta vigente por unidad (para filtros y listados).
create or replace view public.v_unit_current_route
with (security_invoker = true) as
select
  u.id as unit_id,
  u.company_id,
  u.plate,
  a.id as assignment_id,
  r.id as route_id,
  r.name as route_name,
  rt.name as route_type_name,
  a.seats_count,
  a.service_config,
  a.started_on
from public.units u
left join lateral (
  select * from public.unit_route_assignments a1
   where a1.unit_id = u.id and a1.ended_on is null
   order by a1.started_on desc limit 1
) a on true
left join public.routes r on r.id = a.route_id
left join public.route_types rt on rt.id = r.route_type_id;

comment on view public.v_unit_current_route is
  'Asignación de ruta vigente por unidad (NULL si nunca se asignó).';

-- Atribución de ruta por instalación de neumático, con calidad explícita.
create or replace view public.v_installation_route_attribution
with (security_invoker = true) as
select
  k.installation_id,
  k.company_id,
  k.life_cycle_id,
  k.unit_id,
  k.position_number,
  k.installed_at,
  k.removed_at,
  k.km_run,
  ov.n_overlaps,
  case
    when ov.n_overlaps = 1 then ov.route_name
    else null
  end as route_name,
  case
    when ov.n_overlaps = 1 then ov.route_type_name
    else null
  end as route_type_name,
  case
    when ov.n_overlaps = 1 then ov.seats_count
    else null
  end as seats_count,
  case
    when coalesce(ov.n_overlaps, 0) = 0 then 'none'
    when ov.n_overlaps = 1 and ov.covers_full then 'full'
    when ov.n_overlaps = 1 then 'partial'
    else 'mixed'
  end as attribution_quality,
  -- km atribuibles a la ruta: solo con cobertura completa; jamás se inventa.
  case
    when ov.n_overlaps = 1 and ov.covers_full then k.km_run
    else null
  end as km_attributable
from public.v_installation_km k
left join lateral (
  select
    count(*) as n_overlaps,
    bool_and(
      a.started_on <= k.installed_at
      and coalesce(a.ended_on, 'infinity'::date) >= coalesce(k.removed_at, current_date)
    ) as covers_full,
    max(r.name) as route_name,
    max(rt.name) as route_type_name,
    max(a.seats_count) as seats_count
  from public.unit_route_assignments a
  join public.routes r on r.id = a.route_id
  left join public.route_types rt on rt.id = r.route_type_id
  where a.unit_id = k.unit_id
    and daterange(a.started_on, coalesce(a.ended_on, 'infinity'::date), '[]')
        && daterange(k.installed_at, coalesce(k.removed_at, current_date), '[]')
) ov on true;

comment on view public.v_installation_route_attribution is
  'Ruta/tipo/asientos por instalación con calidad de atribución (full/partial/mixed/none). km_attributable solo cuando UNA asignación cubre todo el periodo.';
