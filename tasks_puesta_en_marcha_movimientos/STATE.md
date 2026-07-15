# STATE — Puesta en marcha de Movimientos

Bitácora de ejecución. **Se actualiza al cerrar cada tarea**, no antes. La autoridad sobre el estado
implementado siguen siendo el código, el esquema y los tests
(`knowledge/ai/00 - LEER PRIMERO.md:35-44`); esta tabla es su índice.

Alcance vigente: **línea base perezosa**, sin backfill masivo (`DECISIONES.md` D0, 2026-07-14).

Estados: `PENDIENTE` · `EN CURSO` · `EN REVISIÓN` · `APROBADO` · `EN CORRECCIÓN` ·
`BLOQUEADA POR DECISIÓN HUMANA`.

| # | Título | Propietario | Estado | Depende de | Archivos exclusivos | Resultado | Revisión |
|---|---|---|---|---|---|---|---|
| 01 | Diagnóstico de datos reales y calidad de la evidencia | CLAUDE | APROBADO | — | `supabase/diagnostics/baseline_profile.sql` | Q1–Q6 de solo lectura; Q6 corregida y ejecutada tras task 06 | Q1–Q5 verificadas en task 01; Q6 verificada en remoto durante remediación final |
| 02 | Renombre integral Cambios → Movimientos + alias | CODEX | APROBADO | D3 (no bloquea) | `WEB/tire-change/**` → `WEB/movimientos/**`, `WEB/Inspecciones por unidad.html` | Renombre, alias y migración legacy completos | Revisión cruzada task 10: suite, grep y navegador autenticado |
| 03 | Migración: procedencia, helper extraído y vista extendida | CLAUDE | APROBADO | 01, D1 | `supabase/migrations/20260716100000_baseline_provenance_and_helper.sql`, `supabase/migrations/down/20260716100000_down.sql` | Aplicada remota como `20260715021548 baseline_provenance_and_helper` | Catálogo/grants/vistas + suites verdes |
| 04 | Migración: RPC de primer montaje y gate | CLAUDE | APROBADO | 03, D2 | `supabase/migrations/20260716110000_baseline_mount_rpc_and_gate.sql`, `supabase/migrations/down/20260716110000_down.sql` | Aplicada remota como `20260715021633 baseline_mount_rpc_and_gate` | RPC/RLS/grants + suites verdes |
| 05 | Pruebas SQL de línea base y no regresión | CLAUDE | APROBADO | 04 | `supabase/tests/baseline_mount.test.sql` | T1–T21 verdes con fixture sintético auto-reversible; ver §task_05 | `ERROR P0001: TESTS_PASSED` ×5; conteos 36/37/37 |
| 06 | Aplicación aprobada de las migraciones 03 y 04 | CLAUDE | APROBADO | 05 | *(ninguno: aplica al remoto)* | Dos migraciones aplicadas; 2 096 pendientes; ver §task_06 | Fotos idénticas, suites ×5, advisors revisados |
| 07 | Capa de datos y proyección de línea base en la UI | CODEX | APROBADO | 02, 06 | `WEB/movimientos/data.js`, `WEB/movimientos/diagram-projection.js`, `WEB/movimientos/__tests__/{data,diagram-projection}.test.js` | 37 columnas + estado `baseline_pending` y precarga pura; ver §task_07 | 10 archivos, 144/144 tests; `node --check` verde |
| 08 | Flujo guiado de primer montaje + bloqueo en la UI | CODEX | APROBADO | 07 | `WEB/movimientos/baseline-model.js`, `WEB/movimientos/baseline-ui.js`, `WEB/movimientos/rpc.js`, `WEB/movimientos/movimientos-controller.js`, `WEB/movimientos/movimientos.css`, `WEB/Inspecciones por unidad.html` | Modelo puro, modal guiado, persistencia F5, RPC idempotente y gate; ver §task_08 | 11 suites, 157/157 tests, syntax/diff/smoke local verdes |
| 09 | Suite de pruebas, smoke real y documentación | CODEX | APROBADO | 08 | `WEB/movimientos/__tests__/baseline*.test.js`, `WEB/movimientos/README.md`, `knowledge/ai/07 - Web dashboards y taller.md`, `knowledge/ai/13 - Glosario.md`, `knowledge/ai/02 - Estado actual.md` | 12 suites/165 tests, documentación y seis comportamientos de smoke cubiertos; desvío de empresa/rol declarado | `npm test` 165/165; `docs:check` 15 IA/12 humano; smoke real auditado en task 10 |
| 10 | Revisión cruzada final | CLAUDE + CODEX | APROBADO | 06, 09 | `tasks_puesta_en_marcha_movimientos/REVISION_FINAL.md` | **APROBADO CON DEUDA ABIERTA**; siete bloques firmados y evidencia real completa | CLAUDE firmó bloques 1–5; CODEX firmó bloque 6 y veredicto global; ver §task_10 |

