# REVISION_FINAL — Puesta en marcha de Movimientos

**Estado del documento**: **FINAL — APROBADO CON DEUDA ABIERTA.**
**Fecha**: 2026-07-14 · **Revisión cruzada**: CLAUDE (bloques 1–5) + CODEX (bloque 6 y veredicto global) · **Proyecto**: `fbxupwwgiebhlciqftpw` (PostgreSQL 17)

## Veredicto global

**APROBADO CON DEUDA ABIERTA.** Los siete bloques tienen veredicto y evidencia. El mecanismo de
línea base perezosa, su gate, el flujo de UI, la idempotencia, la separación por empresa y la
compatibilidad del renombre funcionan sobre el sistema real. La comparación previa/posterior de la
medición fuente prueba que la historia de inspección no se reescribe: 27 de 28 columnas quedaron
idénticas y solo `life_cycle_id` cambió, como exige el contrato.

La aprobación no oculta diferencias: el smoke autenticado usó `fleet_manager` en lugar de
`workshop_manager` y los datos controlados se conservan intencionalmente en la unidad 7061 como
fixture de prueba. Sus dos ciclos `N` tienen OTD 16 mm por supuesto explícito de demo, no por
inferencia desde RTD. Las omisiones
de UI/Q6 y la exposición local de
credenciales detectadas en la revisión quedaron remediadas después del cierre; lo que requiere un
dato real, una cuenta específica o una decisión operativa permanece enumerado con dueño.

La cruzada queda completa: CLAUDE revisó los bloques operativos 1–5 sobre la implementación de
CODEX; CODEX contrastó `PLAN.md` contra migraciones, remoto, módulos y documentación en el bloque 6
y emite este veredicto.

Todo lo que escribió en producción se hizo con **aprobación humana explícita**, pedida y concedida
antes de cada operación (`CLAUDE.md`). Nada se escribió por inercia.

## Veredicto por bloque

| # | Bloque | Veredicto | Base |
|---|---|---|---|
| 1 | Compatibilidad del renombre | **PASA** | Suite + grep + navegador autenticado |
| 2 | No regresión del taller | **PASA** | 5 suites `TESTS_PASSED`, sin residuo |
| 3 | Datos reales controlados | **PASA** | Comparación campo por campo + `swap` real ejecutado |
| 4 | UI | **PASA** | Navegador autenticado sobre 7061 (MÓVIL BUS) y 421 (CIVA) |
| 5 | Seguridad | **PASA** | Grants/RLS/advisors reales |
| 6 | Documentación vs. implementación | **PASA CON DIFERENCIAS DECLARADAS** | Matriz contrato por contrato firmada por CODEX |
| 7 | Deuda abierta | **LISTADA** | Medida contra el remoto |

---

## Bloque 1 — Compatibilidad del renombre · PASA

**Nombres SQL vigentes intactos** (`PLAN.md §7.2`) — PASA:

```sql
select 'register_full_installation' as fn, count(*) from pg_proc where proname='register_full_installation'
union all select 'confirm_tire_change_batch', count(*) from pg_proc where proname='confirm_tire_change_batch'
union all select 'v_unit_position_state cols', count(*) from information_schema.columns where table_name='v_unit_position_state';
```
```
register_full_installation  → 1
confirm_tire_change_batch   → 1
v_unit_position_state cols  → 37
```
`tire_change_batches` y `v_tire_inventory_available` siguen resolviendo (los usan las suites del
bloque 2). Ninguno cambió de nombre.

**`grep -rn "tire-change" WEB/ --exclude-dir=node_modules`** — PASA. Seis coincidencias, todas la
migración del prefijo heredado de `localStorage`, todas justificadas:

```
WEB/movimientos/README.md:39        (documenta la migración)
WEB/movimientos/batch-store.js:2    const LEGACY_STORE_PREFIX = "renova:tire-change";
WEB/movimientos/__tests__/batch-store.test.js:168,184,279,295
```

**Borrador con prefijo `renova:tire-change:*` se migra y no se pierde** — PASA por prueba
automatizada, no por navegador: las cuatro pruebas de `batch-store.test.js` citadas arriba cubren
`loadDraft`/`loadSealed`/`clearSealed` sobre la clave heredada, y están dentro de los 164 verdes.

**`?mode=cambios` canonicaliza a `?mode=movimientos`** — PASA, verificado por el revisor en navegador
autenticado (Chrome headless por CDP, servidor local sobre `WEB/`):
```
URL tras canonicalizar        ?mode=movimientos
data-renova-mode              movimientos
tab movimientos activa        true
panel movimientos visible     true
consola: errores/warnings     0
```

## Bloque 2 — No regresión del taller · PASA

Las cinco suites, ejecutadas **sin editar los archivos**, por MCP `execute_sql` contra el remoto
productivo con ambas migraciones aplicadas. Resultado correcto = `ERROR P0001: TESTS_PASSED`
(la excepción aborta la transacción y revierte el fixture):

