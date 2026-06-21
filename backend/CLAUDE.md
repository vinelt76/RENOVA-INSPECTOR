# Backend — RENOVA INSPECTOR

FastAPI + PostgreSQL. Deploy en Railway con `git push`. Lee `@CLAUDE.md` primero.

## Estructura

```
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── inspecciones.py     # CRUD + sync endpoint
│   │   ├── catalogo.py         # PATRON endpoints (read-only para cliente)
│   │   ├── vehiculos.py        # Alta + búsqueda fuzzy
│   │   ├── reportes.py         # /reportes/excel endpoint
│   │   └── auth.py             # JWT login + refresh
│   ├── core/
│   │   ├── calculations.py     # calcular_rtd_movi / estado_rtd / estado_presion / idi / vur
│   │   └── security.py         # JWT encode/decode, empresa_id extraction
│   ├── db/
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic schemas (request/response)
│   │   └── migrations/         # Alembic
│   └── reports/
│       └── excel_builder.py    # openpyxl: hoja REPORTE + PATRON + 3 gráficas
├── tests/
│   ├── fixtures/
│   │   └── real_sample.xlsx    # ← slice del Excel real (NO inventado)
│   ├── test_calculations_golden.py  # ← PRIMER TEST — debe pasar antes de todo
│   ├── test_api.py
│   └── test_excel.py
└── pyproject.toml
```

## Motor de cálculo — reglas de implementación

El módulo `app/core/calculations.py` es la implementación de referencia.
**Toda la lógica viene de `@specs/reglas_negocio.md`. Nunca de aquí.**

```python
def calcular_rtd_movi(rtd_a, rtd_b, rtd_c, rtd_d=None) -> float | None:
    """rtd_d es None para posiciones de 3 canales."""

def calcular_estado_rtd(rtd_movi, rtd_cambio, rtd_proximo) -> str:
    """Retorna 'Para Reencauche' | 'Próximo a Reencauche' | 'Normal'."""

def calcular_estado_presion(presion, presion_ref, delta_alto_pct, delta_bajo_pct, sin_medir) -> str:
    """Retorna 'Sin Medir' | 'Alta Presión' | 'Baja Presión' | 'Normal'."""

def calcular_idi(rtd_a, rtd_b, rtd_c, rtd_d=None) -> float | None:
    """IDI = MAX - MIN de los canales disponibles."""

def calcular_vur(rtd_movi, rtd_cambio, tasa_acumulada) -> float | None:
    """Retorna None si tasa es 0, NULL, o negativa. Retorna 0 si RTD ya en límite."""
```

Estas funciones son puras (sin side effects, sin acceso a DB). Fáciles de testear.

## Modelo de datos — tablas principales

### Catálogo compartido (sin empresa_id)

```sql
anomalia_neumatico  (id, nombre, posible_causa, desecho BOOLEAN)
anomalia_aro        (id, nombre, posible_causa)
tapa_valvula        (id, nombre)
diseno_reencauche   (id, marca, nombre)
configuracion_vehiculo (tipo_vehiculo, configuracion, posicion INT, tipo_eje, piso BOOLEAN)
catalog_version     (id, updated_at TIMESTAMPTZ)  -- para sync del cliente
```

### Datos por empresa (con empresa_id)

