# Auditoría integral de diseño UI/UX — Dashboard web RENOVA INSPECTOR

## Contexto

El usuario pidió una auditoría profunda (no un rediseño) del dashboard web de flota —
`WEB/*.html` + `WEB/movimientos/*` — evaluada contra Apple HIG, Vercel Web Interface Guidelines
y buenas prácticas de sistemas de diseño en React, sin tocar la app móvil ni el flujo de captura
en campo. El objetivo es entender qué complejidad pertenece al dominio (industrial, alta
densidad de datos técnicos) y cuál fue creada por la implementación, para luego priorizar
correcciones sin arriesgar la lógica operativa ya funcionando (RPCs transaccionales de taller,
motor de cálculo, offline-first). El usuario también dejó constancia de una preferencia de
proyecto: priorizar gráficos sobre texto/tablas para mostrar información cuando eso resuelva un
problema real de lectura (no decoración) — se refleja en la sección 10 y en el backlog.

Se leyó primero `knowledge/ai/00 - LEER PRIMERO.md`, `knowledge/ai/07 - Web dashboards y taller.md`,
`knowledge/ai/09 - Diseno y UX.md`, `DESIGN.md` y `PRODUCT.md` como exige `CLAUDE.md`, y se leyeron
íntegros los 6 HTML del dashboard (4.675 líneas) más los 13 módulos JS de `WEB/movimientos/`
(el segundo modo — "Movimientos" — de `Inspecciones por unidad.html`) y `renova-office-shell.css`.
Toda afirmación de esta auditoría cita `archivo:línea`.

**Nota de verificación (actualizada 2026-07-15):** una revisión previa de este documento llamó a
este módulo "Cambios" (`WEB/tire-change/`, `cambios-controller.js`, `tire-change.css`,
`?mode=cambios`) y afirmó que "Movimientos" no existía en el repo. Eso era correcto en el momento
en que se escribió, pero un commit posterior (`tasks_puesta_en_marcha_movimientos/`,
"renombre cambios a movimientos") renombró el módulo: hoy el nombre real y único es
**Movimientos** — directorio `WEB/movimientos/`, controlador `movimientos-controller.js`, hoja de
estilos `movimientos.css`, constante `MOVIMIENTOS_MODES` (`mode-toggle.js:1-4`), parámetro
canónico `?mode=movimientos`. `?mode=cambios` sigue funcionando como alias legacy
(`LEGACY_MOVEMENTS_MODE`, `mode-toggle.js:6`) que se canonicaliza a `movimientos`, no como el
nombre real. `knowledge/ai/07 - Web dashboards y taller.md` ya documenta correctamente este
nombre. Las citas de archivo/ruta de esta sección se corrigieron para reflejarlo; los prefijos de
clase CSS (`.tc-*`) no cambiaron con el rename y siguen siendo correctos tal cual están citados.

**Nota de vigencia de líneas (agregada 2026-07-15):** una implementación posterior de las Fases 1
y 2 de esta auditoría (bug de moneda, enlace roto, `esc()`, tokens duplicados, `renova-office-shell.css`
enlazado en las 6 páginas, formateador de fecha y utilidades de animación compartidas) modificó
estructuralmente los 6 HTML, lo que corrió línea varios de sus hallazgos. Las citas `archivo:línea`
de este documento reflejan el estado del código **antes** de esa implementación y deben tratarse
como aproximadas, no como punteros exactos, al usarse para trabajo futuro sobre hallazgos aún
pendientes (D.2 fuera de alcance de esas fases, D.3, D.6, etc.).

No se modifica código en esta fase. Este documento es el entregable de auditoría en sí mismo.

---

## A. Resumen ejecutivo

