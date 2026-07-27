---
title: "Roadmap, deuda y riesgos"
updated: 2026-07-26
status: vigente
sources: [tasks_opencode/STATE.md, specs, decisions, docs/run6_known_limits.md, code audit 2026-07-12, tasks_buscador_global/AUDIT.md, tasks_buscador_global/STATE.md, tasks_filtros_facetados/REVISION_FINAL.md, tasks_servicios/REVISION_FINAL.md, tasks_servicios/PRUEBA_CAMPO.md, decisions/0007-definicion-de-servicio-ejecutado.md, decisions/0008-servicio-por-posicion-atendida.md, tasks_servicios/FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md]
---

# Roadmap, deuda y riesgos

## Prioridad inmediata

1. Validar E2E las migraciones/UI vigentes del 12 de julio: taller y rutas.
2. Cerrar el paquete de calidad de task 18: probar `pushInspeccion` directamente, decidir/implementar partición de bundles y verificar build.
3. Corregir la documentación histórica solo mediante notas de auditoría; no reescribir la bitácora como si nunca hubiera existido.
4. Probar APK en dispositivo real: SQLite nativo, cámara, pérdida/recuperación de red y cierre del día.

## Deuda activa conocida

El inventario operativo completo, prioridad y condición de cierre están en
`deuda_tecnica/00-inventario.md`. Esta nota conserva el resumen canónico y las
fuentes de evidencia.

- La app móvil de inspecciones opera como `anon`, sin identidad de inspector. La app separada
  de movimientos ya exige Auth y distingue `operator` de `tire_supervisor`.
- `drainQueue` no agenda un despertar autónomo al vencer backoff.
- Precargar desde Supabase reencola datos espejo y puede hacer un push redundante.
- `rtd_removal_mm` se mapea al snapshot `rtd_normal`, conceptos distintos aunque hoy no afecte vistas.
- Backfill de `isa_peso_snap` omite algunas filas legacy sin RTD.
- `umbral_presion` local (SQLite) existe pero no participa del flujo; la regla remota vive en
  `pressure_thresholds` desde ADR-0009.
- Pull/versionado/borrado de catálogos no está completo.
- `vite.config.ts` no tiene `manualChunks`; el punto de task 18 sigue abierto.
- Hay documentos run/STATE con afirmaciones vencidas.
- Las acciones históricas de reinstalar/reencauchar desde Inventario y la pantalla Comparativo
  siguen retiradas; no deben reaparecer al mantener la nueva consulta Retén/Descartados.
- La pantalla nueva de Inventario necesita completar el smoke autenticado de campo y aislamiento
  entre empresas; la suite local no sustituye esa verificación.
- **Variantes de caja en `brand_name`** (medición 2026-07-19, `AUDIT.md` §5.2): `GOODYEAR`/
  `goodyear`, `HANKOOK`/`hankook`, `BRIDGESTONE`/`Bridgestone` — 13 de 2 247 mediciones (~0.6 %). No
  afecta al buscador (`normalizeSearchText` colapsa las variantes), pero sí parte marcas en filas
  separadas en `v_rendimiento_dashboard_rows`. Remedio: `upper(trim())` en la RPC de escritura +
  backfill; sin tablas de catálogo. Idealmente antes del baseline de las 2 096 posiciones (hoy 36
  cascos con esta suciedad, después ~3 800). `size_name` se midió limpio y canónico — no es deuda.
- **`QA-TEST` en producción**: 9 cascos y 14 mediciones de datos de prueba (unidad `QA-CN16`,
  empresa MÓVIL BUS, decisión operativa 2026-07-14 — ver [[12 - Decisiones e historia]]) mezclados
  con datos reales, contaminando agregaciones. Requiere decisión humana explícita; no se propone
  borrado de oficio. Servicios **no** los filtra (D8): cualquier patrón inventado —prefijo de placa,
  nombre de empresa, unidad `QA-CN16`— es una adivinanza que puede ocultar datos reales, y esconder
  filas en una vista hace que el problema deje de verse sin dejar de contaminar. Lo correcto es
  borrarlos o marcarlos con una columna real (`is_test`, `environment`). Mitigación disponible: la
  faceta `unidad` permite aislarlos a mano.
