# Auditoría de flujos — ¿está listo para el lunes?

**Fecha:** 2026-07-25. **Alcance:** flujos de punta a punta de inspección, movimientos y
dashboards; suites de prueba de los tres frentes; contrato supervisor→operario; permisos y
datos reales en producción (solo lectura); **smoke autenticado en navegador de los 4 dashboards**.
**Base:** `verificacion/REPORTE.md` (2026-07-24) — esta auditoría verifica si aquello sigue abierto
y añade lo que faltaba mirar.

Commit auditado: `ddcc9d2`. Árbol limpio al iniciar.

> [!IMPORTANT]
> **Actualizado el 2026-07-25 tras la revisión del dueño de negocio.** Tres puntos cambiaron:
> 1. **H-02 se achicó 9×.** Medí 15.8 % de mediciones mal clasificadas contra
>    `specs/reglas_negocio.md` §3; contra la **regla real del negocio** son **1.8 % (40 de 2 247)**.
>    La spec estaba desactualizada. Ver `task_06`.
> 2. **H-11 tenía mal la causa.** La app de inspección **sí** valida que el odómetro no baje; el
>    origen de los 140 ceros es `WEB/importar.html:585` (`odometer_km: g.km ?? 0`). Ver `task_10`.
> 3. **H-10 y parte de H-11 son datos de prueba deliberados** (`QA-CN16`, unidad `5028`) que se van
>    a eliminar recargando la base limpia. Ver `task_09`.
>
> Comparación con el reporte independiente de Codex: `COMPARACION.md`.

---

## Veredicto

**El código está sano. Los datos que muestra, no.**

La ingeniería aguanta: las 8 suites pasan (385 pruebas), los dos APK compilan, el contrato
supervisor→operario es coherente campo por campo, RLS por empresa se sostiene, la cola de sync no
borra sin confirmación y las cuatro pantallas cargan con consola limpia. Las fórmulas del motor
tienen paridad Python/TS perfecta.

El problema apareció al abrir el navegador: **los números que un cliente va a leer el lunes están
mal**, y no por un error de cálculo sino por lo que entra a las fórmulas y por una regla de
negocio que quedó provisional.

- El KPI principal de Rendimiento muestra **138K km/mm**. El valor real de la flota es
  **~10 700 km/mm**: cinco neumáticos de prueba con un odómetro de 2.5 millones de km arrastran
  el promedio 13 veces hacia arriba.
- **La mitad de las inspecciones (140 de 288) tiene odómetro 0**, y una unidad declara
  **10 000 000 km** —visible en pantalla—. El odómetro es el denominador de todo Rendimiento.
- **40 de 2 247 mediciones de presión (1.8 %) están mal clasificadas**, 34 de ellas sobreinflado
  mostrado como «Normal». La ficha además imprime un rango normal incorrecto para la posición.
  *(Cifra corregida: contra la spec desactualizada daba 15.8 %; contra la regla real del negocio es
  1.8 %. Ver `task_06`.)*

Los dos primeros se resuelven con la recarga de base limpia que ya está prevista. El tercero es una
implementación pendiente, ahora que la regla real está declarada. **Ninguno se arregla escribiendo
más pruebas.**

| Bloqueante para el lunes | Estado |
|---|---|
| H-10 Rendimiento distorsionado 13× por datos de prueba | **En curso** — recarga de base limpia prevista |
| H-11 49 % de inspecciones con odómetro 0; una con 10M km | **En curso** — datos sí; el defecto del importador no |
| H-02 Presión: 1.8 % mal clasificado + rango impreso incorrecto | **Abierto** — regla real ya declarada, falta implementar |
| H-01 Datos de flota legibles sin login | **Abierto** — decisión + fix |
| H-04 Solo 1 de 4 empresas tiene operario | **Abierto** — provisión de cuentas |
| H-05 Orden de prueba colgada en la bandeja | **En curso** — la recarga debería llevársela |
| H-07 Voseo argentino en 7 textos de la demo | **Abierto** — fix mecánico |

