# RUN 6 — Flujo de datos app → dashboards

## Datos históricos (Excel/PDF/CIVA)

```
Excel real (docs/, PDF RENDIMIENTO MOVIL BUS)
  └─ seed run2 (ya aplicado) ─▶ Supabase: companies, units, tire_casings,
                                 tire_life_cycles, tire_installations,
                                 inspections, inspection_measurements
        └─ vistas derivadas (nunca persisten cálculos):
             v_installation_km ─▶ v_tire_performance ─▶ v_rendimiento_dashboard_rows (run6)
             inspections+measurements ─▶ v_inspection_dashboard_rows
        └─ dashboards HTML (clave anon, GET REST):
             rendimiento.html        ◀─ v_rendimiento_dashboard_rows
             inspecciones-demo.html  ◀─ v_inspection_dashboard_rows
             vista-flota.html        ◀─ v_inspection_dashboard_rows (reagrupada)
             (fallback: mock embebido + badge "DEMO LOCAL")
```

## Inspección nueva capturada en la app

```
Inspector en la app (offline-first)
  1. EmpresaScreen → UnidadScreen → InspeccionScreen
  2. Autosave SQLite local (inspeccion_cabecera UUID v4 + inspeccion_neumatico)   ← SIEMPRE
  3. Al completar todas las posiciones (y solo si hay .env):
       pushInspeccionToSupabase(cabeceraId)
         └─ RPC save_inspection(payload)  [clave anon]
              ├─ resuelve company/unit/position/instalación activa → IDs
              ├─ N/V → tire_code NULL · estado RTD recalculado con rtd_thresholds
              ├─ upsert inspections (id = UUID del dispositivo)
              └─ upsert inspection_measurements (una por posición)
  4. v_inspection_dashboard_rows la refleja al instante
       ├─ inspecciones-demo.html: aparece primera (orden por fecha desc)
       ├─ vista-flota.html: nueva fecha en el selector con esa unidad
       └─ rendimiento.html: si la unidad+posición tiene instalación activa,
          la "última inspección" del panel de datos fuente y el RTD actual
          de v_tire_performance se actualizan (km/mm, % consumo, proyectado)
  5. Si el push falla: la app NO crashea, muestra "⚠ ERROR DE ENVÍO",
     lo local queda intacto; reintenta si el inspector sigue editando.
```

## Qué NO fluye todavía

fotos, inspector (auth), retén/descarte/reinstalación, pull de catálogo
servidor→app, cola de sync persistente. Ver `run6_known_limits.md`.
