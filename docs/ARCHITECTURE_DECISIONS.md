# RENOVA INSPECTOR — Decisiones de Arquitectura

Este documento explica el **porqué** de cada decisión estructural del sistema — no qué tablas
existen (eso está en `run2_tire_lifecycle_architecture.md` y en los SQL), sino qué problema
resuelve cada elección y qué pasaría si se decidiera lo contrario.

Complementa los ADRs de `decisions/` (tenancy, paridad de cálculo, JWT offline, catálogo) y las
reglas inamovibles de `CLAUDE.md`.

---

## 1. El frontend debe terminar siendo capa de presentación, no dueño de la lógica

**Hoy** las fórmulas de rendimiento viven dentro de `rendimiento.html`, `vista-flota.html` y el
panel de taller: cada HTML tiene su copia de `computeTire()`, su copia del semáforo, sus
umbrales. Eso fue correcto para prototipar rápido con mocks, pero como estado final tiene tres
problemas concretos:

1. **Divergencia inevitable.** Ya ocurrió: `vista-flota.html` hardcodea 4/8 mm mientras la regla
   de negocio dice "umbral configurable por empresa y medida". Tres copias de una fórmula son
   tres oportunidades de que un cliente vea números distintos en dos pantallas.
2. **Cada consumidor nuevo paga el costo completo.** Un reporte Excel, una app de supervisores o
   un dashboard nuevo tendrían que reimplementar (y re-testear) todas las fórmulas.
3. **No hay auditoría.** Si el número sale de un `<script>` en el navegador del jefe de flota,
   nadie puede reproducir después por qué ese día el sistema dijo 0,0269/km.

La transición es deliberadamente gradual: los HTML conservan sus fórmulas como referencia visual
y fallback hasta que las vistas SQL estén auditadas contra ellas (paridad, igual que
calculations.ts ↔ calculations.py). Recién entonces el frontend queda en lo único que le
corresponde: formato, color, interacción.

**Excepción permanente:** los cálculos de captura (RTD MOVI, IDI, ESTADO RTD, DESECHO) se quedan
TAMBIÉN en el dispositivo, porque el inspector necesita el semáforo al instante y sin señal.
Offline-first manda; el servidor recibe esos valores calculados (fase 1) y a futuro los verifica,
no los reemplaza.

## 2. Supabase como fuente de verdad

El SQLite del teléfono es la verdad *transitoria* de UN dispositivo; Supabase es la verdad
*consolidada* de la operación. La distinción importa porque:

- **Los dashboards son multi-unidad y multi-inspector.** El jefe de flota necesita ver 30
  unidades inspeccionadas por varios teléfonos: eso solo existe agregado en el servidor.
- **El teléfono es descartable; la historia no.** Un dispositivo perdido o reseteado no puede
  llevarse los datos de 6 meses. El push del `sync_queue` convierte cada captura local en un
  hecho durable.
- **Una sola verdad evita la reconciliación artesanal** que hoy hace el Excel: la misma fila que
  subió el inspector es la que lee el dashboard, el reporte y el análisis histórico.

La app sigue siendo offline-first sin contradicción: SQLite es el buffer de escritura y la copia
de trabajo; Supabase es el registro. El conflicto se resuelve con last-write-wins por
`updated_at` porque cada inspector trabaja sobre cabeceras con UUID propio de su dispositivo —
colisiones reales no existen en este dominio (task_14).

## 3. Reglas de negocio en SQL (y a futuro Edge Functions), no en HTML

Cuando la fórmula vive en la base de datos:

- **Se escribe una vez y la leen todos** (dashboard, Excel futuro, API, IA futura).
- **Versiona con el esquema**: un `create or replace view` en una migración es un cambio de regla
  auditado, con fecha y diff; un edit en un `<script>` es invisible.
- **Opera sobre el conjunto completo**: "% de flota en riesgo" o "costo/km de por vida del casco"
  son agregaciones que el navegador no puede (ni debe) computar trayéndose toda la historia.

Criterio de ubicación (del inventario Run 1):
- **Vista SQL**: todo lo derivable por consulta (rendimiento, balance de eje, estado de flota,
  ISA, cumplimiento). Es la opción por defecto — declarativa, testeable, sin estado.
- **Función SQL/trigger**: efectos de eventos (cerrar instalación al registrar retiro, cascada
  de descarte ciclo→casco). Cosas que deben pasar atómicamente con el INSERT.
