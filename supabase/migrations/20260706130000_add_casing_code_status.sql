-- RENOVA — restaura el estado del código del casco usado por las vistas.
--
-- La vista de rendimiento de Run 6 y las vistas posteriores ya exponen
-- tire_casings.code_status. La tabla base versionada no lo declaraba, aunque
-- la documentación del propio repositorio define sus valores observados:
-- valid, not_visible y pending_review.
--
-- No crea ni modifica datos de negocio: solo restablece la columna que el
-- esquema versionado necesita antes de construir esas vistas.

alter table public.tire_casings
  add column if not exists code_status text not null default 'valid';

alter table public.tire_casings
  drop constraint if exists tire_casings_code_status_check;
alter table public.tire_casings
  add constraint tire_casings_code_status_check
  check (code_status in ('valid', 'not_visible', 'pending_review'));
