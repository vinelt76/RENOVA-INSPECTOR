# PRUEBA DE CAMPO — Task 08

Fecha: 2026-07-19. Recorrido ejecutado en `WEB/` servido por HTTP, con dos sesiones reales
de empresas distintas en una misma pestaña temporal. Solo se hicieron lecturas y ambas sesiones
se cerraron al final. Esta bitácora no contiene credenciales, tokens, URLs privadas ni filas.

## Evidencia local

- `WEB/shared`: 4/4 pruebas.
- `WEB/buscador`: 13/13 pruebas.
- `WEB/inventario`: 15/15 regresión, sin cambios en sus pruebas.
- `WEB/movimientos`: 166/166 regresión, sin cambios en sus pruebas.
- `prepare-static-hosting`: incluye `web/buscador/` y `web/shared/`.
- `npm run docs:check` y `git diff --check`: correctos.
- Teclado, foco, `aria-activedescendant`, 390×844, escritorio y reduced motion: smoke
  aislado de task_06 correcto. Los deep-links y los destinos «Volver» se validaron en el
  smoke local de task_07.

## Evidencia autenticada

| Comprobación | Resultado |
|---|---|
| Cobertura empresa A | 98/98 unidades y 40/40 cascos: índice = tablas base. |
| Cobertura empresa B | 107/107 unidades y 0/0 cascos: índice = tablas base. |
| Estados de casco | Se encontraron al menos un casco `in_inventory` y uno `discarded`. |
| Identidad duplicada | Un caso `code_mismatch` se encontró tanto por código de casco como por código de medición. |
| Casco sin código | Se encontraron 3; todos resolvieron a su unidad, sin enlace falso. |
| Sin código y sin unidad | N/A: no existe actualmente un caso así en los datos; no se creó uno para probarlo. |
| Aislamiento A → B | Tras `signOut` e inicio de B en la misma pestaña, una placa de A devolvió 0 resultados; los conjuntos de `company_id` no se cruzaron. |
| Entradas y navegación | Las 7 pantallas abrieron por botón visible y Ctrl/Cmd+K; Enter navegó en las 7 al destino esperado. |
| Consola | 0 errores durante los recorridos autenticados; sin secretos registrados. |

El resultado confirma que no hay truncado, fuga entre inquilinos ni enlace falso en los datos
actualmente disponibles. La variante sin código y sin unidad queda pendiente de volver a ejecutar
cuando exista sin introducir datos de prueba en producción.

## Repetición tras task_10-13 (2026-07-19)

`task_10` (overlay centrado + frecency persistida), `task_11` (prefijos `uni:`/`neu:`) y `task_13`
(pantalla de Neumáticos filtrada por faceta) modificaron `finder-controller.js`, `search-model.js`,
`data.js` y agregaron una pantalla nueva. Por regla de `STATE.md`, el smoke de campo debía repetirse
antes de cerrar la fase.

La persona responsable ejecutó de nuevo el recorrido de campo (checklist de 19 puntos: los 15
originales de `task_08` §6 más overlay centrado, persistencia/purga de frecency, chips de alcance
`uni:`/`neu:`, y facetas/URL compartible/botón atrás de `neumaticos.html`) y confirmó que **todos
los puntos pasan**, sin errores de consola.

**Diferencia honesta con la corrida anterior:** esta repetición se registró como confirmación
consolidada de la persona responsable, sin volver a capturar los conteos disgregados por empresa
(98/98, 107/107, etc. de la corrida original). Los conteos y el aislamiento A/B de la tabla de
arriba siguen siendo la evidencia numérica vigente para cobertura/identidad/aislamiento — no se
invalidaron, solo no se volvieron a medir número por número en esta repetición. La variante «sin
código y sin unidad» sigue en N/A por la misma razón que antes: no existe ese caso en los datos y no
se crea uno de prueba para forzarlo.
