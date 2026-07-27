# Plan de implementación — Presentación RENOVA, lunes 2026-07-27

> **Estado: implementado el 2026-07-26.** El archivo `renova-deck.html` está construido y
> verificado en Chrome. Este documento pasa de spec a referencia: describe lo que el deck hace y
> por qué. Las desviaciones respecto del plan original están en la sección 11.

Spec ejecutable. Produce **un solo archivo**: `presentacion html/renova-deck.html`,
autocontenido, que abre con doble clic sin internet.

Fuente obligatoria de cifras: `presentacion html/DATOS-VERIFICADOS.md`. Léelo antes de escribir
una sola cifra en un slide. Si un número no está ahí, no se escribe.

---

## 1. Contexto

**Quién presenta:** Facundo Foronda.
**Ante quién:** el equipo de RENOVA. RENOVA es la reencauchadora; sus clientes son las flotas de
buses interprovinciales. Quieren (a) ofrecer la plataforma como producto nuevo a esos clientes y
(b) operar ellos mismos con más automatización y velocidad.

**Consecuencia sobre el tono:** el deck se arma *como si le hablara a un cliente potencial*, porque
esa es la conversación que RENOVA va a tener después. Pero la sala es interna, y hay un
desarrollador presente que va a verificar lo que se afirme. Vender y sostener técnicamente no están
en tensión aquí: la honestidad calibrada es el argumento de venta.

**Formato:** el deck acompaña una **demo en vivo del producto real**. No es un deck que se explica
solo. Cuatro cortes a Chrome, marcados por slides-señal.

**Duración:** 15–20 minutos, 18 slides.

---

## 2. El arco narrativo

El proyecto se llama **RENOVA INSPECTOR**, y ese nombre ya le queda chico: hoy hace rendimiento,
servicios, movimientos, inventario e historial de casco. Ese desajuste es el arco del deck.

- **Slide 1** abre con el nombre con el que nació.
- **Slide 18** cierra mostrando en qué se convirtió, y plantea el cambio de nombre como
  consecuencia natural, no como pendiente administrativo.

No lo menciones en ningún slide intermedio. El remate depende de que nadie lo vea venir.

---

## 3. Principios de contenido (no negociables)

1. **El deck nunca imprime un número que el producto vaya a mostrar en pantalla segundos después.**
   Si el slide dice un KPI y Rendimiento muestra otro porque se corrigió una fórmula, se pierde la
   sala entera. El deck aporta volumen, cobertura y contexto; la pantalla aporta los KPI. Ver
   `DATOS-VERIFICADOS.md` §4.
2. **Cero cifras inventadas.** Los cinco huecos de `DATOS-VERIFICADOS.md` §5 se renderizan como
   marcadores visibles en el HTML (fondo punteado, texto `[COMPLETAR: …]`) para que Facundo no
   pueda olvidarlos. Es preferible un hueco visible a un número plausible y falso.
3. **Minimalismo real.** Titular + un gráfico + una nota de fuente. Nada de párrafos. Si un slide
   necesita dos ideas, se separan con línea divisoria y etiqueta de sección en otro color, con
   espacio en blanco generoso entre bloques.
4. **La deuda se declara, no se esconde.** El slide 14 existe a propósito. Frente a un técnico,
   declarar los límites primero da credibilidad; que él los descubra la destruye.
5. **Español neutro, cercano al uso peruano.** Nada de voseo (`elegí`, `podés`, `mirá`). Usar
   `elige`, `puedes`, `revisa`, `ingresa`. Es regla del proyecto y el deck no es excepción.

---

## 4. Sistema visual

Tokens exactos de `DESIGN.md`. No inventes colores.

```
--screen-dark    #07111C   fondo de escenario
--field-dark     #111E2E   superficies y paneles
--border-dark    #1B2D42   bordes
--navy-brand     #15233F   bloques de marca
--ember-orange   #F06822   acción, foco, categoría PRODUCTO
--signal-yellow  #f4b821   hito y valor destacado, categoría FASE 2
--verified-green #1f9d6b   completo/operativo, categoría OPERACIÓN
--value-ice      #F0F8FF   texto de valor en alto contraste
--label-cool     #7E9CBF   etiquetas y texto secundario
```

### Color por categoría de kicker

Consistente en todo el deck. El kicker es pequeño, en mayúsculas, con `letter-spacing` amplio.

| Categoría | Color | Slides |
|---|---|---|
| `PRODUCTO` | `--ember-orange` | 3, 4 |
| `DATO` | `--signal-yellow` | 5, 9, 11 |
| `OPERACIÓN` | `--verified-green` | 7, 13 |
| `ESTADO` | `--label-cool` | 14 |
| `FASE 2` | `--signal-yellow` | 15, 16 |
| `NEGOCIO` | `--value-ice` | 2, 17 |

Los slides-señal (6, 8, 10, 12) no llevan kicker de categoría: su encabezado es `▶ AHORA EN VIVO`
sobre fondo naranja completo. La portada (1) y el cierre (18) tampoco siguen esta tabla.

### Tipografía

Sin descargas. Dos familias:

- **Titulares:** serif del sistema — `Cambria, Georgia, "Times New Roman", serif`. Presente en
  Windows, macOS y la mayoría de Linux. Peso 600–700, `letter-spacing: -0.02em`.
