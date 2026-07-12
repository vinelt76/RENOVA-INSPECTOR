-- RENOVA — Operaciones de taller sobre neumáticos (Fase 2 del módulo web).
--
-- 5 RPCs transaccionales (una llamada = una transacción; si algo falla, no
-- queda ningún cambio a medias):
--   register_full_installation → casco + ciclo + instalación desde cero
--   register_removal           → retiro (rotación / retén / reencauche / descarte / otro)
--   transfer_tire              → traslado atómico entre unidades/posiciones
--   reinstall_tire             → reinstalación de un ciclo en retén
--   retread_casing             → cierre de ciclo y apertura de R1/R2/…
--
-- Seguridad:
--   * SECURITY DEFINER con search_path fijo (bypasean RLS a propósito porque
--     anon/authenticated no tienen grants de escritura en las tablas).
--   * La empresa NUNCA viaja desde el navegador: se deriva del profile del
--     usuario autenticado (fn_require_workshop_profile) y toda entidad tocada
--     se valida contra esa empresa.
--   * Rol requerido: workshop_manager, fleet_manager o admin (activo).
--   * REVOKE de PUBLIC/anon; EXECUTE solo para authenticated.
--
-- Integridad (los índices parciales existentes son el candado final):
--   tire_installations_active_pos_uidx   → 1 instalación activa por unidad+posición
--   tire_installations_active_cycle_uidx → 1 instalación activa por ciclo
--   tire_life_cycles_active_uidx         → 1 ciclo activo por casco
-- Las funciones validan primero con mensajes claros; el índice cubre carreras.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: perfil del usuario autenticado con rol de taller. Falla con mensaje
-- claro si no hay sesión, el perfil no existe/está inactivo o el rol no alcanza.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_require_workshop_profile()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Necesitás iniciar sesión para operar sobre neumáticos.'
      using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not v_profile.active then
    raise exception 'Tu usuario no tiene un perfil activo en RENOVA.'
      using errcode = '42501';
  end if;
  if v_profile.role not in ('workshop_manager', 'fleet_manager', 'admin') then
    raise exception 'Tu rol (%) no permite registrar operaciones de taller.', v_profile.role
      using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

revoke all on function public.fn_require_workshop_profile() from public, anon;
grant execute on function public.fn_require_workshop_profile() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper interno: valida unidad+posición dentro de la empresa. Devuelve la
-- unidad; falla si la posición no existe en la configuración o está ocupada.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_validate_free_position(
  p_company_id uuid, p_unit_id uuid, p_position smallint
)
returns public.units
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_unit public.units%rowtype;
  v_occupied_code text;
begin
  select * into v_unit from public.units
   where id = p_unit_id and company_id = p_company_id;
  if v_unit.id is null then
    raise exception 'La unidad destino no existe o no pertenece a tu empresa.';
  end if;

  if not exists (
    select 1 from public.tire_positions tp
     where tp.config_id = v_unit.config_id and tp.position_number = p_position
  ) then
    raise exception 'La posición P% no existe en la configuración de la unidad %.',
      p_position, v_unit.plate;
  end if;

  select coalesce(cs.code, '(sin código)') into v_occupied_code
    from public.tire_installations ti
    join public.tire_life_cycles lc on lc.id = ti.life_cycle_id
    join public.tire_casings cs on cs.id = lc.casing_id
   where ti.unit_id = p_unit_id and ti.position_number = p_position and not ti.removed
   limit 1;
  if v_occupied_code is not null then
    raise exception 'La posición P% de la unidad % ya está ocupada por el neumático %. Retiralo primero.',
      p_position, v_unit.plate, v_occupied_code;
  end if;

  return v_unit;
end;
$$;

