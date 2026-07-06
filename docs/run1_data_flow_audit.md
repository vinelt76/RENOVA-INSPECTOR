# Run 1 — Auditoría de flujo de datos y mapeo de campos

Objetivo: documentar cada campo capturado/mostrado hoy y su destino futuro en Supabase, para que
el flujo sea **teléfono/app → tablas Supabase → dashboards HTML** sin cambiar todavía ni la UI ni
las fórmulas locales.

## Flujo actual (as-is)

```
Inspector (teléfono)
  EmpresaScreen ──► empresa seleccionada (SQLite: empresa)
  UnidadScreen  ──► unidad + odómetro + foto (SQLite: unidad, inspeccion_cabecera)
  InspeccionScreen/FormBody ──► medición por posición (SQLite: inspeccion_neumatico)
        └─ al guardar, inspeccionRepo calcula: RTD MOVI, IDI, ESTADO RTD, DESECHO

Dashboards HTML (rendimiento.html / rendimiento-por-neumatico.html /
vista-flota.html / UI/renova_dashboard_taller_v1.html)
  ──► HOY leen DATASETS MOCK embebidos y calculan todo en JS del navegador.
      NO leen SQLite ni Supabase. Las fórmulas viven dentro del HTML.
```

## Flujo objetivo (to-be, sin conectar aún)

```
Teléfono (SQLite, offline-first)
   └─ sync_queue ──push──► Supabase: inspections + inspection_measurements
                             (+ units/tires/installations cuando existan)
Supabase
   └─ vistas v_tire_performance / v_axle_performance / v_fleet_status
Dashboards HTML
   └─ reemplazan el dataset mock por SELECT a las vistas (Run 2+);
      las fórmulas migran a SQL pero NO se borran del HTML todavía.
```

---

## Mapeo de campos capturados (app real)

Convenciones: **Origen** = pantalla/archivo donde el usuario lo ingresa; **Req** = obligatorio en el flujo actual;
**Destino** = tabla.columna futura en Supabase (ver `supabase/schema_draft.sql`).

### 1. Selección de empresa — `EmpresaScreen.tsx`

| Label UI | Variable/clave | Origen | Tipo | Req | Ejemplo | Se muestra en | Fórmulas que lo usan | Destino Supabase |
|---|---|---|---|---|---|---|---|---|
| Empresa | `empresaId` / `empresa.id` (`empresa.nombre`, `empresa.flota`) | `EmpresaScreen.tsx` → `AppContext` | string (slug local) | Sí | `movil` / "MÓVIL BUS" | Header de Unidad e Inspección; `vista-flota` (uc-meta) | Filtro de tenancy de TODO cálculo agregado (ISA, cumplimiento, distribución) | `companies.id` (+`legacy_code` para el slug), `companies.name`, `fleets.name` |

### 2. Unidad y cabecera — `UnidadScreen.tsx` → `unidadRepo` / `inspeccionRepo.crearCabecera`