- **Datos, kickers, cifras y notas:** `"JetBrains Mono"` — **está instalada en la máquina de
  Facundo** (`~/.local/share/fonts/`). Codex debe embeberla en base64 como `woff2` dentro del
  `<style>`, subseteada a latín + puntuación + dígitos, para que el archivo funcione en cualquier
  laptop. Fallback: `ui-monospace, "IBM Plex Mono", Menlo, monospace`.

Es la fuente real del producto. Que el deck y la pantalla en vivo compartan la tipografía de los
números hace que el corte a Chrome se sienta continuo en vez de un salto a otra herramienta.

Todas las cifras usan `font-variant-numeric: tabular-nums`.

### Layout

Panel de texto a un lado, panel visual al otro, **alternando el lado en cada slide** para variar el
ritmo. Los slides-señal y la portada son la excepción: van a sangre completa.

Proporción 55/45 (texto/visual) en escritorio. El panel de texto lleva, de arriba abajo:
kicker → titular → gráfico o dato → nota de fuente al pie en `--label-cool`, 13px.

---

## 5. Arquitectura técnica

### 5.1 Escenario fijo escalado — la decisión que protege la demo

**Renderiza todo dentro de un escenario de 1600×900 px y escálalo con `transform: scale()` para que
entre en el viewport.**

```js
function fitStage() {
  const s = Math.min(innerWidth / 1600, innerHeight / 900);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fitStage);
```

El escenario va `position: fixed; left: 50%; top: 50%; width: 1600px; height: 900px;
transform-origin: center`.

Sin esto, un proyector 4:3 o una laptop con escalado del sistema al 125 % rompe la tipografía en
vivo y no hay forma de arreglarlo en el momento. Con esto, el layout se calcula una sola vez y se
adapta a cualquier pantalla sin recalcular nada.

El `<body>` lleva `overflow: hidden` y fondo `--screen-dark`, de modo que el sobrante alrededor del
escenario se funde con el deck.

### 5.2 Navegación

| Tecla | Acción |
|---|---|
| `→`, `↓`, `Espacio`, `PageDown` | Siguiente |
| `←`, `↑`, `PageUp` | Anterior |
| `Home` / `End` | Primero / último |
| `F` | Pantalla completa (`requestFullscreen`) |
| `D` | Alterna notas del presentador |
| `Esc` | Cierra notas |
| Número + `Enter` | Salta a ese slide |

Además: botones `‹` `›` discretos abajo a la derecha (opacidad 0.35, opacidad 1 al pasar el mouse)
y un **indicador de progreso vertical** sobre el borde izquierdo: un punto por slide, el activo en
`--ember-orange` y expandido a barra corta. Los puntos son clicables.

Los slides-señal llevan un punto **naranja hueco** para que se distingan a simple vista del resto —
así Facundo sabe cuántos cortes le faltan sin contar.

### 5.3 Transición y re-disparo de animaciones

Un solo slide visible a la vez. Transición: `opacity` 320 ms + `translateY(12px)` de entrada.

**Crítico:** los gráficos deben animarse **cada vez que se entra al slide**, no solo la primera vez.
Facundo va a volver atrás durante la sesión.

```js
function activate(index) {
  slides[index].classList.add('is-active');
  slides[index].querySelectorAll('[data-anim]').forEach(resetAndRun);
}
```

Cada gráfico se implementa como una función registrada por `data-anim`, que primero **resetea** al
estado cero y luego corre. Sin reseteo, el segundo paso por el slide muestra el gráfico ya
terminado y la demo pierde ritmo.

### 5.4 Notas del presentador

Panel inferior deslizable, oculto por defecto, que alterna con `D`. Fondo `--field-dark`, borde
superior `--ember-orange`. Contiene lo que Facundo dice y, en los slides de demo, los avisos de
"qué no afirmar" de `DATOS-VERIFICADOS.md` §6.

**No** uses una ventana secundaria ni `window.open`: en una sala con un proyector desconocido, una
segunda ventana es un riesgo innecesario.

### 5.5 Accesibilidad y robustez

- `prefers-reduced-motion: reduce` → sin transiciones, contadores que saltan al valor final,
  barras que aparecen completas.
- Todo gráfico lleva su valor también como texto legible. El color nunca es el único canal.
- `@media print` → un slide por página en horizontal, animaciones en estado final, para exportar a
  PDF como respaldo.
- Cero `fetch`, cero `<script src>` externo, cero `@import` de fuentes remotas, cero imágenes que
  no sean `data:` URI o SVG en línea.
- Sin `alert()`, `confirm()` ni `prompt()` en ningún camino de código.

---

## 6. Contrato de gráficos

Ocho tipos distintos, uno por familia de slide. **No repetir barras en todos lados** — la variedad
es lo que sostiene la atención durante 18 pantallas.

