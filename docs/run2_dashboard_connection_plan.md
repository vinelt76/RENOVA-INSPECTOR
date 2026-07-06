# Run 2 — Plan de conexión de los dashboards

Regla de este run: **los HTML no se reescriben** y el mock **no se borra**. Este documento
define qué leerá cada dashboard cuando se conecte (Run 3) y el patrón de fallback que garantiza
que la demo actual nunca se rompa.

## Qué lee cada dashboard

### `rendimiento.html` / `rendimiento-por-neumatico.html` → `v_tire_performance`

| Elemento de la card (hoy calculado en JS) | Columna de la vista |
|---|---|
| Km Acumulado | `cycle_km_accumulated` (ciclo actual) — y NUEVO dato disponible: `casing_km_accumulated` (vida del casco) |
| Km Recorrido | `km_run` |
| Km Proyectado | `km_projected` |
| RTD Gastado | `rtd_worn_mm` |
| Km/mm | `km_per_mm` |
| % de Consumo | `consumption_pct` |
| Costo/Km | `cost_per_km` |
| Identidad (modelo · reencauche R1) | `brand_name`+`model_name`, `condition`, `retread_design`, `casing_code` |
| "Sin datos suficientes" | cualquier métrica `NULL` (la vista nunca inventa 0) |
| Modal Historial (hoy placeholder) | `v_life_cycle_performance` + `v_casing_lifetime_performance` filtrados por `casing_id` — el contenido que el placeholder promete ya existe en SQL |

Consulta: `GET /rest/v1/v_tire_performance?unit_id=eq.<uuid>&order=position_number`.

El modo "Ver por eje" puede seguir agregando client-side sobre las filas de la vista (misma
lógica `computeAxle()` actual) — no hace falta `v_axle_performance` para la demo; queda para
Run 3 junto con `axle_balance_thresholds`.

### `vista-flota.html` → (Run 3) vista de flota

Necesita una `v_fleet_status` (bosquejada en `schema_draft.sql`, no incluida en la slice mínima).
Cuando se agregue: KPIs y grid leen `unit_status`, `worst_rtd_mm`, `critical_tires`,
`warning_tires` por `inspected_on`. **Importante:** el estado saldrá de `rtd_state`/`is_discard`
guardados (umbrales de empresa), no del 4/8 hardcodeado del mock.

### `UI/renova_dashboard_taller_v1.html` → tablas crudas

Panel de taller = lectura directa: `inspections` (última por unidad) + `inspection_measurements`
(canales A–D, presión, anomalías, desecho) + `rtd_thresholds` para pintar el medidor de umbrales.
Sus botones (Retén/Descartar) escribirán `tire_removals`/`tire_inventory_movements` en Run 3+.

## Patrón de conexión seguro (cuando se haga)

Cambio mínimo y reversible por dashboard — un solo bloque al inicio del `<script>`:

```js
/* ── Fuente de datos: Supabase si está configurado; SIEMPRE fallback al mock ── */
const SUPABASE_URL = "";      // vacío = modo mock (comportamiento idéntico al actual)
const SUPABASE_KEY = "";

async function loadUnits() {
  if (!SUPABASE_URL) return UNITS;                    // mock intacto
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/v_tire_performance?...`,
                          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!r.ok) throw new Error(r.status);
    return adaptRows(await r.json());                  // → misma forma que UNITS
  } catch (e) {
    console.warn("Supabase no disponible, usando datos de demostración", e);
    return UNITS;                                      // el mock nunca se borra
  }
}
```

Principios:
1. `UNITS`/`TIRES` mock quedan en el archivo tal cual — son el fallback y la documentación viva
   del formato.
2. `adaptRows()` transforma filas de la vista a la estructura del mock; las funciones
   `computeTire()`/`derive()` del HTML **no se tocan** (siguen siendo la referencia visual de las
   fórmulas hasta que la migración a SQL esté auditada contra ellas).
3. Con `SUPABASE_URL` vacío el archivo es byte-idéntico en comportamiento al actual → cero
   riesgo para la demo.

## Decisión para el jueves

**No se conecta ningún HTML.** La lectura desde Supabase se demuestra con el SQL Editor /
Table Editor (los SELECT de `run2_demo_backend_setup.md`), que muestran las MISMAS métricas que
las cards del dashboard. Conectar `rendimiento.html` con el patrón de arriba es el primer
candidato de Run 3 (bajo riesgo: página de solo lectura, una vista, un adaptador).

## Requisito previo a conectar de verdad (Run 3)

- Exponer las vistas por PostgREST con RLS o con una `anon` policy de solo lectura acotada.
- Definir `security_invoker` en las vistas cuando se active RLS.
- CORS: los HTML son archivos sueltos (file://) — servirlos desde un host (Supabase Storage,
  Vercel o el propio dominio) antes de habilitar fetch.
