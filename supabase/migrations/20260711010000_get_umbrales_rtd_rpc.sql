-- RENOVA — task_16: RPC de solo lectura para pullUmbrales.ts (app móvil).
-- Expone rtd_thresholds (ya aplicada, migración 20260706120000) por empresa,
-- mismo patrón de alcance acotado que get_unidad_preload()/save_inspection().

create or replace function public.get_umbrales_rtd(p_company_name text)
returns table (
  size_name      text,
  rtd_change_mm  numeric,
  rtd_next_mm    numeric,
  rtd_removal_mm numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rt.size_name,
    rt.rtd_change_mm,
    rt.rtd_next_mm,
    rt.rtd_removal_mm
  from public.rtd_thresholds rt
  join public.companies co on co.id = rt.company_id
  where lower(co.name) = lower(p_company_name);
$$;

comment on function public.get_umbrales_rtd(text) is
  'Solo lectura para pullUmbrales.ts (task_16): umbrales RTD de UNA empresa puntual. SECURITY DEFINER de alcance acotado — mismo criterio que get_unidad_preload()/save_inspection().';

grant execute on function public.get_umbrales_rtd(text) to anon, authenticated;
