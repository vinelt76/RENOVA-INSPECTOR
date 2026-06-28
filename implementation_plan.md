# RENOVA INSPECTOR — Plan de Implementación Fase 1

> ⚠️ **STACK REEMPLAZADO (2026-06-25).** Este documento se conserva como **referencia del
> roadmap de features y del modelo de datos**, que siguen vigentes. El **stack** descrito aquí
> (Flutter · FastAPI · PostgreSQL · Railway · Drift · image_picker · share_plus) **ya NO aplica**:
> la app se construye en **React + Vite + Capacitor con SQLite local** (offline-first); el
> servidor/sync y los cálculos de servidor son fase futura. La constitución activa es `CLAUDE.md`.
> Lo que sobrevive intacto: reglas de negocio (`specs/reglas_negocio.md`), flujo de usuario,
> modelo de datos y la secuencia de features por sprint.

> Basado en el análisis completo de: `Aquí está el flujo general.txt`, `la idea Entonces es poder.txt`, `fase1_desarrollo_renova.docx` y `REPORTES Y PATRON.xlsx`.

**✅ Decisiones finales confirmadas:**
- ✅ **Flutter** nativo (iOS + Android) con Drift para offline
- ✅ **Railway** para backend (deploy simple con `git push`, PostgreSQL incluido)
- ✅ Cualquier inspector puede crear vehículos nuevos en campo
- ✅ **Fotos en anomalías** incluidas en Fase 1 (Sprint 2)
- ✅ Sprints acelerados con IA — estimado **~1 semana por sprint** en lugar de 2

---

## Descripción General

**RENOVA INSPECTOR** es una app móvil (Flutter) para inspectores de neumáticos en campo. Permite registrar inspecciones por vehículo/posición, calcular métricas de salud en tiempo real (RTD, presión, desgaste), y generar reportes Excel automáticamente. Actualmente el proceso es completamente manual en una hoja de cálculo; este sistema digitaliza y automatiza todo el flujo.

**Empresas actuales:** ~5 clientes (Palomino, Carapongo, y otros). **Tipo de vehículos:** Bus, Tracto, Furgón, Carreta, Semiremolque.

---

## Decisiones de Arquitectura — CERRADAS

> [!NOTE]
> **App:** Flutter nativo. Funciona offline con Drift (SQLite en el dispositivo). Sync automático al recuperar red. Una app para iOS y Android.

> [!NOTE]
> **Hosting:** Railway.app — FastAPI + PostgreSQL desplegados con `git push`. Sin configurar servidores Linux. Escala cuando sea necesario. Precio: gratis para empezar, luego ~$5/mes.

> [!NOTE]
> **Multi-tenancia:** Row-level con `empresa_id` en todas las tablas de negocio. NO schema-per-company. Ver `decisions/0001-tenancy.md`.

> [!NOTE]
> **IDs de inspección:** `inspeccion_cabecera.id` e `inspeccion_neumatico.id` son **UUID v4 generados en el dispositivo** al crear la inspección. NUNCA autoincrement de servidor — el sync offline colisionaría.

> [!NOTE]
> **Vehículos nuevos:** Cualquier inspector puede crear una unidad en campo. Búsqueda fuzzy para prevenir duplicados.

> [!NOTE]
> **Fotos en anomalías:** Movidas a Sprint 3. Sprint 2 (el más complejo) entrega el formulario base sin fotos para mantener el scope manejable.

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    DISPOSITIVO MÓVIL                        │
│  Flutter App (iOS + Android)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  UI Layer    │  │ Business     │  │  Drift (SQLite) │  │
│  │  (Screens/   │──│  Logic +     │──│  Offline Store  │  │
│  │   Widgets)   │  │  Cálculos    │  │  (espejo local) │  │
│  └──────────────┘  └──────────────┘  └────────┬────────┘  │
│  image_picker (cámara)       share_plus (export)  │          │
└───────────────────────────────────────────────│────────────┘
                                                │ sync background