- **Edge Function**: solo cuando haga falta salir de SQL (generar Excel, notificar, integrar).
  Ninguna en el MVP — no inventar infraestructura antes de necesitarla.
- **Dispositivo**: los cálculos de captura en vivo (§1).

## 4. La inspección es la fuente primaria de datos operativos

Todo el valor del sistema nace de un evento: *un inspector midió esta posición de esta unidad
este día*. Las demás entidades existen para dar contexto a ese evento (quién es el casco, en qué
ciclo va, desde cuándo está montado). De ahí dos consecuencias de diseño:

- **Las inspecciones son inmutables-por-defecto y jamás se pierden**: son el registro histórico
  contra el que se calcula cualquier métrica pasada o futura. Por eso llegan con UUID del
  dispositivo, se upsertean idempotentemente y nunca se reescriben desde derivados.
- **Los datos que faltan se degradan con gracia**: si una instalación no tiene km de retiro, la
  última inspección lo suple (§7). El sistema está diseñado para que "más inspecciones" mejore
  la precisión de todo lo demás — la inspección es el sensor del sistema.

## 5. La instalación define el punto 0 del rendimiento

"¿Cuánto rinde este neumático?" solo tiene sentido desde un punto de partida medible:
`odometer_at_install` y `rtd_at_install_mm`. Sin ese ancla, Km Recorrido y Km/mm son
adivinanzas (el mock de Run 1 lo demostraba: `kmInstalacion` era el dato fuente que nadie
capturaba). Anclar el rendimiento a la instalación además:

- separa el rendimiento del neumático del odómetro absoluto del bus (que trae historia previa);
- permite comparar posiciones (P3 vs P4) porque comparten ventana temporal;
- hace que una rotación no contamine la medición: cada instalación mide su propio tramo.

## 6. El retiro cierra la instalación

Una instalación sin cierre explícito es un intervalo abierto que acumula km de un neumático que
ya no está ahí. El evento `tire_removals` (1:1 con su instalación, `installation_id UNIQUE`)
convierte el intervalo en cerrado: desde ese momento el km de la instalación queda congelado y
el ciclo puede continuar en otra posición, ir a reencauche o morir. Los índices parciales
(`WHERE NOT removed`) usan ese cierre para garantizar en la base — no en la disciplina del
usuario — que no haya dos neumáticos activos en la misma posición ni un ciclo montado en dos
lugares.

## 7. El km de retiro puede usar la última inspección como fallback

Realidad de taller: el desmontaje ocurre con apuro, de noche, y el odómetro no siempre se anota.
Prohibir el retiro sin km sería inventar fricción (y datos falsos: alguien tipearía cualquier
cosa para poder avanzar). En cambio:

1. km manual si existe (`odometer_source='manual'`),
2. si no, el odómetro de la **última inspección** de esa instalación (`'last_inspection'`) —
   dato real, apenas anterior, con error acotado por la frecuencia de inspección;
3. si tampoco hay, `'unknown'` y el km queda NULL — **el sistema prefiere decir "no sé" antes
   que inventar un 0** que envenene los promedios.

Guardar el *origen* del dato es tan importante como el dato: permite auditar qué % de los km de
la flota es medido vs estimado, y mejorar el proceso donde duela.

## 8. Por qué casco ≠ ciclo de vida ≠ instalación ≠ inspección

La tentación era una tabla `tires` con todo (así estaba en el borrador Run 1). Se separó en
cuatro porque cada nivel tiene **dueños de datos distintos y ciclos de vida distintos**:

- **Casco**: la identidad no cambia nunca (código de fuego, carcasa). Si el casco fuera
  "el neumático", al reencaucharlo habría que elegir entre pisar el OTD/costo del ciclo anterior
  (perder historia) o duplicar la fila (perder identidad). Ambas opciones destruyen la métrica
  más valiosa del negocio: la vida completa del casco.
- **Ciclo**: el OTD pertenece a la banda (16 mm nuevo, 14 mm el R1), el costo pertenece a la
  banda (1600 el nuevo, 500 el reencauche), el % de consumo se mide contra la banda. Un "km del
  neumático" sin ciclo mezclaría bandas distintas en un mismo denominador.
- **Instalación**: el mismo ciclo puede rodar en P3 del bus A y luego en P5 del bus B. El
  rendimiento por posición (balance de eje, comparativa P3 vs P4) solo existe a este nivel.