| Suite | Salida real |
|---|---|
| `workshop_rpcs.test.sql` | `ERROR: P0001: TESTS_PASSED` (line 150) |
| `unit_state_reads.test.sql` | `ERROR: P0001: TESTS_PASSED` (line 232) |
| `tire_discard_photos.test.sql` | `ERROR: P0001: TESTS_PASSED` (line 118) |
| `tire_change_batch.test.sql` | `ERROR: P0001: TESTS_PASSED` (line 387) |
| `baseline_mount.test.sql` | `ERROR: P0001: TESTS_PASSED` (line 572) |

**Unicidad de funciones** — PASA: `pg_proc` tiene **una sola** `register_full_installation` y **una
sola** `confirm_tire_change_batch` (salida en el bloque 1).

**Sin residuo tras las cinco suites** — PASA:
```
cascos 38 · ciclos 39 · instalaciones 42
residuo TEST cascos → 0     empresas TEST → 0
```
Los conteos coinciden exactamente con los previos a correr las suites. Nada persistió.

> Nota de contexto, no defecto: la foto ya **no** es 36/37/37 como en `task_06`. Es 38/39/42 porque
> los dos primeros montajes y sus movimientos posteriores escribieron historia real autorizada
> (ver bloque 3). Las suites no alteraron esos conteos.

**Suite JS** — PASA: `cd WEB/movimientos && npm test` → **12 archivos, 164/164**.
**Documentación** — PASA: `npm run docs:check` → `[ok] IA: 15 notas validadas` · `[ok] humano: 12 notas validadas`.

## Bloque 3 — Datos reales controlados · PASA

El smoke de `task_09` ya operó sobre la unidad **MÓVIL BUS 7061** con autorización del usuario. Esta
revisión audita **el resultado que dejó**, en vez de repetirlo.

**Primer montaje → ocupada con `origin='baseline'` y `source_measurement_id` poblado** — PASA:
```
install_id            0e4d20fb-cecc-432d-969e-2a33d7c4208f
origin                baseline
source_measurement_id 306c4570-4e33-4f27-8772-66401ab3b806
position_number       1     rtd_at_install_mm  11.00
```

### La evidencia histórica no se reescribió · PASA, probado campo por campo

Con aprobación humana explícita se ejecutó un **segundo primer montaje real** (P2 de la 7061,
código `260547`) tomando **una foto previa completa de la medición fuente**. Eso permite la
comparación que `task_10:§6.3` exige y que antes era imposible. Las **28 columnas** de
`inspection_measurements` para `dabc2f7c-0bb6-419b-bba3-fc4ac6eb2537`:

| Campo | Antes | Después | Veredicto |
|---|---|---|---|
| `life_cycle_id` | `null` | `d4bfa1d9-8ce3-49b3-a906-35386910304c` | **CAMBIÓ** (es lo que debe cambiar) |
| `updated_at` | 2026-07-10T18:14:30.633928+00 | 2026-07-10T18:14:30.633928+00 | IDÉNTICO |
| `device_updated_at` | 2026-07-10T18:14:30.633928+00 | 2026-07-10T18:14:30.633928+00 | IDÉNTICO |
| `tire_code` | `260547` | `260547` | IDÉNTICO |
| `rtd_movi_mm` · `rtd_a/b/c/d_mm` | 12 · 13/12/13/null | 12.0 · 13.0/12.0/13.0/null | IDÉNTICO |
| `pressure_psi` · `rtd_state` · `anomaly` | 116 · Normal · Normal | 116.0 · Normal · Normal | IDÉNTICO |
| `brand_name` · `model_name` · `size_name` · `condition` | MICHELIN · MULTI · 315/80R22.5 · N | igual | IDÉNTICO |
| `valve_cap` · `is_discard` · `idi_mm` · `retread_design` | Metálica · false · null · null | igual | IDÉNTICO |
| `id` · `company_id` · `inspection_id` · `position_number` · `created_at` · `pressure_state` · `temperature_mode` · `anomaly_photo_url` | — | — | IDÉNTICO |

**27 de 28 columnas idénticas; la única que cambió es `life_cycle_id`.** Es exactamente el contrato.
La afirmación ya no es "consistente con no haberse reescrito": está **probada**.

> La salvedad de la pasada anterior queda **levantada**. Se resolvió tomando la foto previa antes de
> escribir, en vez de intentar reconstruir un "antes" que no existía.

