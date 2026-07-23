-- RENOVA — v_tire_services v2: pareo general por posición y origen derivado.
--
-- Reemplaza la vista de 20260721130000_tire_services_view.sql. Solo
-- `create or replace view`: no toca tablas, enums, RPCs ni policies.
--
-- QUÉ CAMBIA Y POR QUÉ (ADR-0008)
--
-- 1. Pareo general. La v1 solo plegaba el ingreso cuando la salida previa era
--    movement_reason='rotation' (CTE exits_rotation). Por eso un scrap con
--    reemplazo en P3 producía DOS servicios —`discard` más una `installation`
--    fantasma— y una rotación producía UNO, para el mismo hecho físico: una
--    posición atendida. Ahora pliega el ingreso de CUALQUIER salida.
--
-- 2. El par exige MISMA POSICIÓN. La v1 no comparaba la posición de la salida
--    con la del ingreso, porque bajo su modelo una rotación era `exit@P3` +
--    `entry@P7` —un casco reubicándose— y las posiciones diferían por diseño.
--    Ese modelo dejaba P3 vacía y al ocupante de P7 sin registro de salida.
--    Desde task_10 el supervisor emite el par completo por posición, así que el
--    ingreso que cierra la salida de P3 es el ingreso de P3. Sin esta condición
--    el defecto vuelve con otra forma: un ingreso pareando con la salida de otra
--    posición.
--
-- 3. Origen derivado, no capturado. El operario declara los datos del neumático
--    que SALE y su observación; de dónde viene el que entra se deduce. Si el
--    casco que entra a P3 salió de P7 en la MISMA orden, el origen es P7:
--    `entry_origin_position`. Cuando el casco no salió en esa orden viene de
--    afuera —retén, reparación, nuevo— y eso exige el historial del casco, que
--    es la fase futura: la columna queda NULL y NO se inventa.
--
-- Filas heredadas: las capturadas con el modelo viejo (`exit@P3` + `entry@P7`)
-- no parean, porque las posiciones no coinciden. Producen la salida sin par y
-- una `installation`. Es fiel a cómo se capturaron y no se les inventa un par.