| Label UI | Variable/clave | Origen | Tipo | Req | Ejemplo | Se muestra en | Fórmulas que lo usan | Destino Supabase |
|---|---|---|---|---|---|---|---|---|
| Nº de unidad (placa) | `unidad.numero` (`query`) | `UnidadScreen.tsx` | string alfanumérico | Sí | `AAV-803` | Header inspección; `vista-flota` (uc-plate); rendimiento (unit picker) | — (clave de agrupación) | `units.plate` |
| Tipo de vehículo | `unidad.tipo_vehiculo` | `UnidadScreen.tsx` (derivado de config) | string | Sí | `BUS` | `vista-flota` (equipmentType) | Determina configuración → nº posiciones | `units.vehicle_type` |
| Configuración | `unidad.configuracion` (`config`) | `UnidadScreen.tsx` (alta de unidad nueva) | string | Sí (alta) | `2-4-2` | Header rendimiento ("Bus 2-4-2"); grilla de posiciones | Define posiciones/ejes y canales RTD (3 vs 4) | `units.config_id` → `vehicle_configs.notation` |
| Odómetro | `km_odometro` (`odometro`) | `UnidadScreen.tsx` → `inspeccion_cabecera.km_odometro` | integer | Sí | `412380` | Panel taller ("ODÓMETRO"); no se muestra en Rendimiento (dato crudo) | **Km Actual** de: Km Recorrido, Km/mm, Costo/Km, Km Proyectado, Km Acumulado, Tasa de desgaste, VUR | `inspections.odometer_km` |
| Fecha de inspección | `fecha` (`localDate()`) | Automático al crear cabecera | string ISO date | Sí | `2026-07-06` | `vista-flota` (selector de fecha); panel taller (ÚLT. INSPECCIÓN) | Ordena inspecciones consecutivas (tasa de desgaste); agrupa KPIs por fecha | `inspections.inspected_on` |
| Foto de la unidad | `foto_unidad` (`fotoUnidad`) | `UnidadScreen.tsx` (Capacitor Camera / file input) | string dataURL | No | `data:image/jpeg;base64,…` | Preview en UnidadScreen | — | `inspections.unit_photo_url` (Storage; en fase 1 puede viajar base64 → migrar a Storage) |
| Odómetro último / última fecha (cache) | `unidad.odometro_ultimo`, `unidad.ultima_fecha` | Derivados al guardar | integer / date | Auto | `412380` / `2026-07-06` | "Inspeccionadas hoy" en UnidadScreen | Validación `kmActual ≥ kmPrev` | `units.last_odometer`, `units.last_inspected_at` (cache denormalizado) |
| ID cabecera | `inspeccion_cabecera.id` | `generateId()` (UUID v4 dispositivo) | uuid string | Sí | `9b2f…` | — | — | `inspections.id` (el servidor ACEPTA el id del cliente) |

### 3. Medición por posición — `FormBody.tsx` → `inspeccionRepo.upsertNeumatico`

