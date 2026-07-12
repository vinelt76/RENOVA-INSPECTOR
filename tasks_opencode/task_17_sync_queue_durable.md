# task_17 — Cola de sync durable + drainer en background

> Depende de **task_16 aprobado**: el drainer serializa el payload desde el snapshot de umbrales
> ya congelado por task_16 (nunca recalcula contra la tabla `umbral_rtd` vigente, que puede haber
> cambiado). Si task_16 no está aprobado, este task queda bloqueado.

## Objetivo

Hoy el push a Supabase es **manual y sincrónico**: el inspector aprieta un botón
(`InspeccionScreen.tsx:243` vía `pushInspeccionToSupabase`, o el re-push de cierre de día en
`UnidadScreen.tsx:262` vía `terminarInspeccionesDelDia`). Si falla (sin señal, error de red), la
inspección queda local y **depende de que alguien se acuerde de reintentar**. La tabla
`sync_queue` existe (`app/src/db/sqlite.ts:196-203`) pero es un stub: nada la lee ni la escribe.

Este task construye la cola real: encolar en cada guardado, drenar sola en background con
reintentos, sin depender de que el inspector recuerde nada.

## Contexto / archivos

- `app/src/db/sqlite.ts` — tabla `sync_queue` ya existe. **Verificado:** el
  `DROP TABLE IF EXISTS sync_queue` (línea 84) está dentro del bloque `if (currentVersion < 1)`,
  o sea que solo corre en instalación fresca — la tabla ya sobrevive reinicios normales. Al
  ampliarla, hacerlo en un bloque de migración **nuevo y posterior** al de task_16 (verificar el
  número de versión vigente después de ese task); **nunca** reintroducir un `DROP` fuera del
  bloque de instalación fresca — eso borraría trabajo de campo pendiente.
- `app/src/db/repos/inspeccionRepo.ts` — `crearCabecera`, `actualizarCabecera`, `upsertNeumatico`:
  puntos donde encolar.
- `app/src/sync/pushInspeccion.ts` — `pushInspeccionToSupabase(cabeceraId)`, ya idempotente
  (upsert por `local_id` en `save_inspection`). Se reusa como unidad de envío del drainer, sin
  cambiar su firma ni su payload (congelado por task_16).
- `app/src/sync/terminarInspeccion.ts` — flujo de cierre de día; pasa a apoyarse en el drainer en
  vez de reintentar manualmente en el momento.
- `app/src/screens/InspeccionScreen.tsx:243`, `app/src/screens/UnidadScreen.tsx:262` — disparadores
  actuales del push manual.
- `tasks_opencode/task_14_supabase_sync_fase1.md` — spec original que ya preveía esto (fase 1);
  este task lo concreta.

## Pasos

1. **Ampliar `sync_queue`** (migración local nueva, versionada): agregar columnas `intentos
   INTEGER NOT NULL DEFAULT 0`, `ultimo_error TEXT`, `next_retry_at TEXT`. Mantener las columnas
   existentes (`tabla`, `registro_id`, `op`, `created_at`, `enviado`).
2. **Encolar**: en `inspeccionRepo`, tras cada `crearCabecera`/`actualizarCabecera`/
   `upsertNeumatico` exitoso, insertar (o actualizar si ya existe una fila pendiente para esa
   `cabecera_id`) una fila en `sync_queue` con `tabla='inspeccion_cabecera'`, `registro_id` = id de
   la cabecera, `op='upsert'`. **No** encolar por cada neumático individual — una fila por
   cabecera alcanza porque `pushInspeccionToSupabase` reenvía la cabecera completa con todas sus
   posiciones.