create or replace view public.v_tire_services
with (security_invoker = true)
as
with source as (
  select
    e.id,
    e.order_id,
    e.company_id,
    e.sequence,
    e.direction,
    e.position_number,
    e.movement_reason,
    e.casing_code,
    e.code_unreadable,
    e.brand_name,
    e.size_name,
    e.design_name,
    e.rtd_min_mm,
    e.condition,
    e.retread_design,
    e.observations,
    e.captured_by,
    e.captured_at,
    e.reconciliation_status,
    o.unit_id,
    o.requested_by,
    o.assigned_to,
    o.odometer_km as order_odometer_km,
    o.scheduled_for,
    o.completed_at,
    -- Propio renglón declarado por el supervisor: índice 0-based exacto
    -- (AUDIT.md §6). sequence siempre >= 1, así que nunca es negativo.
    o.request_items -> (e.sequence - 1)::int as own_item,
    -- Renglón anterior: el candidato a salida que este ingreso cerraría. Se
    -- exige sequence >= 2 explícitamente porque un índice -1 en el operador ->
    -- de jsonb devuelve el ÚLTIMO elemento del array, no "no existe".
    case when e.sequence >= 2
      then o.request_items -> (e.sequence - 2)::int
      else null
    end as prev_item
  from public.tire_movement_executions e
  join public.tire_movement_orders o on o.id = e.order_id
),
exits as (
  -- Antes era `exits_rotation`. Toda salida es un servicio y toda salida puede
  -- cerrarse con el ingreso de su misma posición.
  select id, order_id, sequence, position_number
  from source
  where direction = 'exit'
),
entry_exact as (
  -- Nivel 1. coalesce(..., false) para que un array corto (own_item/prev_item
  -- ausentes) resuelva a "no exacto" en vez de NULL, y siga siendo candidato
  -- al nivel 2.
  select
    s.id,
    s.order_id,
    s.sequence,
    s.position_number,
    coalesce(
      -- la ejecución sigue alineada con lo que pidió el supervisor
      (s.own_item ->> 'direction') = 'entry'
      and nullif(s.own_item ->> 'position', '')::smallint = s.position_number
      -- el renglón anterior es una salida DE LA MISMA POSICIÓN
      and (s.prev_item ->> 'direction') = 'exit'
      and nullif(s.prev_item ->> 'position', '')::smallint = s.position_number
      -- y esa salida existe de verdad como ejecución, en la misma posición
      and exists (
        select 1 from exits x
         where x.order_id = s.order_id
           and x.sequence = s.sequence - 1
           and x.position_number = s.position_number
      ),
      false
    ) as closes_exit_exact
  from source s
  where s.direction = 'entry'
),
exact_pairs as (
  select
    x.id as exit_id,
    ee.id as entry_id,
    'exact'::text as pairing_type
  from exits x
  join entry_exact ee
    on ee.order_id = x.order_id
   and ee.sequence = x.sequence + 1
   and ee.position_number = x.position_number
   and ee.closes_exit_exact
),
unclosed_exits as (
  -- Nivel 2, mitad salidas: solo las que el nivel 1 no cerró.
  select
    x.id,
    x.order_id,
    x.position_number,
    row_number() over (partition by x.order_id, x.position_number order by x.sequence) as rnk
  from exits x
  where not exists (select 1 from exact_pairs ep where ep.exit_id = x.id)
),
entries_not_exact as (
  select
    ee.id,
    ee.order_id,
    ee.position_number,
    row_number() over (partition by ee.order_id, ee.position_number order by ee.sequence) as rnk
  from entry_exact ee
  where not ee.closes_exit_exact
),
inferred_pairs as (
  -- El nivel 2 parea DENTRO DE LA MISMA POSICIÓN, no por orden de aparición.
  -- La v1 rankeaba por orden completa, lo que bajo el modelo nuevo podría
  -- casar un ingreso con la salida de otra posición. El join por
  -- (order_id, position_number, rnk) acota el pareo al mínimo de ambos conteos
  -- por posición, que es el tope que preserva el invariante de conteo.
  select
    ue.id as exit_id,
    en.id as entry_id,
    'inferred'::text as pairing_type
  from unclosed_exits ue
  join entries_not_exact en
    on en.order_id = ue.order_id
   and en.position_number = ue.position_number
   and en.rnk = ue.rnk
),
all_pairs as (
  select * from exact_pairs
  union all
  select * from inferred_pairs
),
exit_casings as (
  -- De dónde viene un casco que entra, dentro de la misma orden: la posición
  -- por la que salió. min() para que un casco que apareciera dos veces como
  -- salida en una orden resuelva de forma determinista en vez de duplicar filas.
  select
    order_id,
    nullif(btrim(casing_code), '') as casing_code,
    min(position_number) as position_number
  from source
  where direction = 'exit'
    and nullif(btrim(casing_code), '') is not null
  group by 1, 2
),
typed as (
  select
    s.*,
    ap_exit.entry_id as closing_entry_id,
    ap_exit.pairing_type as exit_pairing_type,
    ap_entry.exit_id as closed_by_exit_id
  from source s
  left join all_pairs ap_exit on ap_exit.exit_id = s.id
  left join all_pairs ap_entry on ap_entry.entry_id = s.id
)
select
  t.id as service_id,
  t.order_id,
  t.sequence,
  t.company_id,
  c.name as company_name,
  t.unit_id,
  u.plate,
  vc.notation as vehicle_config,
  case when t.direction = 'exit' then t.movement_reason::text else 'installation' end as service_type,
  t.direction::text as direction,
  t.position_number,
  nullif(btrim(t.casing_code), '') as casing_code,
  exists (
    select 1 from public.tire_casings tc
     where tc.company_id = t.company_id
       and tc.code = btrim(t.casing_code)
  ) as casing_exists,
  t.code_unreadable,
  nullif(btrim(t.brand_name), '') as brand_name,
  nullif(upper(btrim(t.brand_name)), '') as brand_key,
  nullif(btrim(t.size_name), '') as size_name,
  nullif(upper(btrim(t.size_name)), '') as size_key,
  nullif(btrim(t.design_name), '') as design_name,
  nullif(upper(btrim(t.retread_design)), '') as retread_design,
  t.rtd_min_mm,
  t.condition::text as condition,
  nullif(btrim(t.observations), '') as observations,
  t.captured_by,
  cb.full_name as captured_by_name,
  t.captured_at,
  -- D11 (confirmada 2026-07-20): agrupar por día en America/Lima, no en
  -- UTC. Un servicio de las 20:00 en Lima debe contarse ese mismo día.
  (t.captured_at at time zone 'America/Lima')::date as captured_on,
  t.reconciliation_status::text as reconciliation_status,
  t.order_odometer_km as odometer_km,
  t.scheduled_for,
  t.completed_at,
  rb.full_name as requested_by_name,
  ab.full_name as assigned_to_name,
  pair.position_number as pair_position_number,
  nullif(btrim(pair.casing_code), '') as pair_casing_code,
  pair.condition::text as pair_condition,
  pair.rtd_min_mm as pair_rtd_min_mm,
  case
    when t.direction <> 'exit' then 'not_applicable'
    when t.exit_pairing_type = 'exact' then 'exact'
    when t.exit_pairing_type = 'inferred' then 'inferred'
    else 'not_paired'
  end as rotation_pairing,
  -- Origen del neumático que ENTRA en este servicio: en una salida pareada es
  -- el casco de pair_*; en una instalación suelta es el casco de la propia
  -- fila. NULL = vino de afuera de la orden y no se puede determinar acá.
  --
  -- Va AL FINAL de la lista a propósito: `create or replace view` solo admite
  -- columnas nuevas al final, y esta migración se aplica sin `drop view` para
  -- no dejar la vista inexistente ni un instante.
  origin.position_number as entry_origin_position
