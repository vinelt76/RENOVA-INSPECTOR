-- RENOVA — Pruebas de la vista de servicios de neumáticos.
--
-- Un único DO autorreversible cubre S1–S9. El resultado correcto es
-- ERROR P0001 TESTS_PASSED; la excepción final revierte todos los fixtures.
-- Todos los UUID y textos son sintéticos y estables para facilitar diagnóstico.

do $$
declare
  v_company_a constant uuid := '72000000-0000-4000-8000-000000000001';
  v_company_b constant uuid := '72000000-0000-4000-8000-000000000002';
  v_profile_a constant uuid := '72000000-0000-4000-8000-000000000011';
  v_profile_b constant uuid := '72000000-0000-4000-8000-000000000012';
  v_config constant uuid := '72000000-0000-4000-8000-000000000021';
  v_unit_a constant uuid := '72000000-0000-4000-8000-000000000031';
  v_unit_b constant uuid := '72000000-0000-4000-8000-000000000032';
  v_order_s1 constant uuid := '72000000-0000-4000-8000-000000000101';
  v_order_s3 constant uuid := '72000000-0000-4000-8000-000000000103';
  v_order_s4 constant uuid := '72000000-0000-4000-8000-000000000104';
  v_order_s5 constant uuid := '72000000-0000-4000-8000-000000000105';
  v_order_s6 constant uuid := '72000000-0000-4000-8000-000000000106';
  v_order_s7 constant uuid := '72000000-0000-4000-8000-000000000107';
  v_order_b constant uuid := '72000000-0000-4000-8000-000000000108';
  v_count integer;
  v_count_2 integer;
  v_count_3 integer;
  v_pairing text;
  v_pair_position smallint;
