# PLAN — Filtros facetados en Inspecciones y Rendimiento

Fecha: 2026-07-19. Basado en `AUDIT.md`, `DECISIONES.md` y `CONTRATOS_DATOS.md`.

## 1. Resultado funcional

Un **único componente de filtro con autocomplete y chips**, configurado distinto en dos pantallas
que dejan de ser lo que son hoy:

1. **Rendimiento** deja de ser un detalle de unidad→eje→posición y pasa a ser una pantalla de
   búsqueda: se escriben filtros, se acumulan como chips, y los cálculos de rendimiento se
   **recalculan sobre el conjunto filtrado**. «Los Michelin de tracción, ¿cómo rinden?»
2. **Inspecciones** deja de listar unidades y pasa a listar **neumáticos**, filtrables por unidad,
   código, estado y fecha.

No se agrega escritura. La fase es de lectura, como la anterior.

## 2. Arquitectura

```text
WEB/shared/search.js  (ya existe: normalización + tokenización)
        │
        ├─▶ WEB/shared/filter-facets.js   applyFilters(rows, chips) — puro
        │
        └─▶ WEB/shared/filter-bar.js      autocomplete + chips + teclado — sin fetch
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  rendimiento.html                INSPECCIONES POR FECHA.html
  (facetas de neumático)          (facetas de inspección)
        │
        ▼
  computeGroup(tires[])  ← generalización de computeAxle, misma matemática
```

Archivos nuevos:

- `WEB/shared/filter-facets.js` — predicado de combinación OR/AND. Puro.
- `WEB/shared/filter-bar.js` — componente de UI. Sin red.
- `WEB/shared/__tests__/filter-*.test.js` — pruebas puras.

Archivos modificados: `WEB/rendimiento.html`, `WEB/INSPECCIONES POR FECHA.html`, y una migración
aditiva para la fecha de última inspección.

**No se toca `WEB/buscador/`** (F2).

## 3. Por qué el orden es este

Las dos primeras tareas producen módulos puros y testeables que no tocan ninguna pantalla en uso. La
tercera refactoriza el cálculo **sin cambiar la UI**, de modo que su corrección se verifica contra el
comportamiento actual antes de que nada visible cambie.

Recién entonces se reemplazan las pantallas. Si algo falla en `task_05` o `task_06`, lo que se
revierte es un archivo, y los módulos ya validados quedan intactos.

Las dos últimas capacidades —frescura y ventana temporal— van al final porque tocan el esquema y
porque la segunda está genuinamente bloqueada por ausencia de datos.

## 4. Secuencia

```text
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10
```

| # | Tarea | Propietario | Riesgo |
|---|---|---|---|
| 01 | Auditoría remota y congelado del contrato | CLAUDE | Bajo |
| 02 | `applyFilters` — combinación de facetas | CODEX | Bajo |
| 03 | `filter-bar` — componente de UI | CODEX | Bajo |
| 04 | `computeGroup` — agregación sobre conjunto | CODEX | **Alto** (cálculo) |
| 05 | Rendimiento como pantalla de búsqueda | CODEX | **Alto** (UI en uso) |
| 06 | Inspecciones como lista de neumáticos | CODEX | **Alto** (UI en uso) |
| 07 | Frescura de datos | CLAUDE + USUARIO | Medio (migración) |
| 08 | Consumo por ventana temporal | CLAUDE + USUARIO | **Alto** (vista nueva) |
| 09 | Suite integral y smoke de campo | CODEX + USUARIO | — |
| 10 | Documentación, ADR y revisión | CLAUDE | — |

## 5. Lo que la fase deliberadamente no hace

- **No filtra en servidor** (F9). Sin endpoints, sin índices, sin `pg_trgm`.
- **No promete ventanas temporales antes de `task_08`** (F11). La UI no ofrece un control de rango
  en Rendimiento hasta que exista la vista que lo soporta.
- **No inventa las bandas de reencauche** (D-BLOQ-1). La faceta se omite hasta que un humano las
  defina.
- **No regulariza `v_tire_performance`** (F14). Deuda registrada, fase aparte.
- **No crea una segunda mecánica de chips.** `WEB/neumaticos/` ya tiene una; `task_02` converge con
  ella o se detiene.

## 6. Bloqueos conocidos al abrir la fase

Dos decisiones humanas están pendientes y **detienen tareas concretas**:

- **D-BLOQ-1** (bandas de reencauche) — bloquea parcialmente `task_06`.
- **D-BLOQ-2** (desaparición del selector de unidad en Rendimiento) — bloquea `task_05` por
  completo.

`task_01` a `task_04` pueden ejecutarse sin resolverlas. Conviene resolver D-BLOQ-2 antes de que
`task_04` termine, para no dejar la cadena parada.

## 7. Terminado

La fase cierra cuando:

- un mismo componente sirve a las dos pantallas, sin copias;
- en Rendimiento, filtrar por eje o marca recalcula el agregado, y el conteo de neumáticos excluidos
  por datos insuficientes está a la vista (F10);
- `computeGroup` sobre un eje da **exactamente** lo mismo que `computeAxle` daba antes;
- en Inspecciones las filas son neumáticos, la fecha es un chip removible y un casco con
  `code_mismatch` se encuentra por ambos códigos;
- un casco sin código es visible y no produce enlace falso;
- el agregado excluye por defecto los datos de más de 30 días y lo dice;
- las suites nuevas y las existentes están verdes **sin modificar estas últimas**;
- la consola no tiene errores ni secretos, 390×844 no desborda, funciona por teclado;
- `npm run docs:check` pasa y el ADR está registrado en `decisions/`.
