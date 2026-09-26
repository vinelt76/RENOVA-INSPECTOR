-- RENOVA — helper SQL para severidad de anomalías.
-- La función es pura y solo consulta el texto de anomalía ya capturado.

create or replace function public.fn_anomaly_is_severe(p_anomaly text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(p_anomaly, ''))) in (
    'desgaste irregular severo',
    'corte profundo',
    'separación de banda',
    'separacion de banda',
    'rotura de carcasa',
    'reventón',
    'reventon'
  )
$$;

revoke all on function public.fn_anomaly_is_severe(text) from public, anon;
grant execute on function public.fn_anomaly_is_severe(text) to authenticated;