| No bloqueante pero pendiente | Estado |
|---|---|
| H-03 Motor de cálculo con 3/7 funciones muertas + `idi` sin llegar a Supabase | Abierto |
| H-08 Estado RTD histórico recalculado con umbral vigente | Abierto desde 2026-07-24 |
| H-06 19 vistas con DML a `anon`/`authenticated` | Abierto, inerte hoy (verificado) |
| H-09 Sin CI ni comando único de verificación | Abierto desde `ddcc9d2` |
| H-12 Inventario muestra el correo del usuario en vez de la empresa | Abierto — cosmético, visible |
| H-13 Pastilla «Incluyendo 0 datos antiguos» con contador en 0 | Abierto — cosmético |

**Los tres primeros comparten una misma causa raíz que conviene nombrar:** el sistema **no valida
lo que entra**. Acepta odómetro 0, acepta 10 millones de km, y convive con datos de prueba
indistinguibles de los reales. Las suites verdes no lo detectan porque prueban las funciones, no
la plausibilidad de los datos.

---

## Lo que se verificó verde

No es relleno: son las cosas que se puede afirmar sin hedging el lunes.

- **`app/`**: `oxlint` sin hallazgos, **47/47** pruebas, build limpio.
  (`evidencia/A-app-lint-test-build.txt`)
- **`app movimientos/`**: **5/5** pruebas, build limpio.
  (`evidencia/B-app-movimientos-test-build.txt`)
- **`WEB/`**: **333** pruebas verdes en 6 suites — movimientos 186, shared 50, servicios 38,
  rendimiento 25, buscador 19, inventario 15. (`evidencia/C-web-suites.txt`)
- **`npm run docs:check`**: 38 notas IA + 12 humanas validadas.
- **Bundle de despliegue coherente**: se contrastó cada `src`/`href`/`from` de los 7 HTML de
  `WEB/` contra la lista de copia de `scripts/prepare-static-hosting.mjs`. Cero referencias
  huérfanas: lo que se publica es lo que los dashboards piden.
- **RLS por empresa se sostiene**: como `anon`, las cuatro vistas principales de dashboard
  devuelven **0 filas** (`evidencia/D-supabase-lecturas.md` §D4). No hay mezcla entre empresas
  por esa vía.
- **Los grants amplios de H-06 son inertes**: **ninguna** vista de `public` es
  auto-actualizable (§D5), así que hoy el `INSERT/UPDATE/DELETE` concedido no se puede usar.
- **Contrato supervisor→operario coherente**: los campos que emite
  `WEB/movimientos/supervisor-order-model.js` (`normalizeItem` / `inventoryEntry`) son
  exactamente los que consume `app movimientos/src/lib/model.ts` (`newExecutionItem`), incluidos
  `origin_type`, `origin_position`, `life_cycle_id` y el fallback legacy `ROTAR/DESDE P<n>`.
  Los roles también cuadran: `SUPERVISOR_ORDER_ROLES` en web incluye `fleet_manager`, y la
  migración `20260720022451` lo autoriza tanto en la política RLS como dentro de
  `create_tire_movement_order`.
- **Las 4 pantallas cargan autenticadas con consola limpia** y exigen sesión antes de cualquier
  fetch (verificado en vivo, `evidencia/E-smoke-navegador.md`).
- **Servicios es la pantalla mejor resuelta del conjunto**: explica sus propios límites en prosa,
  marca «ORIGEN NO DETERMINADO» y «SIN REEMPLAZO REGISTRADO» donde corresponde en vez de inventar
  un pareo, y no ejecuta movimientos. Hace exactamente lo que ADR-0008 dice que debe hacer.
- **Las fórmulas de Rendimiento son correctas.** `km_per_mm = km_run / rtd_worn_mm` da valores
  plausibles con datos reales (unidad 225 → 19 598 km/mm; unidad 5021 → 15 622 y 10 414). El
  problema de H-10 es el dato de entrada, no el cálculo.
- **`terminarInspeccionesDelDia` no borra a ciegas**: solo elimina la copia local con
  confirmación positiva de envío, y una cabecera sin fila en cola se encola y se pushea antes de
  considerarse borrable (`app/src/sync/terminarInspeccion.ts:42-55`). La invariante
  offline-first de `CLAUDE.md` se respeta.

---

## Hallazgos

