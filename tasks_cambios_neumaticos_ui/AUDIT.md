# AUDIT — Fase 2 UI · Modo Cambios de Neumáticos

Fecha: 2026-07-13. Autor: CLAUDE (solo planificación). Alcance: auditoría de solo lectura del
repositorio + verificación remota de solo lectura contra `fbxupwwgiebhlciqftpw`. **No** se
implementó ni modificó código de producción. **No** se aplicaron migraciones ni escrituras.

Puerta de entrada respetada: la Fase backend cerró en `tasks_cambios_neumaticos/task_07` con
veredicto **APTO PARA FASE 2** (`tasks_cambios_neumaticos/REVISION_FINAL.md:15`). Esa numeración
(task_01…task_07) es de backend; esta carpeta abre una **secuencia nueva** de tareas de frontend.

Fuente canónica de contratos: **`tasks_cambios_neumaticos/CONTRATOS_UI.md`**. Este AUDIT no la
reescribe; cada tarea copia solo los campos exactos que su ejecutor necesita.

---

## 0. Estado del worktree al iniciar

`git status --short` (snapshot):

- Modificados versionados: `knowledge/ai/05 - Datos y Supabase.md`,
  `knowledge/ai/07 - Web dashboards y taller.md`, y artefactos `.tokensave/*` (indexación local).
- No rastreados: `FASE_02/`, las 3 migraciones `20260714*`, 2 tests SQL, y toda la carpeta
  `tasks_cambios_neumaticos/`.

Disposición: **todo lo modificado o no rastreado es propiedad del usuario**. Esta planificación no
lo altera ni lo limpia. El único directorio nuevo que crea esta sesión es
`tasks_cambios_neumaticos_ui/`.

---

## 1. Estado actual de la pantalla (`WEB/Inspecciones por unidad.html`)

Superficie estática (HTML+CSS+JS inline, sin build). Registrada en
`knowledge/ai/07 - Web dashboards y taller.md:15` como "Detalle de inspecciones/posiciones",
fuente `v_inspection_dashboard_rows`.

### 1.1 Layout y gemelo digital

- Estructura: `header` + `main` con `aside.panel` (432px, `:104-105`) y `.stage` (escena 3D,
  `:112-113`). Modales `overlay` (anomalía y descartar) fuera de `main` (`:595-634`).
- Gemelo digital 3D: escena CSS `perspective` con `world` animado (`sway`, `:284-293`). Las
  **8 ruedas están hardcodeadas en el DOM** con `id="wheel-1".."wheel-8"`, `data-pos`, y un
  `transform: translate3d(...)` de coordenadas fijas por rueda para bus 2-4/2-4-2
  (`:561-584`, comentario `:560`). No hay generación dinámica de posiciones: el twin asume P1–P8.
- Dock inferior (`.pos-dock`, `:591`) **sí** se renderiza dinámicamente desde
  `Object.keys(POSICIONES)` en `renderDock()` (`:971-976`) usando `<button>` con `data-pos`.
- Responsive: layout de escritorio (panel de 432px fijo + stage flexible). No hay breakpoints
  móviles declarados para esta pantalla; el gemelo 3D con `perspective:1500px` no está pensado
  para viewport angosto. **Brecha**: `FASE_02/Untitled.jpg` sugiere uso táctil/móvil.

### 1.2 Construcción de estado y funciones clave

