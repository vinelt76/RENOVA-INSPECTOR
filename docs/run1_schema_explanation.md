# Run 1 — Explicación del esquema (`supabase/schema_draft.sql`)

Borrador para revisión — **no** es migración final. Diagrama de dependencias:

```
companies ─┬─ fleets
           ├─ profiles (↔ auth.users)
           ├─ units ──────────────┐ (config_id)
           ├─ tires ◄─────────────┼───────────────┐
           ├─ rtd_thresholds      │               │
           ├─ pressure_thresholds │               │
           ├─ axle_balance_thresholds             │
           ├─ isa_weights         │               │
           └─ import_batches ── import_errors     │
                                  │               │
vehicle_configs ── axles ── tire_positions        │
                                  │               │
units ◄── inspections ◄── inspection_measurements │
  │                               (tire_id·opc) ──┤
  └── tire_installations ◄── tire_removals ───────┤
                └──────── tire_inventory_movements┘

catalog_brands ── catalog_models     catalog_sizes
catalog_anomalies  catalog_valve_caps  catalog_retread_designs  catalog_conditions

Vistas: v_tire_performance · v_axle_performance · v_fleet_status
```

## Tabla por tabla

### Tenancy

**`companies`** — Empresa cliente (tenant raíz). PK uuid; `legacy_code` UNIQUE mapea los ids slug
del SQLite actual (`movil`, `cruz`, …) durante el sync. `active` para desactivar sin borrar.
Requeridos: `name`. RLS futura: es el pivote de todas las políticas. Las 5 empresas actuales se
cargan por import/seed de datos — el esquema no las conoce.

**`fleets`** — Flota/operación dentro de una empresa. FK `company_id`; `UNIQUE(company_id,name)`.
Opcional a nivel unidad (hoy `empresa.flota` es null en la app). RLS: por `company_id`.

**`profiles`** — Perfil 1:1 con `auth.users` (PK = id del user). FK `company_id`; enum `user_role`
(inspector/supervisor/jefe de flota/jefe de taller/admin). Cubre el `app_user` de task_14 y el
`inspector_id` de las cabeceras. RLS: cada usuario lee su fila; las políticas de las demás tablas
consultan `profiles.company_id`.

### Catálogo PATRON (compartido, sin tenant)

**`catalog_brands` / `catalog_models` / `catalog_sizes` / `catalog_retread_designs` /
`catalog_anomalies` / `catalog_valve_caps` / `catalog_conditions`** — espejo 1:1 de las `cat_*`
locales. PK uuid + `slug` UNIQUE (clave de reconciliación con los ids slug locales en el pull
INSERT-OR-IGNORE de fase 1). `catalog_anomalies.is_discard` dispara el DESECHO automático.
`catalog_sizes.default_otd` es dato nuevo (pendiente RENOVA). RLS: SELECT para autenticados,
escritura restringida; las altas de campo (marcas/modelos/medidas/diseños nuevos) suben por push
controlado.

### Configuración de vehículo

**`vehicle_configs`** — (tipo, notación) del PATRON, p.ej. BUS 2-4-2. `is_mvp` replica el flag
`mvp` local (la app solo ofrece BUS 2-4 y 2-4-2). UNIQUE(vehicle_type, notation).

**`axles`** — ejes de una config: número, tipo (Direccional/Tracción/Libre/Dual). El tipo de eje
determina 3 vs 4 canales RTD (reglas §1) y es la unidad de agregación del dashboard "por eje".
UNIQUE(config_id, axle_number).

**`tire_positions`** — posiciones P1..Pn de una config, con FK al eje, `side` (Izq/Der) y
`is_ground` (campo `piso`: repuesto elevado = false). UNIQUE(config_id, position_number). Las
mediciones referencian `position_number` (entero) — no FK dura — porque así viaja desde el
teléfono; la vista de ejes une por config de la unidad + número.

### Umbrales configurables (regla de oro: nunca hardcodear)

**`rtd_thresholds`** — por empresa (+medida opcional; fila con `size_id NULL` = default de la
empresa): `rtd_change_mm` (4), `rtd_next_mm` (7), `rtd_normal_mm` (8), y `rtd_removal_mm` = "RTD
Retiro recomendado" que usa Km Proyectado. Sustituye los DEFAULT 4/7 hardcodeados del repo local.

**`pressure_thresholds`** — por empresa/medida/tipo de eje: `cold_psi`, deltas ±%. **`hot_psi`
queda NULL**: la referencia CALIENTE es decisión abierta — la columna existe para no romper el
esquema cuando se defina, pero no se puebla ni se usa.

**`axle_balance_thresholds`** — el 15% de desbalance de `rendimiento.html` (anotado allí como
configurable pendiente de RENOVA), por empresa.

**`isa_weights`** — pesos 5/1 del ISA por empresa (reglas §6).

### Unidades y neumáticos

**`units`** — vehículo. La PK compuesta local (numero+empresa) se vuelve uuid +
`UNIQUE(company_id, plate)`. FK a config; `status` enum (activo / pendiente de validación —
altas desde campo, flujo_inspeccion — / inactivo); caches `last_odometer`/`last_inspected_at`.

**`tires`** — **neumático físico** (la entidad que hoy no existe: en la app es texto repetido por
medición). Lleva identidad (código de fuego, marca/modelo/medida por FK), condición N/R1..R4,
diseño del último reencauche, y los tres insumos de rendimiento que hoy son mock: `otd_mm`,
`cost`, `accumulated_km`. `status` enum de inventario (almacén/instalado/retén/reencauche/
descartado) + campos de descarte (fecha, causa enum del modal de taller, foto). Índice único
parcial `(company_id, code) WHERE code IS NOT NULL` — permite cascos sin código legible.

