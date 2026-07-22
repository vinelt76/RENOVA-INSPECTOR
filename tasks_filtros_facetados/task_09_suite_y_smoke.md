# task_09 — Suite integral y smoke de campo

## 1. Propietario

**CODEX + USUARIO** (el recorrido de campo lo hace una persona con datos reales).

## 2. Objetivo y resultado observable

Verificar la fase completa **sobre el estado final del código**, no sobre estados intermedios.

Precedente que motiva esta redacción: en `tasks_buscador_global`, `task_08` se ejecutó
anticipadamente y **hubo que repetirla** tras las tareas 10–13 porque su evidencia ya no
correspondía al código entregado. Esta tarea corre al final, después de `task_08`.

Resultado observable: todas las suites verdes sin modificar las preexistentes, y un recorrido humano
con datos reales documentado en `PRUEBA_CAMPO.md`.

## 3. Dependencias y bloqueos

Depende de `task_08` — es decir, de **toda** la cadena. Bloquea `task_10`.

Si `task_08` se detuvo por cobertura insuficiente, esta tarea corre igual sobre lo entregado, y
`PRUEBA_CAMPO.md` registra la capacidad ausente como limitación conocida, no como pendiente
silencioso.

## 4. Archivos exclusivos

- `PRUEBA_CAMPO.md` (nuevo, esta carpeta)
- Columna Resultado/Revisión de `STATE.md`

**Solo lectura: todo el código.** Esta tarea verifica; no corrige. Un defecto encontrado devuelve la
tarea correspondiente a `EN CORRECCIÓN`.

## 5. Contratos

### Suite completa

```bash
npx vitest run --dir WEB/shared
npx vitest run --dir WEB/rendimiento
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/neumaticos
npx vitest run --dir WEB/inventario
npx vitest run --dir WEB/movimientos
npm run docs:check
git diff --check
```

Ninguna suite preexistente puede aparecer modificada en el diff.

### Bundle

Verificar que `scripts/prepare-static-hosting.mjs` incluye `WEB/shared/filter-bar.js`,
`filter-facets.js` y `filter-bar.css`. Precedente: `tasks_buscador_global/task_07` dejó archivos
fuera del allowlist y se descubrió tarde.

Registrar también si sigue vigente el hallazgo preexistente de esa fase (`renova-animate.js` y
`renova-format.js` omitidos del allowlist). **No corregirlo acá**; verificar y reportar.

### Recorrido de campo

Con datos reales, dos empresas distintas, en 390×844 y escritorio.

**Rendimiento**

1. Entrada sin filtros: agregado de flota, conteos de exclusión visibles.
2. `eje: Tracción` → agregado recalculado.
3. `+ marca: MICHELIN` → AND entre facetas.
4. Dos marcas → OR dentro de faceta.
5. Quitar chip y «Atrás» → ambos revierten.
6. URL compartida reproduce el resultado.
7. Fila → detalle con eje, posición, datos fuente y balance izquierda/derecha.
8. Frescura: default 30 días, conteo de rancios, chip de inclusión.
9. Ventana temporal (si `task_08` cerró): un rango verificado a mano.
10. Los tres conteos de exclusión son distinguibles entre sí.

**Inspecciones**

11. Filas = neumáticos.
12. Chip de fecha: aplicar y quitar.
13. Estado: uno y dos valores.
14. Estado + fecha = AND.
15. Autocomplete distingue unidad de neumático ante un código ambiguo (F5).
16. `code_mismatch` encontrado por **ambos** códigos.
17. Casco sin código: visible, sin enlace falso.
18. `?date=`, `?plate=`, `?inspection_id=` siguen resolviendo.

**Transversal**

19. Aislamiento entre empresas: A no ve datos de B.
20. Teclado completo en ambas pantallas, sin mouse.
21. 390×844 sin overflow horizontal.
22. 0 errores de consola; ningún secreto en consola ni en red.
23. Recarga persiste el estado de chips.
24. El buscador global sigue funcionando sin cambios (F2).

### Verificación numérica

**El punto que más importa.** Elegir un subconjunto pequeño y comprobar a mano que el agregado
filtrado coincide con el cálculo manual sobre esos neumáticos.

A escala de flota nadie detecta un agregado mal calculado a ojo. Si no se verifica acá, no se
verifica nunca.

## 6. Pasos

1. Confirmar que `task_01`–`task_08` están `APROBADO` o con su bloqueo documentado.
2. Correr la suite completa.
3. Verificar el bundle.
4. Ejecutar el recorrido de campo con la persona responsable.
5. Hacer la verificación numérica manual.
6. Registrar todo en `PRUEBA_CAMPO.md`, **incluyendo lo que no se pudo probar** por falta de datos
   reales (marcar `N/A`, no omitir).
7. Cualquier defecto → la tarea de origen vuelve a `EN CORRECCIÓN`. Al corregirse, **este recorrido
   se repite** sobre el estado nuevo.

## 7. Invariantes

- **Esta tarea no corrige código.**
- No se modifican suites preexistentes para que pasen.
- No se crean datos de prueba en la base real para cubrir un caso. Si no hay caso real, se marca
  `N/A` con la razón.
- No se omite un punto que falló. `PRUEBA_CAMPO.md` registra fallos y limitaciones.
- Nunca `service_role` ni secretos en la evidencia.
- Los conteos por empresa se registran disgregados. Precedente: la repetición de `task_08` anterior
  no los disgregó y quedó como salvedad explícita en su registro.

## 8. Casos de error

- Una suite preexistente falla → regresión. Se detiene y se reporta.
- Un archivo nuevo falta en el bundle → `EN CORRECCIÓN` de la tarea que lo introdujo.
- El agregado manual no coincide → defecto de cálculo. `task_04` o `task_05` a `EN CORRECCIÓN`.
  **Prioridad máxima**: es un número equivocado en pantalla.
- No existe un casco con `code_mismatch` en los datos disponibles → `N/A` con la razón. **No se
  fabrica uno.**
- Un error de consola aparece solo en móvil → se registra igual.

## 9. Aceptación

- Todas las suites verdes, ninguna preexistente modificada.
- Bundle verificado.
- Los 24 puntos del recorrido con resultado explícito (pasa / falla / `N/A` con razón).
- Verificación numérica manual documentada con los números.
- Conteos por empresa disgregados.
- `PRUEBA_CAMPO.md` completo.

## 10. Rollback

No aplica: la tarea no modifica código.

## 11. Handoff

Actualizar fila 09 con: conteo de cada suite, resultado del bundle, resumen del recorrido (cuántos
pasan, cuántos `N/A` y por qué), y la verificación numérica con sus números.

Si algo quedó sin probar, **debe decirse acá**. Un recorrido incompleto reportado como completo es
peor que uno incompleto reportado como tal.
