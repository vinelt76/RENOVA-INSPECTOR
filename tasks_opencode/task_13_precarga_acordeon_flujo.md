# task_13 — Precarga visible + acordeón de datos del neumático + avance entre posiciones

## Objetivo

Optimizar el flujo de captura para el caso real de campo: en el 90-95% de las inspecciones el
neumático NO cambió — solo cambian remanentes, presión y anomalía. La pantalla debe reflejar
eso: datos identitarios del neumático (código, marca, modelo, medida, reencauche, válvula,
condición) **colapsados por defecto** cuando vienen precargados, y captura de medición con el
mínimo de toques.

Ideas aprobadas por Facundo en mensajes del 1/jul/2026; el resumen vigente está en
`knowledge/ai/09 - Diseno y UX.md`:

1. **Acordeón "datos del neumático"**: por defecto se muestra solo un resumen compacto
   (código + marca + medida en una línea, estilo tarjeta resumen). Tocarlo expande "como una
   serpentina" hacia abajo el formulario completo (código, marca, modelo, medida, condición,
   reencauche, válvula). El disparador natural es el bloque del código de neumático — solo lo
   tocas si la llanta cambió.
2. **Mantener datos antiguos al cambiar código**: al expandir y cambiar el código, marca /
   modelo / medida / reencauche NO se limpian — usualmente solo cambia el código. El inspector
   modifica solo lo que difiere.
3. **Selector de posiciones más ergonómico**: hoy queda muy abajo/lejos del pulgar. Subirlo o
   centrarlo verticalmente al abrirse.
4. **Avance fluido entre posiciones**: al completar/guardar una posición, pasar
   automáticamente a la siguiente (con transición corta, sin rebote — ver DESIGN.md §motion).
   Además, permitir cambiar de posición con las flechas ‹ › existentes sin abrir el selector.

## Contexto / archivos

- `app/src/screens/FormBody.tsx` — formulario por posición (aquí vive el acordeón).
- `app/src/screens/InspeccionScreen.tsx` — navegación entre posiciones, sheet selector, estado
  de completitud por posición, autosave (`upsertNeumatico`).
- `app/src/screens/UnidadScreen.tsx` — de aquí viene la precarga (clonado de la última
  inspección al continuar).
- `app/src/db/repos/inspeccionRepo.ts` — `clonarNeumaticos`, `upsertNeumatico`.
- Depende de: **task_12 aprobado** (el ciclo buscar→inspeccionar→volver debe estar estable) y
  **task_11 aprobado** (el acordeón usa el lenguaje visual ya alineado).

## Pasos

1. **Resumen colapsado**: si la posición tiene datos precargados (código no vacío), `FormBody`
   arranca colapsado: una card `FIELD_DARK` con código (hero value), marca + medida +
   reencauche en una línea secundaria (`VALUE_COLOR`, no gris), y un chevron. Si NO hay
   precarga (bus nuevo / posición vacía), arranca **expandido** — no hay nada que resumir.
2. **Expandir/colapsar**: animación de altura 0.2s ease-out ("serpentina"). Expandido muestra
   los campos actuales tal cual (autocompletes incluidos). El estado expandido/colapsado es
   por posición y NO persiste en DB (solo UI).
3. **Cambiar código sin perder el resto**: verificar que editar el código no dispare ninguna
   limpieza de marca/modelo/medida/válvula (si hoy no ocurre, solo confirmarlo con un test
   manual; si ocurre, corregirlo).
4. **REMANENTE y PRESIÓN siempre visibles**: la sección de medición nunca se colapsa — es el
   trabajo diario. El acordeón afecta SOLO los datos identitarios.
5. **Selector de posiciones**: al abrir el sheet, que el grid quede en la zona media de la
   pantalla (alcanzable con el pulgar). Mantener los puntos de estado
   (verde=completa/amarillo=parcial/borde=vacía).
6. **Auto-avance**: al completar los canales de remanente + presión de una posición (mismo
   criterio que ya marca "completa"), avanzar a la siguiente posición incompleta con una
   transición breve. Debe poder desactivarse volviendo manualmente (las flechas ‹ › siempre
   ganan). NO avanzar si el inspector está editando el acordeón expandido.

## Criterios de aceptación

- Con unidad precargada: cada posición se ve como resumen de 1 card + medición; el formulario
  completo solo aparece al tocar. Con bus nuevo: formulario completo directo.
- Cambiar solo el código y guardar conserva marca/modelo/medida/reencauche/válvula anteriores.
- Completar medición de la posición N salta a la N+1 incompleta; las 8 posiciones de un 2-4-2
  se pueden capturar sin abrir nunca el selector.
- El autosave sigue funcionando en cada edición (verificar recargando la página).
- 0 errores de consola en todo el recorrido.

## Cómo verificar

Smoke test en navegador OBLIGATORIO: `npm run dev`, continuar inspección de una unidad con
historial (p.ej. 7244), recorrer las 8 posiciones solo con teclado numérico + auto-avance,
expandir un acordeón, cambiar un código, guardar, recargar y confirmar persistencia. Anotar
recorrido y resultado en `STATE.md`. `npm run build` + `npm test` + `npm run lint` verdes.

## Fuera de alcance

- Scroll/carrusel horizontal entre posiciones (idea de Facundo aún no decidida — el
  auto-avance cubre la necesidad; se evalúa después con feedback de campo).
- Vista esquemática del vehículo, indicador de % de calidad, escáner flotante (backlog).
- Supabase (task_14). Cambios de schema/seed. `calculations.ts`.
