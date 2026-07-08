# Integración mínima con Supabase (demo)

Guardar inspecciones reales capturadas por la app en Supabase, con cabecera + detalle por
posición. Alcance chico y controlado — ver "Fuera de alcance" al final.

> Nota de orden: `tasks_opencode/STATE.md` declaraba `task_13` antes que `task_14` (Supabase).
> Esta integración adelanta la parte de `task_14` a pedido explícito de Facundo (2026-07-08),
> con alcance reducido a solo lo descrito acá. `task_13` (acordeón + precarga) sigue pendiente
> y no se tocó.

## Fase 1 — Flujo actual (antes de tocar nada)

- **Cabecera se crea en** `UnidadScreen.tsx` → `inspeccionRepo.crearCabecera()` (unidad nueva o
  fecha nueva) o `inspeccionRepo.actualizarCabecera()` (reabrir inspección del mismo día).
- **Datos del formulario** viven en `InspeccionScreen.tsx` (estado `store`/`data` por posición)
  y se autoguardan en SQLite en cada `commit()` → `inspeccionRepo.upsertNeumatico()`.
- **RTD MOVI, IDI, ESTADO RTD, DESECHO** se calculan dentro de `upsertNeumatico()`
  (`app/src/db/repos/inspeccionRepo.ts`), llamando a `app/src/core/calculations.ts`. Umbrales
  hoy hardcodeados (`DEFAULT_RTD_CAMBIO=4`, `DEFAULT_RTD_PROXIMO=7`) — deuda ya documentada.
- **Repositorio existente:** `inspeccionRepo` (`crearCabecera`, `actualizarCabecera`,
  `upsertNeumatico`, `listNeumaticos`, `getCabecera`, `clonarNeumaticos`) y `unidadRepo`.
- **Persistencia:** SQLite local vía `@capacitor-community/sqlite` (nativo) / `jeep-sqlite` +
  sql.js (web). No hay localStorage ni mocks en el camino de captura — solo SQLite real.
- **Envío a servidor:** no existía ningún código de sync antes de este trabajo.
- **No hay "finalizar inspección" explícito** — el punto más cercano es cuando las 8 (o 6)
  posiciones quedan completas y aparece el botón "BUSCAR OTRA UNIDAD →".

## Qué se agregó

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/20260709090000_minimal_inspections_schema.sql` | `vehicles`, `inspections`, `inspection_items` + función `save_inspection(payload)` (upsert transaccional) |
| `app/.env.example` | Documenta `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| `app/src/sync/supabaseClient.ts` | Cliente `supabase-js`, `null` si faltan las env vars |
| `app/src/sync/pushInspeccion.ts` | `pushInspeccionToSupabase(cabeceraId)` — arma el payload desde SQLite y llama al RPC |
| `app/src/sync/readInspecciones.ts` | Lectura mínima: recientes, por placa, detalle (cabecera+items) |
| `app/src/screens/InspeccionScreen.tsx` | Dispara el envío (debounced) cuando la inspección queda completa; chip de estado en el header |
| `app/src/theme.ts` | +1 color `RED` para el estado de error |

## Tablas creadas

**`vehicles`** — `id`, `plate_number` (unique), `operation`, `vehicle_type`, `configuration`,
timestamps. `operation` queda `NULL` (sin fuente en la app hoy). `vehicle_type`/`configuration`
sí se completan, vienen de la unidad local.

**`inspections`** — cabecera: `id`, `vehicle_id`, `plate_number` (snapshot), `inspection_date`,
`inspection_month` (derivado, lo calcula `save_inspection()`), `odometer_km`, `source` (`'apk'`),
`sync_status`, timestamps. `UNIQUE(vehicle_id, inspection_date)` — una inspección por
unidad/día, igual que la regla ya vigente en SQLite local.

**`inspection_items`** — detalle por posición: `id`, `inspection_id`, `vehicle_id`,
`plate_number`, `position`, `axle_type`, `tire_code`, `tire_size`, `tire_brand`,
`original_design`, `current_design`, `tire_condition`, `rtd_a..rtd_d`, `rtd_movi`, `pressure`,
`valve_cap`, `not_measured`, `tire_anomaly`, `rtd_for_change`, `rtd_next_change`, `rtd_normal`,
`scrap`, `rtd_status`, timestamps. `UNIQUE(inspection_id, position)`.

**`save_inspection(payload jsonb)`** — función Postgres que hace upsert de `vehicles` →
`inspections` → `inspection_items` en una sola transacción (todo o nada). Idempotente: reintentar
con el mismo payload actualiza, no duplica.

⚠️ **Colisión conocida:** si el proyecto Supabase real ya tiene aplicada
`supabase/migrations/20260706120000_demo_vertical_slice.sql` (Run 2, modelo de ciclo de vida
casco/ciclo/instalación), esa migración **ya tiene una tabla `inspections` distinta e
incompatible**. Antes de correr esta migración contra el proyecto real: verificar con
`select table_name from information_schema.tables where table_name = 'inspections';` si ya
existe. Si existe con el esquema de Run 2, avisar antes de aplicar esta — no se resuelve solo.

## Campos: guardados / mock / calculados