| # | Tipo | Dónde | Implementación |
|---|---|---|---|
| G1 | Contadores | 5 | `requestAnimationFrame`, easing `easeOutCubic`, 900 ms, `tabular-nums` |
| G2 | Barras horizontales | 2, 14 | `width` de 0 % al valor, `transition` escalonada 80 ms entre barras |
| G3 | Anillo / donut | 9 | SVG, `stroke-dasharray` animado sobre `circle`, leyenda con conteo y % |
| G4 | Columnas verticales | 17 | `height` de 0 al valor, desde la base, escalonadas |
| G5 | Burbujas proporcionales | 16 | SVG, radio ∝ √valor, entrada con `scale` desde 0 |
| G6 | Diagrama de flujo por pasos | 13 | Nodos SVG que se encienden en secuencia, 500 ms entre pasos |
| G7 | Ciclo circular | 15 | SVG, flecha que recorre el círculo y enciende cada estación |
| G8 | Mapa de posiciones del bus | 4 | SVG del esquema 2-4-2 dibujado a mano, posiciones que toman color de estado |

**G8 es el activo visual más valioso del deck.** Es el diagrama que identifica a RENOVA y ninguna
otra plataforma lo tiene. Dibújalo como SVG en línea: dos ruedas delanteras, cuatro de tracción en
el eje medio, dos posteriores. Cada posición es un `rect` redondeado que puede tomar
`--verified-green` (completa), `--signal-yellow` (próxima a cambio) o `--ember-orange` (requiere
cambio).

---

## 7. Los 18 slides

Formato de cada ficha: kicker, titular, contenido visual, nota al pie, y notas del presentador.

### 7.0 Los dos viajes de ida y vuelta — la columna vertebral de la demo

La demo no muestra pantallas: muestra que **algo hecho en el celular aparece solo en el proyector**.
Eso es lo único que no se puede fingir en una diapositiva, y es el argumento entero del producto.
Hay dos viajes y **no se comportan igual**. Codex debe reflejar esa diferencia en los slides-señal,
porque de ahí depende que Facundo no se quede callado esperando algo que no va a llegar solo.

| | **Viaje 1 — Inspección** | **Viaje 2 — Movimiento** |
|---|---|---|
| Recorrido | Celular → tablero | Web → celular → tablero |
| Slides | 6 (ida) → 8 (vuelta) | 12 (completo) |
| Mecanismo | **Realtime**: las tablas de inspección están publicadas | **Sondeo cada 10 s**: la tabla de ejecuciones **no** está publicada |
| Latencia | Instantánea | Hasta 10 segundos (medido en campo: menos de 8) |
| Requisito | Tablero abierto en la unidad correcta | Pestaña de Servicios **visible**; en segundo plano el sondeo no corre |
| Riesgo en vivo | Bajo | **La pausa parece una falla si nadie habla** |

Verificado el 2026-07-26 contra producción: `pg_publication_tables` para `supabase_realtime`
devuelve exactamente dos tablas, `inspections` e `inspection_measurements`.

**Consecuencia de diseño:** el viaje 1 se parte en dos slides (6 y 8) para que la vuelta tenga su
propio momento en pantalla y el público lo vea llegar. El viaje 2 va en un solo slide (12) con la
secuencia numerada y un aviso explícito de la pausa, con qué decir mientras tanto.

**No presentes la pausa como una limitación.** Es una diferencia de infraestructura conocida,
documentada y ya mitigada en el cliente. Si alguien pregunta, la respuesta honesta es corta:
publicar esa tabla en Realtime devolvería el evento inmediato y permitiría retirar el sondeo; está
identificado y no bloquea la operación.

---

### Slide 1 — Portada

- **Layout:** a sangre completa, contenido alineado a la izquierda al tercio inferior.
- **Marca:** `RENOVA` en serif grande (~140 px), `INSPECTOR` debajo en JetBrains Mono con
  `letter-spacing` amplio y color `--ember-orange`.
- **Tagline:** «El control de neumáticos de tu flota, del papel al dato.»
- **Pie discreto** en `--label-cool`, 15 px: `Facundo Foronda · 27 de julio de 2026`.
- **Fondo:** una única línea de acento naranja horizontal que se dibuja de 0 a 100 % de ancho al
  entrar. Nada más. La portada no lleva gráfico.
- **Notas:** «Antes de empezar: recarga dura Ctrl+Shift+R en cada pestaña de Chrome. El navegador
  cachea los módulos JS aparte del HTML y puede mostrar datos viejos.»

---

### Slide 2 — El problema

- **Kicker:** `NEGOCIO — EL PUNTO DE PARTIDA` (`--value-ice`)
- **Titular:** «Hoy el neumático no tiene historia.»
- **Panel visual (derecha):** G2, tres barras comparando el recorrido de un dato:

  | Concepto | Estado |
  |---|---|
  | Se mide en el patio | ✔ |
  | Se anota en una planilla | ✔ |
  | Alguien lo puede consultar seis meses después | ✘ |

  La tercera barra se queda en un tramo mínimo y en `--ember-orange`. El contraste visual es el
  argumento.

- **Bloque separado por línea divisoria**, etiqueta `[COMPLETAR]` en `--signal-yellow`:
  marcador visible para el dato que Facundo debe conseguir — cuántas horas por semana consume hoy
  el control manual y quién lo hace. Ver `DATOS-VERIFICADOS.md` §5.
- **Nota al pie:** «El proceso actual se apoya en Excel. Fuente: `PRODUCT.md`.»
- **Notas:** «Si conseguiste el dato de horas, este es el momento de decirlo. Si no lo tienes, no
  lo estimes en voz alta: pasa al siguiente slide. Sobre competencia, di solo lo que puedas
  sostener con evidencia.»

