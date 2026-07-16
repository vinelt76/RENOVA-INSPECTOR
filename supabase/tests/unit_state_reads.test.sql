-- RENOVA — Pruebas de lectura de estado por posición e inventario/retén.
--
-- Se ejecuta como un solo DO block. El error TESTS_PASSED del final revierte
-- todos los datos creados por las RPCs y los INSERT de setup.

do $$
declare
  v_profile_a       public.profiles%rowtype;
  v_profile_b       public.profiles%rowtype;
  v_unit            public.units%rowtype;
  v_position        smallint;
  v_position_count  integer;
  v_count           integer;
  v_result          jsonb;
  v_retained_cycle  uuid;
  v_retained_code   text;
  v_discarded_cycle uuid;
  v_inspection_id   uuid := gen_random_uuid();
  v_measurement_id  uuid := gen_random_uuid();
  v_inspection_code text := 'LEGACY-' || upper(substr(gen_random_uuid()::text, 1, 8));
begin
  -- Dos tenants reales cualesquiera; A necesita un perfil de taller y una
  -- unidad con al menos una posición libre. No se fijan empresas ni layouts.
  select p.*
    into v_profile_a
    from public.profiles p
   where p.active
     and p.role in ('workshop_manager', 'fleet_manager', 'admin')
     and exists (
       select 1
         from public.units u
         join public.tire_positions tp on tp.config_id = u.config_id
        where u.company_id = p.company_id
          and not exists (
            select 1
              from public.tire_installations ti
             where ti.unit_id = u.id
               and ti.position_number = tp.position_number
               and not ti.removed
          )
     )
   order by p.company_id, p.id
   limit 1;

  select p.*
    into v_profile_b
    from public.profiles p
   where p.active
     and p.company_id <> v_profile_a.company_id
   order by p.company_id, p.id
   limit 1;

  if v_profile_a.id is null or v_profile_b.id is null then
    raise exception 'SETUP: se necesitan perfiles activos de dos empresas y un operador de taller';
  end if;

  select u.*
    into v_unit
    from public.units u
   where u.company_id = v_profile_a.company_id
     and exists (
       select 1
         from public.tire_positions tp
        where tp.config_id = u.config_id
          and not exists (
            select 1
              from public.tire_installations ti
             where ti.unit_id = u.id
               and ti.position_number = tp.position_number
               and not ti.removed
          )
     )
   order by u.id
   limit 1;

  select tp.position_number
    into v_position
    from public.tire_positions tp
   where tp.config_id = v_unit.config_id
     and not exists (
       select 1
         from public.tire_installations ti
        where ti.unit_id = v_unit.id
          and ti.position_number = tp.position_number
          and not ti.removed
     )
   order by tp.position_number
   limit 1;

  select count(*)
    into v_position_count
    from public.tire_positions tp
   where tp.config_id = v_unit.config_id;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_a.id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- T1: la vista conserva exactamente todas las posiciones configuradas.
  select count(*)
    into v_count
    from public.v_unit_position_state s
   where s.unit_id = v_unit.id;
  if v_count <> v_position_count then
    raise exception 'T1: esperaba % posiciones y obtuvo %', v_position_count, v_count;
  end if;

  -- T2: una instalación nueva ocupa la posición y expone el código del casco.
  v_retained_code := 'TEST-STATE-' || upper(substr(gen_random_uuid()::text, 1, 8));
  v_result := public.register_full_installation(
    v_retained_code, 'TEST BRAND', 'TEST MODEL', 'TEST SIZE', 'N',
    v_unit.id, v_position, current_date - 10,
    null, 17.0, null, 'PEN', 100000, 17.0, 'unit_state_reads T2'
  );
  v_retained_cycle := (v_result->>'life_cycle_id')::uuid;

  select count(*)
    into v_count
    from public.v_unit_position_state s
   where s.unit_id = v_unit.id
     and s.position_number = v_position
     and not s.is_empty
     and s.life_cycle_id = v_retained_cycle
     and s.casing_code = v_retained_code;
  if v_count <> 1 then
    raise exception 'T2: la instalación no se refleja correctamente en la vista';
  end if;

  -- T3: retiro a retén libera la posición y aparece inmediatamente en inventario.
  perform public.register_removal(
    v_retained_cycle, current_date - 5, 'retention', 101000, 14.8,
    null, null, 'unit_state_reads T3'
  );

  select count(*)
    into v_count
    from public.v_unit_position_state s
   where s.unit_id = v_unit.id
     and s.position_number = v_position
     and s.is_empty;
  if v_count <> 1 then
    raise exception 'T3: la posición no quedó vacía tras el retiro';
  end if;

  select count(*)
    into v_count
    from public.v_tire_inventory_available inv
   where inv.life_cycle_id = v_retained_cycle
     and inv.last_removal_reason = 'retention'
     and inv.last_rtd_mm = 14.8;
  if v_count <> 1 then
    raise exception 'T3: el ciclo retirado no aparece correctamente en retén';
  end if;

  -- T4: un descarte cierra ciclo/casco y nunca se ofrece como disponible.
  v_result := public.register_full_installation(
    'TEST-DISCARD-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    'TEST BRAND', 'TEST MODEL', 'TEST SIZE', 'N',
    v_unit.id, v_position, current_date - 4,
    null, 17.0, null, 'PEN', 102000, 17.0, 'unit_state_reads T4'
  );
  v_discarded_cycle := (v_result->>'life_cycle_id')::uuid;
  perform public.register_removal(
    v_discarded_cycle, current_date - 3, 'discard', 103000, 2.0,
    'Corte profundo en flanco', 'https://example.com/unit-state-test.jpg', 'unit_state_reads T4'
  );

  select count(*)
    into v_count
    from public.v_tire_inventory_available inv
   where inv.life_cycle_id = v_discarded_cycle;
  if v_count <> 0 then
    raise exception 'T4: un ciclo descartado aparece en inventario disponible';
  end if;

  -- T5: al cambiar el JWT, ninguna fila del tenant A atraviesa RLS.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_b.id, 'role', 'authenticated')::text,
    true
  );

  select count(*)
    into v_count
    from public.v_unit_position_state s
   where s.company_id = v_profile_a.company_id;
  if v_count <> 0 then
    raise exception 'T5: la vista de posiciones filtró % filas de otra empresa', v_count;
  end if;

  select count(*)
    into v_count
    from public.v_tire_inventory_available inv
   where inv.company_id = v_profile_a.company_id;
  if v_count <> 0 then
    raise exception 'T5: la vista de inventario filtró % filas de otra empresa', v_count;
  end if;

  -- T6 requiere una medición legada sin instalación. El setup se inserta
  -- como postgres y luego la lectura vuelve a ejecutarse como authenticated.
  execute 'reset role';
  insert into public.inspections (
    id, company_id, unit_id, inspected_on, odometer_km
  ) values (
    v_inspection_id, v_profile_a.company_id, v_unit.id, current_date + 1000, 104000
  );
  insert into public.inspection_measurements (
    id, company_id, inspection_id, position_number, tire_code,
    rtd_movi_mm, pressure_psi
  ) values (
    v_measurement_id, v_profile_a.company_id, v_inspection_id, v_position,
    v_inspection_code, 9.5, 110.0
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_a.id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select count(*)
    into v_count
    from public.v_unit_position_state s
   where s.unit_id = v_unit.id
     and s.position_number = v_position
     and s.is_empty
     and s.last_inspection_tire_code = v_inspection_code
     and not s.code_mismatch;
  if v_count <> 1 then
    raise exception 'T6: la medición legada de una posición vacía no quedó visible';
  end if;

  -- Permisos del contrato: SELECT autenticado y ninguna lectura heredada por anon.
  if not has_table_privilege('authenticated', 'public.v_unit_position_state', 'select')
     or not has_table_privilege('authenticated', 'public.v_tire_inventory_available', 'select') then
    raise exception 'GRANTS: authenticated no tiene SELECT en ambas vistas';
  end if;
  if has_table_privilege('anon', 'public.v_unit_position_state', 'select')
     or has_table_privilege('anon', 'public.v_tire_inventory_available', 'select') then
    raise exception 'GRANTS: anon puede leer una vista protegida';
  end if;

  raise exception 'TESTS_PASSED';
end;
$$;
