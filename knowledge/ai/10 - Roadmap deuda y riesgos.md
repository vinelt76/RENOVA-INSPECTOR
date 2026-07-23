---
title: "Roadmap, deuda y riesgos"
updated: 2026-07-22
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
- `umbral_presion` local existe pero no participa del flujo.
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
- Bundle estático (`scripts/prepare-static-hosting.mjs`): la allowlist omite `renova-animate.js` y
  `renova-format.js`, hallazgo preexistente detectado en `tasks_buscador_global/task_07`, no
  corregido en esta fase.
- **Esquema de Rendimiento fuera de la cadena local**: `v_tire_performance` y la columna remota
  `last_inspection_on` de `v_rendimiento_dashboard_rows` no tienen una migración local fiel;
  `schema_draft.sql` está desactualizado.
- **Grant amplio de Rendimiento**: `v_rendimiento_dashboard_rows` conserva acceso para `anon`,
  divergente de `v_search_index` (solo `authenticated`). Revisarlo en una fase de seguridad propia,
  no escondido dentro de una migración funcional.
- **Consumo por ventana no disponible**: 2.183/2.247 mediciones carecen de `life_cycle_id`; al
  2026-07-19 hubo 0 cascos calculables en 30/60 días y 4/24 en 90 días. Mejorar cadencia/enlace antes
  de volver a ofrecer la capacidad; no aproximar con la última inspección.
- El umbral de frescura de Rendimiento vive como constante única de 30 días; falta exponer una
  configuración por empresa sin repartir el número por componentes.
- La fase de filtros conserva pendiente su smoke humano autenticado en móvil/escritorio y el
  aislamiento visual entre dos empresas; 260 pruebas locales no sustituyen esa evidencia.
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
  `inspection_measurements`. **Servicios refleja los cambios solo al recargar.** No bloquea la
  definición de terminado de la fase (`tasks_servicios/PLAN.md` §10 no la exige) y se aceptó como
  deuda por decisión humana en vez de ampliar el esquema dentro de una fase funcional. Remedio:
  migración propia que publique la tabla, o un fallback explícito de refresco en cliente. Afecta
  también a cualquier otra superficie que suscriba esa tabla.
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
- **Falta el smoke autenticado de la fase.** La lógica está verificada en SQL y con Vitest, pero
  nadie emitió y ejecutó una orden real de punta a punta. Es `task_12`, sin ejecutar.

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

## Riesgos que ameritan test

- Borrado local sin confirmación remota.
- Dos ediciones mientras hay push en vuelo.
- Mezcla de empresas por grants/RLS/vistas sin `security_invoker`.
- Fórmulas distintas entre app, SQL y HTML.
- Operación de taller que deja intervalos abiertos o dos neumáticos en una posición.
- Datos legacy sin cola/snapshots.