---

### Slide 3 — La solución

- **Kicker:** `PRODUCTO — QUÉ HACE` (`--ember-orange`)
- **Titular:** «Cuatro verbos.»
- **Panel visual (izquierda):** cuatro bloques que aparecen escalonados, cada uno con su verbo en
  serif grande y una línea de apoyo en mono:

  | Verbo | Apoyo |
  |---|---|
  | **INSPECCIONA** | En el patio, sin señal, con guantes |
  | **ENTIENDE** | Rendimiento, costo por kilómetro, vida remanente |
  | **ORDENA** | El supervisor emite; el operario ejecuta |
  | **RECUERDA** | El casco conserva su historia, reencauche tras reencauche |

- **Nota al pie:** «Dos aplicaciones Android y siete pantallas web.»

---

### Slide 4 — El dato central

- **Kicker:** `PRODUCTO — EL MODELO` (`--ember-orange`)
- **Titular:** «Todo se deriva de una sola frase.»
- **Cita destacada**, serif, ~44 px, con las palabras clave en `--signal-yellow`:

  > Un **inspector** midió una **posición** de una **unidad**, para una **empresa**, en una
  > **fecha**, con un **odómetro**.

- **Panel visual (derecha):** G8, el esquema 2-4-2 del bus. Al entrar, las ocho posiciones se
  encienden una a una con el color de su estado.
- **Nota al pie:** «Los derivados viven en vistas SQL; los hechos capturados viven en tablas.»
- **Notas:** «Este es el slide para el desarrollador. Si pregunta por qué no se guardan los
  cálculos: porque un umbral cambia y el hecho no.»

---

### Slide 5 — Lo que ya está corriendo

- **Kicker:** `DATO — HOY EN PRODUCCIÓN` (`--signal-yellow`)
- **Titular:** «Esto no es un prototipo.»
- **Panel visual (izquierda):** G1, cuatro contadores animados de 0 al valor:

  | Valor | Etiqueta |
  |---:|---|
  | **4** | empresas |
  | **269** | unidades |
  | **288** | inspecciones |
  | **2 247** | mediciones de neumático |

- **Bloque secundario tras línea divisoria**, etiqueta `INGENIERÍA` en `--verified-green`, tres
  cifras en tamaño menor: `50` migraciones versionadas · `385` pruebas automatizadas verdes ·
  `11` decisiones de arquitectura documentadas.
- **Nota al pie:** «Datos de producción al 26 de julio de 2026. Enero a julio.»
- **Notas:** «El segundo bloque es para el desarrollador: no es código que funciona hoy y se rompe
  mañana, tiene esquema versionado y suite de pruebas.»

---

### Slide 6 — ▶ EN VIVO: la captura (ida del viaje 1)

- **Tipo:** slide-señal, a sangre completa, fondo `--ember-orange`, texto `--navy-brand`.
- **Encabezado:** `▶ AHORA EN VIVO · IDA`
- **Destino:** `APP DE INSPECCIÓN` · dispositivo Android en mano
- **Aviso de montaje**, en recuadro destacado sobre el resto:
  `Deja el tablero proyectado en la unidad que vas a inspeccionar. No lo cierres.`
- **Bloque «Mostrar»:** selección de empresa y unidad · mapa de posiciones · captura de RTD por
  canal · anomalía desde el catálogo · guardar.
- **Bloque «Decir mientras capturas»:** «Esto funciona igual sin señal. El dato se guarda en el
  equipo y sale solo cuando hay red.»
- **Bloque «⚠ No afirmar»:** que el IDI esté disponible en el servidor. Se calcula en el
  dispositivo y no cruza la sincronización.
- **Pie:** `[ESPACIO] para cerrar el viaje`

---

### Slide 7 — Cómo sobrevive sin señal

- **Kicker:** `OPERACIÓN — OFFLINE FIRST` (`--verified-green`)
- **Titular:** «El patio no tiene wifi. El dato no se pierde.»
- **Panel visual (derecha):** G6, diagrama de cuatro nodos que se encienden en secuencia:

  `Captura` → `SQLite en el equipo` → `Cola durable` → `Supabase`

  Bajo el tercer nodo, una etiqueta en `--signal-yellow`: «reintenta con espera creciente».
  Entre `Cola` y `Supabase`, un ícono de corte de red que aparece y desaparece sin que el flujo se
  detenga.

- **Bloque tras línea divisoria**, etiqueta `LA REGLA` en `--ember-orange`: «Un fallo de red nunca
  impide guardar. El identificador de la inspección nace en el dispositivo, así que reintentar
  nunca duplica.»
- **Nota al pie:** «Base local versionada, cola con reintentos e inserción idempotente.»
- **Notas:** «Slide para el desarrollador. El identificador generado en el dispositivo es lo que
  hace que el reintento sea seguro: si el servidor ya lo tiene, lo reconoce.»

---

### Slide 8 — ▶ EN VIVO: la misma inspección, ya en el tablero (vuelta del viaje 1)

**Este es el momento más persuasivo de toda la presentación.** No lo trates como un slide más.