| Label UI | Variable/clave | Origen | Tipo | Req | Ejemplo | Se muestra en | Fórmulas que lo usan | Destino Supabase |
|---|---|---|---|---|---|---|---|---|
| (Posición activa) | `posicion` (`pos`) | `InspeccionScreen.tsx` (navegación P1..Pn) | integer 1–8 | Sí | `3` | Pills/pos-dock de todos los dashboards | Agrupa por eje (balance); identifica neumático en posición | `inspection_measurements.position_number` |
| CÓDIGO | `codigo` | `FormBody.tsx` (acordeón) | string (o "No visible"/"Sin código") | No | `NEU-04182` | Panel taller (id-codigo); identidad del neumático | Une inspecciones consecutivas del MISMO neumático (tasa de desgaste §7) | `inspection_measurements.tire_code` → futuro `tires.code` |
| MARCA | `marca` | `FormBody.tsx` (autocomplete cat_marca) | string | No | `Michelin` | Card rendimiento (modelo completo) | — | `inspection_measurements.brand_name` → `tires.brand_id` |
| MODELO | `modelo` | `FormBody.tsx` (autocomplete cat_modelo) | string | No | `X Multi` | Card rendimiento (id-model) | — | `inspection_measurements.model_name` → `tires.model_id` |
| MEDIDA | `medida` | `FormBody.tsx` (autocomplete cat_medida) | string | No | `295/80R22.5` | Panel taller (id-medida) | Selecciona umbrales RTD/presión por empresa+medida; OTD por medida | `inspection_measurements.size_name` → `tires.size_id` |
| CONDICIÓN | `condicion` | `FormBody.tsx` (N/R1/R2…) | string código | No | `R1` | Card rendimiento (Reencauche R1); panel taller (reenc/MÁX) | Distingue nuevo vs reencauchado (OTD y costo distintos) | `inspection_measurements.condition` → `tires.condition` |
| DISEÑO DE REENCAUCHE | `reencauche` | `FormBody.tsx` (solo si condición ≠ N) | string | Cond. | `NZA2AW` | Card rendimiento ("Reencauche: NZA2AW (R1)") | — | `inspection_measurements.retread_design` → `tires.retread_design_id` |
| R1 (canal A) | `r1` | `FormBody.tsx` (REMANENTE mm) | number ≥0 (esperado 0–22) | Sí* | `7.2` | Panel taller (CANAL A); nunca en Rendimiento (crudo) | **RTD MOVI = MIN(canales)**, IDI = MAX−MIN | `inspection_measurements.rtd_a_mm` |
| R2 (canal B) | `r2` | ídem | number | Sí* | `6.9` | ídem | ídem | `inspection_measurements.rtd_b_mm` |
| R3 (canal C) | `r3` | ídem | number | Sí* | `6.5` | ídem | ídem | `inspection_measurements.rtd_c_mm` |
| R4 (canal D) | `r4` | ídem — solo ejes Libre/Dual | number | Cond.* | `9.8` | ídem | ídem (4 canales) | `inspection_measurements.rtd_d_mm` |
| PRESIÓN | `presion` | `FormBody.tsx` (psi) | number | No (null = sin medir) | `98` | Panel taller (PRESIÓN·MODO FRÍO) | ESTADO PRESIÓN (§3), Cumplimiento % (§9) | `inspection_measurements.pressure_psi` |
| TAPA DE VÁLVULA | `tapaValvula` → `tapa_valvula` | `FormBody.tsx` (autocomplete cat_valvula) | string | No | `Metálica` | Badge ⚠ REVISAR si no es plástica/metálica | — | `inspection_measurements.valve_cap` |
| ANOMALÍA | `anomalia` | `FormBody.tsx` (autocomplete cat_anomalia) | string | No | `Corte profundo en flanco` | Panel taller (lista + modal con posible causa/foto); `vista-flota` (causal → crítico) | **DESECHO automático** si `desecho=TRUE` (§5); ISA (§6); semáforo de flota | `inspection_measurements.anomaly` → futuro FK `catalog_anomalies` |
| — (calculado) RTD MOVI | `rtd_movi` | `inspeccionRepo` al guardar | number | Auto | `6.5` | Hero del panel taller; semáforos | Insumo de ESTADO RTD, tasa de desgaste, VUR, RTD Gastado (como "RTD Actual") | `inspection_measurements.rtd_movi_mm` |
| — (calculado) IDI | `idi` | `inspeccionRepo` al guardar | number | Auto | `0.7` | Chip IDI (spec; UI pendiente) | Alerta de desgaste irregular (§4) | `inspection_measurements.idi_mm` |
| — (calculado) ESTADO RTD | `estado_rtd` | `inspeccionRepo` (⚠ hoy con defaults 4/7 hardcodeados) | string | Auto | `Próximo a Reencauche` | Badges de todos los dashboards | Distribución ESTADO RTD (§10); semáforo flota | `inspection_measurements.rtd_state` |
| — (calculado) DESECHO | `desecho` | `inspeccionRepo` (lookup cat_anomalia.desecho) | 0/1 | Auto | `1` | Panel taller ("DESECHO: SÍ") | ISA peso 5 (§6); crítico en flota; desecho prematuro (§11) | `inspection_measurements.is_discard` |
| — ID medición | `inspeccion_neumatico.id` | UUID v4 dispositivo | uuid | Auto | `4c81…` | — | — | `inspection_measurements.id` (id del cliente) |
| — `updated_at` | ambas tablas | `nowIso()` al guardar | timestamp ISO | Auto | `2026-07-06T14:22:31Z` | — | Resolución LWW del sync (task_14) | `*.device_updated_at` + `*.updated_at` |

\* Obligatorio para que la posición cuente como "completa" (3 canales, o 4 en Libre/Dual, + presión). La app permite guardar parcial.

### 4. Campos especificados pero AÚN NO capturados por la app (spec `flujo_inspeccion.md`)

| Campo | Estado | Destino Supabase (ya previsto) |
|---|---|---|
| Temperatura FRÍO/CALIENTE | No implementado en FormBody | `inspection_measurements.temperature_mode` |
| Checkbox "Sin medir" presión | Implícito (presión vacía) | `pressure_psi IS NULL` → `pressure_state='Sin Medir'` |
| ESTADO PRESIÓN persistido | Se calcula solo en mocks, no se guarda | `inspection_measurements.pressure_state` |
| Anomalía de Aro (separada de neumático) | No implementado | columna futura `rim_anomaly` (pregunta abierta) |
| Foto de anomalía/desecho | No implementado (Sprint 3) | `inspection_measurements.anomaly_photo_url` |
| Inspector que realizó la inspección | No hay auth aún | `inspections.inspector_id` → `profiles` |

