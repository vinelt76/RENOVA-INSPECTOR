# task_03 — Componente `filter-bar`

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

El componente de UI: campo de texto con autocomplete, chips removibles, navegación por teclado.
**Uno solo, parametrizado por pantalla** (F1).

Resultado observable: `WEB/shared/filter-bar.js` montable en un contenedor vacío, con suite propia
verde y smoke aislado en 390×844 sin desbordes ni errores de consola.

## 3. Dependencias y bloqueos

Depende de `task_02`. Bloquea `task_05` y `task_06`.

## 4. Archivos exclusivos

- `WEB/shared/filter-bar.js` (nuevo)
- `WEB/shared/filter-bar.css` (nuevo)
- `WEB/shared/__tests__/filter-bar.test.js` (nuevo)

Solo lectura: `WEB/buscador/finder-controller.js` y `buscador.css` (referencia de teclado y
accesibilidad), `WEB/movimientos/a11y.js`, `WEB/neumaticos/`, `WEB/renova-office-shell.css`,
`DESIGN.md`.

**Prohibido editar `WEB/buscador/`** (F2).

## 5. Contratos

```js
createFilterBar({
  mount,          // elemento contenedor
  facets,         // definiciones de CONTRATOS_DATOS.md §1.2
  rows,           // filas actuales; alimentan las sugerencias (F7)
  chips,          // estado inicial, para restaurar desde URL o historial
  onChange,       // (chips) => void
}) → { setRows, getChips, setChips, destroy }
```

Comportamiento:

- Escribir filtra sugerencias sobre los valores presentes en `rows` (F7), usando la normalización de
  `WEB/shared/search.js`. **No se copia esa primitiva.**
- Las sugerencias se **agrupan por tipo de faceta** y muestran el tipo. Es lo que resuelve la
  ambigüedad placa/código de F5: `Unidad: ABC-123` y `Neumático: ABC-123` son dos opciones visibles,
  no una adivinanza.
- Elegir una sugerencia crea un chip y limpia el campo.
- Los chips son removibles individualmente. `Backspace` con el campo vacío borra el último.
- Cada cambio de chips llama `onChange`.

Teclado, calcado del patrón ya validado en `finder-controller.js`: `↑`/`↓` navegan, `Enter`
selecciona, `Escape` cierra el desplegable sin borrar chips, `Home`/`End` van a los extremos.

Accesibilidad: `combobox` + `listbox` con `aria-activedescendant`, como el buscador. Los chips
anuncian su acción de quitar. Foco visible siempre.

Diseño: leer `DESIGN.md` y `knowledge/ai/09 - Diseno y UX.md`. Reutilizar tokens de
`renova-office-shell.css`. **No introducir un patrón visual nuevo**: los chips ya existen en
`WEB/neumaticos/` y en el buscador; este componente converge con ellos (límite duro 4).

## 6. Pasos

1. Leer `DESIGN.md`, `knowledge/ai/09`, `finder-controller.js`, `buscador.css` y `WEB/neumaticos/`.
2. Inventariar el patrón visual de chips ya existente. Si el componente nuevo tuviera que divergir,
   **detenerse y reportar**.
3. Implementar el componente sobre `applyFilters` y el helper de valores distintos de `task_02`.
4. Implementar teclado y ARIA reutilizando el patrón del buscador. Si hace falta gestión de foco,
   usar `WEB/movimientos/a11y.js`; **no crear una tercera utilidad**.
5. Estilos en `filter-bar.css`, sobre los tokens del shell.
6. Suite: estado de chips, semántica de teclado, agrupación de sugerencias, casos de §8.
7. Smoke aislado en una página de prueba con datos mock: 390×844 y escritorio, consola limpia.

## 7. Invariantes

- **Sin red.** El componente recibe `rows`, no los busca.
- Sin catálogos hardcodeados (F7).
- **Sin interpretación silenciosa** (F6): todo filtro aplicado es un chip visible. El componente no
  infiere facetas del texto libre.
- Sin dependencias npm nuevas.
- No toca `WEB/buscador/` ni ninguna pantalla.
- `destroy()` deja el contenedor limpio y sin listeners: `task_05` y `task_06` lo remontan.
- Reduced motion respetado (precedente: `tasks_buscador_global/task_06`).

## 8. Casos de error

- `rows` vacío → sin sugerencias, mensaje honesto. No un desplegable vacío sin explicación.
- `facets` vacío → campo inerte, no lanza.
- Texto sin coincidencias → estado vacío explícito.
- Valor presente en más de una faceta → **ambas** opciones, agrupadas por tipo (F5).
- Chip inicial con faceta desconocida → se descarta silenciosamente al montar; el resto se conserva.
- Valores muy largos → el chip trunca visualmente, conserva el valor completo y no desborda en
  390×844.

## 9. Aceptación

```bash
npx vitest run --dir WEB/shared
npx vitest run --dir WEB/inventario
npx vitest run --dir WEB/movimientos
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/neumaticos
node --check WEB/shared/filter-bar.js
git diff --check
```

Más smoke con evidencia: recorrido completo por teclado sin mouse; 390×844 sin overflow horizontal;
0 errores de consola; `prefers-reduced-motion` sin animación.

## 10. Rollback

Borrar los tres archivos nuevos. Ninguna pantalla los consume todavía.

## 11. Handoff

Actualizar fila 03 con: confirmación de convergencia con el patrón de chips existente, conteo de
pruebas, y evidencia del smoke (viewports, teclado, consola).
