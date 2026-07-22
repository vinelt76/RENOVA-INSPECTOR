# task_10 — Overlay centrado y persistencia de frecency

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Dos correcciones sobre lo entregado en `task_06`/`task_07`: presentar el overlay centrado tipo
Spotlight (D15) y **reparar los recientes**, que hoy no funcionan (D19).

No amplía alcance. `task_07` queda `APROBADO` tal como está; esta tarea corrige encima.

## 3. Dependencias y bloqueos

Depende de `task_07`. Bloquea `task_11`.

## 4. Archivos exclusivos

- `WEB/buscador/finder-controller.js`
- `WEB/buscador/buscador.css`
- `WEB/renova-office-shell.css` (solo la ubicación de la barra)
- `WEB/buscador/data.js` (solo si la persistencia de frecency se aloja ahí)

Solo lectura: `WEB/buscador/search-model.js` — sus funciones puras están correctas y **no se tocan**.

## 5. El defecto de frecency

Diagnóstico verificado:

```
finder-controller.js:93   let frecency = {};
finder-controller.js:122  frecency = recordSearchFrecency(frecency, row.entity_id);
```

`data.js` persiste el índice en `sessionStorage` bajo `renova:search-index:v1`, pero **la frecency
no se persiste en ningún lado**. Es una variable local del controlador que se reinicia en cada carga
de página. Como la web son 7 documentos estáticos que recargan enteros en cada navegación, la
frecency muere siempre.

Efecto observable: con frecency vacía, `recentSearchRows` cae al orden del índice y muestra 8
objetos arbitrarios **rotulados como recientes**. No es una lista vacía: es una lista que miente.

Por qué pasó el review: las 13 pruebas de `task_05` cubren las funciones puras, que son correctas, y
el smoke de `task_06` usó mocks. El fallo está en el **cableado**, no en la lógica.

### Requisitos de la reparación

1. Persistir frecency entre cargas de página y entre pantallas.
2. Usar **`localStorage`**, no `sessionStorage`: la utilidad de los recientes es justamente
   sobrevivir a la sesión. La caché del índice sigue en `sessionStorage`; son dos cosas distintas
   con vidas distintas.
3. **Aislar por usuario y empresa**, con la misma disciplina que la caché del índice: la frecency de
   un usuario de CIVA no puede sobrevivir a un login de MÓVIL BUS. Clave versionada.
4. Purgar en `SIGNED_OUT`, igual que hace `data.js` hoy.
5. Con frecency vacía, el estado vacío **no debe fingir recientes**: mostrar destinos de pantalla o
   un mensaje honesto, nunca 8 objetos arbitrarios presentados como historial.
6. Acotar el tamaño: la frecency no puede crecer sin límite. Podar por antigüedad o por número de
   entradas.

## 6. El overlay centrado

- Posición centrada tipo Spotlight, tanto al abrir por `Ctrl/Cmd+K` como por clic en la barra.
  Mismo overlay, mismo comportamiento, sin importar el disparador.
- Ancho máximo legible; centrado horizontal; anclado en el tercio superior vertical, no pegado al
  borde.
- Revisar la ubicación de la barra en el header: no debe competir visualmente con la navegación.
- A 390×844 el overlay ocupa el ancho disponible con márgenes; sin overflow horizontal.

## 7. Invariantes

- **No tocar `search-model.js`.** Sus pruebas pasan y su lógica es correcta.
- No modificar las suites existentes de Inventario ni de Movimientos.
- Mantener todo lo verificado en `task_06`: combobox, `aria-activedescendant`, foco devuelto,
  Home/End/flechas/Enter/Escape, estados, `prefers-reduced-motion`.
- Regla del Naranja Único y Regla de la Sombra Reservada siguen aplicando.
- La frecency sigue afectando **solo el orden, nunca la existencia** de un resultado (D13).

## 8. Casos de error

- `localStorage` bloqueado o lleno: degradar a memoria sin romper; los recientes simplemente no
  persisten.
- Frecency de otra empresa o versión: descartar silenciosamente.
- Frecency corrupta o no parseable: descartar y empezar de cero, sin lanzar.

## 9. Aceptación

```bash
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/inventario     # regresión
npx vitest run --dir WEB/movimientos    # regresión
node --check WEB/buscador/finder-controller.js
git diff --check
```

Smoke obligatorio, porque el defecto era de cableado y las pruebas unitarias no lo detectaron:

1. Abrir el buscador, navegar a un objeto, **recargar la página**, reabrir: ese objeto aparece en
   recientes.
2. Navegar a **otra pantalla** y reabrir: sigue apareciendo. Es el caso que hoy falla.
3. Cerrar sesión, entrar con otra empresa: **la frecency anterior no aparece**.
4. Primera vez sin historial: estado vacío honesto, sin objetos arbitrarios.
5. Overlay centrado por atajo y por clic; 390×844 sin overflow.

## 10. Rollback

Revertir los archivos. `task_07` queda intacto por debajo.

## 11. Handoff

Actualizar fila 10 con: dónde se persiste la frecency, cómo se aísla por empresa, y el resultado de
los cinco pasos de smoke — en particular el 2 y el 3.
