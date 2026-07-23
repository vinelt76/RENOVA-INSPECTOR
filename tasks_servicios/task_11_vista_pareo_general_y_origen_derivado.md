# task_11 — Vista: pareo general por posición y origen derivado

## 1. Propietario

**CLAUDE**, con revisión de `sync-migration-reviewer`.

## 2. Objetivo y resultado observable

Dos correcciones en `v_tire_services`, ambas **sin tocar ninguna tabla**:

1. **Pareo general.** Hoy la vista solo pliega la entrada cuando la salida previa es
   `movement_reason = 'rotation'` (CTE `exits_rotation`). Por eso un scrap con reemplazo en P3
   produce **2 servicios** (`discard` + `installation` fantasma) y una rotación produce 1, para el
   mismo hecho físico: una posición atendida. Se generaliza el pareo a **cualquier** salida cuya
   entrada esté en la misma posición.

2. **Origen derivado, no capturado.** El operario no declara de dónde viene el neumático que entra:
   se deriva. Si el casco que entra a P3 es el que salió de P7 **en la misma orden**, el origen es
   `P7`. Ese es el caso que la lógica puede resolver sola, y es exactamente lo que la planilla
   escribe a mano hoy.

## 3. Dependencias y bloqueos

Depende de `task_10`: la vista parea lo que el supervisor emite, así que primero tiene que emitirse
bien. Bloquea `task_12`.

## 4. Archivos exclusivos

- `supabase/migrations/<timestamp>_tire_services_view_pairing.sql`
- `WEB/servicios/servicios-model.js`
- `WEB/servicios/servicios-controller.js`
- `WEB/servicios/data.js`
- `WEB/servicios.html`
- `WEB/servicios/__tests__/servicios-model.test.js`
- `WEB/servicios/__tests__/data.test.js`

Solo lectura: `supabase/migrations/20260721130000_tire_services_view.sql`, `CONTRATOS_DATOS.md`,
`decisions/0007-definicion-de-servicio-ejecutado.md`, `DESIGN.md`.

## 5. Contratos

`CONTRATOS_DATOS.md` sigue vigente **salvo** en su §1 (definición de servicio e invariante de
conteo), que esta tarea modifica. La modificación se registra en `task_13` (ADR); esta tarea la
implementa y declara en el encabezado de la migración qué punto del contrato queda derogado.

Sigue vigente sin cambio: `security_invoker`, grants solo a `authenticated`, sin filtro de
`company_id`, `casing_exists` con código crudo para conservar el índice, `brand_key`/`size_key`
normalizados en SQL (D6), zona horaria `America/Lima` (D11), límite y banner de truncado (D10),
fila no clicable (D5, ADR-0005), pantalla de solo lectura (D9).

## 6. Pasos

1. **Generalizar el pareo.** Reemplazar `exits_rotation` por el conjunto de **todas** las salidas.
   La entrada pliega en su salida cuando: está en `sequence - 1`, la posición coincide, y la
   ejecución de salida existe. Conservar la verificación estructural contra `request_items` que ya
   tiene la vista — sigue siendo el mecanismo correcto, solo se le quita el filtro por motivo.

2. **Reconsiderar `rotation_pairing`.** Con `task_10` emitiendo el par completo y adyacente, el
   nivel 2 inferido casi no debería activarse. **No eliminar la columna todavía**: es lo que declara
   la calidad del pareo y permite detectar en producción si una orden se emitió mal. Renombrar su
   semántica si «rotation» deja de describirla, y documentarlo.

3. **Derivar el origen dentro de la orden.** Para cada entrada con `casing_code` no nulo, buscar en
   la **misma orden** una salida con el mismo `casing_code`. Si existe, el origen es la posición de
   esa salida. Exponerlo como columna nueva de la vista.

   Precisiones que no se pueden saltar:
   - `code_unreadable` ⇒ `casing_code` nulo ⇒ **no hay derivación**, y la columna queda nula. No se
     inventa.
   - Si el casco que entra **no** salió en esa orden, el origen es externo: viene de retén, de
     reparación o es nuevo. **Eso no se deriva en esta fase** — requiere el historial del casco, que
     es la fase futura (`FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`). La columna distingue «origen
     interno conocido» de «origen externo, sin determinar», y no finge saber lo que no sabe.
   - Comparar con el mismo `btrim` que ya usa `casing_exists`, para no introducir una segunda
     normalización.