- Identidad de cascos sin código: no tienen historial alcanzable
  (`historial-neumatico.html` filtra por `code=eq.`); el buscador enruta a la unidad en su lugar.
  Resolverlo de raíz exige una fase de identidad de cascos separada
  (`tasks_puesta_en_marcha_movimientos/REVISION_FINAL.md:512` ya registra ~316 neumáticos afectados).
- Navegación duplicada a mano en los 7 HTML del dashboard (barra, atajo, enlaces) en vez de un
  componente compartido — quedó así tras `tasks_buscador_global/task_07` y se amplió con
  Servicios (`tasks_servicios` D12), sin corregir. Unificar el shell es una fase propia: mezclarla
  con funcionalidad nueva contamina el rollback de ambas.
- **Esquema de Rendimiento parcialmente consolidado**: desde 2026-07-26 las fórmulas vigentes y las
  columnas de inspección anterior tienen migraciones locales; `schema_draft.sql` aún está
  desactualizado. Ambas vistas conservan `security_invoker` y solo `authenticated/SELECT`.
- **Consumo por ventana no disponible**: 2.183/2.247 mediciones carecen de `life_cycle_id`; al
  2026-07-19 hubo 0 cascos calculables en 30/60 días y 4/24 en 90 días. Mejorar cadencia/enlace antes
  de volver a ofrecer la capacidad; no aproximar con la última inspección.
- **Tendencias y comparación temporal de Rendimiento** (decisión 2026-07-23): el rediseño puede
  adoptar ahora KPIs agregados y una tabla sin sparklines ni “vs. mes anterior”. Esas señales
  requieren varias mediciones comparables del mismo casco/ciclo, fechas y odómetros confiables, y
  suficiente cobertura dentro de dos ventanas equivalentes. No dibujar líneas con un solo punto,
  repetir el último valor ni convertir la diferencia entre neumáticos en una falsa tendencia
  temporal. Reabrir cuando la vinculación `life_cycle_id` y la cadencia real permitan definir un
  mínimo de muestras; entonces resolverlo en una vista/RPC agregada para evitar una consulta por
  neumático, mostrar el período comparado y conservar “datos insuficientes” cuando no se cumpla el
  mínimo.
- El umbral de frescura de Rendimiento vive como constante única de 30 días; falta exponer una
  configuración por empresa sin repartir el número por componentes.
- **Tasa por vida/ciclo actual — resuelta 2026-07-26.** Rendimiento usa
  `km acumulado del ciclo / (OTD − RTD actual)`. Rotaciones, retén y traslados conservan ambos
  acumulados; un reencauche abre una vida nueva. `casing_km_accumulated`, que suma todas las vidas,
  queda reservado para Historial de neumático. La suma del ciclo usa
  `bool_and(km_run is not null)`: si falta cualquier tramo devuelve `NULL` en vez de publicar un
  total parcial. Así vuelve a cumplirse `km ciclo + VUR = km proyectado`.
