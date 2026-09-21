-- VULCAN Inspector — publicar el seguimiento de Movimientos en Realtime.
--
-- La UI conserva un sondeo de respaldo, pero estas tablas deben emitir eventos
-- para que Servicios refleje una toma o cierre sin esperar el siguiente ciclo.
-- La operación es idempotente para permitir reintentos seguros.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'tire_movement_orders'
  ) then
    alter publication supabase_realtime add table public.tire_movement_orders;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'tire_movement_executions'
  ) then
    alter publication supabase_realtime add table public.tire_movement_executions;
  end if;
end
$$;
