---
title: "Diseño y UX"
updated: 2026-07-21
status: vigente
sources: [DESIGN.md, PRODUCT.md, design-principle.md, app/src/index.css, app/src/theme.ts, UI, WEB/buscador, WEB/servicios/servicios.css, WEB/shared/filter-bar.js, WEB/shared/filter-bar.css, WEB/movimientos/a11y.js, decisions/0005-buscador-global-objetos-navegables.md, decisions/0006-filtros-facetados-inspecciones-rendimiento.md, decisions/0007-definicion-de-servicio-ejecutado.md]
---

# Diseño y UX

## Norte creativo

**El cuaderno de bitácora del taller:** herramienta industrial de campo, no dashboard SaaS genérico. Debe funcionar bajo sol, con manos ocupadas y conectividad irregular.

## Lenguaje visual

- Fondo `#07111C`; superficies `#111E2E`; borde `#1B2D42`.
- Naranja `#F06822`: una sola acción/foco dominante por pantalla.
- Amarillo `#f4b821`: hito o valor destacado, no alarma.
- Verde `#1f9d6b`: exclusivamente posición completa.
- JetBrains Mono para datos/prosa; Bebas Neue solo para marca.
- Bordes gruesos, sin sombras/gradientes ni iconografía decorativa.
- Valores escritos por el usuario en alto contraste; etiquetas en azul frío.

## Flujo móvil

- Empresa -> unidad -> inspección.
- El formulario se organiza por posición; identidad precargada y editable.
- Mapa de posiciones comunica pendiente/parcial/completa.
- Autoavance y teclado deben reducir toques, nunca ocultar errores.
- Los objetivos táctiles deben tolerar trabajo de campo.

## Patrón de filtro

El filtro facetado es un autocomplete agrupado que produce chips tipados, visibles y removibles.
Reutiliza el lenguaje industrial de píldoras de filtros y el contrato de teclado/ARIA del
buscador, pero no es el buscador global: reduce el conjunto actual y nunca navega ni ejecuta una
acción. Enter elige la primera coincidencia; flechas/Home/End recorren, Escape cierra y Backspace en
vacío quita el último chip. Objetivos táctiles mínimos de 44 px y `prefers-reduced-motion` se
conservan como reglas transversales.

Los estados implícitos que cambian un agregado también se hacen visibles. En Rendimiento, incluir
datos antiguos es un chip persistido en URL y el texto dice «basado en inspecciones», nunca
«consumo de los últimos 30 días».

## Input de captura vs. input de filtro

`DESIGN.md` §8 dice que el dashboard no edita: «cero inputs, cero foco naranja». La regla real es
que **el dashboard no captura datos**. Un control de lectura que solo acota lo mostrado y actualiza
la URL no la viola, y su foco naranja tampoco viola la Regla del Naranja Único porque el foco es
exclusivo por definición (§2). El naranja *persistente* del contenido sigue siendo único.

Inspecciones y Rendimiento ya montaban un `combobox` de filtro con foco naranja sin que
estuviera documentado; Servicios hereda el patrón. Se escribe para que la próxima pantalla no vuelva
a litigarlo.

## Barra segmentada con más de tres categorías

El semáforo RTD consagra tres colores semánticos (`verified-green`, `signal-yellow`,
`ember-orange`). Cuando una distribución tiene más categorías que eso —Servicios tiene 8 tipos— la
regla es **rampa monocroma descendente sobre el azul del sistema, con los semánticos solo donde hay
carga real**: desecho → naranja, reencauche → amarillo.

Reusar el semáforo para el resto mentiría (un balanceo no es «Normal»); inventar ocho tonos
arbitrarios rompería el sistema. La rampa mantiene el carácter de instrumento.

**El color nunca es el único canal.** Leyenda con conteo y porcentaje en `tabular-nums`, `title` por
segmento y `aria-label` que enumera todo: quien no distingue los tonos, o usa lector de pantalla,
obtiene el dato completo. Los swatches oscuros no se usan como color de texto.

## Reglas para cambios

1. Revisar `DESIGN.md` y el prototipo relevante en `UI/`.
2. Preservar semántica de colores; no introducir un segundo foco naranja.
3. Probar resolución móvil y escritorio si la superficie web lo requiere.
4. Recorrer el flujo real, no una captura aislada.
5. Verificar teclado, scroll, campos precargados, persistencia y retorno a otra unidad.

## Anti-patrones

- “Excel metido en una app”.
- Cards genéricas con gradiente y sombras.
- Texto pequeño o controles densos.
- Arrays de catálogo dentro de componentes.
- Semáforos recalculados con constantes locales distintas de Supabase.

## Hipótesis de campo que requieren validación

Las ideas históricas rescatables son: identidad del neumático colapsable cuando no cambió,
autoavance o gesto entre posiciones y diagrama del vehículo en lugar de una grilla abstracta.
No son requisitos aprobados; validar con inspectores y contra el flujo vigente antes de implementarlas.

## Overlay del buscador (patrón reutilizable)

