# RUN 6 — Auditoría del flujo de inspección de la app (Fase 5)

## Flujo (React + Vite + Capacitor, SQLite offline-first)

```
EmpresaScreen → UnidadScreen (unidad + odómetro + foto) → InspeccionScreen (por posición)
```

| Qué | Dónde |
|---|---|
| Creación de cabecera | `inspeccionRepo.createCabecera()` — **UUID v4 generado en el dispositivo**, `fecha` = `localDate()` (YYYY-MM-DD), `km_odometro`, `sincronizado=0` |
| Guardado local | SQLite (`inspeccion_cabecera`, `inspeccion_neumatico`) con autosave por campo (tick "GUARDADO") — **la fuente de verdad local no cambió** |
| Modelo de medición | `InspeccionNeumatico`: posicion, codigo, marca, modelo, condicion, reencauche, medida, r1–r4, presion, tapa_valvula, anomalia, rtd_movi, idi, estado_rtd, desecho |
| Cálculos | `core/calculations.ts` (paridad con `reference/calculations.py`); estados con los mismos literales que los enums de Postgres ('Normal', 'Próximo a Reencauche', 'Para Reencauche') |
| Disparo del sync | `InspeccionScreen` useEffect: cuando TODAS las posiciones están completas → debounce 1.2 s → `pushInspeccionToSupabase(cabeceraId)`; reintenta solo si el inspector corrige algo; UI: "ENVIANDO… / ☁ SINCRONIZADO / ⚠ ERROR DE ENVÍO" |
| Sin Supabase configurado | `supabaseEnabled=false` → no se intenta nada, la app es 100% local (sin cambios de comportamiento) |
| Cola de sync | **NO existe** `sync_queue` todavía. Existe el flag `sincronizado` en la cabecera local pero **no se actualiza** tras un push exitoso. El reintento solo ocurre mientras la pantalla está abierta |

## Qué estaba roto (y run6 arregló)

1. `pushInspeccion.ts` llamaba al RPC **`save_inspection` que no existía** en el
   proyecto demo (era el contrato del borrador `minimal_inspections_schema`,
   nunca aplicado). Todo push devolvía error silencioso. → run6 creó el RPC en el
   proyecto real con el MISMO contrato de payload.
2. `readInspecciones.ts` consultaba `plate_number` / `inspection_items`
   (inexistentes). → reescrito contra `v_inspection_dashboard_rows`.
3. El payload no llevaba id local ni empresa → agregados `local_id` (UUID del
   dispositivo, garantiza idempotencia) y `company_name`.

## Campos disponibles vs esquema Supabase

Todos los campos medidos por la app tienen columna destino (ver
`run6_app_to_supabase_field_mapping.md`). Faltantes en la app (quedan NULL en
Supabase, no se inventan): inspector (sin auth todavía), foto de anomalía por
posición (solo hay foto a nivel unidad, y no se sube), modo temperatura de presión.
