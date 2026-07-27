# task_11 — Defectos de UI vistos en pantalla

**Hallazgos:** H-12, H-13, y F-12/F-13 del reporte de Codex · **Prioridad:** Baja
**Bloquea la demo:** no, pero uno condiciona desde qué equipo se demuestra

## 1 — Inventario muestra el correo del usuario en vez de la empresa

La insignia de sesión de `inventario.html` muestra
`SN · SUPERVISOR DE NEUMÁTICOS · Y1UEKZD7G@MOZMAIL.COM`. Las otras tres pantallas
(Rendimiento, Servicios, Inspecciones por unidad) muestran `· MÓVIL BUS` en el mismo lugar.

Inventario cae a un fallback distinto cuando resuelve el nombre de empresa. Encaja con la deuda ya
registrada de navegación y shell duplicados a mano en los 7 HTML: cada pantalla resuelve la
insignia por su cuenta y una se desvió.

**Arreglo:** que Inventario use la misma fuente de nombre de empresa que las otras tres. Si el
nombre no está disponible, mostrar el rol solo — nunca el correo.

**No hacer:** unificar el shell entero en esta task. Eso es una fase propia; mezclarla acá
contamina el rollback.

## 2 — Pastilla «Incluyendo 0 datos antiguos»

Rendimiento renderiza la pastilla activa **«Incluyendo 0 datos antiguos ×»** junto a los filtros,
con el contador en cero, acompañada del texto «Se incluyen inspecciones antiguas; esto no calcula
consumo por periodo».

Anuncia una inclusión que no incluye nada, en un lugar destacado.

**Arreglo:** no renderizar la pastilla cuando el contador es 0.

## 3 — `Inspecciones por unidad` es desktop-only (F-12 de Codex, verificado)

`WEB/Inspecciones por unidad.html:51` define `min-width: 1280px`. No es un error de meta tag: es
un diseño de escritorio fijo. En un teléfono la página queda escalada y el dashboard post-login no
es usable.

**Para el lunes esto no se arregla, se evita:** esa pantalla se demuestra desde laptop. No afecta a
la app Android de inspección, que es otra superficie.

Si en algún momento se quiere web móvil ahí, es una fase de diseño propia — no un ajuste de CSS de
último momento.

## 4 — `/favicon.ico` devuelve 404 (F-13 de Codex)

No afecta autenticación, datos, JS ni navegación. Un `<link rel="icon">` o un archivo lo resuelve.
Vale la pena solo porque es gratis.

## Criterio de cierre

- Inventario muestra `· MÓVIL BUS` como las otras tres pantallas, con la misma sesión.
- Con 0 datos antiguos, la pastilla no aparece; con ≥ 1, sigue apareciendo igual que hoy.
- El guion de la demo dice explícitamente que Inspecciones por unidad va desde laptop.
- Sin 404 de favicon en la consola.
- Las suites de `WEB/inventario` y `WEB/rendimiento` verdes (ver `task_08`: `WEB/rendimiento`
  todavía no tiene `package.json`, así que hay que correrla a mano con `npx vitest run`).
