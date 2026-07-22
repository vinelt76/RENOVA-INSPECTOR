-- RENOVA — Superficie de lectura de servicios de neumáticos.
--
-- Aditiva, de solo lectura. No modifica tablas, RPCs, policies ni enums
-- existentes. Contrato congelado en tasks_servicios/CONTRATOS_DATOS.md;
-- este archivo no repite las reglas de negocio, solo las materializa.
--
-- Definición de servicio: un renglón direction='exit' de
-- tire_movement_executions, con movement_reason como tipo. Una rotación se
-- cuenta una sola vez, en su salida; el ingreso que la cierra viaja en las
-- columnas pair_*. Un entry que no cierra una rotación es una instalación
-- sintética ('installation', no existe en el enum tire_movement_reason).
--
-- Pareo de rotación (tasks_servicios/AUDIT.md §6): request_items es un
-- array 1:1 y en el mismo orden en que se capturan las ejecuciones, así que
-- sequence - 1 es el índice 0-based exacto del propio renglón dentro de
-- request_items. Nivel 1 (exacto) verifica esa alineación estructural más
-- la ejecución real de la salida que se cierra. Nivel 2 (inferido, con
-- tope) solo entra si la orden perdió la alineación, y jamás excede
-- salidas_rotation - cierres_exactos. rotation_pairing declara cuál aplicó
-- por fila: la vista nunca es una caja negra sobre esto (D4).

create index if not exists tire_movement_executions_company_captured_idx
  on public.tire_movement_executions (company_id, captured_at desc, sequence);

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
    -- (AUDIT.md §6). sequence siempre >= 1, así que este índice nunca es
    -- negativo y nunca puede envolver desde el final del array.
    o.request_items -> (e.sequence - 1)::int as own_item,
    -- Renglón anterior (el candidato a salida que este entry cerraría). Se
    -- exige sequence >= 2 explícitamente: un índice -1 en el operador ->
    -- de jsonb no significa "no existe", significa "el último elemento del
    -- array", y envolvería en falso para el primer renglón de la orden.
    case when e.sequence >= 2
      then o.request_items -> (e.sequence - 2)::int
      else null
    end as prev_item
  from public.tire_movement_executions e
  join public.tire_movement_orders o on o.id = e.order_id
),
exits_rotation as (
  select id, order_id, sequence
  from source
  where direction = 'exit' and movement_reason = 'rotation'
),
entry_exact as (
  -- Nivel 1: las tres condiciones del contrato §2.2. coalesce(..., false)
  -- para que un array corto (own_item/prev_item ausentes) resuelva a "no
  -- exacto" en vez de NULL, y así siga siendo candidato al nivel 2.
  select
    s.id,
    s.order_id,
    s.sequence,
    coalesce(
      (s.own_item ->> 'direction') = 'entry'
      and nullif(s.own_item ->> 'position', '')::smallint = s.position_number
      and (s.prev_item ->> 'direction') = 'exit'
      and (s.prev_item ->> 'reason') = 'rotation'
      and exists (
        select 1 from exits_rotation xr
         where xr.order_id = s.order_id
           and xr.sequence = s.sequence - 1
      ),
      false
    ) as closes_rotation_exact
  from source s
  where s.direction = 'entry'
),
exact_pairs as (
  select
    x.id as exit_id,
    ee.id as entry_id,
    'exact'::text as pairing_type
  from exits_rotation x
  join entry_exact ee
    on ee.order_id = x.order_id
   and ee.sequence = x.sequence + 1
   and ee.closes_rotation_exact
),
unclosed_exits as (
  -- Nivel 2, mitad salidas: solo las que el nivel 1 no cerró.
  select
    x.id,
    x.order_id,
    x.sequence,
    row_number() over (partition by x.order_id order by x.sequence) as rnk
  from exits_rotation x
  where not exists (select 1 from exact_pairs ep where ep.exit_id = x.id)
),
entries_not_exact as (
  -- Nivel 2, mitad entradas: todo entry que no cerró de forma exacta,
  -- ordenado por sequence dentro de su orden (contrato §2.3).
  select
    ee.id,
    s.order_id,
    ee.sequence,
    row_number() over (partition by s.order_id order by ee.sequence) as rnk
  from entry_exact ee
  join source s on s.id = ee.id
  where not ee.closes_rotation_exact
),
inferred_pairs as (
  -- El join por (order_id, rnk) acota el pareo al mínimo de ambos conteos
  -- por orden: eso ES cierres_inferidos_permitidos = max(salidas_rotation
  -- - cierres_exactos, 0), sin necesidad de calcularlo aparte.
  select
    ue.id as exit_id,
    en.id as entry_id,
    'inferred'::text as pairing_type
  from unclosed_exits ue
  join entries_not_exact en
    on en.order_id = ue.order_id
   and en.rnk = ue.rnk
),
all_pairs as (
  select * from exact_pairs
  union all
  select * from inferred_pairs
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
    when t.direction <> 'exit' or t.movement_reason <> 'rotation' then 'not_applicable'
    when t.exit_pairing_type = 'exact' then 'exact'
    when t.exit_pairing_type = 'inferred' then 'inferred'
    else 'not_paired'
  end as rotation_pairing
from typed t
join public.tire_movement_orders o on o.id = t.order_id
join public.companies c on c.id = t.company_id
join public.units u on u.id = t.unit_id
left join public.vehicle_configs vc on vc.id = u.config_id
join public.profiles cb on cb.id = t.captured_by
join public.profiles rb on rb.id = o.requested_by
left join public.profiles ab on ab.id = o.assigned_to
left join source pair on pair.id = t.closing_entry_id
-- La definición de servicio (contrato §1): toda salida, y solo los entry
-- que no cerraron ninguna rotación (esos ya viajan como pair_* de su salida).
where t.direction = 'exit' or t.closed_by_exit_id is null;

comment on view public.v_tire_services is
  'Servicios de neumáticos ejecutados. Cada salida es un servicio; una rotación se cuenta una sola vez en su salida, con el ingreso que la cierra en las columnas pair_*. No filtra company_id: el aislamiento lo da la RLS de las tablas base vía security_invoker. Ver tasks_servicios/CONTRATOS_DATOS.md.';

comment on column public.v_tire_services.rotation_pairing is
  'exact: ingreso identificado por posición estructural en request_items. inferred: la orden perdió alineación, pareo acotado por conteo dentro de la misma orden (el total es correcto, la atribución de esta fila es aproximada). not_paired: salida de rotación sin ningún ingreso que la cierre. not_applicable: la fila no es una salida por rotación.';

comment on column public.v_tire_services.casing_exists is
  'true si casing_code existe en tire_casings de la misma empresa (comparación cruda, sin upper(), para conservar tire_casings_company_code_uidx). false no es un error de captura: puede ser un casco sin línea base importada, o el código en otra caja. No es reconciliación.';

revoke all on public.v_tire_services from public, anon, authenticated;
grant select on public.v_tire_services to authenticated;
