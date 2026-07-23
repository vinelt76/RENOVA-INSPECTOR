---
title: "Web, dashboards y taller"
updated: 2026-07-22
status: vigente
sources: [WEB/movimientos, app movimientos/src, WEB/inventario, WEB/buscador, WEB/shared, WEB/servicios, WEB/rendimiento.html, WEB/INSPECCIONES POR FECHA.html, supabase/migrations/20260716100000_baseline_provenance_and_helper.sql, supabase/migrations/20260716110000_baseline_mount_rpc_and_gate.sql, supabase/diagnostics/baseline_profile.sql, tasks_cambios_neumaticos/CONTRATOS_UI.md, tasks_pantalla_inventario/PLAN.md, tasks_buscador_global/PLAN.md, tasks_buscador_global/STATE.md, decisions/0005-buscador-global-objetos-navegables.md, decisions/0006-filtros-facetados-inspecciones-rendimiento.md, decisions/0007-definicion-de-servicio-ejecutado.md, decisions/0008-servicio-por-posicion-atendida.md]
---

# Web, dashboards y taller

## Superficies

| Archivo | Propósito | Fuente principal |
|---|---|---|
| `INSPECCIONES POR FECHA.html` | Último estado de neumáticos; histórico solo con fecha explícita | `inspections`, `units`, `v_inspection_dashboard_rows` |
| `Inspecciones por unidad.html` | Detalle de inspecciones y órdenes de Servicios por posición | `v_inspection_dashboard_rows`, `v_unit_position_state`, `create_tire_movement_order` |
| `rendimiento.html` | Agregado de neumáticos filtrados + detalle por fila; frescura de 30 días | `v_rendimiento_dashboard_rows` |
| `historial-neumatico.html` | Historia completa de un casco | vistas `v_casing_*` (incluye `v_inventory_status`) |
| `inventario.html` | Consulta de Retén y Descartados | `v_tire_inventory_available`, `v_inventory_status` |
| `importar.html` | Importar inspecciones | `save_inspection` |
| `servicios.html` | Servicios ejecutados: cuántos neumáticos se atendieron y de qué tipo | `v_tire_services` |

La pantalla histórica `inventario.html` y `comparativo.html` se retiraron junto con las RPCs
`reinstall_tire`/`retread_casing` y las vistas agregadas exclusivas. El 15 de julio se agregó una
pantalla de Inventario nueva, de solo lectura y sin aquellas operaciones: Retén muestra todo ciclo
montable y Descartados muestra bajas definitivas. `comparativo.html` continúa retirado.

La implementación modular vive en `WEB/inventario/`, exige sesión mediante el adaptador común,
recarga por Realtime, ofrece búsqueda tolerante a acentos y enlaza el código al Historial. La URL
de evidencia de descarte no se muestra porque la URL firmada original es temporal.

El modo visible **Servicios** vive en `WEB/movimientos/` (módulos ES puros +
`movimientos-controller.js`) y se integra en `Inspecciones por unidad.html` como un segundo modo
del gemelo digital. Un selector accesible **Inspección / Servicios** (persistido internamente en
`?mode=movimientos`, sin recarga) alterna panel, dock y selección sin tocar el flujo histórico de
Inspección. El enlace histórico `?mode=cambios` sigue abriendo Servicios y se canonicaliza a la
URL nueva. Un perfil activo `tire_supervisor`, `fleet_manager` histórico o `admin` puede armar y
emitir órdenes. La pantalla separada `instalacion.html` se retiró por redundante.

## Buscador global

`WEB/buscador/` (overlay tipo Spotlight, `finder-controller.js` + `search-model.js` + `data.js`) da
acceso a los dos únicos objetos navegables — Unidad y Neumático — desde una barra visible en el
header más `Ctrl/Cmd+K`, presente en las 7 pantallas. Índice cacheado por sesión desde
`v_search_index` (no búsqueda en servidor); frecency persistida en `localStorage`, aislada por
usuario+empresa y purgada en cambio de sesión. Prefijos `uni:`/`neu:` acotan el tipo como chip
removible. Decisiones y su porqué: ADR-0005 (`decisions/0005-buscador-global-objetos-navegables.md`).

`WEB/shared/search.js` centraliza la normalización de texto (`normalizeSearchText`) que antes
estaba duplicada en Inventario y Movimientos; ambos la reutilizan sin cambiar su UI propia.

