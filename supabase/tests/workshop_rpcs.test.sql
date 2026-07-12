-- RENOVA — Pruebas de las RPCs de taller y rutas (Fases 2/3/6).
--
-- Se ejecuta como UN SOLO statement (DO block). Al final SIEMPRE hace
-- `raise exception 'TESTS_PASSED'` para abortar la transacción: ningún dato
-- de prueba queda en la base. Resultado esperado: error con TESTS_PASSED.
-- Cualquier otro error = prueba fallida.
--
-- Cómo correrlo: pegar el bloque en el SQL editor de Supabase (o via MCP
-- execute_sql). Simula el usuario autenticado seteando request.jwt.claims.

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
  v_cycle2  uuid;
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

  -- ── T3: reinstalar un ciclo que ya está instalado se rechaza.
  begin
    perform public.reinstall_tire(v_cycle, v_unit_b.id, v_pos_b, current_date);
    raise exception 'T3: aceptó reinstalar un neumático ya instalado';
  exception when others then
    if sqlerrm not like '%ya está instalado%' then raise; end if;
  end;

  -- ── T4: traslado exitoso a otra unidad.
  r := public.transfer_tire(v_cycle, v_unit_b.id, v_pos_b, current_date - 20, 105000, 15.5, 200000, null);
  select count(*) into v_n from public.tire_installations
   where life_cycle_id = v_cycle and not removed;
  if v_n <> 1 then raise exception 'T4: el ciclo quedó con % instalaciones activas', v_n; end if;
  select count(*) into v_n from public.tire_removals tr
    join public.tire_installations ti on ti.id = tr.installation_id
   where ti.life_cycle_id = v_cycle and tr.reason = 'rotation';
  if v_n <> 1 then raise exception 'T4: no quedó el retiro rotation'; end if;

  -- ── T5: traslado a posición ocupada se rechaza SIN cerrar el origen (atómico).
  begin
    perform public.transfer_tire(v_cycle, v_unit_b.id, v_pos_b, current_date, null, null, null, null);
    raise exception 'T5: aceptó trasladar a posición ocupada';
  exception when others then
    if sqlerrm not like '%ocupada%' then raise; end if;
  end;
  select count(*) into v_n from public.tire_installations
   where life_cycle_id = v_cycle and not removed;
  if v_n <> 1 then raise exception 'T5: el traslado fallido dejó el origen cerrado'; end if;

  -- ── T6: retiro a retén → ciclo activo, sin instalación activa, visible en inventario.
  perform public.register_removal(v_cycle, current_date - 10, 'retention', 210000, 14.8, null, null, 'a retén');
  select count(*) into v_n from public.tire_installations where life_cycle_id = v_cycle and not removed;
  if v_n <> 0 then raise exception 'T6: quedó instalación activa tras retén'; end if;
  select inventory_status into v_txt from public.v_inventory_status where casing_id = v_casing;
  if v_txt <> 'in_inventory' then raise exception 'T6: inventario dice % en vez de in_inventory', v_txt; end if;

  -- ── T7: reinstalación desde retén en otra unidad.
  r := public.reinstall_tire(v_cycle, v_unit_a.id, v_pos_a2, current_date - 9, 211000, 14.8, null);
  select inventory_status into v_txt from public.v_inventory_status where casing_id = v_casing;
  if v_txt <> 'installed' then raise exception 'T7: inventario dice % en vez de installed', v_txt; end if;

  -- ── T8: retiro a reencauche + retread_casing crea R1 con 0 km propios.
  perform public.register_removal(v_cycle, current_date - 5, 'retread', 220000, 4.0, null, null, null);
  r := public.retread_casing(v_casing, 'KMD01', current_date - 2, 16.0, 300, 'USD');
  v_cycle2 := (r->>'life_cycle_id')::uuid;
  if (r->>'condition') <> 'R1' then raise exception 'T8: condición nueva = %', r->>'condition'; end if;
  select status::text into v_txt from public.tire_life_cycles where id = v_cycle;
  if v_txt <> 'retreaded' then raise exception 'T8: ciclo previo quedó %', v_txt; end if;
  select coalesce(cycle_km, 0) into v_n from public.v_life_cycle_performance where life_cycle_id = v_cycle2;
  if v_n <> 0 then raise exception 'T8: el ciclo R1 arrancó con % km', v_n; end if;
  select lifetime_km into v_n from public.v_casing_lifetime_performance where casing_id = v_casing;
  if v_n is null or v_n <= 0 then raise exception 'T8: el casco perdió sus km históricos'; end if;

  -- ── T9: descarte exige causa; con causa cierra ciclo y casco.
  perform public.reinstall_tire(v_cycle2, v_unit_a.id, v_pos_a2, current_date - 1, 221000, 16.0, null);
  begin
    perform public.register_removal(v_cycle2, current_date, 'discard', null, null, null, null, null);
    raise exception 'T9: aceptó descarte sin causa';
  exception when others then
    if sqlerrm not like '%causa%' then raise; end if;
  end;
  perform public.register_removal(v_cycle2, current_date, 'discard', 222000, 2.0,
    'Neumático', 'https://example.com/foto.jpg', 'corte profundo');
  select status::text into v_txt from public.tire_casings where id = v_casing;
  if v_txt <> 'discarded' then raise exception 'T9: casco quedó %', v_txt; end if;
  select inventory_status into v_txt from public.v_inventory_status where casing_id = v_casing;
  if v_txt <> 'discarded' then raise exception 'T9: inventario dice %', v_txt; end if;

  -- ── T10: aislamiento entre empresas — CRUZ no puede tocar un ciclo MOVIL.
  perform set_config('request.jwt.claims', json_build_object('sub', v_cruz.id)::text, true);
  begin
    perform public.retread_casing(v_casing, 'X', current_date, null, null, null);
    raise exception 'T10: CRUZ operó sobre un casco de MOVIL';
  exception when others then
    if sqlerrm not like '%no pertenece%' and sqlerrm not like '%no existe%' then raise; end if;
  end;

  -- ── T11: rol sin permiso de taller.
  update public.profiles set role = 'inspector' where id = v_cruz.id;
  begin
    perform public.assign_unit_route(v_unit_a.id, 'X', current_date);
    raise exception 'T11: un inspector ejecutó una operación de taller';
  exception when others then
    if sqlerrm not like '%no permite%' then raise; end if;
  end;

  -- ── T12: rutas — asignar, reasignar (cierra la anterior) y atribución.
  perform set_config('request.jwt.claims', json_build_object('sub', v_movil.id)::text, true);
  r := public.assign_unit_route(v_unit_b.id, 'Lima - Trujillo', current_date - 400,
        'Costa', 'Lima', 'Trujillo', 90000, 56::smallint, 'cama 2 pisos', null);
  r := public.assign_unit_route(v_unit_b.id, 'Lima - Huancayo', current_date - 3,
        'Sierra', 'Lima', 'Huancayo', 230000, 44::smallint, null, null);
  select count(*) into v_n from public.unit_route_assignments
   where unit_id = v_unit_b.id and ended_on is null;
  if v_n <> 1 then raise exception 'T12: quedaron % asignaciones vigentes', v_n; end if;
  -- La instalación T4 (día -20 a -10, dentro de Lima-Trujillo) debe atribuirse 'full'.
  select a.attribution_quality into v_txt
    from public.v_installation_route_attribution a
   where a.life_cycle_id = v_cycle and a.unit_id = v_unit_b.id;
  if v_txt <> 'full' then raise exception 'T12: atribución = % (esperaba full)', coalesce(v_txt,'NULL'); end if;

  -- ── T13: la vista comparativa expone el ciclo con sus dimensiones.
  select count(*) into v_n from public.v_comparison_cycle_rows where casing_id = v_casing;
  if v_n <> 2 then raise exception 'T13: % filas para el casco (esperaba 2 ciclos)', v_n; end if;

  raise exception 'TESTS_PASSED';
end;
$$;
