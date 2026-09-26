-- RENOVA — restringe las cuentas activas a inspector, operario y supervisor.
-- La cuenta fleet_manager activa documentada se usó históricamente para el
-- supervisor de neumáticos; se normaliza a tire_supervisor antes de cerrar
-- las autorizaciones. Otros roles activos heredados requieren revisión manual.
-- Los valores enum y perfiles inactivos se conservan.

do $$
declare
  v_active_fleet_managers bigint;
begin
  select count(*) into v_active_fleet_managers
    from public.profiles
   where active
     and role::text = 'fleet_manager';

  if v_active_fleet_managers > 1 then
    raise exception 'Hay % perfiles fleet_manager activos; revisar su identidad antes de normalizarlos.', v_active_fleet_managers;
  end if;
end;
$$;

update public.profiles
   set role = 'tire_supervisor'
 where active
   and role::text = 'fleet_manager';

do $$
begin
  if exists (
    select 1
      from public.profiles
     where active
       and role::text not in ('inspector', 'operator', 'tire_supervisor')
  ) then
    raise exception 'Hay perfiles activos con roles fuera de inspector/operator/tire_supervisor; reconcílialos antes de aplicar esta migración.';
  end if;
end;
$$;

alter table public.profiles
  drop constraint if exists profiles_active_role_is_operational;
alter table public.profiles
  add constraint profiles_active_role_is_operational
  check (not active or role::text in ('inspector', 'operator', 'tire_supervisor'))
  not valid;
alter table public.profiles
  validate constraint profiles_active_role_is_operational;

-- El supervisor actual conserva las operaciones de taller que antes se
-- habilitaban mediante fleet_manager/workshop_manager/admin.
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
  if v_profile.role::text <> 'tire_supervisor' then
    raise exception 'Tu rol (%) no permite registrar operaciones de taller.', v_profile.role
      using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

-- Un rol heredado no puede ejecutar RPCs de Movimientos aunque una función
-- histórica aún lo enumere en su argumento. Operario toma/completa; supervisor
-- emite/cancela. Inspector conserva solo sus RPC de inspección.
create or replace function public.fn_require_tire_movement_profile(
  p_allowed_roles text[]
)
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
    raise exception 'Necesitás iniciar sesión para trabajar con movimientos.'
      using errcode = '42501';
  end if;

  select * into v_profile
    from public.profiles
   where id = auth.uid();

  if v_profile.id is null or not v_profile.active then
    raise exception 'Tu usuario no tiene un perfil activo en RENOVA.'
      using errcode = '42501';
  end if;

  if v_profile.role::text not in ('operator', 'tire_supervisor')
     or not (v_profile.role::text = any(p_allowed_roles)) then
    raise exception 'Tu rol (%) no permite realizar esta acción.', v_profile.role
      using errcode = '42501';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.fn_require_tire_movement_profile(text[])
  from public, anon, authenticated;

drop policy if exists "select_movement_orders_own_company"
  on public.tire_movement_orders;
create policy "select_movement_orders_own_company"
  on public.tire_movement_orders for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in ('operator', 'tire_supervisor')
  );

drop policy if exists "select_movement_executions_own_company"
  on public.tire_movement_executions;
create policy "select_movement_executions_own_company"
  on public.tire_movement_executions for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in ('operator', 'tire_supervisor')
  );
