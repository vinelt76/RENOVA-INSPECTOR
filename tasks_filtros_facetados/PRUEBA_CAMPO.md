# PRUEBA DE CAMPO — Filtros facetados

Fecha de revisión local/remota: **2026-07-19**. El recorrido autenticado en navegador con una
persona responsable y dos empresas no se ejecutó. `PASA LOCAL` significa prueba automatizada,
inspección de código o SQL remoto administrativo; no se presenta como prueba de campo.

## Suite y bundle

| Suite | Resultado |
|---|---:|
| `WEB/shared` | 43/43 |
| `WEB/rendimiento` | 21/21 |
| `WEB/buscador` | 18/18 |
| `WEB/neumaticos` | 3/3 |
| `WEB/inventario` | 15/15 |
| `WEB/movimientos` | 176/176 |

`scripts/prepare-static-hosting.mjs` copia todo `WEB/shared/*.js` y `*.css`: `filter-bar.js`,
`filter-facets.js` y `filter-bar.css` quedan incluidos. Sigue vigente la omisión heredada de
`renova-animate.js` y `renova-format.js`.

## Recorrido de 24 puntos

| # | Punto | Resultado | Evidencia/razón |
|---:|---|---|---|
| 1 | Rendimiento sin filtros | PASA LOCAL | `computeGroup` y render inicial cubiertos; campo autenticado pendiente. |
| 2 | `eje: Tracción` recalcula | PASA LOCAL | Integración de `applyFilters`; verificación numérica inferior. |
| 3 | Marca + eje = AND | PASA LOCAL | Suite compartida y prueba previa de integración sobre código real. |
| 4 | Dos marcas = OR | PASA LOCAL | Suite `filter-facets`. |
| 5 | Quitar chip y Atrás | PASA LOCAL | `filter-bar` + `popstate`; navegador autenticado N/A. |
| 6 | URL compartida | PASA LOCAL | Parámetros repetibles y `rancios=incluir`; campo N/A. |
| 7 | Fila abre detalle | PASA LOCAL | Código preservado; campo N/A. |
| 8 | Frescura 30 días | PASA LOCAL | 5 pruebas nuevas; remoto: 11 frescos, 27 antiguos/sin fecha. |
| 9 | Ventana temporal | N/A | Cobertura insuficiente; task 08 detenida antes de DDL. |
| 10 | Tres exclusiones distintas | N/A | Dos visibles; la tercera depende de la capacidad no entregada del punto 9. |
| 11 | Inspecciones lista neumáticos | PASA LOCAL | Default = última fecha; unidad = última inspección; 6 pruebas de alcance temporal. |
| 12 | Chip fecha aplicar/quitar | PASA LOCAL | Fecha explícita abre historia y tiene precedencia sobre unidad; campo N/A. |
| 13 | Estado uno/dos valores | PASA LOCAL | OR dentro de faceta probado. |
| 14 | Estado + fecha = AND | PASA LOCAL | AND entre facetas probado. |
| 15 | Ambigüedad unidad/neumático | PASA LOCAL | Sugerencias agrupadas por faceta; campo N/A. |
| 16 | `code_mismatch` por ambos códigos | PASA LOCAL | Verificado sobre el mapeo real en task 06. |
| 17 | Casco sin código | PASA LOCAL | Se muestra `SIN CÓDIGO`, sin enlace falso. |
| 18 | Deep-links históricos | N/A | Los parámetros pertenecen a `Inspecciones por unidad.html`, no a esta lista; hallazgo de task 06. |
| 19 | Aislamiento entre empresas | N/A | No hubo dos sesiones autenticadas; SQL administrativo no sustituye RLS de usuario. |
| 20 | Teclado completo | PASA LOCAL | Suite de accesibilidad del componente; campo N/A. |
| 21 | 390×844 sin overflow | N/A | Requiere recorrido visual autenticado. |
| 22 | Consola/red limpias | N/A | Requiere recorrido autenticado. |
| 23 | Recarga persiste chips | PASA LOCAL | Estado en URL; campo N/A. |
| 24 | Buscador global sin cambios | PASA LOCAL | 18/18 pruebas; no se modificó `WEB/buscador`. |

Resumen: **17 PASA LOCAL, 7 N/A, 0 fallos observados**. No equivale a aprobación de campo.

## Verificación numérica manual

Subconjunto real: unidad 225, posiciones 3–5, marca MICHELIN, eje Tracción, inspección 2026-07-06.
Las tres recorren 78.394 km. Desgastes RTD: 5, 4 y 4 mm; por tanto Km/mm: 15.678,8; 19.598,5;
19.598,5. Resultado manual que debe mostrar el agregado (redondeo de UI):

- Km/mm promedio: **18.292**.
- Consumo promedio: **27,1 %**.
- Km proyectado promedio: **219.503 km**.
- Km acumulado total: **235.182 km**.
- Costo/km promedio: **$ 0,0012**.

Los valores se reprodujeron desde los campos fuente de `v_rendimiento_dashboard_rows`; no se creó
ni modificó ningún dato remoto.
