---
name: RENOVA INSPECTOR
description: App de campo para inspección de neumáticos de flotas de buses — consola oscura, monoespaciada, sin adornos.
colors:
  navy-brand: "#15233f"
  ember-orange: "#F06822"
  signal-yellow: "#f4b821"
  verified-green: "#1f9d6b"
  screen-dark: "#07111C"
  field-dark: "#111E2E"
  border-dark: "#1B2D42"
  label-blue: "#7AABCC"
  value-ice: "#F0F8FF"
typography:
  display:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.06em"
  display-sub:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.1em"
  label:
    fontFamily: "JetBrains Mono, IBM Plex Mono, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.1em"
  body:
    fontFamily: "JetBrains Mono, IBM Plex Mono, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
  hero-value:
    fontFamily: "JetBrains Mono, IBM Plex Mono, SFMono-Regular, Menlo, monospace"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "14px"
  3xl: "16px"
  4xl: "18px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ember-orange}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    padding: "17px"
  button-primary-disabled:
    backgroundColor: "{colors.field-dark}"
    textColor: "{colors.border-dark}"
    rounded: "{rounded.2xl}"
    padding: "17px"
  button-cta-complete:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.navy-brand}"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    padding: "14px"
  input-field:
    backgroundColor: "{colors.field-dark}"
    textColor: "{colors.value-ice}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  card-highlight:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.navy-brand}"
    rounded: "{rounded.4xl}"
    padding: "20px 22px"
  card-info:
    backgroundColor: "{colors.navy-brand}"
    textColor: "#ffffff"
    rounded: "{rounded.3xl}"
    padding: "20px 22px"
  list-item-selectable:
    backgroundColor: "{colors.field-dark}"
    textColor: "{colors.value-ice}"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    padding: "14px 18px"
---

Design System: RENOVA INSPECTOR

## 1. Overview

**Creative North Star: "El Cuaderno de Bitácora del Taller"**

RENOVA INSPECTOR se diseña como el cuaderno de bitácora digital de un taller de neumáticos:
una herramienta de campo, no una app de consumo. La pantalla de inspección activa es
deliberadamente oscura — una consola que se lee bajo sol directo, con manos sucias o con
guantes, sin depender de conexión. Todo el sistema es monoespaciado (JetBrains Mono) porque
los datos —remanentes, presión, odómetro— son el contenido, no una decoración alrededor de
ellos; la única excepción es el logotipo (Bebas Neue), que existe para dar identidad de
marca sin competir con la lectura de datos.

El sistema rechaza explícitamente el look de apps de flotas/logística existentes en Perú
(interfaces anticuadas tipo "Excel metido en una app", paneles ERP legacy sin jerarquía) y
el cliché de dashboard B2B genérico (tarjetas con gradiente, iconografía de startup
intercambiable). En su lugar, es robusto e industrial: bordes gruesos en vez de sombras,
pesos de fuente muy altos, cero gradientes, cero iconografía decorativa.

**Key Characteristics:**
- Consola oscura dedicada a la captura de datos en campo (`screen-dark` + `field-dark`)
- Tipografía monoespaciada en todo excepto el logotipo
- Bordes de 2px como único lenguaje de estado (reposo / foco / alerta), no sombras
- Naranja = acción/foco/alerta; amarillo = hito/logro/valor destacado; verde = solo "completo"
- Cero decoración: cada elemento visible cumple una función de captura o lectura de dato

## 2. Colors

Paleta fría-oscura de instrumento con un único acento cálido (naranja) para acción y foco.

### Primary
- **Ember Orange** (`#F06822`): color de acción — bordes de foco, botón primario habilitado,
  selección activa, badges de alerta (`⚠ ACTIVA`, `⚠ REVISAR`). Es el único color que
  "pide" que el inspector interactúe.

### Secondary
- **Signal Yellow** (`#f4b821`): hito o valor que vale la pena mirar sin ser una alerta —
  la tarjeta de fecha del día, el valor de odómetro previo, el botón "BUSCAR OTRA UNIDAD"
  al completar todas las posiciones, el punto de estado "parcial" en el grid de posiciones.
- **Navy Brand** (`#15233f`): color de marca y de header — fondo de la barra superior en
  las tres pantallas, fondo de la tarjeta "última inspección", avatar inicial de empresa.

### Tertiary
- **Verified Green** (`#1f9d6b`): reservado exclusivamente para el punto de estado
  "completa" en el grid de posiciones. No se usa en ningún otro lugar — mantenerlo así
  preserva su significado.

