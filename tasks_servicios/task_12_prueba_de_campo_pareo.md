# task_12 — Suites y prueba de campo

## 1. Propietario

**CODEX + USUARIO.** La prueba de campo la ejecuta una persona con datos reales.

## 2. Objetivo y resultado observable

`PRUEBA_CAMPO_PAREO.md` con el resultado punto por punto, y la evidencia de que el defecto que
originó la fase ya no ocurre.

El criterio central, del que depende que la fase cierre:

> **Una rotación real, emitida y ejecutada de punta a punta, deja las dos posiciones ocupadas y
> ningún casco sin registro de salida.**

Eso es exactamente lo que hoy no pasa: la orden `71f7aaba…` dejó P3 vacía y el ocupante de P7 sin
registro.

## 3. Dependencias y bloqueos

Depende de `task_11`. Bloquea `task_13`.

## 4. Archivos exclusivos

- `tasks_servicios/PRUEBA_CAMPO_PAREO.md`

Solo lectura: todo lo demás. **Esta tarea no corrige**: encuentra y registra.

## 5. Contratos

`PLAN_PAREO.md` §6 es la definición de terminado. Un punto que falla no se reinterpreta como
aprobado.

## 6. Pasos

### 6.1 Suites locales

Ejecutar y registrar el conteo de cada una: `servicios`, `movimientos`, `shared`, `inventario`,
`buscador`, `neumaticos`, la suite del proyecto móvil y la suite SQL de la Fase 1. Cualquier suite
modificada durante la fase se lista con su justificación individual.

### 6.2 Prueba de campo, con datos reales

Una persona, una unidad real. Cada punto se marca `OK`, `FALLA` o `N/A` **con motivo**:

1. Emitir una **rotación entre dos posiciones** desde el supervisor web.
2. Verificar en la base que `request_items` tiene **4 ítems**, agrupados por posición y con cada
   entrada inmediatamente después de su salida.
3. Tomar la orden desde la app móvil. Deben aparecer **2 tarjetas de servicio**, una por posición,
   y dentro de cada una los grupos `SALE` y `ENTRA`. El borrador conserva 4 ítems técnicos 1:1.
4. Completar las 4 capturas técnicas dentro de las 2 tarjetas y cerrar la orden.
5. **Verificar el estado físico en la base**: las dos posiciones quedan ocupadas y ningún casco quedó
   sin registro de salida. Consultar las tablas, no confiar en la pantalla.
6. Pantalla de Servicios: la rotación produce **2 servicios**, cada uno con su par en la **misma
   posición**. Ninguna `installation` fantasma.
7. Verificar el **origen derivado**: el casco que entró a P3 se muestra como proveniente de P7, y
   viceversa.
8. Emitir y ejecutar un **scrap con reemplazo** en una posición. Verificar que produce **1 servicio**,
   no 2. Es la comprobación de que la asimetría desapareció.
9. **Intentar emitir una salida sin entrada**: el supervisor no valida y nombra la posición.
10. **Salida con ausencia declarada**: sí valida, se ejecuta y se ve en la pantalla.
11. Neumático con **código ilegible** al entrar: se captura, el origen queda indeterminado y **no se
    inventa**.
12. Filas heredadas (`CN16-0003`): siguen visibles, sin par, sin origen, sin romper agregaciones.
13. **Corte de red durante la captura**: nada se pierde; al volver, se envía y no duplica.
14. Reintento de envío sobre orden ya cerrada: no duplica.
15. Aislamiento: una cuenta de otra empresa no ve nada de esta orden, y **sí ve lo suyo**.
16. Rol `inspector`: mensaje de rol, no «sin datos».
17. Teclado completo, 390×844 y escritorio sin overflow, `prefers-reduced-motion`.
18. Consola limpia en las tres superficies, sin secretos ni errores.

### 6.3 Registrar sin maquillar

Cada `FALLA` con su evidencia. Cada `N/A` con el motivo por el que no se pudo probar y qué cobertura
lo suple. La Fase 1 cerró con cinco `N/A` registrados así y fue lo correcto.

## 7. Invariantes

- **Datos reales, no fixture**, en la prueba de campo. Un fixture prueba el render, no que el proceso
  funcione con una persona apurada en un taller.
- **Evidencia local y de campo separadas.** Mezclarlas hace parecer verificado lo que solo está
  testeado.
- **No corregir en esta tarea.** Un hallazgo vuelve a la tarea que lo causó.
- **Un punto que falla no se reinterpreta.** Si afecta `PLAN_PAREO.md` §6, la fase no cierra.
- No usar `service_role` ni exponer datos reales en logs o capturas.

## 8. Casos de error

- **Si el punto 5 falla**, la fase **no cierra**. Es el defecto que la fase existe para corregir.
- **Si el punto 3 falla** —la app no conserva las 4 capturas o no forma los 2 servicios—, se detiene
  todo: se rompió el contrato de ejecución o su interpretación para el operario.
- **Si el punto 8 muestra que la asimetría persiste**, volver a `task_11`.
- **Si el punto 13 falla**, es una regresión de la invariante offline-first de `CLAUDE.md`. Bloquea;
  no es deuda.
- **Si un punto no se puede probar** por falta de acceso, se marca `N/A` con motivo y se declara qué
  lo cubre. No se marca `OK`.

## 9. Aceptación

- Todas las suites verdes, con conteos registrados; las modificadas, justificadas.
- Los 18 puntos de §6.2 con resultado explícito.
- Los puntos **3, 5 y 8** en `OK` — sin ellos la fase no cierra.
- Los `N/A` con motivo y cobertura alternativa.
- Evidencia local y de campo separadas en el documento.
- Ninguna corrección aplicada desde esta tarea.

## 10. Rollback

`git checkout tasks_servicios/PRUEBA_CAMPO_PAREO.md`.

Los datos reales que deje la prueba **no se borran**: quedan como el primer servicio pareado real,
registrados en el documento.

## 11. Handoff

Actualizar la fila 12 de `STATE.md` con: los conteos de todas las suites, el resultado de los 18
puntos, los `N/A` con motivo, cuántas entradas resolvieron origen y cuántas quedaron indeterminadas,
y los hallazgos que vuelven a otra tarea.

Si algún punto falló y el humano decide aceptarlo como deuda, se registra `APROBADO CON DEUDA` con la
decisión, la fecha y el remedio nombrado —como se hizo con `task_08`—. Lo que no se hace es marcarlo
`APROBADO` a secas.
