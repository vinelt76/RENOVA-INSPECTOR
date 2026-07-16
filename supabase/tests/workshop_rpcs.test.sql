-- RENOVA — Pruebas de las RPCs de taller y rutas (Fases 2/3/6).
--
-- Se ejecuta como UN SOLO statement (DO block). Al final SIEMPRE hace
-- `raise exception 'TESTS_PASSED'` para abortar la transacción: ningún dato
-- de prueba queda en la base. Resultado esperado: error con TESTS_PASSED.
-- Cualquier otro error = prueba fallida.
--
-- Cómo correrlo: pegar el bloque en el SQL editor de Supabase (o via MCP
-- execute_sql). Simula el usuario autenticado seteando request.jwt.claims.
--
-- Nota: reinstall_tire, retread_casing y v_comparison_cycle_rows eran
-- exclusivos de la pantalla Inventario/Comparativo (retiradas del dashboard
-- web) y ya no existen — sus casos de prueba se quitaron de este archivo.

do $$
declare
  v_movil   public.profiles%rowtype;
  v_cruz    public.profiles%rowtype;
  v_unit_a  public.units%rowtype;
  v_unit_b  public.units%rowtype;
  v_pos_a   smallint;
  v_pos_a2  smallint;
  v_pos_b   smallint;
  r         jsonb;
  v_cycle   uuid;
  v_casing  uuid;
  v_cycle3  uuid;
  v_casing3 uuid;
  v_n       integer;
  v_txt     text;
