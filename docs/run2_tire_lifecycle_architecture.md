# Run 2 — Arquitectura del ciclo de vida del neumático

Decisión central de Run 2: el sistema distingue **cuatro entidades** que antes estaban
mezcladas (en la app son texto por medición; en el borrador Run 1 eran una sola tabla `tires`).

```
tire_casings (CASCO físico — identidad permanente)
   │ 1:N
tire_life_cycles (CICLO: Nuevo, R1, R2, … — cada uno arranca en km 0)
   │ 1:N
tire_installations (una instalación de UN ciclo en UNA unidad+posición)
   │ 1:N (por ventana temporal unidad+posición)
inspections / inspection_measurements (eventos de inspección)
```

## Por qué cuatro niveles

| Entidad | Qué representa | Qué le pertenece |
|---|---|---|
| **Casco** (`tire_casings`) | El objeto físico: carcasa con su código de fuego, marca, modelo, medida. Existe desde la compra hasta el descarte. | Identidad, estado global (activo/descartado), causa y foto del descarte. **Su historia jamás se pierde.** |
| **Ciclo de vida** (`tire_life_cycles`) | Una banda de rodamiento: la original (N, ciclo 0) o cada reencauche (R1, R2…). | OTD (profundidad de SU banda), costo (neumático nuevo o reencauche), diseño de reencauche, estado (activo / reencauchado / descartado), fechas inicio/fin. |
| **Instalación** (`tire_installations`) | Un intervalo del ciclo montado en una unidad+posición concreta. | Odómetro y RTD al montar (punto 0 del rendimiento), unidad, posición, fechas. |
| **Inspección** (`inspections` + `inspection_measurements`) | El evento de campo: la fuente primaria de datos operativos (RTD, presión, anomalías, odómetro). | Todos los crudos del inspector + derivados calculados en el dispositivo. |

Cardinalidades (reglas de negocio Run 2):

- Un casco tiene **N ciclos** (compró nuevo → R1 → R2 → descarte).
- Un ciclo tiene **N instalaciones** (montado en el bus A, rotado al bus B, pasado por retén y montado de nuevo).
- Una instalación tiene **N inspecciones** (las quincenales/mensuales mientras estuvo montado).

## Invariantes garantizados por el esquema

| Regla | Mecanismo |
|---|---|
| Un solo ciclo ACTIVO por casco | `unique index … on tire_life_cycles (casing_id) where status='active'` |
| Un ciclo no repite número en el casco | `UNIQUE (casing_id, cycle_number)` |
| Una sola instalación activa por unidad+posición | `unique index … on tire_installations (unit_id, position_number) where not removed` |
| Un ciclo no está montado en dos lugares a la vez | `unique index … on tire_installations (life_cycle_id) where not removed` |
| Un retiro cierra exactamente una instalación | `tire_removals.installation_id UNIQUE` |
| Una inspección por unidad por día | `UNIQUE (unit_id, inspected_on)` |
| Una medición por posición por inspección | `UNIQUE (inspection_id, position_number)` |

## La jerarquía de kilómetros (todo derivado, nada almacenado a mano)

```
km instalación = odómetro_final_efectivo − odómetro_instalación
km ciclo       = Σ km de las instalaciones del ciclo        ← arranca en 0 con CADA ciclo
km casco       = Σ km de todos los ciclos del casco         ← nunca se resetea
```

**Odómetro final efectivo** de una instalación (vista `v_installation_km`):

1. Instalación **cerrada** con km de retiro capturado a mano → ese valor (`end_odometer_source='manual'`).
2. Cerrada sin km manual → odómetro de la **última inspección** dentro de la ventana
   `[installed_at, removed_at]` (`'last_inspection'`).
3. **Activa** → odómetro de la última inspección desde `installed_at` (`'last_inspection'`).
4. Sin ninguna fuente → `NULL` con `'unknown'`. **Nunca se inventa 0**: la fila aparece como
   "Sin datos" igual que `computeTire()` del mock.

El origen se persiste además en `tire_removals.odometer_source` (regla: *store the source*),
y la vista lo re-expone por si hay filas históricas sin resolver.

## Ejemplo completo (es el seed de la demo — verificado contra PostgreSQL)

Casco **CAS-003**:

```
Ciclo 0 (N, OTD 16, costo 1600):
  instalación en AAV-803 P3: 2025-06-01 @ 80.000 km
  retiro (reencauche):        2025-12-20 @ 128.000 km (manual)
  → km ciclo 0 = 48.000

Ciclo 1 (R1, diseño NZA2AW, OTD 14, costo 500):   ← arranca en km 0
  instalación en AAV-803 P3: 2026-01-15 @ 130.000 km (activa)
  inspección demo:            hoy @ 160.000 km, RTD MOVI 9.5
  → km ciclo 1 = 30.000
```

Resultados de las vistas (salida real de la validación):

| Vista | CAS-003 |
|---|---|
| `v_tire_performance` (P3) | km_run 30.000 · km/mm 6.667 · % consumo 32,1 (contra OTD 14 del R1) · **cycle_km 30.000 · casing_km 78.000** · costo/km 0,0167 (500/30.000) |
| `v_life_cycle_performance` | ciclo 0: 48.000 km, km/mm 4.571, costo/km 0,0333 · ciclo 1: 30.000 km, km/mm 6.667, costo/km 0,0167 |
| `v_casing_lifetime_performance` | 2 ciclos · 78.000 km de vida · inversión 2.100 · **costo/km de por vida 0,0269** |

Ese último número es el argumento de venta del modelo: el costo/km de por vida del casco
reencauchado (0,0269) es mejor que el de cualquier neumático nuevo de la flota (0,0467–0,0533) —
métrica imposible de obtener sin separar casco/ciclo/instalación.

## Qué NO se almacena nunca como fuente de verdad

- km del ciclo, km del casco, km recorridos, km/mm, % consumo, km proyectado, costo/km →
  **siempre vistas** (`views_demo.sql`). Si un evento se corrige, todo recalcula solo.
- El único "cache" tolerado es `units.last_odometer/last_inspected_at` (UX de la app), y está
  documentado como cache, no como verdad.

## Relación con lo que la app captura hoy

La app NO conoce cascos ni ciclos: manda mediciones con identidad en texto
(`tire_code`, `brand_name`, …). El puente es en dos fases:

- **Hoy (demo):** `inspection_measurements.life_cycle_id` queda NULL; las vistas unen
  instalación ↔ inspección por `(unit_id, position_number, ventana temporal)` — funciona sin
  tocar la app.
- **Run 3:** al ingresar una medición, el servidor resuelve la instalación activa de esa
  unidad+posición y setea `life_cycle_id` (y valida que el `tire_code` coincida con el casco —
  discrepancia = alerta de rotación no registrada, dato valioso, no error fatal).

## Cierre de eventos (Run 3, funciones SQL)

- **Retiro** → marca `removed=true`, resuelve odómetro con la cascada manual/última
  inspección/unknown y persiste `odometer_source`. Si `reason='discard'` exige causa+foto y
  desciende: ciclo → `discarded`, casco → `discarded`.
- **Reencauche** → cierra el ciclo n (`retreaded`) y crea el ciclo n+1 (km 0, OTD y costo
  nuevos). El casco no se toca.
- **Rotación** → retiro (reason `rotation`) + nueva instalación del MISMO ciclo en otra
  posición/unidad. El km del ciclo sigue sumando.