- **Inspección**: es el evento medido; pertenece a la unidad y a la fecha, no al neumático
  (el inspector mide posiciones sin saber de ciclos). Vincularla rígidamente al neumático
  habría acoplado la captura de campo al estado del taller — la app dejaría de funcionar cuando
  el inventario estuviera desactualizado. La unión instalación↔inspección por (unidad, posición,
  ventana temporal) tolera ese desorden real.

## 9. Km del ciclo vs km de vida del casco: métricas distintas a propósito

- **Km del ciclo** responde: *¿cuánto rindió ESTA banda?* — evalúa al reencauchador, al diseño
  de banda, a la posición. Se resetea a 0 con cada reencauche porque la banda es nueva.
- **Km de vida del casco** responde: *¿valió la pena este casco?* — evalúa la decisión de compra
  y la política de reencauche. Nunca se resetea.

El seed de la demo lo hace tangible: CAS-003 lleva 30.000 km de su ciclo R1 pero 78.000 km de
vida, y su costo/km de por vida (0,0269) es mejor que el de cualquier neumático nuevo de la
unidad (0,0467–0,0533). Con una sola métrica de km, ese argumento — la razón económica del
reencauche — sería incalculable.

## 10. Las métricas derivadas no se almacenan a mano

Todo lo que se puede calcular desde eventos (km recorridos, km ciclo, km casco, km/mm, %
consumo, proyecciones, costo/km) vive SOLO en vistas. Razones:

- **Una corrección repara todo**: si el odómetro de una inspección estaba mal tipeado, un UPDATE
  de esa fila recalcula automáticamente instalación, ciclo, casco y dashboards. Con columnas
  precalculadas habría que perseguir cada copia (el bug clásico del Excel actual).
- **No hay "verdad doble"**: nunca puede pasar que `cycle_km` diga 30.000 y la suma de
  instalaciones diga 29.000.
- **El esquema documenta qué es hecho y qué es opinión**: tabla = hecho capturado;
  vista = interpretación calculada.

Excepciones explícitas y acotadas: (a) los derivados de captura (`rtd_movi_mm`, `rtd_state`, …)
se persisten porque son el resultado del dispositivo en el momento de la medición con los
umbrales vigentes — son parte del hecho histórico, no un cache; (b) `units.last_odometer` es un
cache de UX documentado como tal. Si algún día una vista es lenta, la respuesta es materializar
(refresh controlado), no volver a columnas manuales.

**Se calculan dinámicamente:** km instalación/ciclo/casco, km/mm, % consumo, km proyectado,
costo/km (ciclo y vida), balance de eje, estado de flota, ISA, cumplimiento de presión,
distribución de estados, tasa de desgaste y VUR (Run 3+).

**Son fuente de verdad (hechos capturados):** inspecciones y mediciones (con sus derivados de
dispositivo), instalaciones, retiros (+origen del odómetro), ciclos (OTD/costo/estado), cascos,
unidades, umbrales configurados, catálogo PATRON.

## 11. Qué no se hardcodea jamás, qué es siempre configurable

**Prohibido hardcodear** (cada uno ya causó o casi causa un bug real):
- Umbrales RTD 4/7/8 — están en `rtd_thresholds` por empresa+medida; el 4/7 del cliente actual
  es deuda documentada, y el 4/8 de `vista-flota.html` es exactamente el error que este esquema
  elimina.
- Deltas de presión ±5/±10 % y referencias por medida/eje — `pressure_thresholds`.
- El 15 % de desbalance de eje — `axle_balance_thresholds` (el propio HTML lo declara
  "pendiente de definir con RENOVA").
- Pesos ISA 5/1 — `isa_weights`.
- Listas de catálogo (anomalías, válvulas, diseños, configuraciones) — tablas, nunca arrays en
  componentes (regla CLAUDE.md).
- **Las 5 empresas actuales** — son filas. Cualquier `if empresa == 'movil'` es un bug.
- La referencia de presión en CALIENTE — no existe todavía; la columna `hot_psi` espera NULL.
  Hardcodear un valor "típico de la industria" está explícitamente vetado.
- Número de posiciones/canales por vehículo — sale de `vehicle_configs`/`axles`, no de
  constantes (la app ya lo hace bien: `requiresR4` lee el tipo de eje del catálogo).

