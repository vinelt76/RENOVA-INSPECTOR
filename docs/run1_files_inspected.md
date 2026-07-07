# Run 1 — Archivos inspeccionados

Fecha: 2026-07-06 · Alcance: mapeo de datos y fórmulas para el borrador de esquema Supabase.

## Captura de inspección (app real — React + Capacitor + SQLite)

| Archivo | Rol |
|---|---|
| `app/src/screens/EmpresaScreen.tsx` | Selección de empresa (inicio del flujo). |
| `app/src/screens/UnidadScreen.tsx` | Búsqueda/alta de unidad, odómetro, configuración, foto de unidad; crea/reabre la cabecera de inspección. |
| `app/src/screens/InspeccionScreen.tsx` | Pantalla de inspección por posición: navegación P1..Pn, autosave, auto-avance. |
| `app/src/screens/FormBody.tsx` | Formulario de captura por neumático: código, marca, modelo, medida, condición, reencauche, R1–R4, presión, tapa de válvula, anomalía. |
| `app/src/components/AutocompleteField.tsx` | Campo autocompletado contra catálogo (permite altas de campo). |
| `app/src/state/AppContext.tsx`, `context.ts`, `useApp.ts` | Estado de sesión de flujo (empresa/unidad/cabecera activa). |

## Persistencia local (SQLite offline-first)

| Archivo | Rol |
|---|---|
| `app/src/db/sqlite.ts` | DDL SQLite v1/v2 (todas las tablas locales), migraciones, UUID v4 de dispositivo. |
| `app/src/db/schema.ts` | Interfaces TS de todas las tablas locales. |
| `app/src/db/repos/inspeccionRepo.ts` | Escritura de cabecera + upsert de neumático; calcula RTD MOVI/IDI/ESTADO RTD/DESECHO al guardar. |
| `app/src/db/repos/unidadRepo.ts` | Búsqueda/upsert de unidades, última cabecera. |
| `app/src/db/repos/empresaRepo.ts` | Lectura de empresas. |
| `app/src/db/repos/catalogoRepo.ts` | Lectura/altas de catálogo (marcas, modelos, medidas, anomalías, válvulas, configuraciones, condiciones, reencauches). |
| `app/src/db/seed.ts`, `seed_rows.ts`, `seed_data/catalogo_patron.json`, `seed_data/catalogo_flota.json` | Semilla local: 5 empresas demo + catálogo PATRON. |

## Motor de cálculo (paridad)

| Archivo | Rol |
|---|---|
| `app/src/core/calculations.ts` | RTD MOVI, IDI, ESTADO RTD, ESTADO PRESIÓN, VUR, tasa de desgaste, peso ISA (TS). |
| `app/src/core/calculations.test.ts` | Tests del motor TS. |
| `reference/calculations.py` + `reference/test_calculations_golden.py` | Referencia Python + golden tests (fuente de paridad). |

## Dashboards / rendimiento (HTML autocontenidos con mock + fórmulas)

| Archivo | Rol |
|---|---|
| `rendimiento.html` | Rendimiento por neumático **y por eje** (jefe de flota). Fórmulas: RTD Gastado, % Consumo, Km Recorrido, Km/mm, Km Proyectado, Costo/Km, Km Acumulado, promedios y diferencia % por eje, umbral de balance 15%. |
| `rendimiento-por-neumatico.html` | Variante solo "por neumático" con las mismas fórmulas base documentadas en cabecera. |
| `vista-flota.html` | Dashboard de flota por fecha de inspección: semáforo por neumático/unidad (peor caso), KPIs de flota, % en riesgo. ⚠ Umbrales 4/8 mm hardcodeados en el mock. |
| `UI/renova_dashboard_taller_v1.html` | Panel de taller (mock "lee de Supabase"): RTD MOVI por canales, estados RTD/presión, anomalías con foto, acciones Enviar a Retén / **Descartar** (causa + foto obligatorias). |

## Prototipos UI de referencia (no contienen fórmulas nuevas)

| Archivo | Rol |
|---|---|
| `UI/renova_home_v2.jsx`, `renova_grilla_v1.jsx`, `renova_inspeccion_v4.jsx`, `renova_unidad_v4.tsx` | Prototipos visuales originales de las pantallas de la app. |

## Especificaciones y gobernanza

| Archivo | Rol |
|---|---|
| `specs/reglas_negocio.md` | Fuente de verdad de fórmulas y umbrales (§1–§11). |
| `specs/flujo_inspeccion.md` | Flujo UX del inspector; campos aún no implementados (temperatura, sin medir, anomalía aro, foto de desecho). |
| `specs/catalogo_patron.md`, `reference/catalogo_patron.json` | Catálogo PATRON real. |
| `implementation_plan.md` | Modelo de datos original (stack reemplazado, modelo vigente): umbral_rtd, umbral_presion, usuario, vehiculo.estado. |
| `tasks_opencode/task_14_supabase_sync_fase1.md` | Decisiones de sync fase 1: LWW por updated_at, app_user, RLS por empresa, pull aditivo de catálogo. |
| `decisions/0001-tenancy.md` … `0004-catalog-sync.md` | ADRs de tenancy, paridad de cálculo, JWT offline, catálogo. |
| `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md` | Constitución, sistema visual, producto. |

## Cobertura de las categorías pedidas

- **Captura de inspección** → app/src/screens + repos.
- **Pestaña/tab de inspección** → `InspeccionScreen.tsx` + `FormBody.tsx` (y mock de lectura `UI/renova_dashboard_taller_v1.html`).
- **Rendimiento** → `rendimiento.html`, `rendimiento-por-neumatico.html`.
- **Neumático** → no existe entidad "neumático físico" en la app hoy; vive como campos de texto en `inspeccion_neumatico` + mocks (`TIRES`/`POSICIONES`). Brecha cubierta por la tabla `tires` propuesta.
- **Unidad** → `UnidadScreen.tsx`, `unidadRepo.ts`, mocks `UNITS`.
- **Instalación** → NO hay pantalla ni tabla hoy; solo datos fuente mock (`rtdInstalacion`, `kmInstalacion`) en los HTML. Brecha cubierta por `tire_installations`.
- **Retiro** → NO implementado; el modal "Descartar" del panel de taller es la única superficie (mock). Brecha cubierta por `tire_removals`.
- **Inventario** → NO implementado; "Enviar a Retén" del panel de taller es mock. Brecha cubierta por `tires.status` + `tire_inventory_movements`.
- **Descartado** → campo `desecho` en `inspeccion_neumatico` (real) + modal de descarte (mock).
- **Cálculo de dashboard** → funciones JS embebidas en los 4 HTML (ver `run1_formula_inventory.md`).
