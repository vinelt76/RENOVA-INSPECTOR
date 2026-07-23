# CONTRATOS_DATOS — `v_tire_services`

> **HISTÓRICO (Fase 1).** Su definición de servicio —«una salida es un servicio», «una
> rotación se cuenta una sola vez»— quedó **superada el 2026-07-22** por
> `decisions/0008-servicio-por-posicion-atendida.md`: un servicio es una **posición
> atendida**, y una rotación entre dos posiciones cuenta 2. Este documento no se reescribe:
> describe correctamente lo que se decidió entonces, y era correcto dado lo que la app
> capturaba. Ver `PLAN_PAREO.md`.

Contrato congelado. **Este archivo manda** sobre los archivos de tarea si divergen. Un ejecutor debe
poder escribir la vista leyendo solo esto, `AUDIT.md` y las migraciones.

Cambiarlo exige aprobación humana registrada en `DECISIONES.md`.

## 1. Definición de servicio

> **Un servicio es un renglón `direction='exit'` de `tire_movement_executions`, con su
> `movement_reason` como tipo.**
>
> **Una rotación se cuenta una sola vez**, en su salida; el destino viaja en columnas `pair_*`.
>
> **Un `entry` que no cierra una rotación es una instalación**, con tipo sintético `installation`.

Invariante de conteo que la vista debe cumplir siempre:

```text
filas(v_tire_services) = filas(exit) + filas(entry) − rotaciones_cerradas
rotaciones_cerradas ≤ filas(exit con movement_reason = 'rotation')
```

El tope de la segunda línea no es cosmético: es lo que impide que una orden malformada infle las
instalaciones o duplique rotaciones.

### 1.1 Los ocho tipos

Los siete valores de `public.tire_movement_reason` más el sintético:

`repair` · `retention` · `claim` · `rotation` · `discard` · `retread` · `balancing` · `installation`

`installation` **no** se agrega al enum de la base. Es derivado en la vista. Añadirlo al enum
implicaría que un `entry` pueda llevar `movement_reason`, lo que la constraint
`tire_movement_executions_reason_by_direction` prohíbe por diseño.

## 2. Regla de pareo de rotación

### 2.1 Fundamento

`tire_movement_executions.sequence - 1` es el índice **0-based exacto** dentro de
`tire_movement_orders.request_items`. Evidencia en `AUDIT.md` §6.

**Prohibido emparejar por el texto de `observations`.** El operario lo edita.

### 2.2 Nivel 1 — exacto

Un `entry` cierra una rotación de forma exacta cuando se cumplen **todas**:

1. `request_items -> (sequence - 1)` existe, su `direction` es `entry` y su `position` coincide con
   `position_number` (el renglón sigue alineado con lo que pidió el supervisor);
2. `request_items -> (sequence - 2)` tiene `direction='exit'` y `reason='rotation'`;
3. **existe realmente** una ejecución con `order_id` igual y `sequence = sequence - 1`, con
   `direction='exit'` y `movement_reason='rotation'`.

La condición 3 es la que importa: verifica la ejecución real, no solo el borrador del supervisor.

### 2.3 Nivel 2 — inferido, con tope

Si la orden perdió la alineación, se recurre a un pareo por conteo dentro de la misma orden:

```text
cierres_inferidos_permitidos = max(salidas_rotation − cierres_exactos, 0)
```

Los `entry` no exactos se ordenan por `sequence` y los primeros `cierres_inferidos_permitidos`
cuentan como cierre. Preserva el invariante de §1 aunque **la atribución por fila sea aproximada**.

### 2.4 `rotation_pairing` — honestidad obligatoria

| Valor | Significado |
|---|---|
| `exact` | Salida de rotación con ingreso identificado por posición estructural. Las `pair_*` son de esa fila. |
| `inferred` | La orden perdió alineación; el pareo se acotó por conteo. **El total es correcto, la atribución de esta fila es aproximada.** La UI debe marcarlo. |
| `not_paired` | Salida de rotación sin ningún ingreso que la cierre. |
| `not_applicable` | La fila no es una salida por rotación. |

Omitir esta columna convierte la vista en una caja negra no auditable. **No es opcional.**

## 3. Columnas

`public.v_tire_services`, `with (security_invoker = true)`.

### 3.1 Identidad y orden

| Columna | Tipo | Origen |
|---|---|---|
| `service_id` | `uuid` | `tire_movement_executions.id` |
| `order_id` | `uuid` | |
| `sequence` | `smallint` | |
| `company_id` | `uuid` | |
| `company_name` | `text` | `companies.name` |

### 3.2 Unidad

| Columna | Tipo | Origen |
|---|---|---|
| `unit_id` | `uuid` | `tire_movement_orders.unit_id` |
| `plate` | `text` | `units.plate` — enruta a `Inspecciones por unidad.html?plate=` |
| `vehicle_config` | `text` | `vehicle_configs.notation` |

### 3.3 Clasificación

| Columna | Tipo | Regla |
|---|---|---|
| `service_type` | `text` | `case when direction='exit' then movement_reason::text else 'installation' end` |
| `direction` | `text` | `exit` \| `entry` |
| `position_number` | `smallint` | |

### 3.4 Identidad del neumático

| Columna | Tipo | Regla |
|---|---|---|
| `casing_code` | `text` | `nullif(btrim(casing_code), '')` |
| `casing_exists` | `boolean` | `exists` contra `tire_casings` por `(company_id, code)`. **Falso significa que no hay historial navegable, no que el código esté mal.** |
| `code_unreadable` | `boolean` | |

