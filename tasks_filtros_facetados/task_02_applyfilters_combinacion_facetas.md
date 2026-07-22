# task_02 — `applyFilters`: combinación de facetas

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

El predicado puro que reduce un conjunto de filas según una lista de chips, con la semántica **OR
dentro de la faceta, AND entre facetas** (F8).

Resultado observable: `WEB/shared/filter-facets.js` con suite propia verde, sin DOM, sin red, sin
dependencias npm nuevas.

Es la pieza de menor riesgo y mayor reutilización de la fase. Se hace primero para que `task_03`
construya la UI sobre una semántica ya probada.

## 3. Dependencias y bloqueos

Depende de `task_01` (contrato congelado). Bloquea `task_03`.

No depende de `task_04`: pueden solaparse, no comparten archivos.

## 4. Archivos exclusivos

- `WEB/shared/filter-facets.js` (nuevo)
- `WEB/shared/__tests__/filter-facets.test.js` (nuevo)

Solo lectura: `WEB/shared/search.js`, `WEB/neumaticos/`, `WEB/inventario/`, `WEB/movimientos/`.
**Prohibido editar** cualquier `__tests__/` existente.

## 5. Contratos

Definidos en `CONTRATOS_DATOS.md` §1. En resumen:

```js
applyFilters(rows, chips, facets) → rows filtradas
```

- `chips`: `[{facet, value}]`
- `facets`: definiciones con `match(row, value)`
- Agrupar chips por `facet`; una fila pasa si **para cada grupo** existe **algún** chip cuyo `match`
  da verdadero.
- Sin chips → conjunto completo.

**Lectura obligatoria antes de escribir**: `WEB/neumaticos/`. Ya implementa facetas AND con chips
removibles (`tasks_buscador_global/task_13`). Si su semántica difiere de F8, **detenerse y
reportar** — no unificar por cuenta propia ni dejar dos semánticas conviviendo.

## 6. Pasos

1. Leer `CONTRATOS_DATOS.md` §1 congelado y `WEB/neumaticos/` completo.
2. Comparar la semántica de combinación de `WEB/neumaticos/` con F8. Registrar coincidencia o
   divergencia.
3. Si divergen, **detenerse y reportar** antes de escribir nada.
4. Implementar `applyFilters` y el agrupamiento por faceta.
5. Implementar el helper de valores distintos para el autocomplete (F7): recibe filas y una faceta,
   devuelve los valores presentes, sin nulos ni vacíos, ordenados de forma estable.
6. Escribir la suite: los casos de §8 más los de combinación.

## 7. Invariantes

- Puro: sin DOM, sin red, sin estado global, sin `localStorage`.
- Sin dependencias npm nuevas.
- **No normaliza para almacenar ni mostrar.** La normalización de `WEB/shared/search.js` es para
  comparar. El `value` del chip conserva el valor crudo.
- No introduce fuzzy, stemming ni sinónimos.
- El orden de los chips no altera el resultado.
- No inventa valores ausentes de los datos (F7).

## 8. Casos de error

- `chips` vacío → conjunto completo, sin copia innecesaria.
- Faceta desconocida en un chip → se ignora ese chip, no lanza. (Ocurre al restaurar una URL o un
  historial de una versión anterior.)
- Fila con la columna de la faceta nula o vacía → no coincide, no lanza.
- Dos chips idénticos → mismo resultado que uno.
- Todos los chips de una faceta sin coincidencias → conjunto vacío, no error.
- `rows` vacío → vacío.

## 9. Aceptación

```bash
npx vitest run --dir WEB/shared
# regresión: nada de esto debe cambiar
npx vitest run --dir WEB/inventario
npx vitest run --dir WEB/movimientos
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/neumaticos
git diff --check
```

Criterio de bloqueo: cualquier `__tests__/` preexistente modificado en el diff invalida la tarea.

## 10. Rollback

Borrar los dos archivos nuevos. Ninguna pantalla queda afectada: nadie los consume todavía.

## 11. Handoff

Actualizar fila 02 con: resultado de la comparación contra `WEB/neumaticos/`, conteo de pruebas
nuevas y confirmación de que las suites existentes no fueron tocadas.
