-- La numeración física de los buses alterna izquierda/derecha:
-- P1 Izq, P2 Der, P3 Izq, P4 Der, etc.
-- Corrige catálogos BUS heredados que tenían P4/P5/P6 mal etiquetadas.
update public.tire_positions as tp
set side = case when mod(tp.position_number, 2) = 1 then 'Izq' else 'Der' end
from public.vehicle_configs as vc
where vc.id = tp.config_id
  and upper(vc.vehicle_type) = 'BUS'
  and tp.side is distinct from case when mod(tp.position_number, 2) = 1 then 'Izq' else 'Der' end;
