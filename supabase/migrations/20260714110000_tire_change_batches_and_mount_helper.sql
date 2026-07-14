-- RENOVA — Identidad/historial de lotes de cambios y helper interno de montaje.
--
-- La RPC transaccional que consume estos objetos se agrega en la migración
-- siguiente. Este archivo no expone todavía ningún flujo de escritura al cliente.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Identidad e historial auditable de cada lote aplicado.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.tire_change_batches (
  id            uuid primary key,
  company_id    uuid not null references public.companies(id),
  unit_id       uuid not null references public.units(id),
  requested_by  uuid not null references public.profiles(id),
  batch_version smallint not null,
  performed_at  date not null,
  payload       jsonb not null,
  result        jsonb not null,
  applied_at    timestamptz not null default now()
);

comment on table public.tire_change_batches is
  'Identidad e historial auditable de lotes de cambios de neumáticos. El id nace en el cliente para que los reintentos sean idempotentes.';
comment on column public.tire_change_batches.id is
  'UUID generado por el cliente; identifica el mismo lote en todos sus reintentos.';
comment on column public.tire_change_batches.payload is
  'Lote completo tal como llegó a la RPC, conservado como registro auditable.';
comment on column public.tire_change_batches.result is
  'Respuesta completa del primer procesamiento, reutilizada por reintentos idempotentes.';

-- Acceso principal del historial de una unidad y cobertura de su FK.
create index tire_change_batches_unit_applied_idx
  on public.tire_change_batches (unit_id, applied_at desc);

-- company_id participa en RLS; requested_by completa la cobertura de FKs.
create index tire_change_batches_company_applied_idx
  on public.tire_change_batches (company_id, applied_at desc);
create index tire_change_batches_requested_by_idx
  on public.tire_change_batches (requested_by);

alter table public.tire_change_batches enable row level security;

create policy "select_own_company" on public.tire_change_batches
  for select
  to authenticated
  using (company_id = (select public.current_company_id()));

-- Grants y RLS son capas separadas. La tabla se expone solo para lectura de
-- usuarios autenticados; toda escritura futura pasará por una RPC definer.
revoke all on table public.tire_change_batches from anon, authenticated;
grant select on table public.tire_change_batches to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Helper interno: monta un ciclo existente y disponible.
--
-- El ciclo se bloquea antes de comprobar su instalación activa. Así dos
-- montajes concurrentes del mismo ciclo se serializan y el segundo recibe un
-- error de dominio claro. La unicidad parcial de tire_installations conserva
-- la garantía final para carreras sobre una misma posición.
-- ────────────────────────────────────────────────────────────────────────────
create function public.fn_mount_existing_cycle(
  p_profile       public.profiles,
  p_life_cycle_id uuid,
  p_unit_id       uuid,
  p_position      smallint,
  p_installed_at  date,
  p_odometer      integer default null,
  p_rtd_mm        numeric default null,
  p_notes         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle record;
  v_installed_plate text;
  v_installed_position smallint;
  v_is_first_installation boolean;
  v_installation_id uuid;
begin
  select lc.*, cs.status as casing_status
    into v_cycle
    from public.tire_life_cycles lc
    join public.tire_casings cs on cs.id = lc.casing_id
   where lc.id = p_life_cycle_id
     and lc.company_id = p_profile.company_id
   for update of lc;

  if not found then
    raise exception
      '[no_disponible] El ciclo % no existe o no pertenece a tu empresa.',
      coalesce(p_life_cycle_id::text, '(sin id)')
      using errcode = '22023';
  end if;

  if v_cycle.status <> 'active' or v_cycle.casing_status <> 'active' then
    raise exception
      '[no_disponible] El ciclo % no está disponible (estado del ciclo: %, estado del casco: %).',
      p_life_cycle_id, v_cycle.status, v_cycle.casing_status
      using errcode = '22023';
  end if;

  select u.plate, ti.position_number
    into v_installed_plate, v_installed_position
    from public.tire_installations ti
    join public.units u on u.id = ti.unit_id
   where ti.life_cycle_id = p_life_cycle_id
     and not ti.removed
   limit 1;

  if found then
    raise exception
      '[no_disponible] El ciclo % ya está montado en la unidad % posición P%.',
      p_life_cycle_id, v_installed_plate, v_installed_position
      using errcode = '22023';
  end if;

  perform public.fn_validate_free_position(
    p_profile.company_id,
    p_unit_id,
    p_position
  );

  v_is_first_installation := not exists (
    select 1
      from public.tire_installations ti
     where ti.life_cycle_id = p_life_cycle_id
  );

  insert into public.tire_installations (
    company_id,
    life_cycle_id,
    unit_id,
    position_number,
    installed_at,
    odometer_at_install,
    rtd_at_install_mm,
    installed_by,
    notes
  ) values (
    p_profile.company_id,
    p_life_cycle_id,
    p_unit_id,
    p_position,
    p_installed_at,
    p_odometer,
    case
      when v_is_first_installation then coalesce(p_rtd_mm, v_cycle.otd_mm)
      else p_rtd_mm
    end,
    p_profile.id,
    p_notes
  )
  returning id into v_installation_id;

  return v_installation_id;
end;
$$;

comment on function public.fn_mount_existing_cycle(
  public.profiles, uuid, uuid, smallint, date, integer, numeric, text
) is
  'Helper interno para montar un ciclo disponible. Solo en su primera instalación usa otd_mm como fallback de RTD; si el ciclo ya rodó y no se informa RTD, conserva NULL.';

-- Las funciones son ejecutables por PUBLIC por defecto. Este helper vive en
-- public por contrato, pero no forma parte de la API: solo lo llaman otras
-- funciones SECURITY DEFINER propiedad del rol migrador.
revoke all on function public.fn_mount_existing_cycle(
  public.profiles, uuid, uuid, smallint, date, integer, numeric, text
) from public, anon, authenticated;
