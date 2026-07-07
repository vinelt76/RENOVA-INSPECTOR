# Run 2 — Checklist de pruebas (demo del jueves)

Toda esta secuencia fue ejecutada contra PostgreSQL 16 real el 2026-07-06 (throwaway local) con
los resultados exactos anotados abajo. Repetirla en el proyecto Supabase antes de la demo.

## 1. Migración y vistas

- [ ] Correr `migrations/20260706120000_demo_vertical_slice.sql` → sin errores.
- [ ] Correr `views_demo.sql` → sin errores.
- [ ] `select count(*) from information_schema.tables where table_schema='public';` → **13 tablas**.
- [ ] Las 5 vistas existen: `v_installation_activity`, `v_installation_km`, `v_tire_performance`,
      `v_life_cycle_performance`, `v_casing_lifetime_performance`.

## 2. Seed

- [ ] Correr `seed_demo.sql` → sin errores.
- [ ] Conteos: `companies`=1 · `units`=1 · `tire_positions`=8 · `tire_casings`=8 ·
      `tire_life_cycles`=9 · `tire_installations`=9 · `tire_removals`=1 · `rtd_thresholds`=1.
- [ ] **Idempotencia:** correr `seed_demo.sql` OTRA vez → sin errores, mismos conteos. ✅ verificado
- [ ] Estado inicial de las vistas (ANTES de inspeccionar):

```sql
select position_number, casing_code, km_run, end_odometer_source,
       cycle_km_accumulated, casing_km_accumulated
from v_tire_performance order by position_number;
```

Esperado ✅: 8 filas, `km_run` **NULL** en todas (`end_odometer_source='unknown'` — sin
inspecciones aún, nunca 0 inventado); **CAS-003 (P3) ya muestra `casing_km_accumulated=48000`**
(historia del ciclo 0 cerrado con retiro manual).

## 3. Insertar inspección nueva (el evento de la demo)

- [ ] Camino real: capturar desde la app y drenar el sync — si está implementado.
- [ ] Fallback garantizado: correr `demo_inspection_example.sql` (misma estructura que el push).
- [ ] Verificar: `select count(*) from inspection_measurements;` → 8.
- [ ] Re-ejecutar el mismo archivo → sin errores (upsert idempotente = reintento del drainer). ✅

## 4. Verificar que las vistas se actualizan

```sql
select position_number pos, casing_code, condition, current_rtd_mm, km_run,
       round(km_per_mm) km_mm, round(consumption_pct,1) consumo,
       round(km_projected) proy, round(cost_per_km,4) costo_km,
       cycle_km_accumulated cyc, casing_km_accumulated casco
from v_tire_performance order by 1;
```

Esperado ✅ (validado):

| pos | casco | cond | rtd | km_run | km/mm | consumo % | proyectado | costo/km | km ciclo | km casco |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CAS-001 | N | 11.0 | 30000 | 6000 | 31.3 | 72000 | 0.0467 | 30000 | 30000 |
| 2 | CAS-002 | N | 11.2 | 30000 | 6250 | 30.0 | 75000 | 0.0467 | 30000 | 30000 |
| 3 | CAS-003 | **R1** | 9.5 | 30000 | 6667 | 32.1 | 66667 | **0.0167** | **30000** | **78000** |
| 4 | CAS-004 | N | 14.1 | 30000 | 5085 | 29.5 | 81356 | 0.0533 | 30000 | 30000 |
| 5 | CAS-005 | N | 14.3 | 30000 | 5263 | 28.5 | 84211 | 0.0533 | 30000 | 30000 |
| 6 | CAS-006 | N | 13.4 | 30000 | 4545 | 33.0 | 72727 | 0.0533 | 30000 | 30000 |
| 7 | CAS-007 | N | 6.5 | 30000 | 3158 | 59.4 | 37895 | 0.0467 | 30000 | 30000 |
| 8 | CAS-008 | N | 3.6 | 30000 | 2419 | 77.5 | 29032 | 0.0467 | 30000 | 30000 |

Chequeos de reglas de negocio sobre esa tabla:
- [ ] P3: km ciclo (30000) ≠ km casco (78000) → **ciclo arranca en 0, casco nunca resetea**. ✅
- [ ] P7 con RTD 6.5 → el teléfono mandó `rtd_state='Próximo a Reencauche'`; P8 con 3.6 →
      'Para Reencauche' (umbrales 7/4 de `rtd_thresholds`, no hardcode del server). ✅
- [ ] `end_odometer_source` pasó de 'unknown' a 'last_inspection' (fallback documentado). ✅

```sql
select casing_code, cycle_number, condition, status, cycle_km,
       round(km_per_mm) km_mm, round(cost_per_km,4) costo_km
from v_life_cycle_performance order by casing_code, cycle_number;
```
Esperado ✅: 9 filas; CAS-003 ciclo 0 = `retreaded`, 48000 km, km/mm 4571, costo/km 0.0333;
CAS-003 ciclo 1 = `active`, 30000 km, km/mm 6667, costo/km 0.0167.

```sql
select casing_code, life_cycles_count, lifetime_km, lifetime_cost,
       round(lifetime_cost_per_km,4) costo_km_vida
from v_casing_lifetime_performance order by casing_code;
```
Esperado ✅: CAS-003 → 2 ciclos, **78000 km, 2100 de inversión, 0.0269/km de por vida** (mejor
que los nuevos: 0.0467–0.0533). Los demás → 1 ciclo, 30000 km.

## 5. Prueba de "fuente de verdad = eventos"

- [ ] `update inspections set odometer_km = 165000, updated_at = now() where id = '99999999-9999-4999-8999-999999999999';`
- [ ] Re-consultar `v_tire_performance` → `km_run=35000` y TODAS las métricas se recalculan solas.
- [ ] Revertir a 160000.

## 6. Invariantes del modelo (deben FALLAR)

```sql
-- Segundo ciclo activo para CAS-001 → debe fallar (unique parcial):
insert into tire_life_cycles (company_id, casing_id, cycle_number, condition, status, started_at)
values ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-000000000001',1,'R1','active',current_date);

-- Segunda instalación activa en P1 → debe fallar:
insert into tire_installations (company_id, life_cycle_id, unit_id, position_number, installed_at, removed)
values ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-000000000002','33333333-3333-4333-8333-333333333333',1,current_date,false);

-- Segunda inspección misma unidad mismo día → debe fallar (unique unit+fecha):
insert into inspections (id, company_id, unit_id, inspected_on, odometer_km)
values (gen_random_uuid(),'11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333', current_date, 161000);
```

## 7. Dashboard / camino de lectura

- [ ] Los SELECT del punto 4 en el SQL Editor de Supabase = demo de lectura (decisión: los HTML
      NO se conectan este run — `run2_dashboard_connection_plan.md`).
- [ ] Fallback visual: abrir `rendimiento.html` en el navegador → sigue funcionando con mock,
      intacto. La narrativa: "estas cards leerán `v_tire_performance` en Run 3".

## 8. Limpieza post-ensayo (opcional, antes de la demo real)

```sql
delete from inspection_measurements where inspection_id = '99999999-9999-4999-8999-999999999999';
delete from inspections where id = '99999999-9999-4999-8999-999999999999';
```
(para que la inspección se cree EN VIVO durante la demo)
