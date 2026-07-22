# task_08 — Suite integral y smoke autenticado

## 1. Propietario

**CODEX + USUARIO.** El agente corre suites y prepara el recorrido; la persona responsable ejecuta el
flujo real y firma.

## 2. Objetivo y resultado observable

Evidencia de que la fase funciona de punta a punta con datos reales, y de que no rompió nada.

**La prueba que decide la fase es una sola:** emitir una orden con rotación, ejecutarla en la app del
operario, y comprobar que en Servicios aparece **una** fila, no dos.

## 3. Dependencias y bloqueos

Depende de `task_07`. Bloquea `task_09`.

## 4. Archivos exclusivos

- `tasks_servicios/PRUEBA_CAMPO.md` (se crea en esta tarea)

Solo lectura: todo lo demás.

## 5. Contratos

`PLAN.md` §10 (definición de terminado). `CONTRATOS_DATOS.md` §1 (invariante de conteo).

## 6. Pasos

1. Correr todas las suites y registrar conteos.
2. Verificar el bundle estático.
3. Preparar el recorrido de campo en `PRUEBA_CAMPO.md`, numerado, para que la persona responsable lo
   ejecute sin interpretar.
4. Acompañar la ejecución del flujo real.
5. Registrar los resultados con números, no con «correcto».

## 7. Invariantes

- **No se modifica ninguna suite existente** para que pase (regla de bloqueo 5 de `STATE.md`).
- La evidencia de campo se registra por separado de la evidencia local. Son cosas distintas y
  mezclarlas hace que un smoke no ejecutado parezca ejecutado.
- Si un punto no se pudo probar (no hay datos del caso), se registra como **N/A con el motivo**. No
  se crean datos artificiales en producción para completar un checklist.
- Sin secretos, tokens ni filas completas en logs o capturas.

## 8. Casos de error

- Si la rotación aparece como dos filas, la fase **no cierra**: vuelve a `task_02`. Es el defecto que
  toda la fase existe para evitar.
- Si una suite existente falla, regla de bloqueo 5.
- Si el bundle no contiene `servicios/`, vuelve a `task_07` (regla 6).
- Si aparece un caso real de `rotation_pairing='inferred'` que `task_04` no había detectado,
  registrarlo y escalar antes de firmar.

## 9. Aceptación

### 9.1 Suites (agente)

| Suite | Conteo |
|---|---|
| `WEB/servicios` | nueva, debe pasar |
| `WEB/shared` | sin modificar |
| `WEB/buscador` | sin modificar |
| `WEB/neumaticos` | sin modificar |
| `WEB/inventario` | sin modificar |
| `WEB/movimientos` | sin modificar |

Más: `supabase/tests/tire_services_view.test.sql` → `TESTS_PASSED`; `git diff --check` limpio;
bundle con `servicios.html` y `servicios/*.{js,css}` y **sin** `package.json` ni `__tests__/`.

### 9.2 Flujo real de punta a punta (persona responsable)

**El núcleo:**

1. Emitir una orden con rotación P3→P7 desde el modo movimientos de `Inspecciones por unidad.html`.
2. Tomarla y cerrarla en `app movimientos/`, llenando los campos.
3. Recargar `servicios.html`.
4. **Aparece una sola fila `ROTACIÓN · P3 → P7`. No dos.** El tile SERVICIOS subió exactamente en 1.

**El resto:**

5. Una orden con un `entry` suelto produce una fila `INSTALACIÓN`.
6. Una salida `discard` produce el **único** segmento naranja de la barra.
7. Una orden mixta (scrap + reencauche + rotación) produce el desglose correcto.
8. La barra suma 100.0 y su leyenda cuadra con el tile de total.
9. Filtrar por tipo, por unidad y por mes: los tiles y la lista cambian juntos.
10. URL compartida reproduce el estado; Atrás/Adelante funcionan.
11. Clic en placa abre la unidad; clic en código abre el historial.
12. Un código no registrado se muestra **sin enlace**, con `SIN HISTORIAL`.
13. Con usuario `inspector`: mensaje de rol, **no** «sin datos».
14. Con una empresa sin servicios: cuatro tiles en `—`, sin barra, mensaje explícito.
15. Bajar `SERVICES_FETCH_LIMIT` a 5: aparece el banner de truncado. **Restaurar.**
16. Aislamiento: con sesión de empresa A no se ve ninguna fila de B, y viceversa. Registrar los dos
    conteos.
17. Realtime: cerrar una orden en otra pestaña actualiza la lista sin recargar.
18. `Ctrl/Cmd+K` abre el buscador desde Servicios; dentro del campo de filtro no lo captura.
19. Teclado completo en el filter-bar.
20. 390×844 y escritorio sin overflow horizontal.
21. `prefers-reduced-motion: reduce`: sin transiciones.
22. **Contraste medido**: el texto de la leyenda de los tonos neutros oscuros (`#243B52`, `#1B2D42`)
    contra `--field-dark` alcanza ≥4.5:1. El swatch puede ser oscuro; el texto no.
    Si no pasa, aclarar el texto de la leyenda — **no** el swatch, que rompería la rampa.
23. Consola sin errores y sin secretos.
24. Navegar a Servicios desde las 8 pantallas y volver.

## 10. Rollback

Ninguno: esta tarea no modifica código. Si algo falla, el rollback es el de la tarea culpable.

## 11. Handoff

`PRUEBA_CAMPO.md` con los 24 puntos, su resultado y los números concretos. Actualizar la fila 08 de
`STATE.md` con el resumen y con los conteos de **cada** suite.

Registrar explícitamente qué puntos quedaron **N/A y por qué**. Un checklist con todo en verde donde
tres puntos no se probaron es peor evidencia que uno con tres N/A honestos.
