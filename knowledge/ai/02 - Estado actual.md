---
title: "Estado actual verificado"
updated: 2026-07-12
status: vigente
sources: [git, app/src, WEB, supabase/migrations, tasks_opencode/STATE.md]
---

# Estado actual verificado

## Snapshot

| Subsistema | Estado al 2026-07-12 |
|---|---|
| App de inspección | Funcional, Android/Capacitor presente, tres rutas activas: empresa, unidad, inspección |
| Persistencia local | SQLite versionado hasta v4, seed idempotente y repositorios |
| Cálculos | Motor TS con golden reference Python; RTD/IDI/presión FRÍO/VUR/tasa/ISA |
| Sync | Cola durable, upsert idempotente, backoff, guard contra carreras y cierre seguro del día |
| Supabase | Esquema, RLS, vistas, RPCs, Realtime y datos demo/operativos |
| Dashboards | Ocho HTML en `WEB/`, conectados a Supabase según su superficie |
| Taller | RPCs transaccionales y UI para instalar, retirar, transferir, reinstalar y reencauchar |
| Rutas/comparación | Migraciones y vistas agregadas el 2026-07-12 |
| Tests app | 44 casos registrados en la última bitácora verificada; volver a ejecutar antes de confiar |
| CI/CD | GitHub Actions genera APK debug y publica app + `WEB/` en GitHub Pages |

## Qué quedó obsoleto en documentos viejos

- Flutter/FastAPI/Railway/PostgreSQL propio fue el stack inicial y está descartado.
- Las tablas de Lote 2/5 que dicen `PENDIENTE` no reflejan necesariamente el código actual.
- Task 14 de Supabase está materialmente implementada, aunque su fila histórica no se cerró.
- Task 18 pedía tests que ya existen parcialmente; `manualChunks` sigue ausente en `vite.config.ts`.
- La nota humana anterior decía que sync/umbrales seguían pendientes; eso ya no es correcto.

## Evidencia reciente

- `20260711000000` y `20260711010000`: metadata real de unidad y umbrales RTD.
- SQLite v4 + `syncQueueRepo`/`drainQueue`: cola durable y reintentos.
- 40 tests tras fixes de pérdida y 44 tras resolver la carrera del primer umbral.
- `20260712000000`: operaciones transaccionales de taller.
- `20260712010000`: rutas y asignaciones temporales.
- `20260712020000`: vista de comparación por ciclo.

## Interpretación prudente

`Implementado` significa que hay código/migración. `Verificado` exige prueba repetible. Las migraciones del 12 de julio están en el repo y sus HTML las llaman, pero esta auditoría documental no ejecutó pruebas E2E contra la base remota; tratarlas como funcionalidad a validar antes de demo/producción.

Ver [[10 - Roadmap deuda y riesgos]] para pendientes vigentes.