Evidencia complementaria del primer montaje anterior (P1, `260546`), que no tiene foto previa:
```
tire_code 260546 · brand MICHELIN · model MULTI · size 315/80R22.5 · condition N
rtd_movi_mm 11.0 · pressure_psi 116.0 · rtd_state Normal · is_discard false · anomaly Normal
life_cycle_id 4fb89fb5-7e21-4049-aca6-8c95120aa63c   ← único campo que el RPC tocó
meas_created  2026-07-10 06:51:51+00
meas_updated  2026-07-10 18:14:30+00
ciclo_creado  2026-07-15 03:02:17+00
```
`meas_updated` es cinco días anterior a `ciclo_creado`, y `rtd_at_install_mm` (11.00) coincide con
`rtd_movi_mm` (11.0): la instalación copió, no sobreescribió. Coherente con lo que la comparación
campo por campo de P2 ya probó de forma concluyente.

**Swap normal tras la línea base** — PASA, **ejecutado sobre datos reales desde la UI** con
aprobación humana. Es el escenario que `task_09` había declarado faltante:

```
ANTES    P1  occupied  origin=workshop  casco=CN16-0008  ciclo=c16acc11
         P2  occupied  origin=baseline  casco=260547     ciclo=d4bfa1d9
DESPUÉS  P1  occupied  origin=workshop  casco=260547     ciclo=d4bfa1d9
         P2  occupied  origin=workshop  casco=CN16-0008  ciclo=c16acc11
```
El borrador que armó la UI llevaba los dos `expected_life_cycle_id` correctos:
```json
{"op":"swap","position_a":1,"expected_life_cycle_id_a":"c16acc11-…",
 "position_b":2,"expected_life_cycle_id_b":"d4bfa1d9-…"}
```
Los cascos se intercambiaron. **El gate se levanta al confirmar la línea base**: antes del montaje,
P2 solo ofrecía "Registrar primer montaje"; después ofrece `["Enviar a retén","Descartar",
"Intercambiar"]`. Consola en 0 en todo el recorrido.

**Reintentar el mismo `batch_id` → `already_applied=true`, cero filas nuevas** — PASA, **sobre el
lote real**, dentro de un `DO` auto-reversible:
```
ERROR: P0001: REAL_CHECKS_PASSED pos_gate=2
```
R1 reinyectó el `payload` real del lote `0be0c9a5-4ab4-4788-9722-fb4501a14ec7` y exigió
`already_applied=true` + conteos de instalaciones y lotes sin cambio. Pasó.

**`mount` del lote normal sobre una posición pendiente → `[linea_base_pendiente]`, cero escrituras**
— PASA, **sobre datos reales** (mismo bloque, R2): P2 de la unidad 7061, con un ciclo disponible real
de MÓVIL BUS → `22023` + `[linea_base_pendiente]`. El gate funciona en producción, no solo en fixture.

**`mount` sobre posición vacía sin evidencia funciona** — PASA por fixture sintético
(`baseline_mount.test.sql` T19, dentro de los `TESTS_PASSED`). No reproducido sobre datos reales.

**`v_tire_inventory_available` no creció por el primer montaje** — PASA por fixture (T17). Sobre
datos reales el casco `260546` **sí** entró a inventario, pero por el **retén posterior**, que es
correcto y es otra operación.

### Hallazgo estructural: `installation_origin` NO mide cobertura

Este `swap` reveló algo que **corrige una afirmación de la pasada anterior de este mismo documento**.

Tras el intercambio, **ambas** posiciones quedaron `origin=workshop`, incluida la que llevaba el
casco de línea base. No es un defecto: `tire_installations.origin` marca **esa instalación**, y un
`swap` crea instalaciones nuevas, que son genuinamente operaciones de taller. La procedencia durable
vive en el **casco y el ciclo**, y ahí **sí persiste**:

```
instalaciones activas origin=baseline   0
ciclos  origin='baseline'  (persiste)   2
cascos  origin='baseline'  (persiste)   2
```

**Consecuencia**: contar instalaciones activas con `origin='baseline'` da **0 casi siempre**, porque
el marcador se pierde en el primer movimiento posterior. La pasada anterior de este documento leyó
ese 0 como "no hay ni una posición activa con línea base" y lo tituló "el número que hay que decir en
voz alta". **Esa lectura era incorrecta** y queda retirada: el 0 no mide cobertura, mide "cuántas
posiciones conservan todavía su instalación original sin haberse movido".

**La medida correcta de cobertura es `baseline_pending = false`.** Contra el remoto, ahora:

| Indicador | Valor |
|---|---|
| Pendientes totales | **2 094** (era 2 095; bajó 1 por el montaje de P2) |
| Pendientes en la 7061 | **6** (era 7) |
| `baseline_mount_batches` | 2 |
| `tire_change_batches` | 4 |

**Defecto en el diagnóstico** (`supabase/diagnostics/baseline_profile.sql`, Q6): la columna
`linea_base`, definida como `count(*) filter (where not s.is_empty and s.installation_origin =
'baseline')`, **decae a 0** a medida que taller opera y por lo tanto no sirve como indicador de
avance. La métrica principal de Q6, `pct_con_linea_base` (`count(not is_empty) / count(*)`), **sí es
correcta** porque no mira `origin`. Recomendación: quitar o renombrar la columna `linea_base` a algo
como `sin_mover_desde_linea_base`, para que nadie la lea como cobertura. Dueño: `task_01` (CLAUDE).

