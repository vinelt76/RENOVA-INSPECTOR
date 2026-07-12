# task_15 — Metadata real de unidad vía RPC (dejar de adivinar tipo_vehiculo/config)

## Objetivo

`preloadUnidadFromSupabase.ts` hoy **adivina** la configuración del vehículo contando
posiciones (`inferConfig`) y **hardcodea `tipo_vehiculo: 'BUS'`** sin importar la unidad real.
El servidor YA tiene el dato correcto: `units.vehicle_type` y `vehicle_configs.notation`
(`supabase/migrations/20260706120000_demo_vertical_slice.sql:126-139` y `:92-100`). El problema
es que el RPC `get_unidad_preload` (`supabase/migrations/20260710120000_preload_unidad_rpc.sql`)
no los devuelve. Este task cierra esa brecha.

## Contexto / archivos

- `supabase/migrations/20260710120000_preload_unidad_rpc.sql` — función `get_unidad_preload`
  a modificar (agregar columnas, no romper la firma `(p_company_name, p_plate)`).
- `app/src/sync/readInspecciones.ts` — tipo `UnidadPreloadRow` (agregar 2 campos) y
  `listInspeccionesPorPlaca`.
- `app/src/sync/preloadUnidadFromSupabase.ts` — `inferConfig()` (líneas 6-11) y el
  `tipo_vehiculo: 'BUS'` literal (línea 31) a eliminar.
- `app/src/db/repos/unidadRepo.ts` — `upsert()` recibe `tipo_vehiculo`/`configuracion` tal cual
  se le pasen; no requiere cambios.
- Consumidores de `tipoVehiculo`/`configuracion` que NO deben cambiar de firma:
  `app/src/state/context.ts`, `app/src/state/AppContext.tsx`, `app/src/screens/UnidadScreen.tsx`,
  `app/src/db/repos/catalogoRepo.ts` (`configuracion(tipoVehiculo, notacion)`).

## Pasos

1. **Nueva migración** `supabase/migrations/<timestamp>_preload_rpc_vehicle_metadata.sql`:
   `create or replace function public.get_unidad_preload(...)` agregando a la `returns table`
   dos columnas: `vehicle_type text`, `notation text`. En el `select`, joinear
   `public.units u` (ya está en el FROM) con `public.vehicle_configs vc on vc.id = u.config_id`
   y devolver `u.vehicle_type`, `vc.notation`. Mantener `security definer`,
   `set search_path = public` y el `grant execute ... to anon, authenticated` idénticos al
   original — es el mismo patrón de alcance acotado, solo se agregan 2 columnas de solo lectura.
2. **`readInspecciones.ts`**: agregar `vehicle_type: string` y `notation: string` a
   `UnidadPreloadRow`.
3. **`preloadUnidadFromSupabase.ts`**:
   - Borrar la función `inferConfig()` completa.
   - Usar `head.vehicle_type` y `head.notation` en el `unidadRepo.upsert(...)` en vez de
     `'BUS'` y `inferConfig(latestRows)`.
   - Si el servidor devuelve `null`/vacío en cualquiera de los dos (no debería pasar dado que
     ambas columnas son `not null` en `units`/`vehicle_configs`, pero cubrir el caso por las
     dudas): usar `console.warn` y caer al comportamiento actual (`'BUS'` + `inferConfig`) como
     fallback defensivo — NUNCA lanzar ni bloquear el preload.
4. No tocar la UI ni agregar ninguna pantalla de edición de configuración de unidad.

## Criterios de aceptación

- `get_unidad_preload` devuelve `vehicle_type` y `notation` reales para cualquier placa/empresa
  con datos.
- `preloadUnidadFromSupabase` ya no cuenta posiciones para inferir la configuración: usa el dato
  del servidor directamente.
- Con una unidad real no-BUS en los datos de prueba (si existe alguna; si todo el dataset demo
  es BUS, dejarlo documentado en `STATE.md` y verificar igual que el campo viaja correcto para
  BUS) el `tipo_vehiculo` cargado coincide con `units.vehicle_type`.
- `npm run build`, `npm test`, `npm run lint` verdes.

## Cómo verificar

Smoke test en navegador OBLIGATORIO: `npm run dev`, buscar una unidad con historial real en
Supabase (p.ej. una placa ya usada en sesiones anteriores — ver `runbook_recurar_datos.md` si
hace falta), confirmar en la consola/Network que el RPC devuelve `vehicle_type`/`notation` y que
la configuración cargada en pantalla coincide (no cae al fallback `'BUS'`/adivinado salvo que
falte el dato). Cero errores de consola. Anotar recorrido y resultado en `STATE.md`.

## Fuera de alcance

- UI para editar tipo de vehículo o configuración de una unidad.
- Cambios al modelo de datos local (`unidad` en SQLite ya tiene las columnas correctas).
- task_16, task_17, task_18 (umbrales, cola de sync, tests/bundle).
