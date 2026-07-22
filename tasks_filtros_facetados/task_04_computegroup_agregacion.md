# task_04 — `computeGroup`: agregación sobre un conjunto

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Generalizar `computeAxle(unit, axle)` a `computeGroup(tires[])`: la misma agregación, sobre un
conjunto arbitrario de neumáticos en vez de las posiciones de un eje.

**Sin cambiar la UI.** Al terminar esta tarea, `rendimiento.html` se ve y se comporta exactamente
igual que antes. Lo único que cambió es de dónde sale la entrada del cálculo.

Resultado observable: `computeGroup` sobre las posiciones de un eje produce **valores idénticos** a
los que `computeAxle` producía, verificado por pruebas.

Es la tarea de mayor riesgo de la fase junto con `task_05` y `task_06`: toca el motor de cálculo de
una pantalla en producción.

## 3. Dependencias y bloqueos

Depende de `task_01`. Bloquea `task_05`.

No depende de `task_02` ni `task_03`: puede solaparse con ellas.

## 4. Archivos exclusivos

- El bloque de cálculo de `WEB/rendimiento.html` (`computeTire`, `computeAxle`, `mean`)
- `WEB/rendimiento/__tests__/` (nuevo) y su `package.json` / `vitest.config.js` si hacen falta,
  siguiendo el precedente de `WEB/buscador/`

Solo lectura: `reference/calculations.py`, `app/src/core/calculations.ts`,
`specs/reglas_negocio.md`, `supabase/migrations/`.

**Ningún otro archivo.** `task_02` y `task_03` corren en paralelo sobre `WEB/shared/`.

## 5. Contratos

Definido en `CONTRATOS_DATOS.md` §4:

```js
computeGroup(tires) → {
  total, valid, excluded,
  avgKmMm, avgPct, avgKmProyectado,
  totalKmAcumulado, avgCostoKm,
  best, worst,
}
```

Reglas que **no se pueden tocar**:

- **La matemática es idéntica.** Promedio simple sobre los válidos, suma para el acumulado. Esta
  fase no cambia fórmulas ni umbrales (límite duro 9).
- `computeTire` se conserva **tal cual**. Ya es pura y por neumático; no necesita cambios.
- `valid:false` sigue excluyendo del promedio, y `excluded` **se devuelve siempre** (F10). Es
  obligatorio en el retorno para que `task_05` pueda mostrarlo.
- `valid === 0` → métricas en `null`, **nunca `0`**. Es el invariante más importante del motor:
  «sin datos» y «cero» no son lo mismo.
- `rtdRetiro` sigue viniendo de los datos (`rtd_thresholds`), nunca hardcodeado.
- El balance izquierda/derecha **no migra** a `computeGroup`. Sobre «todos los Michelin de la flota»
  no significa nada. Se conserva donde el conjunto es un eje, como función aparte.

Extracción a módulo: si el cálculo se saca de `rendimiento.html` a un archivo propio, debe quedar
**puro y sin DOM**, y `rendimiento.html` importarlo. Es lo preferible para poder testearlo. Si por
la estructura del HTML resulta inviable, dejarlo en el archivo y testear igual — pero registrar por
qué.

## 6. Pasos

1. Leer `computeTire` y `computeAxle` completas, y `CONTRATOS_DATOS.md` §4.
2. Leer `specs/reglas_negocio.md` y `specs/reglas_fijas_vs_configurables.md` para confirmar que
   ninguna de las constantes en juego es configurable y quedó fija por error.
3. **Antes de refactorizar**: capturar los valores actuales de `computeAxle` para cada eje de varias
   unidades reales. Es el patrón golden de la casa (`reference/`). Esos números son el criterio de
   corrección.
4. Implementar `computeGroup(tires[])` con la misma matemática.
5. Reescribir `computeAxle` como envoltorio delgado: mapea las posiciones del eje a la lista y llama
   a `computeGroup`. **Una sola implementación de la agregación.**
6. Conservar el balance izquierda/derecha en el envoltorio del eje.
7. Verificar que los valores capturados en el paso 3 se reproducen **exactamente**.
8. Suite propia con los casos de §8.
9. Smoke: `rendimiento.html` se ve y se comporta igual que antes.

## 7. Invariantes

- **Sin cambio visible.** Si la pantalla cambia, la tarea se excedió.
- **Sin cambio numérico.** Cualquier divergencia contra los valores capturados invalida la tarea
  (regla de bloqueo 4). **No se ajustan los valores esperados para que pase.**
- No se altera `computeTire`.
- No se inventa `0` donde falta un dato.
- No se hardcodea ningún umbral.
- Si el cálculo tocara paridad con `reference/calculations.py`, ejecutar `/calc-parity-check`. La
  agregación por eje es de dashboard y probablemente no esté en el motor golden — **verificarlo, no
  asumirlo**.

## 8. Casos de error

- Conjunto vacío → `total:0, valid:0, excluded:0`, métricas `null`. No `NaN`, no división por cero.
- Todos inválidos → métricas `null`, `excluded === total`.
- Un solo válido → promedio igual a ese valor; `best === worst`.
- `costo` nulo en algunos → `avgCostoKm` promedia solo los que lo tienen, y eso se documenta. Un
  neumático sin costo no vale `0` soles.
- `kmPrevioAcumulado` ausente → se trata como hoy (`|| 0` en el mapeo actual), sin cambiar el
  comportamiento vigente.
- Conjunto grande (toda la flota) → sin desbordes numéricos ni cuelgue perceptible.

## 9. Aceptación

```bash
npx vitest run --dir WEB/rendimiento
npx vitest run --dir WEB/shared
npx vitest run --dir WEB/inventario
npx vitest run --dir WEB/movimientos
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/neumaticos
git diff --check
```

Más: tabla comparativa **antes/después** de los valores de `computeAxle` para varias unidades
reales, con diferencia cero. Sin esa tabla la tarea no se aprueba.

Y smoke de `rendimiento.html`: mismo render, mismos números en pantalla, consola limpia.

## 10. Rollback

Restaurar el bloque de cálculo original de `rendimiento.html` y borrar `WEB/rendimiento/__tests__/`.
Ninguna otra pantalla queda afectada.

## 11. Handoff

Actualizar fila 04 con: la tabla comparativa antes/después, conteo de pruebas, si el cálculo se
extrajo a módulo propio o no y por qué, y el resultado de la verificación de paridad (o la evidencia
de que no aplica).