**Siempre configurable por empresa** (y donde aplique, por medida y tipo de eje): todos los
umbrales anteriores, el RTD de retiro recomendado, la moneda, y a futuro el máximo de
reencauches por casco (pregunta abierta #9 de Run 1).

## 12. Futuro contemplado en el diseño presente

Decisiones tomadas hoy cuyo beneficiario es un requisito de mañana:

- **Más empresas** → tenancy por `company_id` en cada tabla + `import_batches` para altas
  masivas; RLS por empresa diseñada desde el ADR 0001.
- **Imports repetidos de Excel** → `import_batches`/`import_errors` con `raw_data jsonb` por
  fila fallida: re-importar es re-procesar un lote, no un script artesanal por cliente.
- **Flotas grandes** → uuids, índices por (unidad, fecha) y (ciclo), vistas que agregan
  server-side; nada en el diseño asume "pocas filas".
- **Análisis histórico largo** → inspecciones inmutables + eventos con fecha + orígenes de datos
  (`odometer_source`): se puede reconstruir el estado de la flota en cualquier fecha pasada.
- **Dashboards adicionales** → cualquier consumidor nuevo lee las mismas vistas; no hereda
  fórmulas de un HTML.
- **Multi-dispositivo por empresa** → UUIDs de dispositivo + LWW ya lo soportan; la unicidad
  (inspección, posición) es la única zona a revisar cuando dos teléfonos inspeccionen la misma
  unidad el mismo día (documentado en `run2_sync_payload_mapping.md`).

---

## Future Evolution

Cómo escala esta arquitectura **sin rediseñar la base**:

**Miles de neumáticos y cascos.** El modelo es O(filas), no O(estructura): más cascos son más
filas en las mismas 4 tablas. Los índices ya existentes (casco→ciclos, ciclo→instalaciones,
unidad+posición, unidad+fecha) mantienen las consultas acotadas. Primer paso si una vista se
vuelve lenta: `materialized view` con refresh tras el sync — cambia el plan físico, no el
contrato lógico que consumen los dashboards.

**Muchas empresas.** Agregar la empresa N es: fila en `companies` + import batch + usuarios en
`profiles`. La RLS por `company_id` convierte el aislamiento en política declarativa; no hay
esquema-por-cliente que administrar ni migraciones por tenant. Si una empresa gigante lo
exigiera, el mismo modelo soporta particionar tablas de eventos por `company_id` — transparente
para las vistas.

**Reencauches repetidos.** R3, R4, R5… son solo `cycle_number` crecientes; el enum
`tire_condition` se extiende con un `ALTER TYPE … ADD VALUE` (o se migra a tabla de catálogo si
las empresas definen condiciones propias). La métrica de vida del casco ya suma N ciclos sin
tocar una línea.

**Análisis histórico profundo.** Como los hechos son eventos fechados e inmutables, cualquier
pregunta retrospectiva es una consulta: curva de desgaste de un diseño de banda, vida promedio
por marca antes del primer reencauche, % de retiros prematuros por causa, comparativa
reencauchador A vs B. Nada de eso requiere columnas nuevas — requiere vistas nuevas sobre los
mismos eventos. Si el volumen histórico crece años, la ruta es archivar particiones frías, no
remodelar.

**Dashboards adicionales.** Rendimiento por eje, flota multi-fecha, panel de taller con
inventario, reporte Excel por empresa: todos son consumidores de vistas existentes o nuevas
(`v_axle_performance` y `v_fleet_status` ya están bosquejadas en `schema_draft.sql`). El patrón
fetch-con-fallback-a-mock (`run2_dashboard_connection_plan.md`) permite conectar cada superficie
de forma independiente y reversible.

**Módulos de IA/analytics.** El requisito de la IA es el que este diseño ya cumple: datos
etiquetados, con linaje y sin derivados contaminados. Un modelo de predicción de VUR o de
detección de desgaste anómalo entrena sobre `inspection_measurements` unidas a su
instalación/ciclo/casco — series temporales limpias por neumático físico. La confianza de cada
km está etiquetada (`odometer_source`), así que el pipeline puede ponderar dato medido vs
estimado. Y como las métricas derivadas son vistas, un módulo de analytics puede añadir las
suyas (features, agregados) sin escribir jamás en las tablas de hechos.

La prueba de fuego del diseño: ninguno de los escenarios anteriores requiere tocar
`tire_casings`, `tire_life_cycles`, `tire_installations` ni `inspections`. Solo se agregan
filas, vistas y políticas alrededor de los mismos hechos.
