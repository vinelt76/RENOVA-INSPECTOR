# RUN 6 — Resumen de implementación del sync (Fase 8/11)

## Qué se tocó (mínimo y reversible)

### Supabase (proyecto `fbxupwwgiebhlciqftpw`) — solo objetos NUEVOS
- Vista `v_rendimiento_dashboard_rows` (solo lectura, aditiva).
- RPC `save_inspection(payload jsonb)` (+ fix de `id` sin default en
  `inspection_measurements`). Grant execute a anon/authenticated.
- Copia en repo: `supabase/migrations/20260707120000_run6_rendimiento_source_view_and_save_inspection.sql`.
- **Cero cambios en tablas/vistas existentes. Cero datos derivados persistidos.**

### App (`app/src/sync/`) — 2 archivos
- `pushInspeccion.ts`: se agregó `local_id` (UUID del dispositivo → idempotencia)
  y `company_name` al payload. Nada más cambió: el guardado local (SQLite) sigue
  ocurriendo ANTES y es la fuente de verdad; el push nunca lanza excepción.
- `readInspecciones.ts`: corregido para leer `v_inspection_dashboard_rows`
  (apuntaba a tablas inexistentes). Hoy nadie lo consume en la UI.
- `app/.env.local` (gitignoreado) con URL + anon key para la demo.

### Dashboards HTML — patrón Supabase-first con fallback mock
- Nuevos: `supabase-config.example.js` (committeado, vacío),
  `supabase-config.local.js` (gitignoreado, credenciales reales locales),
  `supabase-demo.js` (adaptador de lectura, sin secretos),
  `inspecciones-demo.html` (nueva pantalla).
- Modificados: `rendimiento.html` (loader + panel de datos fuente),
  `vista-flota.html` (loader). El mock y TODAS las fórmulas del HTML quedaron
  intactos; los listeners de selects se registran una sola vez.

## Decisiones

- **Cola de sync completa: NO antes del jueves** (riesgo). Se usó el mecanismo ya
  existente (push automático con debounce al completar la inspección + reintento
  mientras la pantalla está abierta + indicador de estado). La cola persistente
  (pending/synced/failed con drenado al recuperar red) queda documentada como
  pendiente en `run6_known_limits.md`.
- **Estado RTD se recalcula server-side** con umbrales de `rtd_thresholds` —
  el snapshot del cliente viaja pero no manda.
- **`security definer`** en el RPC con `search_path` fijado: preparado para
  cuando se active RLS (el RPC seguirá siendo el único camino de escritura de la app).

## Cómo revertir

- Supabase: `drop view v_rendimiento_dashboard_rows; drop function save_inspection(jsonb);`
- HTML: quitar los 2 `<script>` del head y los bloques marcados "Supabase"/"RUN6".
- App: revertir los 2 archivos de `src/sync/`.