## Bloque 4 — UI · PASA CON DESVÍO DECLARADO

Verificado por el revisor con **sesión autenticada real** en Chrome headless por CDP, contra el
remoto productivo, sobre la unidad **MÓVIL BUS 7061**.

Se usaron **dos** cuentas provistas por el humano, ambas `fleet_manager`:

| Empresa | Rol | Unidades probadas |
|---|---|---|
| MÓVIL BUS | `fleet_manager` | 7061 (1 ocupada + 7 pendientes) |
| CIVA | `fleet_manager` | 421 (7 pendientes + 1 vacía real), 422 |

> **Desvío declarado**: `task_09:§6.2` pide un usuario de **taller** (`workshop_manager`). Ambas
> cuentas provistas son `fleet_manager`. La unidad **CIVA sí** se probó (cierra D-10), pero el rol
> `workshop_manager` **no** se ejerció nunca en navegador (D-9 sigue abierta). Ambos roles pasan el
> chequeo de permisos del RPC, así que la diferencia práctica es acotada, pero no es lo pedido.

**Datos visibles · proyección real de las 8 posiciones** — PASA, y coincide exactamente con el
contrato de `task_07`:
```
P1  occupied          | REVISAR IDENTIDAD                 | origin=workshop
P2  baseline_pending  | PENDIENTE DE LÍNEA BASE · 260547  |
P3  baseline_pending  | PENDIENTE DE LÍNEA BASE · 251017  |
P4  baseline_pending  | PENDIENTE DE LÍNEA BASE           |   ← sin código: no lo inventa
P5  baseline_pending  | PENDIENTE DE LÍNEA BASE           |   ← sin código: no lo inventa
P6  baseline_pending  | PENDIENTE DE LÍNEA BASE · 251260  |
P7  baseline_pending  | PENDIENTE DE LÍNEA BASE · 251112  |
P8  baseline_pending  | PENDIENTE DE LÍNEA BASE · 251471  |
```
P4/P5 rinden la etiqueta neutra exacta `PENDIENTE DE LÍNEA BASE`, sin código inventado. P1, ocupada
por taller con `casing_code` distinto del código de la inspección, rinde `REVISAR IDENTIDAD`.

**La posición pendiente reemplaza la acción normal** — PASA. En P2, las únicas acciones habilitadas
son `["REGISTRAR PRIMER MONTAJE", "REGISTRAR PRIMER MONTAJE"]` (cajón + panel). No aparece montar,
retén ni descartar. El candado existe en la UI, no solo en el RPC.

**Posición sin código → campo vacío y obligatorio** — PASA. Modal de P4, campos reales del diálogo:
```
Fecha de confirmación   date    2026-07-14     required     ← separada de la inspección
Odómetro                number  0              opcional
Código del casco        text    ""             required     ← vacío y obligatorio
Marca                   text    MICHELIN       opcional     ← precargado de la evidencia
Modelo                  text    MULTI          opcional
Medida                  text    315/80R22.5    opcional
Condición               select  R1             required
Diseño de reencauche    text    DV-RM 258      required     ← obligatorio porque es R1
RTD MOVI (mm)           number  9              opcional
Medición fuente         text    4c3da320-…     required
Notas                   text    ""             opcional
```

**Modal accesible** — PASA. `aria-modal="true"` sobre `#movimientos-baseline-overlay`; al abrir, el
overlay toma `.open`, `aria-hidden="false"`, `display: flex`, y el foco salta a `performed-at`
(el `initialFocus` declarado).

**Recorrido por teclado** — PASA. 15 focusables en el overlay; desde el último
(`movimientos-baseline-confirm`), `Tab` vuelve al primero (`movimientos-baseline-performed-at`);
`Shift+Tab` desde el primero se queda dentro. **`Esc` cierra**: el overlay pierde `.open` y vuelve a
`aria-hidden="true"`.

> **Nota de método**: una primera medición dio "Esc NO cierra". Era **falso**: medía
> `display` sobre `#movimientos-baseline-dialog`, que es `block` siempre porque la visibilidad la
> gobierna el overlay. Se deja registrado para que nadie repita el error.

**Borrador + F5 persiste** — PASA. Tipeado `SMOKE-F5-001` en el código de P4, la clave queda en
`localStorage` acotada por usuario/empresa/unidad, y **sobrevive la recarga**:
```
renova:movimientos:baseline-draft:50b805ea-…%3Af243affb-…%3A5601427b-…
tras F5 · código persistido → "SMOKE-F5-001"
```

**Viewport móvil (390×844)** — PASA:
```
scroll horizontal en la página      no
modal cabe a lo ancho               sí (366 ≤ 390)
scroll horiz. con modal abierto     no
botón confirmar                     326x44  (objetivo táctil suficiente)
```

