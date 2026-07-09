-- RENOVA — Fix: v_axle_performance clasificaba mal las posiciones por eje.
-- Estaba viva en la base (creada directo en el SQL editor, sin migración
-- committeada) con rangos incorrectos: Tracción=(3,4), Libre=(5,6,7,8).
-- La regla correcta (specs/catalogo_patron.md, BUS 2-4-2): Dirección=(1,2),
-- Tracción=(3,4,5,6), Libre=(7,8).
create or replace view public.v_axle_performance as
select
  plate,
  case
    when position_number in (1,2) then 'Dirección'
    when position_number in (3,4,5,6) then 'Tracción'
    when position_number in (7,8) then 'Libre'
    else 'Otro'
  end as axle_name,

  count(*) as tires_count,
  avg(km_run) as avg_km_run,
  avg(km_per_mm) as avg_km_per_mm,
  min(current_rtd_mm) as worst_rtd_mm,
  max(current_rtd_mm) as best_rtd_mm

from public.v_tire_performance
group by plate, axle_name;
