# task_03 — Pruebas SQL de `v_tire_services`

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

Una suite SQL autorreversible que demuestre que la definición de servicio se materializa
correctamente, **incluido el caso degradado**. Va antes de aplicar al remoto a propósito: si la
definición está mal, el error se hereda sin que se note en ninguna capa superior.

## 3. Dependencias y bloqueos

Depende de `task_02`. Bloquea `task_04`.

## 4. Archivos exclusivos

- `supabase/tests/tire_services_view.test.sql`

Solo lectura: `supabase/tests/` (para el patrón), la migración de `task_02`, `CONTRATOS_DATOS.md`.

## 5. Contratos

`CONTRATOS_DATOS.md` §1 (invariante de conteo), §2 (niveles de pareo) y §7 (casos de error).

## 6. Pasos

1. Leer `supabase/tests/baseline_mount.test.sql` y adoptar su patrón: un `DO $$ … $$` que crea
   fixtures, asevera y termina en `raise exception 'TESTS_PASSED'` para revertir todo.
2. Crear empresa, unidad, configuración y perfiles de fixture con prefijo `TEST-SERVICIOS-`.
3. Insertar órdenes con `request_items` realistas — generados con la misma forma que produce
   `addRotation`, no inventados a mano.
4. Insertar ejecuciones vía `insert` directo (no por RPC: la prueba valida la vista, no la RPC),
   respetando `sequence` desde 1.
5. Escribir los 9 casos de §9.
6. Terminar con `raise exception 'TESTS_PASSED'`.

## 7. Invariantes

- Sin datos reales ni `service_role` en fixtures.
- La prueba **revierte siempre**, también al fallar.
- **No relajar una aserción para que pase.** Si S5 o S6 fallan, el diseño de dos niveles está mal y
  la corrección va en `task_02` (regla de bloqueo 2 de `STATE.md`).
- Los identificadores de fixture son UUID literales fijos, no `gen_random_uuid()`: una prueba que
  falla debe poder investigarse.

## 8. Casos de error

Si un fixture viola una constraint de `tire_movement_executions`
(`_reason_by_direction`, `_identity`, `_retread_design`, `_position_positive`, `_rtd_nonnegative`),
el fixture está mal construido, no la vista. Corregir el fixture.

## 9. Aceptación

Los 9 casos, todos obligatorios:

| # | Escenario | Aserción |
|---|---|---|
| S1 | Orden con rotación P3→P7 ejecutada alineada | 1 fila; `service_type='rotation'`; `pair_position_number=7`; `rotation_pairing='exact'` |
| S2 | El mismo caso | **no** existe fila `service_type='installation'` para esa orden |
| S3 | Orden con un `entry` suelto, sin rotación | 1 fila `service_type='installation'`; `rotation_pairing='not_applicable'` |
| S4 | Orden mixta: `exit(discard,P1)`, `entry(P1)`, `exit(rotation,P3)`, `entry(P5)` | 3 filas: `discard`, `installation`, `rotation` |
| S5 | **Ejecución desalineada** — se insertan ejecuciones cuya `sequence` no corresponde a `request_items`, simulando un cliente futuro | `count(rotation) = count(exit rotation)` **y** `count(installation) = count(entry) − count(exit rotation)`; alguna fila con `rotation_pairing='inferred'` |
| S6 | Orden con `request_items` vacío o desalineado, 2 `entry` y 1 `exit(rotation)` | cierres ≤ salidas de rotación (tope del nivel 2); exactamente 1 instalación |
| S7 | `brand_name` como `'goodyear'` y `'GOODYEAR '` en dos renglones | `count(distinct brand_key) = 1` |
| S8 | `casing_code` que no existe en `tire_casings` | `casing_exists = false`; la fila **sí** aparece |
| S9 | Aislamiento: `set local role authenticated` con `request.jwt.claims` de la empresa B | 0 filas de la empresa A |

**S5, S6 y S9 son los que justifican el diseño.** Sin ellos la suite solo prueba el camino feliz, que
es justamente el que no falla.

Resultado correcto de la corrida completa: `ERROR: P0001 TESTS_PASSED`.

## 10. Rollback

Borrar el archivo. La prueba no deja estado: revierte por diseño.

## 11. Handoff

Actualizar la fila 03 de `STATE.md` con el resultado de los 9 casos y cualquier ajuste que S5 o S6
hayan obligado a hacer en `task_02`.

Si S5 o S6 no pasan tras dos intentos de corrección, **detener** y escalar: el diseño de dos niveles
puede necesitar rediseño, y eso es una decisión de contrato, no de implementación.
