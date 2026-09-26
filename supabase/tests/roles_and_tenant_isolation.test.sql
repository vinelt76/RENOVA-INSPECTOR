-- RENOVA — aislamiento y grants de los tres perfiles operativos.
-- Ejecutar con psql -v ON_ERROR_STOP=1. El ROLLBACK final revierte fixtures.

begin;

do $$
declare
  v_company_id uuid := gen_random_uuid();
  v_other_company_id uuid := gen_random_uuid();
  v_inspector_id uuid := gen_random_uuid();
  v_operator_id uuid := gen_random_uuid();
  v_supervisor_id uuid := gen_random_uuid();
  v_other_supervisor_id uuid := gen_random_uuid();
  v_legacy_profile_id uuid := gen_random_uuid();
  v_config_id uuid := gen_random_uuid();
  v_axle_id uuid := gen_random_uuid();
  v_unit_id uuid := gen_random_uuid();
  v_foreign_unit_id uuid := gen_random_uuid();
  v_order_id uuid := gen_random_uuid();
  v_foreign_order_id uuid := gen_random_uuid();
  v_visible_orders integer;
  v_role text;
begin
  if has_function_privilege('anon', 'public.save_inspection(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_tire_movement_order(uuid,uuid,date,text,jsonb)', 'EXECUTE') then
    raise exception 'GRANTS: anon conserva acceso a RPCs autenticadas';
  end if;

  if not has_function_privilege('authenticated', 'public.save_inspection(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_tire_movement_order(uuid,uuid,date,text,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.claim_tire_movement_order(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.complete_tire_movement_order(uuid,integer,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.cancel_tire_movement_order(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.register_full_installation(text,text,text,text,public.tire_condition,uuid,smallint,date,text,numeric,numeric,text,integer,numeric,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.register_removal(uuid,date,public.removal_reason,integer,numeric,public.discard_cause,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.transfer_tire(uuid,uuid,smallint,date,integer,numeric,integer,text)', 'EXECUTE') then
    raise exception 'GRANTS: falta EXECUTE para authenticated';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('tire_movement_orders', 'tire_movement_executions')
      and (qual::text like '%fleet_manager%'
        or qual::text like '%workshop_manager%'
        or qual::text like '%admin%')
  ) then
    raise exception 'RLS: una política de Movimientos conserva roles heredados';
  end if;

  insert into public.companies (id, name, legacy_code)
  values
    (v_company_id, 'TEST-ROLES-A', 'test-roles-a'),
    (v_other_company_id, 'TEST-ROLES-B', 'test-roles-b');

  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values
    (v_inspector_id, 'authenticated', 'authenticated', 'test-roles-inspector@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_operator_id, 'authenticated', 'authenticated', 'test-roles-operator@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_supervisor_id, 'authenticated', 'authenticated', 'test-roles-supervisor@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_other_supervisor_id, 'authenticated', 'authenticated', 'test-roles-supervisor-other@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_legacy_profile_id, 'authenticated', 'authenticated', 'test-roles-legacy@invalid.example', '{}'::jsonb, '{}'::jsonb);

  insert into public.profiles (id, company_id, full_name, role, active)
  values
    (v_inspector_id, v_company_id, 'TEST Inspector', 'inspector', true),
    (v_operator_id, v_company_id, 'TEST Operator', 'operator', true),
    (v_supervisor_id, v_company_id, 'TEST Supervisor', 'tire_supervisor', true),
    (v_other_supervisor_id, v_other_company_id, 'TEST Other Supervisor', 'tire_supervisor', true),
    (v_legacy_profile_id, v_company_id, 'TEST Legacy Inactive', 'fleet_manager', false);

  if (select count(*) from public.profiles where id = v_legacy_profile_id and role::text = 'fleet_manager' and not active) <> 1 then
    raise exception 'HISTORICAL: perfil heredado inactivo no fue conservado';
  end if;

  insert into public.vehicle_configs (id, vehicle_type, notation, is_mvp)
  values (v_config_id, 'TEST BUS', 'TEST-2-4', false);
  insert into public.axles (id, config_id, axle_number, axle_type)
  values (v_axle_id, v_config_id, 1, 'TEST');
  insert into public.tire_positions (config_id, axle_id, position_number)
  values (v_config_id, v_axle_id, 1);
  insert into public.units (id, company_id, plate, vehicle_type, config_id)
  values
    (v_unit_id, v_company_id, 'TEST-ROLE-A', 'TEST BUS', v_config_id),
    (v_foreign_unit_id, v_other_company_id, 'TEST-ROLE-B', 'TEST BUS', v_config_id);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_supervisor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if (select count(*) from public.units) <> 1 then
    raise exception 'RLS: supervisor vio otra empresa';
  end if;
  if (select count(*) from public.tire_movement_orders) <> 0 then
    raise exception 'RLS: datos inesperados en órdenes';
  end if;

  perform public.create_tire_movement_order(
    v_order_id,
    v_unit_id,
    current_date,
    'TEST order',
    '[{"direction":"exit","position":1,"reason":"repair"}]'::jsonb
  );
  if not exists (select 1 from public.tire_movement_orders where id = v_order_id and company_id = v_company_id) then
    raise exception 'MOVIMIENTOS: supervisor no pudo emitir una orden';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_operator_id::text, true);
  select count(*) into v_visible_orders from public.tire_movement_orders;
  if v_visible_orders <> 1 then
    raise exception 'RLS: operador no vio la orden de su empresa';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_other_supervisor_id::text, true);
  if (select count(*) from public.tire_movement_orders) <> 0 then
    raise exception 'RLS: supervisor de otra empresa vio una orden';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_inspector_id::text, true);
  begin
    perform public.create_tire_movement_order(gen_random_uuid(), v_unit_id, current_date, 'TEST denied', '[]'::jsonb);
    raise exception 'MOVIMIENTOS: inspector pudo emitir una orden';
  exception when insufficient_privilege then
    null;
  end;

  set local role postgres;
  if (select count(*) from public.profiles where active and role::text not in ('inspector','operator','tire_supervisor')) <> 0 then
    raise exception 'ROLES: existe un rol activo heredado';
  end if;

  raise notice 'TESTS_PASSED';
end;
$$;

rollback;