**Código duplicado → `[codigo_en_uso]` y salida por inventario** — PASA. Forzando `CN16-0008`
(montado en P1) sobre P2, la UI muestra el **mensaje remoto textual** y ofrece la salida correcta:
```
feedback  "[codigo_en_uso] El código ya existe en tu empresa. Buscalo y montá su ciclo
           existente con life_cycle_id."
kind      error
salida por inventario  ofrecida
reintentar             NO ofrecido   ← correcto: error de dominio, no de red
modal                  sigue abierto
```

**Consola limpia** — PASA. **0 errores/warnings** en todos los recorridos normales (alias, carga,
selección, modal, teclado, F5, móvil). El único `console.error` observado (`confirm_baseline_mount
Object`) aparece **solo** al forzar deliberadamente el código duplicado: es el log del RPC
rechazado, no ruido del flujo normal.

**Una posición vacía sin evidencia sigue ofreciendo el montaje del retén** — PASA, verificado en
navegador con la cuenta CIVA sobre la unidad **421**, que tiene una de las dos únicas posiciones
legítimamente vacías de la empresa (P7, sin medición: `last_measurement_id = null`):

```
P1  baseline_pending  | PENDIENTE DE LÍNEA BASE · 20848   → ["Registrar primer montaje"]
P7  empty             | VACÍA                             → ["Elegir para montar"]
```
El contraste en la **misma unidad** es la prueba: la posición pendiente ofrece **solo** el primer
montaje; la vacía real ofrece **solo** el montaje normal del retén y **no** ofrece primer montaje
(`¿ofrece PRIMER MONTAJE? → false`). El flujo legítimo no se rompió y el candado no se derramó.

**Primer montaje real desde la UI** — PASA, **ejecutado con aprobación humana explícita** (P2 de la
7061). El recorrido completo por la interfaz:
```
código precargado desde la evidencia   "260547"    ← lo trajo de la inspección
fecha de confirmación                  2026-07-14  ← separada de la inspección (2026-06-15)
odómetro                               0           ← el real de la inspección fuente
feedback   "Primer montaje confirmado. El estado de taller quedó actualizado."
kind       success
P2 → occupancy=occupied · label="LÍNEA BASE" · origin=baseline
consola    0
```
La etiqueta neutra `LÍNEA BASE` coincide con el contrato de `task_07`.

> **Observación menor, no defecto**: tras el éxito el modal **queda abierto** (`modal cerrado tras
> éxito → false`). Es coherente con el botón "agregar otra" del diseño (`task_08`), que permite
> encadenar varias posiciones en una sesión. No está declarado explícitamente en `PLAN.md`; si el
> comportamiento buscado era cerrar, es un ajuste de una línea. Queda para que CODEX lo confirme en
> el bloque 6.

> **Observación menor**: la proyección no expone `casing_code` (`P2 · casing_code → undefined`); el
> dato sí está en `remoteState`. No rompe nada visible y `task_07` no lo lista en su contrato de
> forma proyectada, pero conviene saberlo.

## Bloque 5 — Seguridad · PASA

```
anon EXEC confirm_baseline_mount            → false
authenticated EXEC confirm_baseline_mount   → true
anon SELECT baseline_mount_batches          → false
RLS baseline_mount_batches                  → true
helper firma → fn_create_casing_cycle_installation(profiles,text,text,text,text,tire_condition,
               text,numeric,numeric,text,uuid,smallint,date,integer,numeric,record_origin,uuid,text)
helper authenticated EXEC → false    helper anon EXEC → false    helper PUBLIC EXEC → false
```
Los cuatro requisitos de `task_10:§6.5` se cumplen: `anon` no llega a `baseline_mount_batches` ni a
`confirm_baseline_mount`; el helper no es ejecutable por `authenticated`.

**RLS por empresa activa** — PASA, en SQL **y en la aplicación real**.

En SQL: `unit_state_reads.test.sql` T5 exige cero filas de la empresa A al cambiar el JWT a la B, en
`v_unit_position_state` y `v_tire_inventory_available`; `tire_change_batch.test.sql` B7 exige que
CRUZ no opere una unidad de MÓVIL; `baseline_mount.test.sql` T15B exige `[sin_permiso]` al operar
una unidad de otra empresa. Las tres dentro de los `TESTS_PASSED`.

En el navegador, con la cuenta **CIVA** pidiendo deliberadamente la unidad **7061 de MÓVIL BUS**:
```
placa mostrada                    —
posiciones que ve de la 7061      0
proyección                        0
inventario visible                0
status   "No hay posiciones visibles para esta unidad o tu sesión no tiene acceso."
consola                           0 errores
```
No ve ni toca nada, y el mensaje **no miente**: no dice "error de conexión" cuando en realidad es
RLS. Cumple `task_10:§6.5` ("probar con un usuario de otra empresa") sobre el sistema real.