`WEB/buscador/finder-controller.js` fija el patrón para cualquier overlay futuro: centrado tipo
Spotlight (`position: fixed`, tercio superior), `combobox`/`listbox` accesible, focus trap y región
viva reutilizando `WEB/movimientos/a11y.js` en vez de un tercer sistema de modal. El resultado activo
es el único elemento naranja mientras el overlay está abierto (Regla del Naranja Único aplicada a
selección, no solo a acción primaria). `Escape` cierra y devuelve el foco al disparador; `Enter`
navega. `prefers-reduced-motion` desactiva la animación de apertura. Ver ADR-0005
(`decisions/0005-buscador-global-objetos-navegables.md`) para el porqué de los límites del
buscador (dos objetos, sin parsing silencioso, sin escritura).

## Alineación 2026-07-12

Las superficies web vigentes fueron alineadas contra `DESIGN.md` y las pantallas de
Inspecciones/Rendimiento: naranja como máxima severidad (sin rojo), botones primarios naranja
con texto navy y hovers limitados a los tokens de paleta. `historial-neumatico.html` comparte
`WEB/renova-office-shell.css` con los demás tableros para tokens, fondo, header,
marca y navegación. `inventario.html` y `comparativo.html` fueron retirados el mismo día y no
son superficies vigentes.

## Alineación UX aplicada 2026-09-20

- Movimientos ya no toma una orden al abrirla: una orden `issued` se revisa primero y pasa a
  `in_progress` solo al pulsar **Iniciar orden**. Esto evita cambiar el estado operativo por una
  consulta accidental.
- La app distingue explícitamente **guardado en este equipo**, **sincronizando**, **enviado** y
  **pendiente de sincronizar**. El guardado local sigue siendo inmediato y no depende de red.
- Se elevó la legibilidad de etiquetas y estados pequeños de la app de Movimientos y se usa texto
  navy sobre el naranja de acciones para conservar contraste en el trabajo de campo.
- Servicios web muestra primero el seguimiento de órdenes actuales; se retiró el bloque explicativo
  sobrante para no ocultar la tarea principal.
- La bandeja móvil de Movimientos actualiza órdenes al volver a primer plano, recuperar conexión y
  cada 10 segundos mientras está visible; muestra la hora de la última actualización.
- La vista web de Movimientos mantiene el mismo respaldo de actualización al volver a primer plano,
  recuperar conexión y cada 10 segundos; el seguimiento muestra la hora de la última lectura.
- Completar una orden pide una confirmación resumida con unidad, servicios y kilometraje. La web
  usa «Cancelar orden» para una cancelación auditada, en vez de presentar la operación como borrado.
- El acceso del operario identifica el campo como «Correo o usuario» y muestra un ejemplo de correo
  CIVA; en móvil conserva el estado del borrador y resalta la posición con errores de validación.
- La web exige elegir explícitamente la razón de salida antes de agregar un servicio, limita el
  listado inicial de inventario a búsquedas concretas y muestra el estado del borrador local.
- La app de Movimientos identifica los datos precargados desde la última inspección y lleva el foco
  al primer campo inválido al intentar completar una orden.
- La confirmación final de Movimientos resume servicios visuales y ejecuciones técnicas, y declara
  «conciliación pendiente de confirmación» cuando la operación aún no tiene enlace físico confirmado.
- Servicios permite filtrar las órdenes actuales por activas, en cola, en ejecución, completadas o
  canceladas; cada ejecución histórica muestra su estado de conciliación sin ocultar la trazabilidad.
- Servicios permite cancelar directamente una orden propia que siga en cola, con confirmación y
  mensaje de resultado; no obliga a volver a abrir la unidad específica.
- La interfaz sigue una divulgación progresiva: unidad, posición, identidad, estado y acción son
  lo primero; los datos técnicos precargados quedan agrupados en **Editar datos técnicos** y siguen
  siendo editables. En Servicios, la cola actual queda arriba, mientras que métricas, distribución
  y datos técnicos de cada fila se abren solo cuando hacen falta. Esta reducción no oculta errores,
  origen, estado del borrador ni información necesaria para auditar una operación.
- La navegación web conserva barras de desplazamiento discretas para que el contenido adicional sea
  descubrible; los filtros muestran el tipo de datos que aceptan y el importador mantiene accesible
  la selección de archivos por teclado.

## Alineación responsive 2026-09-21

- La carcasa común de los tableros usa el mismo límite de tablet y permite que marca, buscador,
  navegación y contenido se reacomoden sin imponer un ancho mínimo al viewport.
- La vista de unidad recompone Servicios en tablet y móvil: el panel operativo deja de competir con
  el escenario, las posiciones se desplazan horizontalmente cuando corresponde y el encabezado usa
  sus propias herramientas, sin heredar reglas de otra pantalla.
- Se validó el cambio Inspección ↔ Servicios en escritorio, tablet horizontal, tablet vertical y
  móvil; en pantallas pequeñas el escenario se simplifica sin ocultar la acción ni el estado de la
  unidad.