3. **Drainer** — nuevo módulo `app/src/sync/drainQueue.ts`:
   - `drainSyncQueue(): Promise<{enviadas: number, pendientes: number}>` — lee filas de
     `sync_queue` con `enviado=0` y `next_retry_at` vencido (o NULL), en orden `created_at`.
     Para cada una, llama `pushInspeccionToSupabase(registro_id)`. Si `ok`, marca
     `enviado=1`. Si falla, incrementa `intentos`, guarda `ultimo_error`, y calcula
     `next_retry_at` con backoff exponencial simple (p.ej. `min(2^intentos, 300)` segundos).
   - No lanza excepciones hacia afuera — cada fila se procesa de forma aislada (un fallo no
     bloquea al resto de la cola).
4. **Disparadores**: llamar `drainSyncQueue()` (a) al recuperar conectividad (listener del evento
   `online` del navegador/WebView), (b) al iniciar la app si `supabaseEnabled`, (c) inmediatamente
   después de cada encolado exitoso (best-effort, sin esperar su resultado para no bloquear la UI).
5. **Reemplazar los disparos manuales**: `InspeccionScreen.tsx:243` y el flujo de
   `terminarInspeccion.ts` dejan de llamar `pushInspeccionToSupabase` directo y en su lugar
   confían en que el guardado ya encoló y el drainer lo procesa. `terminarInspeccionesDelDia`
   pasa a: forzar un `drainSyncQueue()` inmediato, esperar su resultado, y solo borrar
   localmente (`inspeccionRepo.borrarCabecera`) las cabeceras cuya fila en `sync_queue` quedó
   `enviado=1` — mantiene la garantía actual de "solo borro lo confirmado en la nube".
6. **Mantener el path directo operativo**: `pushInspeccionToSupabase` no cambia; sigue siendo
   perfectamente llamable a mano si hiciera falta depurar. No se elimina, solo deja de ser el único
   camino.
7. Actualizar `tasks_opencode/task_14_supabase_sync_fase1.md` (marcar qué quedó cubierto por este
   task) y `decisions/0003-jwt-offline.md` si corresponde documentar la estrategia de reintentos.

## Criterios de aceptación

- Guardar una inspección con la red cortada (DevTools → Network offline) deja una fila en
  `sync_queue` con `enviado=0`.
- Al restaurar la red, sin ninguna acción del usuario, la fila pasa a `enviado=1` y la inspección
  aparece en el dashboard de Supabase.
- Forzar un error (p.ej. apagar Supabase temporalmente o cortar red a mitad del intento) hace que
  `intentos` suba y `next_retry_at` se posponga — sin loop de reintento inmediato ni bloqueo de la
  UI.
- Recargar la app (o "matarla") con una fila pendiente en la cola: al reabrir, la cola sigue ahí y
  se drena sola.
- El botón de "terminar inspecciones del día" sigue sin borrar localmente ninguna cabecera que no
  esté confirmada en la nube.
- `npm run build`, `npm test` (casos nuevos: encolado en upsert, drenado exitoso, drenado con
  fallo y backoff), `npm run lint` verdes.

## Cómo verificar

Smoke test en navegador OBLIGATORIO: `npm run dev` con `.env` de Supabase configurado. (1) Con
DevTools → Network → Offline, capturar una inspección completa; confirmar la fila en `sync_queue`
vía consola (`SELECT * FROM sync_queue`). (2) Restaurar red; confirmar que se drena sola (sin
recargar) y que la fila aparece en el dashboard de Supabase. (3) Recargar la página con una
cabecera aún pendiente (repetir offline sin restaurar) y confirmar que sobrevive al reload. (4)
Cero errores de consola en todo el recorrido. Anotar los 3 pasos y su resultado en `STATE.md`.

## Fuera de alcance

- Pull/LWW bidireccional complejo (traer inspecciones de otros dispositivos) — fase 2, sigue
  fuera de alcance como ya indicaba `task_14`.
- Cambiar la forma del payload de `save_inspection` — está congelada por task_16.
- UI de estado de sync más allá de lo mínimo ya existente (contador de pendientes); no se pide una
  pantalla nueva.
- task_18 (tests de repo/sync más amplios, bundle) — este task solo agrega los tests puntuales de
  su propio criterio de aceptación.
