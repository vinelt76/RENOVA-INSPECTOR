# task_14 — Supabase fase 1: proyecto + esquema espejo + auth + sync básico

> ⚠ **Gate de decisiones:** este task ejecuta la parte YA decidible del sync. Las decisiones
> abiertas de `decisions/0003-jwt-offline.md` y `0004-catalog-sync.md` se cierran con los
> defaults definidos abajo (validados por Facundo al aprobar este spec). Si durante la
> implementación aparece una ambigüedad no cubierta → preguntar en `STATE.md`, no improvisar.

## Objetivo

Conectar la app (hoy 100% local) a un backend **Supabase**, sin romper offline-first:

1. Proyecto Supabase con esquema Postgres espejo del SQLite local.
2. Auth por email/contraseña con sesión persistida para trabajo offline prolongado.
3. **Push** de inspecciones locales al servidor vía la tabla `sync_queue` existente.
4. **Pull** de catálogo (solo lectura) desde el servidor.

La app debe seguir funcionando **idéntica sin conexión y sin sesión** — el sync es una capa
que drena la cola cuando hay red, jamás un requisito para inspeccionar.

## Contexto / archivos

- `app/src/db/sqlite.ts` — ya crea `sync_queue` (stub previsto desde el Lote 1). Los IDs de
  `inspeccion_cabecera` / `inspeccion_neumatico` ya son UUID v4 de dispositivo y todas las
  tablas tienen `updated_at` — exactamente para esto.
- `app/src/db/repos/inspeccionRepo.ts` — cada `crearCabecera`/`upsertNeumatico` debe encolar
  en `sync_queue` (operación, tabla, id, payload JSON, timestamp).
- `app/src/db/seed.ts` + `catalogo_patron.json` — fuente actual del catálogo local.
- Nuevo: `app/src/sync/` (cliente Supabase, drainer de cola, pull de catálogo, estado de sesión).
- `specs/reglas_negocio.md` — el servidor NO calcula nada en esta fase; recibe los valores ya
  calculados en el dispositivo (paridad de cálculo se mantiene client-side).

## Decisiones cerradas para esta fase (defaults)

- **Multitenancy:** una fila `empresa_id` en cada tabla + RLS por empresa (ver
  `decisions/0001` de tenancy). Los usuarios de auth se asocian a UNA empresa vía tabla
  `app_user (user_id, empresa_id, rol)`.
- **Conflictos:** last-write-wins por `updated_at` (upsert on conflict id). Suficiente porque
  cada inspector trabaja sobre sus propias cabeceras UUID de dispositivo.
- **Sesión offline:** la sesión de Supabase se persiste (storage local) y la app NUNCA
  bloquea por token vencido — si el refresh falla sin red, se sigue trabajando local y se
  reintenta al volver la conexión.
- **Catálogo:** el servidor es fuente futura; en esta fase el pull solo **agrega** entradas
  nuevas (INSERT OR IGNORE por nombre), nunca borra ni pisa lo local. Versioning real queda
  para la fase 2 (`decisions/0004`).

## Pasos

1. **Supabase project** (Facundo crea el proyecto y pasa URL + anon key; van en `.env` local
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — NUNCA commitear keys; agregar `.env` a
   `.gitignore` y un `.env.example`).
2. **Esquema Postgres** en `supabase/migrations/` (SQL versionado en el repo): espejo de
   `empresa`, `unidad`, `inspeccion_cabecera`, `inspeccion_neumatico` y las tablas `cat_*`,
   con `empresa_id`, `updated_at timestamptz`, PKs UUID (texto) iguales a los locales. RLS:
   usuarios solo leen/escriben filas de su `empresa_id`; `cat_*` legible por todos los
   autenticados.
3. **Cliente**: `npm i @supabase/supabase-js`. `app/src/sync/client.ts` crea el cliente solo
   si hay env vars — sin ellas la app corre 100% local (feature flag implícito, los builds
   actuales no se rompen).
4. **Encolado**: en `inspeccionRepo`, tras cada escritura local exitosa, insertar en
   `sync_queue` (idempotente por `(tabla, registro_id, updated_at)`).
5. **Drainer**: `app/src/sync/drain.ts` — al ganar conectividad (evento `online` + al abrir la
   app con sesión), drena la cola en orden (cabeceras antes que neumáticos), upsert por id,
   borra de la cola solo tras confirmación. Reintentos con backoff; errores quedan en la cola.
6. **Pull de catálogo**: al login/arranque con red, traer `cat_*` y hacer INSERT OR IGNORE
   local. (Sembrar las tablas `cat_*` del servidor una vez desde `catalogo_patron.json` — script
   en `supabase/seed.sql`.)
7. **Auth UI mínima**: pantalla de login (email/contraseña, estilo DESIGN.md) que aparece SOLO
   si hay env vars de Supabase y no hay sesión guardada; botón "Trabajar sin conexión" que la
   salta. Estado de sync visible pero discreto (p.ej. contador de pendientes en el header).

## Criterios de aceptación

- Sin `.env`: la app se comporta EXACTAMENTE como hoy (build y flujo idénticos, sin login).
- Con `.env` + sesión: capturar una inspección offline (DevTools → Network offline), volver
  online → la cola se drena sola y las filas aparecen en Supabase (verificar en el dashboard).
- Matar la app con cola pendiente y reabrir → la cola sobrevive y se drena.
- Un usuario de la empresa A no puede leer inspecciones de la empresa B (probar RLS con dos
  usuarios de prueba).
- Token vencido sin red → la app sigue capturando local sin ningún bloqueo ni error visible.
- `npm run build`, `npm test`, `npm run lint` verdes. Tests nuevos para el encolado
  (escritura local → fila en `sync_queue`) y para el orden del drain.

## Cómo verificar

Smoke test OBLIGATORIO del camino local (sin `.env`) — idéntico a hoy, 0 errores de consola —
y del camino con Supabase (login, captura offline, drenado online, verificación en dashboard).
Anotar ambos recorridos en `STATE.md`.

## Fuera de alcance

- Reportes/agregaciones server-side, Excel por empresa (fase futura).
- Pull de inspecciones de otros dispositivos (bidireccional) — fase 2.
- Versioning/borrado de catálogo desde servidor (`decisions/0004`) — fase 2.
- Roles/permisos más allá de inspector-de-una-empresa.
- Ajuste de presión en CALIENTE (sigue ABIERTA — NO implementar).