**Estado general.** El lenguaje visual está genuinamente bien pensado y documentado (`DESIGN.md`
es inusualmente explícito: reglas nombradas como "Regla del Naranja Único" o "Regla del Verde
Exclusivo", paleta semántica disciplinada, tipografía monoespaciada deliberada). El problema no es
el diseño *intencional* — es que la **implementación no respeta su propio sistema**: cada página
redeclara sus propios tokens, tres familias de botones/badges distintas conviven en el mismo
producto, y `renova-office-shell.css` —pensado como fuente única— es en la práctica copiado, no
referenciado, y ni siquiera está enlazado en 4 de las 6 páginas del dashboard.

**Nivel de madurez:** Prototipo maduro con deuda de sistema de diseño activa. Cada pantalla
individualmente es coherente y funcional; el problema aparece al comparar pantallas entre sí.

**Fortalezas reales:**
- Paleta semántica disciplinada y sin ambigüedad de origen (naranja = único foco/acción, verde
  = exclusivamente "completa") — se respeta en las 7 superficies revisadas.
- El modo Movimientos (`WEB/movimientos/`, segundo modo de `Inspecciones por unidad.html`) tiene el
  nivel de accesibilidad e ingeniería de estados más alto de todo el proyecto: `aria-live` real,
  focus trap reintegrado en todos los overlays, clasificación fina de errores de red/RPC con
  recuperación específica por tipo (reintento del mismo lote, buscar en inventario, recarga
  forzada) — ver §D.3.
- `importar.html` tiene la validación en dos niveles (error bloqueante vs. aviso no bloqueante)
  mejor diseñada de todo el dashboard, con copy claro (`importar.html:409-413,571-577`).
- Ningún gráfico decorativo, ninguna torta 3D, ninguna sombra fuera de lugar — el sistema respeta
  sus propias prohibiciones de `DESIGN.md`.

**Debilidades principales:**
1. Tokens de color/tipografía declarados en 4 lugares distintos con el mismo valor en vez de una
   fuente única — deriva ya ocurrió (`--balance-ok`/`--balance-bad` en `rendimiento.html:71,73`
   duplican hex en vez de usar `var()`).
2. Cero visualización de datos en todo el dashboard pese a que el dato central del producto (RTD
   en el tiempo) es un caso de libro para un gráfico de línea, y pese a la preferencia explícita
   del usuario por gráficos.
3. Los estados de carga / vacío / error son visualmente indistinguibles en casi todas las
   páginas — un mismo recuadro punteado con solo el texto cambiando.
4. Un botón que no hace nada: "Enviar a Retén" / "Descartar" en modo Inspección
   (`Inspecciones por unidad.html:519-522,971,980-982,1012-1018`) solo muestra un toast — no llama
   a ningún RPC — mientras el modo Movimientos, en la misma pantalla, tiene la versión real de la
   misma acción. Riesgo de confianza del usuario, no solo de UI.
5. Tres sistemas de botones/badges coexisten sin jerarquía declarada: `renova-office-shell.css`
   (`.btn-primary/.btn-submit/.btn-mini`), el sistema inline de `Inspecciones por unidad.html`
   (`.btn-accion/.badge`), y `.tc-*` de `movimientos.css` — ninguno es claramente "el" sistema.

**Riesgo de seguir agregando funciones sin corregir la base:** cada pantalla nueva copiará el
patrón de "redeclarar tokens + inventar mi propia clase de botón" porque es el patrón dominante
hoy (4 de 6 páginas lo hacen). El costo de consolidar crece con cada página nueva que no la
consuma. Además, dos hallazgos de esta auditoría son bugs de correctitud, no solo de UX: un botón
decorativo que aparenta persistir y no persiste, y una moneda mostrada mal (ver D.6, hallazgo de
severidad Alta) — ambos superan el umbral de "esto ya afecta la confianza operativa del taller".

---

## B. Inventario del sistema actual

**Rutas (6 HTML estáticos, sin router/SPA, cada uno standalone):**

| Archivo | Propósito | Vista/RPC fuente | Nav completo | Enlaza `renova-office-shell.css` |
|---|---|---|---|---|
| `INSPECCIONES POR FECHA.html` | Estado agregado de flota por fecha | `v_fleet_unit_status` | Sí | **No** |
| `Inspecciones por unidad.html` | Detalle unidad — modos Inspección/Movimientos | `v_inspection_dashboard_rows` + `v_unit_position_state`, `v_tire_inventory_available` | Solo mode-toggle, sin nav a otras pantallas | **No** (`:11` solo enlaza `movimientos/movimientos.css`) |
| `rendimiento.html` | Rendimiento por eje/posición | `v_rendimiento_dashboard_rows` | Sí | **No** — tokens redeclarados en paralelo |
| `historial-neumatico.html` | Historial de casco, solo lectura | vistas `v_casing_*` | **No tiene `<nav>`** | Sí, pero redundante (`:33-49` redeclara todo) |
| `instalacion.html` | Instalar/retirar/trasladar (taller) | RPCs de taller | Sí | Sí, redundante igual (`:16-24`) |
| `importar.html` | Importación masiva Excel | `save_inspection` | Sí | **No** — reimplementa nav/header desde cero (`:79-95`) |

> **Estado post-Fase 2 (2026-07-15):** la columna "Enlaza `renova-office-shell.css`" de arriba
> describe el estado *tal como fue auditado*. Una implementación posterior (Fase 2 del backlog,
> sección G.3) enlazó `renova-office-shell.css` como fuente única en las 6 páginas y eliminó los
> `:root` duplicados, incluida `Inspecciones por unidad.html` (que hoy enlaza el shell además de
> `movimientos/movimientos.css`). Los números de línea de esta fila y de las demás quedaron
> desactualizados por ese cambio; ver "Nota de vigencia de líneas" al inicio del documento.

Retiradas del dashboard (decisión de negocio, no bug — `knowledge/ai/07`): `inventario.html`,
`comparativo.html`. No se auditan.

**Módulo Movimientos** (`WEB/movimientos/`, 13 módulos JS + 1 CSS, ~5.205 líneas): no es una ruta
propia — es un segundo modo dentro de `Inspecciones por unidad.html`, activado por
`?mode=movimientos` (`MOVIMIENTOS_MODES.MOVEMENTS`, `mode-toggle.js:1-4`), sin recarga; el valor
por defecto es `inspeccion`. `?mode=cambios` sigue funcionando como alias legacy que se
canonicaliza a `movimientos` (`LEGACY_MOVEMENTS_MODE`, `mode-toggle.js:6`), no como el nombre
real. Arquitectura: un controlador orquestador (`movimientos-controller.js`, 771
líneas) + módulos ES puros por responsabilidad (modelo de lote `batch-model.js`, persistencia
local `batch-store.js`, proyección del diagrama `diagram-projection.js`/`diagram-view.js`, UI de
movimientos/inventario/confirmación `movements-ui.js`/`inventory-ui.js`/`summary-confirm.js`,
cliente RPC `rpc.js`, cliente de Storage `storage-client.js`, utilidades de accesibilidad
`a11y.js`). Es, con diferencia, el código mejor estructurado del dashboard.

**Layouts:** no existe un layout compartido real (sin plantillas, sin includes). Cada HTML es
autocontenido: `<head>` propio, `<style>` propio, marcado de header propio. `renova-office-shell.css`
existe como intención de fuente única pero funciona como *copia de referencia*, no como
dependencia real — ver hallazgo de duplicación en D y F.

**Patrones visuales existentes:**
- Header sticky navy + logo Bebas Neue + borde inferior diagonal naranja — presente en 5/6
  páginas (`historial-neumatico.html` no tiene `<nav>` en absoluto).
- Filtro único en el header (`<select>` de fecha o de unidad) en `INSPECCIONES POR FECHA.html` y
  `rendimiento.html`; filtros de toolbar (2 `<select>`) en `instalacion.html`; sin filtros en
  `historial-neumatico.html` e `importar.html`.
- "Tabla" implementada como grid de tarjetas/botones (no `<table>`) en `INSPECCIONES POR
  FECHA.html` y `historial-neumatico.html`. Solo dos `<table>` reales existen en todo el
  dashboard: `instalacion.html` (14 columnas) e `importar.html` (tabla de resultado, 5 columnas).
- Modal/sheet: bottom-sheet en `instalacion.html` (3 formularios) vs. overlay `role="dialog"` en
  `WEB/movimientos/*` (descarte, inventario, confirmación) — dos implementaciones de modal
  distintas, ninguna comparte código con la otra.
- Estado vacío/carga/error: un único recuadro punteado (`.empty`/`.note`/`.th-empty`) con solo el
  texto cambiando — repetido, con nombres de clase distintos, en al menos 5 páginas.

**Tokens existentes:** paleta de 9 colores + 2 familias tipográficas documentadas en `DESIGN.md`
y replicadas como CSS custom properties — pero **redeclaradas de forma idéntica e independiente
en 6 lugares** (`renova-office-shell.css:3-16`, `INSPECCIONES POR FECHA.html:37-61`,
`rendimiento.html:57-83`, `historial-neumatico.html:33-49`, `instalacion.html:16-24`,
`importar.html:50-68`, `Inspecciones por unidad.html:30-41` con nombres de variable *distintos*
para los mismos valores hex). No existe escala de espaciado como CSS vars (`DESIGN.md` la define
en su frontmatter — `spacing.xs..2xl` — pero ningún archivo `.css` la implementa; todo es píxeles
sueltos). No existe token de breakpoint: se hallaron 6 valores de media query distintos sin
relación entre sí (520, 560, 640, 760, 780, 900px) repartidos en 5 archivos distintos.

**Flujos principales reconstruidos (resumen; detalle por página en D):**
- Seleccionar empresa: implícito vía sesión/RLS (`RenovaSupabase.requireAuth()`), no hay selector
  de empresa visible en ninguna de estas 6 páginas.
- Seleccionar unidad: 3 mecanismos distintos según la página — click en tarjeta (`INSPECCIONES
  POR FECHA.html`), `<select>` completo (`rendimiento.html`), filtro de toolbar (`instalacion.html`)
  — **ninguna de las 6 páginas tiene un buscador/autocomplete de placa**; todo es lista completa
  o selección previa.
- Ver historial de un neumático: **solo por deep-link** desde `rendimiento.html:1065` o
  `Inspecciones por unidad.html:1127` — `historial-neumatico.html` no tiene buscador propio, y su
  botón "volver" apunta a una ruta que no existe si no hay `document.referrer` (ver D.4, hallazgo
  Alto).
- Confirmar movimientos de neumáticos (retén, descarte, intercambio, montaje) en modo Movimientos:
  flujo de hasta 6 superficies interactivas distintas por lote (ver D.3) — el más largo del
  dashboard, pero también el mejor instrumentado en feedback.

---

## C. Mapa de problemas (por categoría)

**Navegación**
- `historial-neumatico.html` no tiene `<nav>`: solo se sale por un botón "Volver" cuyo fallback
  apunta a `UI/renova_dashboard_taller_v1.html`, archivo inexistente en el repo
  (`historial-neumatico.html:288`) — enlace roto verificable, se dispara cuando no hay
  `document.referrer` (URL abierta directo o en pestaña nueva).
- Ninguna página tiene buscador de placa; `instalacion.html` no recuerda el filtro tras recargar
  (`selectedUnit`/`selectedPosition` hardcodeados a `"all"` en cada carga, `instalacion.html:399-400`,
  sin lectura de query params).
- `instalacion.html` no enlaza a `historial-neumatico.html` desde ninguna fila de su tabla —el
  flujo de descubrimiento es unidireccional (rendimiento/inspección → historial, nunca
  instalación → historial).

**Jerarquía**
- El botón "Enviar a Retén"/"Descartar" de modo Inspección (`Inspecciones por unidad.html:519-522`)
  tiene exactamente el mismo peso visual que cualquier acción real de la página, pero no hace
  nada — jerarquía visual miente sobre la importancia/efecto de la acción.
- Estado "seleccionado" en tabs de eje/posición de `rendimiento.html` se comunica solo con
  cambio de `border-color` a naranja (2px) — sin peso de fuente ni fondo diferenciado
  (`rendimiento.html:171,185`), señal débil comparado con el resto del sistema.

**Densidad / carga cognitiva**
- `rendimiento.html` recalcula en el cliente (`computeTire()`/`computeAxle()`,
  `rendimiento.html:538-604`) las mismas métricas que la vista SQL `v_rendimiento_dashboard_rows`
  ya entrega derivadas (comentario propio del archivo, `:441-449`) — dos lugares que deben
  mantenerse sincronizados, riesgo de que diverjan silenciosamente.
- Umbral de negocio hardcodeado en JS de página (`AXLE_BALANCE_THRESHOLD_PERCENT = 15`,
  `rendimiento.html:429`), con comentario propio admitiendo que está "pendiente de definir con
  RENOVA" — contradice la regla del proyecto de que los umbrales viven en datos, no en
  componentes (ya aplicada correctamente para el semáforo RTD).

**Componentes**
- Tres sistemas de botón/badge sin jerarquía declarada (ver Resumen ejecutivo, punto 5).
- Dos formateadores de fecha independientes y con robustez distinta:
  `instalacion.html:407` (`fdate`, ingenuo, rompe con timestamps de más de 3 segmentos) vs.
  `historial-neumatico.html:263-267` (`fmtDate`, valida longitud antes de reordenar).
- `animateCount`/`growFill` reimplementados casi idénticos en `INSPECCIONES POR
  FECHA.html:439-459` y `rendimiento.html:614-632`.

**Tablas**
- Solo 2 de 6 pantallas usan `<table>` real; el resto usa grids de tarjetas — inconsistencia de
  patrón para el mismo tipo de contenido (listado de registros).
- `instalacion.html`: 14 columnas, sin orden configurable por el usuario, tope fijo de 200 filas
  sin paginación ni aviso de "hay más resultados" (`instalacion.html:554`).
- `importar.html`: tabla de resultado sin `overflow-x:auto` (a diferencia de `instalacion.html`
  que sí lo tiene) — en viewport angosto puede desbordar sin scroll horizontal disponible.

**Filtros**
- Ubicación y tipo de filtro varía sin regla aparente entre páginas (header vs. toolbar vs.
  ausente).
- KPIs de `instalacion.html` se recalculan sobre el conjunto ya filtrado sin indicarlo
  visualmente (`instalacion.html:527-532`) — un supervisor puede leer "RTD inicial prom." creyendo
  que es de toda la flota cuando es solo del filtro activo.

**Gráficos**
- Cero gráficos en las 7 superficies. Ver detalle y oportunidades concretas en D.4 y G.

**Responsive**
- Modo Inspección de `Inspecciones por unidad.html` no tiene ninguna regla responsive propia — el
  diagrama 3D fijo (1700×1100px) y el layout (`min-width:1280px`) no reflowan nunca. El mismo
  diagrama, en modo Movimientos, sí está tratado con dos breakpoints (900px, 640px) que colapsan
  el layout y ocultan el diagrama 3D en favor de chips — **una asimetría real**: la misma pantalla
  es responsive en un modo y no en el otro.
- `.form-grid` de `instalacion.html` (2 columnas fijas, `instalacion.html:157`) no tiene override
  a 1 columna en ningún breakpoint.

**Accesibilidad**
- ~22 campos de formulario en los 3 modales de `instalacion.html` no tienen `label for=` (solo
  los 2 `<select>` de la toolbar lo tienen) — confirmado por grep, cero otras ocurrencias.
- Los modales de `instalacion.html` declaran `aria-modal="true"` sin implementar focus trap ni
  gestión de foco (sin `.focus()`, sin `autofocus`, sin `tabindex` en todo el archivo) — el
  atributo promete un comportamiento que el código no cumple.
- Las ruedas del diagrama 3D en modo Inspección no son focuseables por teclado (solo adquieren
  `role`/`tabindex`/`aria-label` cuando el modo activo es Movimientos, `diagram-view.js:68-71`).
- `historial-neumatico.html` e `importar.html` no tienen ningún `aria-live` para sus transiciones
  asíncronas (carga → dato / error) — cero ocurrencias confirmadas por grep en ambos archivos.
- `historial-neumatico.html` e `importar.html` no tienen función de escape de HTML
  (`esc()`); en `importar.html` esto es particularmente sensible porque el contenido interpolado
  proviene de un Excel subido por el usuario (dato no confiable por definición) e incluye valores
  crudos de celda en mensajes de error (`importar.html:410`, `:568-578,594-598`).

**Consistencia**
- La misma cantidad de dinero se muestra con dos monedas contradictorias dentro de
  `instalacion.html`: el formateador está hardcodeado a `currency:"USD"` (`instalacion.html:404`)
  pero el formulario de instalación por defecto usa `"PEN"` (`:283,600`) y de hecho envía
  `p_currency` desde ese campo (`:655`) — el campo `currency` que sí vuelve de la vista
  (`:426`) nunca se vuelve a leer (confirmado por grep). Una instalación registrada en soles se
  muestra con signo `$` de dólares tanto en la tabla como en la tarjeta KPI. **Esto es un bug de
  correctitud, no solo de presentación.**
- `--balance-ok`/`--balance-bad` en `rendimiento.html:71,73` duplican los valores hex de
  `--verified-green`/`--ember-orange` en vez de usar `var()` — mismo color, dos nombres,
  divergencia silenciosa garantizada en el primer retoque de paleta.

---

## D. Auditoría por página

### D.1 — `INSPECCIONES POR FECHA.html` (Vista de Flota)

- **Objetivo:** que un jefe de flota vea, para una fecha, qué unidades están en estado crítico y
  entre a la que necesita revisar.
- **Usuario:** jefe de flota / supervisor de neumáticos.
- **Información principal:** severidad por unidad (crítica/observación/normal), conteo total,
  proporción de flota en riesgo.
- **Acción principal:** abrir la inspección de una unidad (`openInspection()`,
  `INSPECCIONES POR FECHA.html:381-389`).
- **Problemas encontrados:**
  - Estado de carga y estado de error usan el mismo recuadro `.empty` que el estado "sin datos"
    genuino — solo cambia el texto (`:358,374,535,575`).
  - El resumen de severidad (barra segmentada + anillo) tiene un `role="img"` con `aria-label`
    solo para lector de pantalla (`:499-500`) — el usuario vidente no tiene tooltip ni forma de
    leer el detalle exacto salvo la leyenda de texto siempre visible (que sí cubre el caso, pero
    de forma indirecta).
  - Sin filtro por empresa/severidad — la única variable es la fecha.
  - Fallback de nombre de empresa inconsistente con `rendimiento.html` (`"—"` vs. `"Bus"`, ver §C).
- **Cambios recomendados:** diferenciar visualmente carga/error/vacío (icono o color, no solo
  texto); considerar mover el filtro de fecha a un rango en vez de fecha única si el negocio lo
  permite (fuera de alcance de esta auditoría sin confirmar con negocio).
- **Elementos que deben conservarse:** el patrón de resumen (barra segmentada + anillo, sin
  torta) — ya sigue `DESIGN.md §8` explícitamente y es el mejor ejemplo de KPI visual del
  dashboard.
- **Elementos que deben redefinirse:** el recuadro `.empty` compartido con carga/error.
- **Elementos que deben eliminarse o fusionarse:** ninguno — la página es la más compacta y
  enfocada del dashboard.

### D.2 — `Inspecciones por unidad.html`, modo Inspección

- **Objetivo:** consultar el estado detallado de una unidad, posición por posición.
- **Usuario:** jefe de flota / inspector revisando resultados ya cargados.
- **Información principal:** identidad del neumático seleccionado, RTD por canal, presión,
  anomalías.
- **Acción principal:** seleccionar una posición en el diagrama 3D del bus.
- **Problemas encontrados (severidad Alta):**
  - Los botones "Enviar a Retén" / "Descartar" **no persisten nada** — el propio comentario del
    código lo confirma ("Independientes del formulario de inspección diaria: no se disparan al
    guardar", `:971-972`); `enviarARetenAction()` (`:980-982`) y el confirmador de descarte
    (`:1012-1014`) solo llaman `showToast()`. Visualmente son indistinguibles de una acción real,
    y la versión que sí funciona (RPC real) vive un clic de distancia en modo Movimientos, en la
    misma pantalla, para el mismo neumático.
  - Sin ninguna regla responsive: diagrama fijo a 1700×1100px, `.dash{min-width:1280px}` sin
    override — en tablet o ventana angosta el layout desborda con scroll horizontal, mientras el
    modo Movimientos de la misma pantalla sí colapsa correctamente por debajo de 900px.
  - Las ruedas del diagrama no son focuseables por teclado en este modo (solo en Movimientos).
  - No hay `<table>` ni tabla de posiciones tabular — todo es un panel de detalle de una posición
    a la vez, sin vista de conjunto de las 8 posiciones salvo el color de cada rueda.
- **Cambios recomendados:** eliminar o rewire los botones de Retén/Descartar decorativos (o
  reemplazarlos por un enlace directo a modo Movimientos preseleccionando esa posición); extender
  las reglas responsive ya escritas para modo Movimientos a modo Inspección, ya que comparten el mismo
  `#stage`/diagrama.
- **Elementos que deben conservarse:** el diagrama 3D como identidad visual fuerte y única del
  producto (no es un grid abstracto, cumple la hipótesis de campo validada en
  `knowledge/ai/09`).
- **Elementos que deben redefinirse:** los botones Retén/Descartar decorativos.
- **Elementos que deben eliminarse o fusionarse:** posible fusión de la selección de posición
  entre ambos modos (hoy son dos variables de estado no sincronizadas — cambiar de modo no
  conserva la posición seleccionada).

### D.3 — `Inspecciones por unidad.html`, modo Movimientos

- **Objetivo:** registrar en un solo lote atómico los movimientos físicos de neumáticos de una
  unidad (retén, descarte con foto, intercambio, montaje) sin dejar estados intermedios.
- **Usuario:** personal de taller.
- **Información principal:** estado en vivo de cada posición (ocupada/vacía/pendiente de línea
  base/en conflicto), borrador del lote actual.
- **Acción principal:** confirmar el lote completo vía `confirm_tire_change_batch`.
- **Problemas encontrados:**
  - Hasta 6 superficies interactivas distintas para un solo lote (sidebar, tarjeta de posición,
    fila de acciones, modal de descarte, cajón de inventario, tarjeta de resumen con
    sub-editores) — complejidad alta, pero en su mayoría es complejidad de dominio real
    (retén/descarte/intercambio/montaje son operaciones distintas del taller), no accidental.
  - Convención de mayúsculas inconsistente entre botones: "CONFIRMAR LOTE"/"CONFIRMANDO…" se
    escribe ya en mayúsculas en el string fuente de JS (`summary-confirm.js:217,449`) vs.
    "Reintentar carga" en oración, en HTML estático (`Inspecciones por unidad.html:541`) — el CSS
    fuerza `uppercase` visualmente en algunos casos, pero el string fuente queda inconsistente
    para cualquier lectura de accesibilidad o auditoría de copy.
- **Cambios recomendados:** unificar convención de casing de copy (sentence case en fuente,
  `text-transform` solo si es necesario visualmente); sincronizar posición seleccionada con modo
  Inspección al alternar.
- **Elementos que deben conservarse:** clasificación de errores por tipo con recuperación
  específica (reintentar mismo lote, buscar en inventario, recarga forzada); manejo de
  `[estado_desactualizado]` (descarta borrador + recarga + aviso, sin reintento silencioso);
  `aria-live` y focus trap reales en los overlays — es el estándar de accesibilidad a replicar
  en el resto del dashboard, no a bajar.
- **Elementos que deben redefinirse:** convención de casing de copy.
- **Elementos que deben eliminarse o fusionarse:** ninguno estructural — la complejidad aquí es
  mayormente de dominio.

> **Nota de corrección:** una versión anterior de este documento incluía aquí un hallazgo sobre
> terminología "casco" vs. "neumático" citando un archivo `baseline-ui.js:143` y un "formulario de
> línea base". Se re-verificó contra el código actual: `baseline-ui.js` no existe en el repo, y no
> hay ninguna ocurrencia de "casco" ni de "línea base"/"baseline" en los 13 módulos JS de
> `WEB/movimientos/`. Ese hallazgo no tiene respaldo en el estado actual del código y se elimina;
> si el usuario confirma que existió en otra rama o versión, debería tratarse como un ítem aparte
> a re-investigar, no como parte de esta auditoría.

### D.4 — `rendimiento.html`

- **Objetivo:** que un supervisor identifique desbalance de eje o neumáticos con bajo rendimiento
  siguiendo el flujo Unidad → Eje → Posición → Neumático.
- **Usuario:** jefe de flota / analista de rendimiento.
- **Información principal:** Km/mm, vida proyectada, costo/km, balance izquierda/derecha.
- **Acción principal:** navegar el flujo de 4 niveles y, opcionalmente, saltar al historial de un
  casco (`goToHistory()`, `:824`).
- **Problemas encontrados:**
  - Recalcula en cliente lo que la vista SQL ya deriva (`computeTire()`/`computeAxle()`,
    `:538-604`) — riesgo de divergencia entre SQL y JS si la fórmula cambia en un solo lugar.
  - `AXLE_BALANCE_THRESHOLD_PERCENT = 15` hardcodeado en el HTML, marcado por el propio código
    como "pendiente de definir" — viola la regla del proyecto de umbrales-en-datos.
  - Tabs de eje/posición con `role="tablist"` incompleto: falta `aria-controls`/`role="tabpanel"`
    y `tabindex` en carrusel (roving tabindex) — cada pestaña queda individualmente
    tab-stoppable en vez de navegable con flechas, que es el patrón ARIA esperado para
    `tablist`.
  - Clase `summary-card` usada en el markup del estado vacío (`:1034`) pero nunca definida en el
    `<style>` — CSS muerto/huérfano.
  - Estado "seleccionado" de tabs se comunica solo con `border-color`, señal débil (ver C).
- **Cambios recomendados:** mover `AXLE_BALANCE_THRESHOLD_PERCENT` a una fuente configurable en
  Supabase apenas el negocio defina el valor real (hoy es un placeholder admitido); completar el
  patrón ARIA de tabs; eliminar la clase CSS huérfana.
- **Elementos que deben conservarse:** el flujo jerárquico de 4 niveles en sí (es la
  navegación correcta para este tipo de análisis); la barra de "Mejor vs. peor posición" como
  comparación directa sin torta ni gráfico decorativo.
- **Elementos que deben redefinirse:** fuente de verdad de las métricas (SQL vs. cliente).
- **Elementos que deben eliminarse o fusionarse:** clase CSS huérfana `summary-card`.

### D.5 — `historial-neumatico.html`

- **Objetivo:** consultar el historial completo de un casco específico (dónde estuvo instalado,
  qué inspecciones tuvo) para decidir si debe retirarse o sigue apto.
- **Usuario:** jefe de flota / taller, siempre llegando desde otra pantalla.
- **Información principal:** identidad del casco, km acumulado, lista de instalaciones, lista de
  inspecciones (RTD/PSI por fecha).
- **Acción principal:** ninguna de escritura (vista de solo lectura por diseño explícito,
  `:8,24`) — la acción es "leer y decidir fuera de esta pantalla".
- **Problemas encontrados (severidad Alta — enlace roto verificable):**
  - `goBack()` cae a `UI/renova_dashboard_taller_v1.html` cuando no hay `document.referrer`
    (`:288`) — ese archivo no existe en el repo. Se dispara al abrir el enlace directo o en
    pestaña nueva, un caso de uso real (compartir un enlace de historial por chat, por ejemplo).
  - No tiene barra de navegación ni buscador propio — solo se llega por deep-link, y la única
    salida "de emergencia" está rota (punto anterior).
  - Sin `esc()`/escape de HTML — riesgo menor aquí porque el dato viene de Supabase, no de un
    input directo del usuario, pero rompe la consistencia con `instalacion.html` que sí tiene un
    helper (aunque usado de forma incompleta ahí también).
  - 4-5 estados distintos (sin serie en URL, casco no encontrado, Supabase no configurado, error
    de red, listas vacías) todos renderizan el mismo recuadro `.th-empty` — "no hay historial
    todavía" es indistinguible de "no pudimos cargar el historial".
  - El propio header del archivo prohíbe explícitamente agregar gráficos (`:24`, "sin gráficos
    nuevos") pese a que su contenido central —RTD y PSI por fecha— es el caso de uso de libro
    para una serie de tiempo. Ver oportunidad de gráfico en G (marcado como decisión a validar
    con el usuario, no un cambio a aplicar unilateralmente).
- **Cambios recomendados:** corregir o eliminar el fallback roto de `goBack()`; agregar
  `esc()` por consistencia; diferenciar "sin datos" de "error de carga" visualmente; decidir
  explícitamente con el usuario si la prohibición de gráficos sigue vigente dado que es la
  oportunidad de mayor impacto para "mostrar info con gráficos" de todo el dashboard.
- **Elementos que deben conservarse:** el patrón de tarjetas apiladas para instalaciones/
  inspecciones (funciona bien para un historial de longitud variable sin necesidad de tabla).
- **Elementos que deben redefinirse:** navegación de salida (`goBack()` fallback).
- **Elementos que deben eliminarse o fusionarse:** ninguno.

### D.6 — `instalacion.html`

- **Objetivo:** que taller registre instalación, retiro o traslado de un casco.
- **Usuario:** personal de taller.
- **Información principal:** tabla de instalaciones activas, filtrable por unidad/posición.
- **Acción principal:** una de tres — Instalar / Retirar / Trasladar, cada una vía modal
  bottom-sheet con su propio RPC.
- **Problemas encontrados (severidad Alta — bug de correctitud):**
  - **Moneda mal mostrada**: el formateador de dinero está hardcodeado a `currency:"USD"`
    (`:404`) pero el formulario por defecto usa PEN (`:283,600,655`); el campo `currency` que
    la vista sí devuelve por fila (`:426`) nunca se vuelve a leer. Cualquier instalación en soles
    se muestra con signo de dólares tanto en la tabla como en el KPI agregado. Esto no es un
    matiz de presentación — es información financiera incorrecta mostrada a un usuario operativo.
  - **Sin confirmación en acciones destructivas**: Retirar y Trasladar no tienen ningún paso de
    confirmación adicional (`grep confirm(` → cero resultados) más allá de completar el propio
    formulario — la ficha de "unidad objetivo" hace de contexto, pero no hay un "¿estás seguro?"
    explícito para una operación que cierra una instalación físicamente.
  - **22 campos de formulario sin `label for=`** en los 3 modales (solo los 2 selects de la
    toolbar lo tienen) — clic en la etiqueta no enfoca el campo, asociación no garantizada para
    lectores de pantalla.
  - **`aria-modal="true"` sin foco gestionado**: cero llamadas a `.focus()`/`autofocus`/`tabindex`
    en todo el archivo — el atributo ARIA promete un comportamiento (foco atrapado) que el
    código no implementa.
  - KPIs se recalculan sobre el filtro activo sin indicarlo visualmente (`:527-532`).
  - `.form-grid` de 2 columnas fijas sin colapsar a 1 columna en ningún breakpoint (`:157`).
  - Tabla de 14 columnas, tope de 200 filas sin aviso de "hay más" ni paginación.
  - Sin enlace desde ninguna fila hacia `historial-neumatico.html` del casco correspondiente.
- **Cambios recomendados:** corregir el bug de moneda leyendo `r.currency` en vez del literal
  fijo; agregar confirmación explícita para Retirar/Trasladar; asociar `label for=` en los 22
  campos; implementar el focus trap que el `aria-modal` ya declara (reutilizar el patrón ya
  existente y probado de `a11y.js` en `WEB/movimientos/`, no reinventar uno nuevo); colapsar
  `.form-grid` a 1 columna bajo el breakpoint existente de 780px; agregar enlace a historial por
  fila.
- **Elementos que deben conservarse:** el patrón de "tarjeta objetivo" (qué casco/unidad/posición
  se está afectando) como contexto de confirmación implícito — es un buen punto de partida al que
  solo le falta el paso explícito de confirmación.
- **Elementos que deben redefinirse:** formateo de moneda, gestión de foco en modales,
  confirmación de acciones destructivas.
- **Elementos que deben eliminarse o fusionarse:** ninguno estructural.

### D.7 — `importar.html`

- **Objetivo:** cargar en bloque inspecciones históricas desde un Excel.
- **Usuario:** taller u oficina, para backfill de datos.
- **Información principal:** grupos (empresa, placa, fecha) detectados, con errores/avisos por
  grupo.
- **Acción principal:** enviar el archivo a Supabase, grupo por grupo.
- **Problemas encontrados:**
  - **No enlaza `renova-office-shell.css`** — reimplementa nav/header desde cero
    (`:79-95`), la evidencia más clara de que "compartir" el shell es hoy solo una convención de
    copiar-pegar, no una dependencia real.
  - **Sin `esc()`** y el contenido interpolado proviene de un Excel subido por el usuario —
    el caso de mayor riesgo real de inyección de HTML de todo el dashboard, porque acá el dato
    *es* no confiable por definición del flujo (`:410,568-578,594-598`).
  - Usa `alert()` nativo dos veces (`:563,587`) rompiendo el tono del resto de la página, que
    tiene su propio lenguaje visual de error (`.sum-card.has-errors`).
  - Gate de envío todo-o-nada: un solo grupo con error bloquea el envío de todos los demás
    grupos válidos (`:581-582`) — obliga a corregir el Excel completo y re-subir aunque el 95%
    ya esté bien.
  - Botón de envío no cambia de texto durante el proceso (solo se deshabilita) —
    `instalacion.html` sí cambia a "Guardando…" en sus formularios; inconsistente.
  - Sin indicador de salud global del import (cuántos grupos válidos vs. con error vs. con
    aviso) antes de desplazarse por toda la grilla.
  - Sin tabla `overflow-x:auto` en la tabla de resultado, a diferencia de `instalacion.html`.
- **Cambios recomendados:** enlazar `renova-office-shell.css` y eliminar la reimplementación
  local; agregar `esc()`; reemplazar `alert()` por el lenguaje de error propio de la página;
  evaluar permitir envío parcial (grupos válidos primero, grupos con error bloqueados
  individualmente) si el negocio lo permite; agregar contador de salud del import.
- **Elementos que deben conservarse:** la validación en dos niveles (error bloqueante vs. aviso)
  con copy claro — es el mejor patrón de validación del dashboard y debería ser el estándar a
  replicar en `instalacion.html`.
- **Elementos que deben redefinirse:** manejo de errores globales (`alert()` → patrón propio),
  dependencia de CSS compartido.
- **Elementos que deben eliminarse o fusionarse:** clase CSS muerta `.empty-hint` (`:175`, definida
  en el `<style>` pero sin ningún uso en el markup — confirmado por grep).

---

## E. Auditoría de componentes

| Componente | Problema | Ubicación | Recomendación | Prioridad | Esfuerzo |
|---|---|---|---|---|---|
| Tokens de color/tipografía | Redeclarados idénticos en 6 lugares en vez de una fuente única | `renova-office-shell.css` + `:root` inline en cada HTML | Enlazar `renova-office-shell.css` en todas las páginas y eliminar los `:root` locales | Alto | Medio |
| Botones/badges | 3 sistemas sin jerarquía declarada (`.btn-primary` shell vs. `.btn-accion` inline vs. `.tc-*`) | `renova-office-shell.css`, `Inspecciones por unidad.html:520-531`, `movimientos.css:152-172` | Elegir el sistema del shell como canónico; migrar o alias los otros dos | Alto | Alto |
| Botón "Retén"/"Descartar" (modo Inspección) | Decorativo, no persiste, indistinguible visualmente de una acción real | `Inspecciones por unidad.html:519-522,971,980-982,1012-1018` | Eliminar o redirigir a modo Movimientos preseleccionando la posición | Crítico | Bajo |
| Formateo de moneda | Hardcodeado a USD, ignora el campo `currency` real (PEN) | `instalacion.html:404,426` | Leer `r.currency` por fila | Crítico | Bajo |
| Estados vacío/carga/error | Mismo recuadro punteado para 3 significados distintos | `INSPECCIONES POR FECHA.html`, `rendimiento.html`, `historial-neumatico.html`, `instalacion.html` | Componente único con variante de icono/color por tipo de estado | Alto | Medio |
| Modales de `instalacion.html` | `aria-modal="true"` sin focus trap real, sin `label for=` en 22 campos | `instalacion.html:246-389` | Reutilizar `createFocusTrap` de `WEB/movimientos/a11y.js`; asociar labels | Alto | Medio |
| Diagrama 3D del bus (modo Inspección) | Sin reglas responsive propias, ruedas no focuseables por teclado | `Inspecciones por unidad.html` (inline `<style>`, script ~1082) | Extender las reglas responsive y de accesibilidad ya escritas para modo Movimientos | Alto | Medio |
| Tabs de eje/posición | Patrón ARIA `tablist` incompleto (falta `aria-controls`, roving tabindex) | `rendimiento.html:683-708` | Completar el patrón siguiendo el ya correcto de `mode-toggle.js` | Medio | Bajo |
| Formateador de fecha | Duplicado con robustez distinta (`fdate` vs `fmtDate`) | `instalacion.html:407`, `historial-neumatico.html:263-267` | Un solo helper compartido, usar la versión defensiva | Medio | Bajo |
| Animaciones de conteo/barra | `animateCount`/`growFill` duplicados casi idénticos | `INSPECCIONES POR FECHA.html:439-459`, `rendimiento.html:614-632` | Extraer a un `.js` compartido, patrón ya usado por `supabase-demo.js`/`renova-ready.js` | Medio | Bajo |
| `esc()` / escape de HTML | Ausente en `historial-neumatico.html` e `importar.html`; en este último el dato es no confiable (Excel subido) | `historial-neumatico.html` (sin helper), `importar.html:410,568-598` | Agregar `esc()` en ambos, especialmente `importar.html` | Alto | Bajo |
| `--balance-ok`/`--balance-bad` | Duplican hex de tokens existentes en vez de `var()` | `rendimiento.html:71,73` | Alias a `var(--verified-green)`/`var(--ember-orange)` | Bajo | Bajo |
| Breakpoints | 6 valores distintos sin relación (520/560/640/760/780/900px) | repartidos en 5 archivos | Definir 2-3 breakpoints estándar como comentario/convención compartida | Medio | Medio |
| Botón de envío (`importar.html`) | No cambia de texto durante el proceso, a diferencia de `instalacion.html` | `importar.html:592-623` | Igualar el patrón "Guardando…" ya usado en `instalacion.html` | Bajo | Bajo |
| `alert()` nativo | Rompe el tono/branding de la página | `importar.html:563,587` | Reemplazar por el lenguaje de error propio (`.sum-card.has-errors`) | Medio | Bajo |
| Enlace roto en "Volver" | Fallback apunta a archivo inexistente | `historial-neumatico.html:288` | Corregir la ruta de fallback o eliminarlo en favor de un enlace fijo a `rendimiento.html`/nav | Alto | Bajo |
| Nav de `historial-neumatico.html` | No existe — única salida es "Volver" | `historial-neumatico.html` (sin `<nav>`) | Agregar barra de navegación estándar del shell | Medio | Bajo |
| Clases CSS huérfanas | `.summary-card` (rendimiento), `.empty-hint` (importar) sin definición o sin uso | `rendimiento.html:1034`, `importar.html:175` | Eliminar o completar | Bajo | Bajo |

---

## F. Sistema visual recomendado

No se propone un sistema nuevo — `DESIGN.md` ya define uno completo y con criterio. Lo que falta
es que el código lo *use* en vez de copiarlo. Los tokens mínimos a materializar de verdad (una
sola fuente, sin redeclaración):

- **Color:** los 9 custom properties ya definidos en `renova-office-shell.css:3-13` —
  eliminar las 5 redeclaraciones idénticas en el resto de archivos, enlazar el shell en todos.
  Reemplaza: `:root` de `INSPECCIONES POR FECHA.html:37-61`, `rendimiento.html:57-83`,
  `historial-neumatico.html:33-49`, `instalacion.html:16-24`, `importar.html:50-68`,
  `Inspecciones por unidad.html:30-41`.
- **Tipografía:** `--mono`/`--display` ya existen en el shell; mismo tratamiento que color. Las
  fuentes embebidas en base64 dentro de `Inspecciones por unidad.html:14-29` deberían moverse a
  un `@font-face` compartido en vez de duplicarse por página.
- **Espaciado:** materializar la escala que `DESIGN.md` ya define en su frontmatter
  (`spacing.xs:8px … 2xl:24px`) como CSS custom properties en el shell — hoy no existe como
  variable en ningún `.css`, todo es píxel suelto. Reemplaza los valores repetidos de padding
  encontrados en `movimientos.css` y en los `<style>` inline de cada página.
- **Radios:** `DESIGN.md` ya define `rounded.xs..4xl` — mismo tratamiento, materializar como
  variables en vez de repetir `border-radius:8px`/`14px`/etc. sueltos en cada archivo.
- **Breakpoints:** definir 2 valores estándar (p. ej. `768px` tablet, `480px` móvil) que
  reemplacen los 6 valores actuales sin relación (520/560/640/760/780/900px); el modo Movimientos ya
  demostró que 900/640 funciona para el layout más complejo del dashboard — usar esos como base.
- **Estados (loading/error/empty):** un componente único con 3 variantes visuales distintas
  (icono + color, no solo texto) que reemplace `.empty`/`.note`/`.th-empty` en las 5 páginas que
  hoy los duplican con nombres distintos.
- **Botones/badges:** consolidar en el sistema del shell (`.btn-primary/.btn-submit/.btn-mini`)
  como canónico; los sistemas `.btn-accion`/`.tc-*` deberían extenderlo o quedar documentados
  como variante intencional (p. ej. `.tc-*` si se decide que el modo Movimientos necesita su propia
  densidad por ser una superficie operativa distinta) — decisión a validar con el usuario, no
  a imponer unilateralmente dado que tocar esto afecta CSS ya probado en producción.
- **Z-index/elevación:** ya gobernado por `DESIGN.md §4` (capas tonales, sombra solo para
  overlays flotantes) — se respeta bien en el código actual, no requiere cambio, solo mantenerlo
  al consolidar componentes.

Cada token propuesto reemplaza una duplicación ya identificada arriba; ninguno es nuevo respecto
a lo que `DESIGN.md` ya especifica — el trabajo es de **implementación**, no de diseño.

---

## G. Backlog priorizado

### 1. Quick wins
- **Corregir bug de moneda en `instalacion.html`.** Archivos: `instalacion.html:404,426,492,515`.
  Criterio de aceptación: el signo/código de moneda mostrado coincide con `currency` real de cada
  fila, en tabla y en KPI. Riesgo: bajo (solo lectura del campo ya existente). Dependencias:
  ninguna.
- **Corregir enlace roto en `historial-neumatico.html:288`.** Reemplazar el fallback inexistente
  por una ruta real (p. ej. `rendimiento.html` o la propia `Inspecciones por unidad.html`).
  Criterio: `goBack()` nunca apunta a un archivo inexistente. Riesgo: bajo. Dependencias: ninguna.
- **Agregar `esc()` en `historial-neumatico.html` e `importar.html`.** Prioridad más alta en
  `importar.html` por el origen no confiable del dato (Excel). Criterio: ningún string
  interpolado en `innerHTML` sin pasar por escape. Riesgo: bajo. Dependencias: ninguna.
- **Eliminar clases CSS huérfanas** (`rendimiento.html:1034` `.summary-card`, `importar.html:175`
  `.empty-hint`). Riesgo: nulo.
- **Alias `--balance-ok`/`--balance-bad` a los tokens existentes** (`rendimiento.html:71,73`).
  Riesgo: nulo — mismo valor, solo cambia la referencia.

### 2. Correcciones críticas
- **Desactivar o redirigir los botones decorativos "Retén"/"Descartar" de modo Inspección.**
  Archivos: `Inspecciones por unidad.html:519-522,971,980-982,1012-1018`. Criterio de aceptación:
  ningún botón visible en la pantalla aparenta persistir un dato sin persistirlo — o se elimina, o
  se redirige a la acción real de modo Movimientos. Riesgo: medio (tocar la pantalla más grande del
  dashboard); probar ambos modos tras el cambio. Dependencias: ninguna.
- **Confirmación explícita para Retirar/Trasladar en `instalacion.html`.** Criterio: ninguna
  acción que cierre/mueva una instalación se ejecuta sin un paso de confirmación separado del
  formulario mismo. Riesgo: medio (cambia el flujo de un RPC ya en producción, probar
  exhaustivamente). Dependencias: ninguna.
- **Focus trap real en los 3 modales de `instalacion.html`.** Reutilizar `createFocusTrap` de
  `WEB/movimientos/a11y.js` (ya probado). Criterio: `Tab` no escapa del modal, `Escape` cierra,
  foco vuelve al disparador. Riesgo: bajo-medio. Dependencias: ninguna (el helper ya existe).

### 3. Unificación de componentes
- **Enlazar `renova-office-shell.css` en todas las páginas y eliminar `:root` duplicados.**
  Archivos: los 6 HTML. Criterio: un solo lugar define cada token de color/tipografía; cambiar un
  valor ahí se refleja en todo el dashboard sin tocar otro archivo. Riesgo: medio (verificar
  orden de carga/cascada tras remover las reglas locales, especialmente donde el inline
  actualmente gana por orden de fuente). Dependencias: ninguna, pero conviene hacerlo antes del
  ítem de botones/badges.
- **Consolidar sistema de botones/badges** en el canónico del shell. Riesgo: alto si se toca
  visualmente el modo Movimientos sin cuidado — requiere smoke test real de los 2 modos, no solo
  build. Dependencias: depende del ítem anterior (tokens unificados primero).
- **Componente único de estado vacío/carga/error** con variante por tipo. Archivos: las 5 páginas
  que hoy duplican el patrón. Riesgo: bajo-medio. Dependencias: depende de tokens unificados.
- **Centralizar formateadores de fecha y utilidades de animación** duplicados. Riesgo: bajo.

### 4. Redefinición visual
No se identificó necesidad de redefinir el lenguaje visual en sí — es intencional, documentado y
respetado por todas las páginas. El único punto de redefinición real es la **jerarquía de foco en
tabs** (`rendimiento.html`, selección solo por `border-color`) y **completar el patrón ARIA de
tablist** en la misma pantalla. Riesgo: bajo. Dependencias: ninguna.

### 5. Mejoras estructurales
- **Buscador/autocomplete de placa**, ausente en las 6 páginas. Impacto: alto para flotas
  grandes donde escanear un `<select>` completo o una grilla completa no escala. Requiere validar
  con el usuario el patrón exacto (autocomplete tipo el ya usado en la app móvil, según
  `knowledge/ai/09`, sección "Inputs/Autocomplete" de `DESIGN.md`). Riesgo: medio. Dependencias:
  ninguna técnica, pero requiere decisión de producto sobre alcance.
- **Persistir filtros de `instalacion.html` en la URL** (unidad/posición vía query params, como
  ya hace el modo de `Inspecciones por unidad.html`). Riesgo: bajo. Dependencias: ninguna.
- **Enlace bidireccional instalación ↔ historial de casco.** Riesgo: bajo. Dependencias: ninguna.
- **Sincronizar posición seleccionada entre modo Inspección y modo Movimientos** al alternar. Riesgo:
  medio (tocar el orquestador `movimientos-controller.js`). Dependencias: ninguna.
- **Extender las reglas responsive/accesibilidad de modo Movimientos a modo Inspección** (mismo
  diagrama, mismo `#stage`). Riesgo: medio. Dependencias: ninguna.

### 6. Mejoras opcionales (visualización — alineado con la preferencia del usuario por gráficos)
Ninguna de estas reemplaza una tabla existente sin necesidad — cada una está anclada a un dato ya
mostrado como texto que hoy exige lectura secuencial en vez de comparación visual:
- **RTD/PSI en el tiempo** en `historial-neumatico.html` ("Inspecciones pasadas" ya es una lista
  ordenada por fecha de `{fecha, rtd, psi}`) — un sparkline o línea simple encima de la lista de
  tarjetas. **Nota:** el propio archivo prohíbe explícitamente "gráficos nuevos" en su comentario
  de cabecera (`:24`) — este ítem requiere una decisión explícita del usuario/negocio antes de
  implementarse, no debe aplicarse unilateralmente aunque sea la oportunidad más clara del
  dashboard.
- **Distribución de tipos de movimiento** en el paso de confirmación de lote de modo Movimientos
  (`summary-confirm.js`) — hoy es una lista secuencial de movimientos sin resumen agregado; una
  barra apilada simple ("3 descartes · 2 montajes · 1 intercambio") antes de la lista.
- **Barra de proporción de salud del import** en `importar.html` (válidos/con error/con aviso)
  antes de la grilla de tarjetas, en vez de obligar a contar visualmente.
- **RTD por canal como mini-barras** en la tarjeta de detalle de modo Inspección
  (`#canales`, hoy 4 celdas de texto) — encaja con el patrón de "barra de distribución segmentada"
  que `DESIGN.md §8` ya aprueba explícitamente para este dashboard.

Ninguna de estas mejoras es una animación o elemento decorativo — todas reemplazan lectura
secuencial de números por comparación visual directa, que es el criterio que `DESIGN.md` y las
guías de referencia (Apple HIG, Vercel) exigen para justificar un gráfico.

---

## H. Propuesta de implementación por fases

- **Fase 1 — Correcciones sin alterar estructura:** bug de moneda, enlace roto de
  `historial-neumatico.html`, `esc()` faltante, clases CSS huérfanas, alias de tokens duplicados
  en `rendimiento.html`. Todo reversible, sin tocar layout ni flujo.
- **Fase 2 — Unificación de componentes:** enlazar `renova-office-shell.css` en las 6 páginas y
  eliminar `:root` duplicados; consolidar formateadores de fecha y utilidades de animación.
  Requiere smoke test de las 6 páginas tras el cambio de cascada CSS.
- **Fase 3 — Sistema de tokens:** materializar espaciado y radios como CSS vars en el shell;
  estandarizar breakpoints a 2-3 valores. Requiere decidir con el usuario si `.tc-*` del modo
  Movimientos se mantiene como variante intencional o se migra al sistema canónico.
- **Fase 4 — Navegación y jerarquía:** desactivar/redirigir botones decorativos de modo
  Inspección; agregar `<nav>` a `historial-neumatico.html`; enlace bidireccional
  instalación↔historial; sincronizar selección entre modos de `Inspecciones por unidad.html`.
- **Fase 5 — Tablas, filtros y gráficos:** persistir filtros de `instalacion.html` en URL;
  paginación/aviso de "hay más" en tabla de 200 filas; decisión explícita sobre gráficos en
  `historial-neumatico.html` y las demás oportunidades de la sección G.6.
- **Fase 6 — Accesibilidad y responsive:** focus trap real en modales de `instalacion.html`,
  `label for=` en los 22 campos, confirmación explícita para acciones destructivas, extender
  responsive/teclado de modo Inspección al nivel ya alcanzado por modo Movimientos, completar patrón
  ARIA de tabs en `rendimiento.html`.
- **Fase 7 — Refinamiento visual:** consolidación final de sistema de botones/badges una vez
  validado con el usuario qué variantes son intencionales vs. accidentales.

No se implementa nada en esta fase. Este documento es la auditoría completa; el siguiente paso es
que el usuario confirme alcance y orden antes de tocar código.
