-- RENOVA — RLS para publicar los dashboards HTML de solo lectura (rendimiento,
-- instalacion, INSPECCIONES/*) sin exponer datos de una empresa a otra.
--
-- Cierra el pendiente documentado en docs/run2_risks_and_fallback.md ("RLS
-- desactivada... NO publicar la anon key con RLS off") y aplica exactamente
-- la política ya diseñada en 20260706120000_demo_vertical_slice.sql:308-314:
--   company_id = (select company_id from profiles where id = auth.uid())
--
-- No toca: save_inspection() (SECURITY DEFINER, bypasea RLS — sigue
-- funcionando sin login para el sync de la app móvil) ni las vistas (ya
-- creadas con security_invoker=on, heredan esta RLS automáticamente).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FK faltante: profiles.id → auth.users(id)
--    Omitida a propósito en la migración original para poder validarla fuera
--    de Supabase. Tabla vacía hoy: sin riesgo de romper datos existentes.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: empresa del usuario autenticado
--    security definer: puede leer profiles sin quedar atrapada por la RLS que
--    le vamos a poner a profiles más abajo (si no, recursión al evaluarse
--    dentro de la propia policy de profiles).
--    stable: permite que Postgres cachee el resultado (initPlan) al envolverla
--    en `select` dentro de cada policy — patrón recomendado por Supabase para
--    performance de RLS.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Enable RLS — las 14 tablas públicas
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicle_configs enable row level security;
alter table public.axles enable row level security;
alter table public.tire_positions enable row level security;
alter table public.units enable row level security;
alter table public.rtd_thresholds enable row level security;
alter table public.tire_casings enable row level security;
alter table public.tire_life_cycles enable row level security;
alter table public.tire_installations enable row level security;
alter table public.tire_removals enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_measurements enable row level security;
alter table public.company_settings enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Políticas — solo SELECT (los dashboards son de solo lectura; la
--    escritura de la app móvil pasa por save_inspection(), SECURITY DEFINER,
--    que no necesita policy porque bypasea RLS).
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. companies — tabla raíz: cada usuario ve solo la suya (join inverso).
create policy "select_own_company" on public.companies
  for select to authenticated
  using (id = (select public.current_company_id()));

-- 4b. 10 tablas con company_id directo.
create policy "select_own_company" on public.profiles
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.units
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.rtd_thresholds
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.tire_casings
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.tire_life_cycles
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.tire_installations
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.tire_removals
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.inspections
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.inspection_measurements
  for select to authenticated
  using (company_id = (select public.current_company_id()));

create policy "select_own_company" on public.company_settings
  for select to authenticated
  using (company_id = (select public.current_company_id()));

-- 4c. Catálogo PATRON compartido — sin company_id, legible por cualquier
--     autenticado (decisions/0001-tenancy.md).
create policy "select_authenticated" on public.vehicle_configs
  for select to authenticated
  using (true);

create policy "select_authenticated" on public.axles
  for select to authenticated
  using (true);

create policy "select_authenticated" on public.tire_positions
  for select to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Defensa en profundidad: revocar grants de escritura de anon/authenticated
--    en las 14 tablas. RLS activa ya bloquea esto por "deny by default" sin
--    policy de escritura, pero se revoca explícitamente para documentar la
--    intención (estos dashboards son 100% lectura) y evitar que un futuro
--    CREATE POLICY de escritura mal pensado abra algo no deseado.
--    Se conserva SELECT (acotado por las policies de arriba).
-- ─────────────────────────────────────────────────────────────────────────────
revoke insert, update, delete, truncate, references, trigger
  on public.companies, public.profiles, public.vehicle_configs, public.axles,
     public.tire_positions, public.units, public.rtd_thresholds, public.tire_casings,
     public.tire_life_cycles, public.tire_installations, public.tire_removals,
     public.inspections, public.inspection_measurements, public.company_settings
  from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota: save_inspection(payload jsonb) — grant execute a anon, authenticated
-- (migración 20260707120000) — sigue funcionando igual: es SECURITY DEFINER,
-- corre con privilegios del dueño de la función (bypassrls), no de anon/
-- authenticated. La app móvil sigue escribiendo sin sesión de usuario.
-- ─────────────────────────────────────────────────────────────────────────────