**`get_advisors security`** — PASA. Sin `RLS disabled`, sin policy inválida, **sin error**. El único
lint atribuible a esta puesta en marcha es el **WARN esperado** de `BASELINE_REMOTO.md:171-174`:

> `public.confirm_baseline_mount(p_batch jsonb)` can be executed by the `authenticated` role as a
> `SECURITY DEFINER` function

Ese WARN es la contracara del diseño aprobado y aparece **idéntico** para las seis RPC preexistentes
(`confirm_tire_change_batch`, `register_full_installation`, `register_removal`, `transfer_tire`,
`assign_unit_route`, `save_inspection`). Los demás lints son preexistentes y ajenos a este proyecto:
`btree_gist` en `public`; `anon` puede ejecutar `get_umbrales_rtd`, `get_unidad_preload` y
`save_inspection`; y protección de contraseñas filtradas deshabilitada.

> **Hallazgo, no de este proyecto**: que `anon` pueda ejecutar `save_inspection(jsonb)` —
> `SECURITY DEFINER`, de escritura — merece una decisión explícita. No lo introdujo esta puesta en
> marcha y no se toca aquí, pero queda registrado abajo.

## Bloque 6 — Documentación vs. implementación · PASA CON DIFERENCIAS DECLARADAS

**Firma: CODEX.** Se contrastaron `PLAN.md §2.1`, §3, §4, §5 y §7 contra las dos migraciones
aplicadas, el catálogo remoto, `WEB/movimientos`, las suites y las notas de knowledge. Resultado:

| Contrato | Veredicto | Evidencia / diferencia |
|---|---|---|
| Helper extraído (§2.1) | **COINCIDE** | `fn_create_casing_cycle_installation` contiene los tres inserts; `register_full_installation` conserva firma/retorno y las suites vigentes pasan; `authenticated`, `anon` y `PUBLIC` no pueden ejecutar el helper. |
| `record_origin` y procedencia (§3.1) | **COINCIDE** | Enum y columnas existen con default `workshop`; la línea base exige `source_measurement_id`; el remoto conserva 2 cascos y 2 ciclos `origin='baseline'`. |
| Vista extendida y predicado (§3.2) | **COINCIDE** | 37 columnas; `baseline_pending = is_empty AND existe medición`, incluido el caso sin código. Remoto al cierre: 2.094 pendientes. |
| Payload/retorno del RPC (§4.2) | **COINCIDE; OMISIÓN DE UI REMEDIADA** | Versión, UUID, unidad, fecha, odómetro, N mounts, XOR, evidencia, errores e idempotencia coinciden. El formulario ahora captura `otd_mm` como dato opcional, lo valida y lo envía sin inferirlo; los 2 ciclos controlados quedaron en 16 mm por supuesto explícito de demo. |
| Único toque al histórico (§4.2) | **COINCIDE Y ESTÁ PROBADO** | Foto previa/posterior de P2: 27/28 columnas idénticas; solo `life_cycle_id` pasó de null al ciclo confirmado. `updated_at` y `device_updated_at` no cambiaron. |
| Comentario `source_measurement_id: null si no había` del ejemplo (§4.2) | **DIFIERE, PLAN OBSOLETO** | El RPC implementado exige una medición fuente válida; es coherente con que el flujo solo nace desde `baseline_pending`. No existe primer montaje “sin evidencia”. |
| Gate del lote normal (§5) | **COINCIDE** | `[linea_base_pendiente]` se dispara por medición, incluso sin código, sin escrituras; una vacía real sigue aceptando montaje normal. Tras confirmar línea base, el swap normal funciona. |
| UI guiada (§6) | **COINCIDE** | Precarga editable, fecha fuente explícita, N posiciones, código vacío obligatorio, duplicado con salida a inventario, persistencia F5, teclado y móvil verificados. La identidad y `LÍNEA BASE` se renderizan en elementos separados, pero juntas en la misma posición. |
| Modal abierto tras éxito | **NO ES DIFERENCIA CONTRACTUAL** | `PLAN.md` no exige cierre automático; mantenerlo abierto permite agregar otra posición. |
| Renombre y compatibilidad (§7) | **COINCIDE** | Ruta/ids/textos canónicos en Movimientos; alias `?mode=cambios` y migración de claves legacy funcionan; nombres SQL e historia permanecen intactos. |
| Documentación de task 09 | **COINCIDE; SALVEDADES REMEDIADAS** | README y knowledge explican línea base perezosa, procedencia, OTD opcional y alias; `docs:check` pasa. El conteo de referencia se actualizó a 2.094 y Q6 distingue cobertura de `sin_mover_desde_linea_base`. |
| Smoke prescrito por task 09 | **DESVÍO ACEPTADO Y REGISTRADO** | Los seis comportamientos se cubrieron, pero el primer montaje/swap real fue en MÓVIL BUS 7061 y las cuentas fueron `fleet_manager`; CIVA 421/422 cubrió empresa cruzada y vacía real, no el montaje/swap. D-9 conserva la diferencia de rol. |

