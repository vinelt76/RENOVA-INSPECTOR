# task_12 — Extensión de `v_search_index` con columnas de faceta

## 1. Propietario

**CLAUDE + USUARIO** (la aplicación remota requiere autorización).

## 2. Objetivo y resultado observable

`v_search_index` se diseñó para **buscar**: expone `label`, `sublabel`, `haystack` y `status`. La
pantalla de neumáticos de `task_13` necesita **filtrar por faceta**, y eso no se puede hacer sobre un
`haystack` concatenado sin adivinar. Esta tarea agrega las columnas de faceta (D18).

## 3. Dependencias y bloqueos

Depende de `task_11`. Bloquea `task_13`.

## 4. Archivos exclusivos

- `supabase/migrations/<timestamp>_search_index_facets.sql`

Solo lectura: `supabase/migrations/20260719120000_search_index_view.sql`, `CONTRATOS_DATOS.md`.

## 5. Columnas nuevas

Todas nulas para `kind='unit'`; pobladas para `kind='casing'`:

| Columna | Origen | Nota |
|---|---|---|
| `brand_name` | `tire_casings.brand_name` | Texto libre. Ver §7. |
| `model_name` | `tire_casings.model_name` | Texto libre. |
| `size_name` | `tire_casings.size_name` | Medición 2026-07-19: limpio y canónico. |
| `condition` | `tire_life_cycles.condition` del ciclo vigente | Enum `N`/`R1`…`R4`. |
| `retread_design` | `tire_life_cycles.retread_design` del ciclo vigente | Texto libre; nulo si `condition='N'`. |

`status` ya existe y sirve como sexta faceta (`installed`/`in_inventory`/`discarded`).

## 6. Pasos

1. `create or replace view` sobre la vista existente, **conservando todas las columnas actuales en
   el mismo orden** y agregando las nuevas al final. Es aditivo: `task_05` y `task_06` siguen
   funcionando sin cambios.
2. Mantener `security_invoker = true` y el grant existente. **No re-otorgar a `anon`.**
3. Reconfirmar las cuatro consultas de cobertura de `task_02` §9: los conteos no deben moverse.
4. **Medir el payload antes y después.** Referencia de `task_03`: 94 128 B para 309 filas; proyección
   500 U + 3 800 C ≈ 1,42 MiB.
5. Proyectar el payload nuevo a esa escala y registrarlo.

## 7. La suciedad de los datos importa acá, no en el buscador

Medición del 2026-07-19 (`AUDIT.md` §5.2): `brand_name` tiene variantes de caja —`GOODYEAR`/
`goodyear`, `HANKOOK`/`hankook`, `BRIDGESTONE`/`Bridgestone`— y hay 9 cascos con marca `QA-TEST`.

Para **buscar** eso es irrelevante: `normalizeSearchText` pasa todo a minúsculas y las variantes
colapsan solas. Para **filtrar por faceta** no lo es: `?marca=GOODYEAR` y `?marca=goodyear` serían
dos filtros distintos, y una lista de marcas disponibles mostraría la misma marca dos veces.

Decisión para esta tarea: **la vista expone el valor crudo, sin normalizar.** El filtrado por faceta
se hace en cliente con `normalizeSearchText`, igual que la búsqueda, de modo que las variantes
colapsan al comparar. La vista **no** aplica `upper()` porque eso enmascararía la deuda de datos y
haría creer que está resuelta.

La limpieza real (`upper(trim())` en la RPC de escritura + backfill) sigue siendo una fase separada,
registrada en `task_09` §6, e idealmente anterior al baseline de las 2 096 posiciones.

## 8. Invariantes

- Cambio **estrictamente aditivo**: ninguna columna existente cambia de nombre, tipo ni orden.
- Un casco sigue apareciendo exactamente una vez.
- Sin extensiones nuevas. Sin `unaccent`, sin `pg_trgm`.
- Sin filtrar por `company_id` dentro de la vista: el aislamiento lo da la RLS.
- No modificar ninguna otra vista, tabla, RPC ni policy.

## 9. Aceptación

Antes de aplicar: revisión con `sync-migration-reviewer`.

Verificación remota tras aplicar:

```sql
-- los conteos no se movieron
select kind, count(*) from public.v_search_index group by 1;

-- facetas nulas solo en unidades
select count(*) from public.v_search_index
where kind = 'casing' and brand_name is null;

-- inventario de facetas: revela la suciedad real
select brand_name, count(*) from public.v_search_index
where kind = 'casing' group by 1 order by 2 desc;

-- grants intactos
select grantee, privilege_type from information_schema.role_table_grants
where table_name = 'v_search_index';
```

Más: aislamiento A/B reconfirmado, y payload medido y proyectado.

## 10. Rollback

`create or replace view` restaurando la definición de
`20260719120000_search_index_view.sql`. `task_05`/`task_06` no dependen de las columnas nuevas, así
que la reversión no rompe el buscador.

## 11. Handoff

Actualizar fila 12 con: conteos antes/después, payload medido y proyectado, inventario de valores
por faceta —que es evidencia directa de la deuda de datos— y veredicto de `sync-migration-reviewer`.

Si el payload proyectado resulta desproporcionado, la alternativa a evaluar con el humano es
**dejar de enviar `haystack`** y reconstruirlo en cliente desde las columnas de faceta, que hoy
duplican su contenido. No truncar en silencio.
