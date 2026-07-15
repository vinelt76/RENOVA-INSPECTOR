# AUDIT — Puesta en marcha de Movimientos de Neumáticos

Fecha: 2026-07-14. Autor: CLAUDE (orquestador de planificación). Alcance: **100 % lectura**.
No se aplicó DDL/DML ni migraciones; el proyecto Supabase se consultó solo con `SELECT`.

Toda afirmación de esta nota cita archivo y líneas del repositorio, o la consulta exacta ejecutada
contra el proyecto productivo `fbxupwwgiebhlciqftpw` (confirmado en
`tasks_cambios_neumaticos/BASELINE_REMOTO.md:13-25` y `WEB/supabase-config.public.js:9`).

---

## 1. Por qué todas las posiciones se ven vacías

`v_unit_position_state` deriva `is_empty` **exclusivamente** de la ausencia de una instalación
activa, nunca de la existencia de mediciones:

- `supabase/migrations/20260714100000_unit_position_state_and_inventory_views.sql:33` →
  `ti.id is null as is_empty`.
- El `left join` que produce `ti` es
  `:46-49` → `tire_installations` por `unit_id` + `position_number` **and not ti.removed`.
- La última medición entra por un `left join lateral` **independiente** (`:54-67`) que aporta
  `last_inspected_on`, `last_rtd_movi_mm`, `last_pressure_psi` y `last_inspection_tire_code`, pero
  **no participa de `is_empty`**.

Es decir: una fila histórica jamás ocupa una posición. Una unidad con 8 inspecciones y sin
instalaciones se lee como 8 posiciones vacías, con datos de inspección visibles al costado. El
comportamiento es correcto por diseño (la vista no infiere presencia física); el problema es que
**nunca se creó el modelo de taller** para la flota real.

Consecuencia directa en la UI: `WEB/tire-change/data.js:112-120` carga la vista tal cual y
`diagram-projection.js` proyecta `is_empty` a "VACÍA · DISPONIBLE PARA MONTAJE"
(`WEB/tire-change/cambios-controller.js:127-129`).

---

## 2. Flujo real de datos históricos (inspecciones)

| Objeto | Evidencia | Hecho relevante |
|---|---|---|
| `inspections` | `20260706120000_demo_vertical_slice.sql:248-261` | `id` **sin default** (nace en el dispositivo, `:249`); FK a `units`; `unique (unit_id, inspected_on)` (`:259`) ⇒ orden temporal confiable por `inspected_on`. |
| `inspection_measurements` | `:263-300` | `unique (inspection_id, position_number)` (`:299`); identidad de texto `tire_code, brand_name, model_name, size_name, condition, retread_design` (`:271-276`); derivados del dispositivo `rtd_movi_mm, rtd_state…` (`:290-294`). |
| `life_cycle_id` en la medición | `:268` | Columna **nullable**, comentada como "se resuelve server-side vía instalación activa (Run 3); la app NO lo manda". Verificado en remoto: **0 filas** la tienen poblada. Es el enganche natural inspección↔taller y hoy está muerto. |
| Empresa | `:265` | `company_id` en la medición y en la cabecera (`:250`) ⇒ el aislamiento por empresa está disponible sin joins extra. |
| Posiciones configuradas | `:111-120` | `tire_positions (config_id, position_number)` es la fuente de "qué posiciones existen"; la unidad las hereda por `units.config_id` (`:131`). |

**Advertencia de esquema**: existe una segunda migración con una tabla `inspections`
incompatible (`20260709090000_minimal_inspections_schema.sql:42-54`, modelo
`vehicles`/`inspection_items`), declarada como alternativa y con colisión conocida
(`:11-19`). El remoto tiene aplicado el modelo de `demo_vertical_slice` (`inspections.unit_id`,
`inspection_measurements`) — verificado por el inventario de tablas de
`BASELINE_REMOTO.md:31-35` y por el hecho de que `v_unit_position_state` compila contra él.
**Ninguna tarea de este plan debe tocar el modelo `vehicles`/`inspection_items`.**

---

## 3. Flujo real de taller

| Objeto | Evidencia | Hecho relevante |
|---|---|---|
| `tire_casings` | `20260706120000:161-179` | Identidad permanente. `code` es **nullable** (`:164`, "'No visible'/'Sin código' → NULL + nota"). Unicidad **por empresa**: `tire_casings_company_code_uidx on (company_id, code) where code is not null` (`:176-177`). |
| `tire_life_cycles` | `:181-201` | `otd_mm`, `cost` y `condition` pertenecen al **ciclo**. `tire_life_cycles_active_uidx (casing_id) where status='active'` (`:198-199`). |
| `tire_installations` | `:203-223` | `tire_installations_active_pos_uidx (unit_id, position_number) where not removed` (`:218-219`) y `tire_installations_active_cycle_uidx (life_cycle_id) where not removed` (`:220-221`). **No existe ninguna columna de procedencia.** |
| `tire_removals` | `:225-242` | `installation_id` **unique** (`:228`); `odometer_source` distingue manual/fallback/unknown (`:231`). |
| RPCs vigentes | `20260712000000_workshop_tire_operations_rpcs.sql` | `fn_require_workshop_profile` (`:28-56`), `fn_validate_free_position` (`:62-105`), `register_full_installation` (`:110-195`), `register_removal` (`:204-282`), `transfer_tire` (`:287-339`). Todas `security definer` + `set search_path = public` + `revoke … from public, anon` + `grant execute to authenticated` (`:345-352`). La empresa **nunca** viaja desde el navegador: sale del perfil (`:11-15`). |
| Helper de montaje | `20260714110000:60-159` | `fn_mount_existing_cycle` es **interno**: `revoke all … from public, anon, authenticated` (`:169-171`). Solo usa `otd_mm` como fallback de RTD en la primera instalación del ciclo (`:148-151`). |
| Lote | `20260714120000:33-609` | `confirm_tire_change_batch(p_batch jsonb)`. Idempotencia por `batch_id` con advisory lock (`:129-143`), bloqueo optimista contra `expected_life_cycle_id` (`:368-400`), retiros antes que montajes (`:437-501`), normalización de errores (`:564-583`). |
| Auditoría del lote | `20260714110000:9-50` | `tire_change_batches`: id de cliente, `payload`, `result`, RLS `select_own_company` (`:42-45`), solo `select` a `authenticated` (`:49-50`). |

**Trazabilidad hoy**: `tire_installations.installed_by` (`20260706120000:212`) y `notes` (`:214`).
No hay forma de distinguir una instalación **confirmada físicamente** de una **inferida**. Esta es
la brecha estructural que obliga a la migración mínima del PLAN §3.

---

## 4. Perfil de la flota real (solo lectura, 2026-07-14)

Proyecto `fbxupwwgiebhlciqftpw`. Todas las consultas son `SELECT`; se reproducen íntegras en
`PLAN.md §2` para poder recalcularlas.

### 4.1 Volumen

| Métrica | Valor |
|---|---|
| Empresas | 4 |
| Unidades | 269 |
| Inspecciones | 286 |
| Mediciones | 2 232 |
| Cascos / ciclos / instalaciones | 36 / 37 / 37 |
| Instalaciones **activas** | 35 |
| Retiros | 2 |
| `tire_change_batches` | existe (tabla aplicada) |

Las migraciones `20260714012206` (lotes+helper), `20260714012209` (vistas), `20260714015430`
(RPC de lote) y `20260714042911` (bucket de fotos) **ya están aplicadas** en remoto
(`supabase_migrations.schema_migrations`). La última versión remota es **`20260714042911`**: toda
migración nueva debe usar un timestamp mayor.

### 4.2 Cobertura por empresa

| Empresa | Unidades | Con inspecciones | Con instalaciones activas | Ambas | Ninguna |
|---|---|---|---|---|---|
| CIVA | 107 | 107 | 0 | 0 | 0 |
| MÓVIL BUS | 98 | 97 | 8 | 8 | 1 |
| ITTSABUS | 64 | 64 | 0 | 0 | 0 |

Lectura: **CIVA e ITTSABUS no tienen una sola instalación**. Solo 8 unidades de MÓVIL BUS tienen
modelo de taller, y **ninguna está completa**:

| Placa | Instalaciones activas |
|---|---|
| QA-CN16 | 7 |
| 2145 | 6 |
| 225 · 2151 · 5032 · 2134 · 5021 | 4 c/u |
| 256 | 2 |

`QA-CN16` es el fixture de prueba (`tasks_cambios_neumaticos_ui/PRUEBA_CAMPO.md:21`). Las otras 7
son **unidades reales con línea base parcial**: parte de sus posiciones ya tiene modelo de taller y
el resto no. Cualquier solución debe razonar **por posición**, no por unidad.

### 4.3 Calidad de la identidad (última inspección de cada unidad)

268 unidades tienen última inspección; aportan 2 125 mediciones.

| Señal | Valor | Interpretación |
|---|---|---|
| Mediciones sin `tire_code` | **316** | Sin identidad ⇒ no se puede inferir un casco. |
| `tire_code` tipo "SIN CÓDIGO"/"NO VISIBLE" | 1 | Placeholder textual, equivalente a sin identidad. |
| `condition` fuera de `{N,R1..R4}` | **0** | El enum `tire_condition` (`20260706120000:42`) se puede castear sin normalizar. |
| `retread_design` faltante con `condition<>'N'` | **0** | `register_full_installation:148-150` no rechazaría ninguna fila por esto. |
| `brand_name` / `size_name` faltantes | 0 / 0 | Los atributos de casco están completos. |
| `rtd_movi_mm` faltante | 0 | Hay RTD para sembrar `rtd_at_install_mm`. |
| Códigos distintos | 1 717 | — |
| Mismo código en 2+ unidades | **76** | Ver abajo. |
| … de esos, cruzan empresas | 25 | **No son conflicto**: la unicidad es `(company_id, code)` (`:176-177`). Dos empresas pueden reutilizar el mismo código de fuego. |
| … resolubles por fecha (inspecciones en fechas distintas) | 70 | Compatible con un neumático que se movió de unidad. |
| … empate en la misma fecha | 6 | Contradicción física real: el mismo casco en dos unidades el mismo día. |
| Código duplicado dentro de la misma unidad | 2 | Dos posiciones con el mismo código en la misma inspección. |
| Posición medida que no existe en la configuración | **0** | — |
| Medición cuyo código ya existe como casco | 15 filas | Pertenecen a las unidades ya operadas por taller. |
| Condiciones | N=1 049 · R1=1 033 · R2=32 · R3=9 · R4=2 | Mayoría reencauchada ⇒ `cycle_number` derivable del `condition`. |

### 4.4 Matriz de calidad de la evidencia

Universo: las 2 144 posiciones configuradas de las 268 unidades con inspección. Clasificación con la
política de `PLAN.md §3.2` (última inspección como evidencia; código normalizado `upper(btrim())`;
duplicado **dentro de la empresa** — entre empresas no es conflicto, §4.3).

Con la estrategia de **línea base perezosa** (`DECISIONES.md` D0) esta matriz ya no dimensiona un
backfill: dimensiona **qué tan bien va a quedar precargado el formulario de primer montaje** y
cuánto trabajo real queda para la persona que está delante del bus.

| Clase de evidencia | Posiciones | Unidades | Qué ve la persona al abrir la posición |
|---|---:|---:|---|
| Evidencia limpia y única | **1 660** (77,4 %) | 262 | Formulario **completo**: código, marca, modelo, medida, condición, RTD. Confirmar y listo. |
| Sin código en la inspección | **309** (14,4 %) | 157 | Formulario con marca/modelo/medida/RTD y **código en blanco**, obligatorio: lo lee del neumático. |
| Código duplicado en la empresa | **123** (5,7 %) | 78 | Formulario precargado + aviso de que ese código ya figura en otra posición; si el casco existe, se monta por `life_cycle_id`. |
| Ya ocupada por taller | 35 (1,6 %) | 8 | Nada que hacer: ya tiene línea base. |
| Sin medición en la última inspección | 17 (0,8 %) | 6 | Formulario en blanco: alta manual completa. |

**Ninguna** posición cayó en "el casco ya existe con ese código" fuera de las 8 unidades de taller
(0 colisiones con `tire_casings_company_code_uidx`).

#### El predicado correcto es "existe medición", no "existe código" (hallazgo de `task_01`)

Traducido a `baseline_pending` (`PLAN.md §3.2`): **2 092 posiciones (97,6 %)** están pendientes de
línea base — las tres primeras clases de la tabla. Hoy la UI las ofrece todas como "disponibles para
montaje", que es el bug.

`task_01` midió las dos variantes posibles del predicado y descartó una:

| Predicado | Posiciones pendientes | Problema |
|---|---:|---|
| Existe `tire_code` en la última inspección | 1 784 | Deja fuera las 309 posiciones **medidas sin código legible** |
| **Existe la medición** | **2 092** | — |

La evidencia que lo decide (`§4.3`, verificada el 2026-07-14): las 2 125 mediciones **siempre**
tienen `rtd_movi_mm` (2,0 a 17,0 mm, ningún cero), marca, medida y condición dentro del enum; y las
309 sin código tienen las tres. **Si el inspector midió la profundidad, había un neumático.** El
código es identidad, no existencia. Usar el código como predicado dejaría sin candado justo las
posiciones donde el código no se pudo leer — el caso que más lo necesita.

Solo 17 posiciones quedan legítimamente vacías (sin medición en la última inspección).

---

## 5. Convenciones de "Cambios" a migrar (inventario para el renombre)

### 5.1 Superficie pública (rompe enlaces si cambia sin alias)

| Elemento | Evidencia | Decisión propuesta |
|---|---|---|
| `?mode=cambios` | `mode-toggle.js:3` (`CHANGES: "cambios"`), `:8-11`, `:17-22` | **Migrar a `?mode=movimientos` + alias permanente de lectura.** Enlaces guardados en `knowledge/human/GUIA RENOVA/08 - Estado actual y futuro.md:25` y `tasks_cambios_neumaticos_ui/PRUEBA_CAMPO.md:21`. |
| Ruta de módulos `tire-change/…` | `Inspecciones por unidad.html:11` (CSS), `:1121` (`<script src="tire-change/cambios-controller.js">`) | Migrar carpeta; no hay deep-link externo a estos archivos. |
| `localStorage` `renova:tire-change:draft:…` / `:sealed:…` | `batch-store.js:1`, `:35`, `:39`, `:264` | Migrar prefijo **con lectura de compatibilidad**: un borrador en curso no se puede perder. |

### 5.2 Nombres internos que **no** deben migrar

| Nombre | Evidencia | Motivo |
|---|---|---|
| `confirm_tire_change_batch` | `20260714120000:33`; consumido en `rpc.js:9` | Está **aplicada en producción** (`20260714015430`). Renombrar exige nueva función + shim + coordinación de despliegue, sin beneficio para el usuario. |
| `tire_change_batches` | `20260714110000:9` | Ídem; además guarda historia auditable. |
| `v_unit_position_state`, `v_tire_inventory_available`, `fn_mount_existing_cycle` | `20260714100000:8,:77`; `20260714110000:60` | Ya son neutrales (no dicen "cambios"). |
| `supabase/tests/tire_change_batch.test.sql` | archivo | Prueba del contrato SQL, no de la UI. |

**Regla**: el renombre es de **producto y UI**. El esquema remoto conserva `tire_change` como
nombre técnico del lote y se documenta la equivalencia en el glosario.

### 5.3 Superficie interna a migrar (propiedad de CODEX)

- Carpeta `WEB/tire-change/` → `WEB/movimientos/` (16 archivos + `__tests__/` con 10 suites).
- `cambios-controller.js` → `movimientos-controller.js`; `tire-change.css` → `movimientos.css`.
- IDs del DOM `cambios-*` y `modo-cambios`, `tab-cambios`: `Inspecciones por unidad.html:529`,
  `:538-569`, `:577-578`, `:644`; referenciados en `mode-toggle.js:36-40`,
  `cambios-controller.js:74-87`, `inventory-ui.js:110`, `movements-ui.js:90`, `:115`.
- Clases CSS `tire-change-panel`, `tire-change-dock`, `stage.tire-change-mode`,
  `html[data-renova-mode="cambios"]`: `tire-change.css:49`, `:60-68`, `:228`, `:306-377`.
- Textos visibles: `Inspecciones por unidad.html:539` ("Entrá a Cambios…"), `:578` (etiqueta de la
  tab); `cambios-controller.js:99-113`, `:625`, `:646`.
- `package.json:2` (`"name": "renova-tire-change"`), `README.md:1`.
- Documentación: `WEB/tire-change/README.md`, `knowledge/ai/07 - Web dashboards y taller.md:29`,
  `knowledge/ai/13 - Glosario.md`, `knowledge/human/GUIA RENOVA/08 - Estado actual y futuro.md:25`.
- **Histórico, NO se reescribe**: `tasks_cambios_neumaticos/`, `tasks_cambios_neumaticos_ui/`,
  `tasks_opencode/`, `docs/run*` (autoridad "historia", `knowledge/ai/00 - LEER PRIMERO.md:43`).

---

## 6. Interacción entre línea base y el lote existente

- **Campos de expectativa**: el lote exige `expected_life_cycle_id` en toda posición **origen**
  (`20260714120000:181-186`, `:219-225`) y lo revalida bajo lock (`:383-399`), fallando con
  `[estado_desactualizado]` / `40001`. La UI los toma de `v_unit_position_state.life_cycle_id`
  (`data.js:1-30`).
- **Qué impide doble instalación**: `tire_installations_active_pos_uidx` y
  `tire_installations_active_cycle_uidx` (`20260706120000:218-221`), más las validaciones previas
  de `fn_validate_free_position:89-98` y `fn_mount_existing_cycle:104-117`. Cualquier creación de
  línea base hereda estos candados: **no puede** duplicar una instalación activa aunque se la
  ejecute dos veces.
- **Inventario/retén**: `v_tire_inventory_available`
  (`20260714100000:77-117`) lista ciclos activos de cascos activos **sin instalación activa**. Un
  primer montaje que cree ciclo e instalación en la misma transacción **no** infla el retén. Un
  casco creado sin instalación **sí** aparecería como retén fantasma: el diseño debe crear ciclo e
  instalación juntos o nada — que es exactamente lo que hace `register_full_installation:165-188` y
  lo que el helper extraído (`PLAN.md §2.1`) conserva.
- **Qué debe bloquearse antes del primer montaje**: hoy `confirm_tire_change_batch` sobre una unidad
  sin instalaciones acepta solo `mount` (los demás ops exigen origen ocupado). Es decir, la UI ya
  no puede rotar/retirar sobre vacío — pero **sí** puede montar inventario en una posición que en
  realidad está físicamente ocupada por un neumático nunca registrado. Ese es el riesgo operativo
  concreto que el gate de línea base debe cerrar (`PLAN.md §6`).

---

## 7. Brechas y riesgos

| # | Brecha | Impacto | Mitigación en el PLAN |
|---|---|---|---|
| B1 | No existe procedencia en `tire_installations` | Una línea base sembrada con datos de inspección sería indistinguible de un montaje de taller. Bloquea el requisito "no presentar inferencias como datos observados". | Migración mínima §3.1: enum `record_origin` + `origin` + `source_measurement_id`. |
| B2 | `inspection_measurements.life_cycle_id` está definido pero vacío en las 2 232 filas (`20260706120000:268`) | El enganche inspección↔taller nunca se activó. | El primer montaje lo puebla **solo** para la medición que confirma; no reescribe historia. |
| B3 | `otd_mm` no existe en las mediciones | Un ciclo sembrado desde una inspección no tiene OTD ⇒ sin `% consumo`. | Resuelto por el enfoque perezoso: **el formulario tiene un campo OTD** y la persona lo carga si lo sabe; si no, queda NULL (nunca inventado, `:60-61`). Ya no es una decisión de negocio. |
| B4 | 7 unidades reales con línea base **parcial** (2-6 de 6-8 posiciones) | Un backfill "todo o nada por unidad" las saltearía o las duplicaría. | Sin efecto en el enfoque perezoso: la línea base es **por posición**, y las ocupadas simplemente no ofrecen primer montaje. |
| B5 | 6 códigos con empate de fecha en 2 unidades; 123 posiciones con código duplicado | Un algoritmo tendría que adivinar cuál unidad lo tiene. | Sin efecto: **no hay algoritmo**. La persona ve el aviso y resuelve con el neumático delante; si el casco ya existe, lo monta por `life_cycle_id`. |
| B6 | 25 códigos cruzan empresas | Un `unique(code)` global sería incorrecto. | La unicidad es por empresa (`:176-177`): **no es conflicto**. Documentado, no requiere decisión. |
| B7 | Deriva de historial de migraciones remoto vs. local (`BASELINE_REMOTO.md:71-81`) | Entorno no reproducible 1:1. | Las tareas solo **agregan** objetos con timestamp > `20260714042911`. |
| B8 | El proyecto verificado es **producción** (`BASELINE_REMOTO.md:13-25`) | Cualquier error afecta datos reales. | El enfoque perezoso **no escribe datos en producción**: solo DDL aditivo, revisado por `sync-migration-reviewer`, con `down` probado y aprobación humana explícita. |
| B9 | Vistas remotas sin DDL versionado (`BASELINE_REMOTO.md:51-63`) | Un cambio podría romper `v_inventory_status`, `v_casing_*` sin que el repo lo muestre. | Ninguna tarea las modifica. Las columnas nuevas son aditivas. |
| B10 | El renombre toca 16 módulos + HTML + 10 suites | Un renombre masivo mezclado con cambio funcional es irrevisable. | `task_02` es **solo** renombre + alias, sin cambio de comportamiento, y va **antes** que la UI guiada para que los módulos nuevos nazcan con el nombre final. |
| B11 | `register_full_installation:165-188` ya hace los 3 `insert` que el primer montaje necesita | Reimplementarlos sería lógica duplicada y dos fuentes de verdad. | Extracción del helper `fn_create_casing_cycle_installation` (`PLAN.md §2.1`), mismo patrón que `fn_mount_existing_cycle` (`20260714110000:52-59`). `register_full_installation` conserva firma y comportamiento; `workshop_rpcs.test.sql` es el juez. |
| B12 | La línea base perezosa depende de que taller pase por cada unidad | Los jefes de flota no ven la flota completa hasta que eso ocurra; puede tardar meses o no ocurrir. | **Riesgo aceptado explícitamente por el humano** (`DECISIONES.md` D0). El diagnóstico de `task_01` mide el avance; si el ritmo no alcanza, el backfill masivo sigue siendo una opción posterior sobre exactamente los mismos contratos. |

---

## 8. Decisiones humanas

- **D0 (ya tomada, 2026-07-14)**: línea base **perezosa**, sin backfill masivo. Revisa el alcance
  fijado en `PROMPT_ORQUESTADOR.md:45-47`. Ver `DECISIONES.md`.
- **Pendientes**: D1 (etiqueta y visibilidad de la línea base), D2 (alcance del gate),
  D3 (vigencia del alias `?mode=cambios`).

El enfoque perezoso disolvió cinco decisiones que el enfoque masivo necesitaba (`otd_mm` inferido,
evidencia histórica vs. última, destino de las posiciones sin identidad, ventana/ejecutor del
backfill, política ante códigos ambiguos): todas se responden solas cuando quien decide es una
persona mirando el neumático.
