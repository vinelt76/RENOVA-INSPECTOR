# task_16 — Umbrales RTD configurables por empresa + snapshot reproducible

> Depende de **task_15 aprobado** (reusa el mismo patrón de RPC de solo lectura y deja estable
> el flujo de preload donde este task agrega el pull de umbrales).

## Objetivo

`rtd_cambio=4` / `rtd_proximo=7` viven hoy como constantes de código en **3 lugares**:
`app/src/db/repos/inspeccionRepo.ts:7-8`, `app/src/sync/pushInspeccion.ts:11-13` y el default de
peso ISA en `app/src/core/calculations.ts:159`. `specs/reglas_negocio.md` §2 exige que salgan de
una tabla `umbral_rtd` por empresa+medida — **"NUNCA hardcodear"**. Además, `inspeccion_neumatico`
guarda `estado_rtd` pero no el umbral contra el que se calculó: si el umbral cambia, el histórico
deja de ser reproducible.

El servidor **ya tiene** la tabla real (`rtd_thresholds`, en
`supabase/migrations/20260706120000_demo_vertical_slice.sql:145-155`, por `company_id` +
`size_name` opcional) — este task no la crea, la **consume**.

## Contexto / archivos

- `app/src/db/sqlite.ts` — agregar el próximo bloque de migración versionada (revisar el número
  de versión actual antes de escribir el nuevo `if (currentVersion < N)`; NO reordenar ni tocar
  los bloques existentes, en particular el `DROP TABLE ... sync_queue` de v1 que debe seguir
  gateado solo a instalación fresca).
- `app/src/db/repos/inspeccionRepo.ts` — `DEFAULT_RTD_CAMBIO`/`DEFAULT_RTD_PROXIMO` (líneas 7-8)
  y `upsertNeumatico` (líneas 87-174).
- `app/src/sync/pushInspeccion.ts` — `RTD_PARA_CAMBIO`/`RTD_PROXIMO_CAMBIO`/`RTD_NORMAL`
  (líneas 11-13) y el payload de `items` (líneas 53-75).
- `app/src/core/calculations.ts` — `calcularEstadoRtd`, `calcularEstadoPresion`,
  `calcularIsaPeso`: **no modificar sus firmas**, solo cambia quién les pasa los parámetros.
- `supabase/migrations/20260706120000_demo_vertical_slice.sql:145-155` — tabla `rtd_thresholds`
  ya aplicada (fuente de verdad server-side).
- `specs/reglas_fijas_vs_configurables.md` — documento de la deuda a actualizar.

## Pasos

1. **SQLite local** (nueva versión de migración en `sqlite.ts`):
   - Tabla `umbral_rtd (empresa_id TEXT NOT NULL, medida TEXT NOT NULL, rtd_cambio REAL NOT NULL,
     rtd_proximo REAL NOT NULL, rtd_normal REAL NOT NULL, PRIMARY KEY (empresa_id, medida))`.
     Usar `medida = '*'` como fila default/fallback por empresa.
   - Sembrar, para cada `empresa` existente, una fila `('*', 4, 7, 8)` (los defaults actuales) —
     así ninguna empresa queda sin umbral y el comportamiento no cambia hasta que se pulle algo
     distinto del servidor.
   - Agregar a `inspeccion_neumatico`: columnas `rtd_cambio_snap REAL`, `rtd_proximo_snap REAL`,
     `rtd_normal_snap REAL`, `isa_peso_snap REAL`. **Backfill** de filas existentes con
     `4, 7, 8` y `NULL` (o `1`) para `isa_peso_snap` en la misma migración — no dejar NULLs que
     luego viajen sin sentido al push.
2. **Nuevo repo** `app/src/db/repos/umbralRepo.ts`:
   - `getRtd(empresaId: string, medida?: string | null): Promise<{rtd_cambio, rtd_proximo, rtd_normal}>`
     — busca por `(empresaId, medida)`, si no hay fila cae a `(empresaId, '*')`.
   - `upsertRtd(empresaId, medida, rtd_cambio, rtd_proximo, rtd_normal): Promise<void>`.
3. **`inspeccionRepo.upsertNeumatico`**: antes de calcular `estado_rtd`, resolver el umbral con
   `umbralRepo.getRtd(cabecera.empresa_id, input.medida)` (requiere levantar la cabecera o pasar
   `empresa_id` como parámetro adicional de `upsertNeumatico` — preferir pasarlo explícito para no
   acoplar con otra tabla). Pasar esos valores a `calcularEstadoRtd(rtd_movi, umbral.rtd_cambio,
   umbral.rtd_proximo)` y **persistir el snapshot** (`rtd_cambio_snap`, `rtd_proximo_snap`,
   `rtd_normal_snap`) junto con la fila. `isa_peso_snap` = `calcularIsaPeso(desecho === 1)` (la
   función ya existe y está testeada, pero no estaba wireada — acá solo se usa para snapshot, NO
   se activa ningún cálculo de ISA agregado en UI).
   - Borrar `DEFAULT_RTD_CAMBIO`/`DEFAULT_RTD_PROXIMO` como constantes de módulo (quedan
     encapsuladas dentro de `umbralRepo` como el default de siembra, no como fallback de cálculo).