- **Tipo:** slide-señal.
- **Encabezado:** `▶ AHORA EN VIVO · VUELTA`
- **Destino:** `INSPECCIONES POR UNIDAD` · **MÓVIL BUS**
- **Bloque «El momento»**, destacado sobre el resto: `La inspección que acabas de capturar ya está
  en la pantalla. Nadie sincronizó nada a mano. Nadie envió un correo.`
- **Bloque «Mostrar»:** la unidad recién inspeccionada · mapa de posiciones actualizado · semáforo
  RTD · ficha del neumático con el rango de presión real · buscador global · filtros facetados.
- **Bloque «⚠ No afirmar»:** que el estado histórico conserve el umbral de su fecha — se recalcula
  con el vigente. **No tocar los umbrales RTD durante la demo.**
- **Aviso de superficie**, en recuadro: `Desktop-only (1280 px). Se muestra desde la laptop, no
  desde el teléfono.`
- **Notas:** «Este viaje sí es instantáneo: las tablas de inspección están publicadas en Realtime,
  así que el tablero se actualiza solo. Deja que lo vean llegar antes de hablar.»

---

### Slide 9 — Las reglas no se inventan

- **Kicker:** `DATO — REGLAS DE NEGOCIO` (`--signal-yellow`)
- **Titular:** «Cada umbral tiene un dueño y una fecha.»
- **Panel visual (izquierda):** G3, anillo con la distribución real de presión:

  | Estado | Conteo | Color |
  |---|---:|---|
  | Normal | 1 961 | `--verified-green` |
  | Sin medir | 232 | `--label-cool` |
  | Alta | 35 | `--signal-yellow` |
  | Baja | 19 | `--ember-orange` |

  Leyenda obligatoria con conteo y porcentaje en `tabular-nums`. El color no es el único canal.

- **Bloque tras línea divisoria**, etiqueta `DÓNDE VIVE` en `--ember-orange`: «Los rangos de presión
  viven en una tabla por empresa, medida y tipo de eje. No están escritos dentro de ninguna
  pantalla.»
- **Nota al pie:** «Rangos vigentes desde el 25 de julio de 2026. Decisión ADR-0009.»
- **Notas:** «Si el desarrollador pregunta por presión en caliente: no está implementada y está
  declarado como deuda. Las empresas que miden en caliente son agencias de las que todavía no
  tenemos datos. El campo ya existe con valor por defecto FRÍO, así que cuando lleguen esos datos
  no hay que adivinar el pasado.»

---

### Slide 10 — ▶ EN VIVO: rendimiento

- **Tipo:** slide-señal.
- **Destino:** `RENDIMIENTO` · **MÓVIL BUS**
- **Bloque «Mostrar»:** kilómetros por milímetro · vida útil remanente · costo por kilómetro ·
  comparación entre marcas y diseños · el aviso de unidades de prueba excluidas.
- **Bloque «⚠ Ojo»:** «Los KPI se leen de la pantalla, no del deck. Confirma los valores en la
  recarga dura previa.»
- **Notas:** «El aviso de "excluidos por ser de unidades de prueba" es un argumento, no una
  disculpa: la plataforma declara lo que deja afuera en vez de maquillar el promedio. Mostrarlo a
  propósito.»

---

### Slide 11 — Qué mide y qué se niega a afirmar

- **Kicker:** `DATO — HONESTIDAD ESTADÍSTICA` (`--signal-yellow`)
- **Titular:** «Un promedio mentiroso es peor que ningún número.»
- **Panel visual (derecha):** dos columnas contrapuestas, sin cifras absolutas:

  | Lo que hace | Lo que evita |
  |---|---|
  | Suma kilómetros y suma milímetros, después divide | Promediar razones por neumático |
  | Usa la mediana para magnitudes | Dejar que un neumático con denominador chico domine |
  | Excluye unidades de prueba **y lo declara** | Esconder filas para que el número quede lindo |
  | Devuelve «dato insuficiente» | Dibujar una tendencia con un solo punto |

  Entrada escalonada, fila por fila. Columna izquierda en `--verified-green`, derecha en
  `--label-cool` con tachado sutil.

- **Nota al pie:** «Corregido el 25 de julio de 2026, con pruebas que lo demuestran.»
- **Notas:** «Este slide es el que convence al técnico. Cuando corregimos la estadística, el KPI
  principal se movió un orden de magnitud. Eso no es un error del producto: es el producto haciendo
  su trabajo.»

---

### Slide 12 — ▶ EN VIVO: la orden completa el viaje 2

- **Tipo:** slide-señal.
- **Encabezado:** `▶ AHORA EN VIVO · IDA Y VUELTA`
- **Destino:** `MOVIMIENTOS` (laptop) + `APP DEL OPERARIO` (celular) · **MÓVIL BUS**
- **Bloque «La secuencia»**, numerado y en tamaño grande, porque es lo que Facundo sigue en vivo:

  1. Emites la orden desde la web, proyectada.
  2. La orden aparece en el celular del operario.
  3. Tomas la orden y capturas salida e ingreso.
  4. El servicio aparece en la pantalla, pareado y con su origen.

- **Bloque «⚠ La pausa del paso 4»**, destacado en recuadro:
  `Tarda hasta 10 segundos. No es una falla: esa tabla no está publicada en Realtime y la pantalla
  la consulta sola cada 10 segundos. Habla durante la espera — no te quedes mirando.`
