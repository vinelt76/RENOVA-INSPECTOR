# task_10 — La rotación emite el par completo por posición

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Una rotación entre dos posiciones se emite como lo que físicamente es: **las dos posiciones
atendidas**, cada una con su salida y su entrada. Y el supervisor no puede emitir una orden que deje
una posición sin resolver.

Hoy `addRotation(P3, P7)` empuja dos ítems —`exit@3 rotation` + `entry@7`— que describen **un casco
reubicándose**. El resultado, verificado en la única orden real de producción: P3 queda vacía y lo
que estaba en P7 nunca se registró como salido.

Después de esta tarea, `addRotation(P3, P7)` empuja cuatro:

```text
exit@3  reason=rotation      ← sale CASCO-A de P3
entry@3                      ← entra a P3 el que salió de P7
exit@7  reason=rotation      ← sale CASCO-B de P7
entry@7                      ← entra a P7 el que salió de P3
```

## 3. Dependencias y bloqueos

Ninguna. Abre la fase. Bloquea `task_11`.

**Esta tarea es de cliente puro**: no toca esquema, ni RPC, ni la app móvil, ni la vista.

## 4. Archivos exclusivos

- `WEB/movimientos/supervisor-order-model.js`
- `WEB/movimientos/supervisor-orders-ui.js`
- `WEB/movimientos/__tests__/supervisor-order-model.test.js`

Solo lectura: `app movimientos/Untitled.jpg` (la planilla), `app movimientos/src/lib/model.ts`,
`supabase/migrations/20260720012248_operator_movement_orders.sql`, `DESIGN.md`.

## 5. Contratos

La planilla real (`app movimientos/Untitled.jpg`) es la referencia del proceso: **una fila = una
posición atendida**, con `BUS`+`POS` una sola vez, luego la salida con su destino y el ingreso.

Restricción heredada que hay que preservar, verificada en `AUDIT.md` §6: `request_items` y las
ejecuciones son **1:1 y en el mismo orden**, porque `draftFromOrder` hace
`order.request_items.map(newExecutionItem)` y la RPC asigna `sequence` con un contador. Emitir 4
ítems produce 4 ejecuciones en ese orden. Romper esa propiedad rompe el pareo de la vista.

## 6. Pasos

1. **`addRotation`**: emitir los cuatro ítems, agrupados por posición y en el orden
   `exit@origen, entry@origen, exit@destino, entry@destino`. **El orden importa**: la vista parea la
   entrada con la salida en `sequence - 1`, así que cada entrada debe ir inmediatamente después de la
   salida de su misma posición.
2. **`validateOrderDraft`**: agregar la validación de completitud — toda salida tiene una entrada en
   **la misma posición**. Hoy deduplica por `direction:position` pero no exige el par. El mensaje
   nombra la posición concreta, no un error genérico de orden.
3. **Permitir la ausencia declarada.** Una salida a retén sin reemplazo inmediato es un caso real. Se
   admite, pero el supervisor tiene que declararlo explícitamente, no omitirlo por descuido. Definir
   el mecanismo más simple que funcione con el esquema actual (una nota u observación reconocible
   sirve; **no** se agrega una columna en esta fase).
4. **`addOrderItem`**: al agregar una salida suelta, ofrecer resolver su entrada en el momento, en vez
   de que el supervisor descubra el error recién al validar.
5. **UI de emisión**: el par se ve como par. Tomar la agrupación de la planilla —posición una vez,
   luego salida, destino, ingreso—: es la forma que la gente de la empresa ya sabe leer.
6. **Suite**: rotación de dos posiciones produce 4 ítems en el orden correcto; salida sin entrada no
   valida; salida sin entrada con ausencia declarada sí valida; `orderRpcPayload` conserva el orden.
7. Texto visible en **español neutro peruano**, sin voseo.

## 7. Invariantes

- **Cero cambios de esquema, RPC, app móvil y vista.** Si algo parece exigirlos, detener: el punto de
  esta fase es que no hacen falta.
- **Preservar el 1:1 y el orden** con `request_items`. Es lo que hace verificable el pareo.
- **La entrada de cada posición va inmediatamente después de su salida.** Si se emiten agrupadas de
  otra forma (todas las salidas y luego todas las entradas), la vista actual **no** las parea y la
  tarea no cumple su objetivo.
- No crear un glosario nuevo: se reutiliza `MOVEMENT_REASONS`.
- No crear una segunda primitiva de filtrado ni un tercer sistema de modal.
- **Ninguna suite existente se modifica para que pase.** Si `movimientos` (176 tests) rompe, algo
  cambió de comportamiento y se investiga.

## 8. Casos de error

- **Si la rotación de tres o más posiciones** (P3→P7→P11→P3) aparece como requisito, detener: hoy
  `addRotation` toma dos posiciones y el MVP cubre buses 2-4 y 2-4-2. Se registra como pendiente, no
  se improvisa un ciclo.
- **Si la validación empieza a rechazar órdenes legítimas** que hoy se emiten sin entrada, ese es el
  caso del paso 3: se ofrece la ausencia declarada, no se bloquea al supervisor.
- **Si la UI no puede mostrar el par sin rediseñarse**, acordar el patrón antes de improvisarlo. Un
  patrón de captura nuevo sin documentar es deuda de diseño.
- Si la suite de movimientos requiere cambios, listarlos uno por uno con su justificación.

## 9. Aceptación

- `addRotation(3, 7)` produce exactamente 4 ítems, en el orden de §2.
- Una salida sin entrada en la misma posición **no valida**, con la posición en el mensaje.
- Una salida con ausencia declarada **sí valida**.
- `orderRpcPayload` conserva orden y longitud.
- Suite de `movimientos` verde; cambios de test justificados uno por uno.
- Suites `shared`, `inventario`, `buscador`, `neumaticos`, `servicios` verdes **sin modificación**.
- Smoke en navegador: emitir una rotación real, consola limpia, 390×844 y escritorio sin overflow,
  teclado completo.
- `node --check` y `git diff --check` limpios.

## 10. Rollback

`git checkout` de los tres archivos. Nada aplicado fuera del repositorio, nada en producción.

## 11. Handoff

Actualizar la fila 10 de `STATE.md` con: la forma exacta del `request_items` de una rotación, los
casos de validación cubiertos, el mecanismo elegido para la ausencia declarada, los conteos de todas
las suites y el resultado del smoke.

Dejar escrita la forma del `request_items` para `task_11`: es lo que la vista va a parear.
