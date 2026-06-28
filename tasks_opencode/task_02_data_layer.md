# Task 02 — Data layer: SQLite local + esquema + seed + calculations.ts

## Objetivo
Capa de datos offline-first con SQLite local: esquema relacional, seed de catálogos, funciones de
repositorio (CRUD) y el motor de cálculo portado a TypeScript con tests de paridad. Sin esto, las
pantallas (task 03) no tienen dónde leer/escribir.

## Contexto
- Depende de task 01 (`app/` ya existe).
- Reglas de negocio: `/specs/reglas_negocio.md` (fuente de verdad). Catálogo: `/specs/catalogo_patron.md`.
- Referencia de cálculo a portar: `/reference/calculations.py` (misma firma, mismos casos borde).
- Reglas duras (de `/CLAUDE.md`): UUID v4 en cliente para inspecciones; catálogos en DB, no
  hardcodeados en componentes; NO implementar presión CALIENTE.

## Pasos

### A. Conexión SQLite con fallback web
- `src/db/sqlite.ts`: inicializar `@capacitor-community/sqlite`. En web (`npm run dev`) usar el
  fallback `jeep-sqlite` (registrar el custom element y `initWebStore`). Exponer `getDb()` que
  devuelve una conexión abierta a la base `renova.db`.
- Ejecutar las migraciones (crear tablas si no existen) y el seed idempotente al inicializar.

### B. Esquema (`src/db/schema.ts`)
Crear estas tablas (tipos SQLite; `updated_at` ISO string; ids de inspección = UUID v4 string):

- `empresa(id TEXT PK, nombre TEXT, flota TEXT)`
- `unidad(numero TEXT, empresa_id TEXT, tipo_vehiculo TEXT, configuracion TEXT,
   odometro_ultimo INT, ultima_fecha TEXT, PRIMARY KEY(numero, empresa_id))`
- `inspeccion_cabecera(id TEXT PK, empresa_id TEXT, numero_unidad TEXT, fecha TEXT,
   km_odometro INT, foto_unidad TEXT, created_at TEXT, updated_at TEXT, sincronizado INT DEFAULT 0)`
- `inspeccion_neumatico(id TEXT PK, cabecera_id TEXT, posicion INT, codigo TEXT, marca TEXT,
   modelo TEXT, modelo_actual TEXT, reencauche TEXT, medida TEXT,
   r1 REAL, r2 REAL, r3 REAL, r4 REAL, presion REAL, tapa_valvula TEXT, anomalia TEXT,
   rtd_movi REAL, idi REAL, estado_rtd TEXT, desecho INT DEFAULT 0, updated_at TEXT)`
- Catálogo (la UI lee de aquí, no de constantes): `cat_marca(id, nombre)`,
  `cat_modelo(id, marca_id, nombre)`, `cat_medida(id, nombre)`,
  `cat_anomalia(id, nombre, desecho INT)`, `cat_valvula(id, nombre)`,
  `cat_configuracion(tipo_vehiculo, notacion, posicion INT, tipo_eje TEXT, lado TEXT, piso INT)`
- `sync_queue(id TEXT PK, tabla TEXT, registro_id TEXT, op TEXT, created_at TEXT, enviado INT DEFAULT 0)` — **stub**, no se procesa aún.

### C. Seed (`src/db/seed.ts`)
Sembrar idempotentemente (INSERT OR IGNORE). **Fuente autoritativa del catálogo PATRON:**
`/reference/catalogo_patron.json` (datos reales extraídos del Excel — cópialo a
`app/src/db/seed_data/catalogo_patron.json` e impórtalo; NO uses las listas cortas de los
prototipos para esto). Estructura del JSON: `tapas_valvula[]`, `anomalia_neumatico[]`
(con `nombre`, `posible_causa`, `desecho`), `configuracion_vehiculo[]`
(con `tipo_vehiculo`, `configuracion`, `mvp`, `posiciones[] {posicion, tipo_eje, piso}`),
`condicion[]`.

