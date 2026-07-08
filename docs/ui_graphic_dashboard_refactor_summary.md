# UI graphic-first dashboard refactor — resumen (2026-07-08)

Refactor visual de los dos dashboards web de consulta (Vista de Flota y Rendimiento) aplicando
`design-principle.md` § "Graphic-first dashboard principle". Cambio **solo de UI**: cero cambios
en fórmulas, umbrales, esquema de datos o el patrón de conexión a Supabase descrito en
`docs/run2_dashboard_connection_plan.md` (que sigue sin conectarse — ambos archivos siguen siendo
mock autocontenido, tal como estaban).

## Archivos tocados

- `design-principle.md` (nuevo) — principios transversales de dashboard.
- `vista-flota.html`
- `rendimiento.html`
- `docs/ui_graphic_dashboard_refactor_summary.md` (este archivo)

No se tocó `app/`, ningún archivo de `supabase/`, `historial-neumatico.html`, `inventario.html`
ni `UI/renova_dashboard_taller_v1.html`.

## Vista de Flota (`vista-flota.html`)

**Antes:** 5 stat cards de texto (Unidades inspeccionadas, Críticas, En observación, Normales, %
flota en riesgo) + una leyenda de colores separada sobre el grid + cards de unidad con un
esquema de pills por neumático (uno por posición, coloreado).

**Después:**
- Las 5 stat cards se reemplazan por un panel único `.fleet-overview` con tres bloques:
  - **Total** (número grande con conteo ascendente al cargar/cambiar de fecha).
  - **Distribución por severidad**: una barra segmentada horizontal (verde/amarillo/naranja)
    que crece desde 0% al renderizar, con leyenda de conteos debajo — sigue el patrón ya
    documentado en `DESIGN.md` §8 ("una sola barra horizontal apilada… nunca torta, nunca 3D").
  - **Riesgo de flota**: un anillo de progreso (`conic-gradient`) con el % animado en el centro.
- Se eliminó la leyenda de colores separada sobre el grid (`.legend`/`.swatch`) porque quedó
  duplicada con la leyenda de la barra de distribución.
- Cada unit-card perdió el esquema de pills por neumático (`renderSchematic`, clases
  `.schematic/.axle-row/.tire`) y el pie de card con conteo de llantas críticas/RTD mínimo. Ahora
  muestra solo: placa, empresa, configuración (tipo de equipo) y un estado grande por color
  (CRÍTICA / OBSERVACIÓN / NORMAL) — sin inventar razones de daño.
- Las cards entran con un fade + slide sutil y un `stagger` de hasta ~260ms según su posición en
  el grid; el panel superior entra con un fade propio.
- Toda animación respeta `prefers-reduced-motion` (ya existía la regla CSS global; se agregó el
  guard equivalente en JS para el conteo ascendente y el crecimiento de barras/anillo, que se
  aplican vía `requestAnimationFrame` y no vía transición CSS pura).
- La regla de color de esta pantalla (peor caso por unidad, naranja = crítico/máxima severidad,
  sin rojo) no cambió — sigue siendo la definida en el comentario de cabecera del archivo.

## Rendimiento (`rendimiento.html`)

**Antes:** grid de 4 avg-stat (Km Acumulado, Km Proyectado promedio, Km/mm promedio, % Consumo
promedio) siempre a 2 columnas; dos cards de texto separadas "Mejor posición" / "Peor posición";
gráfico de barras por posición debajo; contenedor limitado a `max-width:1080px`.

**Después:**
- `main`/header/footer pasan a `max-width:1280px` y `.avg-kpis` usa
  `grid-template-columns:repeat(auto-fit,minmax(220px,1fr))`, así los 4 KPIs ocupan el ancho real
  en desktop (hasta 4 en una fila) en vez de quedar en una columna angosta con espacio muerto a
  los lados. En mobile sigue colapsando a 1 columna (regla ya existente, sin cambios).
