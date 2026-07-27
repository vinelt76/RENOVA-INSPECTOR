-- RENOVA — Regla de presión real: rangos por medida y tipo de eje, en datos.
--
-- QUÉ REEMPLAZA
--
-- `fn_pressure_state_fixed(p_psi)` aplicaba un umbral plano 100/130 PSI para toda medida y todo
-- eje. Estaba declarada como provisional en su propio comentario y en
-- `WEB/Inspecciones por unidad.html`, pero era la ÚNICA clasificación de presión que un jefe de
-- flota llegaba a ver: la app de inspección captura el número y no muestra estado.
--
-- LA REGLA APROBADA (dueño de negocio, 2026-07-25)
--
--   295/80R22.5  Direccional / Tracción / Libre  ->  100 .. 125 PSI
--   315/80R22.5  Tracción / Libre                ->  100 .. 125 PSI
--   315/80R22.5  Direccional                     ->  105 .. 125 PSI
--
-- Los extremos son INCLUSIVOS: 100 y 125 son Normal. (La función anterior marcaba `<= 100` como
-- Baja, así que exactamente 100 pasa de "Baja Presión" a "Normal".)
--
-- Medición en FRÍO. La referencia CALIENTE sigue siendo deuda declarada y genuina: las empresas
-- que miden siempre en caliente son agencias de las que todavía no hay data, y
-- `specs/reglas_negocio.md:74` prohíbe inventar un ajuste. Por eso esta función NO clasifica una
-- medición marcada `'HOT'`: devuelve NULL en vez de aplicarle la regla de frío en silencio.
--
-- CAMBIO DE MODELO RESPECTO DE LA SPEC
--
-- `specs/reglas_negocio.md` §3 modelaba la presión como `presion_ref` ± `delta_alto_pct` /
-- `delta_bajo_pct`. La regla real son rangos absolutos mín–máx. Eso explica por qué
-- `calcularEstadoPresion` (app/src/core/calculations.ts) nunca tuvo un llamador: implementa
-- fielmente un modelo que nadie iba a usar. La spec se corrige junto con esta migración.
--
-- POR QUÉ EN UNA TABLA Y NO EN EL CUERPO DE LA FUNCIÓN
--
-- Hoy los rangos son iguales para las cuatro empresas, así que escribirlos en la función parecería
-- más simple. Pero `CLAUDE.md` es explícito: umbrales, catálogos y configuraciones viven en datos.
-- Sembrados por empresa, el día que una pida un rango distinto es un UPDATE; escritos en la
-- función, es una migración. Mismo criterio y misma forma que `rtd_thresholds`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla de umbrales
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pressure_thresholds (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  -- NULL = aplica a cualquier medida / cualquier eje. Permite sembrar una regla
  -- general y sobreescribirla solo donde el negocio distingue.
  size_name   text,
  axle_type   text,
  psi_min     numeric(5,2) not null,
  psi_max     numeric(5,2) not null,
  updated_at  timestamptz not null default now(),
  constraint pressure_thresholds_range check (psi_min < psi_max),
  constraint pressure_thresholds_positive check (psi_min > 0)
);

comment on table public.pressure_thresholds is
  'Rango de presión normal (PSI, inclusive) por empresa/medida/tipo de eje, para medición en FRÍO. size_name o axle_type en NULL actúan como comodín; gana la fila más específica. La referencia CALIENTE no está definida — ver specs/reglas_negocio.md §3.';

-- Un solo umbral por combinación. NULLS NOT DISTINCT trata los comodines como valor,
-- así que no se pueden sembrar dos filas genéricas para la misma empresa.
create unique index if not exists pressure_thresholds_unique_combo
  on public.pressure_thresholds (company_id, size_name, axle_type) nulls not distinct;

alter table public.pressure_thresholds enable row level security;

drop policy if exists "select_own_company" on public.pressure_thresholds;
create policy "select_own_company"
  on public.pressure_thresholds for select to authenticated
  using (company_id = (select public.current_company_id()));

-- Mismo criterio que rtd_thresholds: solo lectura, solo authenticated. La escritura
-- queda para la consola administrativa, no para el cliente.
revoke all on table public.pressure_thresholds from public, anon, authenticated;
grant select on table public.pressure_thresholds to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Siembra para las empresas existentes
-- ─────────────────────────────────────────────────────────────────────────────

-- Regla general: todo 100..125.
insert into public.pressure_thresholds (company_id, size_name, axle_type, psi_min, psi_max)
select c.id, null, null, 100, 125 from public.companies c
on conflict (company_id, size_name, axle_type) do update
  set psi_min = excluded.psi_min, psi_max = excluded.psi_max, updated_at = now();

-- Excepción: 315/80R22.5 en Direccional arranca en 105.
insert into public.pressure_thresholds (company_id, size_name, axle_type, psi_min, psi_max)
select c.id, '315/80R22.5', 'Direccional', 105, 125 from public.companies c
on conflict (company_id, size_name, axle_type) do update
  set psi_min = excluded.psi_min, psi_max = excluded.psi_max, updated_at = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Resolución del umbral efectivo