La documentación sustantiva describe el comportamiento real y no promete un backfill. En la
revisión original las dos salvedades documentales se registraron sin tocar implementación; la
remediación posterior que las cerró queda separada y trazada a continuación.

---

## Remediación posterior al cierre · 2026-07-14

Con autorización del usuario se cerraron las deudas locales que no exigían inventar datos ni
modificar producción:

- `baseline-model.js` y `baseline-ui.js` capturan OTD opcional, conservan borradores anteriores con
  `null`, validan número no negativo y envían `otd_mm` al RPC. La OTD no se deriva de RTD.
- Q6 quedó descomentada, ejecutable y renombró la métrica transitoria a
  `sin_mover_desde_linea_base`; `con_linea_base`/`pct_con_linea_base` miden cobertura. Ejecutada en
  el remoto: CIVA 0/856, MÓVIL BUS 37/784 (4,7 %) e ITTSABUS 0/512; 2.094 pendientes.
- `knowledge/ai/02` actualizó el conteo dinámico y README/knowledge documentan OTD opcional.
- `.claude/settings.local.json` perdió las 10 reglas obsoletas de scratchpad que contenían la
  exposición; conserva 68 reglas y el MCP `supabase`, sigue ignorado y no versionado. Los valores
  secretos no se reprodujeron.
- `task_01` y `task_02` quedan `APROBADO`: Q1–Q6 y el renombre/alias fueron revisados por las tareas
  posteriores y por esta cruzada.
- Decisión humana posterior: la 7061 y su historia controlada se conservan como unidad de prueba;
  `anon` mantiene temporalmente acceso a inspecciones hasta que exista el flujo de inicio de sesión.
- Con aprobación explícita se asignó `otd_mm=16` a los dos ciclos `N`, ciclo 0, de los cascos
  `260546`/`260547`. Es un supuesto de demo declarado por el usuario; no se presenta como medición.

Verificación posterior: `npm test` → **12 archivos, 165/165**; `npm run docs:check` → **15 notas IA
/ 12 humanas**; `node --check` y `git diff --check` verdes.

---

## Deuda abierta

| # | Deuda | Medida real | Dueño sugerido |
|---|---|---|---|
| D-1 | La flota **no** está toda con línea base y puede no estarlo nunca | **2 094 posiciones pendientes** | Humano (producto) |
| D-2 | Cobertura por empresa: CIVA e ITTSABUS en 0 % | ver tabla | Humano (producto) |
| D-3 | Identidad manual pendiente en posiciones cuya medición no tiene código; el gate sí las protege | **316 mediciones sin código** | Humano (taller) |
| ~~D-4~~ | ~~El formulario no captura ni envía `otd_mm`~~ | **CERRADA**: campo opcional, validado y probado; 165/165 | — |
| ~~D-5~~ | ~~El `swap` real tras línea base sin ejecutar~~ | **CERRADA**: ejecutado por UI el 2026-07-14 | — |
| ~~D-6~~ | ~~`task_01` y `task_02` siguen `EN REVISIÓN`~~ | **CERRADA**: ambas aprobadas con evidencia posterior | — |
| ~~D-7~~ | ~~Bloque 6 de esta revisión sin hacer~~ | **CERRADA**: matriz firmada por CODEX | — |
| ~~D-8~~ | ~~Decidir si `anon` conserva `save_inspection(jsonb)`~~ | **DECISIÓN TOMADA**: se conserva temporalmente hasta implementar login | — |
| D-9 | El rol `workshop_manager` nunca se ejerció en navegador (las 2 cuentas son `fleet_manager`) | — | Humano (proveer usuario) |
| ~~D-10~~ | ~~Ninguna unidad CIVA se probó en navegador~~ | **CERRADA**: CIVA 421/422 probadas | — |
| ~~D-11~~ | ~~Q6 llama `linea_base` a una métrica que decae tras movimientos~~ | **CERRADA**: `sin_mover_desde_linea_base` + cobertura explícita, verificada en remoto | — |
| ~~D-12~~ | ~~Datos controlados en la 7061 sin decisión final de conservar/limpiar~~ | **DECISIÓN TOMADA**: conservar como unidad/fixture de prueba | — |
| ~~D-13~~ | ~~Reglas locales obsoletas conservan una credencial en texto plano~~ | **CERRADA localmente**: 10 reglas eliminadas; archivo ignorado/no versionado | — |
| ~~D-14~~ | ~~Los 2 ciclos `baseline` ya creados tienen OTD nula~~ | **CERRADA**: ambos en 16 mm por supuesto explícito de demo; cero filas adicionales alteradas | — |
| D-15 | Rotar las dos contraseñas compartidas fuera del repositorio | No se puede ejecutar desde este workspace | Humano (seguridad) |

**D-1/D-2 — cobertura real**, medida por `baseline_pending`, que es la métrica correcta (ver el
hallazgo estructural del bloque 3):