┌───────────────────────────────────────────────▼────────────┐
│              BACKEND — Railway.app                          │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  FastAPI     │  │  Calc Engine │  │  openpyxl       │  │
│  │  (JWT Auth)  │  │  RTD/Presión │  │  Report Builder │  │
│  └──────┬───────┘  └──────────────┘  └─────────────────┘  │
│         │  Railway maneja Nginx + SSL automáticamente        │
│  ┌──────▼─────────────────────────────────────────────┐  │
│  │  PostgreSQL (multi-schema por empresa)               │  │
│  │  schema public: catálogo PATRON (compartido)         │  │
│  │  schema empresa_X: inspecciones, vehículos, umbrales │  │
│  └──────────────────────────────────────────────────────┘  │
│  Fotos → Cloudflare R2 (S3-compatible, CDN global)           │
└────────────────────────────────────────────────────────────┘
```

### Por qué Railway es la mejor opción para empezar

| Aspecto | Hosting compartido | Railway |
|---|---|---|
| FastAPI/Python | ❌ Solo PHP | ✅ Cualquier stack |
| PostgreSQL | ❌ Solo MySQL | ✅ Incluido en el plan |
| Deploy | Manual FTP | ✅ `git push` automático |
| SSL/HTTPS | Manual | ✅ Automático |
| Costo inicial | ~$5/mes | **Gratis** (luego ~$5/mes) |
| Escalar a VPS propio | ❌ | ✅ Migración simple |

---

## Modelo de Datos

### Tablas del catálogo PATRON (compartido, sin empresa_id)

| Tabla | Campos clave |
|---|---|
| `anomalia_neumatico` | id, nombre, posible_causa, desecho (bool) |
| `anomalia_aro` | id, nombre, posible_causa |
| `tapa_valvula` | id, nombre (~25 tipos: Metálica, Plástica, No tiene, Hilo dañado…) |
| `diseno_reencauche` | id, marca, nombre (~15 diseños) |
| `configuracion_vehiculo` | tipo_vehiculo, configuracion, posicion, tipo_eje, piso |
| `umbral_rtd` | medida, empresa_id, rtd_cambio, rtd_proximo, rtd_normal |
| `umbral_presion` | medida, tipo_eje, empresa_id, presion_frio, delta_alto_pct, delta_bajo_pct |
| `catalog_version` | id, updated_at — permite al cliente detectar si el catálogo cambió |

**Tipos de vehículo confirmados en PATRON:** BUS, TRACTO, FURGON, CARRETA, SEMIREMOLQUE
**Configuraciones:** BUS 2-4-2 (8 pos), TRACTO 2-2-2/2-4/2-2-4-4, CARRETA 4-4/4-4-4, SEMIREMOLQUE 4-4-4, FURGON 2-4

### Tablas por empresa (row-level con empresa_id)

```sql
inspeccion_cabecera
  id UUID PRIMARY KEY  -- ⚠️ UUID generado en el CLIENTE (no serial/autoincrement)
  empresa_id UUID, numero_vehiculo TEXT, fecha DATE, km_odometro INT (nullable)
  inspector_id UUID, sincronizado_at TIMESTAMPTZ

inspeccion_neumatico
  id UUID PRIMARY KEY  -- ⚠️ UUID generado en el CLIENTE
  cabecera_id UUID, empresa_id UUID, posicion INT, updated_at TIMESTAMPTZ
  -- Datos del neumático
  codigo, medida, marca, diseno_original, diseno_actual, condicion (N/R1/R2)
  -- Mediciones
  rtd_a, rtd_b, rtd_c, rtd_d
  presion, temperatura (FRÍO/CALIENTE)
  tapa_valvula_id, sin_medir (bool)
  anomalia_aro_id, anomalia_neumatico_id
  -- Calculados (almacenados)
  rtd_movi, idi, estado_rtd, estado_presion, desecho (bool)
  -- Desgaste (Sprint 5)
  tasa_desgaste_mm_por_1000km, vur_km, desecho_prematuro (bool)
  foto_url (nullable)

vehiculo
  numero, empresa_id, tipo_vehiculo, configuracion, estado (activo/pendiente/inactivo)
  creado_por, validado_por_supervisor

usuario
  id, empresa_id, nombre, rol (inspector/supervisor/admin), jwt_refresh_token
```

---

## Reglas de Negocio Clave

### RTD MOVI
```
RTD MOVI = MIN(RTD_A, RTD_B, RTD_C)              # 3 canales (Dirección, Tracción)
RTD MOVI = MIN(RTD_A, RTD_B, RTD_C, RTD_D)       # 4 canales (Libre, Dual)
```

### ESTADO RTD (umbrales configurables por empresa y medida)
```
# Evaluación SECUENCIAL (if/elif) — NO condiciones paralelas
if   RTD_MOVI ≤ rtd_cambio:   → "Para Reencauche"         🔴
elif RTD_MOVI ≤ rtd_proximo:  → "Próximo a Reencauche"    🟡
else:                          → "Normal"                  🟢