### Neutral
- **Screen Dark** (`#07111C`): fondo base de toda pantalla de campo (empresa, unidad,
  inspección).
- **Field Dark** (`#111E2E`): superficie de inputs, botones secundarios y cards flotantes
  sobre `screen-dark` — la capa "un paso más clara que el fondo".
- **Border Dark** (`#1B2D42`): borde en reposo, placeholder, texto/ícono deshabilitado.
- **Label Blue** (`#7AABCC`): todo label, unidad de medida (mm/psi/km) y texto secundario.
- **Value Ice** (`#F0F8FF`): color de todo dato ingresado por el usuario — el contraste más
  alto del sistema, reservado para lo que el inspector escribió.

### Named Rules
**La Regla del Naranja Único.** Solo un elemento por pantalla puede estar en estado
"foco/acción" (borde naranja) a la vez. Nunca dos bordes naranjas simultáneos fuera de
foco — si algo necesita destacar sin ser la acción activa, usa amarillo, no naranja.

**La Regla del Verde Exclusivo.** Verde significa "posición completa" y nada más. No usarlo
para focos, botones nuevos, ni branding — su escasez es lo que lo hace legible de un
vistazo en el grid de posiciones.

## 3. Typography

Un solo par: **Bebas Neue** (display, solo logotipo) + **JetBrains Mono** (todo lo demás,
incluyendo prosa, labels y valores). No hay una tercera fuente ni un cuerpo de texto en
fuente humanista — el mono es deliberado: alinea dígitos (`font-variant-numeric:
tabular-nums`) para que remanentes y presión se lean como en un tablero de instrumentos,
no como texto de formulario.

### Hierarchy
- **Display** (400, 34-42px logotipo / 19-24px subtítulo, `line-height: 1`, tracking
  0.06-0.1em): "RENOVA" / "INSPECTOR" en los headers. Uso exclusivo de marca — nunca para
  datos o contenido de pantalla.
- **Label** (800, 9-12px, tracking 0.1-0.16em, uppercase): todo nombre de campo (CÓDIGO,
  REMANENTE, PRESIÓN, MARCA...) y metadatos secundarios (fecha, unidad de medida).
- **Body** (700, 13-16px): texto de opciones, nombres de empresa/unidad, texto de botón.
- **Hero Value** (800-900, 20-32px, `tabular-nums`): el dato que el inspector acaba de
  ingresar o el número que más importa en la pantalla — código de neumático, remanente,
  presión, odómetro, número de posición actual. Siempre en `value-ice` o `ember-orange`
  cuando está activo, nunca en un color secundario.

### Named Rules
**La Regla del Mono Total.** Ninguna pantalla de captura de datos introduce una fuente
humanista/serif para "suavizar" la interfaz. La monoespaciada es la decisión de marca, no
un default técnico a corregir.

## 4. Elevation

El sistema es **plano por capas tonales, no por sombra**: la profundidad se comunica
apilando `screen-dark` → `field-dark` → `navy-brand`, cada uno un tono distinto, en vez de
proyectar sombra sobre el fondo. La sombra se reserva exclusivamente para elementos que
flotan **sobre** el contenido de la pantalla (autocomplete dropdown, sugerencias de
búsqueda, bottom sheet de posiciones) — nunca para cards o botones en el flujo normal.

### Shadow Vocabulary
- **Overlay flotante** (`box-shadow: 0 8px 24px rgba(21,35,63,0.28)` sobre fondo navy /
  `0 8px 24px rgba(0,0,0,0.4)` sobre fondo oscuro): dropdown de autocomplete y lista de
  sugerencias de unidad. Única sombra permitida en el sistema.

### Named Rules
**La Regla de la Sombra Reservada.** Si un elemento no flota por encima de otro contenido
de la pantalla (dropdown, sheet, tooltip), no lleva `box-shadow`. La jerarquía se resuelve
con color de fondo y borde de 2px, no con elevación.

## 5. Components

Bordes de 2px, radios entre 6-18px según el rol, cero relleno de color "lleno" en estado
activo salvo para la acción primaria — el estado se comunica con el borde, no con el fondo.

### Buttons
**Shape:** radio 14px (`rounded.2xl`) para toda acción primaria/CTA; 10-12px para
selectores de lista con más de una línea de contenido (config de vehículo, foto).
- **Primary (acción habilitada):** fondo `ember-orange` sólido, texto blanco 800, padding
  `17px`, sin borde. Ejemplo: "COMENZAR INSPECCIÓN", "CONTINUAR INSPECCIÓN".
