-- RENOVA — Marcar unidades de prueba con una columna real.
--
-- EL PROBLEMA
--
-- La unidad `QA-CN16` estuvo cinco días definiendo el KPI principal de Rendimiento sin que nadie
-- lo notara: 5 neumáticos de prueba con un odómetro de 2 500 001 km rendían 233 542 km/mm contra
-- 10 717 km/mm de los reales, y arrastraban el promedio de la flota a 138 000 km/mm.
--
-- La causa de fondo no es que existan datos de prueba —probar casos límite es correcto y
-- necesario— sino que **nada en el esquema los distingue de los reales**. Se reconocen por
-- convención de nombre y nada más.
--
-- POR QUÉ UNA COLUMNA Y NO UN FILTRO POR PATRÓN
--
-- ADR-D8 ya rechazó filtrar por prefijo de placa, nombre de empresa o unidad, con un argumento que
-- sigue en pie: adivinar un patrón puede ocultar datos reales, y esconder filas dentro de una
-- vista hace que el problema deje de verse sin dejar de contaminar.
--
-- Una columna explícita convierte el pareo en dato: las pantallas pueden excluir los datos de
-- prueba **y decirlo**, en vez de mentir por omisión. Y probar casos límite en producción deja de
-- ser peligroso.
--
-- ALCANCE DELIBERADAMENTE CHICO
--
-- Solo `units`. Un neumático, una inspección o un movimiento son de prueba porque la unidad lo es;
-- no hace falta propagar la marca a cada tabla de hechos para resolver el problema medido.

alter table public.units
  add column if not exists is_test boolean not null default false;

comment on column public.units.is_test is
  'La unidad existe para probar, no para operar. Las agregaciones la excluyen por defecto y lo declaran en pantalla; nunca se oculta en silencio. Ver ADR-D8 y auditoria_lunes/tasks/task_09.';

create index if not exists units_is_test_idx on public.units (company_id, is_test);

-- Marca las unidades de prueba conocidas al 2026-07-25, declaradas como tales por el dueño de
-- negocio: `QA-CN16` (casos límite de movimientos/taller) y `5028` (odómetro de 10 000 000 km).
-- Acotado por placa exacta, no por patrón: son dos unidades nombradas, no una regla inferida.
update public.units
   set is_test = true, updated_at = now()
 where plate in ('QA-CN16', '5028')
   and is_test = false;

-- Expuesta en las vistas de dashboard para que la UI pueda decidir Y declarar.
-- CREATE OR REPLACE VIEW solo permite agregar columnas al final.
create or replace view public.v_rendimiento_dashboard_rows
with (security_invoker = true)
as
 SELECT p.installation_id,
    p.company_id,
    p.unit_id,
    p.plate,
    p.position_number,
    p.life_cycle_id,
    p.cycle_number,
    p.condition,
    p.retread_design,
    p.otd_mm,
    p.cost,
    p.currency,
    p.casing_id,
    p.casing_code,
    p.brand_name,
    p.model_name,
    p.size_name,
    p.installed_at,
    p.odometer_at_install,
    p.rtd_at_install_mm,
    p.last_inspection_on,
    p.current_rtd_mm,
    p.current_odometer_km,
    p.end_odometer_source,
    p.rtd_worn_mm,
    p.km_run,
    p.consumption_pct,
    p.km_per_mm,
    p.km_projected,
    p.cycle_km_accumulated,
    p.casing_km_accumulated,
    p.cost_per_km,
    co.name AS company_name,
    cs.code_status,
    tp.side,
    ax.axle_number,
    ax.axle_type,
    rt.rtd_removal_mm,
    li.inspection_id AS last_inspection_id,
    li.odometer_km AS last_inspection_odometer_km,
    li.rtd_a_mm,
    li.rtd_b_mm,
    li.rtd_c_mm,
    li.rtd_d_mm,
    li.rtd_movi_mm AS last_rtd_movi_mm,
    li.rtd_state AS last_rtd_state,
    li.pressure_psi,
    li.pressure_state,
    li.valve_cap,
    li.anomaly,
    li.anomaly IS NOT NULL AND lower(TRIM(BOTH FROM li.anomaly)) <> 'normal'::text AS has_anomaly,
    li.inspector_name,
    u.is_test
   FROM v_tire_performance p
     JOIN companies co ON co.id = p.company_id
     JOIN tire_casings cs ON cs.id = p.casing_id
     JOIN units u ON u.id = p.unit_id
     LEFT JOIN tire_positions tp ON tp.config_id = u.config_id AND tp.position_number = p.position_number
     LEFT JOIN axles ax ON ax.id = tp.axle_id
     LEFT JOIN LATERAL ( SELECT rt1.rtd_removal_mm
           FROM rtd_thresholds rt1
          WHERE rt1.company_id = p.company_id AND (rt1.size_name = p.size_name OR rt1.size_name IS NULL)
          ORDER BY rt1.size_name
         LIMIT 1) rt ON true
     LEFT JOIN LATERAL ( SELECT m.inspection_id,
            i.odometer_km,
            m.rtd_a_mm,
            m.rtd_b_mm,
            m.rtd_c_mm,
            m.rtd_d_mm,
            m.rtd_movi_mm,
            m.rtd_state,
            m.pressure_psi,
            m.pressure_state,
            m.valve_cap,
            m.anomaly,
            pr.full_name AS inspector_name
           FROM inspection_measurements m
             JOIN inspections i ON i.id = m.inspection_id
             LEFT JOIN profiles pr ON pr.id = i.inspector_id
          WHERE i.unit_id = p.unit_id AND m.position_number = p.position_number
          ORDER BY i.inspected_on DESC
         LIMIT 1) li ON true;

-- Verificación esperada tras aplicar:
--   select plate, is_test from public.units where is_test;  → QA-CN16, 5028
