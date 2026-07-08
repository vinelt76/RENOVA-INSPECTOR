# RUN 6 — Checklist de verificación

| # | Check | Estado |
|---|---|---|
| 1 | Supabase → HTML funciona con datos reales (3 dashboards, badge SUPABASE·CIVA) | ✅ |
| 2 | Datos fuente de INSTALACIÓN visibles en rendimiento (panel plegable) | ✅ |
| 3 | Datos fuente de INSPECCIÓN visibles en rendimiento (RTD A–D, fecha, km, presión…) | ✅ |
| 4 | Guardado local de inspección sigue funcionando (SQLite intacto; build+23 tests ✓) | ✅ |
| 5 | Sync a Supabase funciona (RPC probado con payload real de la app, clave anon) | ✅ |
| 6 | Fallo de sync NO crashea la app (`pushInspeccionToSupabase` nunca lanza; UI "⚠ ERROR") | ✅ |
| 7 | Código N/V sincroniza como `tire_code NULL` (nunca se almacena "N/V") | ✅ |
| 8 | Código duplicado/ambiguo no se fusiona en silencio (resolución por posición; `code_status pending_review` visible) | ✅ |
| 9 | `v_inspection_dashboard_rows` refleja la inspección sincronizada | ✅ |
| 10 | inspecciones-demo.html muestra la inspección nueva (verificado con TEST-E2E antes de limpiar) | ✅ |
| 11 | rendimiento.html sigue funcionando (smoke test, 0 errores de consola) | ✅ |
| 12 | service_role NO usada en ningún punto | ✅ |
| 13 | Credenciales reales NO commiteadas (`supabase-config.local.js` y `app/.env.local` gitignoreados) | ✅ |
| 14 | Fallback mock funciona (red a Supabase bloqueada → badge MOCK, sin pantalla en blanco) | ✅ |
| 15 | Datos de prueba limpiados (estado final: 10 inspecciones / 28 mediciones, igual que el seed) | ✅ |
| 16 | Ensayo con teléfono/APK real end-to-end | ⬜ pendiente antes del jueves |