### H-10 — Alto · Datos · **verificado en pantalla**

**El KPI principal de Rendimiento está 13 veces por encima de la realidad por 5 neumáticos de
prueba.**

La pantalla muestra **138K km/mm**, **1.9M km proyectados** y **1.3M km acumulados**. Un neumático
de bus no rinde 138 000 km por milímetro.

| origen | neumáticos | km/mm promedio |
|---|---|---|
| QA-TEST (`QA-CN16`) | 5 | **233 542** |
| Real | 14 | **10 717** |
| Mezcla que ve la pantalla | 19 | 69 355 |

La unidad `QA-CN16` tiene `odometer_at_install = 200 000` y `current_odometer_km = 2 500 001`:
2.3 millones de km en un solo ciclo. Cinco neumáticos con ese dato dominan el promedio de
diecinueve.

Los 9 cascos y 14 mediciones `QA-TEST` ya estaban en el roadmap como deuda pendiente de decisión
humana. Lo que no estaba medido es **cuánto distorsionan**: no ensucian el margen, definen el
número grande de la pantalla.

Evidencia: `evidencia/E-smoke-navegador.md` §E1.

→ `task_09`.

### H-11 — Alto · Datos · **verificado en pantalla**

**La mitad de las inspecciones tiene odómetro 0, y una unidad declara 10 millones de km.**

| empresa | inspecciones | odómetro 0 | máximo |
|---|---|---|---|
| MÓVIL BUS | 109 | **86 (79 %)** | **10 000 000** |
| CIVA | 114 | 47 (41 %) | 3 185 857 |
| ITTSABUS | 65 | 7 (11 %) | 2 921 296 |
| **total** | **288** | **140 (48.6 %)** | |

Los 10 000 000 km de la unidad 5028 **se muestran tal cual** en el encabezado de Inspecciones por
unidad. Un cliente lo ve sin buscarlo.

El odómetro es el denominador de todo el módulo de Rendimiento: `km_run`, `km_per_mm`,
`km_projected`, `cost_per_km` y `consumption_pct` dependen de él. Con la mitad de las lecturas en
0, cualquier métrica de consumo se calcula sobre la fracción que sobrevive.

Ni `save_inspection` ni el formulario de la app rechazan un 0 ni un valor imposible. La app de
movimientos sí valida —`validateDraft` exige entero ≥ 0 y no menor al último conocido
(`app movimientos/src/lib/model.ts:130-134`), y la RPC lo repite server-side—; **la app de
inspección no tiene ese control.** Dos caminos escriben el mismo campo con reglas distintas.

Nota de honestidad: la franja de 1.5M–3.2M km (60 inspecciones) **no la califico como error**. Un
bus interprovincial peruano de muchos años puede acercarse a esas cifras; hay que confirmarlo con
el cliente antes de tratarlo como dato sucio. Los ceros y los 10 millones sí son inequívocos.

Evidencia: `evidencia/E-smoke-navegador.md` §E2.

→ `task_10`.

### H-01 — Alto · Seguridad · **verificado en vivo**

**Cualquiera con la clave pública lee la flota de cualquier empresa sin iniciar sesión.**

`anon` tiene `EXECUTE` sobre tres RPC `SECURITY DEFINER` — `get_unidad_preload`,
`get_umbrales_rtd` y `save_inspection` — que por definición **no pasan por RLS**. Ejecutando
como `anon` contra producción:

```sql
set local role anon;
select count(*) from public.get_unidad_preload('MÓVIL BUS', '2145');  -- → 14 filas
select count(*) from public.get_umbrales_rtd('CIVA');                 -- → 1 fila
```

Catorce neumáticos de una unidad real devueltos sin sesión. La clave publicable está commiteada
en `WEB/supabase-config.public.js` y se copia al bundle estático publicado, así que el requisito
es «tener la URL del dashboard».

El gate `RenovaSupabase.requireAuth()` de los dashboards **no protege esto**: cierra la puerta de
la UI, no la de la API. Y como la protección real declarada en el propio comentario del archivo
de config es «RLS por empresa», el razonamiento se rompe exactamente en las funciones que la
saltan por diseño.