Limitación conocida: un casco con `code` nulo no tiene historial alcanzable (`historial-neumatico.html`
filtra por `code=eq.`); el buscador lo muestra igual y enruta a su unidad, sin enlace falso.

## Filtros facetados

`WEB/shared/filter-bar.js` y `filter-facets.js` son una sola primitiva configurada por pantalla.
Inspecciones ahora lista neumáticos sin mezclar historia: por defecto usa la última fecha global y,
al filtrar una unidad, su última inspección. Una fecha explícita tiene precedencia para consultar
histórico. El resumen usa siempre esas mismas filas. Para no descargar todas las mediciones, carga
un índice liviano de `inspections`/`units` y después consulta la vista por fecha o `inspection_id`.
Rendimiento inicia con el agregado de la flota filtrada y abre el detalle jerárquico desde una fila.
OR dentro de una faceta y AND entre facetas; cada restricción es un chip visible y el estado queda
en URL.

Rendimiento excluye por defecto inspecciones de más de 30 días o sin fecha y muestra ese conteo
separado de los datos insuficientes. El chip `rancios=incluir` restaura esas filas. Esto solo filtra
frescura: no significa consumo ocurrido en los últimos 30 días. Su buscador facetado ofrece solo
`Mes de última inspección`; elegirlo incluye automáticamente inspecciones antiguas para que el filtro
temporal no quede vacío. Inspecciones, en cambio, reúne la búsqueda analítica: fechas, meses,
marca, modelo, medida, condición, diseño de reencauche y eje; también separa los estados
recuperables de reencauche del ítem Desecho, decidido por el catálogo de anomalías. Ninguno
representa una ventana de consumo; la ventana temporal no se entregó por falta de dos mediciones
enlazadas por casco. Ver ADR-0006.

## Servicios ejecutados

`WEB/servicios.html` (`WEB/servicios/`: `data.js` + `servicios-model.js` + `servicios-controller.js`)
es la superficie de lectura sobre `v_tire_services`. Responde **qué se hizo con los neumáticos**,
completando el par con el modo Servicios por unidad: uno **emite y sigue órdenes**, el otro
**consulta** el resultado consolidado.

**Qué mide:** actividad declarada por personas, contada por **posición atendida** (ADR-0008): el
neumático que sale de una posición con su tipo (`rotation`, `retread`, `discard`, …) y el que entra
en su lugar. Una rotación entre dos posiciones son **2** servicios, uno por posición; un scrap con
reemplazo es **1**. Cuatro tiles, barra de distribución segmentada con leyenda accesible, 12 facetas
con OR dentro / AND entre y estado en URL multivalor, igual que ADR-0006.

**Qué NO mide:** consumo, vida útil ni costo. `reconciliation_status` es `pending` al 100 %: los
servicios no están ligados a casco/ciclo/instalación. La faceta se expone justamente para que el
usuario descubra esa limitación en vez de asumir que la pantalla está completa.

Tampoco mide **lo que se hace sin desmontar el neumático** —presión, torque, alineación— ni las
inspecciones, que viven en su propia cadena (`inspections` / `inspection_measurements`). El párrafo
de alcance de la pantalla lo dice explícitamente: describir solo lo que sí mide la haría parecer más
completa de lo que es.

**El origen del neumático que entra se deriva, no se captura.** Si salió de otra posición de la
misma orden, la fila lo muestra (`DESDE P7`); si volvió a su propia posición, `VUELVE EL MISMO`; si
vino de fuera de la orden —retén, reparación, nuevo—, `ORIGEN NO DETERMINADO`. No se infiere lo que
exige el historial del casco.

**A qué enruta:** la fila **no** es clicable. Solo la placa (→ `Inspecciones por unidad.html`) y el
código de casco (→ `historial-neumatico.html`) son enlaces; un código sin historial muestra
`SIN HISTORIAL` sin `href`. Es el mismo límite de ADR-0005: dos objetos navegables, y Servicios
enruta hacia ellos sin volverse un tercero. Pantalla de solo lectura: ningún camino alcanza una RPC.

La actualización usa dos redes complementarias: conserva la suscripción Realtime y, como
`tire_movement_executions` todavía no está publicada, vuelve a consultar silenciosamente al enfocar
la ventana, al regresar a una pestaña visible y cada 10 segundos mientras permanece visible. El
sondeo conserva los datos actuales si falla y no muestra un estado de carga intermedio.

