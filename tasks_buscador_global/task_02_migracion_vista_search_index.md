# task_02 — Migración `v_search_index`

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

Escribir una migración aditiva que cree `public.v_search_index` conforme a `CONTRATOS_DATOS.md`,
lista para revisión. **Esta tarea no aplica nada al remoto**; eso es `task_03`.

## 3. Dependencias y bloqueos

Depende de `task_01`. Bloquea `task_03`.

## 4. Archivos exclusivos

- `supabase/migrations/<timestamp>_search_index_view.sql`

Solo lectura: el resto de `supabase/migrations/`, `supabase/views_demo.sql`,
`CONTRATOS_DATOS.md`.

## 5. Contratos

Forma exacta de columnas, valores de `status` y composición del `haystack`: `CONTRATOS_DATOS.md`
§2 y §3. Este archivo no los repite; si divergen, manda el contrato.

## 6. Pasos

1. Leer las migraciones en orden antes de tocar el esquema (`CLAUDE.md`). Confirmar nombres reales
   de `units`, `tire_casings`, `tire_life_cycles`, `tire_installations`, `inspections`,
   `inspection_measurements`, `vehicle_configs`.
2. Construir la rama `kind='unit'` desde `units` + `vehicle_configs`.
3. Construir la rama `kind='casing'` desde `tire_casings`, con `left join` al ciclo vigente y a la
   instalación más reciente. **`left join`, no `inner`**: un casco sin ciclo o sin instalación debe
   aparecer igual.
4. Resolver el `tire_code` de la última medición por el camino declarado en el contrato §3.2
   (`tire_casings → tire_life_cycles → tire_installations → inspections → inspection_measurements`),
   tomando instalación más reciente e inspección más reciente de esa unidad en esa posición.
   `inspection_measurements` **no tiene FK a `tire_casings`**: es el punto difícil de la tarea.
5. Derivar `status` según §2.1 con los tres casos mutuamente excluyentes.
6. Componer `haystack` con `concat_ws(' ', …)` para que un `NULL` no anule la cadena entera.
7. Declarar `security_invoker = true`.
8. `grant select on public.v_search_index to authenticated;` y **nada a `anon`**.
9. Escribir la migración de forma idempotente (`create or replace view`).

## 7. Invariantes

- **Prohibido** derivar de `v_unit_position_state`, `v_tire_inventory_available` o
  `v_inventory_status` (D5).
- **Prohibido** instalar extensiones. Sin `unaccent`, sin `pg_trgm` (D4, D7).
- **Prohibido** filtrar por `company_id` dentro de la vista: el aislamiento lo da la RLS de las
  tablas base vía `security_invoker`. Un filtro explícito daría falsa sensación de seguridad y
  rompería si la RLS cambia.
- No modificar ninguna vista, tabla, RPC ni policy existente.
- Un casco debe aparecer **exactamente una vez**. Duplicados por join a instalaciones históricas son
  el error más probable de esta tarea.

## 8. Casos de error

- Casco sin `code`: fila presente, `label` nulo. **No omitir.**
- Casco sin ciclo activo (descartado): fila presente con `status='discarded'`.
- Casco nunca instalado: `unit_plate` y `position_number` nulos, fila presente.
- Unidad sin `config_id`: fila presente, notación ausente del `haystack`.
- Casco con `code_mismatch`: ambos códigos en el `haystack`.

## 9. Aceptación

Verificación local antes de entregar, contra la base de desarrollo:

```sql
-- cobertura exacta, sin duplicados
select count(*) from public.v_search_index where kind = 'casing';
select count(*) from public.tire_casings;          -- deben coincidir

select count(*) from public.v_search_index where kind = 'unit';
select count(*) from public.units;                 -- deben coincidir

-- ningún casco duplicado
select entity_id, count(*) from public.v_search_index
where kind = 'casing' group by entity_id having count(*) > 1;   -- 0 filas

-- status cubre todo
select status, count(*) from public.v_search_index
where kind = 'casing' group by status;             -- solo installed/in_inventory/discarded
```

`sync-migration-reviewer` debe revisar orden, RLS, `security_invoker`, grants e idempotencia antes
de cerrar la tarea.

## 10. Rollback

`drop view public.v_search_index;`. La vista es aditiva y nada la consume todavía.

## 11. Handoff

Actualizar fila 02 con los conteos obtenidos, el veredicto de `sync-migration-reviewer` y cualquier
desviación respecto del contrato. Si el `tire_code` de la última medición resulta irrecuperable con
el esquema real, **detener** y aplicar la regla 3 de bloqueo de `STATE.md`.
