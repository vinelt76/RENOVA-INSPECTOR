-- RUN 6 (2026-07-07) — copia de las migraciones APLICADAS al proyecto demo
-- fbxupwwgiebhlciqftpw (remotas: run6_rendimiento_source_view_and_save_inspection
-- + run6_save_inspection_fix_measurement_id, ya consolidadas aquí).
--
-- (1) v_rendimiento_dashboard_rows — vista ADITIVA de solo lectura: expone los
--     datos FUENTE (instalación + última inspección) detrás de cada métrica de
--     rendimiento, además de las métricas ya derivadas por v_tire_performance.
-- (2) save_inspection(payload jsonb) — RPC del sync mínimo app → Supabase.
--     Es exactamente el RPC que app/src/sync/pushInspeccion.ts ya invocaba.
--
-- No toca tablas existentes. No almacena datos derivados. Solo objetos nuevos.

create or replace view public.v_rendimiento_dashboard_rows
with (security_invoker = true) as
select
  p.*,
  co.name  as company_name,
  cs.code_status,
  tp.side,
  ax.axle_number,
  ax.axle_type,
  rt.rtd_removal_mm,
  li.inspection_id  as last_inspection_id,
  li.odometer_km    as last_inspection_odometer_km,
  li.rtd_a_mm,
  li.rtd_b_mm,
  li.rtd_c_mm,
  li.rtd_d_mm,
  li.rtd_movi_mm    as last_rtd_movi_mm,
  li.rtd_state      as last_rtd_state,
  li.pressure_psi,
  li.pressure_state,
  li.valve_cap,
  li.anomaly,
  li.inspector_name
from public.v_tire_performance p
join public.companies co   on co.id = p.company_id
join public.tire_casings cs on cs.id = p.casing_id
join public.units u        on u.id = p.unit_id
left join public.tire_positions tp
       on tp.config_id = u.config_id and tp.position_number = p.position_number
left join public.axles ax  on ax.id = tp.axle_id
left join lateral (
  select rt1.rtd_removal_mm
  from public.rtd_thresholds rt1
  where rt1.company_id = p.company_id
    and (rt1.size_name = p.size_name or rt1.size_name is null)
  order by rt1.size_name
  limit 1
) rt on true
left join lateral (
  select m.inspection_id, i.odometer_km,
         m.rtd_a_mm, m.rtd_b_mm, m.rtd_c_mm, m.rtd_d_mm,
         m.rtd_movi_mm, m.rtd_state, m.pressure_psi, m.pressure_state,
         m.valve_cap, m.anomaly, pr.full_name as inspector_name
  from public.inspection_measurements m
  join public.inspections i on i.id = m.inspection_id
  left join public.profiles pr on pr.id = i.inspector_id
  where i.unit_id = p.unit_id and m.position_number = p.position_number
  order by i.inspected_on desc
  limit 1
) li on true;

comment on view public.v_rendimiento_dashboard_rows is
  'RUN6: fila por instalación activa con datos FUENTE (instalación + última inspección) y métricas derivadas (v_tire_performance). Consumida por rendimiento.html. Posiciones 1 y 2 quedan fuera del alcance de rendimiento por diseño (el Excel real no las evalúa).';

