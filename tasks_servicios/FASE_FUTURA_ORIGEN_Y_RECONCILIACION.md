# FASE FUTURA — Origen externo y reconciliación

> **No es una fase aprobada.** Es el alcance que se sacó deliberadamente de la Fase 2 al descubrir
> que el defecto central no necesitaba cambios de esquema. Se guarda con su razonamiento para que,
> si algún día hace falta, no haya que redescubrirlo.

## 1. Por qué se sacó de la Fase 2

El plan original de la Fase 2 tenía 12 tareas e incluía una columna de origen capturada por el
operario, un enum nuevo, validación de completitud en `complete_tire_movement_order` y cambios en la
app móvil.

Se redujo a 4 al verificar dos cosas:

1. **El defecto central no necesita esquema.** Simulado en modo lectura contra la lógica real de la
   vista: si `addRotation` emite 4 ítems (`exit@3, entry@3, exit@7, entry@7`) en vez de 2, la vista
   **actual** produce 2 servicios, cada uno pareado en su misma posición, sin `installation`
   fantasma y sin ningún casco sin registro de salida. El pareo estructural de la Fase 1 estaba bien
   diseñado; lo que estaba mal era lo que el supervisor le mandaba.

2. **El origen no se captura: se deriva.** Si el casco que entra a P3 es el que salió de P7 en la
   misma orden, el origen es P7 — un `join` por `casing_code` dentro de la orden. Pedirle al operario
   que escriba el origen es pedirle un dato que el sistema ya tiene. El operario declara los datos
   del neumático que **sale** (RTD, marca, medida, diseño, condición) y su observación; el resto se
   infiere.

También se comprobó que **la app móvil no necesitaba ningún cambio**: `draftFromOrder` es
`order.request_items.map(newExecutionItem)`, genérico sobre N ítems. Eso eliminó el riesgo más caro
del plan original —dejar a los operarios sin poder cerrar órdenes en un taller— porque nada de lo que
ellos usan cambia.

## 2. Lo que sí queda sin resolver

**Origen externo.** Cuando el casco que entra **no** salió en esa orden, viene de afuera: de retén, de
reparación, de reencauche, o es nuevo. La Fase 2 lo marca como *indeterminado* y no finge saberlo.

Derivarlo es posible, pero requiere el **historial del casco**, no la orden:

- último movimiento del casco con `direction='exit'` y su `movement_reason` ⇒ de dónde vuelve
  (`retention` → de retén, `repair` → de reparación, `retread` → de reencauche);
- sin movimiento previo y `condition = 'N'` ⇒ neumático nuevo;
- `tire_life_cycles` y `tire_installations` para el caso de un casco con vida previa fuera del
  sistema de movimientos.

**Esto es el mismo problema que la reconciliación.** `reconciliation_status` está `pending` al 100 %
desde la Fase 1 porque no existe un reconciliador que ligue una ejecución con
`tire_casings` / `tire_life_cycles` / `tire_installations`. Derivar el origen externo y reconciliar
son la misma consulta mirada desde dos lados. Hacerlas por separado sería trabajo duplicado.

## 3. Cuándo abrir esta fase

El disparador es un número concreto que deja `task_12`: **cuántas entradas quedaron con origen
indeterminado**. Si es marginal, no hay caso. Si es la mayoría, la pantalla de Servicios está
mostrando un campo vacío la mayor parte del tiempo y sí lo hay.

Otros disparadores:

- el negocio pide medir **consumo o vida útil por servicio** — imposible sin reconciliación;
- el negocio pide distinguir «instalé un neumático nuevo» de «monté uno de retén» en un reporte;
- aparece la necesidad de costear por kilómetro.

## 4. Alcance tentativo, si se abre

1. **Reconciliador**: ligar cada ejecución con su casco, ciclo e instalación. Es la deuda de
   ADR-0007 §Limitación conocida.
2. **Origen externo derivado** del historial reconciliado, como columna de la vista.
3. **`request_item_index`** escrito por `complete_tire_movement_order`, más la validación
   `jsonb_array_length(p_items) = jsonb_array_length(request_items)`. Convierte el pareo de propiedad
   emergente del cliente en dato de la base y elimina el nivel 2 inferido (`AUDIT.md` §6.1).
4. **Ausencia declarada como dato**, si la Fase 2 la resolvió con una convención de texto.
5. **Validación de completitud en la RPC**, para que el servidor garantice lo que hoy solo garantiza
   el cliente.

**Advertencia de orden**, heredada del plan original y que sigue valiendo: si alguna vez se agrega
validación de completitud a `complete_tire_movement_order`, **no se aplica al remoto antes de que la
app móvil sepa satisfacerla**. Aplicar una validación que la app no puede cumplir deja a los
operarios sin poder cerrar órdenes en campo.

## 5. Lo que NO va en esta fase

**Servicios que no implican desmontaje** —presión, torque, alineación— y su relación con las
inspecciones. Es un problema de modelado distinto: exige decidir si «servicio» es un supertipo del
que el movimiento es un caso, o si son dos conceptos que no deben mezclarse. Las inspecciones ya
viven en su propia cadena (`inspections` / `inspection_measurements`).

La Fase 2 **no lo resuelve, pero deja de bloquearlo**: al hacer del servicio una posición atendida y
no una salida, el concepto queda con la forma correcta para admitir después un servicio sin par.