El lado de escritura es peor de contar que de explotar, pero es el mismo agujero:
`save_inspection` resuelve la empresa **por nombre** desde el payload
(`app/src/sync/pushInspeccion.ts:35`), así que un tercero puede insertar inspecciones en la
empresa que elija.

Esto no es un descubrimiento del aire: `knowledge/ai/10 - Roadmap deuda y riesgos.md` ya registra
«la app móvil de inspecciones opera como `anon`, sin identidad de inspector». Lo que no estaba
registrado es **la consecuencia medida**: lectura de datos de cliente por internet, hoy, con una
llave que está en el repo.

→ `task_01`. Requiere decisión: no se puede revocar `anon` sin dejar la app de inspección sin
poder sincronizar.

### H-02 — Alto · Lógica · abierto desde 2026-07-24, **ahora cuantificado**

**1 de cada 6 mediciones de presión está mal clasificada, y la ficha imprime un rango incorrecto.**

`fn_pressure_state_fixed(p_psi)` aplica un umbral plano 100/130 PSI para toda medida y todo eje.
La spec §3 exige `presion_ref` con deltas por empresa/medida/tipo de eje: 315/80R22.5 Tracción
tiene ref 115 → «Alta Presión» desde 122 PSI, que la regla plana muestra «Normal».

**Lo que se vio en pantalla.** La ficha de P1 (DELANTERA IZQUIERDA, 315/80R22.5) imprime
literalmente «PRESIÓN 110 PSI · RANGO NORMAL: **100-130 PSI** · NORMAL». Para una posición de
Dirección en esa medida la spec fija el rango normal en **99–115.5 PSI**. La pantalla no solo
clasifica distinto: **afirma un rango que no corresponde a esa posición**.

**Lo que se midió.** Contraste sobre las 698 mediciones de 315/80R22.5 del dashboard:

| lo que muestra | lo que dice la spec | n | % |
|---|---|---|---|
| Normal | Normal | 424 | 60.7 % |
| Sin Medir | Sin Medir | 155 | 22.2 % |
| **Normal** | **Alta Presión** | **105** | **15.0 %** |
| Baja Presión | Baja Presión | 9 | 1.3 % |
| Baja Presión | Normal | 3 | 0.4 % |
| Normal | Baja Presión | 2 | 0.3 % |

**110 mediciones (15.8 %) mal clasificadas**, 105 de ellas en el sentido que más importa:
sobreinflado presentado como normal. Un jefe de flota que use esta columna para decidir no ve uno
de cada seis problemas de presión. Evidencia: `evidencia/E-smoke-navegador.md` §E3.

Lo que agrega esta auditoría al reporte de ayer: **la implementación correcta ya existe y nadie
la llama.** `calcularEstadoPresion` está en `app/src/core/calculations.ts:74`, cumple la spec, y
tiene paridad Python/TS verificada. Su único llamador en todo el repo es su propia prueba. La app
de inspección **no muestra estado de presión en ningún lado** — `FormBody.tsx` captura el número
y nada más. Es decir: no hay divergencia app-vs-web, hay una sola regla en producción y es la
incorrecta.

Mitigante real: está documentado como provisional en `WEB/Inspecciones por unidad.html:794`.
No está oculto. Pero un jefe de flota que mire el dashboard el lunes no lee ese comentario.

→ `task_06`. Bloqueado por la decisión abierta de presión CALIENTE.

### H-03 — Alto · Lógica

**Tres de las siete funciones del motor de cálculo no las ejecuta nadie, y el IDI nunca sale del
dispositivo.**

Mapa de llamadores reales en `app/src/` (excluyendo pruebas y el propio `calculations.ts`):

| función | llamador |
|---|---|
| `calcularRtdMovi` | `inspeccionRepo.ts:117` |
| `calcularIdi` | `inspeccionRepo.ts:118` |
| `calcularEstadoRtd` | `inspeccionRepo.ts:119` |
| `calcularIsaPeso` | `inspeccionRepo.ts:128` |
| **`calcularEstadoPresion`** | **ninguno** |
| **`calcularVur`** | **ninguno** |
| **`calcularTasaDesgaste`** | **ninguno** |

