# Run 2 — Setup del backend para la demo del jueves

Camino de la demo: **teléfono/app → Supabase → vistas SQL → dashboard**.
Todo lo de abajo fue validado contra un PostgreSQL real (ver `run2_test_checklist.md`).

## Archivos

| Archivo | Qué hace | Orden |
|---|---|---|
| `supabase/migrations/20260706120000_demo_vertical_slice.sql` | Enums + 13 tablas (empresa, unidad, config/ejes/posiciones, umbrales, casco/ciclo/instalación/retiro, inspecciones) | 1º |
| `supabase/views_demo.sql` | 5 vistas: `v_installation_activity`, `v_installation_km`, `v_tire_performance`, `v_life_cycle_performance`, `v_casing_lifetime_performance` | 2º |
| `supabase/seed_demo.sql` | Datos demo: 1 empresa, 1 unidad BUS 2-4-2, 8 posiciones, 8 cascos, 9 ciclos (1 cerrado), 9 instalaciones (1 cerrada con retiro), umbrales. **Idempotente** (UUIDs fijos + ON CONFLICT DO NOTHING). | 3º |
| `supabase/demo_inspection_example.sql` | La inspección que "haría el teléfono": 1 cabecera + 8 mediciones. Upsert por id (re-ejecutable). | demo |

## Cómo ejecutar (dos opciones)

### Opción A — Dashboard de Supabase (recomendada para el jueves, cero tooling)

1. Facundo crea el proyecto en [supabase.com](https://supabase.com) (región `sa-east-1`).
2. **SQL Editor → New query** → pegar y correr, en orden:
   1. contenido de `migrations/20260706120000_demo_vertical_slice.sql`
   2. contenido de `views_demo.sql`
   3. contenido de `seed_demo.sql`
3. Verificar en **Table Editor**: `companies` (1), `units` (1), `tire_casings` (8),
   `tire_life_cycles` (9), `tire_installations` (9), `tire_removals` (1).

### Opción B — Supabase CLI

```bash
supabase link --project-ref <ref>
supabase db push                                   # aplica supabase/migrations/*
psql "$SUPABASE_DB_URL" -f supabase/views_demo.sql
psql "$SUPABASE_DB_URL" -f supabase/seed_demo.sql
```

(Las vistas y el seed se dejan FUERA de `migrations/` a propósito: las vistas van a iterar
durante la demo y el seed no es una migración; en Run 3 se consolidan.)

## Insertar la inspección demo

**Camino real (paso 1 de la demo):** el inspector captura en la app. El push del `sync_queue`
(task_14) todavía no está implementado — ver `run2_sync_payload_mapping.md` para el payload
exacto y `run2_risks_and_fallback.md` para el plan B.

**Fallback manual (garantiza la demo):** correr `demo_inspection_example.sql` en el SQL Editor
— es byte a byte el mismo payload que mandará el teléfono (mismos campos, mismos upserts). La
narrativa no cambia: "esto es exactamente lo que la app envía".

## Verificar las vistas de rendimiento

```sql
-- Por posición activa (lo que consumirá rendimiento.html):
select position_number, casing_code, condition, current_rtd_mm, km_run,
       round(km_per_mm) as km_mm, round(consumption_pct,1) as consumo_pct,
       round(km_projected) as km_proy, round(cost_per_km,4) as costo_km,
       cycle_km_accumulated, casing_km_accumulated
from v_tire_performance order by position_number;

-- Por ciclo de vida (historia N/R1/R2):
select casing_code, cycle_number, condition, status, cycle_km,
       round(km_per_mm) as km_mm, round(cost_per_km,4) as costo_km
from v_life_cycle_performance order by casing_code, cycle_number;

-- Vida completa del casco (el argumento del reencauche):
select casing_code, life_cycles_count, lifetime_km, lifetime_cost,
       round(lifetime_cost_per_km,4) as costo_km_vida
from v_casing_lifetime_performance order by casing_code;
```

Valores esperados exactos: en `run2_test_checklist.md`.

## Momentos "wow" del guion

1. **Antes de inspeccionar**: `v_tire_performance` muestra 8 posiciones con `km_run NULL`
   ("Sin datos" honesto) — pero CAS-003 ya arrastra 48.000 km de casco de su ciclo anterior.
2. **Se captura la inspección** (teléfono o fallback) → re-correr el SELECT → todas las métricas
   aparecen al instante. Nada se recalculó a mano: son vistas.
3. **CAS-003 (P3)**: ciclo actual 30.000 km / casco 78.000 km / costo por km de por vida 0,0269 —
   mejor que cualquier neumático nuevo de la unidad. Es la métrica que el Excel manual no puede dar.
4. Editar el odómetro de la inspección (`update inspections set odometer_km = 165000 …`) →
   las vistas se mueven solas. Fuente de verdad = eventos, no números tipeados.

## Qué queda fuera de la demo (a propósito)

- RLS desactivada (se opera con SQL editor / service key). Activarla es Run 3.
- Sync automático del teléfono (drainer del `sync_queue`) — payload ya definido.
- Dashboards HTML conectados — siguen con mock; plan en `run2_dashboard_connection_plan.md`.
- Catálogo normalizado, imports de Excel, auth de inspectores.
