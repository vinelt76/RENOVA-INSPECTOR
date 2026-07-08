# RUN 6 — Datos fuente visibles en Rendimiento (Fase 3)

Objetivo cumplido: rendimiento ya no muestra solo métricas finales — cada
neumático tiene un panel plegable **"Datos fuente · instalación e inspección"**.

## Vista nueva (aditiva, solo lectura): `v_rendimiento_dashboard_rows`

`v_tire_performance` (métricas derivadas, validadas contra el Excel) **+**:

| Grupo | Columnas agregadas | Origen (join, sin duplicar datos) |
|---|---|---|
| Contexto | `company_name`, `code_status`, `side`, `axle_number`, `axle_type` | companies, tire_casings, tire_positions, axles |
| Umbral | `rtd_removal_mm` | rtd_thresholds (por empresa/medida — nunca hardcodeado) |
| Última inspección | `last_inspection_id`, `last_inspection_odometer_km`, `rtd_a_mm..rtd_d_mm`, `last_rtd_movi_mm`, `last_rtd_state`, `pressure_psi`, `pressure_state`, `valve_cap`, `anomaly`, `inspector_name` | lateral sobre inspection_measurements + inspections + profiles |

Migración en repo: `supabase/migrations/20260707120000_run6_rendimiento_source_view_and_save_inspection.sql`.
No se creó ninguna tabla; ningún dato derivado se persiste.

## Qué muestra el panel por neumático

**Instalación (fuente):** código casco (o "N/V (no visible)" / "En revisión" según
`code_status`), ciclo de vida (N/R1/R2/R3), diseño actual, marca, medida, fecha
instalación, km instalación, RTD instalación, OTD, costo.

**Última inspección (fuente):** fecha, km inspección, RTD A/B/C/D, RTD MOVI (mín.),
estado RTD, presión, estado presión, tapa válvula, anomalía, inspector.

**Derivados (ya visibles en la card):** km acumulado, km recorrido, km proyectado,
RTD gastado, km/mm, % de consumo, costo/km — siguen calculándose en
`computeTire()` a partir de los datos fuente (paridad verificada con la vista SQL).

## Reglas respetadas

- Campo sin valor → **"sin dato"** (nunca se inventa; presión/válvula/inspector
  del seed CIVA aparecen así porque el Excel real no los trae).
- **Posiciones 1 y 2 están intencionalmente fuera del alcance del rendimiento
  actual** (el Excel real no las evalúa). La vista solo devuelve instalaciones
  activas con datos → el eje Dirección no aparece para unidades CIVA. No se
  crean filas falsas ni se bloquea nada por su ausencia.
- Con datos mock (fallback), el panel muestra los campos fuente que el mock
  modela y "sin dato" en el resto (el mock no tiene fechas/presión).
