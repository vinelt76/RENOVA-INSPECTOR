-- Trayectoria del casco: una rotación es dos instalaciones consecutivas del
-- mismo ciclo. La interpretación de origen/destino vive aquí (no en la UI),
-- junto con el motivo real de retiro.
create or replace view public.v_casing_installations
with (security_invoker = true) as
with installation_path as (
  select
    ti.id,
    ti.life_cycle_id,
    lead(ti.unit_id) over installation_order as next_unit_id,
    lead(ti.position_number) over installation_order as next_position_number
  from public.tire_installations ti
  window installation_order as (
    partition by ti.life_cycle_id
    order by ti.installed_at, ti.created_at, ti.id
  )
)
select
  cs.id as casing_id,
  cs.company_id,
  cs.code as casing_code,
  lc.cycle_number,
  lc.condition,
  k.installation_id,
  u.plate,
  k.position_number,
  k.installed_at,
  k.removed,
  k.removed_at,
  k.odometer_at_install,
  k.end_odometer,
  k.end_odometer_source,
  k.km_run,
  tr.reason::text as removal_reason,
  next_unit.plate as next_plate,
  path.next_position_number
from public.tire_casings cs
join public.tire_life_cycles lc
  on lc.casing_id = cs.id
join public.v_installation_km k
  on k.life_cycle_id = lc.id
join public.units u
  on u.id = k.unit_id
join installation_path path
  on path.id = k.installation_id
left join public.tire_removals tr
  on tr.installation_id = k.installation_id
left join public.units next_unit
  on next_unit.id = path.next_unit_id;

grant select on public.v_casing_installations to authenticated;

-- El índice conserva los resultados canónicos (unidad/casco) y añade, en
-- columnas finales, la inspección de los códigos que aún no tienen casco.
-- Así se pueden encontrar sin inventar un historial inexistente.
create or replace view public.v_search_index
with (security_invoker = true) as
with unlinked_inspections as (
  select distinct on (i.company_id, im.tire_code)
    im.id as measurement_id,
    i.id as inspection_id,
    i.company_id,
    i.inspected_on,
    i.created_at as inspection_created_at,
    u.plate,
    im.position_number,
    im.tire_code,
    im.brand_name,
    im.model_name,
    im.size_name,
    im.condition,
    im.retread_design
  from public.inspection_measurements im
  join public.inspections i on i.id = im.inspection_id
  join public.units u on u.id = i.unit_id
  where nullif(trim(im.tire_code), '') is not null
    and not exists (
      select 1
      from public.tire_casings tc
      where tc.company_id = i.company_id
        and tc.code = im.tire_code
    )
  order by i.company_id, im.tire_code, i.inspected_on desc, i.created_at desc, im.id desc
)
select
  'unit'::text as kind,
  u.id as entity_id,
  u.company_id,
  u.plate as label,
  concat_ws(' · ', u.vehicle_type, vc.notation) as sublabel,
  concat_ws(' ', u.plate, u.vehicle_type, vc.notation) as haystack,
  u.status::text as status,
  u.plate as unit_plate,
  null::integer as position_number,
  null::text as casing_code,
  null::text as brand_name,
  null::text as model_name,
  null::text as size_name,
  null::text as condition,
  null::text as retread_design,
  null::uuid as inspection_id
from public.units u
left join public.vehicle_configs vc on vc.id = u.config_id

union all

select
  'casing'::text as kind,
  tc.id as entity_id,
  tc.company_id,
  tc.code as label,
  concat_ws(' · ', active_cycle.condition::text, active_cycle.retread_design,
    case when active_installation.id is not null
      then concat_ws(' ', active_unit.plate, 'P' || active_installation.position_number::text)
    end) as sublabel,
  concat_ws(' ', tc.code, latest_measurement.tire_code, tc.brand_name, tc.model_name,
    tc.size_name, active_cycle.condition::text, active_cycle.retread_design,
    active_unit.plate, active_installation.position_number::text,
    case when latest_measurement.brand_name is distinct from tc.brand_name then latest_measurement.brand_name end,
    case when latest_measurement.model_name is distinct from tc.model_name then latest_measurement.model_name end,
    case when latest_measurement.size_name is distinct from tc.size_name then latest_measurement.size_name end,
    case when latest_measurement.retread_design is distinct from active_cycle.retread_design then latest_measurement.retread_design end) as haystack,
  case
    when tc.status = 'discarded'::public.casing_status then 'discarded'
    when active_cycle.id is not null and active_installation.id is not null then 'installed'
    when active_cycle.id is not null then 'in_inventory'
    else null
  end as status,
  active_unit.plate as unit_plate,
  active_installation.position_number::integer as position_number,
  tc.code as casing_code,
  tc.brand_name,
  tc.model_name,
  tc.size_name,
  active_cycle.condition::text as condition,
  active_cycle.retread_design,
  null::uuid as inspection_id
from public.tire_casings tc
left join public.tire_life_cycles active_cycle
  on active_cycle.casing_id = tc.id
 and active_cycle.status = 'active'::public.life_cycle_status
left join lateral (
  select ti.id, ti.unit_id, ti.position_number
  from public.tire_installations ti
  where ti.life_cycle_id = active_cycle.id and not ti.removed
  limit 1
) active_installation on true
left join public.units active_unit on active_unit.id = active_installation.unit_id
left join lateral (
  select ti.unit_id, ti.position_number
  from public.tire_life_cycles tlc
  join public.tire_installations ti on ti.life_cycle_id = tlc.id
  where tlc.casing_id = tc.id
  order by ti.installed_at desc, ti.created_at desc, ti.id desc
  limit 1
) latest_installation on true
left join lateral (
  select im.tire_code, im.brand_name, im.model_name, im.size_name, im.retread_design
  from public.inspections i
  join public.inspection_measurements im on im.inspection_id = i.id
  where i.unit_id = latest_installation.unit_id
    and im.position_number = latest_installation.position_number
  order by i.inspected_on desc, i.created_at desc, i.id desc
  limit 1
) latest_measurement on true

union all

select
  'inspection'::text as kind,
  ui.measurement_id as entity_id,
  ui.company_id,
  ui.tire_code as label,
  concat_ws(' · ', ui.plate, 'P' || ui.position_number::text, 'Sin casco vinculado') as sublabel,
  concat_ws(' ', ui.tire_code, ui.brand_name, ui.model_name, ui.size_name,
    ui.condition::text, ui.retread_design, ui.plate, ui.position_number::text,
    'sin casco vinculado') as haystack,
  'unlinked'::text as status,
  ui.plate as unit_plate,
  ui.position_number::integer as position_number,
  null::text as casing_code,
  ui.brand_name,
  ui.model_name,
  ui.size_name,
  ui.condition::text as condition,
  ui.retread_design,
  ui.inspection_id
from unlinked_inspections ui;

comment on view public.v_search_index is
  'Índice RLS de unidades, cascos y mediciones sin casco vinculado; estas últimas abren su inspección, no un historial inventado.';

revoke all privileges on public.v_search_index from public, anon, authenticated;
grant select on public.v_search_index to authenticated;
