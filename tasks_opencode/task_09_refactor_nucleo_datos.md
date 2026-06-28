# Task 09 — Refactor núcleo de la capa de datos (schema versionado + reencauche + seed)

> **Ejecutor:** Sonnet 4.6. Este task es **autocontenido**: seguilo al pie. No decidas arquitectura;
> si algo es ambiguo, **pará y preguntá** (no improvises sobre el schema). Respetá `/CLAUDE.md` y
> `/specs/reglas_negocio.md`. **NO toques fórmulas/umbrales** (fase posterior).
> **Opus YA proveyó (✅ 2026-06-27):** `seed_unidades_demo.json` regenerado = **503 unidades / 515
> inspecciones / 3818 neumáticos** (flota completa, estructura nueva) y `catalogo_patron.json` actualizado
> (69 anomalías, +2 nuevas). **OJO: el `npm run build` está ROTO a propósito** — `seed.ts` (viejo) lee
> campos que ya no existen (`diseno_original`, `anomalia_neumatico`, `condicion` mal usada). **Arreglar
> `seed.ts` para la estructura nueva ES parte de este task (pasos C y D).** No es un bug a investigar.

## Objetivo
Dejar la capa de datos sólida y consistente:
1. **Migraciones versionadas** (`schema_version`) + **seed-once** (`app_meta`) — base para evolucionar sin
   perder datos y sin re-sembrar en cada arranque (van a entrar ~500 unidades).
2. **Arreglar el modelo de reencauche** (hoy está cruzado): `reencauche` debe ser el **diseño de
   reencauche** (catálogo propio), no la condición ni un modelo de marca. Eliminar `modelo_actual`.
3. Catálogos correctos: nueva **`cat_reencauche`** (global); el dropdown de reencauche lee de ahí (no de
   `modelos`). Agregar **`condicion`** al neumático (Nuevo/Reencauchado), leída de `cat_condicion`.
4. `seed.ts` → módulo puro `seed_rows.ts` (sin N+1) + comando **`npm run verify:db`**.
5. Repo usa `calculations.ts` (no reimplementa RTD/IDI).

## Estado actual relevante (ya verificado por Opus)
- `app/src/db/sqlite.ts`: `runMigrations` ejecuta un bloque `CREATE TABLE IF NOT EXISTS` (sin versionado);
  `initApp` corre `getDb→runMigrations→runSeed` **siempre**; `persistDb` usa `saveToStore('renova')`.
- `inspeccion_neumatico` hoy tiene **ambos** `modelo_actual` y `reencauche`, mal usados: el seed mete el
  **diseño de reencauche** en `modelo_actual` y la **condición (N/R1)** en `reencauche` (`seed.ts:201-208`).
- `FormBody.tsx:175-178` y `GrillaBody.tsx:186`: el select de reencauche (`modelo_actual`) lista `modelos`
  (catálogo por marca) → bug (salen modelos Michelin).
- `schema.ts:104-227` tiene `TABLE_SQL` **muerto** (no se usa). `App.css` está muerto.

## Estructura del JSON de seed que vas a consumir (provisto por Opus)
`seed_unidades_demo.json` = `{ _meta, unidades[], inspecciones[] }`:
- **unidad**: `{ empresa_id, numero, tipo_vehiculo, configuracion, ultima_fecha }`
- **inspeccion**: `{ empresa_id, numero_unidad, fecha, configuracion, km_odometro, neumaticos[] }`
- **neumatico**: `{ posicion, codigo, medida, marca, modelo, reencauche, condicion, rtd_a, rtd_b, rtd_c,
  rtd_d, presion, tapa_valvula, anomalia }`  ← ya NO trae temperatura, anomalia_aro, umbral_*, ni
  modelo_actual. `modelo` = diseño original; `reencauche` = diseño de reencauche (puede ser null);
  `condicion` = `N`/`R` (o `R1`…); `anomalia`/`tapa_valvula` ya vienen con el nombre del patrón.

## Pasos

### A. schema.ts (tipos + DDL único)
1. `InspeccionNeumatico`: **eliminar `modelo_actual`**; agregar `condicion: string | null`. `reencauche`
   pasa a significar el **diseño de reencauche**.
2. Agregar tipo `CatReencauche { id: string; nombre: string }`.
3. **Eliminar `TABLE_SQL`** completo (líneas ~104-227). El DDL vive solo en `sqlite.ts`.

### B. sqlite.ts — migraciones versionadas + app_meta + seed-once
4. DDL definitivo (schema **v1**), reemplazando el bloque actual:
   - `schema_version (version INTEGER NOT NULL)` y `app_meta (key TEXT PRIMARY KEY, value TEXT)`.
   - `inspeccion_neumatico`: **sin** `modelo_actual`, **con** `reencauche TEXT` y `condicion TEXT`.
   - **nueva** `cat_reencauche (id TEXT PRIMARY KEY, nombre TEXT NOT NULL UNIQUE)`.
   - resto de tablas igual.
5. `runMigrations(db)`: leer versión actual (si no existe `schema_version`, es 0). Aplicar en orden:
   - **v1**: crear todas las tablas (greenfield). Como aún NO hay datos productivos, si la DB venía de una
     versión 0 con tablas viejas (dev/IndexedDB), **DROP** de las tablas de datos+catálogo y recrear con el
     schema v1 (es data demo; documentar el reset). Insertar `schema_version=1`.
   - Dejar el patrón listo para v2, v3… incrementales no destructivas a futuro (`if (v < N) { … ; v=N }`).
