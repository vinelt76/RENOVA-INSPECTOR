# ADR-0008: Un servicio es una posición atendida

Supera parcialmente a [ADR-0007](0007-definicion-de-servicio-ejecutado.md): reemplaza su **D1** (un
servicio es una salida) y deja sin objeto su **D2** (`installation` como tipo sintético derivado).
Todo lo demás de ADR-0007 —D3 a D14— sigue vigente.

Detalle de la fase: `tasks_servicios/PLAN_PAREO.md`. Evidencia:
`tasks_servicios/REVISION_FINAL_PAREO.md`. Lo que quedó fuera con su razonamiento:
`tasks_servicios/FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`.

## Contexto

ADR-0007 definió el servicio como una salida porque era lo único que llevaba tipo por constraint
(`tire_movement_executions_reason_by_direction`: la salida exige `movement_reason`, el ingreso lo
prohíbe). Esa decisión era correcta **dado lo que la app capturaba**.

El problema apareció al mirar la planilla real de la empresa (`app movimientos/Untitled.jpg`), que
es la fuente del proceso. Su estructura ancla cada fila en `BUS` + `POS`:

```
BUS | POS || SALIDA DE NEUMÁTICO || DESTINO || INGRESO DE NEUMÁTICO
```

Una fila es **una posición atendida**: el neumático que sale con su destino, y el que entra. Los
siete destinos del papel —Reparación, Retén, Reclamo, Rotación, Scrap, Reencauche, Balanceo— son
exactamente los siete valores de `tire_movement_reason`. El enum se derivó de esa planilla; la
unidad de conteo no.

## Decisión

### 1. Un servicio es una posición atendida (supera D1)

**Un servicio = una posición de una unidad, con el neumático que sale y el que entra.** Un servicio
son dos movimientos; el movimiento deja de ser la unidad y pasa a ser la mitad.

**Por qué.** Bajo D1 el mismo hecho físico se contaba distinto según el destino:

| hecho | bajo D1 | bajo esta decisión |
|---|---|---|
| scrap en P3 + reemplazo en P3 | **2** (`discard` + `installation` fantasma) | **1** |
| rotación P3↔P7 | **1** | **2** (una por posición) |

`v_tire_services` solo plegaba el ingreso cuando la salida previa era `rotation` (CTE
`exits_rotation`). Todo otro ingreso generaba fila propia. La asimetría no era una elección: era el
efecto de que solo las rotaciones tenían pareo.

**Consecuencia:** una rotación entre dos posiciones ahora cuenta **2**. Eso deroga con fecha el
criterio de campo de la Fase 1 —«una rotación produce una fila y no dos»— que se verificó como
criterio central el 2026-07-21.

### 2. La emisión debe cerrar la posición

El defecto no estaba en la vista: estaba en lo que el supervisor emitía.
`WEB/movimientos/supervisor-order-model.js` (`addRotation`) empujaba dos ítems —`exit@origen` +
`entry@destino`— que describen **un casco reubicándose**, no dos posiciones intercambiando.

Evidencia de producción, la única orden de rotación real que existía:

| seq | direction | reason | pos | casing |
|---|---|---|---|---|
| 1 | exit | rotation | **3** | CN16-0003 |
| 2 | entry | — | **7** | CN16-0003 |

Mismo casco. Después de ejecutarla, **P3 quedó vacía** y **el ocupante de P7 desapareció sin
registro de salida**. La otra orden real era un `exit` de `retention` en P1 sin ingreso alguno.
`validateOrderDraft` deduplicaba por `direction:position` pero no exigía que una salida tuviera
ingreso.

Ahora `addRotation(P3, P7)` emite cuatro ítems, y la completitud es condición de emisión.

### 3. Por qué NO hizo falta cambiar el esquema

Es el punto que más importa conservar, porque evita que alguien reabra una fase de esquema
innecesaria dentro de un año.

Se verificó, en modo lectura y antes de escribir nada, que si `addRotation` emitía
`exit@3, entry@3, exit@7, entry@7`, la vista **entonces vigente** ya producía 2 servicios pareados
en su misma posición, sin instalación fantasma y sin ningún casco sin registro de salida. **El pareo
estructural de la Fase 1 estaba bien diseñado**; fallaba lo que se le mandaba.

También se verificó que la app móvil no necesitaba cambios: `draftFromOrder` es
`order.request_items.map(newExecutionItem)`, `validateDraft` itera con `forEach` y `ExecutionScreen`
hace `draft.items.map(...)`. Nada asume un conteo. Con 4 ítems muestra 4 renglones.

Por eso la fase fue de **4 tareas y una sola migración de vista**, en vez de las 12 con columna
nueva, enum, validación en la RPC y app móvil que se plantearon primero. Ese plan descartado y su
razonamiento están en `FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`.

Lo único que sí exigió SQL fue generalizar el pareo a **cualquier** salida, y añadirle la condición
de **misma posición** —que la v1 no tenía, porque bajo su modelo las posiciones diferían por diseño—.
Sin esa condición el defecto vuelve disfrazado: un ingreso pareando con la salida de otra posición.