from typed t
join public.tire_movement_orders o on o.id = t.order_id
join public.companies c on c.id = t.company_id
join public.units u on u.id = t.unit_id
left join public.vehicle_configs vc on vc.id = u.config_id
join public.profiles cb on cb.id = t.captured_by
join public.profiles rb on rb.id = o.requested_by
left join public.profiles ab on ab.id = o.assigned_to
left join source pair on pair.id = t.closing_entry_id
left join exit_casings origin
  on origin.order_id = t.order_id
 and origin.casing_code = coalesce(
       nullif(btrim(pair.casing_code), ''),
       case when t.direction = 'entry' then nullif(btrim(t.casing_code), '') end
     )
-- La definición de servicio (ADR-0008): toda salida, y solo los ingresos que no
-- cerraron ninguna salida (esos ya viajan como pair_* de la suya).
where t.direction = 'exit' or t.closed_by_exit_id is null;

comment on view public.v_tire_services is
  'Servicios de neumáticos ejecutados. Un servicio es una POSICIÓN ATENDIDA: la salida y el ingreso de esa misma posición, con el ingreso plegado en las columnas pair_*. Un ingreso que no cierra ninguna salida es una instalación. No filtra company_id: el aislamiento lo da la RLS de las tablas base vía security_invoker. Ver decisions/0008-servicio-por-posicion-atendida.md.';

comment on column public.v_tire_services.rotation_pairing is
  'Calidad del pareo salida-ingreso de esta fila. exact: el ingreso se identificó por posición estructural en request_items, con la salida inmediatamente anterior y en la misma posición. inferred: la orden perdió alineación y el pareo se acotó por conteo dentro de la misma posición (el total es correcto, la atribución de esta fila es aproximada). not_paired: salida sin ingreso que la cierre; puede ser una ausencia declarada por el supervisor o una fila heredada del modelo anterior. not_applicable: la fila no es una salida.';

comment on column public.v_tire_services.entry_origin_position is
  'Posición de la que proviene el neumático que ENTRA en este servicio, derivada dentro de la misma orden por coincidencia de casing_code con una salida. NULL cuando el casco no salió en esta orden (viene de retén, reparación o es nuevo) o cuando el código es ilegible: eso exige el historial del casco y no se infiere acá. Si coincide con position_number, volvió el mismo neumático a su posición.';

comment on column public.v_tire_services.casing_exists is
  'true si casing_code existe en tire_casings de la misma empresa (comparación cruda, sin upper(), para conservar tire_casings_company_code_uidx). false no es un error de captura: puede ser un casco sin línea base importada, o el código en otra caja. No es reconciliación.';

revoke all on public.v_tire_services from public, anon, authenticated;
grant select on public.v_tire_services to authenticated;