4. **`installation` deja de aparecer donde había par.** Una entrada plegada ya no genera fila propia.
   Sigue siendo `installation` la entrada que realmente no cierra nada — un montaje sobre posición
   vacía. Eso es correcto y se conserva.

5. **Filas heredadas.** Las 2 ejecuciones de la Fase 1 (`exit@3` + `entry@7`, mismo casco) **no**
   parean bajo la regla nueva: las posiciones no coinciden. Van a producir `discard`/`rotation` sin
   par y una `installation`. Es el comportamiento correcto —refleja fielmente que se capturaron con
   el modelo viejo— y **no se corrige inventándoles un par**.

6. **Pantalla.** Reescribir el párrafo de alcance de `WEB/servicios.html`. Hoy dice *«Cada salida que
   registra un operario cuenta como un servicio. Una rotación se cuenta una sola vez, en su salida.»*
   Eso pasa a ser falso. Debe decir qué cuenta —una posición atendida— **y qué no cuenta**: no
   incluye trabajos sin desmontaje (presión, torque, alineación) ni las inspecciones.

7. **Mostrar el par**: el neumático que sale y el que entra, con el origen cuando se pudo derivar.
   Reusar los tokens y componentes existentes.

8. Suites de `servicios` actualizadas.

## 7. Invariantes

- **Cero cambios de tabla, enum, RPC o policy.** Solo `create or replace view`. Si algo parece
  exigir una tabla, detener: es la fase futura.
- **Prohibido filtrar `company_id`** en la vista o en el cliente: el aislamiento lo da la RLS.
- **Prohibido emparejar por el texto de `observations`** (D3, sigue vigente).
- **No inventar origen.** Sin código legible o sin salida correspondiente en la orden, la columna es
  nula y la pantalla lo muestra como indeterminado.
- Servicios sigue **sin ser objeto navegable** (D5) y la pantalla sigue **sin escritura** (D9).
- No filtrar `QA-TEST` (D8). Lo heredado se ve como es.
- Suites `shared`, `movimientos`, `inventario`, `buscador`, `neumaticos` **sin modificación**.

## 8. Casos de error

- **Si el pareo general produce duplicados**, el `left join` no está acotado. Es el error más
  probable de esta tarea, igual que lo fue en `task_02`.
- **Si una entrada parea con una salida de otra posición**, la condición de posición se perdió: eso
  reintroduce el defecto original con otra forma.
- **Si `rotation_pairing` empieza a devolver `inferred` sobre datos reales**, significa que `task_10`
  no está emitiendo el par adyacente. El problema está aguas arriba: no se relaja la vista.
- **Si el invariante de conteo no cuadra**, la definición no se está materializando. Vuelve al paso 1.

## 9. Aceptación

Verificación en SQL con datos reales y con fixtures revertidos:

- Una rotación de dos posiciones emitida por `task_10` produce **2 servicios**, cada uno con su par en
  **la misma posición**, y ninguna `installation` fantasma.
- Un scrap con reemplazo en una posición produce **1 servicio**, no 2. **Esta es la comprobación
  central de la tarea**: es la asimetría que originó la fase.
- Ningún `service_id` duplicado.
- El origen derivado es correcto cuando el casco salió en la misma orden, y **nulo** cuando no.
- Las 2 filas heredadas siguen visibles, sin par, sin origen y sin romper agregaciones.
- `security_invoker`, grants, RLS e índices sin cambio respecto de la v1.
- Suite de `servicios` verde; suites existentes verdes sin modificación.
- Smoke: consola limpia, datos visibles, recarga persistente, URL multivalor con Atrás/Adelante,
  teclado, 390×844 y escritorio sin overflow.
- `sync-migration-reviewer` sin hallazgos bloqueantes.
- `git diff --check` limpio.

## 10. Rollback

```sql
-- recrear la v1 desde 20260721130000_tire_services_view.sql
create or replace view public.v_tire_services ...
```

Limpio: la migración solo reemplaza una vista y no toca datos. Más `git checkout` de los archivos web.

## 11. Handoff

Actualizar la fila 11 de `STATE.md` con: la forma final de la vista, la comparación
scrap-con-reemplazo vs. rotación con conteos reales, el comportamiento de las filas heredadas, la
cobertura de la derivación de origen (cuántas filas la resolvieron y cuántas quedaron nulas), el
veredicto de `sync-migration-reviewer` y los conteos de las suites.

Registrar cuántas entradas quedaron con **origen externo sin determinar**: es la medida exacta de lo
que la fase futura tendría que resolver.
