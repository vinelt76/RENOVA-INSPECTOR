# task_04 — Agregación ponderada uniforme

## 1. Objetivo y resultado observable

Que todo conjunto use la misma estadística ponderada, incluida una sola unidad. Una instalación con
muy pocos milímetros de evidencia no debe dominar el KPI por estar sola dentro de una placa.

La paridad con la planilla se conserva por neumático. El promedio del renglón total del Excel queda
como referencia histórica y no como contrato del panel.

## 2. Dependencias

Depende de `task_02`: el desgaste ponderado necesita `utilMm` en `computeTire`.

## 3. Archivos

- `WEB/rendimiento.html`
- `WEB/rendimiento/__tests__/computeGroup.test.js`
- `tasks_paridad_rendimiento/{DECISIONES.md,CONTRATOS_DATOS.md}`

## 4. Implementación

Para cualquier conjunto:

```text
Km/mm         = Σ km recorrido / Σ RTD gastado
% desgaste    = Σ RTD gastado / Σ profundidad útil × 100
Km proyectado = Σ(proyectado × RTD gastado) / Σ RTD gastado
```

No existe un parámetro ni una rama por placa. Las etiquetas declaran `Sobre N neumáticos`,
`Ponderado por mm gastado` y `Razón de sumas`.

`Km acumulado` y VUR siguen usando mediana porque son magnitudes, no tasas. El balance
Izquierda/Derecha conserva `mean()` porque cambiarlo altera el significado del umbral de 15 % y
está fuera de esta fase.

## 5. Pruebas obligatorias

| Prueba | Esperado |
|---|---|
| Cuatro filas de la 225, misma placa | razón de sumas; no vuelve al total promedio del Excel |
| 0,1 mm y 8 mm dentro de una placa | la fila incipiente no domina |
| Igual rendimiento individual | promedio y ponderado coinciden |
| Profundidad útil constante | `Km proyectado = Km/mm × útil` |
| Profundidades útiles distintas | ponderado dentro de `[mín, máx]`, sin afirmar la identidad |

## 6. Criterio de cierre

- [x] Pruebas unitarias en verde.
- [x] Etiquetas generales y del detalle por eje declaran el ponderado.
- [x] Suite integral en verde: 411 pruebas, lint, docs y builds.
- [x] Smoke con adaptador autenticado y datos simulados; la falta de una sesión real automatizable
      queda registrada en `PRUEBA_CAMPO.md`.
