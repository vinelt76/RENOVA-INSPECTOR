-- RENOVA — Pruebas del lote transaccional de cambios de neumáticos.
--
-- El DO principal cubre B1–B9 y termina siempre con TESTS_PASSED. Esa
-- excepción revierte fixtures, historial y cambios de perfiles del test.
-- Cualquier otra salida es un fallo.

do $$
declare
  v_movil              public.profiles%rowtype;
  v_cruz               public.profiles%rowtype;
  v_unit               public.units%rowtype;
  v_positions          smallint[];
  v_pos_a              smallint;
  v_pos_b              smallint;
  v_pos_c              smallint;
  v_pos_d              smallint;

  v_result             jsonb;
  v_b1_result          jsonb;
  v_setup              jsonb;
  v_cycle_a            uuid;
  v_cycle_b            uuid;
  v_cycle_c            uuid;
  v_cycle_retained     uuid;
  v_cycle_discarded    uuid;

  v_batch_b1           uuid := gen_random_uuid();
  v_batch_b2           uuid := gen_random_uuid();
  v_batch_b4a          uuid := gen_random_uuid();
  v_batch_b4b          uuid := gen_random_uuid();
  v_batch_b4c          uuid := gen_random_uuid();
  v_batch_b5           uuid := gen_random_uuid();
  v_batch_b6           uuid := gen_random_uuid();
  v_batch_b7           uuid := gen_random_uuid();
  v_batch_b8           uuid := gen_random_uuid();
  v_batch_b9           uuid := gen_random_uuid();
  v_wrong_cycle        uuid := gen_random_uuid();

  v_before_installs    integer;
  v_before_removals    integer;
  v_before_batches     integer;
  v_after_installs     integer;
  v_after_removals     integer;
  v_after_batches      integer;
  v_before_side_b      integer;
  v_before_side_a      integer;
  v_count              integer;
