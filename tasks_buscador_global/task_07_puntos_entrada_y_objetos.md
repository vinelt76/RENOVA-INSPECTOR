# task_07 — Puntos de entrada y objetos navegables

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Cerrar la brecha que abre esta fase: que el buscador se pueda abrir desde **cualquier** pantalla, y
que los dos objetos sean alcanzables y enlazados entre sí.

Resultado observable: desde las 7 pantallas se llega a una unidad y a un neumático sin conocer de
antemano su URL.

## 3. Dependencias y bloqueos

Depende de `task_06`. Bloquea `task_08`.

## 4. Archivos exclusivos

- `WEB/renova-office-shell.css` — barra de búsqueda en el header compartido
- Carga del buscador y enlaces en las 7 pantallas:
  `WEB/INSPECCIONES POR FECHA.html`, `WEB/Inspecciones por unidad.html`, `WEB/rendimiento.html`,
  `WEB/inventario.html`, `WEB/instalacion.html`, `WEB/importar.html`,
  `WEB/historial-neumatico.html`
- `scripts/prepare-static-hosting.mjs` — allowlist del bundle

Solo lectura: `WEB/buscador/*`, `WEB/shared/*`.

## 5. Trabajo concreto

### 5.1 Entrada al buscador

- Barra **visible y persistente** en el header de `renova-office-shell.css`, presente en las 7
  pantallas, más el atajo `Ctrl/Cmd+K` (D10).
- El atajo no puede ser la única puerta: el perfil de usuario no está caracterizado y no se asume
  experto (`AUDIT.md` §9).
- El atajo no debe secuestrar el teclado cuando el foco está en un input de formulario de
  `instalacion.html` o del modo Movimientos.

### 5.2 Reparación de defectos de navegación

Son correcciones de defecto ya documentadas en `docs/dashboard_ui_ux_audit.md`, no alcance nuevo:

1. **`historial-neumatico.html`: botón «Volver» roto.** Apunta a
   `UI/renova_dashboard_taller_v1.html`, archivo inexistente (`:414-419`, severidad Alta). Reparar
   con un destino real, respetando el parámetro `from` ya soportado y añadiendo `from=buscador`.
2. **`historial-neumatico.html` sin navegación.** Darle el header y la nav compartidos.
3. **`instalacion.html` no enlaza a historial desde ninguna fila** (`:190-192`). Enlazar el código
   de casco, con `encodeURIComponent` y **sin crear enlace cuando el código es nulo**.

### 5.3 Objeto Unidad

`WEB/Inspecciones por unidad.html` ya acepta `?plate=`. Hacer de esa forma la entrada canónica de la
unidad: llegar con `?plate=` sin `inspection_id` debe resolver a la inspección más reciente de esa
unidad, sin pantalla en blanco.

### 5.4 Bundle estático

`scripts/prepare-static-hosting.mjs` usa **allowlist explícita** (línea 21 para archivos, línea 25
para directorios). Añadir `WEB/buscador/` y `WEB/shared/`. Omitirlo produce un despliegue que
funciona en local y falla en producción — es exactamente la omisión que la fase de Inventario tuvo
que corregir para `movimientos/`.

Verificar de paso si `renova-animate.js` y `renova-format.js` están ausentes de la allowlist. Si lo
están, **reportarlo en `STATE.md` sin arreglarlo**: es un defecto preexistente fuera de este alcance.

## 6. Invariantes

- No rediseñar las pantallas. Esta tarea agrega una barra, repara enlaces y añade entradas de
  bundle.
- No cambiar la lógica de negocio de ninguna pantalla.
- No romper los deep-links vigentes: `?inspection_id=`, `?plate=`, `?date=`, `?mode=movimientos`,
  el alias legacy `?mode=cambios` y `?tab=descartados` deben seguir funcionando. El precedente de
  canonicalización con alias conservado es la regla del proyecto.
- Un código nulo **nunca** produce enlace.
- La nav sigue duplicada a mano en cada archivo; **no** es alcance de esta tarea unificarla, pero la
  barra debe quedar consistente en las 7.

## 7. Casos de error

- Pantalla sin sesión: la barra existe pero abrir el buscador lleva al estado no autorizado.
- `?plate=` de una unidad sin inspecciones: estado vacío honesto, no error ni pantalla en blanco.
- `?serie=` de un código inexistente: estado vacío distinguible de error de carga.
- Atajo pulsado con foco en un campo de texto: no abre el buscador.

## 8. Aceptación

- Las 7 pantallas muestran la barra y responden al atajo.
- Desde cada una se llega a una unidad y a un neumático.
- El «Volver» de `historial-neumatico.html` lleva a un destino real desde cada origen (`inspeccion`,
  `rendimiento`, `inventario`, `buscador`, y sin `from`).
- `instalacion.html` enlaza a historial; filas sin código no enlazan.
- El bundle generado contiene `buscador/` y `shared/`.
- Deep-links vigentes verificados uno por uno.

```bash
node scripts/prepare-static-hosting.mjs
# inspeccionar la salida: buscador/ y shared/ presentes
git diff --check
```

## 9. Rollback

Retirar la barra del shell, la carga del buscador de las 7 pantallas y las dos entradas del bundle.
**Las reparaciones de §5.2 no se revierten**: son correcciones de defecto independientes del
buscador.

## 10. Handoff

Actualizar fila 07 con: pantallas verificadas, deep-links probados, destinos del botón «Volver» por
cada `from`, contenido del bundle y el hallazgo sobre `renova-animate.js`/`renova-format.js` si
aplica.