| Categoría | Campos |
|---|---|
| **Capturados por el inspector, se guardan tal cual** | `plate_number`, `inspection_date`, `odometer_km`, `position`, `tire_code`, `tire_size`, `tire_brand`, `original_design` (modelo), `current_design` (reencauche), `tire_condition`, `rtd_a..rtd_d`, `pressure`, `valve_cap`, `tire_anomaly` |
| **Calculados en el dispositivo, se guardan calculados** | `rtd_movi`, `scrap` (desecho), `rtd_status` (estado RTD), `not_measured` (= `pressure === null`), `inspection_month` (derivado en el servidor) |
| **Snapshot/mock — no vienen de una tabla real todavía** | `vehicle_type`, `configuration` (sí vienen de la unidad local, pero sin catálogo normalizado en Supabase), `operation` (sin fuente, queda NULL), `axle_type` (no se envía desde la app — queda NULL), `rtd_for_change`/`rtd_next_change`/`rtd_normal` (constantes de código: 4/7/8, no de una tabla `rtd_thresholds` por empresa) |

## Variables de entorno

Archivo `app/.env` (o `.env.local`), a partir de `app/.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Prefijo `VITE_` obligatorio (Vite solo expone al navegador las env vars con ese prefijo — el
pedido original sugería `SUPABASE_URL`/`SUPABASE_ANON_KEY`, se adaptó al stack real de la app).
**Sin estas dos variables la app funciona 100% local, exactamente igual que antes de este
trabajo** — `supabaseEnabled` queda `false`, no se intenta ningún request, no aparece ningún
chip nuevo. Nunca commitear `.env`/`.env.local` con valores reales (ya están en `.gitignore`).

## Cómo se dispara el envío (Fase 5)

En `InspeccionScreen.tsx`: cuando todas las posiciones quedan completas (mismo momento en que
aparece el botón "BUSCAR OTRA UNIDAD →"), se dispara `pushInspeccionToSupabase(cabeceraId)` con
un debounce de 1.2s. Si el inspector corrige algo después de completar, se reintenta solo. No
bloquea nada: el guardado local en SQLite ya ocurrió antes (autosave existente) y sigue siendo
la fuente de verdad si el envío a Supabase falla.

Estados visibles (chip pequeño en el header, junto al tick "GUARDADO" existente — **solo
aparece si hay `.env` configurado**):
- `ENVIANDO A SUPABASE…` (mientras está en vuelo)
- `☁ SINCRONIZADO` (éxito)
- `⚠ ERROR DE ENVÍO` (falla — el inspector puede seguir trabajando, nada se bloquea)

## Cómo probar

1. Crear un proyecto Supabase (o usar el real de Facundo) y correr, en el SQL Editor, en orden:
   `supabase/migrations/20260709090000_minimal_inspections_schema.sql` — **revisar primero la
   nota de colisión de arriba**.
2. `cd app && cp .env.example .env.local` y completar `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
   con los datos del proyecto (Settings → API).
3. `npm run dev`, abrir la app, elegir empresa, buscar/crear una unidad, completar las posiciones
   (RTD A-D + presión de cada una).
4. Al completar la última posición, esperar ~1-2s: el chip debe pasar de "ENVIANDO…" a
   "☁ SINCRONIZADO".
5. En el proyecto Supabase, Table Editor: confirmar que apareció 1 fila en `vehicles` (por
   placa), 1 fila en `inspections`, y N filas en `inspection_items` (una por posición) con
   `rtd_a..rtd_d`, `pressure`, `valve_cap`, `tire_anomaly` cargados y `rtd_movi`/`scrap`/
   `rtd_status` ya calculados.
6. Reabrir la inspección y corregir un RTD → confirmar que se reenvía (upsert, no duplica fila
   en `inspection_items`).
7. Apagar la red / usar una URL inválida en `.env.local` → confirmar que el chip pasa a
   "⚠ ERROR DE ENVÍO" y que el resto de la app sigue funcionando con normalidad (verificado en
   esta sesión con una URL falsa: la app no se rompe, el error queda contenido en el chip).
8. Probar `readInspecciones.ts` desde la consola del navegador (`import` dinámico) o cablearlo
   a una pantalla futura: `listInspeccionesRecientes()`, `listInspeccionesPorPlaca(placa)`,
   `getInspeccionDetalle(id)`.

### Smoke test ya ejecutado en esta sesión

`npm run build`, `npm run lint`, `npm test` (23/23) verdes. Además, recorrido completo en
navegador (Playwright headless) contra `npm run dev`: (a) sin `.env` — flujo Empresa→Unidad→
Inspección idéntico a antes, 0 errores de consola, chip nuevo no aparece; (b) con `.env` de
prueba apuntando a una URL inválida — se completaron 6 posiciones de una unidad nueva, el chip
mostró `ENVIANDO A SUPABASE…` y después `⚠ ERROR DE ENVÍO` correctamente, la petición se vio
dirigida al endpoint esperado (`/rest/v1/rpc/save_inspection`), y la app no se rompió. No se
probó contra un proyecto Supabase real (sin credenciales de red en este entorno) — punto 1-6 de
arriba quedan pendientes de correr con el proyecto real de Facundo.

## Fuera de alcance (a propósito)

Almacén virtual · Retén · Retiradas · Movimientos de neumático · Tabla `tires` normalizada ·
Catálogos normalizados (marca/medida/diseño como FK) · `rtd_thresholds` real por empresa/medida
(siguen siendo constantes 4/7/8 en el código) · Multiempresa (no hay `company_id`, es de una
sola tabla `vehicles` sin tenancy) · Autenticación (RLS desactivada a propósito — anon key
abierta, ver comentario en la migración) · Dashboard/vista de inspecciones (las funciones de
lectura quedan preparadas pero no conectadas a ninguna pantalla) · `task_13` (acordeón/precarga
de la UI de captura) — no se tocó.
