# Run 1 — Dataset mínimo para la demo del jueves

Objetivo de la demo, en una frase por paso:

1. **Inspección ingresada desde el teléfono** (app actual, offline).
2. **Inspección guardada en Supabase** (push del sync).
3. **Dashboard lee la inspección** (vista-flota / panel de taller contra Supabase).
4. **Métricas de rendimiento derivadas** de lo guardado (vista `v_tire_performance`).

## Tablas mínimas (7 tablas + 1 vista)

No hace falta desplegar todo el borrador. Subconjunto suficiente:

| # | Tabla | Por qué es imprescindible | Columnas mínimas para la demo |
|---|---|---|---|
| 1 | `companies` | Tenant de todo | `id`, `name`, `legacy_code` |
| 2 | `vehicle_configs` (+ se puede aplanar `axles`/`tire_positions` a después) | La unidad necesita config para saber sus posiciones | `id`, `vehicle_type`, `notation`, `is_mvp` |
| 3 | `units` | La inspección cuelga de una unidad | `id`, `company_id`, `plate`, `vehicle_type`, `config_id` |
| 4 | `inspections` | Paso 2 de la demo | `id` (del dispositivo), `company_id`, `unit_id`, `inspected_on`, `odometer_km`, `updated_at` |
| 5 | `inspection_measurements` | Paso 2/3: los datos que el dashboard pinta | `id`, `company_id`, `inspection_id`, `position_number`, `rtd_a_mm..rtd_d_mm`, `pressure_psi`, `anomaly`, `rtd_movi_mm`, `idi_mm`, `rtd_state`, `is_discard`, `tire_code`, `brand_name`, `size_name`, `updated_at` |
| 6 | `tires` | Paso 4: aporta OTD/costo/km acumulado | `id`, `company_id`, `code`, `otd_mm`, `cost`, `accumulated_km`, `status` |
| 7 | `tire_installations` | Paso 4: aporta RTD/odómetro de instalación | `id`, `company_id`, `tire_id`, `unit_id`, `position_number`, `installed_at`, `rtd_at_install_mm`, `odometer_at_install`, `removed=false` |
| — | `v_tire_performance` | Paso 4: las métricas salen de un SELECT, no del HTML | (vista sobre 4–7) |

Se pueden postergar sin afectar la demo: `fleets`, `profiles`/auth (inspector NULL), catálogo
`catalog_*` (las mediciones llevan texto), `axles`/`tire_positions` (rendimiento por eje),
umbrales (`rtd_state` ya viene calculado del teléfono), retiros, inventario, imports.

## Filas semilla concretas (guion de la demo)

```
companies:        1 fila  → { name: 'MÓVIL BUS', legacy_code: 'movil' }
vehicle_configs:  1 fila  → { vehicle_type: 'BUS', notation: '2-4-2', is_mvp: true }
units:            1 fila  → { plate: 'AAV-803', config → BUS 2-4-2 }
tires:            8 filas → una por posición, con code ('DEMO-P1'…), otd_mm (p.ej. 16.0),
                            cost (p.ej. 1400 PEN), accumulated_km 0, status 'installed'
tire_installations: 8 filas → posición 1..8, installed_at hace ~6 meses,
                            rtd_at_install_mm = 16.0, odometer_at_install = 120000
```

La **inspección NO se siembra**: la crea el inspector en vivo desde el teléfono (paso 1) y el
push la sube (paso 2). Con odómetro capturado p.ej. `160000` y RTDs `~11`, la vista devuelve al
instante:

- RTD Gastado = 16 − 11 = **5.0 mm**
- Km Recorrido = 160000 − 120000 = **40 000 km**
- % Consumo = 5/16 = **31.3%**
- Km/mm = 40000/5 = **8 000 km/mm**
- Costo/Km = 1400/40000 = **0.035/km**
- Km Acumulado = 0 + 40000 = **40 000 km**
- (Km Proyectado queda NULL sin `rtd_removal_mm` — o se siembra `rtd_thresholds` con
  `rtd_removal_mm=4` para mostrarlo: 8000 × (16−4) = **96 000 km**)

Verificación paso 3 sin tocar los HTML: basta mostrar el Table Editor de Supabase o un
`select * from v_tire_performance` en el SQL Editor. Conectar los HTML reales a Supabase es
Run 2 — para el jueves alcanza con demostrar que **el dato del teléfono llegó y la métrica sale
de SQL**, no del mock.

## Checklist técnico previo al jueves

- [ ] Proyecto Supabase creado (Facundo) con URL + anon key en `.env` local del teléfono.
- [ ] Ejecutar el subconjunto mínimo del schema draft (tablas 1–7 + vista).
- [ ] Sembrar las filas del guion (SQL de 20 líneas; puede ir como `supabase/seed_demo.sql` en Run 2).
- [ ] Implementar el push mínimo del `sync_queue` (task_14 pasos 3–5) **o**, plan B si el sync no
      llega: exportar la inspección del SQLite y subirla con un INSERT manual — la demo sigue
      probando esquema + vista.
- [ ] RLS DESACTIVADA para la demo (o política permisiva con anon key) — activarla es parte de la
      migración real, no del jueves.
