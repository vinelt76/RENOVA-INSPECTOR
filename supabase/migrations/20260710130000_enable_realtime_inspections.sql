-- RENOVA — Habilita Realtime (WebSocket) en las tablas que cambian con
-- save_inspection(), para que WEB/INSPECCIONES POR FECHA.html y
-- WEB/Inspecciones por unidad.html puedan refrescarse en vivo sin recargar
-- la página. RLS ya filtra por empresa
-- (20260710090000_dashboard_public_rls.sql) — Realtime respeta esa misma
-- RLS: un usuario logueado solo recibe eventos de sus propias filas.
alter publication supabase_realtime add table public.inspections;
alter publication supabase_realtime add table public.inspection_measurements;