El «motor de cálculo con paridad perfecta 48/48» es cierto y es un buen resultado, pero certifica
en parte reglas que no corren. Conviene saberlo antes de presentarlo como garantía de que los
números de la pantalla son correctos: para VUR, tasa de desgaste y estado de presión, el motor no
es la fuente de nada.

A eso se suma lo ya reportado ayer y todavía abierto: `calcularIdi` sí corre y se persiste local,
pero `pushInspeccion.ts` no lo incluye en el payload y no existe columna remota — ningún
dashboard puede mostrar jamás el Índice de Desgaste Irregular.

→ `task_07`.

### H-04 — Medio-Alto · Demo · **verificado en producción**

**Tres de las cuatro empresas no pueden ejecutar el flujo de movimientos: no tienen operario.**

Perfiles activos hoy (§D1): 4 `fleet_manager` (uno por empresa) y **1 solo `operator`, en MÓVIL
BUS**. Cero perfiles `tire_supervisor` — funciona igual porque la migración de compatibilidad
autoriza `fleet_manager`, así que la emisión web está cubierta.

Consecuencia concreta: si el lunes se demuestra CIVA, CRUZ DEL SUR o ITTSABUS, el supervisor
puede **emitir** la orden y nadie puede **tomarla ni ejecutarla** — `claim_tire_movement_order`
exige rol `operator` de la misma empresa. El recorrido se corta a la mitad, en vivo.

Está anotado como decisión bloqueante en el roadmap («crear y provisionar cuentas reales»), pero
sin el número: hoy es 1 de 4.

→ `task_04`. Alternativa sin tocar nada: fijar el guion de demo en MÓVIL BUS.

### H-05 — Medio-Alto · Demo · **verificado en producción**

**Una orden de prueba lleva cinco días colgada y va a aparecer en la bandeja del operario.**

La orden `63b5ccf7-a095-443d-b056-82601ff3e456` está `in_progress` desde el 2026-07-20, asignada,
sobre la unidad `QA-CN16` — la unidad de datos de prueba ya conocida (§D3). `loadMovementOrders`
en la app trae `issued`, `in_progress` y `completed` sin filtrar, así que el operario de MÓVIL
BUS la ve al abrir la app, junto a la orden completada del 2026-07-21 sobre la misma unidad QA.

Es cosmético en cuanto a datos, pero es lo primero que se proyecta en pantalla.

Contexto ya conocido y **no** resuelto: 9 cascos y 14 mediciones `QA-TEST` mezclados con datos
reales, que el roadmap marca como pendiente de decisión humana explícita (no de borrado de
oficio).

→ `task_03`.

### H-06 — Medio · Higiene de permisos · **alcance mayor al reportado**

**19 vistas, no 4, tienen `INSERT/UPDATE/DELETE/TRUNCATE` concedido a `anon` y `authenticated`.**

El reporte del 2026-07-24 identificó 4. El barrido completo (§D6) da 19, con el patrón inequívoco
de un `GRANT ALL ON ALL TABLES IN SCHEMA public` histórico. Cinco vistas están correctas
(`v_operator_movement_orders`, `v_search_index`, `v_tire_inventory_available`, `v_tire_services`,
`v_unit_position_state`: solo `SELECT` a `authenticated`), lo que confirma que las nuevas se
hicieron bien y las viejas arrastran el descuido.

**Severidad rebajada con evidencia**: ninguna vista de `public` es auto-actualizable (§D5), así
que ningún `INSERT`/`DELETE` prospera hoy. El riesgo es futuro: el día que alguien simplifique una
de estas vistas, el permiso ya está puesto.

→ `task_02`. Mecánico, de bajo riesgo, con `sync-migration-reviewer`.

### H-07 — Medio · Idioma · viola `CLAUDE.md`

**Siete textos visibles usan voseo argentino, y tres están en el camino de la demo.**

`CLAUDE.md` es explícito: español neutro cercano al uso peruano, prohibido «podés», «revisá»,
«ingresá». Barrido completo del repo (excluyendo `node_modules` y `dist`):