- `cat_valvula` ← `tapas_valvula` (24).
- `cat_anomalia` ← `anomalia_neumatico` (67, con `desecho` real; 13 en TRUE). Guardar también
  `posible_causa` (agregar la columna a la tabla).
- `cat_configuracion` ← `configuracion_vehiculo`. Sembrar todas, **pero exponer en la UI solo las
  `mvp=true`** (BUS 2-4 y BUS 2-4-2). Persistir `posicion`, `tipo_eje`, `piso`, `mvp`. El JSON no
  trae `lado` (Izq/Der): para el mapa visual del bus, derivar `lado` del objeto `POS` de
  `UI/renova_inspeccion_v4.jsx` para las configs BUS (documentar el mapeo en el código).
- Catálogos que el JSON PATRON **no** trae (crecen vía REPORTE): `cat_marca`, `cat_modelo`,
  `cat_medida` ← sembrar la **unión** de: (a) las constantes del prototipo
  `UI/renova_inspeccion_v4.jsx` (`MARCAS`, `MODELOS_POR_MARCA`, `MEDIDAS`) **y** (b) los valores
  reales presentes en `reference/seed_unidades_demo.json` (marcas como `MICHELIN`, medidas como
  `315/80R22.5`). Así los selects muestran lo real y todo valor de las unidades sembradas existe
  en el catálogo. Comentar "TODO: reemplazar por catálogo real completo cuando se cargue el REPORTE".
- `empresa` ← Móvil Bus, Cruz del Sur, CIVA, ITTSABUS, CTA (de `UI/renova_home_v2.jsx`).
- `unidad` + inspecciones previas ← **rebanada REAL** de `reference/seed_unidades_demo.json`
  (cópialo a `app/src/db/seed_data/`). Son 12 buses reales (config 2-4-2) de Móvil Bus, Cruz del
  Sur e ITTSABUS, cada uno con su última inspección real (posiciones, código, marca, RTD A–D,
  presión, válvula, anomalías). Sembrar en `unidad` (numero, empresa_id, tipo_vehiculo=BUS,
  configuracion, ultima_fecha) y crear su `inspeccion_cabecera` + `inspeccion_neumatico` previos,
  para que "CONTINUAR INSPECCIÓN" muestre datos reales y se vea el "valor anterior".

> Si más adelante el catálogo viene del servidor, este seed se reemplaza por sync. Por ahora es la
> única fuente. Mantener los datos en `src/db/seed_data/`, no dispersos en componentes.

### D. Repositorios (`src/db/repos/*.ts`)
Funciones puras de acceso, una por entidad. Mínimo:
- `empresaRepo`: `listAll()`.
- `unidadRepo`:
  - `search(empresaId, query)` → **autocompletado**: devuelve TODAS las unidades cuyo `numero`
    **empieza por** `query` (case-insensitive; si querés, además las que lo *contienen*, con las
    `startsWith` primero), ordenadas. Ej: escribir `2` lista `2139, 2159, 217…`. Es la query que
    alimenta el buscador con autocompletado (la UI la consume en task 03). NO exigir match exacto.
  - `getByNumero(empresaId, numero)` → exacto (para cuando ya se eligió una de la lista).
  - `getUltimaInspeccion(empresaId, numero)` → última cabecera + sus neumáticos (para el banner
    "ÚLTIMA INSPECCIÓN" y el "valor anterior").
  - `upsert(...)`.
- `inspeccionRepo`: `crearCabecera(...)` (genera UUID v4), `getCabecera(id)`,
  `upsertNeumatico(...)` (genera UUID si nuevo; recalcula y guarda `rtd_movi`/`idi`/`estado_rtd`/
  `desecho` usando `core/calculations.ts` + umbrales por defecto), `listNeumaticos(cabeceraId)`.
- `catalogoRepo`: getters por tabla (`marcas()`, `modelos(marcaId)`, `medidas()`, `anomalias()`,
  `valvulas()`, `configuracion(tipo, notacion)`).

