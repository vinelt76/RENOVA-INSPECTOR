---
title: "Web, dashboards y taller"
updated: 2026-07-21
status: vigente
sources: [WEB/movimientos, WEB/inventario, WEB/buscador, WEB/shared, WEB/neumaticos, WEB/servicios, WEB/rendimiento.html, WEB/INSPECCIONES POR FECHA.html, supabase/migrations/20260716100000_baseline_provenance_and_helper.sql, supabase/migrations/20260716110000_baseline_mount_rpc_and_gate.sql, supabase/diagnostics/baseline_profile.sql, tasks_cambios_neumaticos/CONTRATOS_UI.md, tasks_pantalla_inventario/PLAN.md, tasks_buscador_global/PLAN.md, tasks_buscador_global/STATE.md, decisions/0005-buscador-global-objetos-navegables.md, decisions/0006-filtros-facetados-inspecciones-rendimiento.md, decisions/0007-definicion-de-servicio-ejecutado.md]
---

# Web, dashboards y taller

## Superficies

| Archivo | Propósito | Fuente principal |
|---|---|---|
| `INSPECCIONES POR FECHA.html` | Último estado de neumáticos; histórico solo con fecha explícita | `inspections`, `units`, `v_inspection_dashboard_rows` |
| `Inspecciones por unidad.html` | Detalle de inspecciones/posiciones | `v_inspection_dashboard_rows` |
| `rendimiento.html` | Agregado de neumáticos filtrados + detalle por fila; frescura de 30 días | `v_rendimiento_dashboard_rows` |
| `historial-neumatico.html` | Historia completa de un casco | vistas `v_casing_*` (incluye `v_inventory_status`) |
| `instalacion.html` | Instalación, retiro y transferencia | vistas + RPCs de taller |
| `inventario.html` | Consulta de Retén y Descartados | `v_tire_inventory_available`, `v_inventory_status` |
| `importar.html` | Importar inspecciones | `save_inspection` |
| `neumaticos.html` | Neumáticos filtrados por faceta (marca, modelo, medida, condición, reencauche, estado) | `v_search_index` (columnas de faceta) |
| `servicios.html` | Servicios ejecutados: cuántos neumáticos se atendieron y de qué tipo | `v_tire_services` |

La pantalla histórica `inventario.html` y `comparativo.html` se retiraron junto con las RPCs
`reinstall_tire`/`retread_casing` y las vistas agregadas exclusivas. El 15 de julio se agregó una
pantalla de Inventario nueva, de solo lectura y sin aquellas operaciones: Retén muestra todo ciclo
montable y Descartados muestra bajas definitivas. `comparativo.html` continúa retirado.

La implementación modular vive en `WEB/inventario/`, exige sesión mediante el adaptador común,
recarga por Realtime, ofrece búsqueda tolerante a acentos y enlaza el código al Historial. La URL
de evidencia de descarte no se muestra porque la URL firmada original es temporal.

El modo **Movimientos de neumáticos** vive en `WEB/movimientos/` (módulos ES puros +
`movimientos-controller.js`) y se integra en `Inspecciones por unidad.html` como un segundo modo
del gemelo digital. Un selector accesible **Inspección / Movimientos** (persistido en
`?mode=movimientos`, sin recarga) alterna panel, dock y selección sin tocar el flujo histórico de
Inspección. El enlace histórico `?mode=cambios` sigue abriendo Movimientos y se canonicaliza a la
URL nueva. Exige un perfil activo `tire_supervisor`, `fleet_manager` histórico o `admin`: el supervisor selecciona
posiciones y emite indicaciones; no captura código, RTD, marca, condición ni odómetro.

## Buscador global

`WEB/buscador/` (overlay tipo Spotlight, `finder-controller.js` + `search-model.js` + `data.js`) da
acceso a los dos únicos objetos navegables — Unidad y Neumático — desde una barra visible en el
header más `Ctrl/Cmd+K`, presente en las 8 pantallas. Índice cacheado por sesión desde
`v_search_index` (no búsqueda en servidor); frecency persistida en `localStorage`, aislada por
usuario+empresa y purgada en cambio de sesión. Prefijos `uni:`/`neu:` acotan el tipo como chip
removible. Decisiones y su porqué: ADR-0005 (`decisions/0005-buscador-global-objetos-navegables.md`).

`WEB/shared/search.js` centraliza la normalización de texto (`normalizeSearchText`) que antes
estaba duplicada en Inventario y Movimientos; ambos la reutilizan sin cambiar su UI propia.