`casing_exists` compara `tc.code = btrim(t.casing_code)` **crudo**, sin `upper()`, para conservar el
índice `tire_casings_company_code_uidx (company_id, code) where code is not null`. Un código en otra
caja da falso negativo: la fila se muestra sin enlace. **Es la dirección segura del error** — un
falso positivo llevaría a una pantalla vacía. Solo si la verificación de `task_04` muestra el caso se
añade un índice funcional, en migración aparte.

### 3.5 Atributos

| Columna | Tipo | Regla |
|---|---|---|
| `brand_name` | `text` | `nullif(btrim(...), '')` — grafía cruda, para mostrar |
| `brand_key` | `text` | `nullif(upper(btrim(...)), '')` — **para agrupar y facetar** |
| `size_name` / `size_key` | `text` | igual |
| `design_name` | `text` | `nullif(btrim(...), '')` |
| `retread_design` | `text` | `nullif(upper(btrim(...)), '')` |
| `rtd_min_mm` | `numeric(5,2)` | |
| `condition` | `text` | `N` \| `R1`..`R4` |
| `observations` | `text` | `nullif(btrim(...), '')` |

El par `*_name` / `*_key` es deliberado: la deuda de caja documentada en `AUDIT.md` §8 partiría las
agregaciones si se facetara por la grafía cruda. Se normaliza en SQL porque es **agregación**, no
búsqueda — la normalización de búsqueda sigue en cliente (`WEB/shared/search.js`), sin cambio.

### 3.6 Trazabilidad

| Columna | Tipo | Regla |
|---|---|---|
| `captured_by` | `uuid` | |
| `captured_by_name` | `text` | `profiles.full_name` |
| `captured_at` | `timestamptz` | |
| `captured_on` | `date` | `(captured_at at time zone 'America/Lima')::date` — **sujeto a D11** |
| `reconciliation_status` | `text` | `pending` \| `reconciled` \| `needs_review` |
| `odometer_km` | `integer` | de la orden |
| `scheduled_for` | `date` | de la orden |
| `completed_at` | `timestamptz` | de la orden |
| `requested_by_name` | `text` | supervisor que emitió |
| `assigned_to_name` | `text` | operario asignado (nullable) |

### 3.7 Par de rotación

| Columna | Tipo | Regla |
|---|---|---|
| `pair_position_number` | `smallint` | posición destino; null salvo rotación pareada |
| `pair_casing_code` | `text` | |
| `pair_condition` | `text` | |
| `pair_rtd_min_mm` | `numeric(5,2)` | |
| `rotation_pairing` | `text` | ver §2.4 |

## 4. Seguridad

1. `with (security_invoker = true)`. **La vista no filtra `company_id`.**
2. El aislamiento lo dan `select_movement_orders_own_company` y
   `select_movement_executions_own_company`. Un filtro explícito daría falsa sensación de seguridad y
   rompería si la RLS cambia.
3. `revoke all on public.v_tire_services from public, anon, authenticated;`
   `grant select on public.v_tire_services to authenticated;`
   **Nunca a `anon`** — no repetir la deriva registrada en `knowledge/ai/10`.
4. La vista no expone ninguna columna que las tablas base no expongan ya al mismo rol.

## 5. Índice

```sql
create index if not exists tire_movement_executions_company_captured_idx
  on public.tire_movement_executions (company_id, captured_at desc, sequence);
```

Los índices existentes lideran por `(company_id, reconciliation_status, captured_at)` o
`(order_id, sequence)`; ninguno sirve de prefijo para el recorrido de la pantalla, que es toda la
empresa ordenada por fecha de captura.

## 6. Consumo desde el cliente

```text
fetchView("v_tire_services", {
  select: <lista explícita de columnas, nunca "*">,
  order:  "captured_at.desc,sequence.asc",
  limit:  "2000"
})
```

- **Prohibido** enviar `company_id`: lo hace la RLS.
- **Prohibido** `select: "*"`: una columna nueva no debe cambiar el payload en silencio.
- La respuesta se envuelve en `{rows, limit, truncated}`. `truncated` es verdadero cuando la
  respuesta llenó el límite, y **la UI debe avisarlo**. Un recorte silencioso repite el antipatrón
  `limit: '200'` de `instalacion.html`.

## 7. Casos de error obligatorios

Todos deben producir fila presente y comportamiento definido, nunca una fila ausente en silencio:

| Caso | Comportamiento |
|---|---|
| Casco sin código (`casing_code` null) | Fila presente; `casing_code` null; sin enlace |
| `code_unreadable = true` | Fila presente; la UI muestra `SIN CÓDIGO LEGIBLE`; sin enlace |
| Código no registrado en `tire_casings` | Fila presente; `casing_exists=false`; se muestra el código sin enlace |
| Salida de rotación sin ingreso | Fila presente; `rotation_pairing='not_paired'`; `pair_*` nulos |
| Orden desalineada | Conteos correctos; alguna fila `rotation_pairing='inferred'` |
| Unidad sin `config_id` | Fila presente; `vehicle_config` null |
| Orden `cancelled` | Sin ejecuciones, luego sin filas. No es un caso a manejar en la vista. |

## 8. Lo que la vista NO hace

- No reconcilia contra `tire_casings`, `tire_life_cycles` ni `tire_installations`. `casing_exists` es
  una comprobación de existencia para decidir enlaces, **no** una reconciliación.
- No excluye datos `QA-TEST` (D8).
- No calcula tiempos, tasas ni carga por operario (fuera de v1).
- No filtra por estado de orden: si hay ejecuciones, la orden se completó.
- No pagina. El límite es un tope visible, no un cursor.
