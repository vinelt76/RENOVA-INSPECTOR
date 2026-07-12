# task_18 — Tests de repo/sync + split de bundle

> Depende de **task_16 y task_17 aprobados** (testea código que esos tasks introducen: snapshot
> de umbrales y cola durable). El split de bundle (paso 3) es independiente y puede adelantarse
> si conviene, pero se entrega junto en este task para no abrir un quinto spec por algo tan chico.

## Objetivo

Hoy solo existe `app/src/core/calculations.test.ts` (cálculo puro). La capa de persistencia
(`db/repos/*`) y sync (`sync/*`) no tiene tests — son las partes más propensas a bugs silenciosos
justo porque nadie las vigila. Además, `vite.config.ts` no tiene `manualChunks` y el build avisa
un chunk grande.

## Contexto / archivos

- `app/src/db/repos/inspeccionRepo.ts` — `upsertNeumatico` (dedup por posición, cálculo +
  snapshot de `estado_rtd`, `desecho` automático desde `cat_anomalia`).
- `app/src/db/repos/umbralRepo.ts` (creado por task_16) — `getRtd` con fallback `'*'`.
- `app/src/sync/pushInspeccion.ts`, `app/src/sync/drainQueue.ts` (creado por task_17).
- `app/vite.config.ts` — config actual sin `manualChunks`.
- Ver cómo están configurados los tests existentes (`vitest`/`jest`, según lo que use
  `calculations.test.ts`) para mantener el mismo runner y estilo de mocks.

## Pasos

1. **`app/src/db/repos/inspeccionRepo.test.ts`**:
   - `upsertNeumatico` llamado dos veces para la misma `(cabecera_id, posicion)` no duplica fila
     (usa el mismo `id`).
   - Con 3 canales (`r1,r2,r3`) calcula `rtd_movi`/`idi`/`estado_rtd` igual que con 4
     (`r1..r4`), y persiste el snapshot de umbrales de la fila.
   - Con menos de 3 canales, `rtd_movi`/`idi`/`estado_rtd` quedan `null`.
   - Seleccionar una `anomalia` con `desecho=1` en `cat_anomalia` marca `desecho=1` en la fila
     resultante; sin anomalía o con `desecho=0`, la fila queda `desecho=0`.
   - Requiere un SQLite en memoria de test (usar el mismo fallback web/sql.js que usa `npm run
     dev`, sembrado con datos mínimos — ver `app/src/db/seed.ts` para el patrón).
2. **`app/src/db/repos/umbralRepo.test.ts`** (si task_16 lo dejó como archivo separado): `getRtd`
   devuelve la fila específica de `(empresa, medida)` si existe, y cae a `(empresa, '*')` si no.
3. **`app/src/sync/pushInspeccion.test.ts`**: mockear `supabase.rpc` (o `supabaseClient`) y
   verificar que el payload que arma `pushInspeccionToSupabase` incluye los campos de snapshot
   correctos (`rtd_for_change`/`rtd_next_change`/`rtd_normal` desde la fila, no desde constantes).
   Camino feliz (`ok:true`) y camino de error de red (`ok:false`, sin lanzar).
4. **`app/src/sync/drainQueue.test.ts`**: con `sync_queue` sembrada con 2 filas pendientes, mockear
   `pushInspeccionToSupabase` para que una tenga éxito y otra falle; verificar que la exitosa queda
   `enviado=1`, la fallida incrementa `intentos`/`ultimo_error`/`next_retry_at`, y que un fallo no
   impide procesar la otra fila.
5. **`vite.config.ts`**: agregar `build.rollupOptions.output.manualChunks` separando al menos un
   chunk `vendor` (react, react-dom) y un chunk `supabase` (`@supabase/supabase-js`) del código de
   la app. No tocar el `base` ni el plugin `react()` existentes.

## Criterios de aceptación

- `npm test` corre los 4 archivos nuevos en verde, sin afectar los tests existentes de
  `calculations.test.ts`.
- `npm run build` ya no muestra el warning de chunk grande (o el chunk principal baja
  significativamente de tamaño) — pegar el resumen de `build` en `STATE.md`.
- `npm run lint` verde.

## Cómo verificar

Este task es mayormente lógica pura + build config — **no requiere smoke test en navegador
obligatorio** (regla de excepción de CLAUDE.md: "no aplica a tasks de lógica pura cubiertos por
unit tests"). Igual, correr `npm run dev` una vez y confirmar que la app carga sin error tras el
cambio de `manualChunks` (un split mal armado puede romper el orden de carga de chunks). Anotar en
`STATE.md` el resultado de `npm test`, `npm run build` (tamaño de chunks antes/después) y la
confirmación de que `npm run dev` sigue cargando sin errores de consola.

## Fuera de alcance

- Tests e2e o de dispositivo (Capacitor/Android).
- Cualquier cambio funcional a `inspeccionRepo`, `pushInspeccion` o `drainQueue` — este task solo
  agrega tests y config de build, no lógica nueva.
