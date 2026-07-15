-- ============================================================================
-- RENOVA — Perfil de línea base de Movimientos.  *** ARCHIVO DE SOLO LECTURA ***
-- ============================================================================
-- NINGUNA consulta de este archivo escribe: son todas SELECT/WITH. No hay DO,
-- ni funciones, ni tablas temporales. Se puede correr contra producción sin
-- riesgo y en cualquier momento.
--
-- Para qué sirve:
--   * Q1-Q5: perfilan la evidencia con la que se precarga el primer montaje
--     (tasks_puesta_en_marcha_movimientos/AUDIT.md §4).
--   * Q6: indicador permanente de avance de la puesta en marcha — cuántas
--     posiciones ya tienen línea base y cuántas siguen pendientes.
--
-- Convenciones que estas consultas NO pueden violar (son reglas del esquema):
--   * El código de casco es único POR EMPRESA:
--     tire_casings_company_code_uidx (company_id, code) where code is not null
--     (20260706120000_demo_vertical_slice.sql:176-177).
--     Un mismo código en dos empresas NO es conflicto.
--   * "Evidencia" = la ÚLTIMA inspección de cada unidad
--     (inspections tiene unique (unit_id, inspected_on), :259).
--
-- Corrida de referencia: 2026-07-14 contra fbxupwwgiebhlciqftpw (productivo).
-- Los resultados anotados al pie de cada consulta son de esa fecha.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- Q1. Volumen: ¿cuánto hay de inspección y cuánto de taller?
-- ────────────────────────────────────────────────────────────────────────────
select
  (select count(*) from public.companies)             as empresas,
  (select count(*) from public.units)                 as unidades,
  (select count(*) from public.inspections)           as inspecciones,
  (select count(*) from public.inspection_measurements) as mediciones,
  (select count(*) from public.tire_casings)          as cascos,
  (select count(*) from public.tire_life_cycles)      as ciclos,
  (select count(*) from public.tire_installations)    as instalaciones,
  (select count(*) from public.tire_installations where not removed) as instalaciones_activas,
  (select count(*) from public.tire_removals)         as retiros;

-- 2026-07-14 → empresas=4 · unidades=269 · inspecciones=286 · mediciones=2232
--              cascos=36 · ciclos=37 · instalaciones=37 · activas=35 · retiros=2
-- Lectura: 2232 mediciones y solo 37 instalaciones. El modelo de taller
-- prácticamente no existe para la flota real.


-- ────────────────────────────────────────────────────────────────────────────
-- Q2. Cobertura por empresa: ¿qué unidades tienen inspección, taller o ambas?
-- ────────────────────────────────────────────────────────────────────────────
with u as (
  select c.name as empresa, u.id,
    (select count(*) from public.inspections i where i.unit_id = u.id) as insp,
    (select count(*) from public.tire_installations ti
      where ti.unit_id = u.id and not ti.removed) as act
  from public.units u
  join public.companies c on c.id = u.company_id
)
select empresa,
       count(*)                                        as unidades,
       count(*) filter (where insp > 0)                as con_inspecciones,
       count(*) filter (where act  > 0)                as con_instalaciones,
       count(*) filter (where insp > 0 and act > 0)    as ambas,
       count(*) filter (where insp = 0 and act = 0)    as ninguna
from u
group by empresa
order by unidades desc;

-- 2026-07-14 →
--   CIVA      107 unidades · 107 con inspecciones ·   0 con instalaciones
--   MÓVIL BUS  98 unidades ·  97 con inspecciones ·   8 con instalaciones · 1 sin nada
--   ITTSABUS   64 unidades ·  64 con inspecciones ·   0 con instalaciones
-- Lectura: dos empresas enteras sin una sola instalación. Las 8 de MÓVIL BUS
-- están todas INCOMPLETAS (2 a 7 posiciones de 6-8), incluida la fixture QA-CN16.


-- ────────────────────────────────────────────────────────────────────────────
-- Q3. Calidad de la identidad en la última inspección de cada unidad.
--     Determina qué tan precargado sale el formulario de primer montaje.
-- ────────────────────────────────────────────────────────────────────────────
with last_insp as (
  select distinct on (i.unit_id) i.id, i.unit_id
  from public.inspections i
  order by i.unit_id, i.inspected_on desc, i.created_at desc
),
m as (
  select im.*
  from last_insp li
  join public.inspection_measurements im on im.inspection_id = li.id
)
select
  (select count(*) from last_insp)                                     as unidades_con_ultima_insp,
  (select count(*) from m)                                             as mediciones,
  (select count(*) from m where nullif(btrim(tire_code),'') is null)   as sin_codigo,
  (select count(*) from m
     where upper(btrim(tire_code)) ~ '^(SIN|NO)[ -]?(CODIGO|CÓDIGO|VISIBLE)') as codigo_placeholder,
  (select count(*) from m
     where condition is null
        or upper(btrim(condition)) not in ('N','R1','R2','R3','R4'))   as condicion_no_normalizada,
  (select count(*) from m
     where upper(btrim(condition)) <> 'N'
       and nullif(btrim(retread_design),'') is null)                   as reencauchado_sin_diseno,
  (select count(*) from m where nullif(btrim(brand_name),'') is null)  as sin_marca,
  (select count(*) from m where nullif(btrim(size_name),'') is null)   as sin_medida,
  (select count(*) from m where rtd_movi_mm is null)                   as sin_rtd_movi,
  (select count(*) from m where rtd_movi_mm = 0)                       as rtd_movi_cero,
  (select count(distinct upper(btrim(tire_code))) from m
     where nullif(btrim(tire_code),'') is not null)                    as codigos_distintos;

