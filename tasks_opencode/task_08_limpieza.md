# Task 08 — Limpieza barata (código muerto + deduplicación)

## Objetivo
Reducir deuda de mantenibilidad de bajo riesgo: borrar código muerto y deduplicar 3 piezas idénticas
copiadas entre pantallas. **Cero cambios de comportamiento.** (Tomado de `mimoanalisi.md` §1.3, §2.2-2.4,
§2.8 — solo los ítems baratos y seguros; el resto de ese documento queda como backlog, no se ejecuta.)

## Contexto
Verificado por Opus:
- `app/src/App.css` (2891 B) **no se importa** en ningún componente (template viejo de Vite).
- `app/src/db/schema.ts:104` `TABLE_SQL` **no se usa** en ningún lado (el DDL real vive en
  `sqlite.ts:runMigrations`). Es una segunda fuente de verdad muerta.
- `StepDots`, el helper `Field` (+ `labelStyle`/`selectBase`) y `empty()` están duplicados entre
  `EmpresaScreen.tsx`, `UnidadScreen.tsx`, `FormBody.tsx`, `GrillaBody.tsx`, `InspeccionScreen.tsx`.

## Pasos
1. **Borrar `app/src/App.css`** (confirmar antes con `grep -rn "App.css" src/` → debe dar 0 imports).
2. **Borrar `TABLE_SQL`** de `app/src/db/schema.ts` (líneas ~104-227). Mantener las interfaces de tipos.
   Confirmar que nada lo importe (`grep -rn TABLE_SQL src/`).
3. **`src/components/StepDots.tsx`**: extraer el componente (idéntico en EmpresaScreen y UnidadScreen) y
   reemplazar las copias por el import. Respetar la prop `current`/`total`.
4. **`src/components/Field.tsx`**: extraer el helper `Field` + `labelStyle`/`selectBase` (idénticos en
   FormBody y GrillaBody) y reemplazar las copias.
5. **`src/types/neumatico.ts`** (o en `schema.ts`): una sola `emptyNeumatico()` y reemplazar las copias de
   `empty()` en `InspeccionScreen.tsx` y `GrillaBody.tsx`. Mantener exactamente las mismas claves/valores.

## Criterios de aceptación
- `App.css` y `TABLE_SQL` ya no existen; `grep` confirma 0 referencias.
- StepDots/Field/empty viven en un solo lugar e importados; **la UI se ve y se comporta igual** que antes.
- `npm run build` / `npm test` (23) / `npm run lint` verdes (sin warnings nuevos).
- **Smoke test en navegador:** recorrer Empresa → Unidad → Inspección (Form y Grilla); todo idéntico,
  cero errores de consola. Anotar en STATE.

## Cómo verificar
```bash
cd app && grep -rn "App.css\|TABLE_SQL" src/   # debe dar 0 (salvo definiciones ya borradas)
npm run build && npm test && npm run lint && npm run dev
```

## Fuera de alcance
- Todo lo "grande" de `mimoanalisi.md`: migraciones versionadas, `app_meta` para no re-sembrar, separar
  `AppContext`, romper el "god component", agrupar props de FormBody, debounce de `persistDb`, y
  **Tailwind/cambios de stack** (esto último prohibido por CLAUDE.md). Queda como backlog.
