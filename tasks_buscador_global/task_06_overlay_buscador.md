# task_06 — Overlay del buscador

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

El overlay del buscador: apertura, entrada de texto, resultados ricos agrupados, navegación por
teclado completa y estados. Todavía sin integrarlo en las pantallas — eso es `task_07`.

## 3. Dependencias y bloqueos

Depende de `task_05`. Bloquea `task_07`.

## 4. Archivos exclusivos

- `WEB/buscador/finder-controller.js`
- `WEB/buscador/buscador.css`

Solo lectura: módulos de `task_05`, `WEB/movimientos/a11y.js`, `WEB/renova-office-shell.css`,
`WEB/supabase-demo.js`, `WEB/renova-ready.js`, `DESIGN.md`, `PRODUCT.md`.
**Prohibido editar otras pantallas, el shell CSS, Supabase, Inventario o Movimientos.**

## 5. Contratos de UI

- Arranque mediante `onRenovaSupabaseReady` y `requireAuth`.
- Reutilizar `createFocusTrap` de `WEB/movimientos/a11y.js`. **No crear un tercer sistema de modal**
  (`AUDIT.md` §4).
- Patrón `combobox`: `role=combobox` en el input, `aria-expanded`, `aria-controls`,
  `role=listbox` en la lista, `role=option` en cada fila, `aria-activedescendant` apuntando al
  resultado activo.
- **El foco permanece en el input**; las flechas mueven `aria-activedescendant`, no el foco.
- `Enter` navega al resultado activo. `Escape` cierra y **devuelve el foco al disparador**.
- Resultados agrupados por tipo con conteo por grupo.
- Fila de neumático: código + marca + diseño + medida + unidad + posición + estado, reconocible sin
  abrirla. Fila de unidad: placa + configuración + estado.
- Alias mostrado como pista junto al grupo; nunca obligatorio para llegar a un resultado.
- Estado vacío: objetos recientes y destinos de pantalla.

## 6. Pasos

1. Crear el controlador con render DOM seguro por `textContent`; **nunca interpolar dato remoto en
   `innerHTML`**.
2. Conectar el modelo puro de `task_05` a input, agrupación y selección.
3. Implementar teclado: flechas, Home/End, `Enter`, `Escape`, y tabulación que no escape del
   overlay.
4. Implementar loading, empty, unauthorized, error, retry y stale.
5. Aplicar tokens de `DESIGN.md`, layout industrial y responsive.
6. Región viva prudente para anunciar el número de resultados; no anunciar en cada tecla.

## 7. Invariantes

- **Ninguna acción de escritura.** Sin descartar, retirar, reinstalar, editar ni confirmar lotes
  (D9). El overlay enruta.
- Sin parsing silencioso: si en el futuro se interpreta un token, se muestra como chip removible
  (D8). En este alcance no se interpreta nada.
- **Regla del Naranja Único**: el resultado activo es el único elemento naranja mientras el overlay
  está abierto.
- **Regla de la Sombra Reservada**: el overlay flota, así que usa `0 8px 24px rgba(0,0,0,0.4)`. Nada
  más en la pantalla gana sombra por esto.
- Sin rojo. Los badges de estado usan el semáforo vigente; `discarded` puede llevar el acento
  apagado ya usado en Inventario, sin leerse como invitación a una acción.
- JetBrains Mono; `tabular-nums` en RTD, presión, posición y fechas.
- Motion 0.15–0.28 s, `ease-out`, sin rebote; `prefers-reduced-motion` desactiva todo.
- Estado por borde 2px; disabled por recolor, nunca `opacity`.
- No hardcodear catálogos.

## 8. Casos de error

- Sin sesión: estado no autorizado, **no «0 resultados»**.
- Índice no cargado aún: loading, no lista vacía.
- Carga fallida: mensaje seguro y reintento; sin exponer detalle del backend.
- Caché desactualizada: se usa y se marca; nunca se presenta como fresca.
- Casco sin código: fila visible con `SIN CÓDIGO`, enrutando a su unidad; si tampoco hay unidad,
  fila **visible y no navegable**, sin enlace falso.
- Sin coincidencias: mensaje distinto de «sin datos».

## 9. Accesibilidad

`combobox` completo, `aria-activedescendant`, foco visible único, foco devuelto al cerrar, targets
≥44 px, etiquetas que no dependan del color, región viva no intrusiva, sin overflow a 390×844.

## 10. Smoke parcial y aceptación

Con fixture local o mocks inyectados:

- apertura y cierre, foco devuelto al disparador;
- teclado completo, incluido `aria-activedescendant` correcto en cada paso;
- grupos y conteos correctos;
- resultado con código nulo sin enlace;
- estados loading/empty/unauthorized/error/retry;
- 390×844 sin overflow; escritorio legible;
- `prefers-reduced-motion` verificado;
- consola sin errores.

Comandos: servir `WEB/` sobre HTTP, recorrer en navegador, `node --check` del controlador,
`git diff --check`.

## 11. Rollback

Retirar los dos archivos. Los módulos puros de `task_05` quedan sin exposición.

## 12. Handoff

Actualizar fila 06 con viewports probados, recorrido de teclado, estados verificados y conteo de
errores de consola. **No declarar navegación global hasta `task_07`.**
