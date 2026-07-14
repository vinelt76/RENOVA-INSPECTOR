-- RENOVA — Lecturas completas para cambios de neumáticos.
--
-- v_unit_position_state conserva una fila por cada posición configurada,
-- aunque no haya una instalación activa ni una inspección para esa posición.
-- v_tire_inventory_available deriva el retén desde el estado vigente del
-- ciclo/casco y la ausencia de una instalación activa.

create or replace view public.v_unit_position_state
with (security_invoker = true) as
select
  u.company_id,
  u.id as unit_id,
  u.plate,
  u.config_id,
  tp.position_number,
  tp.side,
  a.axle_number,
  a.axle_type,
  tp.is_ground,
  ti.id as installation_id,
  ti.life_cycle_id,
  tlc.casing_id,
  tc.code as casing_code,
  tc.brand_name,
  tc.model_name,
  tc.size_name,
  tlc.condition,
  tlc.retread_design,
  tlc.cycle_number,
  ti.installed_at,
  ti.odometer_at_install,
  ti.rtd_at_install_mm,
  ti.id is null as is_empty,
  last_measurement.inspected_on as last_inspected_on,
  last_measurement.rtd_movi_mm as last_rtd_movi_mm,
  last_measurement.pressure_psi as last_pressure_psi,
  last_measurement.tire_code as last_inspection_tire_code,
  ti.id is not null
    and upper(btrim(last_measurement.tire_code))
        is distinct from upper(btrim(tc.code)) as code_mismatch
from public.units u
join public.tire_positions tp
  on tp.config_id = u.config_id
join public.axles a
  on a.id = tp.axle_id
left join public.tire_installations ti
  on ti.unit_id = u.id
 and ti.position_number = tp.position_number
 and not ti.removed
left join public.tire_life_cycles tlc
  on tlc.id = ti.life_cycle_id
left join public.tire_casings tc
  on tc.id = tlc.casing_id
left join lateral (
  select
    i.inspected_on,
    im.rtd_movi_mm,
    im.pressure_psi,
    im.tire_code
  from public.inspections i
  join public.inspection_measurements im
    on im.inspection_id = i.id
  where i.unit_id = u.id
    and im.position_number = tp.position_number
  order by i.inspected_on desc
  limit 1
) last_measurement on true;

comment on view public.v_unit_position_state is
  'Estado de todas las posiciones configuradas de cada unidad. is_empty=true significa que no existe una instalación activa, aunque puede existir una medición legada. code_mismatch=true cuando hay instalación activa y el código de su casco difiere del código de la última inspección tras normalizar ambos con trim/upper; NULL también participa mediante IS DISTINCT FROM.';

revoke all privileges on public.v_unit_position_state
  from public, anon, authenticated;
grant select on public.v_unit_position_state to authenticated;


create or replace view public.v_tire_inventory_available
with (security_invoker = true) as
select
  tlc.company_id,
  tlc.id as life_cycle_id,
  tc.id as casing_id,
  tc.code as casing_code,
  tc.brand_name,
  tc.model_name,
  tc.size_name,
  tlc.condition,
  tlc.cycle_number,
  tlc.retread_design,
  tlc.otd_mm,
  last_removal.removed_at as last_removed_at,
  last_removal.reason as last_removal_reason,
  last_removal.rtd_at_removal_mm as last_rtd_mm,
  current_date - last_removal.removed_at as days_in_inventory
from public.tire_life_cycles tlc
join public.tire_casings tc
  on tc.id = tlc.casing_id
left join lateral (
  select
    tr.removed_at,
    tr.reason,
    tr.rtd_at_removal_mm
  from public.tire_installations ti_history
  join public.tire_removals tr
    on tr.installation_id = ti_history.id
  where ti_history.life_cycle_id = tlc.id
  order by tr.removed_at desc, tr.created_at desc, tr.id desc
  limit 1
) last_removal on true
where tlc.status = 'active'::public.life_cycle_status
  and tc.status = 'active'::public.casing_status
  and not exists (
    select 1
    from public.tire_installations active_installation
    where active_installation.life_cycle_id = tlc.id
      and not active_installation.removed
  );

comment on view public.v_tire_inventory_available is
  'Inventario/retén derivado: ciclos y cascos activos sin instalación activa. No es un estado almacenado ni reemplaza v_inventory_status. El último retiro se ordena por fecha/creación/id; los ciclos nunca instalados se incluyen con datos de retiro y days_in_inventory NULL.';

revoke all privileges on public.v_tire_inventory_available
  from public, anon, authenticated;
grant select on public.v_tire_inventory_available to authenticated;