- **Bloque «⚠ Obligatorio»:** «Solo MÓVIL BUS. Es la única empresa con cuenta de operario. En
  cualquier otra, la orden se emite y nadie puede tomarla: el recorrido se corta a la mitad, en
  vivo, sin mensaje que lo explique.»
- **Notas:** «Corte más frágil de la demo. App del operario abierta y con sesión iniciada antes de
  empezar, y la pestaña de Servicios visible —si está en segundo plano, el sondeo no corre. Qué
  decir durante la pausa: que el operario no elige la empresa, se deriva de su perfil, y que no
  puede tocar la flota de otro cliente.»

---

### Slide 13 — De la medición a la acción

- **Kicker:** `OPERACIÓN — EL CIRCUITO` (`--verified-green`)
- **Titular:** «Nadie escribe un correo.»
- **Panel visual (izquierda):** G6, cinco nodos que se encienden en secuencia:

  `Inspección` → `Alerta` → `Orden` → `Ejecución` → `Historial del casco`

  Cada nodo lleva debajo, en mono pequeño, quién actúa: `Inspector` · `Sistema` · `Supervisor` ·
  `Operario` · `Sistema`.

- **Bloque tras línea divisoria**, etiqueta `LA DIFERENCIA` en `--ember-orange`: «El operario no
  elige la empresa: se deriva de su perfil. Un operario no puede tocar la flota de otro cliente.»
- **Nota al pie:** «Roles diferenciados con aislamiento por empresa a nivel de base de datos.»

---

### Slide 14 — Estado real

- **Kicker:** `ESTADO — DÓNDE ESTAMOS` (`--label-cool`)
- **Titular:** «Lo que opera y lo que está en curso.»
- **Panel visual (derecha):** G2, dos grupos de barras.

  **Opera hoy** (barras `--verified-green`, al 100 %):
  captura offline · sincronización · dashboards autenticados · aislamiento entre empresas ·
  reglas de presión y RTD · órdenes de movimiento · historial de casco.

  **En curso** (barras `--signal-yellow`, parciales, con su motivo en mono al costado):

  | Tema | Motivo |
  |---|---|
  | Presión en caliente | Faltan datos de campo, no una decisión |
  | Identidad del inspector | La app opera sin login; requiere decisión de producto |
  | Línea base de la flota | Una persona confirma cada primer montaje; no se infiere |
  | Reconciliación de movimientos | Mide actividad declarada, todavía no consumo |

- **Nota al pie:** «Deuda declarada y documentada en el repositorio, con decisión asociada.»
- **Notas:** «Este slide es deliberado. Si el desarrollador encuentra estos límites por su cuenta,
  el resto del deck queda bajo sospecha. Declararlos primero convierte la deuda en método.»

---

### Slide 15 — Fase 2: el círculo se cierra en RENOVA ★

**El slide más importante del deck.** Dale el doble de espacio en blanco que a cualquier otro.

- **Kicker:** `FASE 2 — LA JUGADA` (`--signal-yellow`)
- **Titular:** «El casco vuelve solo a casa.»
- **Panel visual (derecha):** G7, ciclo circular con cinco estaciones. Una flecha recorre el
  círculo al entrar, encendiendo cada estación:

  1. `Inspección detecta RTD al límite` — `--ember-orange`
  2. `La plataforma emite el retiro` — `--ember-orange`
  3. `El operario desmonta y registra el casco` — `--verified-green`
  4. **`El casco entra a la planta de RENOVA`** — `--signal-yellow`, estación destacada, radio mayor
  5. `Vuelve como ciclo nuevo, con su diseño de reencauche` — `--verified-green`

  La flecha cierra el círculo volviendo a 1.

- **Bloque tras línea divisoria**, etiqueta `POR QUÉ NOS TOCA A NOSOTROS` en `--ember-orange`:
  «RENOVA no integra con una reencauchadora. RENOVA **es** la reencauchadora. La plataforma que le
  damos al cliente es el canal por el que su casco llega a nuestra planta.»
- **Nota al pie:** «Hoy el sistema cierra el ciclo saliente. Falta abrir el ciclo siguiente: es la
  pieza que convierte la trazabilidad en canal comercial.»
- **Notas:** «Detente acá. Es el argumento que ninguna plataforma genérica de flotas puede copiar,
  porque ninguna tiene planta. Deja que la idea aterrice antes de pasar.»

---

### Slide 16 — Fase 2: el resto

- **Kicker:** `FASE 2 — HOJA DE RUTA` (`--signal-yellow`)
- **Titular:** «Lo que sigue, por impacto.»
- **Panel visual (izquierda):** G5, burbujas proporcionales. Eje horizontal: esfuerzo. Eje
  vertical: impacto. Radio ∝ √(valor para el cliente).

  | Iniciativa | Impacto | Esfuerzo |
  |---|---|---|
  | **Reencauche desde la plataforma** | Muy alto | Medio |
  | **Predicción de anomalías por kilometraje** | Alto | Alto |
  | Consola de administración (empresas, umbrales, catálogos) | Alto | Medio |
  | Reporte descargable por empresa | Medio | Bajo |
  | Importación por lotes con errores por fila | Medio | Bajo |
  | Más configuraciones de vehículo | Medio | Medio |
  | Vistas guardadas por rol | Bajo | Bajo |

  La burbuja de reencauche va en `--signal-yellow` y con borde grueso; el resto en la rampa fría.

