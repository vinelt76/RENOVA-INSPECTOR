-- Catálogo liviano para el buscador analítico: una inspección reciente por
-- unidad y solo columnas necesarias para filtros/tarjetas, sin canales/fotos.
create or replace view public.v_inspection_latest_facets
with (security_invoker = true) as
with latest as (
  select distinct on (i.unit_id) i.id, i.unit_id
  from public.inspections i
  order by i.unit_id, i.inspected_on desc, i.created_at desc, i.id desc
)
select
  v.company_id, v.company_name, v.unit_id, v.plate, v.inspection_id, v.inspected_on,
  v.position_number, v.side, v.axle_number, v.axle_type, v.tire_code, v.casing_code,
  v.brand_name, v.model_name, v.size_name, v.condition, v.retread_design,
  v.rtd_movi_mm, v.anomaly, v.tire_status, v.retread_observation
from public.v_inspection_dashboard_rows v
join latest l on l.id = v.inspection_id;

grant select on public.v_inspection_latest_facets to authenticated;
