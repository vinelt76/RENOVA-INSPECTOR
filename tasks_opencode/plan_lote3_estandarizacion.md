# Plan — LOTE 3: Estandarización de datos + refactor de catálogos (sin fórmulas)

> **Objetivo de Facundo:** que la **base de datos funcione** — estandarizada desde los 5 Excels nuevos,
> que se **muestre** en la app, se pueda **buscar y modificar**. **Las fórmulas quedan para después**
> (se definirán una por una). Este lote es solo datos + catálogos + el refactor de UI necesario para
> capturar/editar bien esos datos.
>
> **Rol Opus:** análisis + data-prep (curar seed y catálogos, reconciliar contra patrón) + specs.
> **opencode:** cambios de schema/seed/app. **Opus no codifica la app.**

## Contexto: qué cambió
- Excels nuevos en `docs/excels/`: **5, uno por empresa** (CIVA, CRUZ DEL SUR, CTA, ITTSA BUS, MOVIL BUS),
  estandarizados (2026-06-27). Sin columnas TEMPERATURA / ANOMALÍA ARO / umbrales.
- Renombre de dominio: **"modelo actual" → "reencauche"** (en Excel y app). El reencauche es el **diseño de
  reencauche**, NO un modelo de la marca.
- Datos provisionales del Lote 2 (curación previa de CIVA/CTA con números del paréntesis) **se descartan** y
  se regeneran desde estos Excels.

## Hallazgos del análisis (Opus)
1. **Bug de catálogo en el form (confirmado):** `FormBody.tsx:175-178` y `GrillaBody.tsx:186` usan el
   catálogo `modelos` (por marca) para el campo de reencauche `modelo_actual` → muestra modelos Michelin
   en vez de diseños de reencauche. Además hay **dos campos** (`modelo_actual` y `reencauche`) que
   confunden. Se consolidan en **un solo campo `reencauche`**.
2. **Catálogos a regenerar (normalizados UPPER + dedup):** marcas (~25), modelos/diseño original (~60),
   medidas (5). **Nuevo catálogo `cat_reencauche`** (~8: DV-RM258, DV-RM250, DV-RM226, NZA2AW, MZE2 REENC,
   LZE2W, LT+1…).
3. **Válvulas:** "Metálica" → "Tapa Metálica" (patrón). Resto ya en patrón (dedup de caso).
4. **Anomalías:** ver tabla de mapeo abajo (lo delicado).

## Alcance del Lote 3

### A. Data-prep (Opus) — `seed_unidades_demo.json` + catálogos + patrón
- Re-curar las 5 empresas desde los Excels (reemplaza lo provisional). Mapear columnas (incluyendo
  `REENCAUCHE`/`DISEÑO ACTUAL`). Solo buses MVP (2-4 / 2-4-2). Dedup 1 neumático/posición.
- Normalizar marcas/modelos/medidas/reencauches (UPPER, sin duplicados de caso).
- Reconciliar válvulas y **anomalías** contra el patrón (tabla abajo). Agregar al
  `catalogo_patron.json` las genuinamente nuevas (validadas por Facundo).
- **Número de unidad**: usar el identificador correcto del Excel (PENDIENTE confirmar — ver Decisiones).

### B. Schema + seed (opencode)
- **Consolidar `modelo_actual` → `reencauche`** en `inspeccion_neumatico` (eliminar `modelo_actual`).
  `modelo` queda = diseño original.
- **Nueva tabla `cat_reencauche (id, nombre)`** + sembrado desde el JSON.
- Sembrar marcas/modelos/medidas/anomalías/válvulas/reencauches normalizados. `catalogoRepo.reencauches()`.

### C. App (opencode)
- En `FormBody`/`GrillaBody`: el select de **reencauche lee de `cat_reencauche`** (no de `modelos`).
  Un solo campo "reencauche". Renombrar labels "modelo actual"→"reencauche".
- Verificar buscar + **modificar**: cargar un neumático existente, editar marca/modelo/reencauche/medida/
  válvula/anomalía/RTD/presión, guardar y que persista (ya hay autosave; confirmar con los catálogos nuevos).

### D. Patrón (Opus)
- `catalogo_patron.json`: agregar anomalías/válvulas nuevas validadas; documentar mapeos.

## Mapeo de ANOMALÍAS (Excels → patrón) — REQUIERE TU VALIDACIÓN
**CLARAS** (variación de caso/tilde/redacción → se mapean al nombre del patrón, sin agregar nada):
| En Excel | → Patrón |
|---|---|
| DESGASTE EN HOMBROS | Desgaste en hombro(s) |
| DESGASTE IRREGULAR DE LA BANDA DE RODAMIENTO / Desgaste Irregular… / desgaste irregular en la banda… | Desgaste irregular en banda de rodado |
| Desgarro en hombro lado externo | Desgarro en hombro externo |
| Desgaste del Hombro Interno | Desgaste en hombro interno |
| separación en la unión de la banda de rodamiento | Separacion de la union de la banda de rodamiento |
| Metálica (válvula) | Tapa Metálica |

