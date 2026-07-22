-- RENOVA — facetas explícitas para la lista de neumáticos.
--
-- Cambio aditivo: las diez columnas originales quedan en su mismo orden y
-- las cinco de faceta se agregan al final. Los valores se exponen crudos;
-- la normalización para comparar facetas pertenece al cliente.

create or replace view public.v_search_index
with (security_invoker = true) as
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
  null::text as retread_design
from public.units u
left join public.vehicle_configs vc
  on vc.id = u.config_id

union all

select
  'casing'::text as kind,
  tc.id as entity_id,
  tc.company_id,
  tc.code as label,
  concat_ws(
    ' · ',
    active_cycle.condition::text,
    active_cycle.retread_design,
    case
      when active_installation.id is not null
        then concat_ws(' ', active_unit.plate, 'P' || active_installation.position_number::text)
    end
  ) as sublabel,
  concat_ws(
    ' ',
    tc.code,
    latest_measurement.tire_code,
    tc.brand_name,
    tc.model_name,
    tc.size_name,
    active_cycle.condition::text,
    active_cycle.retread_design,
    active_unit.plate,
    active_installation.position_number::text,
    case
      when latest_measurement.brand_name is distinct from tc.brand_name
        then latest_measurement.brand_name
    end,
    case
      when latest_measurement.model_name is distinct from tc.model_name
        then latest_measurement.model_name
    end,
    case
      when latest_measurement.size_name is distinct from tc.size_name
        then latest_measurement.size_name
    end,
    case
      when latest_measurement.retread_design is distinct from active_cycle.retread_design
        then latest_measurement.retread_design
    end
  ) as haystack,
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
  active_cycle.retread_design
from public.tire_casings tc
left join public.tire_life_cycles active_cycle
  on active_cycle.casing_id = tc.id
 and active_cycle.status = 'active'::public.life_cycle_status
left join lateral (
  select ti.id, ti.unit_id, ti.position_number
  from public.tire_installations ti
  where ti.life_cycle_id = active_cycle.id
    and not ti.removed
  limit 1
) active_installation on true
left join public.units active_unit
  on active_unit.id = active_installation.unit_id
left join lateral (
  select ti.unit_id, ti.position_number
  from public.tire_life_cycles tlc
  join public.tire_installations ti
    on ti.life_cycle_id = tlc.id
  where tlc.casing_id = tc.id
  order by ti.installed_at desc, ti.created_at desc, ti.id desc
  limit 1
) latest_installation on true
left join lateral (
  select
    im.tire_code,
    im.brand_name,
    im.model_name,
    im.size_name,
    im.retread_design
  from public.inspections i
  join public.inspection_measurements im
    on im.inspection_id = i.id
  where i.unit_id = latest_installation.unit_id
    and im.position_number = latest_installation.position_number
  order by i.inspected_on desc, i.created_at desc, i.id desc
  limit 1
) latest_measurement on true;

comment on view public.v_search_index is
  'Índice de búsqueda de unidades y cascos; incluye facetas crudas de casco. Las tablas base y security_invoker preservan RLS por empresa.';

revoke all privileges on public.v_search_index from public, anon, authenticated;
grant select on public.v_search_index to authenticated;