| archivo:línea | texto | ¿en la demo? |
|---|---|---|
| `supabase/migrations/20260720012248…sql:170` | «Necesitás iniciar sesión…» | sí — login del operario |
| `supabase/migrations/20260720012248…sql:365` | «Primero debés tomar esta orden.» | sí — toma de orden |
| `WEB/servicios/servicios-controller.js:239` | «Verificá la conexión e intentá nuevamente.» | sí — error de carga de Servicios |
| `supabase/migrations/20260712000000…sql:39` | «Necesitás iniciar sesión para operar…» | taller |
| `supabase/migrations/20260714120000…sql:391` | «…Recargá el estado de la unidad y rearmá…» | taller (lote desactualizado) |
| `supabase/migrations/20260714120000…sql:396` | ídem | taller |
| `supabase/migrations/20260714120000…sql:568` | «Recargá el estado y reintentá.» | taller |

Los mensajes de las RPC llegan crudos a la pantalla: `ExecutionScreen.tsx:39` y `:68` muestran
`cause.message` tal cual. Un cliente peruano lee «debés» en la primera pantalla que toca.

(`app/src/db/sqlite.ts:3` también tiene voseo, pero es un comentario de código, no texto visible —
queda fuera del arreglo.)

→ `task_05`.

### H-08 — Alto · Reproducibilidad · abierto desde 2026-07-24

**El estado RTD del dashboard se recalcula con el umbral vigente, no con el snapshot histórico.**

Sin cambios respecto del reporte de ayer, y confirmado que sigue así en el código: la app envía
`rtd_for_change` / `rtd_next_change` en el payload (`pushInspeccion.ts:63-65`) y la versión
vigente de `save_inspection` no tiene columna donde aterrizarlos; `fn_rtd_state` recalcula con
`fn_effective_rtd_thresholds(empresa, medida)`. Si una empresa cambia sus umbrales, el estado de
todas sus inspecciones pasadas cambia retroactivamente, que es exactamente lo que la
funcionalidad de snapshots decía evitar.

Relacionado y también sin resolver: `fn_rtd_state` **no está definida en ningún archivo de
`supabase/migrations/`** pese a ser crítica para `save_inspection`. Existe y corre en producción;
reconstruir el esquema desde cero con solo los archivos versionados rompería el sync.

→ `task_07`.

### H-09 — Medio · Proceso

**No hay forma de correr «todo» de un tirón, y ya no hay CI.**

Las 385 pruebas viven en 8 suites con 8 invocaciones distintas. No existe script raíz que las
corra juntas, y `.github/workflows/` se eliminó en `ddcc9d2` («licencia y eliminando github
action»). Para una semana en la que el criterio es «que la lógica esté impecable», la
verificación depende de que alguien recuerde los ocho comandos.

Además, `WEB/rendimiento/__tests__` (25 pruebas) y `WEB/shared/__tests__` (50 pruebas) **no
tienen `package.json` ni `vitest.config.js`**, a diferencia de las otras cuatro. Corren si se
invoca `npx vitest run` a mano en el directorio —se comprobó, pasan— pero cualquier script que
itere buscando `package.json` las saltea en silencio. Son 75 pruebas, el 19 % del total, que un
runner ingenuo daría por inexistentes. `WEB/neumaticos/__tests__` está directamente vacío.

→ `task_08`.

### H-12 — Bajo · UI · **verificado en pantalla**

**Inventario muestra el correo de la cuenta en lugar del nombre de la empresa.**

La insignia de sesión de Inventario dice `SN · SUPERVISOR DE NEUMÁTICOS · Y1UEKZD7G@MOZMAIL.COM`.
Las otras tres pantallas muestran `· MÓVIL BUS` en ese mismo lugar: Inventario cae a un fallback
distinto al del resto del shell.

Es cosmético, pero proyecta un correo personal en pantalla durante una demo con cliente. Encaja
con la deuda ya registrada de «navegación duplicada a mano en los 7 HTML en vez de un componente
compartido»: cada pantalla resuelve la insignia por su cuenta y una se desvió.

→ `task_11`.

### H-13 — Bajo · UI · **verificado en pantalla**

**Rendimiento muestra la pastilla «Incluyendo 0 datos antiguos ×» con el contador en cero.**

