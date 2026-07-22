# task_13 — Pantalla de Neumáticos filtrada por faceta

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Crear **una única pantalla de Neumáticos** que se filtra por faceta desde la URL (D17). Es el
destino que hasta ahora faltaba: `PLAN.md` §3 prometía que «las facetas resuelven a listas
filtradas» pero no existía ninguna lista a dónde enrutar.

Una pantalla, N facetas. **No** una pantalla por marca ni por modelo.

## 3. Dependencias y bloqueos

Depende de `task_12`. Bloquea `task_08`.

## 4. Archivos exclusivos

- `WEB/neumaticos.html`
- `WEB/neumaticos/{data.js,neumaticos-model.js,neumaticos-controller.js,neumaticos.css}`
- `WEB/neumaticos/__tests__/*.test.js`
- Enlace desde `WEB/buscador/finder-controller.js` (solo el enrutado)
- `scripts/prepare-static-hosting.mjs` (allowlist)

Solo lectura: `WEB/shared/search.js`, `WEB/buscador/data.js`, `WEB/inventario/*` como referencia
visual, `DESIGN.md`.

## 5. Contrato de URL

El estado vive **enteramente en la URL** (D11: los favoritos son links, no objetos guardados).

```
neumaticos.html?marca=MICHELIN
neumaticos.html?medida=315/80R22.5&condicion=R2
neumaticos.html?modelo=XZA&estado=in_inventory
neumaticos.html?reencauche=<diseño>
```

- Facetas: `marca`, `modelo`, `medida`, `condicion`, `reencauche`, `estado`.
- Combinables con **AND**.
- Sin parámetros: todos los neumáticos de la empresa.
- Valor desconocido: lista vacía honesta, **no** error ni lista completa.
- Los cambios de filtro usan **`pushState`**, no `replaceState`: el botón atrás debe deshacer un
  filtro. Es el defecto que `docs/dashboard_ui_ux_audit.md` señala en las pantallas actuales y que
  no se debe replicar.
- `encodeURIComponent` en todo valor. Las medidas llevan `/`.

## 6. Comportamiento

- Reutiliza el índice ya cacheado por `WEB/buscador/data.js`. **No hace fetch propio**: el índice
  cubre el universo de cascos y ya está en memoria.
- Filtrado por faceta comparando con `normalizeSearchText`, de modo que `GOODYEAR` y `goodyear`
  colapsen (ver `task_12` §7).
- **Filtros visibles como chips removibles**, no como dropdowns ni como prosa interpretada. Quitar
  un chip actualiza la URL.
- Buscador de texto dentro de la pantalla, sobre el subconjunto filtrado, con el módulo compartido.
- Conteo visible de resultados. Si el filtro está activo, decirlo: un KPI sobre un subconjunto
  presentado como total es el defecto que la auditoría reporta en `instalacion.html:231-233`.
- Cada fila enruta a `historial-neumatico.html?serie=…&from=neumaticos`, con las mismas reglas de
  `CONTRATOS_DATOS.md` §6: código nulo → `SIN CÓDIGO`, **sin enlace falso**.

## 7. Invariantes

- **Solo lectura.** Sin descartar, retirar, reinstalar ni editar (D9).
- **Una sola pantalla.** No crear `marcas.html` ni `modelos.html`: eso promovería facetas a objetos y
  contradice D2/D3, que es la regla que impide que esto crezca a un ERP de cientos de pantallas.
- Sin parsing de prosa a filtros (D8): las facetas llegan por URL o por chip, nunca inferidas.
- Sin catálogos hardcodeados: la lista de marcas y medidas disponibles **se deriva de los datos**.
- Reutilizar el lenguaje visual de `WEB/inventario`: cards compactas, no tabla tipo Excel; el dato
  principal es la identidad del casco.
- Regla del Naranja Único, `tabular-nums` en RTD/presión/posición/fechas, sin rojo.
- Sin overflow horizontal a 390×844.

## 8. Casos de error

- Índice no cargado: loading, no lista vacía.
- Sin sesión: estado no autorizado, **no «0 resultados»**.
- Faceta con valor inexistente: vacío honesto indicando qué filtro no coincidió.
- Todas las facetas vacías: lista completa, sin chips.
- Casco sin código: visible, sin enlace.

## 9. Accesibilidad

Chips con nombre accesible que incluya la faceta y su valor, y botón de quitar alcanzable por
teclado. Región viva anunciando el conteo al cambiar filtros, sin ser intrusiva. Foco visible único.
Targets ≥44 px. `prefers-reduced-motion` respetado.

## 10. Aceptación

```bash
npx vitest run --dir WEB/neumaticos
npx vitest run --dir WEB/buscador       # regresión
npx vitest run --dir WEB/inventario     # regresión
npx vitest run --dir WEB/movimientos    # regresión
node scripts/prepare-static-hosting.mjs   # neumaticos/ presente
git diff --check
```

Smoke:

1. Llegar desde el buscador filtrando por marca, medida y condición.
2. Combinar dos facetas; verificar AND.
3. **Copiar la URL, abrirla en otra pestaña: mismo resultado.** Es la prueba de D11.
4. Botón atrás deshace un filtro, no saca de la pantalla.
5. Quitar un chip actualiza URL y resultados.
6. Casco sin código visible y no navegable.
7. Aislamiento: la pantalla nunca muestra cascos de otra empresa.
8. 390×844 sin overflow; consola limpia.

## 11. Rollback

Retirar la pantalla, su directorio, el enrutado desde el buscador y la entrada del bundle. El
buscador vuelve a enrutar solo a objetos.

## 12. Handoff

Actualizar fila 13 con facetas probadas, resultado del paso 3 (URL compartible) y del 4 (botón
atrás), y conteo de pruebas.