- **Bloque tras línea divisoria**, etiqueta `SOBRE LA PREDICCIÓN` en `--label-cool`, texto breve:
  «Correlacionar kilometraje con la aparición de anomalías exige vincular cada medición a su ciclo
  de vida. Hoy la mayoría no lo tiene. Es el trabajo previo, y está identificado.»
- **Nota al pie:** «Prioridades derivadas del roadmap del proyecto.»
- **Notas:** «Si preguntan por la predicción: sí, es el diferenciador, y no, no lo vamos a
  improvisar. Decir qué falta para llegar ahí es más creíble que prometer que ya está.»

---

### Slide 17 — Modelo y piloto

- **Kicker:** `NEGOCIO — CÓMO SE COBRA` (`--value-ice`)
- **Titular:** «Suscripción por empresa.»
- **Bloque superior:** el argumento técnico que sostiene el modelo, en una línea: «Cada empresa ya
  está aislada a nivel de base de datos. Sumar un cliente no toca los datos de ningún otro.» Bajo
  esa línea, marcador `[COMPLETAR: precio y unidad de cobro]`.
- **Panel visual (derecha):** G4, columnas verticales de cronograma con cuatro etapas. Las etiquetas
  de tiempo van como marcador `[COMPLETAR: fechas]`:

  `Piloto` → `Ajuste con el cliente` → `Alta de flota completa` → `Segunda empresa`

- **Bloque tras línea divisoria**, etiqueta `CANDIDATAS` en `--signal-yellow`: marcador
  `[COMPLETAR: empresas objetivo]`, con una nota fija: «Tres flotas ya tienen datos cargados en la
  plataforma.»
- **Nota al pie:** «CIVA, MÓVIL BUS e ITTSABUS ya tienen inspecciones en el sistema.»
- **Notas:** «No inventes precio en la sala. Si no está definido, di que la propuesta económica va
  aparte y sigue.»

---

### Slide 18 — Cierre

- **Layout:** a sangre completa, como la portada, para cerrar el arco.
- **Kicker:** `CIERRE`
- **Titular:** «Se llama RENOVA INSPECTOR.»
- **Segunda línea**, tras una pausa animada de 600 ms, en serif del mismo tamaño y
  `--signal-yellow`: «Pero hace rato dejó de ser solo inspecciones.»
- **Bajo la línea**, seis palabras en mono, apareciendo escalonadas cada 120 ms:
  `INSPECCIÓN · RENDIMIENTO · SERVICIOS · MOVIMIENTOS · INVENTARIO · HISTORIAL`
- **Cierre**, en `--label-cool`: «El próximo paso es ponerle el nombre que le corresponde.»
- **Pie:** `Facundo Foronda`
- **Notas:** «Remate. La línea del nombre es el cierre; no la expliques después de decirla.»

---

## 8. Checklist de verificación antes de entregar

Codex debe verificar cada punto y reportar el resultado. No declares terminado sin esto.

**Autonomía**
- [ ] El archivo abre con `file://` y sin red. Sin una sola petición externa en la pestaña de red.
- [ ] Ninguna referencia a `http://`, `https://`, Google Fonts, CDN ni imagen remota.
- [ ] La fuente JetBrains Mono está embebida en base64 y se aplica de hecho (verificar en el
      inspector, no asumir).

**Navegación**
- [ ] Las cuatro formas de avanzar funcionan: flechas, espacio, botones, puntos de progreso.
- [ ] `Home` y `End` saltan a los extremos.
- [ ] `F` entra y sale de pantalla completa.
- [ ] `D` alterna las notas y `Esc` las cierra.
- [ ] Los cuatro slides-señal tienen punto de progreso visualmente distinto.

**Animación**
- [ ] Ir al slide 5, avanzar, volver: **los contadores se animan de nuevo desde cero.**
- [ ] Lo mismo en 9, 13, 15, 16 y 17.
- [ ] Con `prefers-reduced-motion` activo, todo aparece en estado final sin movimiento.

**Escalado**
- [ ] A 1920×1080 el contenido llena la pantalla sin recortes.
- [ ] A 1366×768 se escala completo y sigue legible.
- [ ] Con zoom del navegador al 125 % y al 80 %, el layout no se rompe.
- [ ] En un viewport 4:3 el escenario entra completo, con bandas al costado.
- [ ] **Ningún slide tiene barra de desplazamiento.**

**Contenido**
- [ ] Todas las cifras coinciden con `DATOS-VERIFICADOS.md`.
- [ ] Ningún KPI de Rendimiento está impreso en un slide.
- [ ] Los cinco marcadores `[COMPLETAR: …]` son visibles e imposibles de pasar por alto.
- [ ] Cero voseo en todo el archivo. Barrer `elegí`, `podés`, `mirá`, `revisá`, `ingresá`, `volvé`.
- [ ] Los avisos de «no afirmar» están en las notas de los slides 6, 8, 9, 10 y 12.