> Umbrales: como aún no hay tabla de umbrales por empresa, usar **defaults documentados**
> (`rtd_cambio=4`, `rtd_proximo=7`, deltas presión 5%/10%) **definidos como constantes con
> comentario "TODO: configurables por empresa"**, NO esparcidos por el código. No clasificar
> presión en CALIENTE.

### E. Motor de cálculo (`src/core/calculations.ts`)
Portar de `reference/calculations.py`, misma semántica y casos borde:
- `calcularRtdMovi(a,b,c,d?)` → MIN de canales; lanza si algún canal < 0.
- `calcularIdi(a,b,c,d?)` → MAX − MIN.
- `calcularEstadoRtd(rtdMovi, rtdCambio, rtdProximo)` → if/elif **secuencial** →
  `'Para Reencauche' | 'Próximo a Reencauche' | 'Normal'`.
- `calcularEstadoPresion(presion, presionRef, deltaAltoPct, deltaBajoPct, sinMedir)` →
  `'Sin Medir' | 'Alta Presión' | 'Baja Presión' | 'Normal'` (solo FRÍO).
- `calcularVur(rtdMovi, rtdCambio, tasaAcumulada)` → null si tasa 0/null/negativa; 0 si rtd ≤ cambio.

### F. Tests (`src/core/calculations.test.ts`, Vitest)
Casos espejo de `reference/`: RTD MOVI de 3 y 4 canales, IDI, estado RTD en los 3 ramos
(incluido el caso secuencial: rtd=3 con cambio=4/proximo=7 → "Para Reencauche", no el otro),
estado presión (alta/baja/normal/sin medir) y VUR (null/0/valor). Canal negativo lanza error.

## Diseño a prueba de futuro (NO rehacer la DB después) — requisito duro
El origen de los datos debe ser **intercambiable sin tocar la UI**. Para eso:
- Las pantallas leen **solo** vía repositorios (`catalogoRepo`, `inspeccionRepo`, etc.).
  Ningún componente accede a SQLite directo ni a constantes de catálogo inline.
- El **seed** está aislado en `src/db/seed_data/`. Hoy: PATRON real (`catalogo_patron.json`) +
  marca/modelo/medida provisionales del prototipo (con `TODO`). Mañana: reemplazar el seed por
  import del Excel REPORTE real o por sync de servidor — **sin cambiar repos ni pantallas**.
- El esquema ya soporta el servidor (UUID en cliente, `updated_at`, `sync_queue`); no inventar
  estructuras que dependan de los mocks del prototipo. La forma de las tablas sale de
  `specs/` + `catalogo_patron.json`, NO de los objetos `MOCK` del JSX.

## Limpieza heredada del review de task_01 (hacer de paso)
- Borrar assets huérfanos del template Vite: `src/assets/react.svg`, `src/assets/vite.svg`,
  `src/assets/hero.png` (no referenciados).
- Mover `vitest` de `dependencies` a `devDependencies`.
- Agregar script `"test": "vitest run"` (y `"test:watch": "vitest"`) en `package.json`.

## Criterios de aceptación
- `npm run build` verde; `npm test` verde (tests de calculations).
- Al iniciar la app, el esquema se crea y el seed corre sin duplicar en recargas sucesivas.
- `inspeccionRepo.crearCabecera` produce un `id` UUID v4; `upsertNeumatico` persiste y **calcula**
  `rtd_movi/idi/estado_rtd/desecho` correctamente (verificable con un test o un script de prueba).
- No hay catálogos hardcodeados en componentes (todo el catálogo vive en SQLite vía seed).

## Cómo verificar
```bash
cd app
npm test           # calculations verdes
npm run build      # verde
npm run dev        # la consola no debe mostrar errores de init de SQLite/seed
```

## Fuera de alcance
- UI/pantallas (task 03). Sync real (solo stub). Presión CALIENTE. Umbrales por empresa
  (defaults constantes por ahora). VUR/tasa de desgaste en UI.
