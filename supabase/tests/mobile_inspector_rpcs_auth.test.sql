-- Pruebas de aislamiento para las tres RPC móviles.
-- Ejecutar con psql -v ON_ERROR_STOP=1. El ROLLBACK final revierte los fixtures.

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
  v_company_name text;
  v_config_id uuid := gen_random_uuid();
  v_axle_id uuid := gen_random_uuid();
  v_unit_id uuid := gen_random_uuid();
  v_foreign_unit_id uuid := gen_random_uuid();
  v_foreign_inspection_id uuid := gen_random_uuid();
  v_order_id uuid := gen_random_uuid();
  v_cancel_order_id uuid := gen_random_uuid();
  v_foreign_order_id uuid := gen_random_uuid();
  v_odometer integer;
  v_visible_orders integer;
  v_saved_inspector_id uuid;
  v_saved_plate text;
  v_role_probe text;
  v_probe_name text;
  v_payload jsonb;
begin
  if has_function_privilege('anon', 'public.get_unidad_preload(text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_umbrales_rtd(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_inspection(jsonb)', 'EXECUTE') then
    raise exception 'GRANTS: anon conserva EXECUTE sobre una RPC móvil';
  end if;

  if not has_function_privilege('authenticated', 'public.get_unidad_preload(text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_umbrales_rtd(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_inspection(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_tire_movement_order(uuid,uuid,date,text,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.claim_tire_movement_order(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.complete_tire_movement_order(uuid,integer,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.cancel_tire_movement_order(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.fn_require_workshop_profile()', 'EXECUTE') then
    raise exception 'GRANTS: falta EXECUTE para authenticated';
  end if;

  if not has_function_privilege('authenticated', 'public.fn_anomaly_is_severe(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.fn_channel_rtd_state(uuid,text,numeric)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.fn_effective_rtd_thresholds(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.fn_pressure_state_fixed(numeric)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.fn_rtd_state(uuid,text,numeric)', 'EXECUTE') then
    raise exception 'GRANTS: authenticated perdió acceso a funciones usadas por las vistas';
  end if;

  if exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and (
         has_table_privilege('anon', c.oid, 'SELECT')
         or has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'UPDATE')
         or has_table_privilege('anon', c.oid, 'DELETE')
         or has_table_privilege('anon', c.oid, 'TRUNCATE')
         or has_table_privilege('anon', c.oid, 'REFERENCES')
         or has_table_privilege('anon', c.oid, 'TRIGGER')
       )
  ) then
    raise exception 'GRANTS: anon conserva acceso a una tabla o vista public';
  end if;

  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
      and (has_sequence_privilege('anon', c.oid, 'USAGE')
        or has_sequence_privilege('anon', c.oid, 'SELECT')
        or has_sequence_privilege('anon', c.oid, 'UPDATE'))
  ) then
    raise exception 'GRANTS: anon conserva acceso a una secuencia public';
  end if;

  if exists (
    select 1
      from pg_default_acl d
      cross join lateral aclexplode(d.defaclacl) acl
     where d.defaclrole = 'postgres'::regrole
       and d.defaclnamespace in (0, 'public'::regnamespace)
       and acl.grantee in (0, 'anon'::regrole)
  ) then
    raise exception 'DEFAULT GRANTS: postgres concede privilegios anon/PUBLIC a objetos nuevos';
  end if;

  -- Comprueba el privilegio efectivo de una función recién creada: anon no debe
  -- heredar EXECUTE por ACL global ni de esquema. La excepción final revierte el fixture.
  v_probe_name := 'renova_anon_probe_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  execute format('create function public.%I() returns integer language sql as %L', v_probe_name, 'select 1');
  if has_function_privilege('anon', format('public.%I()', v_probe_name), 'EXECUTE') then
    raise exception 'DEFAULT GRANTS: anon hereda EXECUTE en una función nueva';
  end if;

  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proowner = 'postgres'::regrole
       and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'GRANTS: anon conserva EXECUTE en una función de aplicación';
  end if;

  v_company_name := 'TEST RPC ' || left(v_company_id::text, 8);
  insert into public.companies (id, name, legacy_code)
  values
    (v_company_id, v_company_name, 'test-rpc-' || left(v_company_id::text, 8)),
    (v_other_company_id, 'TEST RPC OTHER ' || left(v_other_company_id::text, 8), 'test-rpc-other-' || left(v_other_company_id::text, 8));

  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values
    (v_inspector_id, 'authenticated', 'authenticated', 'test-inspector-' || left(v_inspector_id::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_operator_id, 'authenticated', 'authenticated', 'test-operator-' || left(v_operator_id::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_supervisor_id, 'authenticated', 'authenticated', 'test-supervisor-' || left(v_supervisor_id::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_other_supervisor_id, 'authenticated', 'authenticated', 'test-supervisor-other-' || left(v_other_supervisor_id::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_legacy_profile_id, 'authenticated', 'authenticated', 'test-legacy-' || left(v_legacy_profile_id::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb);

  insert into public.profiles (id, company_id, full_name, role, active)
  values
    (v_inspector_id, v_company_id, 'TEST Inspector', 'inspector', true),
    (v_operator_id, v_company_id, 'TEST Operator', 'operator', true),
    (v_supervisor_id, v_company_id, 'TEST Supervisor', 'tire_supervisor', true),
    (v_other_supervisor_id, v_other_company_id, 'TEST Other Supervisor', 'tire_supervisor', true),
    (v_legacy_profile_id, v_company_id, 'TEST Inactive Legacy', 'fleet_manager', false);

  -- Los perfiles activos quedan limitados a los tres roles actuales; los
  -- perfiles históricos inactivos se conservan sin conservar autorización.
  if exists (
    select 1 from public.profiles
     where active and role::text not in ('inspector', 'operator', 'tire_supervisor')
  ) then
    raise exception 'ROLE: hay perfiles activos fuera del conjunto de tres roles';
  end if;
  if (select active from public.profiles where id = v_legacy_profile_id) then
    raise exception 'ROLE: no preservó el estado inactivo del perfil histórico';
  end if;
  foreach v_role_probe in array array['supervisor', 'fleet_manager', 'workshop_manager', 'admin'] loop
    begin
      update public.profiles set role = v_role_probe::public.user_role
       where id = v_supervisor_id;
      raise exception 'ROLE: permitió activar el rol histórico %', v_role_probe;
    exception when check_violation then
      null;
    end;
  end loop;

  insert into public.vehicle_configs (id, vehicle_type, notation, is_mvp)
  values (v_config_id, 'TEST BUS', 'TEST-RPC-' || left(v_config_id::text, 8), false);
  insert into public.axles (id, config_id, axle_number, axle_type)
  values (v_axle_id, v_config_id, 1, 'TEST');
  insert into public.tire_positions (config_id, axle_id, position_number, side)
  values (v_config_id, v_axle_id, 1, 'Izq');
  insert into public.units (id, company_id, plate, vehicle_type, config_id)
  values
    (v_unit_id, v_company_id, 'TEST-RPC-' || left(v_unit_id::text, 8), 'TEST BUS', v_config_id),
    (v_foreign_unit_id, v_other_company_id, 'TEST-RPC-OTHER-' || left(v_foreign_unit_id::text, 8), 'TEST BUS', v_config_id);
  insert into public.inspections (id, company_id, unit_id, inspected_on, odometer_km, inspector_id)
  values (v_foreign_inspection_id, v_other_company_id, v_foreign_unit_id, current_date - 1, 777, v_inspector_id);

  -- Supervisor puede emitir/cancelar; operario puede tomar/completar; inspector
  -- no recibe lectura de Movimientos. Todas las llamadas usan claims reales.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);
  perform public.create_tire_movement_order(
    v_order_id, v_unit_id, current_date, null,
    jsonb_build_array(jsonb_build_object('direction', 'exit', 'position', 1, 'reason', 'repair'))
  );
  begin
    perform public.claim_tire_movement_order(v_order_id);
    raise exception 'MOVEMENT ROLE: tire_supervisor tomó una orden';
  exception when insufficient_privilege then
    if sqlerrm not like '%no permite realizar esta acción%' then raise; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_operator_id, 'role', 'authenticated')::text, true);
  begin
    perform public.create_tire_movement_order(
      gen_random_uuid(), v_unit_id, current_date, null,
      jsonb_build_array(jsonb_build_object('direction', 'exit', 'position', 1, 'reason', 'repair'))
    );
    raise exception 'MOVEMENT ROLE: operator emitió una orden';
  exception when insufficient_privilege then
    if sqlerrm not like '%no permite realizar esta acción%' then raise; end if;
  end;
  begin
    perform public.cancel_tire_movement_order(v_order_id);
    raise exception 'MOVEMENT ROLE: operator canceló una orden';
  exception when insufficient_privilege then
    if sqlerrm not like '%no permite realizar esta acción%' then raise; end if;
  end;
  perform public.claim_tire_movement_order(v_order_id);
  perform public.complete_tire_movement_order(
    v_order_id, 100,
    jsonb_build_array(jsonb_build_object(
      'direction', 'exit', 'position', 1, 'reason', 'repair', 'condition', 'N', 'code', 'TEST-MOVE-1'
    ))
  );

  perform set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);
  perform public.create_tire_movement_order(
    v_cancel_order_id, v_unit_id, current_date, null,
    jsonb_build_array(jsonb_build_object('direction', 'exit', 'position', 1, 'reason', 'repair'))
  );
  perform public.cancel_tire_movement_order(v_cancel_order_id);
  execute 'reset role';

  insert into public.tire_movement_orders (id, company_id, unit_id, requested_by, status, scheduled_for)
  values (v_foreign_order_id, v_other_company_id, v_foreign_unit_id, v_other_supervisor_id, 'issued', current_date);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_inspector_id, 'role', 'authenticated')::text, true);
  select count(*) into v_visible_orders from public.tire_movement_orders;
  if v_visible_orders <> 0 then
    raise exception 'MOVEMENT RLS: inspector vio % órdenes', v_visible_orders;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_operator_id, 'role', 'authenticated')::text, true);
  select count(*) into v_visible_orders from public.tire_movement_orders;
  if v_visible_orders <> 2 then
    raise exception 'MOVEMENT RLS: operario vio % órdenes de su empresa; esperaba 2', v_visible_orders;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);
  select count(*) into v_visible_orders from public.tire_movement_orders;
  if v_visible_orders <> 2 then
    raise exception 'MOVEMENT RLS: supervisor vio % órdenes de su empresa; esperaba 2', v_visible_orders;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_other_supervisor_id, 'role', 'authenticated')::text, true);
  select count(*) into v_visible_orders from public.tire_movement_orders;
  if v_visible_orders <> 1 then
    raise exception 'MOVEMENT RLS: supervisor de otra empresa vio % órdenes; esperaba 1', v_visible_orders;
  end if;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);
  select id into v_saved_inspector_id from public.fn_require_workshop_profile();
  if v_saved_inspector_id is distinct from v_supervisor_id then
    raise exception 'ROLE: supervisor no conservó operaciones de taller';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_operator_id, 'role', 'authenticated')::text, true);
  begin
    perform public.fn_require_workshop_profile();
    raise exception 'WORKSHOP ROLE: operator obtuvo permisos de taller';
  exception when insufficient_privilege then
    if sqlerrm not like '%no permite registrar operaciones de taller%' then raise; end if;
  end;
  execute 'reset role';

  -- Un usuario autenticado sin perfil operativo no obtiene acceso.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    perform * from public.get_umbrales_rtd(v_company_name);
    raise exception 'PROFILE: permitió una sesión sin perfil';
  exception when insufficient_privilege then
    if sqlerrm not like '%perfil activo de inspector%' then raise; end if;
  end;

  -- Un operador con perfil activo tampoco puede usar las RPC reservadas al inspector.
  perform set_config('request.jwt.claims', json_build_object('sub', v_operator_id, 'role', 'authenticated')::text, true);
  begin
    perform * from public.get_umbrales_rtd(v_company_name);
    raise exception 'ROLE: permitió a operator usar la RPC de inspector';
  exception when insufficient_privilege then
    if sqlerrm not like '%perfil activo de inspector%' then raise; end if;
  end;

  -- La cuenta de supervisor (rol técnico `tire_supervisor`) tampoco usa las RPC de inspección.
  perform set_config('request.jwt.claims', json_build_object('sub', v_supervisor_id, 'role', 'authenticated')::text, true);
  begin
    perform * from public.get_umbrales_rtd(v_company_name);
    raise exception 'ROLE: permitió a tire_supervisor usar la RPC de inspector';
  exception when insufficient_privilege then
    if sqlerrm not like '%perfil activo de inspector%' then raise; end if;
  end;

  -- Un inspector válido puede consultar su propia empresa.
  perform set_config('request.jwt.claims', json_build_object('sub', v_inspector_id, 'role', 'authenticated')::text, true);
  perform * from public.get_umbrales_rtd(v_company_name);

  -- Inspector no puede consultar ni escribir bajo el nombre de otra empresa.
  begin
    perform * from public.get_unidad_preload('OTRA EMPRESA', 'TEST-1');
    raise exception 'TENANT: preload aceptó otra empresa';
  exception when insufficient_privilege then
    if sqlerrm not like '%no coincide con la sesión%' then raise; end if;
  end;

  begin
    perform * from public.get_umbrales_rtd('OTRA EMPRESA');
    raise exception 'TENANT: umbrales aceptó otra empresa';
  exception when insufficient_privilege then
    if sqlerrm not like '%no coincide con la sesión%' then raise; end if;
  end;

  v_payload := jsonb_build_object(
    'company_name', 'OTRA EMPRESA',
    'captured_by_user_id', v_inspector_id,
    'plate_number', 'TEST-RPC',
    'inspection_date', current_date,
    'odometer_km', 1000,
    'items', '[]'::jsonb
  );
  begin
    perform public.save_inspection(v_payload);
    raise exception 'TENANT: save_inspection aceptó otra empresa';
  exception when insufficient_privilege then
    if sqlerrm not like '%no coincide con la sesión%' then raise; end if;
  end;

  -- Una nueva inspección queda atribuida al inspector autenticado.
  v_saved_plate := 'TEST-AUTH-' || left(v_unit_id::text, 8);
  v_payload := jsonb_build_object(
    'company_name', v_company_name,
    'captured_by_user_id', v_inspector_id,
    'plate_number', v_saved_plate,
    'configuration', 'TEST-RPC-' || left(v_config_id::text, 8),
    'vehicle_type', 'TEST BUS',
    'inspection_date', current_date,
    'odometer_km', 4321,
    'items', '[]'::jsonb
  );
  perform public.save_inspection(v_payload);
  select i.inspector_id into v_saved_inspector_id
    from public.inspections i
    join public.units u on u.id = i.unit_id
   where u.company_id = v_company_id and u.plate = v_saved_plate
     and i.inspected_on = current_date;
  if v_saved_inspector_id is distinct from v_inspector_id then
    raise exception 'AUDIT: save_inspection no atribuyó la inspección al usuario';
  end if;

  -- Un payload no puede atribuirse a otra cuenta autenticada.
  v_payload := jsonb_build_object(
    'company_name', v_company_name,
    'captured_by_user_id', v_operator_id,
    'plate_number', 'TEST-AUTH-MISMATCH',
    'inspection_date', current_date,
    'odometer_km', 1200,
    'items', '[]'::jsonb
  );
  begin
    perform public.save_inspection(v_payload);
    raise exception 'ACTOR: save_inspection aceptó otra identidad de captura';
  exception when insufficient_privilege then
    if sqlerrm not like '%pertenece a otra sesión%' then raise; end if;
  end;

  -- El UUID local también queda limitado al tenant y a la unidad/fecha originales.
  v_payload := jsonb_build_object(
    'company_name', v_company_name,
    'captured_by_user_id', v_inspector_id,
    'plate_number', 'TEST-RPC-' || left(v_unit_id::text, 8),
    'inspection_date', current_date,
    'odometer_km', 12345,
    'local_id', v_foreign_inspection_id,
    'items', '[]'::jsonb
  );
  begin
    perform public.save_inspection(v_payload);
    raise exception 'LOCAL_ID: save_inspection aceptó un UUID de otra empresa';
  exception when insufficient_privilege then
    if sqlerrm not like '%no pertenece a esta unidad y empresa%' then raise; end if;
  end;

  select odometer_km into v_odometer from public.inspections where id = v_foreign_inspection_id;
  if v_odometer <> 777 then
    raise exception 'LOCAL_ID: modificó una inspección de otra empresa';
  end if;

  raise notice 'TESTS_PASSED';
end;
$$;

rollback;