Defaults: rtd_cambio=4mm, rtd_proximo=7mm — NUNCA hardcodear.
```

> ⚠️ La versión anterior listaba las condiciones como si fueran paralelas. Son secuenciales.
> Un RTD de 3mm cumple ≤4 Y ≤7 — solo debe clasificarse como "Para Reencauche".

### ESTADO PRESIÓN (umbrales configurables por empresa)
```
# Evaluación SECUENCIAL
if   sin_medir o presion IS NULL:                  → "Sin Medir"     ⚫
elif presion > presion_ref × (1 + delta_alto/100): → "Alta Presión"  🔴
elif presion < presion_ref × (1 - delta_bajo/100): → "Baja Presión"  🔴
else:                                               → "Normal"        🟢

Defaults: delta_alto=5%, delta_bajo=10% — NUNCA hardcodear.
```

> ⚠️ PRESIÓN CALIENTE: el ajuste de referencia para temperatura CALIENTE NO está
> definido en la documentación actual. NO implementar hasta tener el valor correcto
> del equipo RENOVA. Ver `specs/reglas_negocio.md` sección 3.

### IDI (Índice de Desgaste Irregular)
```
IDI = MAX(canales_medidos) - MIN(canales_medidos)
# Usar los mismos canales que RTD MOVI (3 o 4 según tipo_eje de la posición)

IDI 0–1: Normal      🟢
IDI 2–3: Monitorear  🟡
IDI ≥ 4: Alerta      🔴
```

### VUR — casos especiales obligatorios
```
VUR (km) = (RTD_MOVI - rtd_cambio) / tasa_acumulada × 1000

Casos especiales:
  tasa_acumulada = 0 o NULL  → VUR = NULL ("Sin datos suficientes")
  RTD_MOVI ≤ rtd_cambio      → VUR = 0   ("Cambio inmediato")
  tasa_acumulada < 0         → VUR = NULL ("Dato inválido — revisar mediciones")
```

### DESECHO automático
Si `anomalia_neumatico.desecho = TRUE` en catálogo → campo `desecho` del registro se marca automáticamente.

---

## Flujo Principal de Usuario (Inspector)

```
1. Splash screen (logo RENOVA)
   ↓
2. Login (JWT)
   ↓
3. Selección de empresa
   ↓
4. Ingresar número de vehículo
   → Si existe: carga datos previos (medida, marca, diseño ya rellenados)
   → Si no existe: "Registrar nueva unidad" (TIPO + CONFIGURACIÓN → genera posiciones)
   ↓
5. Diagrama de posiciones del vehículo (visual, tocable)
   → Posiciones coloreadas: gris=pendiente, verde/amarillo/rojo=inspeccionado
   ↓
6. Inspector toca una posición → Formulario de neumático
   - Código (editable)
   - Medida (pre-llenada, editable)
   - Marca (pre-llenada)
   - Condición N/R1/R2
   - Diseño actual (si aplica)
   - RTD A/B/C (±stepper grande) [+D si posición libre/dual]
     → RTD MOVI + IDI + ESTADO RTD calculados al instante → semáforo en vivo
     → Valor anterior mostrado como referencia tenue ("anterior: 9mm")
   - Presión (stepper) + Temperatura (toggle FRÍO/CALIENTE)
     → ESTADO PRESIÓN calculado al instante
   - Tapa Válvula (default: Metálica)
   - Anomalía Aro (default: Normal)
   - Anomalía Neumático (default: Normal)
     → Si selecciona anomalía con DESECHO=SÍ: aviso y auto-marca DESECHO
     → Buscador con 65+ tipos agrupados por categoría
   - Foto (opcional, cuando DESECHO=SÍ)
   - Guardar (autoguardado por neumático, offline)
   ↓
7. Volver al diagrama → siguiente posición → repetir
   ↓
8. Cuando todas las posiciones están inspeccionadas: "INSPECCIÓN TERMINADA"
   ↓
9. Sync en background cuando hay red
   ↓
