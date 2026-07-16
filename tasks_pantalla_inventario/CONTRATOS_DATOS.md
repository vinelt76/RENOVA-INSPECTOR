# CONTRATOS DE DATOS — Pantalla de Inventario

Este archivo congela el contrato mínimo que el frontend puede consumir. No autoriza cambios de
esquema.

## 1. Retén

Fuente: `public.v_tire_inventory_available`.

Acceso esperado: sesión `authenticated`; `anon` sin `SELECT`; aislamiento por empresa derivado de
las tablas subyacentes con RLS; vista `security_invoker=true`.

Columnas:

| Columna | Tipo de UI | Nullable | Uso |
|---|---|:---:|---|
| `company_id` | UUID string | No | Verificación/aislamiento, no se muestra. |
| `life_cycle_id` | UUID string | No | Identidad de fila de Retén. |
| `casing_id` | UUID string | No | Enlace lógico al casco. |
| `casing_code` | string | Sí | Identidad visible y enlace a historial si existe. |
| `brand_name` | string | Sí | Detalle. |
| `model_name` | string | Sí | Detalle. |
| `size_name` | string | Sí | Filtro/detalle. |
| `condition` | `N`/`R1`…`R4` | No | Filtro/detalle. |
| `cycle_number` | integer | No | Detalle. |
| `retread_design` | string | Sí | Filtro/detalle. |
| `otd_mm` | number | Sí | Detalle opcional. |
| `last_removed_at` | date string | Sí | Orden y detalle. |
| `last_removal_reason` | enum string | Sí | Detalle. |
| `last_rtd_mm` | number | Sí | Detalle opcional. |
| `days_in_inventory` | integer | Sí | Antigüedad; `NULL` significa nunca retirado. |

Consulta conceptual:

```js
RenovaSupabase.fetchView("v_tire_inventory_available", {
  order: "last_removed_at.desc.nullslast,casing_code.asc",
});
```

No mandar `company_id` desde el navegador como sustituto de RLS.

## 2. Descartados

Fuente: `public.v_inventory_status`, filtrada en el Data API por
`inventory_status=eq.discarded` cuando `fetchView` lo permita; si no, cargar el conjunto visible y
aplicar una aserción defensiva en el adaptador. Nunca presentar `installed` ni `in_inventory` en
esta pestaña.

Contrato mínimo documentado por consumidores y auditorías previas:

| Columna | Tipo de UI | Nullable | Uso |
|---|---|:---:|---|
| `casing_id` | UUID string | No | Identidad de fila. |
| `current_life_cycle_id` | UUID string | Sí | Trazabilidad, no acción. |
| `inventory_status` | string | No | Debe ser exactamente `discarded`. |
| `code` | string | Sí | Identidad visible/enlace a historial. |
| `brand_name` | string | Sí | Detalle. |
| `model_name` | string | Sí | Detalle. |
| `size_name` | string | Sí | Filtro/detalle. |
| `condition` | string | Sí | Filtro/detalle. |
| `retread_design` | string | Sí | Filtro/detalle. |
| `last_removed_at` | date string | Sí | Orden/detalle. |
| `last_removal_reason` | string | Sí | Debe ser coherente con descarte cuando exista. |
| `last_removal_discard_cause` | string | Sí | Causa visible con fallback. |
| `last_unit_plate` | string | Sí | Última unidad. |
| `last_position_number` | integer | Sí | Última posición. |
| `discarded_at` | timestamp/date string | Sí | Fecha de baja. |
| `discard_photo_url` | string | Sí | Solo indicador de evidencia; no renderizar URL ni imagen. |

Precondición: la primera prueba autenticada debe confirmar nombres y permisos. Si falta una columna
obligatoria, la vista no existe o devuelve acceso indebido, la implementación se detiene. No hay
fallback a tablas base ni a datos mock en producción.

## 3. Modelo de UI

Los loaders conservan los nombres canónicos de cada vista para evitar una segunda traducción del
contrato. Solo normalizan columnas numéricas que PostgREST puede devolver como texto. El modelo
puro usa las pestañas `reten` y `descartados`, aplica búsqueda y calcula conteos.

Reglas:

1. No mutar las filas fuente.
2. `null` se conserva en el modelo; el render decide `—` o “SIN CÓDIGO”.
3. La foto no se solicita ni se expone en esta pantalla.
4. Los conjuntos deben ser disjuntos por `casing_id`; una intersección produce un error de
   contrato y no se oculta.
5. Orden por fecha descendente, `NULL` al final, y código como desempate estable.

## 4. Estados y errores

- `loading`: mensaje y `aria-busy=true`.
- `ready`: filas visibles y contadores.
- `empty`: mensaje distinto por pestaña.
- `unauthorized`: pedir iniciar sesión; no decir “sin datos”.
- `error`: mensaje seguro y opción de reintentar lectura.
- `stale`: una actualización Realtime recarga ambas fuentes; conserva pestaña y filtros.

No se registra el token, la sesión completa, URLs de foto ni filas completas en consola.