-- 2026-07-14 → unidades=268 · mediciones=2125 · sin_codigo=316 · placeholder=1
--   condicion_no_normalizada=0 · reencauchado_sin_diseno=0 · sin_marca=0
--   sin_medida=0 · sin_rtd_movi=0 · rtd_movi_cero=0 · codigos_distintos=1717
-- Lectura clave: condición SIEMPRE dentro del enum tire_condition y RTD SIEMPRE
-- presente (2.0 a 17.0 mm, ningún cero). Marca y medida nunca faltan. Es decir:
-- toda medición es evidencia física inequívoca de que había un neumático ahí,
-- AUNQUE el inspector no haya podido leer el código. Ver Q5.


-- ────────────────────────────────────────────────────────────────────────────
-- Q4. Conflictos de código entre las últimas inspecciones.
--     Lo que la persona va a ver como aviso al confirmar la línea base.
-- ────────────────────────────────────────────────────────────────────────────
with last_insp as (
  select distinct on (i.unit_id) i.id, i.unit_id, i.company_id, i.inspected_on
  from public.inspections i
  order by i.unit_id, i.inspected_on desc, i.created_at desc
),
m as (
  select li.company_id, li.unit_id, li.inspected_on, im.position_number,
         upper(btrim(im.tire_code)) as code_norm
  from last_insp li
  join public.inspection_measurements im on im.inspection_id = li.id
  where nullif(btrim(im.tire_code),'') is not null
),
conf as (
  select code_norm,
         count(distinct unit_id)      as unidades,
         count(distinct company_id)   as empresas,
         count(distinct inspected_on) as fechas_distintas
  from m
  group by code_norm
  having count(distinct unit_id) > 1
)
select
  (select count(*) from conf)                                as codigos_en_mas_de_una_unidad,
  (select count(*) from conf where empresas > 1)             as cruzan_empresas_NO_ES_CONFLICTO,
  (select count(*) from conf where fechas_distintas > 1)     as fechas_distintas,
  (select count(*) from conf where fechas_distintas = 1)     as empate_misma_fecha,
  (select count(*) from (
     select unit_id, code_norm from m group by 1,2 having count(*) > 1) d)
                                                            as duplicado_en_la_misma_unidad,
  (select count(*) from m
     join public.units u on u.id = m.unit_id
     join public.tire_casings tc
       on tc.company_id = u.company_id
      and upper(btrim(tc.code)) = m.code_norm)              as mediciones_con_casco_ya_existente;

-- 2026-07-14 → codigos_en_mas_de_una_unidad=76 · cruzan_empresas=25
--   fechas_distintas=70 · empate_misma_fecha=6 · duplicado_misma_unidad=2
--   mediciones_con_casco_ya_existente=15
-- Lectura: de los 76, 25 cruzan empresas y NO son conflicto (unicidad por
-- empresa). Los 15 con casco existente pertenecen a las 8 unidades ya operadas
-- por taller. El resto se resuelve en el momento: confirm_baseline_mount
-- responde [codigo_en_uso] y la persona monta el casco existente por life_cycle_id.


