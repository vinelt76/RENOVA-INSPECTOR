-- Reversión de 20260716110000_baseline_mount_rpc_and_gate.sql.
-- No borra filas de línea base ya confirmadas: son historia de negocio.

drop function if exists public.confirm_baseline_mount(jsonb);
drop table if exists public.baseline_mount_batches;

drop function if exists public.confirm_tire_change_batch(jsonb);
alter function public.confirm_tire_change_batch_legacy(jsonb)
  rename to confirm_tire_change_batch;
revoke all on function public.confirm_tire_change_batch(jsonb) from public, anon;
grant execute on function public.confirm_tire_change_batch(jsonb) to authenticated;