Anuncia una inclusión que no incluye nada, y ocupa un lugar destacado junto a los filtros activos.
Con contador 0 no debería renderizarse.

→ `task_11`.

---

## Deuda ya conocida que sigue vigente (no re-auditada, solo confirmada)

Estas ya están en `knowledge/ai/10 - Roadmap deuda y riesgos.md`; se listan porque tocan lo que
se va a mostrar:

- **`reconciliation_status` sigue `pending` al 100 %** (8 de 8 ejecuciones, §D2). Servicios mide
  actividad declarada, no consumo ni vida útil. Ya se expone como faceta para no aparentar
  completitud.
- **`tire_movement_executions` no está en la publicación `supabase_realtime`**; mitigado en
  cliente con sondeo cada 10 s. No bloquea la demo.
- **Identidad de neumático desincronizada** entre inspección y `tire_installations` (caso unidad
  225, posición 3, sin movimiento que lo explique).
- **2 183 de 2 247 mediciones sin `life_cycle_id`** → consumo por ventana no disponible.
- **~2 094 posiciones en `baseline_pending`**: la flota no está sembrada; es el diseño acordado,
  no un fallo.
- **Variantes de caja en `brand_name`** (13 mediciones): parte marcas en filas separadas en
  Rendimiento.
- **`drainQueue` no agenda un despertar autónomo** al vencer el backoff.
- **Sin `manualChunks`** en `vite.config.ts`: el bundle principal de `app/` pesa 560 kB y el build
  lo advierte.

---

## Qué haría antes del lunes, en orden

**Lo que cambia lo que el cliente ve:**

1. `task_09` — sacar `QA-TEST` de las agregaciones. Es el arreglo con mayor efecto por hora
   invertida: convierte el KPI de Rendimiento de 138K a ~10.7K km/mm, es decir, de imposible a
   creíble. Resuelve además H-05 (la orden colgada es de la misma unidad) y limpia el 40 % de la
   lista de Servicios.
2. `task_10` — decidir qué hacer con los odómetros en 0 y con los 10 000 000 km. Aunque sea excluir
   esas filas de las agregaciones y mostrar «dato no disponible»: es preferible a un promedio
   calculado sobre la mitad de la muestra sin decirlo.
3. `task_06` — presión. **Es la decisión que no se puede seguir postergando.** No hace falta
   resolver CALIENTE para arreglar lo peor: basta con dejar de imprimir «RANGO NORMAL: 100-130 PSI»
   en una posición cuyo rango es 99–115.5. Si la regla completa no llega, que la ficha no afirme un
   rango.

**Lo que evita una pregunta incómoda:**

4. `task_05` — quitar el voseo. Una hora, incluye una migración de solo texto.
5. `task_04` — decidir: provisionar operarios o fijar la demo en MÓVIL BUS. Media hora si es lo
   segundo.
6. `task_11` — los dos defectos cosméticos vistos en pantalla (correo en Inventario, pastilla
   vacía). Minutos, y uno de ellos proyecta un correo personal.
7. `task_01` — decidir qué hacer con la exposición `anon`. **Es una decisión, no un fix**: cerrarla
   a lo bruto deja la app de inspección sin sincronizar. Lo mínimo honesto para el lunes es saber
   que está así y no afirmar que los datos requieren login.

**Después del lunes:** `task_02` (grants), `task_07` (motor de cálculo sin destino, RTD histórico)
y `task_08` (verificación de un tirón).

## Una observación que no es un hallazgo

Los tres problemas que más se van a notar el lunes —H-10, H-11 y H-02— **no los habría detectado
ninguna suite de pruebas**, y de hecho ninguna los detectó: 385 pruebas verdes conviven con un KPI
13 veces desviado. Las pruebas verifican que las funciones calculan bien; nadie verifica que lo que
entra sea plausible ni que lo que sale tenga sentido físico.

Si después de esta semana queda espacio para una sola mejora estructural, la más rentable no es
más cobertura unitaria: es un chequeo de plausibilidad sobre los datos (odómetro que no retrocede
ni salta millones, km/mm dentro de un rango físico, marca de datos de prueba) que corra sobre
producción y avise cuando un número deje de tener sentido. Es exactamente lo que faltó acá.