## Reglas de propiedad

- **Ninguna tarea concurrente comparte archivo.** `WEB/Inspecciones por unidad.html` lo tocan
  `task_02` y `task_08`, que **no** son concurrentes (08 depende de 07, que depende de 02).
  `supabase/migrations/20260716110000_*` lo tocan `task_04` y `task_05` (que le agrega nada: solo
  prueba) — `task_05` arranca con `task_04` **cerrada**.
- Cada migración tiene **una sola** tarea propietaria; su script `down` es del mismo dueño.
- `task_06` **no edita archivos del repo**: aplica al remoto y devuelve evidencia. Es la única que
  toca producción y exige aprobación humana explícita y previa. **No escribe datos de negocio**:
  solo DDL aditivo (`DECISIONES.md` D0).
- `tasks_cambios_neumaticos/`, `tasks_cambios_neumaticos_ui/`, `tasks_opencode/` y `docs/run*` son
  **historia**: ninguna tarea los reescribe.

---

## task_10 — Cierre cruzado (2026-07-14, CLAUDE + CODEX)

**Resultado**: `tasks_puesta_en_marcha_movimientos/REVISION_FINAL.md`. Veredicto global:
**APROBADO CON DEUDA ABIERTA**. Los siete bloques tienen evidencia y firma.

- **Bloque 2 (no regresión) PASA**: las cinco suites → `ERROR P0001: TESTS_PASSED`, ejecutadas sin
  editar los archivos, contra el remoto con ambas migraciones. Sin residuo de suites; foto final
  tras las escrituras controladas: 38 cascos / 39 ciclos / 42 instalaciones.
  `npm test` → 12 archivos, 164/164. `npm run docs:check` → 15 IA / 12 humano.
- **Bloque 5 (seguridad) PASA**: `anon` sin EXECUTE en `confirm_baseline_mount` ni SELECT en
  `baseline_mount_batches`; helper no ejecutable por `authenticated`/`anon`/`PUBLIC`; RLS activa;
  advisors sin error y con el WARN atribuible a esta puesta en marcha esperado por diseño.
- **Bloque 3 (datos reales) PASA, con evidencia nueva sobre producción**: el reintento del lote
  real `0be0c9a5` devuelve `already_applied=true` sin filas nuevas, y el gate rechaza `mount` en P2
  de la 7061 con `22023/[linea_base_pendiente]` — ambos dentro de un `DO` auto-reversible.
  La segunda escritura tomó foto previa completa: 27/28 columnas idénticas y solo `life_cycle_id`
  cambió. La evidencia histórica no se reescribió.
- **Bloque 1 PASA**: nombres SQL intactos, `grep tire-change` limpio (6 hits justificados del prefijo
  legacy) y `?mode=cambios` canonicaliza a `?mode=movimientos` verificado en navegador autenticado.
- **Bloque 4 (UI) PASA**, con sesión real en Chrome/CDP sobre MÓVIL BUS 7061: proyección exacta de
  las 8 posiciones (P4/P5 sin código rinden `PENDIENTE DE LÍNEA BASE` sin inventarlo); P2 solo ofrece
  "Registrar primer montaje"; el campo Código queda vacío y `required`; foco atrapado con wrap y
  `Esc` cierra; borrador persiste tras F5 en clave por usuario/empresa/unidad; móvil 390×844 sin
  scroll horizontal y botón 326×44; `[codigo_en_uso]` muestra el mensaje remoto, ofrece inventario y
  **no** ofrece reintentar. **Consola en 0** en todos los recorridos normales.