begin
  if to_regclass('public.v_tire_services') is null then
    raise exception 'PRECONDICION: falta public.v_tire_services (task_02)';
  end if;

  insert into public.companies (id, name, legacy_code)
  values
    (v_company_a, 'TEST-SERVICIOS-A', 'test-servicios-a'),
    (v_company_b, 'TEST-SERVICIOS-B', 'test-servicios-b');

  insert into auth.users (
    id, aud, role, email, raw_app_meta_data, raw_user_meta_data
  ) values
    (v_profile_a, 'authenticated', 'authenticated',
      'test-servicios-a@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_profile_b, 'authenticated', 'authenticated',
      'test-servicios-b@invalid.example', '{}'::jsonb, '{}'::jsonb);

  insert into public.profiles (id, company_id, full_name, role)
  values
    (v_profile_a, v_company_a, 'TEST-SERVICIOS Operador A', 'operator'),
    (v_profile_b, v_company_b, 'TEST-SERVICIOS Operador B', 'operator');

  insert into public.vehicle_configs (id, vehicle_type, notation, is_mvp)
  values (v_config, 'TEST-SERVICIOS', 'TEST-SERVICIOS-2-4', false);

  insert into public.units (id, company_id, plate, vehicle_type, config_id)
  values
    (v_unit_a, v_company_a, 'TEST-SERVICIOS-A', 'TEST-SERVICIOS', v_config),
    (v_unit_b, v_company_b, 'TEST-SERVICIOS-B', 'TEST-SERVICIOS', v_config);

  -- La forma de request_items replica addRotation: salida rotation seguida
  -- inmediatamente por el ingreso destino, con position y reason textuales.
  insert into public.tire_movement_orders (
    id, company_id, unit_id, requested_by, assigned_to, status,
    request_items, completed_at, odometer_km
  ) values
    (v_order_s1, v_company_a, v_unit_a, v_profile_a, v_profile_a, 'completed',
      '[{"direction":"exit","position":3,"reason":"rotation","notes":"P3 a P7"},{"direction":"entry","position":7,"notes":"Destino de P3"}]'::jsonb,
      now(), 100001),
    (v_order_s3, v_company_a, v_unit_a, v_profile_a, v_profile_a, 'completed',
      '[{"direction":"entry","position":8,"notes":"Ingreso independiente"}]'::jsonb,
      now(), 100002),
    (v_order_s4, v_company_a, v_unit_a, v_profile_a, v_profile_a, 'completed',
      '[{"direction":"exit","position":1,"reason":"discard","notes":"Desecho"},{"direction":"entry","position":1,"notes":"Reposición"},{"direction":"exit","position":3,"reason":"rotation","notes":"P3 a P5"},{"direction":"entry","position":5,"notes":"Destino de P3"}]'::jsonb,
      now(), 100003),
    -- S5: request_items conserva la forma correcta, pero las ejecuciones se
    -- insertan en orden inverso para simular un cliente futuro desalineado.
    (v_order_s5, v_company_a, v_unit_a, v_profile_a, v_profile_a, 'completed',
      '[{"direction":"exit","position":2,"reason":"rotation","notes":"P2 a P4"},{"direction":"entry","position":4,"notes":"Destino de P2"}]'::jsonb,
      now(), 100004),
    (v_order_s6, v_company_a, v_unit_a, v_profile_a, v_profile_a, 'completed',
      '[]'::jsonb, now(), 100005),
    (v_order_s7, v_company_a, v_unit_a, v_profile_a, v_profile_a, 'completed',
      '[{"direction":"exit","position":9,"reason":"repair"},{"direction":"exit","position":10,"reason":"balancing"}]'::jsonb,
      now(), 100006),
    (v_order_b, v_company_b, v_unit_b, v_profile_b, v_profile_b, 'completed',
      '[{"direction":"entry","position":1,"notes":"Control positivo RLS B"}]'::jsonb,
      now(), 200001);

  insert into public.tire_movement_executions (
    id, order_id, company_id, sequence, direction, position_number,
    movement_reason, casing_code, code_unreadable, brand_name, size_name,
    design_name, rtd_min_mm, condition, retread_design, observations,
    captured_by, captured_at
  ) values
    ('72000000-0000-4000-8000-000000001011', v_order_s1, v_company_a,
      1, 'exit', 3, 'rotation', 'TEST-SERV-S1-OUT', false, 'GOODYEAR',
      '295/80R22.5', 'KMAX', 8.20, 'N', null, 'S1 salida', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001012', v_order_s1, v_company_a,
      2, 'entry', 7, null, 'TEST-SERV-S1-IN', false, 'GOODYEAR',
      '295/80R22.5', 'KMAX', 7.90, 'N', null, 'S1 ingreso', v_profile_a, now()),

    ('72000000-0000-4000-8000-000000001031', v_order_s3, v_company_a,
      1, 'entry', 8, null, 'TEST-SERV-S3-IN', false, 'MICHELIN',
      '295/80R22.5', 'X MULTI', 12.00, 'N', null, 'S3', v_profile_a, now()),

    ('72000000-0000-4000-8000-000000001041', v_order_s4, v_company_a,
      1, 'exit', 1, 'discard', 'TEST-SERV-S4-DISCARD', false, 'PIRELLI',
      '295/80R22.5', 'FG01', 1.00, 'R1', 'R1 TEST', 'S4 descarte', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001042', v_order_s4, v_company_a,
      2, 'entry', 1, null, 'TEST-SERV-S4-INSTALL', false, 'PIRELLI',
      '295/80R22.5', 'FG01', 15.00, 'N', null, 'S4 instalación', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001043', v_order_s4, v_company_a,
      3, 'exit', 3, 'rotation', 'TEST-SERV-S4-ROT-OUT', false, 'PIRELLI',
      '295/80R22.5', 'FG01', 9.00, 'R1', 'R1 TEST', 'S4 rotación', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001044', v_order_s4, v_company_a,
      4, 'entry', 5, null, 'TEST-SERV-S4-ROT-IN', false, 'PIRELLI',
      '295/80R22.5', 'FG01', 8.80, 'R1', 'R1 TEST', 'S4 destino', v_profile_a, now()),

    ('72000000-0000-4000-8000-000000001051', v_order_s5, v_company_a,
      1, 'entry', 4, null, 'TEST-SERV-S5-IN', false, 'CONTINENTAL',
      '295/80R22.5', 'HDR2', 10.00, 'N', null, 'S5 ingreso primero', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001052', v_order_s5, v_company_a,
      2, 'exit', 2, 'rotation', 'TEST-SERV-S5-OUT', false, 'CONTINENTAL',
      '295/80R22.5', 'HDR2', 9.50, 'N', null, 'S5 salida después', v_profile_a, now()),

    ('72000000-0000-4000-8000-000000001061', v_order_s6, v_company_a,
      1, 'entry', 11, null, 'TEST-SERV-S6-IN-1', false, 'HANKOOK',
      '295/80R22.5', 'AH31', 11.00, 'N', null, 'S6 ingreso 1', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001062', v_order_s6, v_company_a,
      2, 'entry', 12, null, 'TEST-SERV-S6-IN-2', false, 'HANKOOK',
      '295/80R22.5', 'AH31', 10.80, 'N', null, 'S6 ingreso 2', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001063', v_order_s6, v_company_a,
      3, 'exit', 13, 'rotation', 'TEST-SERV-S6-OUT', false, 'HANKOOK',
      '295/80R22.5', 'AH31', 10.50, 'N', null, 'S6 salida', v_profile_a, now()),

    ('72000000-0000-4000-8000-000000001071', v_order_s7, v_company_a,
      1, 'exit', 9, 'repair', 'TEST-SERV-S7-A', false, 'goodyear',
      '295/80R22.5', 'KMAX', 7.00, 'N', null, 'S7 A', v_profile_a, now()),
    ('72000000-0000-4000-8000-000000001072', v_order_s7, v_company_a,
      2, 'exit', 10, 'balancing', 'TEST-SERV-S8-NOT-REGISTERED', false,
      'GOODYEAR ', '295/80R22.5', 'KMAX', 7.10, 'N', null, 'S7 B / S8', v_profile_a, now());

  insert into public.tire_movement_executions (
    id, order_id, company_id, sequence, direction, position_number,
    movement_reason, casing_code, code_unreadable, brand_name, size_name,
    design_name, rtd_min_mm, condition, retread_design, observations,
    captured_by, captured_at
  ) values (
    '72000000-0000-4000-8000-000000001081', v_order_b, v_company_b,
    1, 'entry', 1, null, 'TEST-SERV-B-IN', false, 'TEST BRAND B',
    '295/80R22.5', 'TEST B', 12.00, 'N', null, 'S9 control B', v_profile_b, now()
  );

  -- S1: rotación alineada, una sola fila y destino exacto P7.
  select count(*), max(pair_position_number), max(rotation_pairing)
    into v_count, v_pair_position, v_pairing
    from public.v_tire_services
   where order_id = v_order_s1 and service_type = 'rotation';
  if v_count <> 1 or v_pair_position <> 7 or v_pairing <> 'exact' then
    raise exception 'S1: esperaba rotation P7 exact; obtuvo count=%, pair=%, pairing=%',
      v_count, v_pair_position, v_pairing;
  end if;

  -- S2: el ingreso de la rotación exacta no reaparece como instalación.
  select count(*) into v_count from public.v_tire_services
   where order_id = v_order_s1 and service_type = 'installation';
  if v_count <> 0 then
    raise exception 'S2: esperaba 0 instalaciones y obtuvo %', v_count;
  end if;

  -- S3: un ingreso independiente es instalación no aplicable a pareo.
  select count(*), max(rotation_pairing) into v_count, v_pairing
    from public.v_tire_services
   where order_id = v_order_s3 and service_type = 'installation';
  if v_count <> 1 or v_pairing <> 'not_applicable' then
    raise exception 'S3: esperaba 1 installation/not_applicable; obtuvo %/%',
      v_count, v_pairing;
  end if;

  -- S4: descarte + instalación + rotación, sin cuarta fila.
  select count(*) into v_count from public.v_tire_services where order_id = v_order_s4;
  select count(distinct service_type) into v_count_2
    from public.v_tire_services
   where order_id = v_order_s4
     and service_type in ('discard', 'installation', 'rotation');
  if v_count <> 3 or v_count_2 <> 3 then
    raise exception 'S4: esperaba 3 filas/tipos y obtuvo filas=%, tipos=%', v_count, v_count_2;
  end if;

  -- S5: desalineación. El total sigue cuadrando y declara inferencia.
  select count(*) filter (where service_type = 'rotation'),
         count(*) filter (where service_type = 'installation')
    into v_count, v_count_2
    from public.v_tire_services where order_id = v_order_s5;
  if v_count <> (select count(*) from public.tire_movement_executions
                  where order_id = v_order_s5 and direction = 'exit'
                    and movement_reason = 'rotation')
     or v_count_2 <> ((select count(*) from public.tire_movement_executions
                       where order_id = v_order_s5 and direction = 'entry') - v_count)
     or not exists (select 1 from public.v_tire_services
                     where order_id = v_order_s5 and rotation_pairing = 'inferred') then
    raise exception 'S5: invariante degradada falló; rotation=%, installation=%',
      v_count, v_count_2;
  end if;

  -- S6: dos ingresos y una salida de rotación solo permiten un cierre.
  select count(*) filter (where service_type = 'installation'),
         count(*) filter (where service_type = 'rotation')
    into v_count, v_count_2
    from public.v_tire_services where order_id = v_order_s6;
  if v_count <> 1 or v_count_2 <> 1
     or (select count(*) from public.tire_movement_executions
          where order_id = v_order_s6 and direction = 'entry') - v_count > v_count_2 then
    raise exception 'S6: esperaba 1 instalación y 1 cierre máximo; obtuvo %/%',
      v_count, v_count_2;
  end if;

  -- S7: las dos grafías producen una sola clave de marca.
  select count(*), count(distinct brand_name), count(distinct brand_key)
    into v_count, v_count_2, v_count_3
    from public.v_tire_services where order_id = v_order_s7;
  if v_count <> 2 or v_count_2 <> 2 or v_count_3 <> 1 then
    raise exception 'S7: esperaba 2 filas/2 grafías/1 clave y obtuvo %/%/%',
      v_count, v_count_2, v_count_3;
  end if;

  -- S8: código no registrado conserva la fila y niega el enlace.
  select count(*) into v_count
    from public.v_tire_services
   where service_id = '72000000-0000-4000-8000-000000001072'
     and casing_code = 'TEST-SERV-S8-NOT-REGISTERED'
     and casing_exists is false;
  if v_count <> 1 then
    raise exception 'S8: la fila no registrada faltó o casing_exists no fue false';
  end if;

  -- S9: como operario B, RLS no deja ver ninguna fila de la empresa A.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_b, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) filter (where company_id = v_company_a),
         count(*) filter (where company_id = v_company_b)
    into v_count, v_count_2
    from public.v_tire_services;
  if v_count <> 0 or v_count_2 <> 1 then
    raise exception 'S9: empresa B esperaba A=0/B=1 y obtuvo A=%/B=%',
      v_count, v_count_2;
  end if;

  execute 'reset role';
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_a, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into v_count
    from public.v_tire_services where company_id = v_company_a;
  select count(*) into v_count_2
    from public.v_tire_services where company_id = v_company_b;
  if v_count = 0 or v_count_2 <> 0 then
    raise exception 'S9: empresa A esperaba propias>0/B=0 y obtuvo A=%/B=%',
      v_count, v_count_2;
  end if;

  raise exception 'TESTS_PASSED';
end;
$$;
