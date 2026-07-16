# task_05 — Pantalla, controlador y estilos

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Crear la pantalla autenticada con pestañas Retén/Descartados, contadores, búsqueda/filtros,
estados completos, historial y refresco Realtime, sin acciones de escritura.

## 3. Dependencias y bloqueos

Depende de `task_04`. Bloquea `task_06`.

## 4. Archivos exclusivos

- `WEB/inventario.html`
- `WEB/inventario/inventory-controller.js`
- `WEB/inventario/inventario.css`

Solo lectura: módulos de task 04, `renova-office-shell.css`, `supabase-demo.js`, `renova-ready.js`,
`DESIGN.md`, `PRODUCT.md`. Prohibido editar otras pantallas, Supabase o Movimientos.

## 5. Contratos de UI

- Arranque mediante `onRenovaSupabaseReady` y `requireAuth`.
- Tabs exactas `Retén` y `Descartados`, con contador total sin filtros.
- Una sola pestaña/panel activo.
- Código existente navega a
  `historial-neumatico.html?serie=<encodeURIComponent>&from=inventario`.
- Foto de descarte se representa como “Evidencia registrada”; no se muestra URL/imagen.

## 6. Pasos

1. Crear HTML mínimo con shell compartido y carga de módulo.
2. Crear render DOM seguro con `textContent`, sin HTML remoto interpolado.
3. Conectar modelo puro a tabs, búsqueda y filtros.
4. Implementar loading, empty por pestaña, unauthorized, error y retry.
5. Suscribir cambios de taller y agrupar recargas; conservar pestaña/filtros.
6. Aplicar tokens actuales, layout industrial y responsive.
7. Implementar teclado de tabs, foco visible y anuncios.

## 7. Invariantes

No botón Reinstalar/Reencauchar/Restaurar/Editar/Eliminar. No ranking ni comparativo. Un acento
rojo apagado puede identificar la baja definitiva, sin usarlo como invitación a una acción.
Respetar naranja para acciones, amarillo para hitos y verde exclusivo de verificación. No
hardcodear catálogos.

## 8. Casos de error

- Sin sesión: modal/login y estado no autorizado, no “0 resultados”.
- Una vista falla: no mezclar datos parciales sin advertencia.
- Refresh falla: conservar última lectura y marcarla desactualizada.
- Sin código: texto “SIN CÓDIGO”, sin enlace falso.
- Contrato incompatible/intersección: error explícito y sin render engañoso.

## 9. Accesibilidad

`tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, flechas, Home/End, foco visible, región
viva no intrusiva, targets ≥44 px y etiquetas que no dependan del color.

## 10. Smoke parcial y aceptación

Con fixture local o mocks inyectados:

- ambas pestañas y contadores correctos;
- búsqueda/filtros y limpieza;
- teclado completo y retorno de foco;
- 390×844 sin overflow; escritorio con grilla legible;
- estados loading/empty/error/retry;
- consola sin errores.

Comandos: servir `WEB/` sobre HTTP, recorrer en navegador, `node --check` del controlador y
`git diff --check`.

## 11. Rollback

Retirar HTML y los dos archivos de UI; módulos puros pueden quedar sin exposición o retirarse con
task 04.

## 12. Handoff

Actualizar fila 05 con viewports, recorrido de teclado, estados probados y conteo de errores de
consola. No declarar navegación global hasta task 06.
