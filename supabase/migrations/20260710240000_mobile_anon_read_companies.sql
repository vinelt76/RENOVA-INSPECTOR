-- RENOVA — La app móvil (inspector) opera como `anon` (sin login) y necesita
-- listar TODAS las empresas para elegir a cuál inspecciona ese día. La policy
-- `select_own_company` existente es solo para `authenticated` (dashboards web,
-- cada cliente ve solo su flota) y no aplica a `anon`, que hoy no puede leer
-- companies en absoluto.
--
-- Agregamos una policy de SELECT para `anon` sobre companies. `companies` no
-- tiene columnas sensibles (id, name, legacy_code, active, timestamps) y la app
-- solo consume id + name para poblar la pantalla de selección de empresa.
--
-- No toca la policy de authenticated ni el resto de la RLS: los dashboards
-- siguen viendo solo su empresa.

create policy "select_companies_anon" on public.companies
  for select to anon
  using (true);

-- Asegura el grant base de SELECT a anon (la RLS acota, pero sin GRANT el rol
-- no tiene el privilegio de tabla). El revoke de la migración de dashboards
-- solo quitó insert/update/delete, no select — este grant es idempotente.
grant select on public.companies to anon;
