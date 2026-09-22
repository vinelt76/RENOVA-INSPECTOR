-- RENOVA — Baja lógica de usuarios sin borrar hechos de negocio.
--
-- auth.users no debe poder arrastrar profiles ni su historial. La baja
-- operativa se hace con profiles.active = false; las inspecciones, órdenes,
-- ejecuciones e instalaciones conservan su actor histórico.

alter table public.profiles
  add column if not exists deactivated_at timestamptz;

update public.profiles
   set deactivated_at = coalesce(deactivated_at, now())
 where not active
   and deactivated_at is null;

create or replace function public.sync_profile_deactivated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.active then
      new.deactivated_at := null;
    else
      new.deactivated_at := coalesce(new.deactivated_at, now());
    end if;
  elsif new.active then
    new.deactivated_at := null;
  elsif old.active then
    new.deactivated_at := coalesce(new.deactivated_at, now());
  elsif new.deactivated_at is null then
    new.deactivated_at := old.deactivated_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_sync_deactivated_at on public.profiles;
create trigger profiles_sync_deactivated_at
before insert or update on public.profiles
for each row execute function public.sync_profile_deactivated_at();

comment on column public.profiles.deactivated_at is
  'Fecha de baja lógica. El perfil y su identidad histórica se conservan; no se debe borrar auth.users mientras exista este perfil.';

-- La eliminación física de auth.users queda bloqueada mientras exista el
-- profile. Esto evita que Supabase Auth borre en cascada la identidad que
-- necesitan las FKs históricas de inspecciones y operaciones.
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete restrict;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
    from public.profiles
   where id = auth.uid()
     and active;
$$;

comment on function public.current_company_id() is
  'Devuelve la empresa solo para perfiles activos. La baja es lógica y no elimina los hechos auditables.';
