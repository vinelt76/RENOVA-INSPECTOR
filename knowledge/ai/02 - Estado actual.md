---
title: "Estado actual verificado"
updated: 2026-07-19
status: vigente
sources: [git, app/src, WEB, supabase/migrations, supabase/diagnostics/baseline_profile.sql, tasks_puesta_en_marcha_movimientos/STATE.md, tasks_pantalla_inventario/STATE.md]
---

# Estado actual verificado

## Snapshot

| Subsistema | Estado al 2026-07-12 |
|---|---|
| App de inspección | Funcional, Android/Capacitor presente, tres rutas activas: empresa, unidad, inspección |
| App de movimientos | Android/Capacitor en `app movimientos/`: login de operario, empresa derivada del perfil, órdenes, captura salida/ingreso y borrador local |
| Persistencia local | SQLite versionado hasta v4, seed idempotente y repositorios |
| Cálculos | Motor TS con golden reference Python; RTD/IDI/presión FRÍO/VUR/tasa/ISA |
| Sync | Cola durable, upsert idempotente, backoff, guard contra carreras y cierre seguro del día |
| Supabase | Esquema, RLS, vistas, RPCs, Realtime y datos demo/operativos; procedencia y primer montaje de línea base aplicados |
| Web | Siete HTML en `WEB/`; Movimientos en la vista por unidad ya emite y sigue órdenes de operario |
| Taller | Operaciones de taller por lote y primer montaje guiado desde evidencia de inspección |
| Órdenes operativas | Roles `tire_supervisor`/`operator`, RPCs emitir→tomar→completar y hechos pendientes de reconciliación aplicados el 2026-07-19 |
| Rutas | Asignaciones temporales y atribución de instalaciones agregadas el 2026-07-12 |
| Tests app | 44 casos registrados en la última bitácora verificada; volver a ejecutar antes de confiar |
| CI/CD | GitHub Actions genera APK debug y publica app + `WEB/` en GitHub Pages |

## Qué quedó obsoleto en documentos viejos

- Flutter/FastAPI/Railway/PostgreSQL propio fue el stack inicial y está descartado.
- Las tablas de Lote 2/5 que dicen `PENDIENTE` no reflejan necesariamente el código actual.
- Task 14 de Supabase está materialmente implementada, aunque su fila histórica no se cerró.
- Task 18 pedía tests que ya existen parcialmente; `manualChunks` sigue ausente en `vite.config.ts`.
- La nota humana anterior decía que sync/umbrales seguían pendientes; eso ya no es correcto.
- La pantalla histórica de Inventario y Comparativo se retiró; el 15 de julio Inventario volvió
  como una superficie nueva y acotada de solo lectura. Sus acciones exclusivas siguen retiradas.

## Evidencia reciente

- `20260711000000` y `20260711010000`: metadata real de unidad y umbrales RTD.
- SQLite v4 + `syncQueueRepo`/`drainQueue`: cola durable y reintentos.
- 40 tests tras fixes de pérdida y 44 tras resolver la carrera del primer umbral.
- `20260712000000`: operaciones transaccionales de taller.
- `20260712010000`: rutas y asignaciones temporales.
- `20260716100000` / `20260716110000`: `record_origin`, evidencia de línea base,
  `confirm_baseline_mount` y el gate que impide montar inventario sobre evidencia pendiente.
- `20260720012248`: órdenes de movimientos para supervisor/operario; validación transaccional
  remota de emisión, toma y captura completa sin dejar datos ficticios.
- `WEB/movimientos`: la pestaña del supervisor dejó la ejecución directa; ahora emite únicamente
  `create_tire_movement_order` y sigue toma, finalización y captura técnica por Realtime.
- Commit `175e9ed`: retira `inventario.html`, `comparativo.html`, `reinstall_tire`, `retread_casing`, `v_removal_cause_ranking` y `v_comparison_cycle_rows`.

## Línea base de Movimientos

La flota **no** quedó sembrada de forma masiva. Una posición vacía con una medición reciente es
`baseline_pending`: la inspección es evidencia de un neumático, pero todavía no es una instalación
de taller. Al operar, una persona confirma el primer montaje; entonces queda el rastro
`origin='baseline'` y `source_measurement_id`. La fecha de instalación se declara en ese momento,
no se infiere desde la inspección.

El avance es gradual y se mide con Q6 de `supabase/diagnostics/baseline_profile.sql`; el conteo
actual de referencia es 2 094 posiciones pendientes. Las posiciones sin evidencia siguen siendo
vacías y aceptan el flujo normal de montaje.

## Interpretación prudente

`Implementado` significa que hay código/migración. `Verificado` exige prueba repetible. Las suites
SQL y las pruebas unitarias cubren los contratos de taller; el smoke autenticado de primer montaje
debe usar una unidad y un usuario de prueba acordados, nunca una unidad de cliente al azar.

Ver [[10 - Roadmap deuda y riesgos]] para pendientes vigentes.
