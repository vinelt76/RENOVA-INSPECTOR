-- RENOVA — Pruebas de procedencia, primer montaje y gate de línea base.
--
-- Este archivo es un único DO auto-reversible: el resultado correcto es
-- ERROR P0001 TESTS_PASSED. Cualquier otro error identifica el caso fallido.
-- Todos los fixtures son sintéticos (placas TEST-BASELINE-*).
--
-- D2 (DECISIONES.md): baseline_pending depende de que exista una medición en
-- una posición vacía, incluso si tire_code es NULL. Por eso T3 afirma TRUE
-- también para evidencia sin código; el texto anterior de task_05 decía FALSE
-- y quedó superado por la decisión aprobada y PLAN.md.
--
-- Limitación honesta: un DO usa un solo backend. Las carreras entre dos
-- backends no se simulan aquí; las cubren los locks y los índices únicos.

do $$
declare
  v_company uuid := gen_random_uuid();
  v_other_company uuid := gen_random_uuid();
  v_workshop uuid := gen_random_uuid();
  v_inspector uuid := gen_random_uuid();
  v_other_workshop uuid := gen_random_uuid();
  v_config uuid := gen_random_uuid();
  v_axle uuid := gen_random_uuid();
  v_unit uuid := gen_random_uuid();
  v_other_unit uuid := gen_random_uuid();
  v_old_inspection uuid := gen_random_uuid();
  v_latest_inspection uuid := gen_random_uuid();
  v_other_inspection uuid := gen_random_uuid();
  v_m uuid[] := array_fill(null::uuid, array[24]);
  v_result jsonb;
  v_t1_cycle uuid;
  v_t1_casing uuid;
  v_baseline_cycle uuid;
  v_retained_cycle uuid;
  v_gate_cycle uuid;
  v_normal_cycle uuid;
  v_pos13_cycle uuid;
  v_pos14_cycle uuid;
  v_direct_casing uuid := gen_random_uuid();
  v_direct_cycle uuid := gen_random_uuid();
  v_batch_t5 uuid := gen_random_uuid();
  v_before integer;
  v_after integer;
  v_count integer;
  v_state record;
  v_sqlstate text;
  v_message text;
