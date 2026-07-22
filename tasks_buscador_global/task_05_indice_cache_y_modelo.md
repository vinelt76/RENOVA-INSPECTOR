# task_05 — Carga del índice, caché de sesión y modelo puro

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Cargar `v_search_index` una vez por sesión, cachearlo de forma segura, y ofrecer un modelo puro que
filtre, rankee y agrupe resultados. Sin DOM todavía.

## 3. Dependencias y bloqueos

Depende de `task_03` (índice verificado en remoto) y `task_04` (módulo compartido). Bloquea
`task_06`.

## 4. Archivos exclusivos

- `WEB/buscador/package.json`, `WEB/buscador/vitest.config.js`
- `WEB/buscador/data.js` — carga y caché; sin DOM
- `WEB/buscador/search-model.js` — filtrado, ranking, agrupación, frecency, destinos; puro
- `WEB/buscador/__tests__/data.test.js`, `WEB/buscador/__tests__/search-model.test.js`

Solo lectura: `WEB/shared/search.js`, `WEB/supabase-demo.js`, `CONTRATOS_DATOS.md`.

## 5. Contratos

Columnas, `status`, destinos de navegación y política de caché: `CONTRATOS_DATOS.md` §2, §5, §6, §7.

Vitest en la **misma versión exacta** que usan `WEB/inventario` y `WEB/movimientos`; no introducir
una tercera.

## 6. Pasos

1. `data.js`: cargar vía `RenovaSupabase.fetchView("v_search_index", …)`, conservando los nombres
   canónicos de columna. Solo normalizar numéricos que PostgREST pueda devolver como texto.
2. Caché en `sessionStorage` bajo clave versionada. Al leer, validar versión **y** que la sesión
   corresponde a la misma empresa; si no coincide, descartar y refetch.
3. Registrar un hook de cierre de sesión / cambio de empresa que **borre la caché**.
4. `search-model.js`: filtrado con el módulo compartido sobre `haystack`.
5. Ranking: prefijo de `label` > palabra completa en `haystack` > substring. Desempate estable por
   `kind` y `label`.
6. Agrupación por `kind` con conteo por grupo.
7. Resolución de destino según §6 del contrato, con `encodeURIComponent` y los cuatro casos.
8. Frecency local al usuario: afecta orden, nunca existencia; histéresis según §7.5 del contrato.
9. Estado vacío: objetos recientes.

## 7. Invariantes

- **La caché muere al cambiar de empresa.** Es la invariante más importante de la tarea: una caché
  que sobreviva es una fuga entre inquilinos (regla 4 de bloqueo en `STATE.md`).
- No mutar las filas fuente.
- `null` se conserva; el render decide `—` o `SIN CÓDIGO`.
- **Nunca construir un enlace para `casing_code` nulo.**
- Frecency jamás elimina resultados (D13).
- Sin parsing de prosa a filtros (D8). Este módulo no infiere `marca=` ni `medida=`.
- Sin red en las pruebas: mocks inyectados.

## 8. Casos de error

- Índice vacío: estado `empty` legítimo, distinto de error.
- `fetchView` falla: conservar caché previa si existe, **marcarla desactualizada**; si no hay,
  estado `error` con reintento.
- Sesión ausente: estado `unauthorized`, nunca «0 resultados».
- Caché con versión vieja o de otra empresa: descartar silenciosamente y refetch.
- `sessionStorage` no disponible o lleno: degradar a memoria, sin romper.
- Respuesta con menos filas de las esperadas: si `task_03` dejó un techo conocido, advertir; no
  presentar como completo.

## 9. Aceptación

```bash
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/inventario     # regresión
npx vitest run --dir WEB/movimientos    # regresión
node --check WEB/buscador/data.js
git diff --check
```

Cobertura mínima de casos: normalización, tokens AND en columnas distintas, orden de ranking, orden
estable, frecency que reordena sin eliminar, los cuatro destinos, `label` nulo sin enlace, caché
hit/miss/versión inválida/cambio de empresa, y los cinco estados.

## 10. Rollback

Borrar `WEB/buscador/`. Nada más lo consume todavía.

## 11. Handoff

Actualizar fila 05 con conteo de pruebas, tamaño real del payload cacheado y confirmación explícita
de que la caché se destruye al cambiar de empresa, indicando cómo se probó.