10. Volver a pantalla de selección de empresa/vehículo
```

---

## Hoja de Ruta — 5 Sprints (acelerados con IA, ~1 semana c/u)

### Sprint 1 (Semana 1): Backend y modelo de datos
**Objetivo:** El backend existe, acepta y persiste datos correctamente. La lógica de cálculo está validada contra el Excel real.

**Prerequisito ANTES de escribir código de feature:**
- [ ] Slice real del Excel → `backend/tests/fixtures/real_sample.xlsx`
- [ ] Confirmar con RENOVA el ajuste de presión CALIENTE → documentar en `specs/reglas_negocio.md`

**Backend:**
- [ ] Esquema PostgreSQL con row-level `empresa_id` (ver `decisions/0001-tenancy.md`)
- [ ] IDs UUID en `inspeccion_cabecera` e `inspeccion_neumatico` (generados en cliente)
- [ ] Poblar catálogo PATRON desde el Excel (`REPORTES Y PATRON.xlsx`)
- [ ] `catalog_version` table para versionado de sync
- [ ] Motor de cálculo puro: `calcular_rtd_movi()`, `calcular_estado_rtd()`, `calcular_estado_presion()`, `calcular_idi()`
- [ ] **Golden test** `tests/test_calculations_golden.py` ← verde ANTES de endpoints
- [ ] API FastAPI: CRUD inspecciones, endpoint sync (UPSERT por UUID), endpoints catálogo
- [ ] JWT auth con `empresa_id` en payload, row-level filtering en todas las queries

**Criterio de completitud:** Golden test verde contra el Excel real. Se puede insertar una inspección vía API (con UUID de cliente) y recuperarla con los 4 campos calculados correctos (RTD MOVI, ESTADO RTD, ESTADO PRESIÓN, IDI).

---

### Sprint 2 (Semana 2): App Flutter — Formulario base (sin fotos)
**Objetivo:** El inspector puede registrar una inspección completa sin conexión. Sin fotos — eso es Sprint 3.

- [ ] Setup Flutter + Drift + configuración de Railway
- [ ] Motor de cálculo Dart `lib/core/calculations.dart` + golden test Flutter
- [ ] Pantalla splash con logo RENOVA
- [ ] Login (JWT + refresh token; estrategia offline documentada en `mobile/CLAUDE.md`)
- [ ] Sync del catálogo PATRON al login (con `catalog_version` check)
- [ ] Selección empresa → número vehículo → inspección nueva
- [ ] UUID generado en cliente al crear `inspeccion_cabecera`
- [ ] Diagrama de posiciones visual (CustomPainter tocable, coloreado por estado)
- [ ] Formulario de neumático por posición (todos los campos, defaults inteligentes)
- [ ] Cálculo en tiempo real (semáforo RTD, IDI, presión) — funciones Dart del paso anterior
- [ ] Valores anteriores como referencia tenue
- [ ] Steppers grandes para RTD y presión (sin teclado virtual)
- [ ] Buscador de anomalías (65+ tipos, agrupados por categoría)
- [ ] DESECHO auto-marcado + advertencia cuando anomalía tiene `desecho=TRUE`
- [ ] Autoguardado por neumático en Drift (no esperar al final de la inspección)
- [ ] Sync en background al recuperar red (UPSERT por UUID, por neumático individual)
- [ ] Registro rápido de vehículo nuevo (búsqueda fuzzy + alta rápida)

**Criterio de completitud:** Inspector completa bus de 8 posiciones sin red; datos sincronizados correctamente al recuperar red. Golden test Dart verde.

---

### Sprint 3 (Semana 3): Fotos + Dashboard y métricas (sin odómetro)
**Objetivo:** Fotos en anomalías activas. Las métricas sin km operativas.

**Fotos (movidas de Sprint 2):**
- [ ] Cloudflare R2: cuenta + bucket + credenciales (prerequisito externo)
- [ ] `image_picker`: captura de foto activa cuando `desecho=TRUE`
- [ ] Compresión antes de upload + retry con back-off
- [ ] Upload a R2 vía backend → guardar `foto_url` en `inspeccion_neumatico`
- [ ] Foto encolada junto al sync cuando está offline

**Métricas:**
- [ ] IDI: alerta visual en formulario cuando IDI ≥ 4 (ya calculado en Sprint 2)
- [ ] Endpoints de agregación: cumplimiento presión, ISA, distribución RTD
- [ ] Cumplimiento de Presión % por vehículo/flota/mes
- [ ] Tasa de Incidentes (Alta/Baja Presión, Sin Medir) por TIPO EJE
- [ ] Tasa y Severidad de Anomalías (ISA con peso por DESECHO, configurable)
- [ ] Distribución ESTADO RTD por vehículo y por flota
- [ ] Dashboard Flutter: 5 tarjetas de indicadores
- [ ] Filtros: por empresa, mes, tipo de eje, vehículo

**Criterio de completitud:** Fotos capturadas y sincronizadas. Supervisor ve métricas completas de salud de flota.

---

### Sprint 4 (Semana 4): Generación del reporte Excel
**Objetivo:** La app genera el .xlsx equivalente al Excel original, con gráficas mejoradas.

- [ ] Backend `openpyxl`: hoja REPORTE con todos los campos, colores condicionales (verde/amarillo/rojo)
- [ ] Hoja PATRON incluida como referencia estática
- [ ] 3 gráficas: barras apiladas ESTADO RTD por vehículo, mapa de posiciones, distribución de presión
- [ ] Endpoint `/reportes/excel?fecha=...&empresa=...`
- [ ] Pantalla Flutter: selector fecha/período → botón generar → progreso → compartir (WhatsApp, email, Drive) / abrir

**Criterio de completitud:** El Excel generado es equivalente al original, con las gráficas correctas.

---

### Sprint 5 (Semana 5): Métricas de desgaste y proyección
**Objetivo:** Métricas con odómetro operativas. Cierre completo Fase 1.

- [ ] Captura de km odómetro a nivel `inspeccion_cabecera`
- [ ] Tasa de Desgaste: mm/1,000 km por neumático (CÓDIGO + NÚMERO VEHÍCULO), cruzando inspecciones consecutivas
- [ ] Vida Útil Remanente (VUR) en km (requiere ≥ 2 inspecciones + tasa)
- [ ] VUR mostrada en formulario al capturar RTD
- [ ] Tasa de Desecho Prematuro: comparar VUR proyectada vs. km real al desecho
- [ ] Lista "próximos cambios proyectados" (ordenada por VUR ascendente, filtros)
- [ ] Retroalimentación de precisión para supervisor

**Criterio de completitud:** La app muestra qué neumáticos necesitarán cambio en los próximos 5,000 / 10,000 / 20,000 km.

---

## Stack Tecnológico — FINAL

| Capa | Tecnología | Justificación |
|---|---|---|
| Mobile App | **Flutter** | Rendimiento nativo, iOS+Android, una sola codebase |
| Offline DB | **Drift (SQLite)** | Espejo de PostgreSQL, sync en background |
| Backend API | **FastAPI (Python)** | Async, rápido, openpyxl integrado |
| Base de datos | **PostgreSQL** | Multi-schema por empresa, Railway incluido |
| Reportes | **openpyxl** | Construye .xlsx con charts en el servidor |
| Auth | **JWT + refresh token** | empresa_id determines schema access |
| Hosting | **Railway.app** | `git push` deploy, PostgreSQL + SSL automático |
| Fotos (storage) | **Cloudflare R2** | S3-compatible, CDN global, muy barato |
| File sharing | **share_plus** (Flutter) | WhatsApp, email, Google Drive, abrir Excel |
| Cámara | **image_picker** (Flutter) | Cámara nativa iOS + Android |

---

## Panel de Administración (Supervisores) — FASE 2, no en ningún sprint de Fase 1

> Explícitamente fuera del alcance de Fase 1. Funcionalidad prevista pero no priorizada.

- Ver/editar/dar de baja unidades
- Validar unidades creadas por inspectores (flujo "pendiente de validar")
- Import masivo CSV/Excel para flotas nuevas
- Gestión de usuarios y roles
- Configuración de umbrales RTD y presión por empresa y medida

---

## Verificación del Plan

### Tests automatizados (Sprint 1)
```bash
pytest tests/test_calculations.py     # RTD MOVI, ESTADO RTD, ESTADO PRESIÓN, IDI
pytest tests/test_api.py              # CRUD endpoints
pytest tests/test_excel.py            # Comparar output vs. Excel original
```

### Verificación manual
- **Sprint 2:** Inspector de prueba completa una inspección real de bus en campo, offline, y los datos sincronizados son correctos.
- **Sprint 4:** El Excel generado se abre correctamente en Microsoft Excel y las gráficas son correctas.
- **Sprint 5:** Para 3 vehículos con historial real, la VUR calculada coincide con la expectativa operativa del equipo de RENOVA.

---

## Riesgos Identificados

| Riesgo | Mitigación |
|---|---|
| Inconsistencias en el PATRON del Excel | Limpiar y cargar el catálogo en Sprint 1, validar contra el Excel original |
| Pérdida de datos offline si el dispositivo falla | Autoguardado por neumático individual, no solo al final |
| Duplicados de vehículos por tipeo | Flujo "pendiente de validar" + búsqueda difusa por número |
| Sincronización de conflictos | LWW por `inspeccion_neumatico.id` + `updated_at` (NO a nivel cabecera — destruiría syncs parciales) |
| Curva de aprendizaje de Flutter en campo | UI con steppers grandes, defaults inteligentes, diagrama visual |
