# task_01 — Auditoría y contrato de datos

## 1. Propietario

**CLAUDE.** Estado: `APROBADO` (2026-07-20).

## 2. Objetivo y resultado observable

Determinar qué existe realmente antes de decidir, y congelar el contrato de la vista nueva. Resultado:
`AUDIT.md`, `CONTRATOS_DATOS.md`, `DECISIONES.md`, `PLAN.md`, `PROMPT_ORQUESTADOR.md` y `STATE.md`
escritos y coherentes entre sí.

La pregunta que decide la fase entera: **¿se puede saber, en la base, qué ingreso cierra qué
rotación?** Si la respuesta hubiera sido no, la fase se habría convertido en una de esquema.

## 3. Dependencias y bloqueos

Ninguna. Bloquea todas las demás.

## 4. Archivos exclusivos

- Todos los documentos de `tasks_servicios/`.

Solo lectura: `supabase/migrations/`, `WEB/`, `app movimientos/`, `DESIGN.md`, `PRODUCT.md`,
`specs/`, `knowledge/`, `decisions/`, `scripts/prepare-static-hosting.mjs`.

## 5. Contratos

Esta tarea **produce** el contrato. No lo consume.

## 6. Pasos

1. Leer las migraciones en orden hasta `20260721002006`, con foco en `20260720012248` y
   `20260720022451`.
2. Recorrer el ciclo completo orden → ejecución en los tres consumidores: web supervisor
   (`WEB/movimientos/`), app operario (`app movimientos/`) y las tres RPCs.
3. Verificar la cadena de pareo de rotación en los cuatro puntos donde puede romperse: emisión
   (`addRotation`), transformación a borrador (`draftFromOrder`), edición del operario
   (`ExecutionScreen`) y persistencia (`v_sequence` en la RPC).
4. Inventariar las primitivas web reutilizables para no crear ninguna nueva.
5. Localizar la navegación de las 8 pantallas y las allowlists del bundle estático.
6. Comprobar si existe convención de zona horaria en migraciones.
7. Contrastar con `decisions/0005` qué está permitido como objeto navegable.
8. Congelar el contrato y registrar cada decisión con su porqué y qué la revertiría.

## 7. Invariantes

- Ninguna afirmación de `AUDIT.md` sin ruta y línea que la respalde.
- No proponer una primitiva nueva sin demostrar que la existente no sirve.
- Las decisiones se registran con lo que las revierte; una decisión sin condición de salida es dogma.

## 8. Casos de error

- Si el pareo de rotación hubiera resultado irrecuperable con el esquema real, la fase se detiene y
  se abre una fase de esquema separada para agregar `request_item_index`. **No se degrada la
  definición de servicio en silencio** para que el SQL sea más fácil.
- Si el contrato exigiera modificar una RPC o una tabla, no es esta fase.

## 9. Aceptación

Verificado en esta ejecución:

| Punto de la cadena | Evidencia |
|---|---|
| Emisión del par | `WEB/movimientos/supervisor-order-model.js:138-146` — `exit`+`rotation` seguido de `entry`, adyacentes |
| Borrador del operario | `app movimientos/src/lib/model.ts:49` — `request_items.map(newExecutionItem)`, 1:1 y en orden |
| Edición del operario | `app movimientos/src/screens/ExecutionScreen.tsx:53` — única mutación es `map` con patch; sin `push`/`splice`/`filter` |
| Persistencia | `20260720012248_operator_movement_orders.sql:346,385-386` — `v_sequence := 0`, incrementa **antes** de insertar recorriendo `jsonb_array_elements(p_items)` |

⇒ `sequence - 1` es el índice 0-based exacto en `request_items`. Contrato viable.

Otros hallazgos confirmados:

- No existe ninguna vista sobre `tire_movement_executions` (`grep` sobre `supabase/migrations/`).
- `complete_tire_movement_order` **no** valida longitud de `p_items` contra `request_items`
  (línea 381 solo verifica que sea array no vacío) → obliga al diseño de dos niveles.
- Índices existentes lideran por `(company_id, reconciliation_status)` u `(order_id)`; ninguno sirve
  de prefijo para el recorrido por `captured_at` → hace falta uno nuevo.
- Policies cubren `tire_supervisor`, `fleet_manager`, `operator`, `admin`; **no** `inspector` ni
  `workshop_manager`.
- `grep "at time zone"` sobre migraciones → 0 resultados. Sin convención → D11.
- `WEB/shared/inspection-date-facets.js` es parametrizable por columna → reutilizable con
  `captured_on` sin modificarlo.
- Navegación duplicada en 8 HTML con clases divergentes (`nav` vs `screen-nav`) y listas distintas.

## 10. Rollback

Borrar `tasks_servicios/`. No se tocó nada fuera de la carpeta.

## 11. Handoff

`task_02` empieza releyendo `CONTRATOS_DATOS.md` §2 y §3 y **no** el resumen de este archivo. El
contrato es la autoridad; este archivo es el rastro de cómo se llegó a él.

**Bloqueo abierto que `task_02` debe resolver antes de cerrar: D11 (zona horaria).**
