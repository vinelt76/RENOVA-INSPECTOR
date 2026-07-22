# task_02 — Migración `v_tire_services`

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

Escribir una migración aditiva que cree `public.v_tire_services` y su índice conforme a
`CONTRATOS_DATOS.md`, lista para revisión. **Esta tarea no aplica nada al remoto**; eso es `task_04`.

## 3. Dependencias y bloqueos

Depende de `task_01`. Bloquea `task_03`.

**No cierra sin la confirmación humana de D11 (zona horaria).** Regla de bloqueo 1 de `STATE.md`.

## 4. Archivos exclusivos

- `supabase/migrations/20260721130000_tire_services_view.sql`

Solo lectura: el resto de `supabase/migrations/`, `CONTRATOS_DATOS.md`, `DECISIONES.md`.

## 5. Contratos

Forma exacta de columnas, regla de pareo, valores de `rotation_pairing`, seguridad e índice:
`CONTRATOS_DATOS.md` §2 a §5. Este archivo no los repite; si divergen, **manda el contrato**.

## 6. Pasos

1. Releer las migraciones en orden antes de tocar el esquema (`CLAUDE.md`). Confirmar nombres reales
   de `tire_movement_executions`, `tire_movement_orders`, `companies`, `units`, `vehicle_configs`,
   `profiles`, `tire_casings`.
2. Confirmar D11 con la persona responsable. **Sin eso no se sigue.**
3. Crear el índice `tire_movement_executions_company_captured_idx`.
4. Construir la vista en CTEs encadenadas:
   - `source` — join `executions` + `orders`; extraer `request_items -> (sequence-1)` como gemelo del
     propio renglón y `-> (sequence-2)` como su antecesor.
   - `aligned` — verificar que el gemelo conserva `direction` y `position` (el renglón sigue
     alineado con lo que pidió el supervisor).
   - `exact_pairs` — derivar `closes_rotation_exact` con las tres condiciones del contrato §2.2,
     incluida la comprobación de que **existe la ejecución real** en `sequence - 1`.
   - `ranked` — ventanas por `order_id`: salidas de rotación, cierres exactos, y ranking de los
     `entry` no exactos por `sequence`.
   - `typed` — derivar `closes_rotation` aplicando el tope del contrato §2.3.
   - Select final con los joins de catálogo y el `left join` al gemelo para las columnas `pair_*`.
5. Materializar la definición de servicio en el `where`:
   `where direction = 'exit' or not closes_rotation`.
6. Derivar `service_type` con el `case` del contrato §3.3.
7. Derivar `casing_exists` con `exists` contra `tire_casings`, comparando `tc.code = btrim(...)`
   **crudo** para conservar `tire_casings_company_code_uidx`.
8. Exponer `brand_key` / `size_key` normalizados y `retread_design` en mayúsculas.
9. Derivar `rotation_pairing` con los cuatro valores del contrato §2.4.
10. Declarar `security_invoker = true`, escribir los `comment on` de la vista y de las dos columnas
    que no se explican solas (`rotation_pairing`, `casing_exists`).
11. `revoke all ... from public, anon, authenticated;` seguido de
    `grant select ... to authenticated;`
12. Migración idempotente: `create or replace view`, `create index if not exists`.

## 7. Invariantes

- **Prohibido** derivar de `v_operator_movement_orders` (límite 2 del orquestador).
- **Prohibido** filtrar `company_id` dentro de la vista: el aislamiento lo da la RLS vía
  `security_invoker`. Un filtro explícito daría falsa sensación de seguridad y rompería si la RLS
  cambia.
- **Prohibido** emparejar por el texto de `observations` (D3).
- **Prohibido** omitir `rotation_pairing` (D4).
- No modificar ninguna vista, tabla, RPC, enum ni policy existente.
- `installation` **no** se agrega al enum `tire_movement_reason` (D2).
- Un renglón debe aparecer **como máximo una vez**. Duplicados por el `left join` al gemelo son el
  error más probable de esta tarea: el join debe estar acotado a `sequence + 1` y a
  `closes_rotation_exact`.
- Todo `nullif(btrim(...), '')` para que una cadena vacía no se confunda con un valor.

## 8. Casos de error

Los siete del contrato §7. En particular:

- Casco sin código: fila presente, `casing_code` null. **No omitir.**
- Código no registrado: fila presente, `casing_exists=false`. **No omitir.**
- Salida de rotación sin ingreso: fila presente, `rotation_pairing='not_paired'`, `pair_*` nulos.
- Orden desalineada: conteos correctos, alguna fila `inferred`.
- Unidad sin `config_id`: `vehicle_config` null, fila presente. Cuidado con usar `join` en lugar de
  `left join` sobre `vehicle_configs` si el esquema lo permite nulo.
- `assigned_to` nulo (orden emitida y no tomada): no tendrá ejecuciones, así que no llega a la vista.
  El `left join` a `profiles` para `assigned_to_name` se conserva igual, por robustez.

## 9. Aceptación

Verificación local contra base de desarrollo antes de entregar:

```sql
-- invariante de conteo (contrato §1)
select
  (select count(*) from public.v_tire_services)                                        as vista,
  (select count(*) from public.tire_movement_executions where direction = 'exit')      as salidas,
  (select count(*) from public.tire_movement_executions where direction = 'entry')     as entradas,
  (select count(*) from public.v_tire_services where service_type = 'installation')    as instalaciones;
-- vista = salidas + instalaciones; entradas - instalaciones = rotaciones cerradas

-- las rotaciones no se duplican ni se pierden
select count(*) from public.v_tire_services where service_type = 'rotation';
select count(*) from public.tire_movement_executions
  where direction = 'exit' and movement_reason = 'rotation';   -- deben coincidir

-- ningún renglón duplicado
select service_id, count(*) from public.v_tire_services
  group by service_id having count(*) > 1;                     -- 0 filas

-- el tope del nivel 2 se respeta en toda orden
select order_id from public.v_tire_services
  group by order_id having false;  -- reemplazar por la comprobación del contrato §1

-- los 8 tipos y nada más
select service_type, count(*) from public.v_tire_services group by 1 order by 2 desc;

-- calidad del pareo
select rotation_pairing, count(*) from public.v_tire_services group by 1;
```

`sync-migration-reviewer` debe revisar orden, RLS, `security_invoker`, grants e idempotencia antes de
cerrar la tarea.

## 10. Rollback

```sql
drop view if exists public.v_tire_services;
drop index if exists public.tire_movement_executions_company_captured_idx;
```

La vista es aditiva y nada la consume todavía.

## 11. Handoff

Actualizar la fila 02 de `STATE.md` con: la decisión tomada en D11 y quién la aprobó, los conteos
obtenidos, el veredicto de `sync-migration-reviewer` y cualquier desviación respecto del contrato.

Si al construir la vista se descubre que el pareo estructural no se sostiene sobre el esquema real,
**detener** y aplicar la regla de bloqueo 7 de `STATE.md`: es una fase de esquema, no una ampliación
de esta.