- **Identidad de neumático desincronizada entre inspección y `tire_installations`** (confirmado
  2026-07-22, consulta directa a Supabase): la última inspección puede capturar un neumático
  distinto (código, marca, medida, diseño de reencauche) al del ciclo de vida activo, sin que
  exista movimiento (`tire_movement_executions`) ni remontaje (`baseline_mount_batches`) que lo
  explique. Caso: unidad `225` (MÓVIL BUS), posición 3, mismo `life_cycle_id`
  (`2ec374d2-9381-5259-8905-41e8032b59d7`) — inspección 2026-05-07 registra MICHELIN 241088 /
  IZE2W; inspección 2026-07-06 registra HANKOOK 241679 / DV-RM 258. Cero filas en
  `tire_movement_executions` y cero en `baseline_mount_batches` para esa unidad. Efecto:
  `v_rendimiento_dashboard_rows` (alimentada por `tire_installations`) sigue exponiendo el
  neumático viejo, y la faceta de reencauche de Rendimiento nunca ofrece el diseño realmente
  vigente. Es más estrecho que el reconciliador ya pendiente (ver Decisiones bloqueantes): acá no
  hay ni siquiera un movimiento que reconciliar — la inspección detectó el cambio físico y nada lo
  propagó a instalación/ciclo. Desde 2026-07-26 Rendimiento detecta el RTD creciente, excluye la
  fila del KPI y declara si parece cambio sin registrar, medición o ausencia de código. No se
  propone remedio automático: decidir si la app debe forzar un
  remontaje/movimiento cuando la identidad capturada en inspección difiere de la instalación
  activa, o si la reconciliación sigue siendo manual.
- La fase de filtros conserva pendiente su smoke humano autenticado en móvil/escritorio y el
  aislamiento visual entre dos empresas; 260 pruebas locales no sustituyen esa evidencia.

### Deuda arquitectónica futura — posible migración de dashboards a React (2026-07-23)

Esta deuda queda **registrada, pero fuera del alcance actual**. No autoriza migrar, preparar una
migración ni introducir React en `WEB/` mientras se mejora la interfaz existente.

- La aplicación de campo en `app/` ya usa React/TypeScript y tiene responsabilidades offline,
  captura y sincronización. Los dashboards de supervisión en `WEB/` son HTML, CSS y JavaScript
  modular desplegados como una superficie estática aparte. No se deben fusionar por conveniencia
  técnica: atienden contextos operativos diferentes.
- React no es requisito para alcanzar una interfaz visual de alta calidad. La mejora vigente debe
  hacerse sobre la arquitectura actual, conservando URLs, cálculos, contratos de datos, pruebas,
  accesibilidad y despliegue.
- El beneficio potencial de React sería de mantenibilidad —shell, encabezados, filtros, tablas,
  paneles de detalle y estados reutilizables—, no de capacidad gráfica. También puede empeorar
  bundle, rendimiento y acoplamiento si se mezcla con la app offline o se migra todo de una vez.
- Reabrir esta evaluación solo cuando la duplicación de UI o la complejidad interactiva haga
  objetivamente costoso evolucionar `WEB/`. Debe existir una fase explícita con ADR, presupuesto de
  regresión y comparación de rendimiento; no iniciarla solo por preferencia de framework.
- Si se aprueba en el futuro, usar migración gradual por rutas, con una pantalla de solo lectura
  como piloto, paridad de datos y URLs, ejecución paralela y rollback. No combinar en una misma
  fase el rediseño visual y el cambio de framework, ni retirar una pantalla HTML antes de demostrar
  paridad funcional, visual, accesible y de rendimiento.
- La evaluación futura debe decidir si los dashboards viven en una aplicación React web separada
  o comparten únicamente tokens, tipos y reglas con `app/`. Incorporarlos directamente a la app de
  campo no es la opción predeterminada.

### Deuda abierta por la fase Servicios (2026-07-21)

- **La alineación `sequence ↔ request_items` es propiedad del cliente, no invariante del esquema.**
  `complete_tire_movement_order` no valida que `p_items` tenga la misma longitud que `request_items`;
  la cadena actual preserva orden y cardinalidad, pero un cliente futuro puede romperla en silencio.
  Mitigación propuesta: **`request_item_index` escrito por la RPC**, que convierte el pareo en dato
  y elimina el nivel 2 inferido de `v_tire_services`. **Sigue viva tras ADR-0008**: la fase del
  servicio pareado no tocó la RPC a propósito, para no dejar a los operarios sin poder cerrar órdenes
  con un APK que no supiera satisfacer la validación nueva. Queda nombrada en
  `tasks_servicios/FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md` §4.