**`tire_installations`** — evento de montaje: neumático × unidad × posición, con
`rtd_at_install_mm` y `odometer_at_install` (los datos fuente de TODAS las fórmulas de
rendimiento). Índice único parcial: solo UNA instalación activa (`NOT removed`) por
unidad+posición.

**`tire_removals`** — evento de retiro, 1:1 con su instalación (`installation_id` UNIQUE):
odómetro y RTD al retirar, `reason` enum (reencauche/rotación/retén/descarte/otro),
`discard_cause` + `photo_url` (la app los exige cuando reason=descarte; el borrador no usa CHECK
cruzado para no rigidizar el draft), `premature_discard` (§11, fase futura). Al confirmar un
retiro el sistema (func/trigger en la implementación) suma `odómetro_retiro −
odómetro_instalación` a `tires.accumulated_km` y actualiza `tires.status`.

**`tire_inventory_movements`** — bitácora de cambios de estado del neumático (quién, cuándo,
por qué evento). El estado ACTUAL vive en `tires.status`; esto es auditoría/historial para el
panel de taller.

### Inspecciones (espejo del teléfono)

**`inspections`** — cabecera. **PK sin default: el UUID lo genera el dispositivo** y el push hace
upsert por id con last-write-wins sobre `updated_at` (task_14). FK a unidad;
`UNIQUE(unit_id, inspected_on)` codifica "una inspección por unidad por día" (decisión task_12).
`device_created_at` conserva el reloj del teléfono.

**`inspection_measurements`** — medición por posición (espejo de `inspeccion_neumatico`). PK del
dispositivo; `UNIQUE(inspection_id, position_number)` espeja el índice antiduplicados local (fix
v2). Tres grupos de columnas:
1. *Identidad texto* (`tire_code`, `brand_name`, `model_name`, `size_name`, `condition`,
   `retread_design`) — exactamente lo que la app manda hoy; nunca se pierde aunque después se
   resuelva la FK.
2. *Crudos* — canales `rtd_a..d_mm`, `pressure_psi`, `temperature_mode` (aún no capturado),
   `valve_cap`, `anomaly`, foto de anomalía (futura).
3. *Derivados del dispositivo* — `rtd_movi_mm`, `idi_mm`, `rtd_state`, `pressure_state`,
   `is_discard`. Fase 1: el servidor los **recibe**, no los recalcula (paridad client-side).
`tire_id` es nullable: cuando exista el flujo de instalación, el sistema podrá vincular la
medición al casco físico sin migrar datos viejos.

### Importaciones

**`import_batches`** — un lote por archivo/fuente (Excel histórico, CSV de unidades, seed de
catálogo), con estado, conteos y quién importó. `company_id` nullable porque un batch puede CREAR
la empresa. Es el mecanismo que garantiza que empresas futuras entren sin tocar código.

**`import_errors`** — errores fila a fila con `raw_data jsonb` para reprocesar.

### Vistas de rendimiento (en vez de tabla `performance_metrics`)

Se eligió **vistas** y no tabla materializada: los volúmenes del MVP (~5 empresas, decenas de
unidades, inspecciones quincenales/mensuales) no justifican materializar, y una vista nunca se
des-sincroniza de los datos. Si el rendimiento lo pidiera, se materializa después sin cambiar
contratos.

- **`v_tire_performance`** — B1–B8 del inventario de fórmulas: instalación activa + última
  inspección de esa unidad/posición → RTD Gastado, Km Recorrido, % Consumo, Km/mm, Km Proyectado
  (con `rtd_removal_mm` de la empresa), Costo/Km, Km Acumulado. NULL donde falten fuentes
  (paridad con `computeTire()`: jamás inventar 0).
- **`v_axle_performance`** — C1–C3: promedios y dispersión (máx−mín)/promedio×100 por eje. El
  veredicto verde/rojo se resuelve contra `axle_balance_thresholds` del tenant.
- **`v_fleet_status`** — D1–D4: semáforo por unidad = peor caso de sus mediciones usando
  `rtd_state`/`is_discard` **ya calculados con umbrales de empresa** (corrige el 4/8 hardcodeado
  del mock de vista-flota).

## Decisiones del borrador (para discutir en review)

1. **Inglés en tablas/columnas, español en COMMENT** — convención Supabase/Postgres del task;
   el vocabulario de dominio queda documentado en cada tabla.
2. **Identidad texto + FK opcional** en mediciones — no bloquea el sync de hoy y deja el camino
   a `tires` sin migración dolorosa.
3. **Enums Postgres** para estados — validación en la DB y legibilidad; si el catálogo de causas
   de descarte debe ser editable por empresa, se convertirá en tabla (pregunta abierta).
4. **`tire_inventory_movements` como bitácora** (no tabla de stock): el stock actual es
   `tires.status`; el historial auditable es la bitácora. Evita duplicar verdad.
5. **RLS solo anotada** — el draft no ejecuta `ENABLE ROW LEVEL SECURITY` ni políticas; van en
   la migración real junto con los tests de dos usuarios (criterio task_14).
6. **Sin triggers en el draft** — los efectos (accumulated_km, status) se describen y se
   implementarán como función + trigger en la migración final, tras validar reglas con RENOVA.
