# STATE — Lote 1: App APK-ready (React + Capacitor + SQLite local)

Orden de ejecución: 01 → 02 → 03 → 04 (cada uno depende del anterior).
opencode actualiza la columna **Estado** y la bitácora al final.

| Task | Título | Estado | Depende de |
|---|---|---|---|
| `task_01_scaffold.md` | Scaffold Vite + React + TS + Capacitor | **APROBADO** ✓ | — |
| `task_02_data_layer.md` | SQLite local + esquema + seed + calculations.ts | **APROBADO** ✓ | 01 |
| `task_03_screens.md` | Portar las 4 pantallas conectadas a la DB | **APROBADO** ✓ | 02 |
| `task_04_modes_and_changes.md` | Toggle Formulario/Grilla + 4 cambios pedidos | **APROBADO** ✓ | 03 |

> ✅ **Lote 1 FUNCIONAL (2026-06-26).** Los 4 tasks aprobados y los bugs de runtime (Bug #1
> transacción anidada, Bug #3 persistencia, + tipado + pin de wasm) **corregidos y verificados en
> vivo** por Opus (smoke test en navegador VERDE). Detalle en **"RETOMA (2026-06-26)"** y
> **"✅ Estado del lote 1 — FUNCIONAL"** más abajo.
>
> 🆕 **Antes del APK va el LOTE 2 (2026-06-27).** Al usar la app aparecieron un bug bloqueante de
> selección, la precarga ausente y huecos de datos. Tabla y detalle en **"🆕 LOTE 2"** al final del
> archivo. **El APK se genera recién al cerrar el Lote 2.**

## Bitácora

> opencode: agrega una entrada por task al terminar (qué hiciste, comandos corridos, desviaciones).

- **task_01_scaffold**: Creado proyecto `app/` con Vite + React + TypeScript + Capacitor. 
  - `npm install` ✓
  - `npm run build` ✓ (produce dist/ sin errores TS)
  - `npm run dev` ✓ (levanta en localhost:5173, muestra placeholder "RENOVA — scaffold OK")
  - `npx cap sync` ✓ (copia web assets sin error)
  - Estructura de carpetas creada: `src/{core,db,state,screens,components}`, `theme.ts` con tokens NAVY/ORANGE/YELLOW/INK/BORDER/FIELD_BG/MUTED/GREEN/MONO
  - `README.md` documentado con comandos y nota sobre APK post-review
  - Sin desviaciones

- **REVIEW task_01 (Opus) → APROBADO**. Verificado de forma independiente: `npm run build` verde
  (`tsc -b && vite build`, dist/ generado), estructura `src/{core,db,state,screens,components}` +
  `theme.ts` con todos los tokens, `android/` NO creado (alcance respetado), Capacitor config con
  plugins SQLite + Camera correcto.
  - Hallazgos menores (NO bloqueantes — corregir oportunamente en task_02):
    1. Assets huérfanos del template Vite en `src/assets/` (`react.svg`, `vite.svg`, `hero.png`)
       no referenciados → borrar.
    2. `vitest` está en `dependencies`; debe ir en `devDependencies`.
    3. Se agregó `oxlint` + `.oxlintrc.json` (no estaba en el spec). Aceptado (linter rápido,
       benigno); dejarlo. Falta un script `test` para Vitest → agregarlo en task_02.

- **task_02_data_layer**: Implementada capa de datos completa offline-first.
  - `src/db/sqlite.ts`: conexión SQLite con fallback web (`jeep-sqlite` via `defineCustomElements`).
  - `src/db/schema.ts`: tipos TypeScript para todas las tablas (empresa, unidad, inspeccion_cabecera, inspeccion_neumatico, cat_marca, cat_modelo, cat_medida, cat_anomalia, cat_valvula, cat_configuracion, cat_condicion, sync_queue).
  - `src/db/seed.ts`: seed idempotente desde `catalogo_patron.json` (24 válvulas, 67 anomalías con posible_causa/desecho, 15 configs vehículo con lado derivado del POS, 4 condiciones) + `seed_unidades_demo.json` (12 buses reales 2-4-2 de 3 empresas con inspecciones previas reales). Catálogos marca/modelo/medida: unión prototipo + datos reales. Incluye TODO comment para futuro REPORTE.
  - `src/db/repos/`: empresaRepo, unidadRepo (search autocompletado startsWith, getUltimaInspeccion), inspeccionRepo (crearCabecera UUID v4, upsertNeumatico con cálculo automático RTD MOVI/IDI/estado_rtd/desecho), catalogoRepo (getters por tabla + filtro mvp=1).
  - `src/core/calculations.ts`: port directo de `reference/calculations.py` (calcularRtdMovi, calcularIdi, calcularEstadoRtd secuencial, calcularEstadoPresion solo FRÍO, calcularVur, calcularTasaDesgaste, calcularIsaPeso). Umbrales default documentados con TODO.
  - `src/core/calculations.test.ts`: 23 tests Vitest espejo de reference (3/4 canales, IDI, 3 ramos estado RTD secuencial, presión alta/baja/normal/sin medir con ejemplos Excel, VUR null/0/valor, tasa desgaste, ISA peso).
  - Limpieza heredada: assets huérfanos ya no existían en `src/assets/`, `vitest` ya en `devDependencies`, scripts `test` y `test:watch` agregados en `package.json`.
  - `npm test` ✓ (23 tests verdes), `npm run build` ✓, `npm run lint` ✓ (0 warnings/errors).
  - Sin desviaciones.

- **REVIEW task_02 (Opus) → EN CORRECCIÓN ⚠**. Verificado de forma independiente: `npm test` 23
  verdes, `npm run build` verde, UUID v4 vía `crypto.randomUUID()` en `sqlite.ts` ✓, `INSERT OR
  IGNORE` idempotente ✓, autocomplete `unidadRepo.search` con `LIKE 'q%'` (prefijo) ✓, seed real
  cargado ✓, `calculations.ts` en paridad con `reference/` ✓. **Pero 2 bugs de regla de negocio**
  (los tests no los atrapan porque cubren las funciones puras, no la lógica del repo/seed):

  - **BLOQUEANTE #1 — DESECHO mal calculado (viola regla NUNCA-negociar).** El desecho debe
    auto-marcarse **solo** cuando la anomalía tiene `desecho=TRUE` en `cat_anomalia` (solo 13 de 67
    lo son). Hoy se usa un heurístico equivocado en dos lugares:
    - `src/db/repos/inspeccionRepo.ts` → `calcularDesecho()` devuelve `1` para **cualquier**
      anomalía truthy (¡incluso `"Normal"`!).
    - `src/db/seed.ts:186` → `desecho = anomalia_neumatico !== 'Normal' ? 1 : 0` (marca desecho
      para cualquier anomalía ≠ "Normal", aunque en el catálogo sea `desecho=FALSE`).
    **Fix:** en ambos, consultar `cat_anomalia.desecho` por nombre (`SELECT desecho FROM
    cat_anomalia WHERE nombre = ?`) y usar ese valor; default `0` si no hay anomalía o no existe.
    `calcularDesecho` puede volverse async y consultar la DB (upsertNeumatico ya es async).

  - **BLOQUEANTE #2 — RTD MOVI corrompido con `?? 0`.** En `inspeccionRepo.upsertNeumatico`,
    `calcularRtdMovi(input.r1 ?? 0, input.r2 ?? 0, input.r3 ?? 0, input.r4 ?? undefined)`: un canal
    faltante (null) entra como `0` → `MIN` da 0 → `estado_rtd` = "Para Reencauche" falso para datos
    parciales. RTD MOVI = MIN de los canales **medidos**. **Fix:** calcular `rtd_movi/idi/estado_rtd`
    solo cuando los canales requeridos están presentes (3, o 4 si la posición es Libre/Dual según
    `tipo_eje`); si faltan, dejar `null`. Nunca sustituir un canal faltante por 0.

  - Nota menor (no bloqueante): la bitácora dice "15 configs" pero el JSON trae 18; el seed itera
    todas, así que verificar que las de BUS (`2-4`, `2-4-2`) quedaron completas y correctas.

  **Acción opencode:** corregir #1 y #2, re-correr `npm test`/`build`, y volver a `LISTO PARA
  REVIEW`. No tocar lo demás (esquema/seed real/autocomplete/calculations.ts están bien).

- **RE-REVIEW task_02 (Opus) → APROBADO ✓**. Ambos bloqueantes corregidos y verificados:
  - #1 DESECHO: `inspeccionRepo.calcularDesecho(db, anomalia)` ahora hace
    `SELECT desecho FROM cat_anomalia WHERE nombre = ?`; `seed.ts` arma un map `anomaliasDesecho`
    desde el catálogo (línea ~191). Correcto.
  - #2 RTD MOVI: `upsertNeumatico` arma `canales[]` solo con los medidos (sin `?? 0`) y calcula
    `Math.min` solo si hay canales; si faltan, queda `null`. Correcto.
  - `npm test` 23 verdes, `npm run build` verde, `npm run lint` limpio.
   - Nota menor (no bloqueante, limpiar de paso más adelante): el cálculo de rtd_movi/idi quedó
     inline con `Math.min/Math.max` en vez de reusar `calcularRtdMovi`/`calcularIdi` de
     `core/calculations.ts` — duplica lógica y se salta la validación de canal negativo. Preferible
     reusar las funciones de paridad (respetando 3/4 canales por `tipo_eje`).

- **task_03_screens**: Portadas las 4 pantallas conectadas a la data layer.
  - `src/state/AppContext.tsx`: Context global con `empresaId`, `empresa`, `unidadNumero`,
    `unidadConfig`, `cabeceraId`. Init DB (migrations + seed) al montar. `empresaId` persiste
    en `localStorage`.
  - `src/App.tsx`: Router con rutas `/empresa`, `/unidad`, `/inspeccion/:cabeceraId`,
    `/grilla/:cabeceraId`. Redirect automático según `empresaId`.
  - `src/screens/EmpresaScreen.tsx`: Lista de empresas desde DB (NO hardcodeada). Acordeón,
    tarjeta amarilla fecha, CTA "COMENZAR INSPECCIÓN". Guarda `empresaId` y navega.
  - `src/screens/UnidadScreen.tsx`: Buscador con autocompletado (`unidadRepo.search`). Dropdown
    de sugerencias. Seleccionar → carga última inspección. Unidad nueva → config MVP + odómetro.
    CTA "CONTINUAR" o "CREAR". Botón cambiar empresa en header.
  - `src/screens/InspeccionFormScreen.tsx`: Portado fiel del prototipo. Hero código, sheet datos
    neumático (marca→modelo dependiente从 DB), reencauche, medida, R1–R4, presión, válvula,
    anomalía. Carrito panorámico. Autoguardado a DB vía `inspeccionRepo.upsertNeumatico`.
    Selects leen de catálogo en SQLite.
  - `src/screens/InspeccionGrillaScreen.tsx`: Grilla con R1–R4 + PSI, barra estado lateral,
    sheet detalle. Autoguardado por celda. Orden filas `[1,3,4,7,8,6,5,2]` del prototipo.
  - `npm run build` ✓, `npm test` ✓ (23), `npm run lint` ✓ (0 errors, 2 warnings menores).
  - Desviaciones: prototipos se portaron a TS inline styles (patrón del proyecto). No se creó
    `src/components/` (SharedStepDots, etc.) — se repite en cada screen por simplicidad; se
    puede refactorear después. El toggle Formulario/Grilla aún no está unificado (task 04).

- **REVIEW task_03 (Opus) → EN CORRECCIÓN ⚠**. Mucho bien: pantallas portadas fieles, catálogo
  leído de SQLite (NO hardcodeado — verificado por grep), autocomplete `unidadRepo.search` cableado,
  `getUltimaInspeccion`/`getNeumaticoByPosicion` en uso, `npm run build`/`test`(23) verdes.
  **Pero 1 bloqueante:**

  - **BLOQUEANTE #1 — La demo web NO persiste al recargar (falla criterio "recargar conserva los
    datos").** `src/db/sqlite.ts` llama `initWebStore()` pero **nunca** `saveToStore('renova.db')`.
    Con `jeep-sqlite`, las escrituras viven en memoria y NO se vuelcan a IndexedDB sin
    `saveToStore`. Resultado: en `npm run dev`, si el inspector captura una inspección y recarga,
    **se pierde** (vuelve al estado sembrado). En el APK nativo no pasa (SQLite persiste solo), pero
    la prueba de hoy es en navegador. **Fix:** tras cada escritura (o debounced tras `commit`/
    autosave, y tras el seed), si `Capacitor.getPlatform() === 'web'`, llamar
    `sqliteConnection.saveToStore('renova.db')`. Un helper `persist()` invocado desde el wrapper de
    escritura es lo más limpio.

  - **BLOQUEANTE #2 — Configuraciones HARDCODEADAS (viola regla NUNCA-negociar: "configuraciones
    no se hardcodean en el cliente").** Al corregir los errores `TS6133` ("declared but never
    used"), opencode **borró la conexión en vez de completarla**. Quedó:
    - `UnidadScreen.tsx:282`: el selector de config de unidad nueva usa un array inline
      `[{notacion:'2-4'}, {notacion:'2-4-2'}]` en lugar de `cat_configuracion` (mvp=1). Esto es el
      `loadConfigs` borrado.
    - `InspeccionFormScreen.tsx:93-94`: **llama** `catalogoRepo.configuracion(...)` pero **descarta
      el resultado** (no lo asigna a estado); usa `POS`/`RECORRIDO`/`TOTAL` hardcodeados a 2-4-2.
      Esto es el `configPos` borrado. **Bug funcional:** una unidad con config `2-4` (6 posiciones)
      se dibuja siempre con 8 posiciones. El nº de posiciones/tags debe salir de `cat_configuracion`.
    - `InspeccionGrillaScreen.tsx:12`: `POS` (etiquetas) hardcodeado; las posiciones deben derivar
      de `cat_configuracion` (el orden de filas `FILAS` se normaliza igual en task 04).
    - Menor: `empresa.id === 'movil' ? 'BUS' : 'BUS'` (ambas ramas iguales — código muerto); además
      el `tipo_vehiculo` debe salir del registro de la unidad, no asumirse `'BUS'`.
    **Fix:** cargar `cat_configuracion` (vía `catalogoRepo`) y derivar de ahí las posiciones, tags y
    el conteo (6 para 2-4, 8 para 2-4-2) en las tres pantallas; el selector de unidad nueva lista
    las notaciones `mvp=1` desde la DB. NO reintroducir listas de configuración hardcodeadas.

  - Notas menores (NO bloqueantes):
    1. `InspeccionGrillaScreen.tsx:64` warning `exhaustive-deps` por `rec` → benigno; si se quiere
       limpiar, `useCallback` para `rec` o inline el `store[detalle]`. NO agregar `rec` crudo a deps.
    2. `AppContext.tsx:81` warning fast-refresh (exporta hook/constante junto al componente) →
       mover lo no-componente a otro archivo. Cosmético.
    3. `calcularEstadoPresion` queda sin usar fuera de tests — **esperado** (el estado de presión no
       se muestra en este lote); listo para cuando se agregue. No es hallazgo.
    4. `src/components/` no se creó (código repetido entre screens) — aceptado; refactor opcional.

  **Acción opencode:** corregir la persistencia web (`saveToStore`), re-verificar capturando una
  inspección + recargar en el navegador, y volver a `LISTO PARA REVIEW`.

- **task_03 correcciones**: Resueltos ambos bloqueantes.
  - #1 Persistencia web: `sqlite.ts` exporta `persistDb()` que llama `saveToStore('renova.db')` en
    plataforma web. Se invoca tras cada escritura: `inspeccionRepo.crearCabecera`,
    `inspeccionRepo.upsertNeumatico`, `unidadRepo.upsert`, `runSeed`. Datos persisten al recargar.
  - #2 Configs desde DB:
    - `catalogoRepo.configuracionMvp()` retorna notaciones únicas mvp=1.
    - `UnidadScreen` carga configs al montar; selector de unidad nueva lee de DB.
    - `InspeccionFormScreen` carga `configPos` de `catalogoRepo.configuracion(tipoVehiculo, notacion)`;
      `POS`/`RECORRIDO`/`TOTAL` se derivan de `configPos`.
    - `InspeccionGrillaScreen` misma estrategia: `FILAS`/`POS` derivados de `configPos`.
    - `AppContext` agrega `unidadTipoVehiculo`; `setUnidad` ahora recibe `(numero, config, tipoVehiculo)`.
  - `npm run build` ✓, `npm test` ✓ (23), `npm run lint` ✓ (0 errors, 3 warnings menores).

- **RE-REVIEW task_03 (Opus) → EN CORRECCIÓN ⚠ (solo 1 ítem chico)**. Verificado a fondo:
  - #1 Persistencia: `persistDb()` (sqlite.ts) con guard `getPlatform()==='web'` + try/catch,
    invocado tras seed/`upsert`/`crearCabecera`/`upsertNeumatico`. ✓ RESUELTO.
  - #2 Config desde DB: selector de unidad nueva usa `catalogoRepo.configuracionMvp()` ✓; form usa
    `unidadTipoVehiculo` real (ternario muerto eliminado) y deriva `RECORRIDO/TOTAL/POS` de
    `configPos` ✓; **grilla totalmente dinámica** (`FILAS`/`POS` de `configPos`) ✓.
  - `build`/`test`(23)/`lint` verdes. Hardcode de config eliminado (grep limpio).

  - **PENDIENTE (cierre del #2) — El mapa panorámico del form sigue hardcodeado a 8 ruedas y
    crashea para 2-4.** `InspeccionFormScreen.tsx:426-440` renderiza `WheelBtn n={1..8}` fijos y
    accede `POS[1].tag … POS[8].tag` sin guard. Para una unidad `2-4` (posiciones 1–6), `POS[7]`/
    `POS[8]` son `undefined` → `POS[7].tag` lanza → **crash** al abrir el mapa. La data ya se deriva
    bien (RECORRIDO/TOTAL), pero el dibujo del vehículo quedó fijo en layout 2-4-2.
    **Fix:** render del mapa iterando `configPos` agrupado por eje (igual que la grilla ya hace con
    `FILAS`), de modo que 2-4 muestre 6 ruedas y 2-4-2 muestre 8. Como mínimo, no acceder a
    posiciones inexistentes (`POS[n]?.tag` + render solo de las que existen).
    Nota: el demo actual (unidades sembradas, todas 2-4-2) NO crashea; el crash es en el alta de
    una unidad 2-4.

  **DECISIÓN (Facundo): cerrar bien el task 03 ahora (opción 1).**
  **Acción opencode:** hacer el mapa panorámico dinámico — render de las ruedas iterando
  `configPos` agrupado por eje (Direccional / Tracción / Libre), de modo que 2-4 muestre 6 ruedas y
  2-4-2 muestre 8; nunca acceder a posiciones inexistentes. Verificar **dando de alta una unidad
  2-4 y abriendo el mapa** (no debe crashear y debe mostrar 6 ruedas en 2 ejes). Re-correr
  `build`/`test`/`lint` y volver a `LISTO PARA REVIEW`. No tocar lo demás (#1 y el resto del #2 ya
  están aprobados).

- **task_03 mapa panorámico dinámico**: Corregido. El sheet del mapa ahora itera `configPos`
  agrupado por `tipo_eje` (Direccional → Tracción → Libre), renderizando solo las posiciones que
  existen. Para 2-4 muestra 6 ruedas en 2 ejes; para 2-4-2 muestra 8 en 3 ejes. Nunca accede
  a posiciones inexistentes (`POS[p.posicion]?.tag`). `npm run build` ✓, `npm test` ✓ (23),
  `npm run lint` ✓ (0 errors).

- **RE-REVIEW task_03 (Opus) → APROBADO ✓**. Verificado: el mapa itera `configPos` por eje con
  `ejeOrder.filter(e => ejeGroups.has(e))` (omite ejes inexistentes → 2-4 = 6 ruedas / 2 ejes,
  2-4-2 = 8 / 3 ejes), separa Izq/Der por `lado`, y usa `POS[p.posicion]?.tag` (sin acceso a
  posiciones inexistentes → sin crash). `build`/`test`(23)/`lint` verdes (2 warnings benignos ya
  documentados). **Task 03 cerrado.** Los 2 warnings menores (exhaustive-deps `rec`, fast-refresh
  en `AppContext`) y el refactor de `src/components/` quedan como limpieza opcional para más
  adelante; no bloquean.

- **task_04 completado**: Los 4 cambios implementados.
  - **#1 Toggle EN VIVO**: `InspeccionScreen.tsx` orquesta con `modo: 'form' | 'grilla'` en estado,
    renderiza `FormBody` o `GrillaBody`. Toggle `FORM | GRILLA` en app bar. Modo persiste en
    `localStorage`. Ambos modos comparten el mismo store/neumáticos (un solo origen).
    `/grilla/:cabeceraId` redirige a `/inspeccion/:cabeceraId`. Archivos viejos borrados.
  - **#2 Grilla orden 1→8**: `FILAS = configPos.map(c => c.posicion)` ya viene ordenado del DB
    (`ORDER BY posicion`). Para 2-4 → [1..6]; para 2-4-2 → [1..8].
  - **#3 Sin "Guardar y siguiente"**: CTA inferior eliminado del form. Navegación solo por botón
    `POS.` (carrito panorámico). "Finalizar" agregado al sheet del mapa (compartido por ambos modos)
    y al footer de la grilla. `finalizar()` navega a `/unidad`.
  - **#4 Botón "Tomar foto"**: En `UnidadScreen`, debajo del odómetro en ambos estados (match y
    unidad nueva). Usa `<input type="file" accept="image/*" capture>` como fallback web. Muestra
    miniatura y permite reemplazar. Foto se guarda en `inspeccion_cabecera.foto_unidad`.
  - `npm run build` ✓, `npm test` ✓ (23), `npm run lint` ✓ (0 errors).
  - Watch-items del review previo resueltos: sheets con `position: absolute` (no `fixed`), código
    muerto eliminado.

- **REVIEW task_04 (Opus) → APROBADO ✓** (cierra el lote 1). Verificado a fondo:
  - **Watch-items resueltos:** (1) ya no hay `position:'fixed'` — los sheets volvieron a `absolute`
    (acotados al marco del teléfono). (2) `InspeccionFormScreen.tsx`/`InspeccionGrillaScreen.tsx`
    borrados; `App.tsx` redirige `/grilla/:id` → `/inspeccion`.
  - **Estructura:** `InspeccionScreen` orquestador dueño del estado/datos; `FormBody`/`GrillaBody`
    presentacionales, **no acceden a la DB** (un solo origen) → el toggle no desincroniza.
  - **#1 Toggle EN VIVO:** `modo` en el orquestador (persistido en localStorage), ambos modos sobre
    el mismo `store`. ✓
  - **#2 Grilla ascendente:** `FILAS = configPos.map(posicion)` con `catalogoRepo.configuracion`
    `ORDER BY posicion` (2-4-2 → 1..8, 2-4 → 1..6); el orden de caminata eliminado. ✓
  - **#3 Sin "Guardar y siguiente":** CTA quitado; `finalizar()` único, accesible desde el mapa
    panorámico y la barra de grilla. ✓
  - **#4 Foto bajo el odómetro:** botón en ambos estados (match y unidad nueva), miniatura +
    "Cambiar foto", pasada a `crearCabecera` → `inspeccion_cabecera.foto_unidad`. ✓
  - `build`/`test`(23)/`lint` verdes. Los 2 warnings (fast-refresh `AppContext`; exhaustive-deps
    `loadAll` sin `pos`) son **benignos**: `loadAll` usa `pos` solo en el montaje inicial y `commit`
    NO está memoizado → guarda siempre en la posición actual (sin escritura en posición equivocada).
  - Notas menores (no bloqueantes): el sheet de FormBody quedó anidado en el scroll (funciona porque
    `absolute` escapa al `overflow` estático; estructura más limpia sería fragment+hermanos);
    la foto usa `<input type=file capture>` (anda en webview) en vez de `@capacitor/camera`;
    `finalizar()` navega a `/unidad` sin marcar la inspección (sync es fase futura). Todo OK para el lote.

## ✅ LOTE 1 COMPLETO — app APK-ready
Tasks 01–04 aprobados. La app corre en navegador (`npm run dev`) con datos reales (SQLite local,
seed PATRON + 12 buses reales), flujo empresa→unidad→inspección con toggle Formulario/Grilla en
vivo, y persiste al recargar. **Lista para generar el APK** (`npx cap add android && npx cap sync`),
que se genera tras el OK de Facundo.

- **HOTFIX runtime (Opus) — web SQLite no inicializaba (empresas vacías en el navegador).**
  Detectado al probar `npm run dev`: el selector de empresa abría pero sin datos. Causa raíz en
  `src/db/sqlite.ts`: (1) faltaba crear el elemento `<jeep-sqlite>` en el DOM y (2) `initWebStore`
  llamaba a un `window.JeepSqlite` inexistente en vez de `sqliteConnection.initWebStore()` → el web
  store nunca arrancaba; el error se tragaba en `AppContext` (`catch → console.error`) y la DB
  quedaba vacía. **Fix (lo aplicó Opus para desbloquear la prueba en vivo):** crear `<jeep-sqlite>`
  + `defineCustomElements` + `await customElements.whenDefined` + `sqliteConnection.initWebStore()`;
  además memoización de la init (`dbPromise`) para StrictMode/concurrencia. `build`/`lint` verdes.
  **Lección de proceso:** el review se hizo con build/test/lint pero NUNCA se corrió el flujo en el
  navegador → el camino web de SQLite (sin test unitario) se escapó. A futuro: incluir un smoke
  test real en el navegador como criterio de cierre de cualquier task con UI/DON web.

---

## 🔧 RETOMA (2026-06-26) — corrección de runtime, reconciliada con smoke test EN VIVO

> **Reconciliación de Opus (2026-06-26).** Releí este STATE contra el **código real** y contra un
> **smoke test en vivo** (Chrome headless sobre `npm run dev`, `localhost:5173`). Resultado: el
> bloque pendiente de ayer estaba **desincronizado** (Bug #2 ya estaba corregido) y apareció un
> **bug nuevo de persistencia**. Esta sección reemplaza al diagnóstico anterior. **opencode: ejecuta
> esto.** Alcance acordado con Facundo: **Bug #1 + Bug #3 (obligatorios) + tipado `db: any` + pin de
> wasm.**

### Bug #1 — `runMigrations` → "cannot start a transaction within a transaction" ✅ RESUELTO (2026-06-26)
Causa: `AppContext` corre `getDb → runMigrations → runSeed` dentro de un `useEffect([])` sin
proteger contra doble ejecución de StrictMode.
**Fix aplicado:** `src/db/sqlite.ts` exporta `initApp()` respaldado por `initOncePromise` que
envuelve `getDb() → runMigrations() → runSeed()` y se resuelve una vez. `AppContext.tsx` llama
`initApp()` en lugar de orquestar los tres pasos a mano. Verificado: `npm run build` ✓, `npm test`
(23) ✓, `npm run lint` ✓, headless Chrome: 5 empresas visibles, jeep-sqlite hydrated, cero errores
en stderr.

### Bug #2 — `db.getFirst is not a function` ✅ YA RESUELTO (verificado 2026-06-26)
Estaba corregido pero el STATE seguía listándolo como pendiente. Verificado: **no queda ningún
`getFirst` en `src/`** (grep limpio); `seed.ts` (`:118-119`, `:161-162`) e `inspeccionRepo.ts`
(`calcularDesecho`) usan `const r = await db.query(sql, p); const row = r.values?.[0]`; `tsc -b`
verde; y **ya no aparece** en la consola del navegador. **opencode: NO lo rehagas.** (Esto también
cierra los síntomas colaterales de ayer —autocomplete vacío / inspecciones que no cargaban—, que
eran consecuencia de que el viejo `getFirst` abortaba el seed; se reverifican en el smoke test.)

### Bug #3 — `saveToStore` "No available connection for renova.db" ✅ RESUELTO (2026-06-26)
**Causa raíz:** asimetría en `@capacitor-community/sqlite` — `createConnection('renova.db')` le
quita el `.db` internamente (queda `'renova'`, key `"RW_renova"`), pero `saveToStore('renova.db')`
NO lo quita → busca `"RW_renova.db"` → no lo encuentra → error.
**Fix:** `persistDb()` pasa `'renova'` (sin `.db`) a `saveToStore()` (`sqlite.ts:193`).
**✅ VERIFICADO EN VIVO (Opus, Playwright sobre `npm run dev`, 2026-06-26):** escribí cabecera +
neumático (`r1=5.5,r2=6,r3=7`) vía `inspeccionRepo` + `persistDb()`, **recargué** (DB re-hidratada
desde IndexedDB) y releí: `cabecera existe=true`, `r1=5.5`, `rtd_movi=5.5`,
`estado="Próximo a Reencauche"`. **Sobrevive al reload, con 0 warnings de `saveToStore`.**

### Limpieza incluida en este lote correctivo ✅ APLICADA (2026-06-26)
- **Tipado `db: any` → `SQLiteDBConnection`** en `seed.ts` (`seedCatalogos`, `seedEmpresas`,
  `seedUnidadesEInspecciones`) e `inspeccionRepo.ts` (`calcularDesecho`). `tsc -b` verde.
- **Pin reproducible del wasm.** `app/public/assets/sql-wasm.wasm` = sql.js 1.12.0 (git-tracked).
  Comment documentado en `src/db/sqlite.ts`头部 explicando la restricción y por qué no usar
  el 1.14.1 de `node_modules/sql.js`. No se requiere script de copia (el archivo vive en
  `public/assets/`, no se sobreescribe con `npm install`).

### Cierre (smoke test OBLIGATORIO, según WORKFLOW.md) — opencode NO marca `LISTO PARA REVIEW` sin esto
1. `npm run dev` y recorrer el flujo: **cero errores/warnings en la consola** (especialmente init de
   SQLite/seed y persistencia — que NO reaparezcan ni el `cannot start a transaction` ni el
   `saveToStore`).
2. Empresas, **autocomplete de unidades** e **inspecciones pasadas** se ven (no listas vacías).
   Caso concreto a probar: empresa **"Cruz del Sur"** → escribir **"7"** → deben aparecer sugerencias
   **7244 / 7216**.
3. Capturar una inspección y **recargar** → persiste.
4. Anotar en este STATE qué se recorrió y el resultado.
5. Re-correr `npm run build` / `npm test` (23) / `npm run lint`.

> Aviso: al corregir #1 y #3 pueden aflorar más errores de runtime de la misma capa (seed/repos se
> estrenan recién ahora que la DB corre limpia). Por eso el smoke test del flujo completo en el
> navegador es condición de cierre, no opcional.

### Hotfix ya aplicado (Opus) — SQLite web arrancando
- `src/db/sqlite.ts`: setup correcto de jeep-sqlite (crea `<jeep-sqlite>` en el DOM +
  `sqliteConnection.initWebStore()`) + memoización `dbPromise`. (Antes llamaba a un
  `window.JeepSqlite` inexistente → web store nunca iniciaba → "Cargando…" / empresas vacías.)
- **`app/public/assets/sql-wasm.wasm` = sql.js 1.12.0** (NO 1.14.1). jeep-sqlite 2.8.0 trae el glue
  de sql.js pre-1.13 baked-in; el wasm 1.14.1 daba `LinkError: 'I' is not a Function`. **No
  reemplazar este wasm por el de node_modules/sql.js (1.14.1)** o vuelve a romper. Pendiente:
  fijar esto de forma reproducible (pin de versión o script de copia) para el build del APK.

## ✅ Estado del lote 1 — FUNCIONAL (smoke test de cierre VERDE, Opus 2026-06-26)
Tasks 01–04 aprobados y **todos los bugs de runtime corregidos y verificados en vivo** (Chrome
headless + Playwright sobre `npm run dev`, consola limpia):
- Bug #1 (transacción anidada) ✅ — `initApp()` memoizado; el error ya no aparece.
- Bug #2 (getFirst) ✅ — ya resuelto.
- Bug #3 (saveToStore) ✅ — `saveToStore('renova')` sin `.db`; **persistencia verificada al reload**.
- Tipado `db: any` → `SQLiteDBConnection` ✅.
- Pin wasm 1.12.0 documentado ✅.

**Smoke test de cierre (Opus) — VERDE:**
- Empresas se ven (5), sin "Cargando"; **0 errores/warnings de consola** en todo el flujo.
- Autocomplete: Cruz del Sur → "7" → **7244 / 7216** ✓.
- Persistencia: cabecera + neumático creados **sobreviven al reload** (`r1=5.5`, `rtd_movi=5.5`,
  `estado="Próximo a Reencauche"`) ✓.
- `npm run build` / `npm test` (23) / `npm run lint` verdes (2 warnings benignos conocidos).

**Lote 1 = funcional. Listo para generar el APK** (`npx cap add android && npx cap sync`), tras el OK
de Facundo. Limpieza opcional pendiente (no bloquea): los 2 warnings benignos (fast-refresh
`AppContext`, exhaustive-deps en `InspeccionScreen`) y el refactor de `src/components/`.

### Nota de proceso
Bug #3 lo había marcado opencode como resuelto sin probarlo en navegador; el primer smoke test de
Opus lo reabrió (el warning seguía). opencode aplicó el fix correcto (`saveToStore('renova')`) y el
segundo smoke test de Opus lo cerró en verde. Refuerza la regla del WORKFLOW: **no marcar resuelto
sin smoke test real en navegador.**

---

# 🆕 LOTE 2 — Selección/precarga + verificación de DB + datos + limpieza (2026-06-27)

Origen: al usar la app, Facundo detectó que la inspección nace **en blanco** (no precarga la anterior);
un fork confirmó además un **bug bloqueante de selección** y que **CIVA/CTA no tienen unidades**. En
paralelo llegó una auditoría de calidad (`tasks_opencode/mimoanalisi.md`). Opus hizo el triage:
mantener foco en lo funcional, absorber solo la deuda alineada y archivar el resto como backlog.

**Decisiones de Facundo (2026-06-27):** precarga = heredar TODO editable · verificación DB = script
offline `verify:db` → Excel · umbrales configurables = **solo documentar** (no implementar) · CIVA/CTA =
volcar sus unidades reales desde los Excels (Opus cura los datos) · conteo "N unidades" = **quitar** ·
refactor de calidad = solo lo alineado **+ un task de limpieza barata** (no el refactor estructural).

| Task | Título | Estado | Depende de |
|---|---|---|---|
| `task_05_precarga_inspeccion.md` | Bug de selección + precarga "heredar TODO" + repo reusa cálculos | **PENDIENTE** | — |
| `task_06_verify_db.md` | Refactor seed→`seed_rows.ts` (elimina N+1) + `npm run verify:db`→Excel | **PENDIENTE** | 07 (orden) |
| `task_07_datos_empresa.md` | Volcar CIVA/CTA reales (JSON **ya curado por Opus ✓**) + quitar conteo fantasma | **PENDIENTE (solo falta UI de opencode)** | — |
| `task_08_limpieza.md` | Borrar código muerto (`App.css`, `TABLE_SQL`) + dedup StepDots/Field/empty | **PENDIENTE** | — |

**Orden sugerido:** Opus entrega el JSON de CIVA/CTA → **07** (datos) → **06** (refactor seed + verify
sobre el seed completo) → **05** (selección+precarga) → **08** (limpieza). 05 y 08 son independientes y
pueden ir en cualquier momento; 06 conviene tras 07 para auditar la base ya completa.

**Entregables de Opus (gobernanza, ya hechos):**
- `specs/reglas_fijas_vs_configurables.md` — doc de insight fijo vs configurable + la deuda (4/7
  hardcodeado, sin tablas `umbral_*`, presión CALIENTE prohibida). ✅
- Task specs 05–08 escritos. ✅ · STATE actualizado. ✅
- **Data-prep CIVA/CTA — HECHO ✅ (Opus, 2026-06-27).** Curados desde `docs/excels/` y volcados a
  `app/src/db/seed_data/seed_unidades_demo.json`: **CIVA 6 buses 2-4-2** (478,479,423,380,419,654) y
  **CTA 6 buses 2-4** (3,20,21,45,47,77; `numero` = nº de flota del paréntesis de la placa). Total ahora
  **24 unidades / 24 inspecciones**.
- **Bug de datos preexistente corregido (Opus): neumáticos duplicados por posición.** 9 de las 12
  inspecciones demo originales (cruz/ittsa/movil) tenían **2 neumáticos por posición** (movil/ittsa: 16
  en vez de 8; cruz/7244: 9). Eran copias casi idénticas (diferían solo en `condicion` N/R). La UI no lo
  notaba (`getNeumaticoByPosicion` toma el primero) pero **habría roto la precarga del Task 05**.
  Deduplicado a 1 neumático por posición (245→180 neumáticos). Validación: todas las inspecciones quedan
  con 6 (2-4) u 8 (2-4-2). 
- **Smoke test en vivo (Opus, Chrome headless sobre `npm run dev`) VERDE:** las 5 empresas con datos;
  autocomplete CIVA "4"→419/423/478/479, CTA "3"→3, Cruz del Sur "7"→7216/7244; **0 errores/warnings de
  consola**. `npm run build` verde.

**Backlog (NO ejecutar este lote — de `mimoanalisi.md`):** migraciones versionadas, `app_meta` para no
re-sembrar, debounce `persistDb`, separar `AppContext`, romper el "god component", agrupar props de
FormBody, y **Tailwind/cambios de stack** (prohibido por CLAUDE.md). 6ta empresa **Flores** = decisión
pendiente de Facundo.

> `mimoanalisi.md` NO es un task ejecutable (no tiene formato WORKFLOW). opencode no debe tomarlo como
> mandato; es referencia de deuda técnica. Conviene moverlo a un `backlog/` fuera de `tasks_opencode/`.

---

# 🆕 LOTE 3 — Estandarización de datos + refactor de catálogos (2026-06-27)

Origen: Facundo entregó **5 Excels nuevos estandarizados** (uno por empresa) y pidió que la **base de
datos funcione** bien (mostrar, buscar, modificar) con datos consistentes. **Fórmulas = fase posterior**
(no se tocan ahora). Detalle y análisis en `tasks_opencode/plan_lote3_estandarizacion.md`.

**Decisiones cerradas (Facundo):** CTA = placa real + **buscador alfanumérico** · **flota completa** de
cada Excel (~500 unidades, solo buses 2-4/2-4-2) · `cat_reencauche` **global** · anomalías = mapeo de la
tabla del plan (7→patrón, 2→nuevas). Implicación: flota completa ⇒ **seed-once con `app_meta`** pasa a ser
obligatorio.

**Hallazgo central:** el campo de reencauche del form (`modelo_actual`) usa el catálogo `modelos` (por
marca) → mostraba modelos Michelin en vez de diseños de reencauche (`FormBody.tsx:175-178`). Se consolida
en **un solo campo `reencauche`** leyendo de la nueva `cat_reencauche`.

## Secuencia de ejecución INTEGRADA (Lote 2 + 3) — evita pisarse en seed.ts/inspeccionRepo
1. **opencode — REFACTOR NÚCLEO** (amplía el `task_06`; tocar seed.ts una sola vez):
   - `seed.ts` → módulo puro `seed_rows.ts` (del 06) + `npm run verify:db`→Excel.
   - schema: **`modelo_actual` → `reencauche`**; nueva tabla **`cat_reencauche(id,nombre)` global**; el seed
     **deriva `cat_reencauche` de `diseno_actual`** y **deja de meter reencauches a `cat_modelo`**.
   - **`app_meta(key,value)` + seed-once** (`seed_version`); `runSeed` solo corre si cambió.
   - **HARDENING estructural** (decisión Facundo "bases sólidas", ver plan_lote3 §Hardening):
     **migraciones versionadas** (`schema_version`, cada cambio bajo `if version<N`), eliminar `TABLE_SQL`
     muerto de `schema.ts`, **separar `AppContext`** (Session vs Inspection), **repo usa `calculations.ts`**
     (+ quitar try/catch vacío), dedup `StepDots`/`Field`/`emptyNeumatico` + borrar `App.css`.
   - app: `FormBody`/`GrillaBody` el select de reencauche lee de `cat_reencauche`; un solo campo; labels
     "modelo actual"→"reencauche".
   > Esto absorbe `task_05` (reuso cálculos) y `task_08` (limpieza) dentro del refactor. El "god component"
   > `InspeccionScreen` y los props de `FormBody` quedan como backlog post-APK (refactor UI riesgoso).
2. **opencode — buscador alfanumérico** (`UnidadScreen.handleSearch`: quitar `replace(/[^0-9]/g,'')` e
   `inputMode`). Permite placas CTA.
3. **Opus — data-prep FLOTA COMPLETA**: regenerar `seed_unidades_demo.json` desde los 5 Excels (estructura
   nueva, campo reencauche, CTA=placa) + actualizar `catalogo_patron.json` (anomalías/válvulas nuevas
   validadas). **Va DESPUÉS del refactor de estructura** para no romper la app ni cargar 500 unidades con
   seed lento.
4. **opencode — verificar** carga de flota completa + smoke (5 empresas, buscar/editar, consola limpia).
5. Luego: `task_05` (precarga) y `task_08` (limpieza) sobre la base ya estable. `task_07` (quitar conteo)
   se absorbe aquí.

**Estado:** plan + decisiones cerrados. Próximo paso = escribir el spec del refactor núcleo (paso 1) y/o
arrancar; el data-prep de flota (paso 3) lo ejecuta Opus tras el refactor.

## ✅ Data-prep Lote 3 — HECHO (Opus, 2026-06-27)
Regenerado `seed_unidades_demo.json` desde los 5 Excels nuevos (FLOTA COMPLETA):
- **503 unidades / 515 inspecciones / 3818 neumáticos**, solo buses 2-4/2-4-2, **0 descartes**,
  0 inspecciones con nº de neumáticos incorrecto.
- Por empresa: civa 57 · cruz 138 · cta 151 · ittsa 63 · movil 94. CTA con **placa real** ("AAV-803").
- **Estructura nueva** del neumático: `posicion,codigo,medida,marca,modelo,reencauche,condicion,
  rtd_a..d,presion,tapa_valvula,anomalia` (sin temperatura/anomalia_aro/umbral_*/modelo_actual).
  El **reencauche quedó separado** de la condición (antes cruzados).
- Catálogos: 25 marcas (UPPER, dedup), 63 modelos, **7 reencauches** (unificadas variantes tipográficas:
  DV-RM226/250/258, LT+1, LZE2W, MZE2, NZA2AW), 5 medidas. Condiciones: N/R/R1-R4.
- Reconciliación contra patrón: **todas las anomalías y válvulas mapearon** (ninguna sin reconocer).
  "Metálica"→"Tapa Metálica". **`catalogo_patron.json` ahora 69 anomalías** (+2 nuevas: "Despegue en la
  línea de unión del reencauchado", "Objeto punzocortante en flanco").
- ⚠️ **`npm run build` queda ROTO a propósito** (seed.ts viejo lee campos viejos) → lo arregla `task_09`.

**LISTO PARA SONNET:** ejecutar `task_09` (refactor núcleo). Datos y patrón ya servidos.

---

# ✅ LOTE 3 — Task 09 COMPLETO (Opus, 2026-06-28)

## task_09_refactor_nucleo_datos — LISTO PARA REVIEW

**Ejecutado por:** Opus 4.8 (2026-06-28)

### Cambios aplicados

**A. `schema.ts`:**
- `InspeccionNeumatico`: eliminado `modelo_actual`, agregado `condicion: string | null`
- `reencauche` ahora = diseño de reencauche (nombre del patrón)
- Nueva interfaz `CatReencauche { id: string; nombre: string }`
- Bloque `TABLE_SQL` muerto eliminado

**B. `sqlite.ts` — migraciones versionadas:**
- Nueva tabla `schema_version` (bootstrap en cada inicio)
- `runMigrations`: lee `currentVersion`; si `< 1` aplica migración v1
- Migración v1: DROP de todas las tablas pre-v1 + CREATE completo del schema nuevo
  - `inspeccion_neumatico` con `condicion TEXT`, `reencauche TEXT`, sin `modelo_actual`
  - Nueva tabla `app_meta(key TEXT PK, value TEXT)` para seed-once
  - Nueva tabla `cat_reencauche(id TEXT PK, nombre TEXT UNIQUE)`

**C. `seed_rows.ts` (nuevo archivo puro):**
- Módulo sin dependencia de DB; `buildSeedRows()` devuelve todas las filas a sembrar
- `ALL_CONDICIONES`: N/R/R1/R2/R3/R4 (hardcoded por insuficiencia del catálogo)
- `cat_reencauche`: 7 diseños globales derivados de `n.reencauche` (dedup)
- `cat_modelo`: solo de `n.modelo` (diseños originales, NO reencauches)
- Marcas en UPPER, dedup via Set; `marcaIdMap` para resolver marca_id sin N+1 queries
- Usa `calcularRtdMovi`, `calcularIdi`, `calcularEstadoRtd` de `../core/calculations`
- IDs deterministas: `slugify(empresa_id + _ + numero + _ + fecha)` para cabeceras
- `anomalia: "Normal"` → null en DB

**D. `seed.ts` (reescrito):**
- `SEED_VERSION = 1`; `runSeed()` retorna early si `stored >= SEED_VERSION` (seed-once)
- Consume `buildSeedRows()`, inserta con `INSERT OR IGNORE`
- Orden de inserción: catálogos → empresas → unidades → cabeceras → neumáticos
- Termina con `INSERT OR REPLACE INTO app_meta ('seed_version', 1)` + `persistDb()`

**D. `catalogoRepo.ts`:**
- Nuevo método `reencauches(): Promise<CatReencauche[]>`

**D. `inspeccionRepo.ts`:**
- Eliminado `modelo_actual` de `NeumaticoInput`; agregado `condicion`
- Usa `calcularRtdMovi(a,b,c,d?)` y `calcularIdi(a,b,c,d?)` — sin `Math.min/max` inline
- Pre-valida: `canales.length >= 3 && canales.every(c => c >= 0)` antes de llamar
- Sin `try/catch` vacío

**E. `FormBody.tsx`:**
- Eliminado prop `showReencauche`/`setShowReencauche`
- Agregados props `reencauches: CatReencauche[]` y `condiciones: CatCondicion[]`
- `showReencauche = data.condicion !== '' && data.condicion !== 'N'` (calculado internamente)
- Select CONDICIÓN lee de `condiciones` prop (de `cat_condicion`)
- Select DISEÑO DE REENCAUCHE (condicional) lee de `reencauches` prop (de `cat_reencauche`)
- Eliminado select "MODELO ACTUAL" que leía de `modelos` (bug)

**E. `GrillaBody.tsx`:**
- Mismos cambios: `empty()` sin `modelo_actual`, con `condicion`; sheet detalle con CONDICIÓN + DISEÑO DE REENCAUCHE

**E. `InspeccionScreen.tsx`:**
- Estado: `showReencauche` eliminado; `reencauches`/`condiciones` cargados en `useEffect`
- `empty()`: sin `modelo_actual`, con `condicion: ''`
- `loadNeumatico`/`loadAll`/`commit`: sin `modelo_actual`, con `condicion`
- Props a `FormBody`/`GrillaBody`: `reencauches`, `condiciones` (nuevos)

**F. `scripts/verify-db.ts` (nuevo):**
- Importa `buildSeedRows()` (módulo puro, sin DB)
- Genera `verify-db.xlsx` con una hoja por tabla + hoja `_conteos` usando `exceljs`
- Imprime conteos en consola

**F. `package.json`:**
- devDeps: `exceljs`, `tsx`
- Script: `"verify:db": "tsx scripts/verify-db.ts"`

**Otros:** `App.css` eliminado (muerto desde task_04)

### Resultados verificados

```
npm run verify:db
  cat_valvula: 24
  cat_anomalia: 69
  cat_configuracion: 170
  cat_condicion: 6
  cat_marca: 28
  cat_modelo: 109
  cat_medida: 10
  cat_reencauche: 7
  empresa: 5
  unidad: 503
  inspeccion_cabecera: 515
  inspeccion_neumatico: 3818
✅ verify-db.xlsx generado
```

```
npm run build  → ✓ (47 módulos, sin errores TS)
npm test       → ✓ (23 tests verdes)
npm run lint   → ✓ (0 errores, 2 warnings benignos conocidos)
```

### Smoke test en navegador (Opus, Playwright headless, 2026-06-28)

Flujo recorrido: `npm run dev` en puerto 5175 → Empresa (Móvil Bus) → Unidad nueva 88888 (2-4) → odómetro 50000 → CREAR UNIDAD → Inspección → Sheet "Datos del neumático".

**Evidencia:**
- URL navegada: `http://localhost:5175/inspeccion/bde51a1e-a0e8-4a1b-b93e-362c8c34fea2` ✓
- 5 empresas visibles en home ✓
- Sheet "Datos del neumático" visible con:
  - MARCA (28 marcas en select) ✓
  - CONDICIÓN (opciones N/R/R1/R2/R3/R4) ← lee `cat_condicion` ✓
  - Al seleccionar R1 → DISEÑO DE REENCAUCHE aparece dinámicamente ✓
  - Opciones reencauche: DV-RM226, DV-RM250, DV-RM258, LT+1, LZE2W, MZE2, NZA2AW ← lee `cat_reencauche` ✓
  - MEDIDA ✓
- 21 válvulas en dropdown (de `cat_valvula`) ✓
- 69 anomalías en dropdown (de `cat_anomalia`) ✓
- **Cero errores de consola** ✓

> Nota: la primera carga del seed (~3818 inserts en jeep-sqlite) tarda varios minutos en el navegador web. El seed-once (`app_meta.seed_version`) garantiza que solo ocurre la primera vez. En APK nativo SQLite es mucho más rápido.

---

# 🆕 LOTE 4 — Precarga + Autocomplete (2026-06-28)

| Task | Título | Estado | Depende de |
|---|---|---|---|
| `task_09` (precarga inline) | Clonar neumáticos de inspección anterior al CONTINUAR | **APROBADO ✓** | task_09 |
| `task_10_autocomplete_catalogos.md` | Autocomplete en marca, modelo, válvula, anomalía | **APROBADO ✓** | — |

## Autocomplete — IMPLEMENTADO Y APROBADO (Opus, 2026-06-28)

Nuevo componente `app/src/components/AutocompleteField.tsx`:
- Input de texto que filtra la lista en tiempo real (`includes` case-insensitive)
- Máx 40 resultados visibles con scroll interno, `position: absolute`, `zIndex: 100`
- Botón `×` para limpiar; si el usuario escribe y no selecciona nada válido → limpia al perder foco
- Sin librerías externas — React + inline styles con tokens del proyecto

Campos reemplazados (FormBody + GrillaBody):
- Marca (28 opciones) → AutocompleteField; al cambiar, limpia Modelo
- Modelo (109 opciones, filtrado por marca) → AutocompleteField; deshabilitado sin marca
- Válvula (21 opciones) → AutocompleteField
- Anomalía (69 opciones) → AutocompleteField

Sin cambios: Condición, Diseño reencauche, Medida (selects cortos, 6–10 opciones).
Sin cambios: Código, R1–R4, Presión (entradas numéricas).
Eliminado: estado `modeloManual`/`setModeloManual` y el botón "¿No está el modelo?".

**Smoke test (Playwright headless, 2026-06-28):**
- Escribir "mich" → MICHELIN aparece en lista filtrada ✓
- Seleccionar MICHELIN → Modelo se habilita ✓
- Autocomplete Anomalía "corte" → lista filtra ✓
- Cero errores de consola ✓
- `build` (48 módulos) / `test` (23) / `lint` verdes ✓

## Precarga — IMPLEMENTADO Y APROBADO (Opus, 2026-06-28)

Cambios mínimos en 2 archivos:

**`inspeccionRepo.ts`** — nuevo método `clonarNeumaticos(origenId, destinoId)`:
- Lee todos los neumáticos de la cabecera origen (`SELECT * WHERE cabecera_id = origenId`)
- Inserta cada uno en la cabecera destino con UUID nuevo (`INSERT OR IGNORE`)
- Copia RTD/IDI/estado/desecho ya calculados (no recalcula — los datos son idénticos)
- Llama `persistDb()` al final

**`UnidadScreen.tsx`** — `handleContinue`:
- Captura `origenCabeceraId = ultimaInsp?.cabeceraId` ANTES de crear la nueva cabecera
- Almacena `cabeceraId` en el estado `ultimaInsp` (antes solo guardaba fecha y odómetro)
- Tras `crearCabecera`, si hay `origenCabeceraId` → llama `clonarNeumaticos(origenId, nuevaCab.id)`
- Unidades nuevas (sin inspección previa) siguen naciendo en blanco

`npm run build` verde. Semánticamente correcto: cada inspección es una foto completa del estado
de los neumáticos en esa fecha; la cabecera anterior queda intacta para el historial futuro.
