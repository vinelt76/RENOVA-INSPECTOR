# task_06 — Inspecciones como lista de neumáticos

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Convertir Inspecciones de lista de unidades particionada por fecha en **lista de neumáticos
filtrable por chips** (F4), con la fecha como un chip más y no como llave del render.

Resultado observable: las filas son neumáticos con su unidad y posición; los chips de unidad,
código, estado y fecha se combinan; sin chip de fecha se ve el histórico.

## 3. Dependencias y bloqueos

Depende de `task_03`.

> **Parcialmente bloqueada por D-BLOQ-1.** La faceta de observación de reencauche (*para reencauche*
> / *próximo a reencauche* / *desecho*) **no se implementa**: esos valores no existen en el esquema
> y las bandas de RTD que los separan no están definidas. El resto de la tarea procede normalmente.

## 4. Archivos exclusivos

- `WEB/INSPECCIONES POR FECHA.html`

Solo lectura: `WEB/shared/`, `WEB/neumaticos/`, `WEB/buscador/`, `DESIGN.md`,
`knowledge/ai/09 - Diseno y UX.md`, `CONTRATOS_DATOS.md`.

## 5. Contratos

### El cambio estructural

Hoy `INSPECTIONS` es un diccionario **indexado por fecha** y `currentUnits()` devuelve
`INSPECTIONS[selectedDate] || []` (`:359`). Sin fecha no hay render.

Pasa a: una lista plana de neumáticos, con `fecha` como atributo filtrable de cada fila.

Es el cambio de mayor riesgo de regresión de la fase (R3): la pantalla está en uso y la fecha está
entretejida con el render.

### Filas

Un neumático por fila, con unidad y posición como atributos. La unidad deja de ser el sujeto (F4).

### Facetas

| Faceta | Notas |
|---|---|
| Código de unidad | Placa y código son equivalentes: **una sola faceta**, no dos. |
| Código de neumático | Debe encontrar por **ambos** códigos ante `code_mismatch`. Ver §Códigos. |
| Estado | Los valores **crudos reales** que `task_01` documentó, no los del enunciado. |
| Fecha | Chip removible. Sin chip → histórico completo. |
| ~~Observación de reencauche~~ | **Omitida.** D-BLOQ-1. |

### Códigos y `code_mismatch`

La fase anterior documentó 22–23 cascos reales cuyo `tire_casings.code` difiere del `tire_code` de
la última medición, y `v_search_index` los indexa por ambos. Este filtro hace lo mismo: buscar un
código lo encuentra por cualquiera de los dos.

Un casco sin código se muestra `SIN CÓDIGO`, es visible y **no genera enlace falso**.

### Fecha

Por F11, acá la fecha **sí** es un filtro legítimo: la dimensión temporal existe en los datos de
inspección. La limitación de `task_08` es de Rendimiento, no de esta pantalla.

Elegir entre día suelto y rango según el volumen que `task_01` haya medido. Si el histórico completo
es grande, rango o día suelto obligatorio con default al día más reciente — pero **el default debe
verse como chip**, no ser invisible (F6).

### URL

Estado de chips en URL con `pushState`, igual que `task_05` y `WEB/neumaticos/`.

**Compatibilidad**: `tasks_buscador_global/task_07` dejó `?date=`, `?plate=` e `?inspection_id=`
resolviendo hacia esta pantalla. **Esos parámetros deben seguir funcionando**, traduciéndose a chips
equivalentes. Romperlos rompe el buscador global.

## 6. Pasos

1. Leer `DESIGN.md`, `knowledge/ai/09`, `WEB/neumaticos/`, el `CONTRATOS_DATOS.md` congelado y
   `tasks_buscador_global/task_07` (parámetros de URL a preservar).
2. Trazar todos los usos de `selectedDate` e `INSPECTIONS` antes de tocar nada.
3. Aplanar el modelo: de diccionario por fecha a lista de neumáticos.
4. Montar `filter-bar` con las facetas confirmadas, **sin** la de reencauche.
5. Reescribir el render a filas de neumático.
6. Traducir `?date=`, `?plate=` e `?inspection_id=` a chips equivalentes.
7. Estado de chips en URL con `pushState`.
8. Smoke completo, incluyendo los tres parámetros heredados.

## 7. Invariantes

- **No implementar la faceta de reencauche** (D-BLOQ-1). No inventar bandas «provisionales»: una vez
  en pantalla, un umbral inventado se vuelve el umbral real de la operación.
- **No romper `?date=`, `?plate=`, `?inspection_id=`.** El buscador global depende de ellos.
- Casco sin código: visible, sin enlace falso.
- Sin catálogos hardcodeados (F7); los valores de estado salen de los datos.
- Sin interpretación silenciosa (F6): un default de fecha se muestra como chip.
- Sin escritura.
- No tocar `WEB/shared/` ni `WEB/buscador/`.
- Revisar el allowlist de `scripts/prepare-static-hosting.mjs`.

## 8. Casos de error

- Sin datos → mensaje honesto, comportamiento actual conservado.
- Filtro sin resultados → estado vacío con los chips visibles.
- Neumático sin código → `SIN CÓDIGO`, sin enlace.
- `code_mismatch` → encontrado por ambos códigos.
- URL heredada con `?date=` de una fecha sin datos → estado vacío honesto, no pantalla rota.
- URL con faceta desconocida → se ignora ese chip.
- Histórico completo sin chip de fecha → no debe colgar la pantalla. Si el volumen lo impide,
  reportarlo: es información para F9, no algo a resolver paginando en silencio.

## 9. Aceptación

```bash
npx vitest run --dir WEB/shared
npx vitest run --dir WEB/rendimiento
npx vitest run --dir WEB/inventario
npx vitest run --dir WEB/movimientos
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/neumaticos
npm run docs:check
git diff --check
```

Smoke autenticado con evidencia:

1. Sin chips: lista de neumáticos del histórico (o el default visible como chip).
2. Chip de fecha → se reduce al período; quitarlo devuelve el histórico.
3. Chip de estado → se reduce; dos estados = OR.
4. Estado + fecha = AND.
5. Código de unidad y código de neumático se distinguen en el autocomplete (F5).
6. Un casco con `code_mismatch` aparece buscando por **cualquiera** de sus dos códigos.
7. Un casco sin código: visible, sin enlace.
8. `?date=`, `?plate=` e `?inspection_id=` siguen resolviendo.
9. 390×844 sin overflow; teclado; 0 errores de consola.

Criterio de bloqueo: si alguna suite existente requiriera modificación para pasar, el cambio rompió
comportamiento. **No se ajustan los tests.**

## 10. Rollback

Restaurar `WEB/INSPECCIONES POR FECHA.html`. Nada más queda afectado.

## 11. Handoff

Actualizar fila 06 con: facetas implementadas, confirmación explícita de que la de reencauche quedó
omitida por D-BLOQ-1, verificación de los tres parámetros de URL heredados, evidencia de
`code_mismatch` por ambos códigos, y resultado del smoke.