begin
  -- ── Setup: perfiles reales de dos empresas y dos unidades MOVIL con
  --    posiciones libres en su configuración.
  select p.* into v_movil from public.profiles p
    join public.companies c on c.id = p.company_id
   where c.name ilike '%MÓVIL%' or c.name ilike '%MOVIL%' limit 1;
  select p.* into v_cruz from public.profiles p
    join public.companies c on c.id = p.company_id
   where c.name ilike '%CRUZ%' limit 1;
  if v_movil.id is null or v_cruz.id is null then
    raise exception 'SETUP: faltan perfiles MOVIL/CRUZ';
  end if;

  select u.* into v_unit_a from public.units u
   where u.company_id = v_movil.company_id
     and exists (select 1 from public.tire_positions tp where tp.config_id = u.config_id)
   order by u.plate limit 1;
  select u.* into v_unit_b from public.units u
   where u.company_id = v_movil.company_id and u.id <> v_unit_a.id
     and exists (select 1 from public.tire_positions tp where tp.config_id = u.config_id)
   order by u.plate limit 1;

  select tp.position_number into v_pos_a from public.tire_positions tp
   where tp.config_id = v_unit_a.config_id
     and not exists (select 1 from public.tire_installations ti
                      where ti.unit_id = v_unit_a.id
                        and ti.position_number = tp.position_number and not ti.removed)
   order by tp.position_number limit 1;
  select tp.position_number into v_pos_a2 from public.tire_positions tp
   where tp.config_id = v_unit_a.config_id and tp.position_number <> v_pos_a
     and not exists (select 1 from public.tire_installations ti
                      where ti.unit_id = v_unit_a.id
                        and ti.position_number = tp.position_number and not ti.removed)
   order by tp.position_number limit 1;
  select tp.position_number into v_pos_b from public.tire_positions tp
   where tp.config_id = v_unit_b.config_id
     and not exists (select 1 from public.tire_installations ti
                      where ti.unit_id = v_unit_b.id
                        and ti.position_number = tp.position_number and not ti.removed)
   order by tp.position_number limit 1;
  if v_pos_a is null or v_pos_a2 is null or v_pos_b is null then
    raise exception 'SETUP: no hay posiciones libres para probar';
  end if;

  -- Simular sesión del fleet_manager de MOVIL.
  perform set_config('request.jwt.claims', json_build_object('sub', v_movil.id)::text, true);

  -- ── T1: instalación desde cero en posición libre.
  r := public.register_full_installation(
    'TEST-0001','MICHELIN','X MULTI Z','295/80R22.5','N',
    v_unit_a.id, v_pos_a, current_date - 30,
    null, 17.0, 850, 'USD', 100000, 17.0, 'prueba automatizada');
  v_cycle  := (r->>'life_cycle_id')::uuid;
  v_casing := (r->>'casing_id')::uuid;
  if v_cycle is null then raise exception 'T1: no devolvió life_cycle_id'; end if;

  -- ── T2: la misma posición ocupada se rechaza con mensaje claro.
  begin
    perform public.register_full_installation(
      'TEST-0002','GOODYEAR','KMAX','295/80R22.5','N',
      v_unit_a.id, v_pos_a, current_date, null, 17.0, 800, 'USD', null, null, null);
    raise exception 'T2: aceptó instalar en posición ocupada';
  exception when others then
    if sqlerrm not like '%ocupada%' then raise; end if;
  end;

  -- ── T3: traslado exitoso a otra unidad.
  r := public.transfer_tire(v_cycle, v_unit_b.id, v_pos_b, current_date - 20, 105000, 15.5, 200000, null);
  select count(*) into v_n from public.tire_installations
   where life_cycle_id = v_cycle and not removed;
  if v_n <> 1 then raise exception 'T3: el ciclo quedó con % instalaciones activas', v_n; end if;
  select count(*) into v_n from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id = v_cycle and tr.reason = 'rotation';
  if v_n <> 1 then raise exception 'T3: no quedó el retiro rotation'; end if;

  -- ── T4: traslado a posición ocupada se rechaza SIN cerrar el origen (atómico).
  begin
    perform public.transfer_tire(v_cycle, v_unit_b.id, v_pos_b, current_date, null, null, null, null);
    raise exception 'T4: aceptó trasladar a posición ocupada';
  exception when others then
    if sqlerrm not like '%ocupada%' then raise; end if;
  end;
  select count(*) into v_n from public.tire_installations
   where life_cycle_id = v_cycle and not removed;
  if v_n <> 1 then raise exception 'T4: el traslado fallido dejó el origen cerrado'; end if;

  -- ── T5: descarte exige causa; con causa cierra ciclo y casco (baja definitiva).
  --    Se hace mientras v_cycle sigue activo en unit_b/pos_b (recién trasladado).
  begin
    perform public.register_removal(v_cycle, current_date, 'discard', null, null, null, null, null);
    raise exception 'T5: aceptó descarte sin causa';
  exception when others then
    if sqlerrm not like '%causa%' then raise; end if;
  end;
  perform public.register_removal(v_cycle, current_date - 10, 'discard', 222000, 2.0,
    'Corte profundo en flanco', 'https://example.com/foto.jpg', 'corte profundo');
  select status::text into v_txt from public.tire_casings where id = v_casing;
  if v_txt <> 'discarded' then raise exception 'T5: casco quedó %', v_txt; end if;
  select inventory_status into v_txt from public.v_inventory_status where casing_id = v_casing;
  if v_txt <> 'discarded' then raise exception 'T5: inventario dice %', v_txt; end if;

  -- ── T6: retiro a retén (rotación/retén/otro) → ciclo activo, sin instalación
  --    activa, visible como in_inventory. Usa un casco nuevo (el de T1/T5 ya
  --    está descartado).
  r := public.register_full_installation(
    'TEST-0003','BRIDGESTONE','R150','295/80R22.5','N',
    v_unit_a.id, v_pos_a2, current_date - 5, null, 17.0, 800, 'USD', 90000, 17.0, null);
  v_cycle3  := (r->>'life_cycle_id')::uuid;
  v_casing3 := (r->>'casing_id')::uuid;
  perform public.register_removal(v_cycle3, current_date, 'retention', 95000, 14.8, null, null, 'a retén');
  select count(*) into v_n from public.tire_installations where life_cycle_id = v_cycle3 and not removed;
  if v_n <> 0 then raise exception 'T6: quedó instalación activa tras retén'; end if;
  select inventory_status into v_txt from public.v_inventory_status where casing_id = v_casing3;
  if v_txt <> 'in_inventory' then raise exception 'T6: inventario dice % en vez de in_inventory', v_txt; end if;

  -- ── T7: aislamiento entre empresas — CRUZ no puede tocar un ciclo MOVIL.
  perform set_config('request.jwt.claims', json_build_object('sub', v_cruz.id)::text, true);
  begin
    perform public.register_removal(v_cycle3, current_date, 'rotation', null, null, null, null, null);
    raise exception 'T7: CRUZ operó sobre un ciclo de MOVIL';
  exception when others then
    if sqlerrm not like '%no tiene una instalación activa%' then raise; end if;
  end;

  -- ── T8: rol sin permiso de taller.
  update public.profiles set role = 'inspector' where id = v_cruz.id;
  begin
    perform public.assign_unit_route(v_unit_a.id, 'X', current_date);
    raise exception 'T8: un inspector ejecutó una operación de taller';
  exception when others then
    if sqlerrm not like '%no permite%' then raise; end if;
  end;

  -- ── T9: rutas — asignar, reasignar (cierra la anterior) y atribución.
  perform set_config('request.jwt.claims', json_build_object('sub', v_movil.id)::text, true);
  r := public.assign_unit_route(v_unit_b.id, 'Lima - Trujillo', current_date - 400,
        'Costa', 'Lima', 'Trujillo', 90000, 56::smallint, 'cama 2 pisos', null);
  r := public.assign_unit_route(v_unit_b.id, 'Lima - Huancayo', current_date - 3,
        'Sierra', 'Lima', 'Huancayo', 230000, 44::smallint, null, null);
  select count(*) into v_n from public.unit_route_assignments
   where unit_id = v_unit_b.id and ended_on is null;
  if v_n <> 1 then raise exception 'T9: quedaron % asignaciones vigentes', v_n; end if;
  -- La instalación T3 (día -20 a -10, dentro de Lima-Trujillo) debe atribuirse 'full'.
  select a.attribution_quality into v_txt
    from public.v_installation_route_attribution a
   where a.life_cycle_id = v_cycle and a.unit_id = v_unit_b.id;
  if v_txt <> 'full' then raise exception 'T9: atribución = % (esperaba full)', coalesce(v_txt,'NULL'); end if;

  raise exception 'TESTS_PASSED';
end;
$$;