| Símbolo | Ubicación | Qué hace hoy |
|---|---|---|
| `POSICIONES` (objeto global) | declara `:659`; llena `:767` | Mapa `pos → datos` construido **desde la inspección** (`v_inspection_dashboard_rows`), no desde config de unidad. |
| `INSPECTION_META` | `:660-667` | Placa, fecha, odómetro, inspector de la inspección histórica. |
| `qs` (URLSearchParams) | `:669` | Lee `inspection_id`, `plate`, `pos` de la URL. |
| `rowsToPositions(rows)` | `:683-728` | Normaliza filas de inspección: canales A–D, estados ya calculados por la vista, anomalías, presión. |
| `loadSupabaseInspection()` | `:745-786` | `fetchView('v_inspection_dashboard_rows', …)` con filtro `inspection_id` o `plate`; agrupa por `inspection_id` de `rows[0]`. Estado vacío si 0 filas. |
| `estadoEfectivo(d)` | `:817-826` | Jerarquía de color (anomalía crítica > RTD cambio > próximo/anomalía > normal). **Solo modo Inspección**. |
| `estadoWheel(n)` | `:827-829` | `estadoEfectivo(POSICIONES[n])`. |
| `renderPanel(n)` | `:832-899` | Pinta el panel de datos de la posición seleccionada (código, RTD MOVI, canales, presión, anomalías, acciones). |
| `renderDock()` | `:971-977` | Chips dinámicos por posición con `.dot` de estado y marca `sel`. |
| `updateWheelStates()` | `:978-990` | Oculta (`display:none`) ruedas sin entrada en `POSICIONES`; aplica clase `estado-*`. |
| `select(n)` | `:991-1004` | Fija `selected`, marca rueda/chip, re-renderiza dock y panel. |
| `drawConnector()` | `:1012-1025` | SVG que une el borde con la rueda seleccionada, en bucle `requestAnimationFrame`. |
| `init()` | `:1051-1066` | `onRenovaSupabaseReady` → `requireAuth` → `loadSupabaseInspection` → `updateWheelStates` → `select` → Realtime. |

### 1.3 Dependencia de `v_inspection_dashboard_rows` (NO reutilizable como estado de taller)

