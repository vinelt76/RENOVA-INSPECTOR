# Task 06 — `npm run verify:db`: auditoría de la base sembrada a Excel

## Objetivo
Comando offline que vuelca a un Excel multi-hoja **exactamente lo que la app siembra en SQLite** (no el
Excel fuente), para auditar que la base quedó completa y correcta y que la app ya **no depende del Excel**
en runtime. Para garantizar paridad Excel↔DB, primero se refactoriza el seed a funciones puras (lo que de
paso elimina el N+1 del seed, deuda §1.7).

> **Orden:** este task debe hacerse **después** del Task 07 (que agrega CIVA/CTA al JSON de seed), o
> coordinando, porque ambos tocan el seeding. Si se hace antes, igual sirve; el refactor no depende de qué
> empresas haya en el JSON. Ver STATE para el orden acordado.

## Contexto
- `app/src/db/seed.ts` hoy mezcla la transformación JSON→fila con la escritura a la DB, y tiene un N+1
  (`seed.ts:117-127`: un `SELECT` de marca por cada modelo).
- Fuentes: `app/src/db/seed_data/catalogo_patron.json` y `seed_unidades_demo.json`.
- `slugify`, los arrays PROTO (MARCAS/MODELOS/MEDIDAS), `EMPRESAS`, `POS_LADO_MAP` viven hoy en `seed.ts`.

## Pasos
1. **Nuevo módulo puro `app/src/db/seed_rows.ts`** (sin dependencia de la DB):
   - Exporta `buildSeedRows()` que devuelve un objeto con, por tabla, el arreglo de filas a sembrar:
     `{ empresa[], unidad[], inspeccion_cabecera[], inspeccion_neumatico[], cat_marca[], cat_modelo[],
     cat_medida[], cat_anomalia[], cat_valvula[], cat_configuracion[], cat_condicion[] }`.
   - Mueve ahí toda la transformación: ids vía `slugify` determinístico (igual que hoy), derivación de
     `cat_configuracion` (lado por `POS_LADO_MAP`, `mvp`), unión de marcas/modelos/medidas reales con los
     PROTO, y el armado de unidades/cabeceras/neumáticos (rtd_movi/idi/estado/desecho con la misma lógica
     que hoy). **Resolver `cat_modelo.marca_id` con un Map en memoria** (no N+1).
   - Para `inspeccion_cabecera`/`inspeccion_neumatico`, los ids (`generateId`) y timestamps (`nowIso`) se
     pasan como parámetro/inyección o se generan dentro; no afectan la auditoría de contenido.
2. **Refactor `seed.ts`**: `runSeed` consume `buildSeedRows()` e inserta con el mismo `INSERT OR IGNORE`,
   mismo orden de tablas (catálogos → empresas → unidades/inspecciones). **Comportamiento idéntico** al
   actual (mismo contenido sembrado). No cambiar la firma pública (`runSeed()`).
3. **Script `app/scripts/verify-db.ts`** (ejecutado con `tsx`):
   - Importa `buildSeedRows`, genera `app/verify-db.xlsx` con **exceljs**, una hoja por tabla (mismas que
     arriba), con cabeceras = nombres de columna.
   - Imprime en consola un resumen de **conteos por tabla**.
4. **`app/package.json`**: devDeps `exceljs` y `tsx`; script `"verify:db": "tsx scripts/verify-db.ts"`.
   Agregar `verify-db.xlsx` a `.gitignore` (raíz o de `app/`).

## Criterios de aceptación
- `npm run verify:db` corre sin error y genera `verify-db.xlsx` con todas las hojas y **conteos coherentes**:
  empresas (las que haya tras Task 07), 67 anomalías, 24 válvulas, configuraciones BUS `2-4` y `2-4-2`
  completas, y las unidades/inspecciones sembradas presentes.
- El refactor **no cambia lo sembrado** → smoke test en navegador: empresas visibles, autocomplete
  `Cruz del Sur → "7" → 7244/7216`, cero errores de consola.
- `npm run build` / `npm test` (23) / `npm run lint` verdes.

## Cómo verificar
```bash
cd app
npm install            # exceljs + tsx
npm run verify:db      # genera verify-db.xlsx + imprime conteos
npm run build && npm test && npm run lint
npm run dev            # smoke: el seed sigue cargando igual
```
Abrir `verify-db.xlsx` y revisar que las hojas tengan los datos esperados.

## Fuera de alcance
- Exportar desde la DB viva del navegador (IndexedDB); cualquier UI nueva; reportes Excel de negocio.
- Cambiar el contenido del seed (eso es Task 07).