| Empresa | Pendientes | Ocupadas | Vacías reales | Total | % cubierto |
|---|---:|---:|---:|---:|---:|
| CIVA | 854 | 0 | 2 | 856 | **0,0 %** |
| MÓVIL BUS | 728 | 37 | 19 | 784 | **4,7 %** |
| ITTSABUS | 512 | 0 | 0 | 512 | **0,0 %** |

**El número que hay que decir en voz alta: quedan 2 094 posiciones pendientes y dos de las tres
empresas están en 0 %.** CIVA (854) e ITTSABUS (512) no tienen **ninguna** posición con línea base.
Todo el avance está en MÓVIL BUS, que además es donde vive la unidad de prueba. El tablero
consolidado arranca prácticamente en cero y se llena solo a medida que taller opera (`AUDIT.md` B12,
`DECISIONES.md` D0). Este proyecto entrega el **mecanismo**; no carga la flota.

> Corrección respecto de la pasada anterior: aquella tabla traía una columna "con línea base" en 0
> para las tres empresas y la interpretó como ausencia total de cobertura. La columna medía
> instalaciones activas con `origin='baseline'`, que decae a 0 al primer movimiento. Retirada.

**D-3 — contrapunto**: `task_01` cerró el contrapunto de D2 al cambiar el predicado a "existe la
medición", con lo cual las posiciones sin código **sí** quedan protegidas por el gate. La cifra
subió de 309 (`task_01`, 2026-07-14) a **316**: crecen con cada inspección nueva sin código legible.
La deuda que queda no es de protección sino de **identidad**: 316 neumáticos que taller tendrá que
codificar a mano al operar.

**D-14 — cerrada con supuesto de demo explícito**: la lectura remota verificó que los dos ciclos
son `condition='N'`, ciclo 0 y solo se instalaron en la 7061. Con aprobación humana se actualizó
únicamente `otd_mm=16` en esas dos filas. Verificación posterior: 2 ciclos `baseline`, 2 con OTD
16 y 0 con OTD nula; 38 cascos / 39 ciclos / 42 instalaciones, sin delta. La RTD histórica no se
usó para inferir el valor y el documento no presenta 16 mm como medición observada.

**Derivas D-A/D-B/D-C de `BASELINE_REMOTO.md:195-197`**: no se revisaron en esta pasada.

---

## Acciones posteriores al cierre

No queda un bloqueo técnico para usar Movimientos. Las acciones posteriores son las deudas de la
tabla anterior, especialmente:

1. Repetir con `workshop_manager` si se quiere cerrar literalmente el desvío de rol (D-9).
2. Rotar las dos contraseñas fuera del repositorio (D-15).

La 7061 se conserva intencionalmente como unidad de prueba. Su historia controlada no debe
limpiarse entre pruebas: los siguientes recorridos deben reutilizarla y mantener trazabilidad.
`anon` conserva `save_inspection(jsonb)` mientras el producto todavía no tenga inicio de sesión;
el grant debe revisarse como parte del futuro trabajo de autenticación, no aisladamente.

## Trazabilidad

**Cero credenciales, secretos o `service_role` en este documento** (`task_10:§7`). Se comprobó un
hallazgo fuera del documento: una credencial de prueba quedó escrita por una sesión anterior en
`.claude/settings.local.json`. Las reglas comprometidas ya se eliminaron; el archivo sigue ignorado
y no versionado. La rotación externa permanece en D-15. Ningún valor secreto se reproduce aquí.

Escrituras en producción hechas por esta revisión, **todas con aprobación humana previa y explícita**:

| Operación | Efecto | Aprobación |
|---|---|---|
| Primer montaje P2 de la 7061 (`260547`) por UI | 1 casco, 1 ciclo, 1 instalación `baseline`, 1 `baseline_mount_batch` | Sí, explícita |
| `swap` P1 ↔ P2 por UI | 2 retiros, 2 instalaciones `workshop`, 1 `tire_change_batch` | Sí, explícita |
| OTD de demo para `260546`/`260547` | `otd_mm=16` en exactamente 2 ciclos `N`; ningún otro registro | Sí, explícita |

Todo lo demás fue de solo lectura o auto-reversible (`DO` que termina en `raise exception`). Las
cinco suites SQL corrieron contra producción sin dejar residuo, verificado con conteos antes y
después. El intento de `[codigo_en_uso]` fue rechazado por el RPC y no dejó filas. El recorrido de
UI previo a la aprobación no escribió nada, verificado con conteos idénticos.

Estado final de la unidad de prueba **7061**, íntegramente trazable:
```
P1  casco 260547 (origin=baseline)   ciclo d4bfa1d9   instalación actual origin=workshop
P2  casco CN16-0008 (origin=workshop) ciclo c16acc11  instalación actual origin=workshop
6 posiciones siguen baseline_pending
```