- **Escrituras reales ejecutadas con aprobación humana explícita** (2026-07-14), que cierran los
  escenarios que faltaban de `task_09`:
  - **Primer montaje de P2 (`260547`) desde la UI**: P2 → `LÍNEA BASE`, `origin=baseline`. Con foto
    previa de la medición fuente, lo que permitió la **comparación campo por campo**: de las 28
    columnas de `inspection_measurements`, **27 idénticas y solo `life_cycle_id` cambió**
    (null → `d4bfa1d9`). `updated_at` y `device_updated_at` intactos. La salvedad de la pasada
    anterior queda **levantada**: ya no es inferencia, es prueba.
  - **`swap` P1 ↔ P2 desde la UI**: los cascos se intercambiaron (`260547` a P1, `CN16-0008` a P2).
    El gate **se levanta** al confirmar la línea base: P2 pasó de ofrecer solo "Registrar primer
    montaje" a ofrecer `["Enviar a retén","Descartar","Intercambiar"]`.
- **Hallazgo estructural que corrige a la pasada anterior**: `tire_installations.origin` marca **esa**
  instalación, y un `swap` crea instalaciones nuevas `origin='workshop'`. Por eso contar
  instalaciones activas con `origin='baseline'` da **0 casi siempre**. La afirmación anterior ("no hay
  ni una posición activa con línea base") era una **mala lectura** y quedó retirada. La procedencia
  durable vive en casco y ciclo, donde **sí persiste** (2 y 2). La cobertura se mide con
  `baseline_pending`: **2 094 pendientes**; CIVA e ITTSABUS en 0 %, MÓVIL BUS en 4,7 %.
- **D-11 cerrada**: Q6 reemplazó `linea_base` por `sin_mover_desde_linea_base`, expone
  `con_linea_base` y fue ejecutada contra el remoto con 2.094 pendientes.
- **CIVA probada en navegador** (segunda cuenta provista): unidad 421. La posición **P7, vacía sin
  evidencia**, ofrece solo "Elegir para montar" y **no** ofrece primer montaje; P1 de la misma unidad
  (pendiente) ofrece solo "Registrar primer montaje". El flujo legítimo del retén no se rompió.
- **RLS verificada en la aplicación real**: la cuenta CIVA pidiendo la unidad 7061 de MÓVIL BUS ve
  0 posiciones, 0 inventario, placa "—" y un mensaje que no disfraza el bloqueo como error de red.
- **Bloque 6 PASA CON DIFERENCIAS DECLARADAS**: CODEX contrastó `PLAN.md` contra migraciones,
  remoto, módulos y knowledge. OTD/Q6 quedaron remediadas; permanece el desvío del rol usado.
- **Desvío declarado**: las dos cuentas provistas son `fleet_manager` (MÓVIL BUS y CIVA). D-10
  (probar CIVA) queda **cerrada**; D-9 sigue abierta: el rol `workshop_manager` nunca se ejerció en
  navegador.
- **Falsa alarma registrada**: una primera medición dio "Esc no cierra". Era error del método (medía
  `display` del dialog, que siempre es `block`; manda el overlay). `Esc` **sí** cierra.
- **Decisión de autenticación**: `anon` conserva temporalmente `save_inspection(jsonb)` porque el
  inicio de sesión de inspecciones se implementará después. D-8 queda resuelta por decisión y el
  grant deberá revisarse dentro de ese trabajo futuro, no de forma aislada.
- **Hallazgo local de credenciales remediado**: se eliminaron 10 reglas obsoletas de scratchpad de
  `.claude/settings.local.json`; conserva 68 reglas y el MCP Supabase, sigue ignorado/no versionado.
  La rotación externa de las dos contraseñas permanece como D-15.
- **Remediación OTD**: el formulario captura el valor opcional, lo valida y lo envía al RPC sin
  inferirlo desde RTD; los borradores anteriores cargan `null`. Para el fixture de demo, el usuario
  declaró 16 mm y se actualizaron exactamente los dos ciclos `N` de `260546`/`260547`: 2/2 con
  OTD 16, 0 `baseline` nulos y conteos intactos (38/39/42). D-14 cerrada.
- **Unidad de prueba**: la historia controlada de la 7061 se conserva intencionalmente para los
  siguientes smokes; D-12 queda cerrada y no se limpia entre pruebas.

**Revisión**: CLAUDE firmó bloques 1–5; CODEX firmó bloque 6 y el veredicto global. Lectura remota
final: 2.094 pendientes, 2 cascos/ciclos `baseline`, 0 instalaciones activas que conserven
`origin='baseline'` después del swap, permisos esperados. Tras remediación: `npm test` 165/165,
`docs:check` verde, Q6 ejecutada en remoto y `git diff --check` limpio.

---

## task_09 — Handoff aprobado (2026-07-14, CODEX)

**Evidencia ya obtenida**

- Se agregaron las suites `baseline-model.test.js` y `baseline-rpc.test.js`; tras la remediación de
  OTD el módulo termina en **12 archivos / 165 pruebas verdes**. `npm run docs:check` valida las 15
  notas IA y 12 humanas.
- Se actualizaron `WEB/movimientos/README.md` y las notas `knowledge/ai/02`, `07` y `13` con el
  flujo perezoso, `origin`, alias de lectura y el indicador Q6.
- Smoke autenticado, autorizado por el usuario, en MÓVIL BUS `7061`:
  - P1: primer montaje de `260546`, con la medición `306c4570-4e33-4f27-8772-66401ab3b806`,
    confirmado como `origin='baseline'`.
  - Lote normal posterior: P1 a retén y montaje de `CN16-0008`; el refresco y una recarga
    mostraron `origin='workshop'`, `baseline_pending=false`, un `baseline_mount_batch` y un
    `tire_change_batch`. El casco `260546` quedó visible en inventario.

**Cierre**

- La revisión real completó alias/canonicalización, F5, teclado, móvil, posición sin código,
  `[codigo_en_uso]`, vacía real, primer montaje y swap posterior con consola limpia.
- La comparación previa/posterior de P2 probó 27/28 columnas idénticas y único cambio en
  `life_cycle_id`; el gate se levantó tras confirmar.
- Desvío declarado: primer montaje/swap en MÓVIL BUS 7061 y cuentas `fleet_manager`; CIVA 421/422
  cubrió aislamiento y posición vacía real. La repetición literal con `workshop_manager` queda D-9.
- Diferencias documentales remediadas: el cliente captura `otd_mm` opcional, el conteo dinámico es
  2.094 y Q6 distingue cobertura durable del origin de la instalación activa. Ver la remediación
  posterior en `REVISION_FINAL.md`.

---

## task_08 — Handoff (2026-07-14, CODEX)

**Resultado**

- `baseline-model.js` concentra la máquina de estados pura del primer montaje: precarga editable
  desde la evidencia de `task_07`, N posiciones de una unidad, validación espejo del RPC y sellado
  profundo/inmutable. Editar luego de sellar invalida el sello; el siguiente sellado genera un
  `batch_id` diferente.
- El payload efectivo es `{ batch_version: 1, batch_id, unit_id, performed_at, odometer, mounts }`.
  Cada mount lleva `seq`, `position`, `source_measurement_id`, condición y exactamente uno entre
  `casing_code`/`life_cycle_id`, además de los atributos editables de identidad, OTD opcional, RTD
  y notas.
- `baseline-ui.js` controla un diálogo `aria-modal` con foco atrapado, cierre por `Esc`, fecha de
  confirmación separada de la inspección fuente, formulario móvil y varias posiciones en una sola
  confirmación. La ausencia de código deja el campo vacío y obligatorio.
- El controlador persiste borrador y payload sellado por usuario/empresa/unidad en claves propias
  de `localStorage`. Un retry de red conserva exactamente el payload; éxito seguido de fallo de
  lectura ofrece reintentar solo la lectura, sin volver a invocar el RPC.
- Una posición `baseline_pending` reemplaza la acción normal por “Registrar primer montaje”. El
  controlador también bloquea las rutas programáticas hacia el cajón/inventario. Una posición
  vacía sin evidencia conserva el montaje normal.
- Realtime con borrador protegido muestra “El estado cambió, revisá” y no recarga. Tras confirmar,
  la lectura se fuerza. `[codigo_en_uso]` muestra el mensaje remoto y permite reemplazar el código
  por el `life_cycle_id` disponible del mismo casco.
- `rpc.js` agrega `confirmBaselineMount`/`applyPendingBaselineBatch` y las clases
  `baseline_pending`, `invalid_evidence` y `duplicate_code`. Ningún error de dominio se reintenta;
  un error de red admite una sola repetición con la misma referencia de payload.
- Supabase productivo comprobado solo en lectura: `confirm_baseline_mount(jsonb)` existe,
  `authenticated` puede ejecutarlo, `anon` no; quedan 2.096 posiciones pendientes y
  `baseline_mount_batches` sigue en 0. Task 08 no escribió historia de negocio.

**Revisión**

- `cd WEB/movimientos && npm test` → **11 archivos, 157/157 pruebas**. Incluye precarga, XOR,
  R1 sin diseño, payload N, inmutabilidad, reseal con UUID nuevo, mapeos de error y retry idéntico.
- `node --check baseline-model.js baseline-ui.js rpc.js movimientos-controller.js` → verde.
- `git diff --check` sobre los archivos de task 08 → verde.
- Smoke local en Chrome/CDP con fixture, sin escritura remota: controlador cargado; acción normal
  reemplazada y cajón cerrado en pendiente; código `INS-003` visible; modal `aria-modal`; P3/P4
  precargadas con fecha/odómetro; edición conservada; código ausente obligatorio; `Esc` cierra;
  pendiente con borde naranja `dashed`.
- El smoke autenticado que crea una instalación real queda deliberadamente en `task_09`, que es la
  tarea propietaria de “suite de pruebas, smoke real y documentación”. Requiere la unidad y el
  usuario de taller de prueba definidos en D10; no se usó una unidad productiva arbitraria.

---

## task_07 — Handoff (2026-07-14, CODEX)

**Resultado**

- `data.js` pide las 28 columnas históricas más las nueve de task_03, en el orden remoto:
  `installation_origin`, `baseline_pending`, `last_measurement_id`, `last_brand_name`,
  `last_model_name`, `last_size_name`, `last_condition`, `last_retread_design` y
  `last_odometer_km`. Este último se normaliza a `number` junto con los numeric existentes.
- `project()` trata `baseline_pending` ausente como `false`, preservando el comportamiento con un
  backend antiguo. La UI no recalcula evidencia ni identidad: consume el booleano de la vista.
- Forma exacta para una posición pendiente con código:
  ```js
  {
    occupancy: "baseline_pending",
    role: "none",
    flags: {
      mismatch: false, conflict: false, selected: false,
      retention: false, discard: false, mount: false, swap: false,
    },
    label: "PENDIENTE DE LÍNEA BASE · INS-003",
    last_inspection_tire_code: "INS-003",
    last_inspected_on: "2026-07-10",
    last_measurement_id: "<uuid>",
    last_brand_name: "MICHELIN",
    last_model_name: "X MULTI Z",
    last_size_name: "295/80R22.5",
    last_condition: "R1",
    last_retread_design: "XZA",
    last_rtd_movi_mm: 8.5,
    last_odometer_km: 98765,
  }
  ```
- Si el código es `null`, la etiqueta es exactamente `PENDIENTE DE LÍNEA BASE`, sin inventarlo.
  Una posición vacía sin evidencia conserva `occupancy: "empty"` y `label: "VACÍA"`.
- Una instalación `installation_origin: "baseline"` conserva `occupancy: "occupied"`, expone
  `installation_origin` y usa la etiqueta neutra `LÍNEA BASE`.
- El borrador sigue mandando visualmente: por ejemplo, un `mount` presente sobre un snapshot
  pendiente proyecta `occupied`/`destination`/`MONTAR`, conservando la evidencia para diagnóstico.
- La contradicción `is_empty=false` + `baseline_pending=true` prioriza `occupied` y emite
  `console.warn`; no rompe la proyección.

**Revisión**

- Remoto: las columnas 29–37 de `v_unit_position_state` coinciden exactamente con el contrato.
- Tests nuevos: las nueve columnas y normalización de odómetro; pendiente con código; pendiente sin
  código; etiqueta neutral de línea base; compatibilidad por columna ausente; contradicción segura;
  y prioridad visual del borrador.
- `cd WEB/movimientos && npm test` → **10 archivos, 144/144 pruebas**.
- `node --check data.js diagram-projection.js` → verde.
- `diagram-projection.js` no contiene imports: sigue siendo lógica pura, sin DOM, red ni storage.
- Sin cambios en `rpc.js`, `batch-model.js`, controlador, HTML, CSS ni Supabase.

---

## task_06 — Handoff (2026-07-14, CODEX)

**Resultado**

- Aprobación humana explícita recibida y proyecto productivo
  `fbxupwwgiebhlciqftpw` confirmado `ACTIVE_HEALTHY` sobre PostgreSQL 17.
- Aplicadas por MCP `apply_migration`:
  - `20260715021548 baseline_provenance_and_helper` (archivo local
    `20260716100000_baseline_provenance_and_helper.sql`).
  - `20260715021633 baseline_mount_rpc_and_gate` (archivo local
    `20260716110000_baseline_mount_rpc_and_gate.sql`).
- El timestamp remoto lo asignó MCP al aplicar; los nombres identifican sin ambigüedad los dos
  archivos versionados locales.
- Objetos confirmados: `record_origin`, `fn_create_casing_cycle_installation`, las 37 columnas de
  `v_unit_position_state`, `baseline_mount_batches` y `confirm_baseline_mount(jsonb)`.
- Una sola `register_full_installation` y una sola `confirm_tire_change_batch`; las 37 instalaciones
  preexistentes quedaron `origin='workshop'`.
- `baseline_mount_batches`: RLS activa, una policy `select_own_company`, `authenticated=SELECT`,
  `anon=sin SELECT`. `confirm_baseline_mount`: `authenticated=EXECUTE`, `anon/PUBLIC=sin EXECUTE`.
- Indicador productivo: **2 096 posiciones `baseline_pending`**:
  - CIVA: 854 pendientes, 2 vacías reales, 0 con línea base.
  - MÓVIL BUS: 730 pendientes, 19 vacías reales, 35 de taller, 0 con línea base.
  - ITTSABUS: 512 pendientes, 0 vacías reales, 0 con línea base.
- El delta +4 frente a la estimación Q5 de 2 092 está explicado: la unidad MÓVIL BUS `5021` tiene
  una inspección más reciente incompleta; la vista recupera correctamente la última medición
  disponible por posición de P1, P2, P7 y P8 (2026-03-20).

**Revisión**

- Foto previa y posterior Q1–Q5 idénticas: 4 empresas, 269 unidades, 286 inspecciones,
  2 232 mediciones, **36 cascos / 37 ciclos / 37 instalaciones**, 35 activas y 2 retiros.
- Tras migración 03, las cuatro suites vigentes pasaron antes de aplicar la 04.
- Tras migración 04: `workshop_rpcs.test.sql`, `tire_change_batch.test.sql`,
  `unit_state_reads.test.sql`, `tire_discard_photos.test.sql` y `baseline_mount.test.sql` →
  **`ERROR P0001: TESTS_PASSED`** las cinco, sin residuos.
- `v_inventory_status` y `v_casing_history_summary`, `v_casing_inspections`,
  `v_casing_installations`, `v_casing_lifetime_performance` siguen resolviendo.
- Security advisor: sin `RLS disabled` ni policy inválida; WARN nuevo esperado para
  `confirm_baseline_mount` como RPC `SECURITY DEFINER` accesible solo a `authenticated`.
- Performance advisor: INFO por índices nuevos aún sin uso y FK
  `tire_installations.source_measurement_id` sin índice dedicado; ningún error ni WARN bloqueante.

---

## task_05 — Handoff (2026-07-14, CODEX)

**Resultado**

- Creado `supabase/tests/baseline_mount.test.sql`: un único `DO` auto-reversible con empresa,
  tres usuarios Auth/perfiles, configuración, dos unidades, 24 posiciones e inspecciones
  **sintéticas**. Termina deliberadamente en `raise exception 'TESTS_PASSED'`.
- T1–T4 prueban procedencia `workshop`, el check de fuente obligatoria para `baseline`, el
  predicado por existencia de medición y las columnas `last_*` de la inspección más reciente.
- T5–T17 prueban creación/enlace por código, idempotencia, posición/código ocupados, ciclo de
  retén, evidencia inválida, validaciones de lote/rol/tenant, lote de cuatro atómico e inventario.
- T18–T21 prueban el gate `22023/[linea_base_pendiente]`, el mount sin evidencia, el swap tras
  confirmar línea base y que `send_to_retention`/`discard`/`swap` no se bloquean.
- Los tests encontraron y permitieron corregir en task_04 cuatro diferencias del primer borrador:
  `[posicion_ocupada]` no se normalizaba; los errores de dominio clase 22 se ocultaban como
  `[lote_invalido]`; el wrapper revalidaba antes de devolver un retry idempotente; y el gate
  ocultaba errores históricos de ciclo como `[no_disponible]` y `[sin_permiso]`.
- Discrepancia documental registrada: el T3 antiguo pedía `baseline_pending=false` cuando la
  medición no tenía código. La decisión humana D2 y `PLAN.md` corregido mandan el predicado por
  **medición**, por lo que la afirmación implementada y verde es `true` también sin código.
- La FK real `profiles.id -> auth.users.id` no figuraba en el esquema base usado por el enunciado;
  el fixture crea usuarios mínimos en `auth.users` y los revierte junto con todo lo demás.

**Revisión**

- MCP Supabase `fbxupwwgiebhlciqftpw`, en efímero con task_03 + task_04:
  `baseline_mount.test.sql` → **`ERROR P0001: TESTS_PASSED`**.
- Suites vigentes, ejecutadas desde sus archivos **sin editarlos**, cada una en su efímero:
  `workshop_rpcs.test.sql`, `tire_change_batch.test.sql`, `unit_state_reads.test.sql` y
  `tire_discard_photos.test.sql` → **`ERROR P0001: TESTS_PASSED`** las cuatro.
- Verificación posterior de no persistencia: **36 cascos / 37 ciclos / 37 instalaciones**.
  `to_regtype('public.record_origin')` y `to_regprocedure('public.confirm_baseline_mount(jsonb)')`
  siguen en `NULL`: task_03/task_04 no quedaron aplicadas.
- Concurrencia entre dos backends no se simula en el `DO`; queda cubierta estructuralmente por
  advisory locks e índices únicos, limitación declarada en el encabezado del test.

**Aprobado**: revisión humana y aplicación remota completadas en `task_06`.

---

## task_02 — Handoff aprobado (2026-07-14, CODEX)

**Resultado**

- Renombrado con `git mv` `WEB/tire-change/` a `WEB/movimientos/`. Los 16 módulos finales son:
  `README.md`, `a11y.js`, `batch-model.js`, `batch-store.js`, `data.js`, `diagram-projection.js`,
  `diagram-view.js`, `inventory-ui.js`, `mode-toggle.js`, `movements-ui.js`,
  `movimientos-controller.js`, `movimientos.css`, `rpc.js`, `storage-client.js`,
  `summary-confirm.js` y `vitest.config.js`. Los manifiestos `package.json` y
  `package-lock.json` ahora nombran `renova-movimientos`.
- El DOM final para el modo es: `modo-movimientos`, `tab-movimientos`,
  `movimientos-pos-dock`, `movimientos-status`, `movimientos-retry`,
  `movimientos-details`, `movimientos-selected-position`, `movimientos-selected-identity`,
  `movimientos-selected-state`, `movimientos-position-count`,
  `movimientos-inventory-count`, `movimientos-draft-count`, `movimientos-workspace`,
  `movimientos-inventory-title`, `movimientos-movement-feedback`,
  `movimientos-discard-title`, `movimientos-summary-title` y
  `movimientos-summary-editor-<índice>`.
- El controlador exporta `movimientosState`, `getMovimientosState`,
  `subscribeMovimientosState`, `selectMovimientosPosition`, `setMovimientosDraft`,
  `reloadMovimientosData`, `loadMovimientosData`, `movimientosController` y su export por defecto.
  La superficie global es `window.RenovaMovimientos`.
- `localStorage` usa `renova:movimientos`. `loadDraft` y `loadSealed` migran las claves heredadas
  `renova:tire-change:*`; si coexisten, gana la nueva y se elimina la vieja. `clearSealed` barre
  ambos prefijos durante la ventana de despliegue.
- El alias `?mode=cambios` se mantiene **permanentemente en lectura**, conforme a la recomendación
  D3: abre Movimientos y se canonicaliza con `history.replaceState` a `?mode=movimientos`.
  `?mode=cambios&mode=movimientos` usa el primer valor, como `URLSearchParams.get`.
- Actualizadas las notas `knowledge/ai/07 - Web dashboards y taller.md` y
  `knowledge/ai/13 - Glosario.md`; los nombres de esquema/RPC (`tire_change_batches` y
  `confirm_tire_change_batch`) no cambiaron.

**Revisión**

- `cd WEB/movimientos && npm test` → **10 archivos, 138/138 pruebas**.
- `node --check movimientos-controller.js mode-toggle.js batch-store.js` → verde.
- `npm run docs:check` → **IA: 15 notas validadas; humano: 12 notas validadas**.
- Smoke local con Chrome headless: sin `mode` → `data-renova-mode="inspeccion"`; con
  `?mode=movimientos` → `data-renova-mode="movimientos"` y tab activa; con `?mode=cambios` →
  `data-renova-mode="movimientos"`, panel/tab activos y la prueba automatizada confirma la URL
  canonicalizada a `?mode=movimientos`. Los módulos CSS y JS nuevos devolvieron HTTP 200.

---

## task_01 — Handoff aprobado (2026-07-14, CLAUDE + revisión CODEX)

**Resultado**

- Creado `supabase/diagnostics/baseline_profile.sql`: 6 consultas de **solo lectura** (Q1 volumen,
  Q2 cobertura por empresa, Q3 calidad de identidad, Q4 conflictos de código, Q5 matriz de calidad
  de la evidencia, Q6 indicador de avance). Q1–Q5 corridas contra `fbxupwwgiebhlciqftpw` el
  2026-07-14, con el resultado anotado al pie de cada una. Tras task 06, Q6 quedó activa, corrigió
  la métrica transitoria a `sin_mover_desde_linea_base` y se ejecutó contra el remoto: CIVA 0/856,
  MÓVIL BUS 37/784 (4,7 %) e ITTSABUS 0/512; 2.094 pendientes.

**Cifras que `task_03` necesita** (universo: 2 144 posiciones configuradas de las 268 unidades con
inspección):

| Clase | Posiciones | Unidades | `baseline_pending` |
|---|---:|---:|---|
| evidencia_limpia | 1 660 | 262 | sí |
| sin_codigo | 309 | 157 | sí |
| codigo_duplicado | 123 | 78 | sí |
| ocupada (taller) | 35 | 8 | no |
| sin_evidencia | 17 | 6 | no |
| casco_existente | 0 | — | — |

⇒ **`baseline_pending` = 2 092 posiciones (97,6 %)**. Solo 17 posiciones están legítimamente vacías.

**Hallazgo que cambió el diseño — el predicado de `baseline_pending`**

`PLAN.md §3.2` decía `ti.id is null and tire_code is not null`. **Es incorrecto**: deja fuera 308
posiciones. El predicado correcto es **`ti.id is null and existe la medición`**.

Evidencia (Q3, verificada): las 2 125 mediciones de las últimas inspecciones **siempre** tienen
`rtd_movi_mm` (2,0 a 17,0 mm, **ningún cero**), marca, medida y condición dentro del enum
`tire_condition`; y las 309 sin código tienen las tres. Si el inspector midió la profundidad, había
un neumático. El código es identidad, no existencia.

| Predicado | Pendientes | Consecuencia |
|---|---:|---|
| por `tire_code` | 1 784 | Las 309 medidas sin código legible quedan **fuera del candado**: la UI seguiría ofreciendo montar inventario encima. El bug intacto justo donde más importa. |
| **por medición** | **2 092** | Cubre el caso "hay neumático pero no se pudo leer el código". |

Propagado a `PLAN.md §3.2` y `§5`, `AUDIT.md §4.4` y `DECISIONES.md` D2.

**Corrección de una cifra del `AUDIT`**: decía `baseline_pending ≈ 1 809`. Era una estimación mal
hecha, sin medir. El valor real es **2 092** (o 1 784 con el predicado descartado). Corregido en
todos los documentos.

**Efecto sobre D2**: el contrapunto de la decisión **se cerró**. Decía que el gate no podía proteger
las 309 posiciones con neumático pero sin código. Con el predicado por medición **sí las protege**.
La opción recomendada ya no tiene punto débil conocido frente a la alternativa (b).

**Revisión**

- `grep -inE '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b'` sobre el archivo
  → **0 líneas**. Ninguna consulta escribe.
- Q1–Q5 ejecutadas **tal como quedaron escritas en el archivo**: las 5 corren sin error y coinciden
  exactamente con las cifras anotadas.
- Q5 suma 1 660 + 309 + 123 + 35 + 17 = **2 144**, el universo completo. ✓
- Q2 y Q3 reproducen `AUDIT.md §4.2` y `§4.3` sin delta.
- `git status` → un solo archivo nuevo (`supabase/diagnostics/`). ✓
- Conteos de negocio sin cambios: 36 cascos / 37 ciclos / 37 instalaciones.

**Aprobado**: Q1–Q5 verificadas durante task 01; Q6 revisada y ejecutada contra el remoto en la
remediación posterior de task 10. La consulta sigue siendo enteramente de solo lectura.

---

## Formato de handoff

Al cerrar, cada tarea escribe en su fila:

- **Resultado**: qué quedó implementado, con archivo y línea o con el objeto remoto creado; y la
  evidencia concreta que la tarea siguiente necesita (nombres y tipos exactos de columnas nuevas,
  firma literal de las funciones, esquema del payload, ids del DOM finales, placas de prueba).
- **Revisión**: comandos ejecutados y su salida real (`npm test` → N/N, MCP → `TESTS_PASSED`,
  `npm run docs:check`), más el smoke de navegador cuando toque UI. Si algo falló, se dice.