begin
  -- Setup: operadores reales de MOVIL/CRUZ, pero solo neumáticos TEST creados
  -- en esta transacción. La unidad MOVIL debe ofrecer cuatro posiciones libres.
  select p.*
    into v_movil
    from public.profiles p
    join public.companies c on c.id = p.company_id
   where p.active
     and p.role in ('workshop_manager', 'fleet_manager', 'admin')
     and (c.name ilike '%MÓVIL%' or c.name ilike '%MOVIL%')
     and exists (
       select 1
         from public.units u
         join public.tire_positions tp on tp.config_id = u.config_id
        where u.company_id = p.company_id
        group by u.id
       having count(*) filter (where not exists (
         select 1
           from public.tire_installations ti
          where ti.unit_id = u.id
            and ti.position_number = tp.position_number
            and not ti.removed
       )) >= 4
     )
   order by p.id
   limit 1;

  select p.*
    into v_cruz
    from public.profiles p
    join public.companies c on c.id = p.company_id
   where p.active
     and p.role in ('workshop_manager', 'fleet_manager', 'admin')
     and c.name ilike '%CRUZ%'
     and p.company_id <> v_movil.company_id
   order by p.id
   limit 1;

  if v_movil.id is null or v_cruz.id is null then
    raise exception 'SETUP: faltan operadores activos MOVIL/CRUZ con rol de taller';
  end if;

  select u.*
    into v_unit
    from public.units u
    join public.tire_positions tp on tp.config_id = u.config_id
   where u.company_id = v_movil.company_id
   group by u.id
  having count(*) filter (where not exists (
    select 1
      from public.tire_installations ti
     where ti.unit_id = u.id
       and ti.position_number = tp.position_number
       and not ti.removed
  )) >= 4
   order by u.plate, u.id
   limit 1;

  select array_agg(free_pos.position_number order by free_pos.position_number)
    into v_positions
    from (
      select tp.position_number
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
       limit 4
    ) free_pos;

  if coalesce(array_length(v_positions, 1), 0) <> 4 then
    raise exception 'SETUP: la unidad MOVIL elegida no conserva cuatro posiciones libres';
  end if;
  v_pos_a := v_positions[1];
  v_pos_b := v_positions[2];
  v_pos_c := v_positions[3];
  v_pos_d := v_positions[4];

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_movil.id, 'role', 'authenticated')::text,
    true
  );

  v_setup := public.register_full_installation(
    'TEST-BATCH-A-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N',
    v_unit.id, v_pos_a, current_date - 20,
    null, 17.0, null, 'PEN', 100000, 17.0, 'task_05 setup A'
  );
  v_cycle_a := (v_setup->>'life_cycle_id')::uuid;

  v_setup := public.register_full_installation(
    'TEST-BATCH-B-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N',
    v_unit.id, v_pos_b, current_date - 20,
    null, 17.0, null, 'PEN', 100000, 17.0, 'task_05 setup B'
  );
  v_cycle_b := (v_setup->>'life_cycle_id')::uuid;

  v_setup := public.register_full_installation(
    'TEST-BATCH-C-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N',
    v_unit.id, v_pos_c, current_date - 20,
    null, 17.0, null, 'PEN', 100000, 17.0, 'task_05 setup C'
  );
  v_cycle_c := (v_setup->>'life_cycle_id')::uuid;

  -- B1: retén + montaje del mismo ciclo + swap, todo en un lote.
  v_b1_result := public.confirm_tire_change_batch(jsonb_build_object(
    'batch_version', 1,
    'batch_id', v_batch_b1,
    'unit_id', v_unit.id,
    'performed_at', current_date - 10,
    'odometer', 101000,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'seq', 1, 'op', 'send_to_retention', 'position', v_pos_a,
        'expected_life_cycle_id', v_cycle_a, 'rtd_mm', 15.5,
        'notes', 'B1 retén'
      ),
      jsonb_build_object(
        'seq', 2, 'op', 'mount', 'position', v_pos_a,
        'life_cycle_id', v_cycle_a, 'rtd_mm', 15.5,
        'notes', 'B1 montaje desde retén'
      ),
      jsonb_build_object(
        'seq', 3, 'op', 'swap',
        'position_a', v_pos_b, 'expected_life_cycle_id_a', v_cycle_b,
        'position_b', v_pos_c, 'expected_life_cycle_id_b', v_cycle_c,
        'rtd_mm_a', 14.5, 'rtd_mm_b', 14.0, 'notes', 'B1 swap'
      )
    )
  ));

  if (v_b1_result->>'batch_id')::uuid <> v_batch_b1
     or coalesce((v_b1_result->>'applied')::boolean, false) is not true
     or coalesce((v_b1_result->>'already_applied')::boolean, true) is not false
     or jsonb_array_length(v_b1_result->'movements') <> 3 then
    raise exception 'B1: encabezado/respuesta inesperada: %', v_b1_result;
  end if;
  if (v_b1_result#>>'{movements,0,removal_id}')::uuid is null
     or (v_b1_result#>>'{movements,0,installation_id}')::uuid is null
     or (v_b1_result#>>'{movements,1,installation_id}')::uuid is null
     or (v_b1_result#>>'{movements,2,removal_id_a}')::uuid is null
     or (v_b1_result#>>'{movements,2,removal_id_b}')::uuid is null
     or (v_b1_result#>>'{movements,2,installation_id_a}')::uuid is null
     or (v_b1_result#>>'{movements,2,installation_id_b}')::uuid is null then
    raise exception 'B1: faltan ids reales en los resultados: %', v_b1_result->'movements';
  end if;

  select count(*) into v_count
    from public.v_unit_position_state s
   where s.unit_id = v_unit.id
     and (
       (s.position_number = v_pos_a and s.life_cycle_id = v_cycle_a)
       or (s.position_number = v_pos_b and s.life_cycle_id = v_cycle_c)
       or (s.position_number = v_pos_c and s.life_cycle_id = v_cycle_b)
     )
     and not s.is_empty;
  if v_count <> 3 then
    raise exception 'B1: estado final incorrecto en las posiciones (% filas correctas)', v_count;
  end if;

  select count(*) into v_count
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where (ti.life_cycle_id = v_cycle_a and tr.reason = 'retention')
      or (ti.life_cycle_id in (v_cycle_b, v_cycle_c) and tr.reason = 'rotation');
  if v_count <> 3 then
    raise exception 'B1: razones de retiro incorrectas (% de 3)', v_count;
  end if;
  select count(*) into v_count from public.tire_change_batches where id = v_batch_b1;
  if v_count <> 1 then
    raise exception 'B1: no quedó exactamente una fila de lote';
  end if;

  -- B2: el tercer expected es obsoleto; ningún movimiento ni batch persiste.
  select count(*) into v_before_installs
    from public.tire_installations
   where life_cycle_id in (v_cycle_a, v_cycle_b, v_cycle_c);
  select count(*) into v_before_removals
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id in (v_cycle_a, v_cycle_b, v_cycle_c);
  select count(*) into v_before_batches from public.tire_change_batches;

  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b2, 'unit_id', v_unit.id,
      'performed_at', current_date - 9, 'odometer', 101100,
      'movements', jsonb_build_array(
        jsonb_build_object('seq', 1, 'op', 'send_to_retention', 'position', v_pos_a,
                           'expected_life_cycle_id', v_cycle_a),
        jsonb_build_object('seq', 2, 'op', 'send_to_retention', 'position', v_pos_b,
                           'expected_life_cycle_id', v_cycle_c),
        jsonb_build_object('seq', 3, 'op', 'send_to_retention', 'position', v_pos_c,
                           'expected_life_cycle_id', v_wrong_cycle)
      )
    ));
    raise exception 'B2: aceptó un expected_life_cycle_id obsoleto';
  exception when serialization_failure then
    if sqlerrm not like '%[estado_desactualizado]%' then raise; end if;
  end;

  select count(*) into v_after_installs
    from public.tire_installations
   where life_cycle_id in (v_cycle_a, v_cycle_b, v_cycle_c);
  select count(*) into v_after_removals
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id in (v_cycle_a, v_cycle_b, v_cycle_c);
  select count(*) into v_after_batches from public.tire_change_batches;
  if v_after_installs <> v_before_installs
     or v_after_removals <> v_before_removals
     or v_after_batches <> v_before_batches
     or exists (select 1 from public.tire_change_batches where id = v_batch_b2) then
    raise exception 'B2: el lote fallido dejó efectos (%/%/% -> %/%/%)',
      v_before_installs, v_before_removals, v_before_batches,
      v_after_installs, v_after_removals, v_after_batches;
  end if;

  -- B3: mismo batch_id devuelve el resultado guardado sin duplicar historia.
  v_before_installs := v_after_installs;
  v_before_removals := v_after_removals;
  v_result := public.confirm_tire_change_batch(jsonb_build_object(
    'batch_version', 1, 'batch_id', v_batch_b1, 'unit_id', v_unit.id,
    'performed_at', current_date - 10, 'odometer', 101000,
    'movements', jsonb_build_array(
      jsonb_build_object('seq', 999, 'op', 'mount', 'position', v_pos_d,
                         'life_cycle_id', gen_random_uuid())
    )
  ));
  select count(*) into v_after_installs
    from public.tire_installations
   where life_cycle_id in (v_cycle_a, v_cycle_b, v_cycle_c);
  select count(*) into v_after_removals
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id in (v_cycle_a, v_cycle_b, v_cycle_c);
  if coalesce((v_result->>'already_applied')::boolean, false) is not true
     or v_result->'movements' <> v_b1_result->'movements'
     or v_after_installs <> v_before_installs
     or v_after_removals <> v_before_removals then
    raise exception 'B3: reintento no idempotente: %', v_result;
  end if;

  -- B4a: descarte sin causa.
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b4a, 'unit_id', v_unit.id,
      'performed_at', current_date - 8,
      'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'discard', 'position', v_pos_a,
        'expected_life_cycle_id', v_cycle_a,
        'photo_url', 'https://example.com/B4a.jpg'
      ))
    ));
    raise exception 'B4a: aceptó discard sin causa';
  exception when invalid_parameter_value then
    if sqlerrm not like '%[lote_invalido]%' then raise; end if;
  end;

  -- B4b: la misma posición aparece dos veces como origen.
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b4b, 'unit_id', v_unit.id,
      'performed_at', current_date - 8,
      'movements', jsonb_build_array(
        jsonb_build_object('seq', 1, 'op', 'send_to_retention', 'position', v_pos_a,
                           'expected_life_cycle_id', v_cycle_a),
        jsonb_build_object('seq', 2, 'op', 'send_to_retention', 'position', v_pos_a,
                           'expected_life_cycle_id', v_cycle_a)
      )
    ));
    raise exception 'B4b: aceptó origen duplicado';
  exception when invalid_parameter_value then
    if sqlerrm not like '%[lote_invalido]%' then raise; end if;
  end;

  -- B4c: versión futura no soportada.
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 2, 'batch_id', v_batch_b4c, 'unit_id', v_unit.id,
      'performed_at', current_date - 8,
      'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'send_to_retention', 'position', v_pos_a,
        'expected_life_cycle_id', v_cycle_a
      ))
    ));
    raise exception 'B4c: aceptó batch_version=2';
  exception when invalid_parameter_value then
    if sqlerrm not like '%[lote_invalido]%' then raise; end if;
  end;
  select count(*) into v_count
    from public.tire_change_batches
   where id in (v_batch_b4a, v_batch_b4b, v_batch_b4c);
  if v_count <> 0 then raise exception 'B4: se guardaron % lotes inválidos', v_count; end if;

  -- Fixtures B5/B6: un ciclo retenido disponible y otro descartado.
  v_setup := public.register_full_installation(
    'TEST-BATCH-RET-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N',
    v_unit.id, v_pos_d, current_date - 20,
    null, 17.0, null, 'PEN', 100000, 17.0, 'task_05 retained setup'
  );
  v_cycle_retained := (v_setup->>'life_cycle_id')::uuid;
  perform public.register_removal(
    v_cycle_retained, current_date - 19, 'retention', 100100, 16.5,
    null, null, 'task_05 retained setup'
  );

  v_setup := public.register_full_installation(
    'TEST-BATCH-DISC-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N',
    v_unit.id, v_pos_d, current_date - 18,
    null, 17.0, null, 'PEN', 100200, 17.0, 'task_05 discarded setup'
  );
  v_cycle_discarded := (v_setup->>'life_cycle_id')::uuid;
  perform public.register_removal(
    v_cycle_discarded, current_date - 17, 'discard', 100300, 2.0,
    'Neumático', 'https://example.com/task-05-discard.jpg', 'task_05 discarded setup'
  );

  -- B5: un ciclo descartado no puede volver a montarse.
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b5, 'unit_id', v_unit.id,
      'performed_at', current_date - 7,
      'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'mount', 'position', v_pos_d,
        'life_cycle_id', v_cycle_discarded
      ))
    ));
    raise exception 'B5: montó un ciclo descartado';
  exception when invalid_parameter_value then
    if sqlerrm not like '%[no_disponible]%' then raise; end if;
  end;
  if exists (select 1 from public.tire_change_batches where id = v_batch_b5)
     or exists (select 1 from public.tire_installations where life_cycle_id = v_cycle_discarded and not removed) then
    raise exception 'B5: el intento fallido dejó efectos';
  end if;

  -- B6: un ciclo disponible no puede montarse en un destino aún ocupado.
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b6, 'unit_id', v_unit.id,
      'performed_at', current_date - 7,
      'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'mount', 'position', v_pos_a,
        'life_cycle_id', v_cycle_retained
      ))
    ));
    raise exception 'B6: montó sobre una posición ocupada';
  exception when unique_violation then
    if sqlerrm not like '%[posicion_ocupada]%' then raise; end if;
  end;
  if exists (select 1 from public.tire_change_batches where id = v_batch_b6)
     or exists (select 1 from public.tire_installations where life_cycle_id = v_cycle_retained and not removed) then
    raise exception 'B6: el intento fallido dejó efectos';
  end if;

  -- B7: CRUZ no puede operar sobre una unidad ni ciclos de MOVIL.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_cruz.id, 'role', 'authenticated')::text,
    true
  );
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b7, 'unit_id', v_unit.id,
      'performed_at', current_date - 6,
      'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'mount', 'position', v_pos_d,
        'life_cycle_id', v_cycle_retained
      ))
    ));
    raise exception 'B7: CRUZ operó una unidad MOVIL';
  exception when insufficient_privilege then
    if sqlerrm not like '%[sin_permiso]%' or sqlerrm not like '%no pertenece%' then raise; end if;
  end;
  if exists (select 1 from public.tire_change_batches where id = v_batch_b7)
     or exists (select 1 from public.tire_installations where life_cycle_id = v_cycle_retained and not removed) then
    raise exception 'B7: el intento cross-tenant dejó efectos';
  end if;

  -- B8: el mismo usuario, temporalmente inspector, recibe 42501/no permite.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_movil.id, 'role', 'authenticated')::text,
    true
  );
  begin
    update public.profiles set role = 'inspector' where id = v_movil.id;
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b8, 'unit_id', v_unit.id,
      'performed_at', current_date - 6,
      'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'mount', 'position', v_pos_d,
        'life_cycle_id', v_cycle_retained
      ))
    ));
    raise exception 'B8: un inspector aplicó el lote';
  exception when insufficient_privilege then
    if sqlerrm not like '%[sin_permiso]%' or sqlerrm not like '%no permite%' then raise; end if;
  end;
  select count(*) into v_count
    from public.profiles
   where id = v_movil.id and role = v_movil.role;
  if v_count <> 1
     or exists (select 1 from public.tire_change_batches where id = v_batch_b8) then
    raise exception 'B8: el subtest de rol dejó efectos';
  end if;

  -- B9: se prepara un swap y luego se cambia P_b antes de confirmarlo.
  select count(*) into v_before_side_a
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id = v_cycle_c;
  select count(*) into v_before_side_b
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id = v_cycle_b;

  perform public.register_removal(
    v_cycle_c, current_date - 5, 'retention', 101500, 13.5,
    null, null, 'B9 cambio concurrente simulado'
  );
  begin
    perform public.confirm_tire_change_batch(jsonb_build_object(
      'batch_version', 1, 'batch_id', v_batch_b9, 'unit_id', v_unit.id,
      'performed_at', current_date - 4, 'odometer', 101600,
      'movements', jsonb_build_array(jsonb_build_object(
        'seq', 1, 'op', 'swap',
        'position_a', v_pos_b, 'expected_life_cycle_id_a', v_cycle_c,
        'position_b', v_pos_c, 'expected_life_cycle_id_b', v_cycle_b
      ))
    ));
    raise exception 'B9: aceptó swap con un lado desactualizado';
  exception when serialization_failure then
    if sqlerrm not like '%[estado_desactualizado]%' then raise; end if;
  end;

  select count(*) into v_count
    from public.v_unit_position_state s
   where s.unit_id = v_unit.id
     and s.position_number = v_pos_c
     and s.life_cycle_id = v_cycle_b
     and not s.is_empty;
  select count(*) into v_after_removals
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id = v_cycle_b;
  select count(*) into v_after_installs
    from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id = v_cycle_c;
  if v_count <> 1
     or v_after_removals <> v_before_side_b
     or v_after_installs <> v_before_side_a + 1
     or exists (select 1 from public.tire_change_batches where id = v_batch_b9) then
    raise exception 'B9: el swap obsoleto aplicó uno de sus lados';
  end if;

  -- Contrato de exposición de la RPC.
  if not has_function_privilege('authenticated', 'public.confirm_tire_change_batch(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.confirm_tire_change_batch(jsonb)', 'execute') then
    raise exception 'GRANTS: permisos inesperados en confirm_tire_change_batch(jsonb)';
  end if;

  raise exception 'TESTS_PASSED';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PRUEBA MANUAL DE CONCURRENCIA (dos conexiones)
