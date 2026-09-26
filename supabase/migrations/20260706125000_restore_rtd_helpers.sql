-- RENOVA — repone helpers de runtime que existían en la base histórica.
--
-- T07 documenta que estas funciones estaban en producción pero nunca se
-- versionaron en supabase/migrations. Sin ellas, un replay limpio no puede
-- crear save_inspection ni las vistas que dependen de los umbrales RTD.
-- La implementación conserva la regla documentada en T08: umbral específico
-- de medida con fallback al umbral por defecto de la empresa.

create or replace function public.fn_effective_rtd_thresholds(
  p_company_id uuid,
  p_size_name text
)
returns table (
  rtd_change_mm numeric,
  rtd_next_mm numeric,
  rtd_removal_mm numeric
)
language sql
stable
set search_path = public
as $$
  select
    rt.rtd_change_mm,
    rt.rtd_next_mm,
    rt.rtd_removal_mm
  from public.rtd_thresholds rt
  where rt.company_id = p_company_id
    and (rt.size_name = p_size_name or rt.size_name is null)
  order by (rt.size_name is null), rt.size_name
  limit 1
$$;

create or replace function public.fn_rtd_state(
  p_company_id uuid,
  p_size_name text,
  p_rtd_mm numeric
)
returns public.rtd_state
language sql
stable
set search_path = public
as $$
  select case
    when p_rtd_mm is null then null
    when th.rtd_change_mm is null then null
    when p_rtd_mm <= th.rtd_change_mm then 'Para Reencauche'::public.rtd_state
    when p_rtd_mm <= th.rtd_next_mm then 'Próximo a Reencauche'::public.rtd_state
    else 'Normal'::public.rtd_state
  end
  from public.fn_effective_rtd_thresholds(p_company_id, p_size_name) th
$$;

revoke all on function public.fn_effective_rtd_thresholds(uuid, text) from public, anon;
revoke all on function public.fn_rtd_state(uuid, text, numeric) from public, anon;
grant execute on function public.fn_effective_rtd_thresholds(uuid, text) to authenticated;
grant execute on function public.fn_rtd_state(uuid, text, numeric) to authenticated;
