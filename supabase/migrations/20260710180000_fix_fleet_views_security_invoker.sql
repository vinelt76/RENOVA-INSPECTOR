-- BUG DE SEGURIDAD: v_unit_tire_status/v_fleet_unit_status/v_fleet_status_summary
-- se recrearon en 20260710170000_fleet_status_add_company_name sin
-- security_invoker=true. Sin ese flag una vista corre con permisos del OWNER
-- (postgres), no del usuario que consulta — se salta la RLS por completo.
-- Confirmado en vivo: un usuario autenticado como ITTSABUS (0 unidades
-- propias) veía las 97 unidades de MÓVIL BUS en Vista de Flota
-- (INSPECCIONES POR FECHA.html).
--
-- Mismo fix que ya tenían v_inspection_dashboard_rows y
-- v_rendimiento_dashboard_rows (creadas con with (security_invoker = true)
-- desde el inicio) — faltó acá por descuido al recrear estas 3 vistas.

alter view public.v_unit_tire_status set (security_invoker = true);
alter view public.v_fleet_unit_status set (security_invoker = true);
alter view public.v_fleet_status_summary set (security_invoker = true);