-- ─────────────────────────────────────────────────────────────────────────────
-- Este guion es SQL ejecutable al reemplazar los tokens <...>. Use un casco
-- TEST exclusivo. La sesión 1 mantiene el lock de unidad; la sesión 2 queda
-- bloqueada y, después del COMMIT de la primera, recibe
-- [estado_desactualizado]. La sesión 2 hace ROLLBACK y el bloque de limpieza
-- elimina el único cambio que debió confirmarse. El assert final debe devolver 0.
--
-- PREPARACIÓN (conexión de control; guardar los ids devueltos):
-- begin;
-- select set_config('request.jwt.claims',
--   json_build_object('sub', '<MOVIL_PROFILE_ID>', 'role', 'authenticated')::text, true);
-- select public.register_full_installation(
--   'TEST-BATCH-CONC-<RUN_ID>', 'TEST BRAND', 'TEST MODEL', '295/80R22.5', 'N',
--   '<UNIT_ID>'::uuid, <POSITION>, current_date - 2,
--   null, 17.0, null, 'PEN', 100000, 17.0, 'task_05 concurrency');
-- commit;
--
-- SESIÓN 1:
-- begin;
-- set local statement_timeout = '15s';
-- select set_config('request.jwt.claims',
--   json_build_object('sub', '<MOVIL_PROFILE_ID>', 'role', 'authenticated')::text, true);
-- select public.confirm_tire_change_batch(jsonb_build_object(
--   'batch_version', 1, 'batch_id', '<BATCH_A>'::uuid, 'unit_id', '<UNIT_ID>'::uuid,
--   'performed_at', current_date - 1,
--   'movements', jsonb_build_array(jsonb_build_object(
--     'seq', 1, 'op', 'send_to_retention', 'position', <POSITION>,
--     'expected_life_cycle_id', '<LIFE_CYCLE_ID>'::uuid))));
-- -- No confirmar todavía: iniciar ahora la sesión 2 y comprobar que espera.
-- select pg_sleep(3);
-- commit;
--
-- SESIÓN 2 (iniciarla mientras la sesión 1 duerme):
-- begin;
-- set local statement_timeout = '15s';
-- select set_config('request.jwt.claims',
--   json_build_object('sub', '<MOVIL_PROFILE_ID>', 'role', 'authenticated')::text, true);
-- do $concurrency$
-- begin
--   perform public.confirm_tire_change_batch(jsonb_build_object(
--     'batch_version', 1, 'batch_id', '<BATCH_B>'::uuid, 'unit_id', '<UNIT_ID>'::uuid,
--     'performed_at', current_date,
--     'movements', jsonb_build_array(jsonb_build_object(
--       'seq', 1, 'op', 'send_to_retention', 'position', <POSITION>,
--       'expected_life_cycle_id', '<LIFE_CYCLE_ID>'::uuid))));
--   raise exception 'CONCURRENCY_FAILED: la sesión 2 no detectó estado obsoleto';
-- exception when serialization_failure then
--   if sqlerrm not like '%[estado_desactualizado]%' then raise; end if;
--   raise notice 'CONCURRENCY_SESSION_2_PASSED: %', sqlerrm;
-- end;
-- $concurrency$;
-- rollback;
--
-- LIMPIEZA (conexión de control, solo ids/código TEST de esta corrida):
-- begin;
-- delete from public.tire_change_batches where id in ('<BATCH_A>'::uuid, '<BATCH_B>'::uuid);
-- delete from public.tire_removals where installation_id in (
--   select id from public.tire_installations where life_cycle_id = '<LIFE_CYCLE_ID>'::uuid);
-- delete from public.tire_installations where life_cycle_id = '<LIFE_CYCLE_ID>'::uuid;
-- delete from public.tire_life_cycles where id = '<LIFE_CYCLE_ID>'::uuid;
-- delete from public.tire_casings where code = 'TEST-BATCH-CONC-<RUN_ID>';
-- commit;
-- select count(*) as concurrency_residue_count
--   from public.tire_casings where code = 'TEST-BATCH-CONC-<RUN_ID>'; -- esperado: 0
