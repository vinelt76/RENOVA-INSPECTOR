# REVISIÓN FINAL — Filtros facetados

Fecha: **2026-07-19**.

## Entregado

- Primitiva compartida `applyFilters`: OR dentro de faceta, AND entre facetas.
- `filter-bar` único, accesible y reutilizado en Rendimiento e Inspecciones.
- Rendimiento como agregado de un conjunto filtrado, con detalle por fila y exclusiones visibles.
- Inspecciones como último estado de neumáticos: última fecha global por defecto, última inspección
  al elegir unidad e histórico únicamente mediante fecha explícita.
- Frescura de Rendimiento: umbral único de 30 días, 27 de 38 filas reales excluidas actualmente
  (3 sin fecha), chip para incluirlas y persistencia en URL.
- ADR-0006 y actualización de knowledge.

No se creó migración para frescura: `last_inspection_on` ya estaba en la vista remota y en el orden
de columnas observado. No se aplicó DDL ni se necesitó autorización para task 07.

## Verificación

Verificado localmente: 276 pruebas en seis suites, `docs:check`, sintaxis/whitespace del diff,
allowlist del bundle y cálculo manual sobre tres filas reales. Detalle en `PRUEBA_CAMPO.md`.

No verificado en campo: sesión real en 390×844 y escritorio, teclado completo sobre datos cargados,
consola/red, recarga y aislamiento entre dos empresas. Esos puntos figuran explícitamente como
`N/A`; no se confunden con las pruebas locales.

## Capacidad pedida y no entregada

**Consumo ocurrido dentro de una ventana temporal.** Task 08 se detuvo antes del DDL porque la base
no puede sostener la respuesta con cobertura útil: 2.183/2.247 mediciones no enlazan un ciclo;
0 cascos tienen dos mediciones útiles en ventanas de 30 o 60 días y solo 4/24 (16,7 %) en 90 días.
Mayo–junio de 2026 y julio de 2026 tienen 0 cascos calculables. No se aproxima con datos externos al
rango.

## Deuda y limitaciones

1. `v_tire_performance` y la extensión que ya expone `last_inspection_on` no tienen una cadena local
   de migraciones fiel al remoto; `schema_draft.sql` está desactualizado.
2. `v_rendimiento_dashboard_rows` conserva grants amplios a `anon`, divergentes del criterio más
   estricto de `v_search_index`.
3. La observación de reencauche ya está disponible; D-BLOQ-1/D-BLOQ-3 fueron resueltos antes de
   task 06 y no son bloqueo vigente.
4. La cadencia/enlace de inspecciones impide consumo por rango hasta mejorar el dato operativo.
5. El umbral de frescura es una constante nombrada de pantalla; falta configuración por empresa.
6. El bundle sigue omitiendo `renova-animate.js` y `renova-format.js`.
7. Falta el recorrido humano autenticado completo descrito en `PRUEBA_CAMPO.md`.