---

## Campos fuente de los dashboards (HOY MOCK — sin pantalla de captura)

Estos datos alimentan las fórmulas de rendimiento pero **nadie los captura todavía**; viven
hardcodeados en los datasets `UNITS`/`TIRES` de los HTML. Son la brecha principal que el esquema cubre.

| Campo mock | Label conceptual | Archivo mock | Dónde debería capturarse | Destino Supabase |
|---|---|---|---|---|
| `rtdInstalacion` | RTD Instalación (mm al montar) | `rendimiento*.html` | Evento de instalación (pantalla futura de taller) | `tire_installations.rtd_at_install_mm` |
| `kmInstalacion` | Km Instalación (odómetro al montar) | `rendimiento*.html` | ídem | `tire_installations.odometer_at_install` |
| `otd` | OTD — profundidad original (mm) | `rendimiento*.html` | Registro del neumático (inventario) o tabla por medida | `tires.otd_mm` (fallback `catalog_sizes.default_otd`) |
| `rtdRetiro` | RTD Retiro recomendado (mm) | `rendimiento*.html` | Configuración por empresa/medida | `rtd_thresholds.rtd_removal_mm` |
| `costo` | Costo $ del neumático/reencauche | `rendimiento*.html` | Inventario | `tires.cost` |
| `kmPrevioAcumulado` | Km acumulado en ciclos anteriores | `rendimiento*.html` | Lo actualiza el sistema en cada retiro | `tires.accumulated_km` (mantenido por `tire_removals`) |
| `rtdActual`, `kmActual` | RTD/Km de la última inspección | `rendimiento*.html` | **YA se captura** (app) | `inspection_measurements.rtd_movi_mm`, `inspections.odometer_km` |
| `reencauche {codigo, ciclo}` | Identidad del reencauche | `rendimiento*.html` | Ya parcial (condición+diseño) | `tires.condition` + `tires.retread_design_id` |
| `withdrawalAnomaly` | Anomalía causal de retiro | `vista-flota.html` | Ya se captura (anomalía con desecho) | `inspection_measurements.is_discard` |
| `reenc / MÁX 3` | Ciclos de reencauche vs máximo | `UI/renova_dashboard_taller_v1.html` | Registro del neumático + política empresa | `tires.condition` + (pregunta abierta: máx por empresa) |
| Acciones "Enviar a Retén"/"Descartar" (causa+foto) | Movimientos de inventario | `UI/renova_dashboard_taller_v1.html` | Pantalla futura de taller | `tire_inventory_movements`, `tire_removals`, `tires.discard_*` |

## Observaciones de integridad

1. **Deuda conocida:** `inspeccionRepo.ts` calcula `estado_rtd` con `DEFAULT_RTD_CAMBIO=4` /
   `DEFAULT_RTD_PROXIMO=7` hardcodeados (documentado como deuda). La tabla `rtd_thresholds`
   es el destino correcto; el fix del cliente es de otro run.
2. `vista-flota.html` hardcodea 4/8 mm en `tireStatus()` — es mock, pero al conectar debe leer
   el `rtd_state` ya calculado (con umbrales de empresa), como hace `v_fleet_status`.
3. El "neumático" hoy NO tiene identidad propia: es texto (`codigo`, `marca`, …) repetido en cada
   medición y clonado entre inspecciones (`clonarNeumaticos`). La tasa de desgaste (§7) exige unir
   por `codigo`+posición+vehículo — frágil ante tipeos. La tabla `tires` resuelve esto sin romper
   la captura actual (las columnas de texto se conservan como puente).
4. La app **no persiste** `estado_presion` (solo la spec y los mocks lo muestran). La columna ya
   existe en el borrador para cuando el cliente lo calcule.