-- ─────────────────────────────────────────────────────────────────────────────

-- Gana la fila más específica: (medida + eje) > (medida) > (eje) > genérica.
-- Mismo patrón que fn_effective_rtd_thresholds, extendido a dos dimensiones.
create or replace function public.fn_effective_pressure_thresholds(
  p_company_id uuid,
  p_size_name  text,
  p_axle_type  text
)
returns table (psi_min numeric, psi_max numeric)
language sql
stable
set search_path = public
as $$
  select pt.psi_min, pt.psi_max
  from pressure_thresholds pt
  where pt.company_id = p_company_id
    and (pt.size_name is null or pt.size_name = p_size_name)
    and (pt.axle_type is null or pt.axle_type = p_axle_type)
  order by (pt.size_name is not null)::int + (pt.axle_type is not null)::int desc,
           pt.size_name nulls last,
           pt.axle_type nulls last
  limit 1
$$;

comment on function public.fn_effective_pressure_thresholds(uuid, text, text) is
  'Umbral de presión aplicable: gana la fila más específica (medida+eje > medida > eje > genérica).';

revoke all on function public.fn_effective_pressure_thresholds(uuid, text, text) from public, anon;
grant execute on function public.fn_effective_pressure_thresholds(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Estado de presión
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_pressure_state(
  p_psi              numeric,
  p_psi_min          numeric,
  p_psi_max          numeric,
  p_temperature_mode public.temperature_mode default null
)
returns public.pressure_state
language sql
immutable
set search_path = public
as $$
  select case
    when p_psi is null then 'Sin Medir'::public.pressure_state
    -- CALIENTE sin regla definida: NULL es "no clasificable", que es la verdad.
    -- Aplicarle la regla de frío sería inventar una equivalencia que nadie aprobó.
    when p_temperature_mode = 'HOT'::public.temperature_mode then null
    -- Sin umbral sembrado para la empresa/medida/eje tampoco se inventa un veredicto.
    when p_psi_min is null or p_psi_max is null then null
    when p_psi < p_psi_min then 'Baja Presión'::public.pressure_state
    when p_psi > p_psi_max then 'Alta Presión'::public.pressure_state
    else 'Normal'::public.pressure_state
  end
$$;

comment on function public.fn_pressure_state(numeric, numeric, numeric, public.temperature_mode) is
  'Estado de presión contra un rango inclusivo. Devuelve NULL —no un veredicto— cuando la medición es CALIENTE o cuando no hay umbral sembrado: ninguna de las dos tiene regla aprobada y clasificar igual sería inventarla.';

revoke all on function public.fn_pressure_state(numeric, numeric, numeric, public.temperature_mode) from public, anon;
grant execute on function public.fn_pressure_state(numeric, numeric, numeric, public.temperature_mode) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Vista del dashboard
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTA SOBRE EL NOMBRE DE LA COLUMNA: `pressure_state_fixed` conserva su nombre porque
-- CREATE OR REPLACE VIEW no permite renombrar columnas y hacer DROP+CREATE sobre una vista
-- con dependientes es un riesgo innecesario a días de la demo. El nombre quedó histórico:
-- ya no es una regla "fija", es la regla real por medida y eje. Renombrarla es una tarea
-- propia, junto con actualizar a los consumidores de `WEB/`.
create or replace view public.v_inspection_dashboard_rows
with (security_invoker = true)
as
 SELECT i.company_id,
    co.name AS company_name,
    u.id AS unit_id,
    u.plate,
    i.id AS inspection_id,
    i.inspected_on,
    i.odometer_km,
    i.unit_photo_url,
    im.position_number,
    tp.side,
    ax.axle_number,
    ax.axle_type,
    im.tire_code,
    cs.code AS casing_code,
    cs.code_status,
    im.brand_name,
    im.size_name,
    im.condition,
    im.retread_design,
    im.rtd_a_mm,
    im.rtd_b_mm,
    im.rtd_c_mm,
    im.rtd_d_mm,
    im.rtd_movi_mm,
    im.rtd_state,
    fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_a_mm) AS rtd_a_state,
    fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_b_mm) AS rtd_b_state,
    fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_c_mm) AS rtd_c_state,
    fn_channel_rtd_state(i.company_id, im.size_name, im.rtd_d_mm) AS rtd_d_state,
    im.pressure_psi,
    im.pressure_state,
    fn_pressure_state(im.pressure_psi, pth.psi_min, pth.psi_max, im.temperature_mode) AS pressure_state_fixed,
    im.valve_cap,
    im.anomaly,
    im.anomaly IS NOT NULL AND lower(TRIM(BOTH FROM im.anomaly)) <> 'normal'::text AS has_anomaly,
    fn_anomaly_is_severe(im.anomaly) AS anomaly_is_severe,
    im.anomaly_photo_url,
    im.is_discard,
    im.is_discard OR fn_anomaly_is_severe(im.anomaly) AS is_critical,
    p.full_name AS inspector_name,
    im.updated_at,
        CASE
            WHEN im.is_discard OR fn_anomaly_is_severe(im.anomaly) THEN 'critical'::text
            WHEN im.rtd_movi_mm IS NOT NULL AND th.rtd_change_mm IS NOT NULL THEN
            CASE
                WHEN im.rtd_movi_mm <= th.rtd_change_mm THEN 'critical'::text
                WHEN im.rtd_movi_mm <= th.rtd_next_mm THEN 'warning'::text
                WHEN im.anomaly IS NOT NULL AND lower(TRIM(BOTH FROM im.anomaly)) <> 'normal'::text THEN 'warning'::text
                ELSE 'normal'::text
            END
            WHEN im.rtd_state = 'Para Reencauche'::rtd_state THEN 'critical'::text
            WHEN im.rtd_state = 'Próximo a Reencauche'::rtd_state THEN 'warning'::text
            WHEN im.rtd_state = 'Normal'::rtd_state THEN
            CASE
                WHEN im.anomaly IS NOT NULL AND lower(TRIM(BOTH FROM im.anomaly)) <> 'normal'::text THEN 'warning'::text
                ELSE 'normal'::text
            END
            ELSE 'no_data'::text
        END AS tire_status,
        CASE
            WHEN im.is_discard OR fn_anomaly_is_severe(im.anomaly) THEN 'desecho'::text
            WHEN im.rtd_movi_mm IS NOT NULL AND th.rtd_change_mm IS NOT NULL THEN
            CASE
                WHEN im.rtd_movi_mm <= th.rtd_change_mm THEN 'para_reencauche'::text
                WHEN im.rtd_movi_mm <= th.rtd_next_mm THEN 'proximo_a_reencauche'::text
                ELSE NULL::text
            END
            WHEN im.rtd_state = 'Para Reencauche'::rtd_state THEN 'para_reencauche'::text
            WHEN im.rtd_state = 'Próximo a Reencauche'::rtd_state THEN 'proximo_a_reencauche'::text
            ELSE NULL::text
        END AS retread_observation,
    im.model_name,
    -- Columnas nuevas al final: CREATE OR REPLACE VIEW solo permite agregar.
    -- La ficha necesita el rango para IMPRIMIRLO; antes lo tenía hardcodeado
    -- como "RANGO NORMAL: 100–130 PSI" para toda posición.
    pth.psi_min AS pressure_min_psi,
    pth.psi_max AS pressure_max_psi
   FROM inspections i
     JOIN companies co ON co.id = i.company_id
     JOIN units u ON u.id = i.unit_id
     JOIN inspection_measurements im ON im.inspection_id = i.id
     LEFT JOIN tire_life_cycles lc ON lc.id = im.life_cycle_id
     LEFT JOIN tire_casings cs ON cs.id = lc.casing_id
     LEFT JOIN tire_positions tp ON tp.config_id = u.config_id AND tp.position_number = im.position_number
     LEFT JOIN axles ax ON ax.id = tp.axle_id
     LEFT JOIN profiles p ON p.id = i.inspector_id
     LEFT JOIN LATERAL fn_effective_rtd_thresholds(i.company_id, im.size_name) th(rtd_change_mm, rtd_next_mm, rtd_removal_mm) ON true
     LEFT JOIN LATERAL fn_effective_pressure_thresholds(i.company_id, im.size_name, ax.axle_type) pth(psi_min, psi_max) ON true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. La función vieja queda sin llamadores