`WEB/neumaticos.html` (`WEB/neumaticos/`) es la única pantalla de lista filtrada por faceta —
`?marca=&modelo=&medida=&condicion=&reencauche=&estado=`, combinable con AND, estado en la URL vía
`pushState` — a la que el buscador enruta desde una faceta. No hay pantalla por marca ni por
modelo (D2/D3 del ADR-0005): agregar una la contradice.

Limitación conocida: un casco con `code` nulo no tiene historial alcanzable (`historial-neumatico.html`
filtra por `code=eq.`); el buscador y Neumáticos lo muestran igual, enrutando a su unidad, sin enlace
falso.

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
completando el par con el modo Movimientos: uno **ejecuta** (emite órdenes y captura), el otro
**consulta** el resultado consolidado.

**Qué mide:** actividad declarada por personas — salidas con su tipo (`rotation`, `retread`,
`discard`, …) más las instalaciones derivadas. Cuatro tiles, barra de distribución segmentada con
leyenda accesible, 12 facetas con OR dentro / AND entre y estado en URL multivalor, igual que
ADR-0006.

**Qué NO mide:** consumo, vida útil ni costo. `reconciliation_status` es `pending` al 100 %: los
servicios no están ligados a casco/ciclo/instalación. La faceta se expone justamente para que el
usuario descubra esa limitación en vez de asumir que la pantalla está completa.

**A qué enruta:** la fila **no** es clicable. Solo la placa (→ `Inspecciones por unidad.html`) y el
código de casco (→ `historial-neumatico.html`) son enlaces; un código sin historial muestra
`SIN HISTORIAL` sin `href`. Es el mismo límite de ADR-0005: dos objetos navegables, y Servicios
enruta hacia ellos sin volverse un tercero. Pantalla de solo lectura: ningún camino alcanza una RPC.

Límite de 2.000 filas con banner explícito cuando la respuesta lo llena — un recorte silencioso es
un error de datos disfrazado de rendimiento. Decisiones y porqué: ADR-0007
(`decisions/0007-definicion-de-servicio-ejecutado.md`).

## Patrón común

- `supabase-config.public.js` contiene configuración pública, nunca secretos.
- Una configuración local ignorada por Git puede reemplazarla para desarrollo.
- `supabase-demo.js` maneja cliente, sesión, `requireAuth`, lectura de vistas y suscripciones.
- Los dashboards muestran un badge que diferencia Supabase, mock/vacío y error.
- Las superficies de inspección escuchan cambios Realtime sin resetear la navegación del usuario.

## Operaciones de taller

Las escrituras complejas no se hacen como varias llamadas desde el navegador. Los RPCs del 12 de julio validan rol, posición libre e invariantes dentro de una transacción. Si una parte falla, no debe quedar medio retiro o media instalación.

- Instalar: crea/resuelve casco y ciclo y abre instalación.
- Retirar: cierra instalación con motivo y fuente de odómetro.
- Transferir: cierra origen y abre destino atómicamente.

La pestaña web ya no confirma movimientos físicos. El flujo activo es:

1. Leer el diagrama completo desde `v_unit_position_state`.
2. Mantener un borrador local con fecha, instrucción, dirección, posición y razón humana.
3. Modelar una rotación como salida `rotation` del origen más entrada en el destino.
4. Emitir una sola orden con `create_tire_movement_order`.
5. Seguir `issued → in_progress → completed` desde `v_operator_movement_orders` y mostrar los
   renglones de `tire_movement_executions` capturados por el operario.

La empresa se deriva del perfil autenticado y la RPC acepta `tire_supervisor`, `fleet_manager`
histórico o `admin`. El operario
es el único que captura la lectura de máquina y los datos técnicos al completar la orden.

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

Los antiguos módulos de lote directo, primer montaje, inventario y foto siguen versionados como
historial y conservan sus pruebas, pero `movimientos-controller.js` ya no los importa. Por tanto,
`confirm_tire_change_batch` y `confirm_baseline_mount` no son alcanzables desde la pestaña normal
del supervisor.

## Rutas

La ruta es temporal, no un texto fijo en `units`. `unit_route_assignments` conserva vigencia desde/hasta; `v_installation_route_attribution` atribuye rendimiento según solapamiento temporal.

## Regla de evolución

Los HTML nacieron como prototipos con mocks y algunas fórmulas duplicadas. El destino es presentación fina sobre vistas/RPCs auditados. No eliminar fallbacks ni cálculos viejos hasta demostrar paridad y luego hacerlo en un cambio explícito.
