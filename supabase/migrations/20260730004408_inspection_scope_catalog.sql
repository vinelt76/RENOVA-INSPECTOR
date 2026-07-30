-- Catálogos compactos y escalables para INSPECCIONES POR FECHA.
--
-- La pantalla ya pide las mediciones pesadas por unidad/fecha. Antes cargaba,
-- además, hasta 1000 filas crudas de inspections sólo para descubrir placas,
-- últimas inspecciones y fechas. Ese límite hacía que la navegación dejara de
-- funcionar al crecer el historial.

-- Acelera RLS + consultas por fecha global de una empresa.
create index if not exists inspections_company_date_idx
  on public.inspections (company_id, inspected_on desc);

-- Acelera "última inspección por unidad" dentro del tenant. created_at/id
-- resuelven de forma estable cualquier empate.
create index if not exists inspections_company_unit_latest_idx
  on public.inspections (
    company_id,
    unit_id,
    inspected_on desc,
    created_at desc,
    id desc
  );

create or replace view public.v_inspection_unit_latest
with (security_invoker = true) as
select distinct on (i.unit_id)
  i.company_id,
  i.id as inspection_id,
  i.unit_id,
  u.plate,
  i.inspected_on,
  i.created_at
from public.inspections i
join public.units u
  on u.id = i.unit_id
order by
  i.unit_id,
  i.inspected_on desc,
  i.created_at desc,
  i.id desc;

comment on view public.v_inspection_unit_latest is
  'Una fila compacta por unidad con su última inspección. security_invoker conserva la RLS por empresa.';

create or replace view public.v_inspection_dates
with (security_invoker = true) as
select
  i.company_id,
  i.inspected_on
from public.inspections i
group by i.company_id, i.inspected_on;

comment on view public.v_inspection_dates is
  'Fechas distintas con inspecciones. security_invoker conserva la RLS por empresa.';

-- Las vistas son APIs de lectura sólo para usuarios autenticados. PUBLIC y
-- anon no deben poder enumerar ni empresas, ni unidades, ni fechas.
revoke all on public.v_inspection_unit_latest from public, anon;
revoke all on public.v_inspection_dates from public, anon;
grant select on public.v_inspection_unit_latest to authenticated;
grant select on public.v_inspection_dates to authenticated;