### 4. El origen se deriva, no se captura (deja sin objeto a D2)

El operario declara los datos del neumático que **sale** —RTD, marca, medida, diseño, condición— y su
observación. **No escribe de dónde viene el que entra**: sería pedirle un dato que el sistema ya
tiene.

`entry_origin_position` se deriva dentro de la orden por coincidencia de `casing_code` con una
salida. Si el casco que entra a P3 salió de P7 en la misma orden, el origen es P7.

**Por qué esto deja sin objeto a D2.** `installation` tenía que inventarse en la vista porque no
había ningún dato que dijera qué era un ingreso. Con el par explícito, un ingreso plegado ya no
genera fila: `installation` queda solo para el ingreso que realmente no reemplaza nada —un montaje
sobre posición vacía—, que es un hecho real y no una derivación de conveniencia.

### 5. El límite de esa derivación, declarado y no disimulado

Cuando el casco que entra **no** salió en esa orden, viene de afuera: de retén, de reparación, de
reencauche, o es nuevo. Eso exige el **historial del casco**, no la orden.

`entry_origin_position` queda **NULL** y la pantalla muestra `ORIGEN NO DETERMINADO`. No se infiere.
Es la misma lógica que ADR-0005 aplica a los cascos sin `code`: no se genera un dato falso para algo
que el backend no puede resolver.

Derivar el origen externo es **el mismo problema que la reconciliación** que ADR-0007 dejó como
limitación aceptada (`reconciliation_status` sigue `pending` al 100 %). Son la misma consulta
mirada desde dos lados, y por eso van juntas en una fase futura o en ninguna.

### 6. La ausencia de reemplazo se declara, no se omite

Una salida a retén sin reemplazo inmediato es un caso real. Se admite, pero el supervisor tiene que
declararla: la clave `without_entry` en el ítem. Por descuido ya no se puede.

**Por qué no un CHECK en la base.** Un CHECK duro no elimina el caso: hace que alguien invente un
código para que el formulario deje avanzar, y un dato inventado es peor que una ausencia declarada.
La regla vive en la validación, donde puede ofrecer una salida honesta.

**Por qué no una columna.** `create_tire_movement_order` valida `direction`/`position`/`reason` e
**ignora las claves extra**, guardando el payload verbatim en `request_items`. La declaración viaja
sin tocar esquema ni RPC. Es deuda reconocida: está registrada en `knowledge/ai/10` como una
convención de payload que debería ser un dato.

## Qué NO cambia

- **D5 / ADR-0005**: Servicios sigue sin ser objeto navegable. Sin `servicio.html?id=`, sin
  `kind:'service'`, fila no clicable.
- **D9**: pantalla de solo lectura, ningún camino a una RPC.
- **D3**: el pareo sigue siendo estructural, nunca textual. Ahora además es innecesario intentarlo
  por texto.
- **D6** (normalización en SQL), **D8** (no filtrar `QA-TEST`), **D10** (límite con banner),
  **D11** (`America/Lima`), **D12**, **D13**, **D14**.
- **La limitación aceptada de ADR-0007**: los servicios siguen sin reconciliarse contra cascos.
  Servicios mide actividad declarada, no consumo ni vida útil.

## Consecuencias

- Cualquier serie histórica de «servicios» anterior a esta fase **no es comparable** con las
  posteriores. La unidad cambió.
- Las filas capturadas con el modelo viejo no parean, porque sus posiciones no coinciden: producen
  la salida como `not_paired` más una `installation`. Es fiel a cómo se capturaron y **no se les
  inventa un par**.
- El nivel 2 de pareo inferido sigue existiendo y ahora rankea por `(orden, posición)`. Con la
  emisión correcta casi no debería activarse; si aparece `inferred` sobre datos reales, significa
  que la emisión se rompió y hay que mirar aguas arriba, no relajar la vista.
- Los servicios sin desmontaje —presión, torque, alineación— siguen sin modelo. Esta fase **no los
  resuelve, pero deja de bloquearlos**: al ser el servicio una posición atendida y no una salida, el
  concepto admite después un servicio sin par.

## Revisión si...

- Aparece un servicio que no implica salida ni ingreso (inflado, alineación, torque): esta decisión
  deja de cubrir el dominio y hace falta un supertipo, **no** un valor más en el enum.
- El negocio empieza a facturar o reportar **por orden**: se agrega un segundo nivel de agregación
  sobre esta decisión, no se cambia la unidad.
- Aparece un reconciliador: el origen externo pasa a ser derivable y la limitación de ADR-0007 deja
  de aplicar.
- `rotation_pairing` devuelve `inferred` sobre datos reales: la emisión perdió la adyacencia del par
  y hay que investigarla **antes** de seguir publicando la métrica.
- La rotación de tres o más posiciones se vuelve un requisito: hoy `addRotation` toma dos y el MVP
  cubre buses 2-4 y 2-4-2.
