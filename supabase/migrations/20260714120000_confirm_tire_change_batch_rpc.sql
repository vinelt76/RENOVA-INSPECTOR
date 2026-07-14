-- RENOVA — RPC transaccional de confirmación de lotes de cambio de neumáticos.
--
-- confirm_tire_change_batch(p_batch jsonb) recibe el lote completo (contrato
-- PLAN 2.5, versión 1) y aplica TODOS sus movimientos o NINGUNO en una sola
-- transacción. Compone las RPCs/helpers existentes sin duplicar su lógica:
--   send_to_retention → register_removal(reason='retention')
--   discard           → register_removal(reason='discard', causa+foto)
--   swap              → 2× register_removal(reason='rotation') + 2× fn_mount_existing_cycle (cruzado)
--   mount             → fn_mount_existing_cycle
--
-- Orden interno (anti-deadlock + bloqueo optimista):
--   1. Parseo de encabezado + idempotencia por batch_id.
--   2. Autenticación/empresa (fn_require_workshop_profile) y validación de la unidad.
--   3. Validación estructural del payload (ops, seq únicos, campos por op, sin
--      posiciones repetidas como origen ni como destino).
--   4. Lock + revalidación de las instalaciones activas de todas las posiciones
--      ORIGEN, recorridas ORDENADAS por position_number (evita deadlocks entre
--      lotes concurrentes) comparando el ciclo real contra expected_life_cycle_id.
--   5. Todos los retiros.  6. Todos los montajes.
--   7. Persistir tire_change_batches y devolver el resultado.
--
-- Idempotencia: el batch_id nace en el cliente. Un advisory lock transaccional
-- derivado de ese UUID se toma antes del SELECT inicial. Dos ejecuciones
-- concurrentes del MISMO lote se serializan ahí: la segunda espera el commit,
-- encuentra la fila y devuelve el result guardado con already_applied=true sin
-- re-aplicar nada. El PK de tire_change_batches queda como candado final.
--
-- Seguridad: SECURITY DEFINER + search_path fijo (bypasea RLS a propósito; la
-- empresa se deriva SIEMPRE del perfil y cada uuid del payload se valida contra
-- ella). REVOKE a public/anon; EXECUTE solo para authenticated (el rol de taller
-- se valida dentro). Genera el WARN esperado de advisor, igual que el resto de
-- RPCs de taller (ver BASELINE_REMOTO §4.1).
create function public.confirm_tire_change_batch(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile      public.profiles%rowtype;
  v_unit         public.units%rowtype;

  v_batch_id     uuid;
  v_unit_id      uuid;
  v_performed_at date;
  v_odometer     integer;
  v_movements    jsonb;
  v_normalized_movements jsonb := '[]'::jsonb;

  v_existing     jsonb;
  v_existing_company uuid;
  v_valid_causes text[] := enum_range(null::public.discard_cause)::text[];

  v_mv           jsonb;   -- movimiento en curso
  v_op           text;
  v_seq          int;

  v_origin       record;  -- posición origen + ciclo esperado (fase de lock)
  v_actual       uuid;    -- ciclo activo real en la posición
  v_cycle_to_lock uuid;   -- ciclos tocados, bloqueados en orden UUID

  v_removal      jsonb;
  v_removal_a    jsonb;
  v_removal_b    jsonb;
  v_installation uuid;
  v_inst_a       uuid;
  v_inst_b       uuid;
  v_casing_id    uuid;

  v_results      jsonb := '{}'::jsonb;   -- seq(text) -> objeto de resultado
  v_out_moves    jsonb;
  v_result       jsonb;
  v_constraint_name text;
begin
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Encabezado (sin acceso a datos): forma del lote y campos obligatorios.
  -- ───────────────────────────────────────────────────────────────────────────
  if p_batch is null or jsonb_typeof(p_batch) <> 'object' then
    raise exception '[lote_invalido] El lote debe ser un objeto JSON.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_batch->'batch_version') <> 'number'
     or coalesce(p_batch->>'batch_version', '') <> '1' then
    raise exception '[lote_invalido] Versión de lote no soportada (esperada 1, recibida %).',
      coalesce(p_batch->>'batch_version', '(ausente)')
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_batch->'batch_id') <> 'string'
     or jsonb_typeof(p_batch->'unit_id') <> 'string'
     or jsonb_typeof(p_batch->'performed_at') <> 'string'
     or (
       p_batch ? 'odometer'
       and jsonb_typeof(p_batch->'odometer') not in ('number', 'null')
     ) then
    raise exception '[lote_invalido] Tipos inválidos en el encabezado del lote.'
      using errcode = '22023';
  end if;

  begin
    v_batch_id     := (p_batch->>'batch_id')::uuid;
    v_unit_id      := (p_batch->>'unit_id')::uuid;
    v_performed_at := (p_batch->>'performed_at')::date;
    v_odometer     := nullif(p_batch->>'odometer', '')::integer;
  exception when data_exception then
    raise exception '[lote_invalido] Encabezado inválido: batch_id/unit_id deben ser UUID, performed_at fecha, odometer entero.'
      using errcode = '22023';
  end;

  if v_batch_id is null or v_unit_id is null or v_performed_at is null then
    raise exception '[lote_invalido] batch_id, unit_id y performed_at son obligatorios.'
      using errcode = '22023';
  end if;

  v_movements := p_batch->'movements';

  -- ───────────────────────────────────────────────────────────────────────────
  -- 2. Autenticación/empresa + idempotencia (antes de tocar nada más).
  -- ───────────────────────────────────────────────────────────────────────────
  begin
    v_profile := public.fn_require_workshop_profile();
  exception when insufficient_privilege then
    raise exception '[sin_permiso] %', sqlerrm
      using errcode = '42501';
  end;

  -- Serializa todo reintento del mismo batch_id antes de consultar su resultado.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_batch_id::text, 0)
  );

  select b.company_id, b.result into v_existing_company, v_existing
    from public.tire_change_batches b
   where b.id = v_batch_id;
  if found then
    if v_existing_company <> v_profile.company_id then
      raise exception '[lote_invalido] El batch_id indicado no está disponible.'
        using errcode = '22023';
    end if;
    -- Reintento idempotente: devolver el resultado guardado sin re-aplicar.
    return jsonb_set(v_existing, '{already_applied}', 'true'::jsonb);
  end if;

  select u.* into v_unit
    from public.units u
   where u.id = v_unit_id
     and u.company_id = v_profile.company_id
   for update;
  if v_unit.id is null then
    raise exception '[sin_permiso] La unidad del lote no existe o no pertenece a tu empresa.'
      using errcode = '42501';
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 3. Validación estructural de los movimientos.
  -- ───────────────────────────────────────────────────────────────────────────
  if v_movements is null
     or jsonb_typeof(v_movements) <> 'array'
     or jsonb_array_length(v_movements) = 0 then
    raise exception '[lote_invalido] El lote no tiene movimientos.'
      using errcode = '22023';
  end if;

  for v_mv in select value from jsonb_array_elements(v_movements) loop
    if jsonb_typeof(v_mv) <> 'object' then
      raise exception '[lote_invalido] Cada movimiento debe ser un objeto JSON.'
        using errcode = '22023';
    end if;

    v_op := v_mv->>'op';
    if v_op is null or v_op not in ('send_to_retention', 'discard', 'mount', 'swap') then
      raise exception '[lote_invalido] Operación desconocida: %.', coalesce(v_op, '(ausente)')
        using errcode = '22023';
    end if;
    if v_mv->>'seq' is null or jsonb_typeof(v_mv->'seq') <> 'number' then
      raise exception '[lote_invalido] Cada movimiento necesita "seq" entero.'
        using errcode = '22023';
    end if;

    if v_op in ('send_to_retention', 'discard') then
      if v_mv->>'position' is null or v_mv->>'expected_life_cycle_id' is null then
        raise exception '[lote_invalido] % (seq %) requiere position y expected_life_cycle_id.',
          v_op, v_mv->>'seq' using errcode = '22023';
      end if;
    end if;

    if v_op = 'discard' then
      if jsonb_typeof(v_mv->'discard_cause') <> 'string' then
        raise exception '[lote_invalido] discard (seq %) requiere discard_cause como texto.',
          v_mv->>'seq' using errcode = '22023';
      end if;
      if nullif(trim(coalesce(v_mv->>'discard_cause', '')), '') is null then
        raise exception '[lote_invalido] discard (seq %) requiere discard_cause.',
          v_mv->>'seq' using errcode = '22023';
      end if;
      if not (v_mv->>'discard_cause' = any(v_valid_causes)) then
        raise exception '[lote_invalido] Causa de descarte inválida en seq % (%). Válidas: %.',
          v_mv->>'seq', v_mv->>'discard_cause', array_to_string(v_valid_causes, ', ')
          using errcode = '22023';
      end if;
      if jsonb_typeof(v_mv->'photo_url') <> 'string' then
        raise exception '[lote_invalido] discard (seq %) requiere photo_url como texto.',
          v_mv->>'seq' using errcode = '22023';
      end if;
      if nullif(trim(coalesce(v_mv->>'photo_url', '')), '') is null then
        raise exception '[lote_invalido] discard (seq %) requiere photo_url.',
          v_mv->>'seq' using errcode = '22023';
      end if;
    end if;

    if v_op = 'mount' then
      if v_mv->>'position' is null or v_mv->>'life_cycle_id' is null then
        raise exception '[lote_invalido] mount (seq %) requiere position y life_cycle_id.',
          v_mv->>'seq' using errcode = '22023';
      end if;
    end if;

    if v_op = 'swap' then
      if v_mv->>'position_a' is null or v_mv->>'expected_life_cycle_id_a' is null
         or v_mv->>'position_b' is null or v_mv->>'expected_life_cycle_id_b' is null then
        raise exception '[lote_invalido] swap (seq %) requiere position_a/b y expected_life_cycle_id_a/b.',
          v_mv->>'seq' using errcode = '22023';
      end if;
    end if;

    -- Valida tipos y normaliza una sola vez. Desde aquí, los casts de las
    -- fases siguientes operan exclusivamente sobre valores canónicos.
    begin
      v_seq := (v_mv->>'seq')::integer;
      v_mv := v_mv || jsonb_build_object('seq', v_seq);

      if v_op in ('send_to_retention', 'discard') then
        if jsonb_typeof(v_mv->'position') <> 'number'
           or jsonb_typeof(v_mv->'expected_life_cycle_id') <> 'string' then
          raise exception using errcode = '22023';
        end if;
        v_mv := v_mv || jsonb_build_object(
          'position', (v_mv->>'position')::smallint,
          'expected_life_cycle_id', ((v_mv->>'expected_life_cycle_id')::uuid)::text
        );
        if v_mv ? 'rtd_mm' and jsonb_typeof(v_mv->'rtd_mm') <> 'null' then
          if jsonb_typeof(v_mv->'rtd_mm') <> 'number' then
            raise exception using errcode = '22023';
          end if;
          v_mv := v_mv || jsonb_build_object(
            'rtd_mm', (v_mv->>'rtd_mm')::numeric(5,2)
          );
        end if;

      elsif v_op = 'mount' then
        if jsonb_typeof(v_mv->'position') <> 'number'
           or jsonb_typeof(v_mv->'life_cycle_id') <> 'string' then
          raise exception using errcode = '22023';
        end if;
        v_mv := v_mv || jsonb_build_object(
          'position', (v_mv->>'position')::smallint,
          'life_cycle_id', ((v_mv->>'life_cycle_id')::uuid)::text
        );
        if v_mv ? 'rtd_mm' and jsonb_typeof(v_mv->'rtd_mm') <> 'null' then
          if jsonb_typeof(v_mv->'rtd_mm') <> 'number' then
            raise exception using errcode = '22023';
          end if;
          v_mv := v_mv || jsonb_build_object(
            'rtd_mm', (v_mv->>'rtd_mm')::numeric(5,2)
          );
        end if;

      elsif v_op = 'swap' then
        if jsonb_typeof(v_mv->'position_a') <> 'number'
           or jsonb_typeof(v_mv->'position_b') <> 'number'
           or jsonb_typeof(v_mv->'expected_life_cycle_id_a') <> 'string'
           or jsonb_typeof(v_mv->'expected_life_cycle_id_b') <> 'string' then
          raise exception using errcode = '22023';
        end if;
        v_mv := v_mv || jsonb_build_object(
          'position_a', (v_mv->>'position_a')::smallint,
          'position_b', (v_mv->>'position_b')::smallint,
          'expected_life_cycle_id_a', ((v_mv->>'expected_life_cycle_id_a')::uuid)::text,
          'expected_life_cycle_id_b', ((v_mv->>'expected_life_cycle_id_b')::uuid)::text
        );
        if v_mv ? 'rtd_mm_a' and jsonb_typeof(v_mv->'rtd_mm_a') <> 'null' then
          if jsonb_typeof(v_mv->'rtd_mm_a') <> 'number' then
            raise exception using errcode = '22023';
          end if;
          v_mv := v_mv || jsonb_build_object(
            'rtd_mm_a', (v_mv->>'rtd_mm_a')::numeric(5,2)
          );
        end if;
        if v_mv ? 'rtd_mm_b' and jsonb_typeof(v_mv->'rtd_mm_b') <> 'null' then
          if jsonb_typeof(v_mv->'rtd_mm_b') <> 'number' then
            raise exception using errcode = '22023';
          end if;
          v_mv := v_mv || jsonb_build_object(
            'rtd_mm_b', (v_mv->>'rtd_mm_b')::numeric(5,2)
          );
        end if;
      end if;
    exception when data_exception then
      raise exception '[lote_invalido] Tipos inválidos en el movimiento seq %.',
        coalesce(v_mv->>'seq', '(ausente)')
        using errcode = '22023';
    end;

    if v_op = 'swap'
       and (v_mv->>'position_a')::smallint = (v_mv->>'position_b')::smallint then
      raise exception '[lote_invalido] swap (seq %) no puede intercambiar una posición consigo misma.',
        v_mv->>'seq' using errcode = '22023';
    end if;

    v_normalized_movements := v_normalized_movements || jsonb_build_array(v_mv);
  end loop;

  v_movements := v_normalized_movements;

  -- seq únicos en todo el lote.
  if exists (
    select 1
      from jsonb_array_elements(v_movements) m
     group by (m->>'seq')::integer
    having count(*) > 1
  ) then
    raise exception '[lote_invalido] Hay valores de "seq" duplicados en el lote.'
      using errcode = '22023';
  end if;

  -- Ninguna posición repetida como ORIGEN (swap aporta a y b).
  if exists (
    with origins as (
      select (m->>'position')::smallint as pos
        from jsonb_array_elements(v_movements) m
       where m->>'op' in ('send_to_retention', 'discard')
      union all
      select (m->>'position_a')::smallint
        from jsonb_array_elements(v_movements) m where m->>'op' = 'swap'
      union all
      select (m->>'position_b')::smallint
        from jsonb_array_elements(v_movements) m where m->>'op' = 'swap'
    )
    select 1 from origins group by pos having count(*) > 1
  ) then
    raise exception '[lote_invalido] Una posición aparece más de una vez como origen de retiro.'
      using errcode = '22023';
  end if;

  -- Ninguna posición repetida como DESTINO (swap aporta a y b).
  if exists (
    with dests as (
      select (m->>'position')::smallint as pos
        from jsonb_array_elements(v_movements) m where m->>'op' = 'mount'
      union all
      select (m->>'position_a')::smallint
        from jsonb_array_elements(v_movements) m where m->>'op' = 'swap'
      union all
      select (m->>'position_b')::smallint
        from jsonb_array_elements(v_movements) m where m->>'op' = 'swap'
    )
    select 1 from dests group by pos having count(*) > 1
  ) then
    raise exception '[lote_invalido] Una posición aparece más de una vez como destino de montaje.'
      using errcode = '22023';
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 4. Lock + revalidación optimista de cada posición ORIGEN, ORDENADA por
  --    position_number (anti-deadlock). Compara el ciclo real contra el esperado.
  -- ───────────────────────────────────────────────────────────────────────────
  for v_origin in
    with origins as (
      select (m->>'position')::smallint as pos,
             (m->>'expected_life_cycle_id')::uuid as expected
        from jsonb_array_elements(v_movements) m
       where m->>'op' in ('send_to_retention', 'discard')
      union all
      select (m->>'position_a')::smallint, (m->>'expected_life_cycle_id_a')::uuid
        from jsonb_array_elements(v_movements) m where m->>'op' = 'swap'
      union all
      select (m->>'position_b')::smallint, (m->>'expected_life_cycle_id_b')::uuid
        from jsonb_array_elements(v_movements) m where m->>'op' = 'swap'
    )
    select pos, expected from origins order by pos
  loop
    select ti.life_cycle_id into v_actual
      from public.tire_installations ti
     where ti.unit_id = v_unit_id
       and ti.position_number = v_origin.pos
       and not ti.removed
     for update;

    if not found then
      raise exception '[estado_desactualizado] La posición P% de % cambió desde que armaste el lote (esperabas el ciclo %, hoy está vacía). Recargá el estado de la unidad y rearmá los movimientos.',
        v_origin.pos, v_unit.plate, v_origin.expected
        using errcode = '40001';
    end if;
    if v_actual is distinct from v_origin.expected then
      raise exception '[estado_desactualizado] La posición P% de % cambió desde que armaste el lote (esperabas el ciclo %, hoy tiene el ciclo %). Recargá el estado de la unidad y rearmá los movimientos.',
        v_origin.pos, v_unit.plate, v_origin.expected, v_actual
        using errcode = '40001';
    end if;
  end loop;

  -- ───────────────────────────────────────────────────────────────────────────
  -- El lock de unidad serializa lotes de la misma unidad. Para lotes de
  -- unidades distintas que compitan por ciclos disponibles, bloquear TODOS los
  -- ciclos tocados en orden UUID evita que payloads con orden inverso se
  -- interbloqueen dentro de fn_mount_existing_cycle/register_removal.
  for v_cycle_to_lock in
    with touched_cycles as (
      select (m->>'expected_life_cycle_id')::uuid as cycle_id
        from jsonb_array_elements(v_movements) m
       where m->>'op' in ('send_to_retention', 'discard')
      union
      select (m->>'life_cycle_id')::uuid
        from jsonb_array_elements(v_movements) m
       where m->>'op' = 'mount'
      union
      select (m->>'expected_life_cycle_id_a')::uuid
        from jsonb_array_elements(v_movements) m
       where m->>'op' = 'swap'
      union
      select (m->>'expected_life_cycle_id_b')::uuid
        from jsonb_array_elements(v_movements) m
       where m->>'op' = 'swap'
    )
    select cycle_id from touched_cycles order by cycle_id
  loop
    perform 1
      from public.tire_life_cycles lc
     where lc.id = v_cycle_to_lock
       and lc.company_id = v_profile.company_id
     for update;
  end loop;

  -- 5. Retiros (todos antes de cualquier montaje: así una posición liberada por
  --    el propio lote queda disponible como destino más abajo).
  -- ───────────────────────────────────────────────────────────────────────────
  for v_mv in select value from jsonb_array_elements(v_movements) loop
    v_op  := v_mv->>'op';
    v_seq := (v_mv->>'seq')::int;

    if v_op = 'send_to_retention' then
      v_removal := public.register_removal(
        p_life_cycle_id => (v_mv->>'expected_life_cycle_id')::uuid,
        p_removed_at    => v_performed_at,
        p_reason        => 'retention'::public.removal_reason,
        p_odometer      => v_odometer,
        p_rtd_mm        => nullif(v_mv->>'rtd_mm', '')::numeric,
        p_notes         => v_mv->>'notes'
      );
      v_results := v_results || jsonb_build_object(v_seq::text, jsonb_build_object(
        'seq', v_seq, 'op', v_op,
        'removal_id',      v_removal->>'removal_id',
        'installation_id', v_removal->>'installation_id'
      ));

    elsif v_op = 'discard' then
      v_removal := public.register_removal(
        p_life_cycle_id => (v_mv->>'expected_life_cycle_id')::uuid,
        p_removed_at    => v_performed_at,
        p_reason        => 'discard'::public.removal_reason,
        p_odometer      => v_odometer,
        p_rtd_mm        => nullif(v_mv->>'rtd_mm', '')::numeric,
        p_discard_cause => (v_mv->>'discard_cause')::public.discard_cause,
        p_photo_url     => v_mv->>'photo_url',
        p_notes         => v_mv->>'notes'
      );
      select lc.casing_id into v_casing_id
        from public.tire_life_cycles lc
       where lc.id = (v_mv->>'expected_life_cycle_id')::uuid;
      v_results := v_results || jsonb_build_object(v_seq::text, jsonb_build_object(
        'seq', v_seq, 'op', v_op,
        'removal_id', v_removal->>'removal_id',
        'casing_id',  v_casing_id
      ));

    elsif v_op = 'swap' then
      -- Retira ambos lados; el sufijo _a/_b sigue al neumático por su posición
      -- de ORIGEN (ciclo A partía de position_a, ciclo B de position_b).
      v_removal_a := public.register_removal(
        p_life_cycle_id => (v_mv->>'expected_life_cycle_id_a')::uuid,
        p_removed_at    => v_performed_at,
        p_reason        => 'rotation'::public.removal_reason,
        p_odometer      => v_odometer,
        p_rtd_mm        => nullif(v_mv->>'rtd_mm_a', '')::numeric,
        p_notes         => v_mv->>'notes'
      );
      v_removal_b := public.register_removal(
        p_life_cycle_id => (v_mv->>'expected_life_cycle_id_b')::uuid,
        p_removed_at    => v_performed_at,
        p_reason        => 'rotation'::public.removal_reason,
        p_odometer      => v_odometer,
        p_rtd_mm        => nullif(v_mv->>'rtd_mm_b', '')::numeric,
        p_notes         => v_mv->>'notes'
      );
      v_results := v_results || jsonb_build_object(v_seq::text, jsonb_build_object(
        'seq', v_seq, 'op', v_op,
        'removal_id_a', v_removal_a->>'removal_id',
        'removal_id_b', v_removal_b->>'removal_id'
      ));
    end if;
  end loop;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 6. Montajes. Los errores de dominio del ciclo suben tal cual; la ocupación
  --    conocida del helper/índice se normaliza a [posicion_ocupada].
  -- ───────────────────────────────────────────────────────────────────────────
  begin
  for v_mv in select value from jsonb_array_elements(v_movements) loop
    v_op  := v_mv->>'op';
    v_seq := (v_mv->>'seq')::int;

    if v_op = 'mount' then
      v_installation := public.fn_mount_existing_cycle(
        v_profile,
        (v_mv->>'life_cycle_id')::uuid,
        v_unit_id,
        (v_mv->>'position')::smallint,
        v_performed_at,
        v_odometer,
        nullif(v_mv->>'rtd_mm', '')::numeric,
        v_mv->>'notes'
      );
      v_results := v_results || jsonb_build_object(v_seq::text, jsonb_build_object(
        'seq', v_seq, 'op', v_op,
        'installation_id', v_installation
      ));

    elsif v_op = 'swap' then
      -- Cruzado: el ciclo A pasa a position_b y el ciclo B a position_a.
      -- installation_id_a = nueva instalación del ciclo A (ahora en position_b);
      -- installation_id_b = nueva instalación del ciclo B (ahora en position_a).
      v_inst_a := public.fn_mount_existing_cycle(
        v_profile,
        (v_mv->>'expected_life_cycle_id_a')::uuid,
        v_unit_id,
        (v_mv->>'position_b')::smallint,
        v_performed_at,
        v_odometer,
        nullif(v_mv->>'rtd_mm_a', '')::numeric,
        v_mv->>'notes'
      );
      v_inst_b := public.fn_mount_existing_cycle(
        v_profile,
        (v_mv->>'expected_life_cycle_id_b')::uuid,
        v_unit_id,
        (v_mv->>'position_a')::smallint,
        v_performed_at,
        v_odometer,
        nullif(v_mv->>'rtd_mm_b', '')::numeric,
        v_mv->>'notes'
      );
      v_results := jsonb_set(
        v_results,
        array[v_seq::text],
        (v_results->(v_seq::text)) || jsonb_build_object(
          'installation_id_a', v_inst_a,
          'installation_id_b', v_inst_b
        )
      );
    end if;
  end loop;

  -- ───────────────────────────────────────────────────────────────────────────
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'tire_installations_active_pos_uidx' then
        raise exception '[posicion_ocupada] Una posición destino de la unidad % fue ocupada mientras se aplicaba el lote. Recargá el estado y reintentá.',
          v_unit.plate using errcode = '23505';
      elsif v_constraint_name = 'tire_installations_active_cycle_uidx' then
        raise exception '[no_disponible] Un ciclo del lote ya fue montado por otra operación.'
          using errcode = '22023';
      else
        raise;
      end if;
    when raise_exception then
      if sqlerrm like '%ya está ocupada%' then
        raise exception '[posicion_ocupada] %', sqlerrm
          using errcode = '23505';
      else
        raise;
      end if;
  end;

  -- 7. Resultado en orden de seq + persistencia idempotente.
  -- ───────────────────────────────────────────────────────────────────────────
  select coalesce(jsonb_agg(v_results->(m->>'seq') order by (m->>'seq')::int), '[]'::jsonb)
    into v_out_moves
    from jsonb_array_elements(v_movements) m;

  v_result := jsonb_build_object(
    'batch_id',        v_batch_id,
    'applied',         true,
    'already_applied', false,
    'unit_id',         v_unit_id,
    'plate',           v_unit.plate,
    'movements',       v_out_moves
  );

  insert into public.tire_change_batches (
    id, company_id, unit_id, requested_by, batch_version, performed_at, payload, result
  ) values (
    v_batch_id, v_profile.company_id, v_unit_id, v_profile.id,
    1, v_performed_at, p_batch, v_result
  );

  return v_result;
end;
$$;

comment on function public.confirm_tire_change_batch(jsonb) is
  'Aplica un lote de cambios de neumáticos (payload v1) en una sola transacción, con bloqueo optimista por expected_life_cycle_id e idempotencia por batch_id. Compone register_removal y fn_mount_existing_cycle; nunca borra ni edita historia.';

-- API de escritura del cliente: solo authenticated (el rol de taller se valida
-- dentro vía fn_require_workshop_profile). Nada para public/anon.
revoke all on function public.confirm_tire_change_batch(jsonb) from public, anon;
grant execute on function public.confirm_tire_change_batch(jsonb) to authenticated;