- **`reconciliation_status` sigue `pending` al 100 %**: no existe reconciliador entre
  `tire_movement_executions` y casco/ciclo/instalación. Consecuencia directa: Servicios mide
  actividad declarada, no consumo ni vida útil. Se expone como faceta para no aparentar completitud.
  ADR-0008 dejó claro que **es el mismo problema que el origen externo**: saber si un neumático que
  entra viene de retén, de reparación o es nuevo exige el historial del casco, o sea la misma
  consulta mirada desde el otro lado. Hacerlas por separado sería trabajo duplicado.
- **`tire_movement_executions` no está en la publicación `supabase_realtime`.** Medido en campo el
  2026-07-21 (`tasks_servicios/PRUEBA_CAMPO.md` punto 17): cinco pestañas autenticadas conservaron 0
  filas tras cerrar una orden, mientras una consulta directa desde esas mismas sesiones ya devolvía
  1; `pg_publication_tables` confirma que la publicación solo incluye `inspections` e
  `inspection_measurements`. **Mitigado en cliente el 2026-07-22:** Servicios conserva la
  suscripción y además hace una lectura silenciosa al volver a la pestaña y cada 10 segundos mientras
  está visible. Ya no exige recarga manual ni parpadea durante el sondeo. La deuda restante es de
  infraestructura/latencia: publicar la tabla permitiría volver al evento inmediato y retirar el
  polling, pero ya no bloquea la demo.
- **Límite de 2.000 filas sin paginación** en Servicios (`SERVICES_FETCH_LIMIT`), con banner visible
  cuando la respuesta lo llena. Con ~500 unidades en uso sostenido el banner empezará a aparecer: ese
  es el momento de implementar paginación por cursor o ventana temporal, diseñada y no implementada.
- **`casing_exists` con posible falso negativo por caja**: la comprobación no aplica `upper()`, así
  que un código de casco con grafía distinta puede mostrarse como `SIN HISTORIAL` teniendo historia.
  Mismo origen que la deuda de variantes de caja en `brand_name`.

### Deuda abierta por la fase Servicio pareado (2026-07-22)

- **La ausencia de reemplazo es una convención de payload, no un dato.** Una salida que deja la
  posición vacía a propósito se declara con la clave `without_entry` dentro del ítem de
  `request_items`; viaja porque `create_tire_movement_order` ignora las claves extra. Funciona y es
  explícita, pero nada en el esquema la conoce ni la valida. Remedio: columna propia cuando se abra
  la fase que toque la RPC. Ver ADR-0008 §6.
- **El origen externo del neumático que entra queda indeterminado.** `entry_origin_position` solo
  resuelve dentro de la misma orden. Si el casco viene de retén, de reparación o es nuevo, la
  pantalla muestra `ORIGEN NO DETERMINADO`. La medida de cuánto importa es cuántas entradas quedan
  así en uso real: ese número es el disparador de
  `tasks_servicios/FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`, y hoy no se ha medido en producción.
- **Las filas heredadas del modelo anterior no parean.** La rotación capturada como `exit@P3` +
  `entry@P7` (mismo casco) produce una salida `not_paired` más una `installation`. Es fiel a cómo se
  capturó y **no se le inventa un par**; pero convive con el modelo nuevo y cualquier serie que cruce
  ambos períodos no es comparable.
- **Sin `sync-migration-reviewer` sobre la migración de la vista.** `20260722090000_tire_services_view_pairing.sql`
  se aplicó tras verificación manual —`security_invoker`, grants, duplicados, aislamiento, y un
  `SELECT` de solo lectura contra producción antes de aplicar— pero sin la revisión formal que pide
  `CLAUDE.md`. Pendiente de correr.