-- ────────────────────────────────────────────────────────────────────────────
-- Q5. Matriz de calidad de la evidencia, posición por posición.
--     Universo: todas las posiciones CONFIGURADAS de las unidades con inspección.
--
--     Orden de evaluación (el mismo que debe implementar v_unit_position_state
--     — ver tasks_puesta_en_marcha_movimientos/PLAN.md §3.2):
--       1. ocupada           → ya tiene instalación activa: no hay nada que hacer
--       2. sin_evidencia     → no hay medición: la posición está realmente vacía
--       3. sin_codigo        → hay medición (⇒ había neumático) pero sin código legible
--       4. codigo_duplicado  → el código aparece en >1 posición de la MISMA empresa
--       5. casco_existente   → ya existe un casco con ese código en la empresa
--       6. evidencia_limpia  → el formulario sale precargado entero
--
--     Las clases 3-6 son todas baseline_pending = true: hay un neumático físico
--     sin línea base. La 2 es una posición legítimamente vacía.
-- ────────────────────────────────────────────────────────────────────────────
with last_insp as (
  select distinct on (i.unit_id) i.id, i.unit_id, i.company_id, i.inspected_on
  from public.inspections i
  order by i.unit_id, i.inspected_on desc, i.created_at desc
),
cand as (
  select li.company_id, li.unit_id, im.id as measurement_id, im.position_number,
         upper(btrim(im.tire_code)) as code_norm,
         nullif(btrim(im.tire_code),'') is not null as has_code
  from last_insp li
  join public.inspection_measurements im on im.inspection_id = li.id
),
pos_universe as (
  select u.company_id, u.id as unit_id, tp.position_number
  from public.units u
  join public.tire_positions tp on tp.config_id = u.config_id
  where exists (select 1 from last_insp li where li.unit_id = u.id)
),
dup as (   -- duplicado DENTRO de la empresa (la unicidad es (company_id, code))
  select company_id, code_norm
  from cand
  where has_code
    and code_norm !~ '^(SIN|NO)[ -]?(CODIGO|CÓDIGO|VISIBLE)'
  group by 1, 2
  having count(*) > 1
),
classified as (
  select p.company_id, p.unit_id, p.position_number,
    case
      when exists (select 1 from public.tire_installations ti
                    where ti.unit_id = p.unit_id
                      and ti.position_number = p.position_number
                      and not ti.removed)                       then 'ocupada'
      when c.measurement_id is null                             then 'sin_evidencia'
      when not c.has_code
        or c.code_norm ~ '^(SIN|NO)[ -]?(CODIGO|CÓDIGO|VISIBLE)' then 'sin_codigo'
      when exists (select 1 from dup d
                    where d.company_id = p.company_id
                      and d.code_norm  = c.code_norm)           then 'codigo_duplicado'
      when exists (select 1 from public.tire_casings tc
                    where tc.company_id = p.company_id
                      and upper(btrim(tc.code)) = c.code_norm)  then 'casco_existente'
      else 'evidencia_limpia'
    end as clase
  from pos_universe p
  left join cand c
    on c.unit_id = p.unit_id
   and c.position_number = p.position_number
)
select clase,
       count(*)                  as posiciones,
       count(distinct unit_id)   as unidades,
       clase <> 'ocupada' and clase <> 'sin_evidencia' as es_baseline_pending
from classified
group by clase
order by posiciones desc;

-- 2026-07-14 →
--   evidencia_limpia   1660 posiciones · 262 unidades · baseline_pending
--   sin_codigo          309 posiciones · 157 unidades · baseline_pending
--   codigo_duplicado    123 posiciones ·  78 unidades · baseline_pending
--   ocupada              35 posiciones ·   8 unidades
--   sin_evidencia        17 posiciones ·   6 unidades
--   casco_existente       0
--   TOTAL              2144 posiciones
--
-- ⇒ baseline_pending = 1660 + 309 + 123 = 2092 posiciones (97,6 % del universo).
--
-- ATENCIÓN — decisión de diseño que sale de acá: el predicado de
-- baseline_pending debe ser "existe medición", NO "existe código". Las 309
-- posiciones sin código tienen RTD, marca, medida y condición (Q3): había un
-- neumático y se lo midió. Si el predicado fuera por código, esas 309 quedarían
-- fuera del candado y la UI ofrecería montar inventario encima de ellas —
-- exactamente el bug que se está arreglando. Diferencia: 1784 vs 2092.


-- ────────────────────────────────────────────────────────────────────────────
-- Q6. INDICADOR DE AVANCE de la puesta en marcha.
--
--     Requiere las migraciones de task_03/task_04, aplicadas en task_06.
--     La cobertura se mide por posición ocupada, no por el origin de la
--     instalación activa: un movimiento posterior crea otra instalación
--     origin='workshop', aunque casco y ciclo conserven su procedencia baseline.
-- ────────────────────────────────────────────────────────────────────────────
select c.name as empresa,
       count(*)                                                   as posiciones,
       count(*) filter (where not s.is_empty)                     as con_linea_base,
       count(*) filter (where not s.is_empty
                          and s.installation_origin = 'workshop') as instalacion_actual_taller,
       count(*) filter (where not s.is_empty
                          and s.installation_origin = 'baseline') as sin_mover_desde_linea_base,
       count(*) filter (where s.baseline_pending)                 as pendientes,
       count(*) filter (where s.is_empty and not s.baseline_pending)
                                                                  as vacias_reales,
       round(100.0 * count(*) filter (where not s.is_empty)
             / nullif(count(*), 0), 1)                            as pct_con_linea_base
  from public.v_unit_position_state s
  join public.companies c on c.id = s.company_id
 group by c.name
 order by posiciones desc;

-- Meta: con_linea_base/pct_con_linea_base suben a medida que taller opera.
-- sin_mover_desde_linea_base es solo una foto de la instalación activa y
-- puede bajar después de un movimiento; no debe interpretarse como cobertura.
-- Si el ritmo no alcanza (riesgo B12 del AUDIT, aceptado en la decisión D0),
-- este número es la evidencia para reconsiderar un backfill masivo.
