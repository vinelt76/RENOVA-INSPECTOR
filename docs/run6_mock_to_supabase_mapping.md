# RUN 6 — Auditoría mock vs Supabase en dashboards HTML (Fase 2)

Estado ANTES de run6: **ningún** dashboard HTML leía Supabase (el "estado conocido"
de que rendimiento/inspecciones ya leían Supabase era incorrecto — solo la app
tenía un intento de sync, roto porque el RPC no existía).

Patrón aplicado (idéntico en todas las páginas):

```
supabase-config.local.js  (gitignoreado, url + anon key)  →  window.RENOVA_SUPABASE
supabase-demo.js          (committeado, sin secretos)      →  RenovaSupabase.fetchView()
página HTML: render mock inmediato → fetch vista → si OK reemplaza dataset y re-renderiza
badge fijo: "DATOS: SUPABASE · CIVA" (verde) | "DATOS: DEMO LOCAL (MOCK)" (amarillo)
```

## rendimiento.html — CONECTADO

| Aspecto | Detalle |
|---|---|
| Mock | `MOCK_UNITS` (B-118, B-204) — **se conserva como fallback** |
| Fuente real | `v_rendimiento_dashboard_rows` (nueva, run6) |
| Mapeo | fila → `{rtdInstalacion←rtd_at_install_mm, rtdActual←current_rtd_mm, kmInstalacion←odometer_at_install, kmActual←current_odometer_km, otd←otd_mm, rtdRetiro←rtd_removal_mm (umbral por empresa), costo←cost, kmPrevioAcumulado←casing_km_accumulated−km_run}` |
| Fórmulas en HTML | `computeTire()`/`computeAxle()` **intactas** (regla del run: no quitar lógica del HTML). La vista trae las mismas métricas en SQL; se usan como referencia, no reemplazan el cálculo del HTML |
| Nuevo | Panel plegable "Datos fuente · instalación e inspección" por neumático |
| Umbral balance eje | `AXLE_BALANCE_THRESHOLD_PERCENT = 15` sigue en HTML (existe `balance_threshold_pct` en `v_axle_performance` — pendiente de usar) |

## inspecciones-demo.html — CREADO (no existía)

| Aspecto | Detalle |
|---|---|
| Fuente real | `v_inspection_dashboard_rows` (28 filas CIVA + lo que sincronice la app) |
| Mock fallback | `MOCK_ROWS` mínimo (3 posiciones, 1 inspección) |
| Muestra | por inspección: placa, fecha, odómetro, inspector; por posición: código (N/V en gris), RTD A/B/C/D, MOVI, estado RTD (chip semáforo), presión, estado presión, válvula, anomalía, desecho |

## vista-flota.html — CONECTADO

| Aspecto | Detalle |
|---|---|
| Mock | generador determinista `MOCK_INSPECTIONS` (~30 unidades/fecha) — conservado |
| Fuente real | `v_inspection_dashboard_rows` reagrupada a `{fecha: [unidades{tires}]}` |
| Lógica de color | `tireStatus()`/`calculateUnitStatus()` **intactas** (regla exclusiva de la pantalla); `rtd ← rtd_movi_mm`, `withdrawalAnomaly ← is_discard` |
| Nota real | con datos reales cada fecha tiene 1–2 unidades (así es el Excel: cada bus se inspeccionó en fecha distinta). No es un bug |
| No usado aún | `v_fleet_unit_status`/`v_fleet_status_summary` calculan lo mismo server-side — pendiente de decidir cuál manda (hoy manda el HTML, coherente con "no quitar lógica del HTML todavía") |

## inventario.html / historial-neumatico.html — NO conectados (fuera de alcance run6)

- `inventario.html`: mock propio; candidata `v_inventory_status`.
- `historial-neumatico.html`: mock `HISTORIAL` por # serie; candidatas
  `v_casing_history_summary` / `v_casing_installations` / `v_casing_inspections`.
  Los códigos reales de casco (25324, 241088…) enlazados desde rendimiento hoy
  caen en "sin datos" dentro del historial mock — documentado, no se falsea.

## Campos sin fuente en Supabase (se muestran "sin dato")

- `inspector_name` — profiles está vacío (inspecciones seed sin inspector_id).
- `pressure_psi`/`valve_cap` de las inspecciones seed — el Excel real no trae presión.
- Configuración (2-4 vs 2-4-2) por unidad en las vistas — no expuesta; el label
  de unidad en rendimiento usa `plate · company`.
