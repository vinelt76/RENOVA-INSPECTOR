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