6. **Seed-once:** `runSeed` solo corre si `app_meta.seed_version` < `SEED_VERSION` (constante, empezar en 1);
   al terminar, `INSERT OR REPLACE` la versión. `initApp` queda `getDb→runMigrations→runSeed` (runSeed ya
   decide si corre). Subir `SEED_VERSION` es lo que fuerza re-seed cuando cambian los datos.

### C. seed.ts → seed_rows.ts (puro) + derivaciones
7. Nuevo `app/src/db/seed_rows.ts` con `buildSeedRows()` puro (sin DB) que devuelve filas por tabla:
   `empresa, unidad, inspeccion_cabecera, inspeccion_neumatico, cat_marca, cat_modelo, cat_medida,
   cat_anomalia, cat_valvula, cat_configuracion, cat_condicion, cat_reencauche`. Ids con `slugify`
   determinístico. **Resolver `cat_modelo.marca_id` con un Map en memoria (sin N+1).**
   - `cat_marca`: marcas normalizadas (UPPER, dedup) desde unidades + PROTO.
   - `cat_modelo`: diseños **originales** por marca (NO los reencauches).
   - `cat_reencauche`: lista **global** de diseños de reencauche (de `neumatico.reencauche`, dedup, sin null).
   - `cat_anomalia`/`cat_valvula`: del `catalogo_patron.json` (ya reconciliado por Opus).
   - mapear neumático: `modelo←modelo`, `reencauche←reencauche`, `condicion←condicion`, sin `modelo_actual`.
8. `seed.ts`: `runSeed` consume `buildSeedRows()` e inserta (`INSERT OR IGNORE`, orden catálogos→empresas→
   unidades/inspecciones). Mantener `persistDb()` al final. **Comportamiento de datos = el del JSON.**

### D. Repos
9. `catalogoRepo.ts`: agregar `reencauches(): Promise<CatReencauche[]>` (`SELECT * FROM cat_reencauche
   ORDER BY nombre`). (Ya existe `condiciones()`.)
10. `inspeccionRepo.ts`: en `upsertNeumatico`, **usar `calcularRtdMovi`/`calcularIdi`** de
    `core/calculations.ts` (respetando solo canales medidos, sin `?? 0`); **quitar el `try/catch {}` vacío**.
    Agregar `condicion`; **quitar `modelo_actual`** de la firma/insert. `clonarNeumaticos` (si task_05 no se
    hizo aún, no lo agregues acá).

### E. App (FormBody, GrillaBody, InspeccionScreen)
11. Quitar `modelo_actual` de estado/`empty`/`commit`/carga (`InspeccionScreen.tsx`, `GrillaBody.tsx`).
12. El select de **reencauche** lee de **`cat_reencauche`** (prop nueva `reencauches`), NO de `modelos`.
    Un solo campo `reencauche`. Renombrar labels "modelo actual"→"reencauche".
13. Agregar select de **condición** (lee `cat_condicion`) vinculado al toggle "¿tiene reencauche?":
    condición `N`=nuevo (sin reencauche), `R`=reencauchado (habilita el select de reencauche). Seguir el
    patrón visual existente; no inventar componentes nuevos.
14. `InspeccionScreen` carga `catalogoRepo.reencauches()` y `condiciones()` y los pasa a los bodies.

### F. verify:db
15. `app/scripts/verify-db.ts` (con `tsx`) usa `buildSeedRows()` y exporta `verify-db.xlsx` (exceljs),
    **incluyendo la hoja `cat_reencauche`** y conteos por tabla. devDeps `exceljs`+`tsx`; script
    `"verify:db"`; `verify-db.xlsx` a `.gitignore`.

## Criterios de aceptación
- `schema_version` y `app_meta` existen; **reiniciar la app NO re-siembra** (seed corre 1 vez); subir
  `SEED_VERSION` sí re-siembra.
- En el form, **el dropdown de reencauche muestra diseños de reencauche** (DV-RM258, NZA2AW, LT+1…),
  **no** modelos de marca. `modelo` muestra los diseños originales por marca. Existe selector de condición.
- `inspeccion_neumatico` no tiene `modelo_actual`; tiene `reencauche` y `condicion`. `TABLE_SQL` y `App.css`
  eliminados.
- `npm run verify:db` genera el Excel con hoja `cat_reencauche` y conteos coherentes (flota completa).
- `npm run build` / `npm test` (23) / `npm run lint` verdes.
- **Smoke test en navegador OBLIGATORIO:** seleccionar empresa → unidad → inspección; **editar** marca/
  modelo/reencauche/condición/medida/válvula/anomalía/RTD/presión; recargar → persiste; consola sin
  errores; las 5 empresas con autocomplete. Anotar en STATE.

## Cómo verificar
```bash
cd app && npm install && npm run verify:db && npm run build && npm test && npm run lint && npm run dev
```

## Fuera de alcance (otros tasks)
- **Separar `AppContext`** (Session vs Inspection) y **buscador alfanumérico** → `task_10`.
- **Precarga "heredar TODO"** → `task_05` (sobre esta base ya estable).
- Romper el "god component", props de `FormBody`, debounce, fórmulas, APK → backlog/posterior.
