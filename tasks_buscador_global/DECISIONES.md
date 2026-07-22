# DECISIONES — Buscador global y objetos navegables

Fecha: 2026-07-19.

No hay decisiones humanas bloqueantes pendientes para empezar. Las dos decisiones estructurales
(alcance de objetos y ubicación del índice) fueron resueltas por el humano en la sesión de
exploración conceptual.

| ID | Decisión | Estado | Consecuencia |
|---|---|---|---|
| D1 | Reencuadrar la petición: el problema no es exceso de filtros sino ausencia de puntos de entrada y objetos navegables. | RESUELTA por auditoría, aceptada por el humano | Se descarta la Command Palette como método principal de interacción. |
| D2 | **Dos objetos navegables: Unidad y Neumático.** | RESUELTA por el humano | Inspección no se promueve a objeto. Los atributos son facetas, no objetos. |
| D3 | Las facetas (medida, marca, condición, eje, estado) resuelven a **listas filtradas de objetos**, nunca a páginas propias. | RESUELTA por D2 | Mantiene el lenguaje del buscador acotado a dos sustantivos de forma permanente. |
| D4 | **El índice es una vista Supabase cacheada en cliente**, no búsqueda servidor con `pg_trgm`. | RESUELTA por el humano | Un fetch por sesión en `sessionStorage`; sin migración de índices GIN; sin latencia por tecla. |
| D5 | El índice se construye desde **tablas base**, no desde las vistas de inventario/estado. | RESUELTA por auditoría | `tire_casings` garantiza cobertura exacta y evita depender de 11 vistas sin DDL versionado. |
| D6 | El `haystack` de un casco incluye **`tire_casings.code` y el `tire_code` de su última medición**. | RESUELTA por auditoría | `code_mismatch` es un estado legítimo del esquema; indexar una sola fuente crea neumáticos invisibles. |
| D7 | La normalización de texto ocurre **en cliente**, no en SQL. | RESUELTA por reutilización | No se instala `unaccent`. Se reutiliza `normalizeSearchText()`, ya probado, garantizando paridad con Inventario. |
| D8 | **Sin parsing silencioso de prosa a filtros.** Toda interpretación se materializa como chip visible y removible. | RESUELTA por análisis de riesgo | Un filtro mal inferido en silencio puede ocultar neumáticos en un sistema que decide retiros. |
| D9 | El buscador **enruta hacia acciones, nunca las ejecuta**. | RESUELTA por análisis de riesgo | Descartes, retiros y lotes son compromisos físicos irreversibles; exigen su formulario con evidencia. |
| D10 | Entrada **visible y persistente** en el header, además del atajo `Ctrl/Cmd+K`. | RESUELTA por análisis de frecuencia de uso | Un atajo oculto como única puerta asume un usuario experto que aquí puede no existir. |
| D11 | Favoritos = **URLs compartibles**, no consultas almacenadas. | RESUELTA por mínimo alcance | Requiere estado en URL; no requiere backend, tabla ni sincronización. |
| D12 | Las dos páginas de objeto se **promueven, no se crean**. | RESUELTA por auditoría | `historial-neumatico.html` ya es la página del casco; `Inspecciones por unidad.html` ya acepta `?plate=`. |
| D13 | El aprendizaje por frecency afecta **el orden, jamás la existencia** de un resultado. | RESUELTA por análisis de UX | Ocultar por poco uso rompe la confianza; reordenar sin histéresis destruye la memoria muscular. |
| D14 | Una migración nueva (`v_search_index`), revisada por `sync-migration-reviewer` y aplicada solo con autorización explícita. | RESUELTA por el orquestador | A diferencia de la fase de Inventario, aquí `task_02` y `task_03` **no** son N/A. |

## Decisiones posteriores a la revisión humana de `task_07` (2026-07-19)

El humano revisó el resultado de `task_07`, que era fiel al plan, y pidió cambios. Se registran acá
en vez de absorberlos dentro de una tarea ya `APROBADO`.

| ID | Decisión | Estado | Consecuencia |
|---|---|---|---|
| D15 | El overlay se presenta **centrado tipo Spotlight**, no como panel lateral. | RESUELTA por el humano | El plan nunca fijó posición; no deroga ninguna decisión previa. Cosmético. |
| D16 | **Los prefijos de alcance `uni:` y `neu:` son explícitos y NO contradicen D8.** | ACLARACIÓN, no derogación | D8 prohíbe *parsear prosa a filtros de atributo en silencio*. Un prefijo tecleado que filtra por `kind` —columna cerrada de dos valores— es visible, inequívoco y no puede fallar en silencio. `task_06` §5 ya los preveía como alias. |
| D17 | Las facetas enrutan a **una única pantalla de Neumáticos filtrada por URL**, no a una pantalla por faceta. | RESUELTA por el humano | Confirma D2/D3 en lugar de contradecirlas: un objeto, N facetas, una superficie. Facetas: marca, modelo, medida, condición, diseño de reencauche, estado. |
| D18 | `v_search_index` se **extiende con columnas de faceta**. | RESUELTA por consecuencia de D17 | La vista se diseñó para buscar, no para filtrar. Reabre la migración; cambio aditivo por `create or replace view`. Requiere medir el impacto en el payload. |
| D19 | La frecency **debe persistirse**. | DEFECTO detectado, no alcance nuevo | `finder-controller.js:93` la reinicia en cada carga; como la web son 7 documentos que recargan enteros, muere en cada navegación y «recientes» muestra objetos arbitrarios. Pasó los reviews porque las pruebas cubren las funciones puras y el smoke usó mocks: el fallo está en el cableado. |

**Nota de proceso.** La ejecución de `task_07` afirmó que estos cambios «reemplazan la restricción
anterior de no interpretar prefijos de búsqueda». Esa restricción **nunca existió**. Inventar una
decisión para derogarla ensucia el registro más que derogar una real. D8 sigue vigente con su
alcance original: sin parsing silencioso de prosa a filtros de atributo.

## Limitación conocida y aceptada

Un casco con `code` nulo **no tiene página de historial alcanzable**: `historial-neumatico.html`
filtra por `code=eq.`. Estos cascos aparecerán en el buscador con su contexto de unidad y posición y
enrutarán a la unidad, no al historial. No se inventa una ruta que el backend no soporta. Resolverlo
exige una fase de identidad de cascos separada — `tasks_puesta_en_marcha_movimientos/REVISION_FINAL.md:512`
ya registra ~316 neumáticos de deuda de identidad.

## Fuera de alcance

Verbos/acciones dentro del buscador, parsing de prosa a filtros, favoritos como objetos
almacenados, filtros facetados en las pantallas de lista, normalización de catálogos de
marca/modelo, y búsqueda cross-empresa. Este trabajo **destapa** la deuda de catálogos sin
resolverla. Cualquiera de estos abre una fase separada con contratos propios.
