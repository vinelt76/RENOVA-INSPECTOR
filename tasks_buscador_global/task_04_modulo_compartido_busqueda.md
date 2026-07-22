# task_04 — Módulo compartido de búsqueda

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Extraer a un único módulo la primitiva de búsqueda hoy **duplicada** en Inventario y Movimientos, y
migrar ambos consumidores a él sin cambiar su comportamiento. Resultado observable: las dos suites
existentes pasan **sin modificación**.

Es la tarea de mayor riesgo de regresión silenciosa de la fase: toca dos pantallas en producción sin
agregar funcionalidad.

## 3. Dependencias y bloqueos

Depende de `task_01`. Bloquea `task_05`.

## 4. Archivos exclusivos

- `WEB/shared/search.js` (nuevo)
- `WEB/shared/__tests__/search.test.js` (nuevo)
- Las secciones de `WEB/inventario/inventory-model.js` y `WEB/movimientos/inventory-ui.js` que hoy
  contienen la copia

Solo lectura: `WEB/inventario/__tests__/`, `WEB/movimientos/__tests__/`. **Prohibido editarlos.**

## 5. Contratos

El módulo expone la normalización y el filtrado por tokens que ya existen. Antes de escribir nada,
leer ambas copias y **verificar que son equivalentes**: la auditoría las reporta idénticas en
algoritmo, pero la extracción debe confirmarlo, no asumirlo.

Comportamiento a preservar textualmente:

- normalización `NFD` + strip de diacríticos + `toLocaleLowerCase("es")` + colapso de espacios;
- tokenización por espacios, **AND entre tokens**, cada token puede coincidir en columna distinta;
- coincidencia por substring, no fuzzy;
- la lista de columnas buscables sigue siendo **parámetro del consumidor**, no constante del módulo:
  Inventario, Movimientos y el buscador tienen vocabularios distintos.

## 6. Pasos

1. Leer las dos implementaciones y diffearlas. Registrar cualquier divergencia encontrada.
2. Si divergen, **detenerse y reportar** antes de unificar: elegir una en silencio cambia el
   comportamiento de una pantalla en producción.
3. Crear `WEB/shared/search.js` con la implementación común, sin dependencias de DOM ni de red.
4. Migrar `WEB/inventario/inventory-model.js` a importarla, conservando sus exports públicos
   actuales para no romper a sus consumidores.
5. Migrar `WEB/movimientos/inventory-ui.js` igual.
6. Correr ambas suites existentes **sin tocarlas**.
7. Añadir pruebas propias del módulo en `WEB/shared/__tests__/`.

## 7. Invariantes

- **No modificar las suites existentes.** Si no pasan, la extracción cambió comportamiento.
- No cambiar la firma pública de `inventory-model.js`: `WEB/inventario/inventory-controller.js`
  depende de ella.
- No introducir fuzzy matching, ni stemming, ni sinónimos. Eso es alcance futuro y cambiaría los
  resultados de dos pantallas ya validadas.
- Sin dependencias nuevas de npm.
- El módulo es puro: sin DOM, sin red, sin estado global.

## 8. Casos de error

- Query vacía: devuelve el conjunto completo, como hoy.
- Query solo de espacios: equivalente a vacía.
- Fila con todas las columnas buscables nulas: no coincide con nada, no lanza.
- Columna inexistente en la lista del consumidor: se ignora, no lanza.

## 9. Aceptación

```bash
# suites existentes, sin modificación
npx vitest run --dir WEB/inventario
npx vitest run --dir WEB/movimientos
# suite nueva
npx vitest run --dir WEB/shared
git diff --check
```

Criterio de bloqueo: cualquier archivo bajo `WEB/inventario/__tests__/` o
`WEB/movimientos/__tests__/` que aparezca modificado en el diff invalida la tarea.

## 10. Rollback

Restaurar las dos copias originales y borrar `WEB/shared/`. Ninguna otra pantalla queda afectada.

## 11. Handoff

Actualizar fila 04 con: resultado del diff entre las dos copias, conteo de pruebas de las tres
suites, y confirmación explícita de que las suites existentes no fueron tocadas.