create or replace function public.save_inspection(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company   public.companies%rowtype;
  v_unit      public.units%rowtype;
  v_config_id uuid;
  v_inspection_id uuid;
  v_local_id  uuid;
  v_plate     text;
  v_date      date;
  v_odo       integer;
  item        jsonb;
  v_count     integer := 0;
  v_pos       smallint;
  v_code_raw  text;
  v_code      text;
  v_movi      numeric;
  v_lc        uuid;
  v_cond      public.tire_condition;
  v_state     public.rtd_state;
begin
  -- Empresa: por nombre si viene en el payload; si no, la única activa (demo).
  if payload ? 'company_name' and nullif(payload->>'company_name','') is not null then
    select * into v_company from public.companies
     where lower(name) = lower(payload->>'company_name') limit 1;
  end if;
  if v_company.id is null then
    select * into v_company from public.companies where active order by created_at limit 1;
  end if;
  if v_company.id is null then
    raise exception 'save_inspection: no hay empresa destino';
  end if;

  v_plate := nullif(trim(payload->>'plate_number'), '');
  v_date  := (payload->>'inspection_date')::date;
  v_odo   := (payload->>'odometer_km')::integer;
  if v_plate is null then raise exception 'save_inspection: plate_number requerido'; end if;
  if v_date  is null then raise exception 'save_inspection: inspection_date requerida'; end if;
  if v_odo   is null then raise exception 'save_inspection: odometer_km requerido'; end if;

  begin
    v_local_id := nullif(payload->>'local_id','')::uuid;
  exception when others then
    v_local_id := null; -- local_id no-UUID: se ignora, se genera uno nuevo
  end;

  -- Unidad: (empresa, placa) → upsert. Unidad nueva queda pending_validation.
  select * into v_unit from public.units
   where company_id = v_company.id and plate = v_plate;
  if v_unit.id is null then
    select id into v_config_id from public.vehicle_configs
     where notation = payload->>'configuration' limit 1;
    if v_config_id is null then
      -- default demo documentado: BUS 2-4-2 (la unidad queda pending_validation)
      select id into v_config_id from public.vehicle_configs
       where notation = '2-4-2' limit 1;
    end if;
    insert into public.units (company_id, plate, vehicle_type, config_id, status)
    values (v_company.id, v_plate, coalesce(nullif(payload->>'vehicle_type',''),'BUS'),
            v_config_id, 'pending_validation')
    returning * into v_unit;
  end if;

  -- Cabecera: una inspección por unidad por día (LWW sobre odómetro).
  -- El UUID local del dispositivo se usa como id → reintentos no duplican.
  select id into v_inspection_id from public.inspections
   where unit_id = v_unit.id and inspected_on = v_date;
  if v_inspection_id is not null then
    update public.inspections
       set odometer_km = v_odo, updated_at = now()
     where id = v_inspection_id;
  else
    insert into public.inspections (id, company_id, unit_id, inspected_on, odometer_km, device_created_at)
    values (coalesce(v_local_id, gen_random_uuid()), v_company.id, v_unit.id, v_date, v_odo, now())
    on conflict (id) do update set odometer_km = excluded.odometer_km, updated_at = now()
    returning id into v_inspection_id;
  end if;

  update public.units
     set last_odometer     = greatest(coalesce(last_odometer, 0), v_odo),
         last_inspected_at = greatest(coalesce(last_inspected_at, v_date), v_date),
         updated_at        = now()
   where id = v_unit.id;

  for item in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) loop
    v_pos := nullif(regexp_replace(item->>'position', '[^0-9]', '', 'g'), '')::smallint;
    continue when v_pos is null;

    -- Regla N/V: NO es un código real → NULL (la medición vale igual:
    -- unidad + posición conocidas). El code_status del casco vive en tire_casings.
    v_code_raw := nullif(trim(item->>'tire_code'), '');
    v_code := case when upper(coalesce(v_code_raw,'')) in ('N/V','NV','N-V') then null
                   else v_code_raw end;

    -- RTD MOVI: el que calculó la app o, en su defecto, MIN de canales medidos
    v_movi := coalesce(
      (item->>'rtd_movi')::numeric,
      least((item->>'rtd_a')::numeric, (item->>'rtd_b')::numeric,
            (item->>'rtd_c')::numeric, (item->>'rtd_d')::numeric)
    );

    -- Resolución de ciclo: instalación ACTIVA por unidad+posición. El código
    -- observado NO resuelve por sí solo; si difiere del casco instalado, la
    -- discrepancia queda visible comparando tire_code vs casing en las vistas
    -- (nunca se fusiona en silencio).
    v_lc := null;
    select ti.life_cycle_id into v_lc
      from public.tire_installations ti
     where ti.unit_id = v_unit.id and ti.position_number = v_pos and not ti.removed
     order by ti.installed_at desc
     limit 1;

    v_cond := case
      when upper(coalesce(item->>'tire_condition','')) in ('N','R1','R2','R3','R4')
        then upper(item->>'tire_condition')::public.tire_condition
      when item->>'tire_condition' ilike 'nuev%' then 'N'::public.tire_condition
      else null
    end;

    -- ESTADO RTD server-side con umbrales por empresa/medida (nunca hardcodeado)
    v_state := public.fn_rtd_state(v_company.id, item->>'tire_size', v_movi);

    insert into public.inspection_measurements (
      id, company_id, inspection_id, position_number, life_cycle_id,
      tire_code, brand_name, model_name, size_name, condition, retread_design,
      rtd_a_mm, rtd_b_mm, rtd_c_mm, rtd_d_mm,
      pressure_psi, valve_cap, anomaly,
      rtd_movi_mm, rtd_state, pressure_state, is_discard, device_updated_at
    ) values (
      gen_random_uuid(), v_company.id, v_inspection_id, v_pos, v_lc,
      v_code,
      nullif(item->>'tire_brand',''),
      nullif(item->>'original_design',''),
      nullif(item->>'tire_size',''),
      v_cond,
      nullif(item->>'current_design',''),
      (item->>'rtd_a')::numeric, (item->>'rtd_b')::numeric,
      (item->>'rtd_c')::numeric, (item->>'rtd_d')::numeric,
      (item->>'pressure')::numeric,
      nullif(item->>'valve_cap',''),
      nullif(item->>'tire_anomaly',''),
      v_movi,
      v_state,
      case when (item->>'pressure') is null then 'Sin Medir'::public.pressure_state
           else null end, -- referencia de presión por empresa: pendiente (no se inventa)
      coalesce((item->>'scrap')::boolean, false),
      now()
    )
    on conflict (inspection_id, position_number) do update set
      life_cycle_id  = excluded.life_cycle_id,
      tire_code      = excluded.tire_code,
      brand_name     = excluded.brand_name,
      model_name     = excluded.model_name,
      size_name      = excluded.size_name,
      condition      = excluded.condition,
      retread_design = excluded.retread_design,
      rtd_a_mm = excluded.rtd_a_mm, rtd_b_mm = excluded.rtd_b_mm,
      rtd_c_mm = excluded.rtd_c_mm, rtd_d_mm = excluded.rtd_d_mm,
      pressure_psi = excluded.pressure_psi,
      valve_cap    = excluded.valve_cap,
      anomaly      = excluded.anomaly,
      rtd_movi_mm  = excluded.rtd_movi_mm,
      rtd_state    = excluded.rtd_state,
      pressure_state = excluded.pressure_state,
      is_discard   = excluded.is_discard,
      device_updated_at = excluded.device_updated_at,
      updated_at   = now();

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'inspection_id', v_inspection_id,
    'unit_id', v_unit.id,
    'plate', v_plate,
    'inspected_on', v_date,
    'measurements', v_count
  );
end;
$$;

comment on function public.save_inspection(jsonb) is
  'RUN6: sync mínimo app→Supabase (demo). Payload = el que arma app/src/sync/pushInspeccion.ts. Idempotente por (unidad, fecha) y (inspección, posición). SOLO demo sin RLS: revisar antes de producción.';

grant execute on function public.save_inspection(jsonb) to anon, authenticated;
