# RENOVA INSPECTOR — Principios de diseño

Complementa a `DESIGN.md` (sistema visual: paleta, tipografía, componentes). Este documento
recoge principios transversales de **comportamiento** de las pantallas de dashboard (lectura,
no captura) que no dependen de un componente puntual.

## Graphic-first dashboard principle

Los dashboards web (jefe de flota / mantenimiento) priorizan la interpretación visual sobre el
reporte denso en texto. Reglas:

- Los dashboards web deben priorizar la interpretación visual por sobre el reporte cargado de
  texto.
- La información crítica de flota se representa con gráficos, proporciones visuales, anillos de
  progreso, barras, gauges, indicadores de calor o comparativas compactas — no con listas de
  números sueltos.
- Los números pueden (y deben) aparecer, pero siempre acompañados de contexto visual (una barra,
  un anillo, un relleno) que permita leerlos sin hacer la cuenta mentalmente.
- Las animaciones son sutiles y funcionales, nunca decorativas: cada movimiento comunica que un
  valor cambió o terminó de cargar, no rellena espacio.
- Los valores KPI animan con un conteo ascendente suave al cargar o actualizarse (~500-700ms,
  `ease-out`, sin rebote).
- Los charts/cards aparecen con transiciones pequeñas de fade/slide/scale (`translateY` + fade,
  ~250-300ms) — nunca entradas bruscas ni con rebote.
- Los colores de severidad son fijos y no se reinterpretan por pantalla:
  - **verde** = normal / seguro
  - **amarillo** = observación / advertencia
  - **naranja** = riesgo / atención — y es, en este sistema, la **máxima severidad** (ver
    DESIGN.md §8: "el naranja ES el color de máxima severidad del sistema; no se introduce
    rojo"). Si un futuro dashboard necesitara un cuarto nivel por encima de naranja, se define
    explícitamente aquí antes de usar rojo — no se improvisa por pantalla.
- La interfaz debe permitir a un inspector o jefe de flota entender el estado de la flota **en
  segundos**, sin leer párrafos.
- Evitar KPIs duplicados: si una comparación ya existe en un formato visual superior (una barra,
  un panel de comparación), no repetirla como card de texto aparte.
- Usar el espacio horizontal disponible: en desktop, evitar layouts angostos tipo columna única
  con espacio muerto a los costados; los grids deben usar `auto-fit`/`minmax` para ocupar el
  ancho real de la pantalla.
- Mobile-first es válido como base de diseño, pero desktop no debe desperdiciar áreas laterales
  grandes — los mismos componentes deben reflowear a más columnas cuando hay espacio.
- Los datos estables se muestran con claridad; los datos inciertos o faltantes se muestran con
  honestidad como **"Sin dato"** / **"Sin datos suficientes"** — nunca se inventa un valor ni se
  usa 0 como relleno (ver `specs/reglas_negocio.md` §8, ya vigente en el motor de cálculo).
- Los dashboards son operativos, no decorativos: cada gráfico debe responder una pregunta real de
  flota ("¿cuántas unidades están en riesgo hoy?", "¿qué posición rinde peor en este eje?"). Si un
  gráfico no responde una pregunta que un jefe de flota se haría, no se agrega.

### Aplicación (2026-07): Vista de Flota y Rendimiento

Ver `docs/ui_graphic_dashboard_refactor_summary.md` para el detalle de qué cambió en cada
pantalla al aplicar estos principios por primera vez.