`POSICIONES` mezcla identidad + medición + anomalía **de una inspección histórica** (`:695-725`).
El modo Cambios exige el estado **actual** de taller desde `v_unit_position_state` (posición
vacía incluida). Reutilizar `POSICIONES` como estado actual sería un error semántico: una posición
puede haberse vaciado o cambiado de ciclo desde esa inspección. Confirmado por
`CONTRATOS_UI.md:83-87` (los datos de última inspección "pertenecen a la unidad+posición, no
necesariamente a la instalación activa actual"). **Los dos modos deben mantener estructuras de
datos separadas.**

### 1.4 Botones retén/descarte y modal simulado (no persisten)

- `#btn-reten` → `enviarARetenAction(selected)` → **solo `showToast`** (`:927-928`, `:964`). No
  escribe nada.
- `#btn-descartar` → `openDescartarModal(selected)` (`:965`).
- Modal descartar (`#overlay-descartar`, `:611-634`): botón foto marca `descartarFotoTomada=true`
  y cambia texto (`:950-956`) — **no captura ni sube imagen**. Confirmar → `showToast` y cerrar
  (`:959-963`). No hay `photo_url` real, ni RPC, ni Storage.
- Causas del `<select>` (`:619-627`) coinciden con el enum del backend
  (`CONTRATOS_UI.md:298-305`). **Reutilizable** el texto exacto.

### 1.5 Inicialización, sesión, navegación, Realtime, estados vacío/error, logout

- Init diferido correcto vía `onRenovaSupabaseReady` (`:1052`), patrón de `renova-ready.js`.
- Auth: `RenovaSupabase.requireAuth()` (`:1053`) pinta login modal si falta sesión
  (`supabase-demo.js:158-166`).
- Navegación de entrada: `INSPECCIONES POR FECHA.html:381-388` (`openInspection`) arma
  `?inspection_id=<id de inspección>&plate=<placa>&date=<fecha>`. **El `plate` viene directo** →
  `resolveUnitId` puede resolver `unit_id` sin la lectura extra de inspección
  (`CONTRATOS_UI.md:122-147`).
- Realtime: `onDataChange(['inspections','inspection_measurements'], …)` (`:1059-1063`) recarga la
  inspección sin resetear la posición seleccionada. **Brecha**: no escucha
  `tire_installations`/`tire_removals`/`tire_change_batches`; el modo Cambios necesita otra
  suscripción y una política ante un evento con borrador abierto.
- Estado vacío: 0 filas → `POSICIONES={}`, badge "SIN DATOS" (`:759-763`, `:834-849`). Sesión sigue
  viva.
- Estado error: `catch` degrada a vacío con `console.warn` (`:780-785`).
- Logout: `#user-chip` con `confirm` + `signOut` + reload (`:1042-1048`).

### 1.6 Accesibilidad, teclado, foco, touch, resoluciones

- **Ruedas no accesibles por teclado**: son `div` con solo `addEventListener('click')` (`:1008`);
  sin `role`, `tabindex` ni handler de teclado. El dock sí usa `<button>` (`:974`) → teclado OK.
- El link de código (`#id-codigo`) sí tiene `role="link"`, `tabindex="0"` y handler `Enter/Space`
  (`:472`, `:1037-1039`) — **patrón reutilizable** para hacer accesible cualquier control no nativo.
- Modales: se abren con clase `.open` (`:911`); **sin trap de foco, sin cierre por Escape, sin
  restaurar foco** al cerrar. `am-cerrar`/`ds-cancelar` son botones (teclado OK) pero el foco no se
  gestiona.
- Touch: chips y botones tienen padding aceptable; las ruedas 3D son objetivos pequeños/rotados,
  poco fiables como objetivo táctil primario.
- El bucle `requestAnimationFrame` permanente (`:1025`) redibuja el conector cada frame; respeta
  `prefers-reduced-motion` solo para la animación `sway`/`pulse` (`:430-433`), no para el rAF.

---

## 2. Contratos backend disponibles (resumen; canónico en `CONTRATOS_UI.md`)

Verificado remotamente hoy (solo lectura): ambas vistas presentes y la RPC presente
(`information_schema.views` = 2; `pg_proc.confirm_tire_change_batch` = true).

- **Resolución `unit_id`**: `CONTRATOS_UI.md:105-152`. Usar `plate` (ya en la URL) →
  `v_unit_position_state?plate=eq.<placa>` → `unit_id` de la primera fila. RLS aporta la empresa.
- **`v_unit_position_state`**: 28 columnas (`CONTRATOS_UI.md:44-75`). `is_empty` = sin instalación
  activa; posiciones vacías siguen visibles y montables; `code_mismatch` = discrepancia de
  identidad **a revisar**, no afirma que el neumático físico sea otro (`:77-87`).
- **`v_tire_inventory_available`**: 15 columnas (`CONTRATOS_UI.md:171-190`). Retén derivado; los 4
  campos finales pueden ser `NULL` para ciclo nunca instalado (válido igual).
- **`confirm_tire_change_batch(p_batch jsonb) returns jsonb`**: `SECURITY DEFINER`,
  `EXECUTE` solo `authenticated`, roles `workshop_manager`/`fleet_manager`/`admin`
  (`CONTRATOS_UI.md:213-226`). Payload v1, reglas de lote, idempotencia por `batch_id`, y 5 clases
  de error con `error.code`/prefijo (`:227-546`).
- **Aislamiento**: la empresa nunca se envía; se deriva del JWT. `authenticated` por sí solo NO
  aísla empresa — lo hacen RLS (vistas) y la validación de dominio de la RPC
  (`CONTRATOS_UI.md:27`, `knowledge/ai/08:31-33`).

Cliente disponible: `RenovaSupabase.supabase` (cliente supabase-js crudo, tiene `.rpc()`,
`supabase-demo.js:22`, `:194`) y `RenovaSupabase.fetchView(name, params)` (REST GET con
Authorization de sesión, `:24-37`). supabase-js se importa **sin fijar minor**:
`@supabase/supabase-js@2` desde esm.sh (`supabase-demo.js:18`).

---

## 3. Estado provisional y editor de lote (modelo conceptual, sin programar)

El editor necesita **cinco representaciones distintas** que no deben confundirse:

1. **Snapshot remoto** (`remoteState`): filas crudas de `v_unit_position_state` +
   `v_tire_inventory_available` tal como se leyeron, con marca de tiempo de lectura. Inmutable
   hasta una recarga explícita.
2. **Movimientos editables** (`draft.movements`): lista ordenada de intenciones del usuario
   (retén/descarte/montaje/swap) **antes** de sellar. Editable: agregar, deshacer, modificar.
3. **Proyección del diagrama** (`projection`): función pura `(remoteState, draft) → estado visual
   por posición` (ocupada/vacía/origen/destino/retén/descarte/montaje/swap/discrepancia/conflicto).
   Se recalcula en cada cambio; nunca se persiste.
4. **Payload sellado** (`sealedBatch`): al confirmar, se genera `batch_id` **una vez**
   (`crypto.randomUUID()`) y se congela el JSON v1. Inmutable; solo se reintenta idéntico.
5. **Resultado confirmado** (`result`): respuesta de la RPC; dispara recarga del snapshot y
   descarte del borrador/payload.

### 3.1 Invariantes que el editor debe imponer (todas verificables en pruebas puras)

Derivadas de `CONTRATOS_UI.md:416-428` y §5:

- No operar retiro/descarte/swap sobre una posición `is_empty=true` (no hay ciclo que retirar).
- `mount` solo sobre una posición que quedará **libre** tras los retiros del mismo lote.
- Un `life_cycle_id` de inventario no puede usarse en dos `mount` del mismo lote.
- Cada posición aparece **a lo sumo una vez como origen** y una vez como destino; `swap` cuenta
  como origen+destino en ambos lados (`CONTRATOS_UI.md:418-420`).
- Combinación válida explícita: retirar P3 y montar otro ciclo en P3 en el mismo lote (`:420`).
- `expected_life_cycle_id(_a/_b)` se toma del `life_cycle_id` que la UI vio en esa posición y
  **nunca se omite** (`:422`, `:268`, `:291`, `:338-352`).
- Una vez asignado `batch_id`, el payload no muta; una edición posterior genera un `batch_id`
  **nuevo** (`:514-519`).
- Un retry de red reusa el mismo `batch_id` y el mismo payload; nunca genera otro UUID (`:625`).
- Un lote rechazado por dominio (`lote_invalido`/estado/no_disponible/ocupada/permiso) **no** se
  reintenta a ciegas (`:672-674`).
- El borrador se aísla por usuario+empresa+unidad (clave de `localStorage` con `batch_id`, y
  validación de que `unit_id`/sesión coinciden al reanudar) (`:150-151`).
- Un evento Realtime **no** sobrescribe silenciosamente un borrador (ver Decisión 5).

### 3.2 Representación cromática (sin romper la semántica vigente)

Semántica de paleta vigente (`DESIGN.md`/`knowledge/ai/09:16-22`): naranja `#F06822` = **una sola
acción/foco dominante**; verde `#1f9d6b` = posición completa; amarillo `#f4b821` = hito/valor, no
alarma. Hoy el naranja ya se usa para (a) selección en dock (`:272-273`) y (b) estado `cambio`
(`:425-428`) y (c) conector SVG (`:1020`). **Riesgo**: el modo Cambios agrega estados nuevos
(origen, destino, retén, descarte, swap, conflicto) que podrían multiplicar el naranja y romper la
regla "un solo foco".

Propuesta a validar (Decisión 2 y `DECISIONES.md`): reservar el **relleno/anillo naranja** para el
foco único (posición seleccionada); distinguir los estados de movimiento por **borde punteado +
icono/etiqueta textual monospace** (no por más color de alarma), reutilizando amarillo para
"pendiente/provisional" y el borde punteado ya presente en `.anom-empty`/`.modal-foto.empty`
(`:179`, `:218`). El conflicto/discrepancia se marca con etiqueta textual ("REVISAR IDENTIDAD",
"CONFLICTO") sin inventar rojo (el proyecto no usa rojo como severidad, `knowledge/ai/09:56-58`).

---

## 4. Foto real de descarte y Storage

Backend exige `photo_url` **texto no vacío**, sin validar formato ni que sea un objeto de Storage
(`CONTRATOS_UI.md:294`, `:687`). Verificación remota de hoy: **no existe ningún bucket**
(`storage.buckets` = 0 filas) ni política sobre `storage.objects` (0 filas). Storage es
**greenfield** para este flujo: no hay decisión aprobada ni infraestructura.

Comparativa para `DECISIONES.md` (Decisión 3), sin resolver aquí:

- **Bucket**: nuevo `tire-discard-photos` vs reutilizar uno inexistente → hay que crearlo.
- **Privacidad**: privado + URL firmada (recomendado, evidencia sensible de flota) vs público.
- **Path**: convención que aísle por empresa/lote sin confiar en metadata editable, p. ej.
  `<company_id>/<batch_id>/<seq>.jpg` (la RLS debe derivar `company_id` del path contra el
  `company_id` del perfil, no confiar en el cliente).
- **Formatos/tamaño**: JPEG/WebP, límite (p. ej. 5 MB), compresión previa en el navegador.
- **Captura móvil**: `<input type="file" accept="image/*" capture="environment">` + preview local
  (`URL.createObjectURL`).
- **RLS de `storage.objects`**: INSERT/SELECT solo `authenticated` cuya empresa coincida con el
  primer segmento del path; sin acceso `anon`.
- **Momento de upload**: antes de sellar el lote (para tener la URL) vs. tras confirmar. Implica
  el problema de **objetos huérfanos** si el usuario cancela o edita.
- **Vigencia de URL**: si es privada+firmada, el historial necesitará re-firmar; si es pública, la
  URL es permanente pero la evidencia queda expuesta.

Prerrequisito mínimo revisable: una migración que cree el bucket y sus policies (tarea separada,
`task_03_storage_evidencia`), **no** un rediseño del backend ya cerrado.

---

## 5. Lectura prudente de `FASE_02/Untitled.jpg`

Boceto manuscrito (captura de iPad, 2026-07-13). Transcripción con niveles de confianza:

### 5.1 Intención inequívoca

- Flujo de navegación jerárquico: "Inspección por unidad" (nivel 1) → "Inspección por unidad"
  (detalle con diagrama) → una pantalla derivada. Coincide con la navegación actual
  Fecha → Unidad.
- Existe un **"MODO INTERACTIVO"** (texto grande con flecha, centro-izquierda) distinto del modo
  de solo lectura. Coincide con el selector Inspección/Cambios pedido.
- Un diagrama de unidad con posiciones (círculos = ruedas) es el centro de la interacción.
- Conceptos escritos junto a diagramas: **"mover/rotación"**, **"mantener la llanta y cambiar"**,
  **"la posición"**, **"para inventario"**, **"mantener llanta y mover"**, **"caja inventario
  (retén)"**, **"borrar"**, **"enviar a" / "derecho"**. Confirman: rotación/intercambio,
  montaje desde inventario/retén, envío a retén, y descarte/borrado.
- "botón acción / cerrar datos" cerca del diagrama → controles de acción sobre la posición.

### 5.2 Interpretación probable

- "mover rotación" + "mantener la llanta y cambiar la posición" ≈ **swap/rotación** entre dos
  posiciones.
- "para inventario / mantener llanta y mover" ≈ enviar a **retén** (queda disponible en inventario).
- "caja inventario (retén)" ≈ un panel/cajón lateral con los ciclos disponibles para **montar**.
- "borrar" + "enviar a derecho/derecha" ≈ **descarte** y/o mover el ciclo a un destino.
- Las flechas entre diagramas sugieren arrastrar/mover un neumático de una posición a otra
  (gesto de intercambio).

### 5.3 Ambiguo — requiere confirmación humana

- Si "enviar a derecho/derecha" es literal (una posición del lado derecho) o una metáfora de
  "enviar a otro lugar". **No** derivar reglas de negocio de esto.
- Si el gesto primario es **drag-and-drop** o selección por toques. El boceto sugiere movimiento
  pero **no autoriza** implementar D&D/swipe/animaciones sin decisión (Decisión 2).
- El significado exacto de "cerrar datos" (¿colapsar el panel? ¿confirmar?).

El boceto **orienta el flujo**, no define contratos ni reglas. Toda interacción rica (D&D, swipe)
se plantea como alternativa con fallback accesible por botones/teclado en `DECISIONES.md`.

---

## 6. Estrategia de código y pruebas (auditoría de viabilidad)

- WEB/ es estático sin build ni runner de tests (root `package.json` solo tiene scripts `docs:*`).
  `app/` sí tiene `vitest@4.1.9` y `playwright@1.61.1` pero en su propio scope.
- El HTML actual ya mezcla datos, estado, proyección y render en un solo `<script>` inline
  (`:639-1067`). Añadir todo el modo Cambios ahí sería inmanejable y **impediría pruebas
  unitarias** y el trabajo paralelo sin colisión de archivos.
- **Recomendación**: extraer módulos ES pequeños bajo `WEB/tire-change/` con límites claros
  (ver `PLAN.md` §1) e importarlos desde el HTML con `type="module"`. La lógica pura (modelo de
  lote, invariantes, proyección, clasificación de errores, normalización de datos) queda en
  módulos testeables con vitest; la UI/DOM queda en submódulos delgados; el smoke test real se
  hace con navegador (playwright ya disponible en `app/`, a decidir si se reutiliza o se corre
  manual — Decisión 9/10).

---

## 7. Brechas por área

| Área | Brecha | Evidencia |
|---|---|---|
| Datos | No se resuelve `unit_id`; se lee la inspección, no el estado de taller | `:753-755`, `CONTRATOS_UI.md:105-152` |
| Diagrama | Twin 3D hardcodea P1–P8; no renderiza posiciones vacías desde config | `:561-584`, `:981-983` |
| Modo | No existe selector Inspección/Cambios; un solo modo | toda la pantalla |
| Editor | No hay modelo de lote provisional ni invariantes | inexistente |
| Persistencia | No se persiste borrador ni payload; retén/descarte son toasts | `:927-963` |
| Storage | No hay bucket, política, captura ni upload real | remoto = 0 buckets |
| RPC | No se llama `confirm_tire_change_batch`; no hay clasificación de errores | inexistente |
| Realtime | Solo escucha inspección; sin política ante borrador | `:1059-1063` |
| Accesibilidad | Ruedas no navegables por teclado; modales sin trap/Escape/foco | `:1008`, `:911` |
| Responsive | Sin breakpoints móviles para esta pantalla | `:104-113` |
| Pruebas | Sin runner ni tests para JS de dashboard | root `package.json` |
| Versión | supabase-js sin pin; retry automático indefinido | `supabase-demo.js:18`, `CONTRATOS_UI.md:602-604` |

---

## 8. Riesgos clasificados por severidad

**Alta**
- R1 — Confusión de semánticas Inspección vs estado actual: reutilizar `POSICIONES`/`v_inspection_*`
  como estado de taller produce operaciones sobre ciclos que ya no están. Mitiga: estructuras
  separadas (§1.3).
- R2 — Payload mutado tras `batch_id` o UUID regenerado en retry → lotes duplicados o idempotencia
  rota. Mitiga: modelo sellado inmutable (§3.1), pruebas de retry.
- R3 — Aislamiento por empresa mal entendido: asumir que `authenticated` aísla. Mitiga: confiar en
  RLS/validación de dominio; nunca enviar `company_id`.
- R4 — Storage sin decisión: foto huérfana, evidencia sensible pública, o path spoofeable. Mitiga:
  Decisión 3 + `task_03` con RLS por path y limpieza verificable.

**Media**
- R5 — Twin 3D no representa configs reales/posiciones vacías → el usuario opera "a ciegas".
  Mitiga: proyección config-driven; dock dinámico como superficie accesible primaria (§3.2).
- R6 — Segundo foco naranja rompe la jerarquía visual. Mitiga: Decisión 2 cromática (§3.2).
- R7 — Evento Realtime pisa un borrador. Mitiga: Decisión 5.
- R8 — Retry automático de supabase-js sin pin cambia de comportamiento entre releases. Mitiga:
  Decisión 8 (pin + política de retry explícita).

**Baja**
- R9 — Accesibilidad/teclado insuficiente (deuda ya presente). Mitiga: `task_14`.
- R10 — Smoke test contra producción ensucia datos reales. Mitiga: Decisión 10 (datos/usuario de
  prueba y limpieza).

---

## 9. Evidencia de verificación remota (solo lectura)

- `list_projects` → único proyecto `fbxupwwgiebhlciqftpw` ACTIVE_HEALTHY. El homónimo vacío
  `zkifhlayacqexksrfdxc` (citado en `REVISION_FINAL.md:9`) **no** aparece en esta organización;
  no hay riesgo de confusión desde este acceso.
- `information_schema.views` → `v_unit_position_state` y `v_tire_inventory_available` presentes (2).
- `pg_proc` → `confirm_tire_change_batch` presente.
- `storage.buckets` → **0 filas**. `pg_policies` sobre `storage.objects` → **0 filas**.

No se ejecutó ninguna escritura ni la RPC. Verificación de columnas/ACL/idempotencia ya la cerró
la fase backend (`REVISION_FINAL.md`); esta sesión no la repite salvo lo necesario para el plan.
