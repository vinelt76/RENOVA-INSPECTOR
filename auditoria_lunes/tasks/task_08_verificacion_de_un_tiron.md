# task_08 — Poder verificar todo con un comando

**Hallazgo:** H-09 · **Prioridad:** Media · **Tipo:** herramienta
**Bloquea la demo:** no, pero es lo que hace sostenible el «impecable»

## Problema

385 pruebas repartidas en 8 suites con 8 invocaciones distintas. No hay script raíz que las corra
juntas, y `.github/workflows/` se eliminó en `ddcc9d2`. Verificar el sistema depende hoy de que
alguien recuerde los ocho comandos.

Peor: `WEB/rendimiento/__tests__` (25 pruebas) y `WEB/shared/__tests__` (50 pruebas) **no tienen
`package.json` ni `vitest.config.js`**, a diferencia de `movimientos`, `servicios`, `inventario` y
`buscador`. Corren con `npx vitest run` a mano —se comprobó, pasan— pero cualquier script que
itere buscando `package.json` las saltea **en silencio**. Son 75 pruebas, el 19 % del total, que
un runner ingenuo daría por inexistentes sin fallar.

`WEB/neumaticos/__tests__` está vacío: o falta escribir esas pruebas, o el directorio sobra.

## Trabajo

1. `package.json` + `vitest.config.js` en `WEB/rendimiento` y `WEB/shared`, iguales en forma a los
   cuatro que ya existen.
2. Resolver `WEB/neumaticos/__tests__`: escribir las pruebas o borrar el directorio. Un directorio
   de pruebas vacío es una afirmación falsa de cobertura.
3. Script raíz `npm run verify` que corra, fallando al primer error: `app` (lint + test + build),
   `app movimientos` (test + build), las 6 suites de `WEB/`, `docs:check` y la paridad de cálculo.
   Que imprima el total de pruebas ejecutadas — así, si una suite desaparece, el número lo delata.
4. Decidir si vuelve CI. Se quitó a propósito en `ddcc9d2`; si la razón fue el build del APK,
   un workflow que solo corra `npm run verify` no tiene ese costo.

## Criterio de cierre

- `npm run verify` desde la raíz, en limpio, termina en 0 y reporta **385 o más** pruebas.
- Quitar a mano un `package.json` de una suite hace que el comando falle, no que la saltee.