Límite de 2.000 filas con banner explícito cuando la respuesta lo llena — un recorte silencioso es
un error de datos disfrazado de rendimiento. Decisiones y porqué: **ADR-0008**
(`decisions/0008-servicio-por-posicion-atendida.md`) para la unidad de conteo y el origen derivado;
ADR-0007 para lo que sobrevive (pareo estructural, no navegabilidad, normalización, zona horaria).

**Del lado que dirige**, la rotación conserva el flujo entre dos posiciones. Para cualquier otra
opción del dropdown se consulta `v_tire_inventory_available` y el clic en una llanta agrega una
pareja consecutiva `exit + entry` en la misma posición. La entrada conserva `life_cycle_id`, código
y snapshot visible para que la orden diga explícitamente qué neumático debe entrar.

**En la app del operario**, la unidad visual también es la posición atendida: una tarjeta de
servicio contiene dos grupos, «Neumático que sale» (datos + razón) y «Neumático que entra»
(datos + origen). Una rotación P3↔P4 muestra 2 tarjetas, no 4 renglones sueltos, aunque conserva las
4 ejecuciones técnicas consecutivas que requiere la RPC y la vista. El origen se transporta como
metadato de la orden (`vehicle` + posición o `inventory`); las órdenes antiguas de rotación se
interpretan desde su nota `Rotar desde Pn`. Las entradas de retén/inventario precargan código,
marca, medida, diseño, condición y RTD disponibles para que el operario confirme o corrija.

## Patrón común

- `supabase-config.public.js` contiene configuración pública, nunca secretos.
- Una configuración local ignorada por Git puede reemplazarla para desarrollo.
- `supabase-demo.js` maneja cliente, sesión, `requireAuth`, lectura de vistas y suscripciones.
- Los dashboards muestran un badge que diferencia Supabase, mock/vacío y error.
- Las superficies de inspección escuchan cambios Realtime sin resetear la navegación del usuario.

## Operaciones de taller

La pestaña web dirige el trabajo; no confirma por sí misma movimientos físicos. El flujo activo es:

1. Leer el diagrama desde `v_unit_position_state` y las llantas montables desde
   `v_tire_inventory_available`.
2. Para rotación, elegir la posición destino y emitir los pares de ambas posiciones.
3. Para cualquier otro servicio, elegir la llanta de inventario que entra; la UI agrega salida e
   ingreso juntos y no deja reutilizar el mismo ciclo en dos posiciones.
4. Emitir una orden con `create_tire_movement_order` y seguir `issued → in_progress → completed`.
5. El operario captura los datos técnicos al ejecutar; la reconciliación física permanece pendiente.

La empresa se deriva del perfil autenticado. La RPC de órdenes admite `tire_supervisor`,
`fleet_manager` histórico y `admin`.

### Posiciones pendientes de línea base

`v_unit_position_state` distingue una posición realmente vacía de una que conserva evidencia de
inspección: `baseline_pending=true` significa `is_empty=true` **y** que hay una medición fuente.
No se ofrece montaje normal desde inventario en ese caso. El formulario de primer montaje precarga
la identidad y medición, pero una persona las confirma frente a la unidad y confirma un payload
idempotente mediante `confirm_baseline_mount`. La OTD original del ciclo se puede ingresar si se
conoce; queda nula cuando no se conoce y no se deriva de la RTD medida en la inspección.

La instalación resultante guarda `origin='baseline'` y `source_measurement_id`. Eso declara una
identidad confirmada, no una fecha de montaje observada. La línea base es perezosa: no hay backfill
masivo y el indicador Q6 de `supabase/diagnostics/baseline_profile.sql` muestra el progreso por
posición. El modo conserva `?mode=movimientos` como URL canónica; `?mode=cambios` es un alias de
lectura que se canonicaliza sin recargar.

Los módulos de lote directo, primer montaje y foto se conservan versionados y probados, pero el
controlador activo no los importa. `confirm_tire_change_batch` y `confirm_baseline_mount` no son
alcanzables desde la pestaña normal del supervisor.

## Rutas

La ruta es temporal, no un texto fijo en `units`. `unit_route_assignments` conserva vigencia desde/hasta; `v_installation_route_attribution` atribuye rendimiento según solapamiento temporal.

## Regla de evolución

Los HTML nacieron como prototipos con mocks y algunas fórmulas duplicadas. El destino es presentación fina sobre vistas/RPCs auditados. No eliminar fallbacks ni cálculos viejos hasta demostrar paridad y luego hacerlo en un cambio explícito.