- **Primary (deshabilitado):** fondo `field-dark`, texto `border-dark` — nunca opacity,
  siempre un recolor explícito para que el estado sea inequívoco bajo sol.
- **Secondary (acción de cierre positiva):** fondo `signal-yellow`, texto `navy-brand` —
  reservado para "todas las posiciones completas" ("BUSCAR OTRA UNIDAD →").
- **Ghost (navegación):** sin fondo ni borde, ícono SVG 18-20px en `rgba(255,255,255,0.9)`,
  área táctil mínima 44×44px (botón "volver", flechas de posición).
- **Dashed (acción opcional/agregar):** borde `2px dashed border-dark` (o `ember-orange`
  cuando el estado es "nuevo"), fondo `field-dark` — foto de unidad, alta de unidad nueva.

### Inputs / Autocomplete
**Shape:** radio 6px (`rounded.sm`) en campos compactos, 12-14px en campos de búsqueda de
altura completa (buscador de unidad).
- **Reposo:** borde `2px solid border-dark`, fondo `field-dark`, texto `value-ice` si tiene
  valor o `border-dark` si es placeholder.
- **Foco/abierto:** borde cambia a `2px solid ember-orange`. Transición `border-color 0.15s`
  — nunca instantánea, nunca más lenta.
- **Dropdown de opciones:** fondo `navy-brand`, ítems en blanco, separador
  `rgba(255,255,255,0.1)`, ítem activo `rgba(255,255,255,0.15)` overlay, acción "＋ Agregar"
  en `ember-orange` al final de la lista.

### Cards / Containers
**Corner Style:** 16-18px para cards de contenido destacado (fecha del día, última
inspección); 8px para celdas de medición (remanente, presión) — más chatas porque son
repetitivas y numerosas en pantalla.
- **Background:** `signal-yellow` para la card de mayor jerarquía visual del día (fecha);
  `navy-brand` para cards informativas secundarias (última inspección); `field-dark` para
  celdas de medición y listas.
- **Shadow Strategy:** ninguna — ver Elevación. La jerarquía entre cards viene del color de
  fondo, no de sombra.
- **Border:** ninguno en cards de contenido; `2px solid border-dark`/`ember-orange` solo en
  celdas de medición y listas seleccionables.

### Status Indicators
- **Punto de estado** (10px círculo): `verified-green` = completa, `signal-yellow` =
  parcial, `border-dark` = vacía. Usado en el grid de posiciones del bottom sheet.
- **Badge de alerta** (`rgba(240,104,34,0.15)` fondo, texto `ember-orange`, radio 4px,
  9-10px uppercase): "⚠ ACTIVA" / "⚠ REVISAR" junto a un campo con anomalía o válvula no
  estándar.

## 6. Do's Don'ts

### Do:
- **Do** usar borde de 2px (`border-dark` reposo → `ember-orange` foco) como único lenguaje
  de estado en inputs y selectores; nunca sombra para indicar foco.
- **Do** usar tipografía monoespaciada (JetBrains Mono) en absolutamente todo excepto el
  logotipo — incluida la prosa de ayuda y los placeholders.
- **Do** aplicar `font-variant-numeric: tabular-nums` a todo valor numérico (remanente,
  presión, odómetro, posición) para que los dígitos no salten de ancho al cambiar.
- **Do** reservar `verified-green` exclusivamente para "posición completa"; no reutilizarlo
  en botones, branding ni otros estados de éxito.
- **Do** mantener transiciones cortas y sin rebote (`0.15-0.28s`, `ease-out` o
  `cubic-bezier(0.22,1,0.36,1)`) — el sistema no tiene motion con overshoot ni elástico en
  ningún punto.

### Don't:
- **Don't** introducir el look de "Excel metido en una app" o paneles ERP legacy densos sin
  jerarquía — anti-referencia explícita del proyecto.
- **Don't** usar tarjetas con gradiente, iconografía de startup genérica ni el patrón de
  "panel de admin" de SaaS B2B — anti-referencia explícita del proyecto.
- **Don't** agregar sombra (`box-shadow`) a cards, botones o inputs en el flujo normal de
  pantalla — la sombra es exclusiva de elementos flotantes (dropdown, bottom sheet).
- **Don't** introducir una fuente serif o humanista "para suavizar" — rompe la Regla del
  Mono Total y la sensación de instrumento técnico.
- **Don't** usar opacity para representar estado deshabilitado; siempre recolorear
  explícitamente a `field-dark`/`border-dark` para que el contraste bajo sol se mantenga
  predecible.