**DUDOSAS** (mi propuesta; confirmá o corregí — "parecido → patrón, sino NUEVA"):
| En Excel | Propuesta Opus | ¿Mapear o NUEVA? |
|---|---|---|
| Corte en banda de rodamiento | → Corte superficial en banda de rodado | dudosa |
| Cortes en hombro externo | → Corte profundo en hombro externo | dudosa |
| Corte profundo en el flanco con cuerdas expuestas | → Cuerdas expuestas en flanco | dudosa |
| Desgaste irregular en hombro externo | → Desgaste irregular en el hombro | dudosa |
| Desgaste irregular en hombro interno | → Desgaste irregular en el hombro | dudosa |
| Desgaste irregular en hombros | → Desgaste irregular en el hombro | dudosa |
| Despegue en la línea de unión del reencauchado | **NUEVA** (específica de reencauche) | dudosa |
| PERFORACIÓN EN BANDA DE RODAMIENTO | → Avería pasante en banda de rodado | dudosa |
| objeto punzo cortante en flanco | **NUEVA** | dudosa |

## Decisiones (CERRADAS por Facundo, 2026-06-27)
1. **Anomalías dudosas:** se aplica la tabla de mapeo de arriba (7 → patrón, 2 → nuevas).
2. **`cat_reencauche` = GLOBAL** (lista única de diseños de reencauche, sin marca).
3. **Número de unidad:** civa/cruz/ittsa/movil = número tal cual (ya buscable). **CTA = placa real**
   (ej. `AAV-803`, sin el `(03)`) y el **buscador debe aceptar alfanumérico** (hoy filtra a solo dígitos).
4. **Cobertura: FLOTA COMPLETA** de cada Excel (civa 57, cruz 138, cta 151, ittsa 63, movil 94 ≈ 500
   unidades, filtrando a buses MVP 2-4 / 2-4-2; reportar descartes).

### Implicación obligatoria de la flota completa → **seed-once con `app_meta`**
Con ~500 unidades + sus neumáticos, `runSeed()` corriendo en **cada arranque** (hoy lo hace) penaliza el
inicio. Se agrega al alcance: tabla `app_meta(key,value)` con `seed_version`; el seed solo corre si la
versión cambió. (Esto saca del backlog el ítem de `mimoanalisi §1.2`, ahora **necesario**.)

### Buscador alfanumérico (app)
`UnidadScreen.handleSearch` quita `replace(/[^0-9]/g,'')` y el `inputMode="numeric"`; `unidadRepo.search`
ya usa `LIKE 'q%'` sobre `lower(numero)` → funciona con letras. Las unidades numéricas siguen igual.

## Hardening estructural — "bases sólidas" (Facundo, decisión 2026-06-27)
Se cierra la deuda estructural de la **capa de datos/estado** ahora (antes de cargar flota real y antes
del APK), para no arrastrar errores. Priorizado: se hace lo que previene bugs de datos; se posterga lo
puramente cosmético.

**SÍ entra (bases que evitan errores):**
1. **Migraciones versionadas** — tabla `schema_version`; cada cambio de esquema bajo `if version < N`.
   Reemplaza el bloque suelto de `CREATE TABLE IF NOT EXISTS`. Permite evolucionar el schema sin perder
   datos (clave ahora que `modelo_actual→reencauche` y `cat_reencauche` cambian el esquema).
2. **Una sola fuente del DDL** — eliminar `TABLE_SQL` muerto de `schema.ts` (hoy duplica el DDL real).
3. **`app_meta` + seed-once** (ya decidido por la flota completa).
4. **Repo usa `calculations.ts`** (no reimplementar RTD/IDI) + quitar el `try/catch` vacío
   (`inspeccionRepo.ts`).
5. **Separar `AppContext`** en `SessionContext` (empresa, persiste) e `InspectionState` (unidad/cabecera,
   transitorio) — evita estado cruzado entre inspecciones.
6. **Dedup** de `StepDots`/`Field`/`emptyNeumatico` + borrar `App.css` muerto.

**NO entra ahora (refactor de UI grande, riesgo de regresión; queda para después del APK):** romper el
"god component" `InspeccionScreen`, reagrupar los 17 props de `FormBody`, debounce de `persistDb`,
Tailwind (prohibido por stack). Se documentan como backlog.

> Esto absorbe casi todo `mimoanalisi.md` (lo valioso), dejándolo obsoleto como documento suelto.

## Lo que NO cambia / fuera de alcance
- **Fórmulas y umbrales** (RTD/presión/estado): NO se tocan (fase posterior, una por una).
- Tasks del Lote 2 que siguen válidos: **05** (selección+precarga), **06** (verify:db + refactor seed),
  **08** (limpieza). El **07** queda absorbido/ampliado por este Lote 3 (datos + conteo).
- Sin login, sync, reportes, ni APK todavía.
