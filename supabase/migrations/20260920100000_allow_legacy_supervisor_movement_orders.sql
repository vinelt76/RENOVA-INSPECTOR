-- RENOVA — Compatibilidad del rol supervisor legado con Movimientos y Servicios.
--
-- El esquema inicial creó el rol `supervisor`. Las órdenes web modernas usan
-- `tire_supervisor`, pero las cuentas existentes no deben quedar bloqueadas por
-- esa migración de nombre. Se conserva la empresa derivada del perfil y RLS.

drop policy if exists "select_movement_orders_own_company"
  on public.tire_movement_orders;
create policy "select_movement_orders_own_company"
  on public.tire_movement_orders for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in (
      'operator', 'supervisor', 'tire_supervisor', 'fleet_manager', 'admin'
    )
  );

drop policy if exists "select_movement_executions_own_company"
  on public.tire_movement_executions;
create policy "select_movement_executions_own_company"
  on public.tire_movement_executions for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.current_profile_role()) in (
      'operator', 'supervisor', 'tire_supervisor', 'fleet_manager', 'admin'
    )
  );

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
  v_allowed boolean;
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

  v_allowed := v_profile.role::text = any(p_allowed_roles)
    or (v_profile.role::text = 'supervisor' and 'tire_supervisor' = any(p_allowed_roles));
  if not v_allowed then
    raise exception 'Tu rol (%) no permite realizar esta acción.', v_profile.role
      using errcode = '42501';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.fn_require_tire_movement_profile(text[])
  from public, anon, authenticated;

grant execute on function public.create_tire_movement_order(uuid, uuid, date, text, jsonb)
  to authenticated;
