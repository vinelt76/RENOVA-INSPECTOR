-- Arranque de INSPECCIONES POR FECHA en un solo viaje de red.
--
-- Antes el navegador debía esperar tres tandas:
--   1. últimas inspecciones + fechas;
--   2. filas pesadas de la última fecha;
--   3. estado actual de las posiciones.
--
-- La función conserva RLS porque es SECURITY INVOKER. Devuelve un único JSON
-- con los dos catálogos compactos y las filas que la pantalla muestra al
-- entrar sin filtros.

create or replace function public.get_inspection_dashboard_bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with latest_date as (
    select max(i.inspected_on) as inspected_on
    from public.inspections i
  ),
  latest_inspections as (
    select
      v.inspection_id,
      v.unit_id,
      v.plate,
      v.inspected_on,
      v.created_at
    from public.v_inspection_unit_latest v
  ),
  available_dates as (
    select v.inspected_on
    from public.v_inspection_dates v
  ),
  dashboard_rows as (
    select
      v.inspected_on as sort_date,
      v.plate as sort_plate,
      v.position_number as sort_position,
      to_jsonb(v) || jsonb_build_object(
        'installation_pending',
        not exists (
          select 1
          from public.tire_installations ti
          where ti.unit_id = v.unit_id
            and ti.position_number = v.position_number
            and not ti.removed
        )
        and v.inspection_id = (
          select i2.id
          from public.inspections i2
          join public.inspection_measurements im2
            on im2.inspection_id = i2.id
           and im2.position_number = v.position_number
          where i2.unit_id = v.unit_id
          order by
            i2.inspected_on desc,
            i2.created_at desc,
            i2.id desc
          limit 1
        )
      ) as row_data
    from public.v_inspection_dashboard_rows v
    join latest_date d
      on d.inspected_on = v.inspected_on
  )
  select jsonb_build_object(
    'latest_inspections',
    coalesce(
      (
        select jsonb_agg(to_jsonb(li) order by li.plate asc)
        from latest_inspections li
      ),
      '[]'::jsonb
    ),
    'available_dates',
    coalesce(
      (
        select jsonb_agg(ad.inspected_on order by ad.inspected_on desc)
        from available_dates ad
      ),
      '[]'::jsonb
    ),
    'rows',
    coalesce(
      (
        select jsonb_agg(
          dr.row_data
          order by dr.sort_date desc, dr.sort_plate asc, dr.sort_position asc
        )
        from dashboard_rows dr
      ),
      '[]'::jsonb
    )
  );
$function$;

comment on function public.get_inspection_dashboard_bootstrap() is
  'Carga inicial compacta de Inspecciones por fecha: catálogos y última fecha en una sola llamada. SECURITY INVOKER conserva RLS por empresa.';

revoke all on function public.get_inspection_dashboard_bootstrap()
  from public, anon;
grant execute on function public.get_inspection_dashboard_bootstrap()
  to authenticated;