```sql
empresa             (id UUID, nombre, ...)
usuario             (id UUID, empresa_id UUID, nombre, rol, hashed_password, refresh_token)

umbral_rtd          (empresa_id UUID, medida TEXT, rtd_cambio NUMERIC, rtd_proximo NUMERIC)
umbral_presion      (empresa_id UUID, medida TEXT, tipo_eje TEXT, presion_frio NUMERIC,
                     delta_alto_pct NUMERIC, delta_bajo_pct NUMERIC)

vehiculo            (numero TEXT, empresa_id UUID, tipo_vehiculo, configuracion,
                     estado TEXT CHECK('activo','pendiente','inactivo'),
                     creado_por UUID, PRIMARY KEY (numero, empresa_id))

inspeccion_cabecera (id UUID PRIMARY KEY,        -- UUID generado en cliente, NO serial
                     empresa_id UUID, numero_vehiculo TEXT, fecha DATE,
                     km_odometro INT,             -- puede ser NULL (campo opcional)
                     inspector_id UUID, sincronizado_at TIMESTAMPTZ)

inspeccion_neumatico (id UUID PRIMARY KEY,       -- UUID generado en cliente
                      cabecera_id UUID REFERENCES inspeccion_cabecera,
                      empresa_id UUID,            -- desnormalizado para queries directas
                      posicion INT,
                      codigo TEXT, medida TEXT, marca TEXT,
                      diseno_original TEXT, diseno_actual TEXT, condicion TEXT,
                      rtd_a NUMERIC, rtd_b NUMERIC, rtd_c NUMERIC, rtd_d NUMERIC,
                      presion NUMERIC, temperatura TEXT CHECK('FRIO','CALIENTE'),
                      tapa_valvula_id INT, sin_medir BOOLEAN DEFAULT FALSE,
                      anomalia_aro_id INT, anomalia_neumatico_id INT,
                      -- Calculados (almacenados en DB para queries/reportes)
                      rtd_movi NUMERIC, idi NUMERIC,
                      estado_rtd TEXT, estado_presion TEXT,
                      desecho BOOLEAN DEFAULT FALSE,
                      -- Desgaste (Sprint 5)
                      tasa_desgaste NUMERIC, vur_km NUMERIC, desecho_prematuro BOOLEAN,
                      foto_url TEXT,
                      updated_at TIMESTAMPTZ DEFAULT now())
```

**CRÍTICO:** `inspeccion_cabecera.id` y `inspeccion_neumatico.id` son UUID generados en el
dispositivo. El servidor los acepta tal cual. Si ya existen (re-sync), hacer UPSERT.

## Sync offline — endpoint

```
POST /sync/inspecciones
Body: { cabecera: {...}, neumaticos: [{...}, ...] }
```

- UPSERT por `id` (UUID del cliente).
- El servidor recalcula los campos derivados al recibir los datos (validación de paridad).
- Si el servidor detecta discrepancia con el cálculo del cliente, acepta el del servidor
  y registra la discrepancia en logs (para detectar bugs de paridad).
- Conflictos: LWW (last-write-wins) a nivel `inspeccion_neumatico.id` + `updated_at`.
  **NO a nivel de cabecera completa** — eso destruiría syncs parciales.

## Generación del Excel

`app/reports/excel_builder.py` usando openpyxl:
- Hoja REPORTE: columnas en el mismo orden que el Excel original, valores (no fórmulas).
- Hoja PATRON: referencia estática del catálogo.
- Colores condicionales: verde/amarillo/rojo en columnas ESTADO RTD y ESTADO PRESIÓN.
- 3 gráficas:
  1. Barras apiladas horizontales ESTADO RTD por vehículo (ordenadas por criticidad).
  2. Mapa de posiciones: grilla vehículo×posición con conditional formatting (no chart tipo).
  3. Barras agrupadas ESTADO PRESIÓN por vehículo.

Endpoint: `GET /reportes/excel?empresa_id=...&fecha_desde=...&fecha_hasta=...`
Respuesta: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## Auth

- Login: `POST /auth/login` → `{access_token, refresh_token, empresa_id}`
- Refresh: `POST /auth/refresh` → nuevo `access_token`
- JWT payload: `{user_id, empresa_id, rol, exp}`
- `empresa_id` en el JWT es el único mecanismo de aislamiento de datos.
- Cada endpoint valida que el `empresa_id` del JWT coincida con el de los recursos accedidos.

## Reglas de código

- Sin lógica de negocio en los endpoints — solo validación de request y llamada a services.
- Los cálculos son funciones puras en `core/calculations.py`.
- No hacer queries con ORM en los endpoints directamente — usar funciones de repositorio.
- Toda query filtra por `empresa_id` extraído del JWT. Si una query no tiene `empresa_id`,
  es un bug de seguridad.
- Tests de integración usan una DB de test separada, no mocks.

## Comandos

```bash
uvicorn app.main:app --reload               # dev
pytest                                      # todos los tests
pytest tests/test_calculations_golden.py   # golden test (el más importante)
alembic upgrade head                        # aplicar migraciones
alembic revision --autogenerate -m "..."   # nueva migración
```