begin
  -- Precondiciones: fallar con diagnóstico legible si task_03/task_04 faltan.
  if to_regtype('public.record_origin') is null then
    raise exception 'PRECONDICION: falta public.record_origin (task_03)';
  end if;
  if to_regprocedure('public.confirm_baseline_mount(jsonb)') is null then
    raise exception 'PRECONDICION: falta confirm_baseline_mount(jsonb) (task_04)';
  end if;
  if to_regprocedure('public.confirm_tire_change_batch(jsonb)') is null then
    raise exception 'PRECONDICION: falta confirm_tire_change_batch(jsonb)';
  end if;
  if to_regclass('public.baseline_mount_batches') is null then
    raise exception 'PRECONDICION: falta baseline_mount_batches (task_04)';
  end if;

  -- Fixture enteramente sintético.
  insert into public.companies (id, name, legacy_code)
  values
    (v_company, 'TEST BASELINE ' || left(v_company::text, 8), 'test-baseline-' || left(v_company::text, 8)),
    (v_other_company, 'TEST BASELINE OTHER ' || left(v_other_company::text, 8), 'test-baseline-other-' || left(v_other_company::text, 8));

  -- El remoto productivo ya aplica profiles.id -> auth.users.id. Estos tres
  -- usuarios mínimos también viven dentro del DO y se revierten con él.
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values
    (v_workshop, 'authenticated', 'authenticated',
      'test-workshop-' || left(v_workshop::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_inspector, 'authenticated', 'authenticated',
      'test-inspector-' || left(v_inspector::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb),
    (v_other_workshop, 'authenticated', 'authenticated',
      'test-other-' || left(v_other_workshop::text, 8) || '@invalid.example', '{}'::jsonb, '{}'::jsonb);

  insert into public.profiles (id, company_id, full_name, role)
  values
    (v_workshop, v_company, 'TEST Workshop', 'workshop_manager'),
    (v_inspector, v_company, 'TEST Inspector', 'inspector'),
    (v_other_workshop, v_other_company, 'TEST Other Workshop', 'workshop_manager');

  insert into public.vehicle_configs (id, vehicle_type, notation, is_mvp)
  values (v_config, 'TEST BUS', 'TEST-' || left(v_config::text, 8), false);
  insert into public.axles (id, config_id, axle_number, axle_type)
  values (v_axle, v_config, 1, 'TEST');
  insert into public.tire_positions (config_id, axle_id, position_number, side)
  select v_config, v_axle, n::smallint, case when n % 2 = 0 then 'Der' else 'Izq' end
    from generate_series(1, 24) n;
  insert into public.units (id, company_id, plate, vehicle_type, config_id)
  values
    (v_unit, v_company, 'TEST-BASELINE-' || left(v_unit::text, 8), 'TEST BUS', v_config),
    (v_other_unit, v_other_company, 'TEST-BASELINE-OTHER-' || left(v_other_unit::text, 8), 'TEST BUS', v_config);

  insert into public.inspections (id, company_id, unit_id, inspected_on, odometer_km, inspector_id)
  values
    (v_old_inspection, v_company, v_unit, current_date - 40, 90000, v_inspector),
    (v_latest_inspection, v_company, v_unit, current_date - 10, 95000, v_inspector),
    (v_other_inspection, v_other_company, v_other_unit, current_date - 9, 50000, v_other_workshop);

  insert into public.inspection_measurements (
    id, company_id, inspection_id, position_number, tire_code, brand_name,
    model_name, size_name, condition, rtd_movi_mm, pressure_psi
  ) values (
    gen_random_uuid(), v_company, v_old_inspection, 1, 'OLD-CODE', 'OLD BRAND',
    'OLD MODEL', 'OLD SIZE', 'R1', 3.0, 80
  );

  for i in 1..13 loop
    v_m[i] := gen_random_uuid();
    insert into public.inspection_measurements (
      id, company_id, inspection_id, position_number, tire_code, brand_name,
      model_name, size_name, condition, retread_design, rtd_movi_mm, pressure_psi
    ) values (
      v_m[i], v_company, v_latest_inspection, i,
      case when i = 2 then null else 'EVID-' || lpad(i::text, 2, '0') end,
      case when i = 1 then 'LATEST BRAND' else 'TEST BRAND' end,
      case when i = 1 then 'LATEST MODEL' else 'TEST MODEL' end,
      case when i = 1 then '315/80R22.5' else '295/80R22.5' end,
      case when i = 1 then 'R1' else 'N' end,
      case when i = 1 then 'TEST DESIGN' else null end,
      case when i = 1 then 8.5 else 12.0 end,
      100
    );
  end loop;
  v_m[24] := gen_random_uuid();
  insert into public.inspection_measurements (
    id, company_id, inspection_id, position_number, tire_code, brand_name,
    model_name, size_name, condition, rtd_movi_mm
  ) values (v_m[24], v_company, v_latest_inspection, 24, 'WORKSHOP-24',
            'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N', 15.0);
  insert into public.inspection_measurements (
    id, company_id, inspection_id, position_number, tire_code, condition, rtd_movi_mm
  ) values (gen_random_uuid(), v_other_company, v_other_inspection, 1, 'OTHER-01', 'N', 10.0);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_workshop, 'role', 'authenticated')::text, true);

  -- T1: el alta normal conserva procedencia workshop y fuente NULL.
  v_result := public.register_full_installation(
    'WORKSHOP-24', 'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N',
    v_unit, 24::smallint, current_date - 20, null, 17, null, 'PEN', 94000, 16, 'T1'
  );
  v_t1_cycle := (v_result->>'life_cycle_id')::uuid;
  v_t1_casing := (v_result->>'casing_id')::uuid;
  select count(*) into v_count
    from public.tire_casings c
    join public.tire_life_cycles lc on lc.casing_id = c.id
    join public.tire_installations ti on ti.life_cycle_id = lc.id
   where c.id = v_t1_casing and c.origin = 'workshop' and lc.origin = 'workshop'
     and ti.origin = 'workshop' and ti.source_measurement_id is null;
  if v_count <> 1 then
    raise exception 'T1: esperaba casco/ciclo/instalación workshop y fuente NULL; obtuvo % filas', v_count;
  end if;

  -- T2: una instalación baseline nunca puede carecer de medición fuente.
  insert into public.tire_casings (id, company_id, code, origin)
  values (v_direct_casing, v_company, 'DIRECT-CHECK', 'baseline');
  insert into public.tire_life_cycles (
    id, company_id, casing_id, cycle_number, condition, started_at, origin
  ) values (v_direct_cycle, v_company, v_direct_casing, 0, 'N', current_date - 5, 'baseline');
  begin
    insert into public.tire_installations (
      company_id, life_cycle_id, unit_id, position_number, installed_at,
      installed_by, origin, source_measurement_id
    ) values (v_company, v_direct_cycle, v_unit, 20, current_date - 5,
              v_workshop, 'baseline', null);
    raise exception 'T2_ACCEPTED';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_message = message_text;
    if v_message = 'T2_ACCEPTED' then
      raise exception 'T2: aceptó origin=baseline con source_measurement_id NULL';
    end if;
    if v_sqlstate <> '23514' then
      raise exception 'T2: esperaba check_violation 23514 y obtuvo %: %', v_sqlstate, v_message;
    end if;
  end;

  -- T3: evidencia con o sin código queda pendiente; una posición ocupada no.
  select * into v_state from public.v_unit_position_state
   where unit_id = v_unit and position_number = 1;
  if v_state.baseline_pending is not true then
    raise exception 'T3: P1 con código debía quedar baseline_pending=true y obtuvo %', v_state.baseline_pending;
  end if;
  select * into v_state from public.v_unit_position_state
   where unit_id = v_unit and position_number = 2;
  if v_state.baseline_pending is not true then
    raise exception 'T3: P2 con medición sin código debía quedar baseline_pending=true por D2 y obtuvo %', v_state.baseline_pending;
  end if;
  select * into v_state from public.v_unit_position_state
   where unit_id = v_unit and position_number = 24;
  if v_state.baseline_pending is not false then
    raise exception 'T3: P24 ocupada debía quedar baseline_pending=false y obtuvo %', v_state.baseline_pending;
  end if;

  -- T4: last_* proviene de la inspección más reciente.
  select * into v_state from public.v_unit_position_state
   where unit_id = v_unit and position_number = 1;
  if v_state.last_inspection_tire_code <> 'EVID-01'
     or v_state.last_brand_name <> 'LATEST BRAND'
     or v_state.last_model_name <> 'LATEST MODEL'
     or v_state.last_size_name <> '315/80R22.5'
     or v_state.last_condition <> 'R1'
     or v_state.last_rtd_movi_mm <> 8.5
     or v_state.last_odometer_km <> 95000
     or v_state.last_inspected_on <> current_date - 10 then
    raise exception 'T4: evidencia latest incorrecta: %', row_to_json(v_state);
  end if;

  -- T5/T17: primer montaje por código crea las 3 entidades baseline, enlaza
  -- la medición y no aumenta el inventario disponible.
  select count(*) into v_before from public.v_tire_inventory_available
   where company_id = v_company;
  v_result := public.confirm_baseline_mount(jsonb_build_object(
    'batch_version', 1, 'batch_id', v_batch_t5, 'unit_id', v_unit,
    'performed_at', current_date - 8, 'odometer', 95100,
    'mounts', jsonb_build_array(jsonb_build_object(
      'seq', 1, 'position', 1, 'source_measurement_id', v_m[1],
      'casing_code', 'BASE-001', 'brand_name', 'LATEST BRAND',
      'model_name', 'LATEST MODEL', 'size_name', '315/80R22.5',
      'condition', 'R1', 'retread_design', 'TEST DESIGN',
      'otd_mm', 17, 'rtd_mm', 8.5
    ))
  ));
  v_baseline_cycle := (v_result#>>'{mounts,0,life_cycle_id}')::uuid;
  select count(*) into v_count
    from public.tire_casings c
    join public.tire_life_cycles lc on lc.casing_id = c.id
    join public.tire_installations ti on ti.life_cycle_id = lc.id
   where lc.id = v_baseline_cycle and c.origin = 'baseline'
     and lc.origin = 'baseline' and ti.origin = 'baseline'
     and ti.source_measurement_id = v_m[1];
  if v_count <> 1 then
    raise exception 'T5: esperaba casco/ciclo/instalación baseline enlazados; obtuvo % filas', v_count;
  end if;
  if (select life_cycle_id from public.inspection_measurements where id = v_m[1])
     is distinct from v_baseline_cycle then
    raise exception 'T5: la medición fuente no quedó enlazada al ciclo %', v_baseline_cycle;
  end if;
  select count(*) into v_after from public.v_tire_inventory_available
   where company_id = v_company;
  if v_after <> v_before then
    raise exception 'T17: inventario disponible debía seguir en % y quedó en %', v_before, v_after;
  end if;

  -- T6: reintento idempotente, mismo resultado y ninguna fila adicional.
  select count(*) into v_before from public.tire_installations where company_id = v_company;
  v_result := public.confirm_baseline_mount(jsonb_build_object(
    'batch_version', 1, 'batch_id', v_batch_t5, 'unit_id', v_unit,
    'performed_at', current_date - 8, 'mounts', jsonb_build_array(jsonb_build_object(
      'seq', 99, 'position', 2, 'source_measurement_id', v_m[2],
      'casing_code', 'SHOULD-NOT-EXIST', 'condition', 'N'
    ))
  ));
  select count(*) into v_after from public.tire_installations where company_id = v_company;
  if coalesce((v_result->>'already_applied')::boolean, false) is not true or v_after <> v_before then
    raise exception 'T6: reintento esperaba already_applied=true y % instalaciones; obtuvo % y %',
      v_before, v_result, v_after;
  end if;

  -- T7: otro batch en posición ocupada.
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 7, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 1, 'source_measurement_id', v_m[1],
        'casing_code', 'BASE-OCCUPIED', 'condition', 'N'
      ))
    ));
    raise exception 'T7_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T7_ACCEPTED' then raise exception 'T7: aceptó posición ocupada'; end if;
    if v_message not like '%[posicion_ocupada]%' then
      raise exception 'T7: esperaba [posicion_ocupada] y obtuvo: %', v_message;
    end if;
  end;

  -- T8: código existente; la subtransacción fallida no deja filas.
  select count(*) into v_before from public.tire_casings where company_id = v_company;
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 7, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 2, 'source_measurement_id', v_m[2],
        'casing_code', 'BASE-001', 'condition', 'N'
      ))
    ));
    raise exception 'T8_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T8_ACCEPTED' then raise exception 'T8: aceptó código duplicado'; end if;
    if v_message not like '%[codigo_en_uso]%' then
      raise exception 'T8: esperaba [codigo_en_uso] y obtuvo: %', v_message;
    end if;
  end;
  select count(*) into v_after from public.tire_casings where company_id = v_company;
  if v_after <> v_before then raise exception 'T8: dejó cascos (% -> %)', v_before, v_after; end if;

  -- Preparar un ciclo de retén para T9/T10.
  v_result := public.register_full_installation(
    'RETAINED-23', 'TEST', 'RETAINED', '295/80R22.5', 'N',
    v_unit, 23::smallint, current_date - 20, null, 17, null, 'PEN', 93000, 15, 'T9 setup'
  );
  v_retained_cycle := (v_result->>'life_cycle_id')::uuid;
  perform public.register_removal(v_retained_cycle, current_date - 15, 'retention', 93500, 14);

  -- T9: montar ciclo de retén no crea casco y sí marca instalación baseline.
  select count(*) into v_before from public.tire_casings where company_id = v_company;
  v_result := public.confirm_baseline_mount(jsonb_build_object(
    'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
    'performed_at', current_date - 7, 'mounts', jsonb_build_array(jsonb_build_object(
      'seq', 1, 'position', 3, 'source_measurement_id', v_m[3],
      'life_cycle_id', v_retained_cycle, 'condition', 'N', 'rtd_mm', 13
    ))
  ));
  select count(*) into v_after from public.tire_casings where company_id = v_company;
  select count(*) into v_count from public.tire_installations
   where life_cycle_id = v_retained_cycle and not removed and origin = 'baseline'
     and source_measurement_id = v_m[3] and position_number = 3;
  if v_after <> v_before or v_count <> 1 then
    raise exception 'T9: esperaba cero cascos nuevos y una instalación baseline; cascos %->%, instalaciones %',
      v_before, v_after, v_count;
  end if;

  -- T10: el mismo ciclo ya montado no está disponible.
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 4, 'source_measurement_id', v_m[4],
        'life_cycle_id', v_retained_cycle, 'condition', 'N'
      ))
    ));
    raise exception 'T10_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T10_ACCEPTED' then raise exception 'T10: montó un ciclo ya montado'; end if;
    if v_message not like '%[no_disponible]%' then
      raise exception 'T10: esperaba [no_disponible] y obtuvo: %', v_message;
    end if;
  end;

  -- T11: la evidencia debe corresponder exactamente a unidad+posición.
  select count(*) into v_before from public.tire_installations where company_id = v_company;
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 5, 'source_measurement_id', v_m[4],
        'casing_code', 'WRONG-EVIDENCE', 'condition', 'N'
      ))
    ));
    raise exception 'T11_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T11_ACCEPTED' then raise exception 'T11: aceptó evidencia de otra posición'; end if;
    if v_message not like '%[evidencia_invalida]%' then
      raise exception 'T11: esperaba [evidencia_invalida] y obtuvo: %', v_message;
    end if;
  end;
  select count(*) into v_after from public.tire_installations where company_id = v_company;
  if v_after <> v_before then raise exception 'T11: dejó instalaciones (% -> %)', v_before, v_after; end if;

  -- T12: R1 exige diseño de reencauche.
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 4, 'source_measurement_id', v_m[4],
        'casing_code', 'R1-WITHOUT-DESIGN', 'condition', 'R1'
      ))
    ));
    raise exception 'T12_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T12_ACCEPTED' then raise exception 'T12: aceptó R1 sin diseño'; end if;
    if v_message not like '%[lote_invalido]%' then
      raise exception 'T12: esperaba [lote_invalido] y obtuvo: %', v_message;
    end if;
  end;

  -- T13: identidad ausente y doble identidad son inválidas.
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 4, 'source_measurement_id', v_m[4], 'condition', 'N'
      ))
    ));
    raise exception 'T13A_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T13A_ACCEPTED' then raise exception 'T13: aceptó identidad ausente'; end if;
    if v_message not like '%[lote_invalido]%' then raise exception 'T13A: error inesperado: %', v_message; end if;
  end;
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 4, 'source_measurement_id', v_m[4],
        'casing_code', 'BOTH', 'life_cycle_id', v_retained_cycle, 'condition', 'N'
      ))
    ));
    raise exception 'T13B_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T13B_ACCEPTED' then raise exception 'T13: aceptó doble identidad'; end if;
    if v_message not like '%[lote_invalido]%' then raise exception 'T13B: error inesperado: %', v_message; end if;
  end;

  -- T14: seq duplicado y posición repetida se rechazan por separado.
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(
        jsonb_build_object('seq', 1, 'position', 4, 'source_measurement_id', v_m[4], 'casing_code', 'DUP-SEQ-A', 'condition', 'N'),
        jsonb_build_object('seq', 1, 'position', 5, 'source_measurement_id', v_m[5], 'casing_code', 'DUP-SEQ-B', 'condition', 'N')
      )
    ));
    raise exception 'T14A_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T14A_ACCEPTED' then raise exception 'T14: aceptó seq duplicado'; end if;
    if v_message not like '%[lote_invalido]%' then raise exception 'T14A: error inesperado: %', v_message; end if;
  end;
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(
        jsonb_build_object('seq', 1, 'position', 4, 'source_measurement_id', v_m[4], 'casing_code', 'DUP-POS-A', 'condition', 'N'),
        jsonb_build_object('seq', 2, 'position', 4, 'source_measurement_id', v_m[4], 'casing_code', 'DUP-POS-B', 'condition', 'N')
      )
    ));
    raise exception 'T14B_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T14B_ACCEPTED' then raise exception 'T14: aceptó posición repetida'; end if;
    if v_message not like '%[lote_invalido]%' then raise exception 'T14B: error inesperado: %', v_message; end if;
  end;

  -- T15: rol insuficiente y cruce de tenant.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_inspector, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 4, 'source_measurement_id', v_m[4],
        'casing_code', 'NO-ROLE', 'condition', 'N'
      ))
    ));
    raise exception 'T15A_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T15A_ACCEPTED' then raise exception 'T15: inspector ejecutó primer montaje'; end if;
    if v_message not like '%[sin_permiso]%' then raise exception 'T15A: esperaba [sin_permiso] y obtuvo: %', v_message; end if;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_workshop, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_other_unit,
      'performed_at', current_date - 6, 'mounts', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'position', 1, 'source_measurement_id', v_m[1],
        'casing_code', 'OTHER-TENANT', 'condition', 'N'
      ))
    ));
    raise exception 'T15B_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T15B_ACCEPTED' then raise exception 'T15: operó unidad de otra empresa'; end if;
    if v_message not like '%[sin_permiso]%' then raise exception 'T15B: esperaba [sin_permiso] y obtuvo: %', v_message; end if;
  end;

  -- T16: lote completo de cuatro y atomicidad si falla el cuarto.
  v_result := public.confirm_baseline_mount(jsonb_build_object(
    'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
    'performed_at', current_date - 5, 'mounts', jsonb_build_array(
      jsonb_build_object('seq', 1, 'position', 5, 'source_measurement_id', v_m[5], 'casing_code', 'BUS-05', 'condition', 'N'),
      jsonb_build_object('seq', 2, 'position', 6, 'source_measurement_id', v_m[6], 'casing_code', 'BUS-06', 'condition', 'N'),
      jsonb_build_object('seq', 3, 'position', 7, 'source_measurement_id', v_m[7], 'casing_code', 'BUS-07', 'condition', 'N'),
      jsonb_build_object('seq', 4, 'position', 8, 'source_measurement_id', v_m[8], 'casing_code', 'BUS-08', 'condition', 'N')
    )
  ));
  select count(*) into v_count from public.tire_installations
   where unit_id = v_unit and position_number between 5 and 8 and not removed;
  if jsonb_array_length(v_result->'mounts') <> 4 or v_count <> 4 then
    raise exception 'T16: lote exitoso esperaba 4 resultados/instalaciones y obtuvo %/%',
      jsonb_array_length(v_result->'mounts'), v_count;
  end if;
  select count(*) into v_before from public.tire_installations
   where unit_id = v_unit and position_number between 9 and 12 and not removed;
  begin
    perform public.confirm_baseline_mount(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 5, 'mounts', jsonb_build_array(
        jsonb_build_object('seq', 1, 'position', 9, 'source_measurement_id', v_m[9], 'casing_code', 'ROLLBACK-09', 'condition', 'N'),
        jsonb_build_object('seq', 2, 'position', 10, 'source_measurement_id', v_m[10], 'casing_code', 'ROLLBACK-10', 'condition', 'N'),
        jsonb_build_object('seq', 3, 'position', 11, 'source_measurement_id', v_m[11], 'casing_code', 'ROLLBACK-11', 'condition', 'N'),
        jsonb_build_object('seq', 4, 'position', 12, 'source_measurement_id', v_m[12], 'casing_code', 'BASE-001', 'condition', 'N')
      )
    ));
    raise exception 'T16_FAIL_ACCEPTED';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'T16_FAIL_ACCEPTED' then raise exception 'T16: aceptó lote cuyo cuarto mount debía fallar'; end if;
    if v_message not like '%[codigo_en_uso]%' then raise exception 'T16: esperaba [codigo_en_uso] y obtuvo: %', v_message; end if;
  end;
  select count(*) into v_after from public.tire_installations
   where unit_id = v_unit and position_number between 9 and 12 and not removed;
  if v_before <> 0 or v_after <> 0 then
    raise exception 'T16: lote fallido no fue atómico; instalaciones antes/después %/%', v_before, v_after;
  end if;

  -- Crear ciclo disponible para probar el gate normal.
  v_result := public.register_full_installation(
    'GATE-22', 'TEST', 'GATE', '295/80R22.5', 'N',
    v_unit, 22::smallint, current_date - 20, null, 17, null, 'PEN', 93000, 15, 'T18 setup'
  );
  v_gate_cycle := (v_result->>'life_cycle_id')::uuid;
  perform public.register_removal(v_gate_cycle, current_date - 15, 'retention', 93500, 14);

  -- T18: solo mount contradictorio queda bloqueado, con 22023 y cero writes.
  select count(*) into v_before from public.tire_change_batches where company_id = v_company;
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
      'performed_at', current_date - 4, 'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'mount', 'position', 13, 'life_cycle_id', v_gate_cycle, 'rtd_mm', 13
      ))
    ));
    raise exception 'T18_ACCEPTED';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_message = message_text;
    if v_message = 'T18_ACCEPTED' then raise exception 'T18: gate aceptó mount sobre baseline_pending'; end if;
    if v_sqlstate <> '22023' or v_message not like '%[linea_base_pendiente]%' then
      raise exception 'T18: esperaba 22023/[linea_base_pendiente] y obtuvo %: %', v_sqlstate, v_message;
    end if;
  end;
  select count(*) into v_after from public.tire_change_batches where company_id = v_company;
  if v_after <> v_before or exists (
    select 1 from public.tire_installations where life_cycle_id = v_gate_cycle and not removed
  ) then raise exception 'T18: el gate dejó escrituras'; end if;

  -- T19: sin evidencia (P14) el mount normal conserva su comportamiento.
  v_result := public.register_full_installation(
    'NORMAL-21', 'TEST', 'NORMAL', '295/80R22.5', 'N',
    v_unit, 21::smallint, current_date - 20, null, 17, null, 'PEN', 93000, 15, 'T19 setup'
  );
  v_normal_cycle := (v_result->>'life_cycle_id')::uuid;
  perform public.register_removal(v_normal_cycle, current_date - 15, 'retention', 93500, 14);
  v_result := public.confirm_tire_change_batch(jsonb_build_object(
    'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
    'performed_at', current_date - 4, 'movements', jsonb_build_array(jsonb_build_object(
      'seq', 1, 'op', 'mount', 'position', 14, 'life_cycle_id', v_normal_cycle, 'rtd_mm', 13
    ))
  ));
  if not exists (select 1 from public.tire_installations
                  where life_cycle_id = v_normal_cycle and position_number = 14 and not removed) then
    raise exception 'T19: mount normal sobre posición sin evidencia no quedó aplicado: %', v_result;
  end if;

  -- T20: confirmar baseline en P13 habilita después un swap normal P13/P14.
  v_result := public.confirm_baseline_mount(jsonb_build_object(
    'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
    'performed_at', current_date - 4, 'mounts', jsonb_build_array(jsonb_build_object(
      'seq', 1, 'position', 13, 'source_measurement_id', v_m[13],
      'casing_code', 'BASE-013', 'condition', 'N', 'rtd_mm', 12
    ))
  ));
  v_pos13_cycle := (v_result#>>'{mounts,0,life_cycle_id}')::uuid;
  v_pos14_cycle := v_normal_cycle;
  perform public.confirm_tire_change_batch(jsonb_build_object(
    'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
    'performed_at', current_date - 3, 'movements', jsonb_build_array(jsonb_build_object(
      'seq', 1, 'op', 'swap',
      'position_a', 13, 'expected_life_cycle_id_a', v_pos13_cycle,
      'position_b', 14, 'expected_life_cycle_id_b', v_pos14_cycle,
      'rtd_mm_a', 11.5, 'rtd_mm_b', 12.5
    ))
  ));
  select count(*) into v_count from public.tire_installations
   where unit_id = v_unit and not removed and (
     (position_number = 14 and life_cycle_id = v_pos13_cycle) or
     (position_number = 13 and life_cycle_id = v_pos14_cycle)
   );
  if v_count <> 2 then raise exception 'T20: swap posterior a baseline dejó % lados correctos, esperaba 2', v_count; end if;

  -- T21: el gate no toca send_to_retention/discard (swap ya cubierto en T20).
  perform public.confirm_tire_change_batch(jsonb_build_object(
    'batch_version', 1, 'batch_id', gen_random_uuid(), 'unit_id', v_unit,
    'performed_at', current_date - 2, 'movements', jsonb_build_array(
      jsonb_build_object(
        'seq', 1, 'op', 'send_to_retention', 'position', 13,
        'expected_life_cycle_id', v_pos14_cycle, 'rtd_mm', 12
      ),
      jsonb_build_object(
        'seq', 2, 'op', 'discard', 'position', 24,
        'expected_life_cycle_id', v_t1_cycle, 'rtd_mm', 3,
        'discard_cause', 'Corte profundo en flanco', 'photo_url', 'https://example.com/test-baseline.jpg'
      )
    )
  ));
  if exists (select 1 from public.tire_installations where life_cycle_id = v_pos14_cycle and not removed)
     or (select status::text from public.tire_casings where id = v_t1_casing) <> 'discarded' then
    raise exception 'T21: send_to_retention/discard no produjeron el estado esperado';
  end if;

  raise exception 'TESTS_PASSED';
end;
$$;
