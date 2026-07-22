# task_11 — Prefijos de alcance por tipo

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Hacer operativos los prefijos que `task_06` §5 ya preveía como pista visual: escribir `uni:` acota
la búsqueda a unidades, `neu:` a neumáticos.

## 3. Dependencias y bloqueos

Depende de `task_10`. Bloquea `task_13`.

## 4. Archivos exclusivos

- `WEB/buscador/search-model.js`
- `WEB/buscador/finder-controller.js`
- `WEB/buscador/buscador.css`
- `WEB/buscador/__tests__/search-model.test.js`

## 5. Relación con D8 — leer antes de implementar

**Los prefijos no derogan D8** (D16). D8 prohíbe *parsear prosa a filtros de atributo en silencio*:
que `Michelin 315 R2` se convierta invisiblemente en `marca=… AND medida=… AND condición=…`. Eso
sigue prohibido, y por la razón de siempre: falla sin que el usuario lo note, en un sistema que
decide retiros.

Un prefijo `neu:` es otra cosa: lo teclea el usuario, es inequívoco, y filtra por `kind` — una
columna cerrada de dos valores. No hay inferencia ni ambigüedad posible.

La frontera es esta: **el buscador acota por tipo de objeto, nunca infiere atributos del texto
libre.** Cruzarla requiere una decisión humana nueva, no la iniciativa del ejecutor.

## 6. Comportamiento

- `uni:` → solo `kind='unit'`. `neu:` → solo `kind='casing'`.
- El prefijo se **materializa como chip visible y removible** al principio del input. Backspace
  sobre el chip vacío lo elimina y devuelve la búsqueda global. Es el modelo del §3.1 de la
  exploración: la interpretación siempre es inspeccionable.
- El texto tras el prefijo se busca con el mismo módulo compartido, sin cambios.
- **Los prefijos son opcionales.** Escribir sin prefijo sigue buscando en todo. Ningún objeto puede
  ser inalcanzable sin conocer un prefijo: el día que uno sea necesario, el diseño falló.
- El alias se muestra junto a cada grupo de resultados para que se aprenda **pasivamente**, sin
  tener que enseñarlo.
- Sin prefijo, los grupos siguen apareciendo como hoy.

## 7. Invariantes

- Sin inferencia de atributos desde texto libre (D8).
- Un prefijo desconocido (`xyz:`) **no filtra nada**: se trata como texto literal de búsqueda. No
  lanza, no vacía la lista, no inventa una categoría.
- No introducir fuzzy matching ni sinónimos.
- La frecency sigue afectando solo el orden (D13).
- No tocar el módulo compartido `WEB/shared/search.js`: los prefijos son alcance, no algoritmo.

## 8. Casos de error

- `uni:` sin texto: todas las unidades, ordenadas. No es un error.
- `neu:` con texto sin coincidencias: «sin coincidencias», distinto de «sin datos».
- Prefijo en medio del texto (`abc uni:`): no se interpreta. Solo cuenta al principio.
- Dos prefijos (`uni: neu:`): gana el primero; el segundo es texto literal.
- Mayúsculas (`UNI:`, `Neu:`): se aceptan, misma normalización que el resto.

## 9. Aceptación

```bash
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/inventario     # regresión
npx vitest run --dir WEB/movimientos    # regresión
git diff --check
```

Cobertura mínima: cada prefijo acota correctamente; prefijo desconocido tratado como literal;
prefijo a mitad de texto ignorado; chip removible con Backspace; búsqueda sin prefijo inalterada
respecto de `task_06`.

Smoke: teclear `uni:` y `neu:`, verificar el chip, quitarlo con Backspace, confirmar que sin prefijo
el comportamiento no cambió.

## 10. Rollback

Revertir los archivos. El buscador vuelve al comportamiento aprobado en `task_10`.

## 11. Handoff

Actualizar fila 11. Registrar explícitamente que D8 **no** fue derogada y que los prefijos operan
solo sobre `kind`.