4. **`pushInspeccion.ts`**: `rtd_for_change`, `rtd_next_change`, `rtd_normal` del payload salen de
   `n.rtd_cambio_snap`, `n.rtd_proximo_snap`, `n.rtd_normal_snap` (snapshot de la fila), no de las
   constantes de módulo. Borrar `RTD_PARA_CAMBIO`/`RTD_PROXIMO_CAMBIO`/`RTD_NORMAL`.
5. **Pull desde Supabase**: nueva función RPC `get_umbrales_rtd(p_company_name text)` (mismo
   patrón `security definer` acotado que `get_unidad_preload`) que lee `rtd_thresholds` de esa
   empresa. En `app/src/sync/` agregar `pullUmbrales.ts`: al preload (o al abrir empresa), traer
   los umbrales y `umbralRepo.upsertRtd(...)` local uno por cada fila devuelta. Sin red o sin
   `.env`, la app sigue usando el default sembrado — nunca bloquea.
6. **Tabla inerte de presión** (paridad de diseño, sin activar cálculo): crear
   `umbral_presion (empresa_id, medida, tipo_eje, presion_frio, delta_alto_pct, delta_bajo_pct)`
   en la misma migración local, y su equivalente comentado como **NO USADO AÚN** — no escribir
   ningún código que la lea. **No** wirear `calcularEstadoPresion` a ningún flujo: la referencia
   CALIENTE sigue **ABIERTA** (CLAUDE.md / `specs/reglas_negocio.md` §3) y no debe inventarse.
7. Actualizar `specs/reglas_fijas_vs_configurables.md` quitando la entrada de deuda de RTD (la de
   presión/ISA queda, están aún inertes).

## Criterios de aceptación

- Ningún `4`/`7`/`8` hardcodeado de umbral RTD queda como constante de flujo en
  `inspeccionRepo.ts` ni en `pushInspeccion.ts` (grep debe dar limpio salvo el valor de siembra
  inicial en la migración).
- Sembrar en la base local un `umbral_rtd` distinto para una empresa (p.ej. `rtd_cambio=6`) hace
  que un neumático con `RTD_MOVI` entre 4 y 6 pase de "Normal"/"Próximo" a "Para Reencauche" según
  corresponda, **sin recompilar**.
- Cada fila de `inspeccion_neumatico` nueva o editada guarda su snapshot de umbrales; recargar la
  página y volver a ver la posición muestra el mismo `estado_rtd` aunque el umbral de la empresa
  cambie después.
- El payload de `save_inspection` sigue teniendo `rtd_for_change`/`rtd_next_change`/`rtd_normal`,
  ahora tomados del snapshot de la fila.
- `calcularEstadoPresion`/`calcularIsaPeso` siguen sin invocarse desde ningún flujo de UI/repo más
  allá del snapshot de `isa_peso_snap`. Ningún estado de presión aparece en pantalla.
- `npm run build`, `npm test` (con casos nuevos para el snapshot y el fallback `'*'`), `npm run
  lint` verdes.

## Cómo verificar

Smoke test en navegador OBLIGATORIO: `npm run dev`; con la app corriendo, insertar manualmente
(vía consola/DevTools o un script temporal) un `umbral_rtd` distinto para la empresa activa;
capturar un neumático con RTD limítrofe y confirmar que `estado_rtd` refleja el nuevo umbral;
recargar la página y confirmar que el snapshot persiste (no se recalcula con el umbral vigente,
sino que muestra el histórico). Revisar en Network/consola el payload que se manda a
`save_inspection` y confirmar que los 3 campos de umbral viajan coherentes con el snapshot. Cero
errores de consola. Anotar recorrido y resultado en `STATE.md`.

## Fuera de alcance

- Cualquier cálculo o UI de estado de presión, incluida la referencia CALIENTE (sigue ABIERTA).
- Activar ISA como score visible/agregado — solo se persiste el snapshot por fila.
- UI de administración de umbrales por empresa (pantalla de configuración) — este task solo
  resuelve el contrato de datos, no la edición.
- task_17 (cola de sync durable), task_18 (tests/bundle) — no tocar `sync_queue` ni
  `vite.config.ts` en este task.