- **Smoke autenticado cerrado el 2026-07-22.** `task_12` ejecutó sobre MÓVIL BUS 2145 una
  rotación P3↔P4 de 2 servicios/4 ejecuciones y un scrap con reemplazo. La app ahora agrupa cada
  servicio en «sale» + «entra» con origen visible. Resultado: 2 servicios de rotación con
  origen cruzado exacto, 1 scrap sin instalación fantasma y refresco visible sin reload en menos de
  8 s. La deuda que permanece es la reconciliación: las ejecuciones quedan en `pending`.

### Correcciones cerradas para la demo (2026-07-22)

- El bundle estático ya incluye `renova-animate.js` y `renova-format.js`; Inspecciones, Rendimiento
  e Historial cargan desde `deploy-static/` sin errores de recursos propios.
- Servicios incorpora el fallback de refresco visible descrito arriba, con pruebas unitarias y
  smoke de navegador sin escritura remota.

- **Rendimiento de Supabase post-saneamiento**: el índice candidato para el historial de servicios
  es `tire_movement_executions (company_id, captured_at desc, sequence)`, pero no se aplicará con
  `QA-TEST` y variantes de marca mezclados en producción. La fase, condiciones de entrada y
  verificaciones están en `deuda_tecnica/01-saneamiento-y-performance-supabase.md`.

## Decisiones bloqueantes

- Regla de presión CALIENTE.
- Definición canónica de `% DESGASTE`.
- Estrategia final de login/sesión offline para inspectores.
- Crear y provisionar cuentas reales `tire_supervisor` por empresa; la pantalla web de emisión y
  seguimiento ya está implementada.
- Reconciliador de `tire_movement_executions` pendientes contra casco/ciclo/instalación, después
  de importar la línea base masiva por empresa.
- Versionado y eliminación segura de catálogo.
- Criterio de “producto listo” para taller/rutas, más allá de que exista SQL/UI.
- Flujo de creación del ciclo siguiente tras un retiro por reencauche; el RPC actual solo cierra el ciclo saliente.

## Evolución prevista

- Consola administrativa de empresas, perfiles, umbrales y catálogos.
- Reporte Excel canónico generado desde datos/vistas de servidor.
- Imports auditables por lote con errores por fila.
- Más tipos/configuraciones de vehículo tras validar buses.
- Analytics sobre series de casco/ciclo/instalación sin alterar tablas de hechos.
- Materialized views solo si las vistas se vuelven lentas y la medición lo justifica.
- **Selector de widgets para Rendimiento** (idea explorada 2026-07-23, sin decisión ni diseño): al
  revisar Fleetio, MWM y TrackObit como referencia de dashboards de flota, ningún lenguaje visual
  convenció (el de Fleetio en particular es SaaS genérico, blanco, iconos redondeados — no encaja
  con el sistema visual de RENOVA). Lo aprovechable no es el estilo sino el patrón de interacción:
  Fleetio deja activar/desactivar qué tarjetas-métrica se muestran, reordenarlas y guardar vistas
  distintas por rol (operador vs. dueño de flota). Rendimiento ya es un conjunto de tarjetas-métrica
  (KM/mm, consumo, costo/km, KM acumulado…), así que encaja como candidato natural: un panel
  "agregar widget" con métricas por categoría, reordenar/ocultar, y vistas guardadas por rol.
  Pendiente antes de convertirlo en fase: decidir si aplica solo a Rendimiento o a otras pantallas,
  y si las vistas guardadas necesitan persistencia por usuario o alcanza con `localStorage`.

## Riesgos que ameritan test

- Borrado local sin confirmación remota.
- Dos ediciones mientras hay push en vuelo.
- Mezcla de empresas por grants/RLS/vistas sin `security_invoker`.
- Fórmulas distintas entre app, SQL y HTML.
- Operación de taller que deja intervalos abiertos o dos neumáticos en una posición.
- Datos legacy sin cola/snapshots.