revoke all on function public.fn_validate_free_position(uuid, uuid, smallint) from public, anon;
grant execute on function public.fn_validate_free_position(uuid, uuid, smallint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Instalación desde cero: casco + ciclo N/R1/… + instalación inicial.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.register_full_installation(
  p_casing_code    text,
  p_brand_name     text,
  p_model_name     text,
  p_size_name      text,
  p_condition      public.tire_condition,
  p_unit_id        uuid,
  p_position       smallint,
  p_installed_at   date,
  p_retread_design text default null,
  p_otd_mm         numeric default null,
  p_cost           numeric default null,
  p_currency       text default 'PEN',
  p_odometer       integer default null,
  p_rtd_mm         numeric default null,
  p_notes          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_unit    public.units%rowtype;
  v_code    text;
  v_casing_id uuid;
  v_cycle_id  uuid;
  v_inst_id   uuid;
  v_cycle_number smallint;
begin
  v_profile := public.fn_require_workshop_profile();
  if p_installed_at is null then
    raise exception 'La fecha de instalación es obligatoria.';
  end if;
  if p_condition is null then
    raise exception 'La condición (N, R1, R2…) es obligatoria.';
  end if;
  if p_condition <> 'N' and nullif(trim(coalesce(p_retread_design,'')), '') is null then
    raise exception 'Un neumático % necesita el diseño de reencauche.', p_condition;
  end if;

  v_unit := public.fn_validate_free_position(v_profile.company_id, p_unit_id, p_position);

  v_code := nullif(trim(coalesce(p_casing_code, '')), '');
  if v_code is not null and exists (
    select 1 from public.tire_casings
     where company_id = v_profile.company_id and code = v_code
  ) then
    raise exception 'Ya existe un casco con el código % en tu empresa. Usá "Reinstalar" o "Trasladar" para moverlo.', v_code;
  end if;

  v_cycle_number := case p_condition
    when 'N' then 0 when 'R1' then 1 when 'R2' then 2 when 'R3' then 3 else 4 end;

  insert into public.tire_casings (company_id, code, brand_name, model_name, size_name, notes)
  values (v_profile.company_id, v_code,
          nullif(trim(coalesce(p_brand_name,'')),''),
          nullif(trim(coalesce(p_model_name,'')),''),
          nullif(trim(coalesce(p_size_name,'')),''),
          p_notes)
  returning id into v_casing_id;

  insert into public.tire_life_cycles (
    company_id, casing_id, cycle_number, condition, retread_design,
    otd_mm, cost, currency, started_at
  ) values (
    v_profile.company_id, v_casing_id, v_cycle_number, p_condition,
    nullif(trim(coalesce(p_retread_design,'')),''),
    p_otd_mm, p_cost, coalesce(nullif(trim(p_currency),''),'PEN'), p_installed_at
  ) returning id into v_cycle_id;

  insert into public.tire_installations (
    company_id, life_cycle_id, unit_id, position_number,
    installed_at, odometer_at_install, rtd_at_install_mm, installed_by, notes
  ) values (
    v_profile.company_id, v_cycle_id, p_unit_id, p_position,
    p_installed_at, p_odometer, coalesce(p_rtd_mm, p_otd_mm), v_profile.id, p_notes
  ) returning id into v_inst_id;

  return jsonb_build_object(
    'casing_id', v_casing_id, 'life_cycle_id', v_cycle_id,
    'installation_id', v_inst_id, 'plate', v_unit.plate, 'position', p_position
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Retiro: cierra la instalación activa y registra el evento.
--    reason='discard'  → exige causa; cierra ciclo y casco (baja definitiva).
--    reason='retread'  → cierra el ciclo (status retreaded); retread_casing abre el siguiente.
--    retención/rotación/otro → el ciclo queda activo y disponible (retén).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.register_removal(
  p_life_cycle_id uuid,
  p_removed_at    date,
  p_reason        public.removal_reason,
  p_odometer      integer default null,
  p_rtd_mm        numeric default null,
  p_discard_cause public.discard_cause default null,
  p_photo_url     text default null,
  p_notes         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_inst    public.tire_installations%rowtype;
  v_removal_id uuid;
  v_casing_id  uuid;
begin
  v_profile := public.fn_require_workshop_profile();
  if p_removed_at is null then raise exception 'La fecha de retiro es obligatoria.'; end if;
  if p_reason is null then raise exception 'El motivo de retiro es obligatorio.'; end if;
  if p_reason = 'discard' and p_discard_cause is null then
    raise exception 'Un descarte necesita la causa registrada.';
  end if;

  select ti.* into v_inst
    from public.tire_installations ti
   where ti.life_cycle_id = p_life_cycle_id
     and ti.company_id = v_profile.company_id
     and not ti.removed
   for update;
  if v_inst.id is null then
    raise exception 'Este neumático no tiene una instalación activa en tu empresa.';
  end if;
  if p_removed_at < v_inst.installed_at then
    raise exception 'La fecha de retiro (%) no puede ser anterior a la de instalación (%).',
      p_removed_at, v_inst.installed_at;
  end if;

  update public.tire_installations
     set removed = true, updated_at = now()
   where id = v_inst.id;

  insert into public.tire_removals (
    company_id, installation_id, removed_at, odometer_at_removal, odometer_source,
    rtd_at_removal_mm, reason, discard_cause, photo_url, removed_by, notes
  ) values (
    v_profile.company_id, v_inst.id, p_removed_at, p_odometer,
    case when p_odometer is not null then 'manual'::public.odometer_source
         else 'unknown'::public.odometer_source end,
    p_rtd_mm, p_reason, p_discard_cause, p_photo_url, v_profile.id, p_notes
  ) returning id into v_removal_id;

  select casing_id into v_casing_id from public.tire_life_cycles where id = p_life_cycle_id;

  if p_reason = 'discard' then
    update public.tire_life_cycles
       set status = 'discarded', ended_at = p_removed_at, updated_at = now()
     where id = p_life_cycle_id;
    update public.tire_casings
       set status = 'discarded', discarded_at = p_removed_at,
           discard_cause = p_discard_cause, discard_photo_url = p_photo_url,
           updated_at = now()
     where id = v_casing_id;
  elsif p_reason = 'retread' then
    update public.tire_life_cycles
       set status = 'retreaded', ended_at = p_removed_at, updated_at = now()
     where id = p_life_cycle_id;
  end if;

  return jsonb_build_object(
    'removal_id', v_removal_id, 'installation_id', v_inst.id,
    'life_cycle_id', p_life_cycle_id, 'reason', p_reason
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Traslado atómico entre unidades/posiciones (mismo ciclo de vida).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transfer_tire(
  p_life_cycle_id  uuid,
  p_dest_unit_id   uuid,
  p_dest_position  smallint,
  p_moved_at       date,
  p_odometer_origin integer default null,
  p_rtd_mm         numeric default null,
  p_odometer_dest  integer default null,
  p_notes          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_unit    public.units%rowtype;
  v_removal jsonb;
  v_inst_id uuid;
begin
  v_profile := public.fn_require_workshop_profile();
  if p_moved_at is null then raise exception 'La fecha del traslado es obligatoria.'; end if;

  -- Valida destino ANTES de cerrar el origen: si la posición está ocupada la
  -- operación entera se rechaza con mensaje claro (nunca reemplaza en silencio).
  v_unit := public.fn_validate_free_position(v_profile.company_id, p_dest_unit_id, p_dest_position);

  v_removal := public.register_removal(
    p_life_cycle_id => p_life_cycle_id,
    p_removed_at    => p_moved_at,
    p_reason        => 'rotation',
    p_odometer      => p_odometer_origin,
    p_rtd_mm        => p_rtd_mm,
    p_notes         => coalesce(p_notes, 'Traslado a ' || v_unit.plate || ' P' || p_dest_position)
  );

  insert into public.tire_installations (
    company_id, life_cycle_id, unit_id, position_number,
    installed_at, odometer_at_install, rtd_at_install_mm, installed_by, notes
  ) values (
    v_profile.company_id, p_life_cycle_id, p_dest_unit_id, p_dest_position,
    p_moved_at, p_odometer_dest, p_rtd_mm, v_profile.id, p_notes
  ) returning id into v_inst_id;

  return jsonb_build_object(
    'life_cycle_id', p_life_cycle_id,
    'removal_id', v_removal->>'removal_id',
    'installation_id', v_inst_id,
    'dest_plate', v_unit.plate, 'dest_position', p_dest_position
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Reinstalación desde retén: nuevo evento de instalación del mismo ciclo.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reinstall_tire(
  p_life_cycle_id uuid,
  p_unit_id       uuid,
  p_position      smallint,
  p_installed_at  date,
  p_odometer      integer default null,
  p_rtd_mm        numeric default null,
  p_notes         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_cycle   public.tire_life_cycles%rowtype;
  v_unit    public.units%rowtype;
  v_inst_id uuid;
begin
  v_profile := public.fn_require_workshop_profile();
  if p_installed_at is null then raise exception 'La fecha de instalación es obligatoria.'; end if;

  select * into v_cycle from public.tire_life_cycles
   where id = p_life_cycle_id and company_id = v_profile.company_id
   for update;
  if v_cycle.id is null then
    raise exception 'El neumático no existe o no pertenece a tu empresa.';
  end if;
  if v_cycle.status <> 'active' then
    raise exception 'Este ciclo de vida está cerrado (%). Si el casco fue reencauchado, instalá el ciclo nuevo.', v_cycle.status;
  end if;
  if exists (
    select 1 from public.tire_installations
     where life_cycle_id = v_cycle.id and not removed
  ) then
    raise exception 'Este neumático ya está instalado. Usá "Trasladar" para moverlo.';
  end if;

  v_unit := public.fn_validate_free_position(v_profile.company_id, p_unit_id, p_position);

  insert into public.tire_installations (
    company_id, life_cycle_id, unit_id, position_number,
    installed_at, odometer_at_install, rtd_at_install_mm, installed_by, notes
  ) values (
    v_profile.company_id, v_cycle.id, p_unit_id, p_position,
    p_installed_at, p_odometer, p_rtd_mm, v_profile.id, p_notes
  ) returning id into v_inst_id;

  return jsonb_build_object(
    'installation_id', v_inst_id, 'life_cycle_id', v_cycle.id,
    'plate', v_unit.plate, 'position', p_position
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- E. Reencauche: cierra el ciclo vigente (si sigue activo) y abre R(n+1).
--    El ciclo nuevo arranca con 0 km propios (los km se derivan de SUS
--    instalaciones); el casco conserva su historia completa.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.retread_casing(
  p_casing_id      uuid,
  p_retread_design text,
  p_started_at     date,
  p_otd_mm         numeric default null,
  p_cost           numeric default null,
  p_currency       text default 'PEN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_casing  public.tire_casings%rowtype;
  v_prev    public.tire_life_cycles%rowtype;
  v_next_number smallint;
  v_next_cond   public.tire_condition;
  v_cycle_id    uuid;
begin
  v_profile := public.fn_require_workshop_profile();
  if p_started_at is null then raise exception 'La fecha del reencauche es obligatoria.'; end if;
  if nullif(trim(coalesce(p_retread_design,'')),'') is null then
    raise exception 'El diseño del reencauche es obligatorio.';
  end if;

  select * into v_casing from public.tire_casings
   where id = p_casing_id and company_id = v_profile.company_id
   for update;
  if v_casing.id is null then
    raise exception 'El casco no existe o no pertenece a tu empresa.';
  end if;
  if v_casing.status = 'discarded' then
    raise exception 'El casco % está descartado: no se puede reencauchar.', coalesce(v_casing.code, '(sin código)');
  end if;

  select * into v_prev from public.tire_life_cycles
   where casing_id = v_casing.id
   order by cycle_number desc limit 1
   for update;
  if v_prev.id is null then
    raise exception 'El casco no tiene ningún ciclo de vida registrado.';
  end if;
  if exists (
    select 1 from public.tire_installations
     where life_cycle_id = v_prev.id and not removed
  ) then
    raise exception 'El neumático sigue instalado. Registrá el retiro a reencauche antes de crear el ciclo nuevo.';
  end if;

  if v_prev.status = 'active' then
    update public.tire_life_cycles
       set status = 'retreaded', ended_at = p_started_at, updated_at = now()
     where id = v_prev.id;
  end if;

  v_next_number := v_prev.cycle_number + 1;
  if v_next_number > 4 then
    raise exception 'El casco ya está en R4: no hay condición siguiente definida en el catálogo.';
  end if;
  v_next_cond := ('R' || v_next_number)::public.tire_condition;

  insert into public.tire_life_cycles (
    company_id, casing_id, cycle_number, condition, retread_design,
    otd_mm, cost, currency, started_at
  ) values (
    v_profile.company_id, v_casing.id, v_next_number, v_next_cond,
    trim(p_retread_design), p_otd_mm, p_cost,
    coalesce(nullif(trim(p_currency),''),'PEN'), p_started_at
  ) returning id into v_cycle_id;

  return jsonb_build_object(
    'casing_id', v_casing.id, 'life_cycle_id', v_cycle_id,
    'cycle_number', v_next_number, 'condition', v_next_cond
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants: nada para PUBLIC/anon; solo usuarios autenticados (el rol se valida
-- dentro de cada función).
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.register_full_installation(text,text,text,text,public.tire_condition,uuid,smallint,date,text,numeric,numeric,text,integer,numeric,text) from public, anon;
grant execute on function public.register_full_installation(text,text,text,text,public.tire_condition,uuid,smallint,date,text,numeric,numeric,text,integer,numeric,text) to authenticated;

revoke all on function public.register_removal(uuid,date,public.removal_reason,integer,numeric,public.discard_cause,text,text) from public, anon;
grant execute on function public.register_removal(uuid,date,public.removal_reason,integer,numeric,public.discard_cause,text,text) to authenticated;

revoke all on function public.transfer_tire(uuid,uuid,smallint,date,integer,numeric,integer,text) from public, anon;
grant execute on function public.transfer_tire(uuid,uuid,smallint,date,integer,numeric,integer,text) to authenticated;

revoke all on function public.reinstall_tire(uuid,uuid,smallint,date,integer,numeric,text) from public, anon;
grant execute on function public.reinstall_tire(uuid,uuid,smallint,date,integer,numeric,text) to authenticated;

revoke all on function public.retread_casing(uuid,text,date,numeric,numeric,text) from public, anon;
grant execute on function public.retread_casing(uuid,text,date,numeric,numeric,text) to authenticated;

-- Hardening extra detectado en la auditoría: delete_inspections_by_date es un
-- helper administrativo (nadie lo llama desde WEB/app) — no debe ser ejecutable
-- por anon/authenticated.
revoke all on function public.delete_inspections_by_date(date, date) from public, anon, authenticated;