-- ─────────────────────────────────────────────────────────────────────────────

-- No se elimina: `DROP FUNCTION` a días de la demo, sobre algo que ya no molesta, es riesgo sin
-- beneficio. Pero se marca, para que nadie —persona o IA— la encuentre y asuma que sigue vigente.
comment on function public.fn_pressure_state_fixed(numeric) is
  'OBSOLETA desde 2026-07-25 (ADR-0009). Implementaba la regla plana provisional 100/130 PSI para toda medida y eje. Sin llamadores: v_inspection_dashboard_rows ahora usa fn_pressure_state() contra pressure_thresholds. No usar; retirar en una limpieza posterior.';

-- APLICADA el 2026-07-25. Distribución medida después, sobre 2 247 mediciones:
--   Normal 1 961 · Sin Medir 232 · Alta Presión 35 · Baja Presión 19
-- Cambios respecto de la regla plana 100/130:
--   34 mediciones pasaron de 'Normal' a 'Alta Presión' (126..130 PSI)
--    6 mediciones pasaron de 'Normal' a 'Baja Presión' (315/80R22.5 Direccional, 100..104 PSI)
-- Ninguna medición cayó exactamente en 100 PSI, así que el cambio de `<= 100` a `< psi_min`
-- no movió ninguna fila en la práctica.
