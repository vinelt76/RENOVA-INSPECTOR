# PLAN — Fase 2: el servicio es una posición atendida

> La Fase 1 (`task_01`–`task_09`) entregó la **superficie de lectura** sobre lo que la app capturaba.
> Esta fase corrige **qué se emite y cómo se cuenta**. Son 4 tareas y **no toca ninguna tabla**.

## 1. El problema, con evidencia

La planilla real de la empresa (`app movimientos/Untitled.jpg`) ancla cada fila en `BUS`+`POS`: una
fila es **una posición atendida**, con el neumático que sale y su destino, y el que entra. Los siete
destinos del papel —Reparación, Retén, Reclamo, Rotación, Scrap, Reencauche, Balanceo— son
exactamente los siete valores de `tire_movement_reason`. El enum se derivó de esa planilla.

**1.1 — Una rotación no cierra físicamente.** `WEB/movimientos/supervisor-order-model.js:130`
(`addRotation`) emite dos ítems: `exit@origen` + `entry@destino`. Eso describe **un casco
reubicándose**, no dos posiciones intercambiando. La única orden real de producción lo confirma:

| seq | direction | reason | pos | casing |
|---|---|---|---|---|
| 1 | exit | rotation | **3** | CN16-0003 |
| 2 | entry | — | **7** | CN16-0003 |

Después de esa orden **P3 quedó vacía** y **lo que estaba en P7 desapareció sin registro de salida**.
La otra orden real es peor: un solo `exit` de `retention` en P1, sin entrada. `validateOrderDraft`
deduplica por `direction:position` pero **no exige** que una salida tenga entrada.

**1.2 — El conteo es asimétrico.** `v_tire_services` solo pliega la entrada cuando la salida previa
es `rotation` (CTE `exits_rotation`). Entonces un scrap con reemplazo en P3 produce **2 servicios**
(`discard` + una `installation` fantasma) y una rotación produce **1**, para el mismo hecho físico:
una posición atendida.

## 2. Lo que esta fase decide

**Un servicio es una posición atendida**: un neumático que sale con su destino y uno que entra.

Esto reabre **D1** de ADR-0007 («un servicio es una salida») y matiza **D2**. Se registra en ADR-0008,
no en un commit: el propio ADR-0007 §Consecuencias exige reabrirlo cuando cambia la unidad de conteo.

## 3. Por qué NO hace falta cambiar el esquema

Verificado en modo lectura, simulando la lógica real de la vista contra ítems sintéticos:

Si `addRotation` emite **4 ítems** —`exit@3 rot, entry@3, exit@7 rot, entry@7`— la vista **actual**
produce:

| seq | dir | pos | tipo | pareado con | en la vista |
|---|---|---|---|---|---|
| 1 | exit | 3 | rotation | seq 2 → **P3** | **cuenta** |
| 2 | entry | 3 | — | — | plegada en el par |
| 3 | exit | 7 | rotation | seq 4 → **P7** | **cuenta** |
| 4 | entry | 7 | — | — | plegada en el par |

Dos servicios, las dos posiciones ocupadas, ningún casco sin registro de salida, y `pair_position`
deja de decir «P3 → P7» (engañoso) para decir P3→P3 y P7→P7. **El pareo estructural de la Fase 1
estaba bien diseñado; lo que estaba mal era lo que el supervisor le mandaba.**

Y la app móvil **no necesita ningún cambio**: `draftFromOrder` es
`order.request_items.map(newExecutionItem)`, genérico sobre N ítems. Con 4 ítems muestra 4 renglones.

Queda una sola cosa que sí requiere tocar SQL, y es la vista, no una tabla: generalizar el pareo para
que **cualquier** salida pliegue la entrada de su misma posición, no solo `rotation`.

## 4. El origen se deriva, no se captura

El operario declara los datos del neumático que **sale** —RTD, marca, medida, diseño, condición— y su
observación. **No escribe de dónde viene el que entra**: pedirle eso sería pedirle un dato que el
sistema ya tiene.

- Si el casco que entra a P3 **salió de P7 en la misma orden**, el origen es P7. Es un `join` por
  `casing_code` dentro de la orden. Lo resuelve `task_11`.
- Si el casco **no** salió en esa orden, viene de afuera —retén, reparación, nuevo—. Eso requiere el
  **historial del casco**, que es el mismo problema que la reconciliación pendiente de ADR-0007. La
  vista lo marca **indeterminado** y no finge saberlo. Queda en
  `FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`.

## 5. Alcance

**Dentro:** la emisión del par completo por posición; la validación de completitud en el supervisor;
el pareo general en la vista; el origen derivado dentro de la orden; la pantalla y su párrafo de
alcance; ADR-0008 y el barrido de afirmaciones vencidas.

**Fuera, con nombre** (todo en `FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`): origen externo,
reconciliación contra cascos, `request_item_index` y validación de completitud en la RPC, servicios
sin desmontaje (presión, torque, alineación), paginación (D10), shell de navegación (D12).

## 6. Definición de terminado

- Una rotación real, emitida y ejecutada de punta a punta, deja **las dos posiciones ocupadas** y
  ningún casco sin registro de salida.
- La app móvil maneja los 4 renglones **sin cambios**.
- Un scrap con reemplazo produce **1 servicio**, no 2: la asimetría desapareció.
- El origen derivado es correcto cuando el casco salió en la misma orden, y **nulo** cuando no.
- Una salida sin entrada no se puede emitir por descuido; con ausencia declarada, sí.
- Las 2 filas heredadas siguen visibles y sin par inventado.
- El párrafo de alcance de `servicios.html` deja de describir el modelo viejo.
- ADR-0008 registrado; ADR-0007 marcado parcialmente superado sin reescribir su cuerpo.
- Suites nuevas verdes y existentes verdes **sin modificación**; los cambios que la decisión de
  conteo obligue, justificados uno por uno.
- Evidencia local y de campo separadas.
- `npm run docs:check` y `git diff --check` verdes.

## 7. Riesgo y rollback

El riesgo de esta fase es **bajo por construcción**: ninguna tabla, ningún enum, ninguna RPC, ninguna
policy, ningún cambio en la app que usan los operarios.

- `task_10` y `task_12`–`task_13`: `git checkout`.
- `task_11`: `create or replace view` recreando la v1 desde
  `20260721130000_tire_services_view.sql`, más `git checkout` de los archivos web.

No hay punto sin retorno. Esa es la diferencia principal con el plan de 12 tareas que se descartó, y
la razón por la que se descartó.