**Los dos viajes (§7.0)**
- [ ] El slide 6 dice `IDA` y el 8 dice `VUELTA`; se leen como un par, no como dos temas.
- [ ] El slide 6 lleva el aviso de dejar el tablero proyectado y abierto.
- [ ] El slide 8 lleva el bloque «El momento» destacado por encima de la lista de qué mostrar.
- [ ] El slide 12 lleva la secuencia **numerada** del 1 al 4, legible desde el fondo de la sala.
- [ ] El slide 12 lleva el aviso de la pausa de 10 segundos y qué decir durante ella.
- [ ] Ningún slide describe el viaje del movimiento como instantáneo.

**Impresión**
- [ ] `Ctrl+P` produce un PDF horizontal, un slide por página, con los gráficos completos.

---

## 9. Qué NO hacer

- No inventar cifras de Van Llantas ni de ningún competidor real.
- No estimar ahorros, precios ni fechas de piloto. Son los cinco marcadores `[COMPLETAR]`.
- No imprimir KPI de Rendimiento en el deck.
- No agregar librerías. Ni Chart.js, ni Reveal.js, ni Anime.js. Todo a mano con CSS, SVG y
  `requestAnimationFrame`. El requisito de archivo único y sin red lo hace innecesario.
- No usar rojo. La máxima severidad del sistema visual es el naranja.
- No poner dos elementos naranjas persistentes compitiendo en el mismo slide. Un solo foco.
- No agregar sombras, gradientes decorativos ni iconografía genérica de SaaS. El lenguaje es
  industrial: bordes gruesos, superficies planas.
- No tocar nada fuera de `presentacion html/`. Este trabajo no modifica el producto.

---

## 10. Orden de ejecución sugerido

1. Esqueleto: escenario escalado, sistema de slides, navegación, puntos de progreso, notas.
2. Sistema visual: tokens, tipografía embebida, layout dividido con alternancia de lado.
3. Los cuatro slides-señal (6, 8, 10, 12). Son estructuralmente idénticos: una plantilla.
4. Slides de texto sin gráfico (1, 3, 4, 18).
5. Motor de animación con `activate()` y reseteo.
6. Gráficos, del más simple al más complejo: G1 → G2 → G4 → G3 → G6 → G5 → G8 → G7.
7. Notas del presentador con los avisos de «no afirmar».
8. Modo impresión y `prefers-reduced-motion`.
9. Checklist completo de la sección 8.

Construir en ese orden mantiene el deck navegable de punta a punta desde el paso 4. Si el tiempo se
acorta, se corta por gráficos —el deck sigue siendo presentable— y nunca por navegación o escalado.

---

## 11. Desviaciones respecto del plan original

Cinco cambios hechos durante la construcción, con su razón.

**1. El indicador de progreso es un calibrador de profundidad, no puntos.**
El plan pedía puntos con el activo en naranja y los slides en vivo distinguidos. Se cumple lo
funcional, pero la forma es un calibrador con marcas de milímetro: el instrumento con el que se mide
el RTD. Deja de ser cromo genérico y pasa a ser el objeto sobre el que está construido el producto.
Los cuatro cortes en vivo son anillos naranja huecos, visibles de un vistazo.

**2. La tipografía se embebe, no depende de la máquina.**
JetBrains Mono subseteada a latín, dígitos, puntuación y flechas: 9,5 KB por peso, 25 KB en base64
para los dos. El deck ya no depende de que la fuente esté instalada. Los titulares siguen en serif
del sistema (Cambria/Georgia). Archivo final: 76 KB.

**3. Las etiquetas de las burbujas van fuera de los círculos.**
Primera versión: texto dentro de cada burbuja. Se probó en pantalla y el texto desbordaba en cinco
de siete. Ilegible desde el fondo de una sala. Ahora cada etiqueta va al costado de su burbuja, con
el lado elegido para que no se salga del gráfico ni choque con la vecina.

**4. El deck se repinta al volver de Chrome.**
No estaba en el plan y es específico de cómo se va a usar. Los navegadores congelan animaciones en
pestañas ocultas: si haces alt-tab a Chrome durante un corte en vivo y vuelves, el slide puede
quedar a medio dibujar. Un escucha de `visibilitychange` reinicia la animación del slide actual al
recuperar el foco.

**5. El slide 2 tiene un marcador para la competencia.**
El plan la dejaba solo en las notas del presentador. Riesgo de que no se diga. Ahora hay un
recuadro `[COMPLETAR]` en pantalla, que obliga a decidir qué se afirma y no permite improvisarlo.

### Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Peticiones externas, `<script src>`, `@import` | 0 |
| `alert` / `confirm` / `prompt` | 0 |
| Barrido de voseo | limpio |
| Slides | 18, con 4 cortes en vivo |
| Notas del presentador | 18 de 18 |
| Marcadores `[COMPLETAR]` | 5 |
| Desborde vertical u horizontal | ninguno en los 18 |
| Escalado del escenario | correcto a dpr 1.25 (equipo con escalado al 125 %) |
| Contadores | llegan a 4 · 269 · 288 · 2,247 |
| Anillo de presión | los 4 segmentos suman la circunferencia completa |
| Flujo, ciclo, burbujas, columnas, módulos | todos alcanzan su estado final |

**Sin verificar:** exportación a PDF con `Ctrl+P` y el camino de `prefers-reduced-motion`. Ambos
tienen su `@media` escrita, pero no se ejecutaron en pantalla.