- Tres de los cuatro KPIs del eje llevan ahora un relleno visual bajo el número:
  - **Km Proyectado promedio** y **Km/mm promedio**: una barra delgada que muestra dónde cae el
    promedio entre la peor y la mejor posición válida del eje (contexto relativo, color neutro
    "acero" `--bar-steel` — el mismo que ya usaba el gráfico por posición para no mezclarse con
    la semántica de severidad de Inspección ni con el balance Izq/Der).
  - **% Consumo promedio**: barra en escala absoluta 0–100% (cuánta banda de rodamiento se
    consumió).
  - **Km Acumulado** (total del eje, no promedio) se dejó como número animado sin barra: es una
    suma sin un rango natural de eje con el que compararlo, así que agregar una barra ahí
    hubiera sido decorativo, no informativo (regla del principio: "cada gráfico debe responder
    una pregunta real").
- Las dos cards de texto "Mejor posición" / "Peor posición" (`.bw-row`/`.bw-card`) se reemplazaron
  por un único panel `.bw-panel` con dos barras de comparación apiladas (mejor en verde
  `--balance-ok`, peor en amarillo `--signal-yellow`, la peor escalada proporcionalmente a la
  mejor) más el % de diferencia. Esto quita la duplicación con el gráfico de barras por posición
  de más abajo (que ya marcaba la posición más floja con `.is-min`) sin perder el dato.
- El gráfico "Rendimiento por posición" (barras por Km/mm) ahora también crece desde 0% al
  entrar, usando el mismo mecanismo (`data-pct` + `requestAnimationFrame` en dos pasos) que el
  resto de las barras nuevas — antes se pintaba directo en su ancho final sin animación de
  entrada.
- El bloque de resumen del eje (`.axle-analysis`) y la card de detalle del neumático
  (`.tire-card`) entran con un fade + slide sutil cada vez que se cambia de eje/posición/unidad.
- Se conservó íntegro el flujo Eje → Posición → Detalle, el veredicto de balance Izq/Der, el link
  "Ver historial" hacia `historial-neumatico.html`, y el estado "Sin datos suficientes" para
  posiciones sin fuente (nunca se inventó un valor).

## Qué NO se tocó (intencional)

- Ninguna fórmula de `computeTire()`/`computeAxle()`/`calculateUnitStatus()`/`tireStatus()`.
- Ningún umbral (`AXLE_BALANCE_THRESHOLD_PERCENT`, los cortes 4/8mm de Vista de Flota, etc.).
- El patrón de conexión a Supabase: ambos archivos siguen siendo 100% mock, tal como decide
  `docs/run2_dashboard_connection_plan.md` ("no se conecta ningún HTML" por ahora). No se agregó
  ningún `fetch`, no se tocó `SUPABASE_URL`/`SUPABASE_KEY` porque no existen en estos archivos
  todavía — el día que se conecten, el patrón de fallback documentado ahí sigue aplicando sin
  fricción con esta UI.
- `app/` (la app móvil real) — cero cambios, como pide el encargo.
- El esquema de datos mock (`UNITS`, `INSPECTIONS`, `TIRES`, `TIRE_SERIES`) — mismas formas,
  mismos campos.

## Deuda de UI pendiente / recomendaciones futuras

- El anillo de riesgo (`risk-ring`) usa un `conic-gradient` simple; si más adelante se necesita
  una escala de color continua (no solo naranja=riesgo), conviene definir esa escala en
  `design-principle.md` antes de improvisarla en el HTML.
- En Rendimiento, cuando un eje tiene 3+ posiciones válidas con valores muy dispersos, la barra
  de "posición del promedio" (`.a-fill`) puede quedar casi llena o casi vacía si el promedio está
  muy cerca de un extremo — es el comportamiento esperado (rango min–max), pero conviene
  validarlo con datos reales de campo, no solo con el mock.
- No se implementó heat-map ni sparkline histórico (mencionados como opciones en el encargo)
  porque ninguno de los dos dashboards tiene todavía una serie temporal por unidad/posición más
  allá de la fecha seleccionada — agregar eso requeriría antes decidir qué historial se guarda
  (fuera de alcance de este refactor de UI).
- Layout desktop de Rendimiento: se ensanchó el contenedor y se hizo que los KPIs usen
  `auto-fit`, pero el resumen del eje y la card de detalle del neumático siguen apiladas
  verticalmente (no lado a lado) para no alterar el orden del flujo Eje → Posición → Detalle ni
  arriesgar el `STATE.md`/flujo ya validado. Si se quiere aprovechar aún más el ancho en pantallas
  muy grandes (≥1600px), es un cambio de layout más grande que conviene spec-earlo aparte.
