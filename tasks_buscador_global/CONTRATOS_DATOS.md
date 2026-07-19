# CONTRATOS DE DATOS — Buscador global

Este archivo congela el contrato que el frontend puede consumir. La vista es **nueva** y se define
en `task_02`; este documento fija su forma antes de escribirla.

## 1. Fuente única

Fuente: `public.v_search_index`.

Acceso esperado: sesión `authenticated`; **`anon` sin `SELECT`**; `security_invoker = true`;
aislamiento por empresa derivado de las tablas subyacentes con RLS.

Construida desde **tablas base** (`units`, `tire_casings`, `tire_life_cycles`,
`tire_installations`, `inspections`, `inspection_measurements`, `vehicle_configs`), nunca desde
`v_unit_position_state`, `v_tire_inventory_available` ni `v_inventory_status`. Motivo en
`AUDIT.md` §5.3: esas vistas se solapan, no cubren el universo y carecen de DDL versionado.

## 2. Columnas

Una fila por objeto buscable. Dos `kind` en la misma vista.

| Columna | Tipo de UI | Nullable | Uso |
|---|---|:---:|---|
| `kind` | `'unit'` \| `'casing'` | No | Discriminador; agrupa resultados. |
| `entity_id` | UUID string | No | Identidad de fila (`units.id` / `tire_casings.id`). |
| `company_id` | UUID string | No | Verificación de aislamiento; **no se muestra**. |
| `label` | string | Sí | Identidad visible: placa o código de casco. `NULL` = casco sin código. |
| `sublabel` | string | Sí | Texto de reconocimiento ya resuelto por SQL. |
| `haystack` | string | No | Concatenación buscable **sin normalizar**. Nunca se muestra. |
| `status` | string | Sí | Estado de negocio para el badge. |
| `unit_plate` | string | Sí | Contexto y destino alternativo. En `kind='unit'` coincide con `label`. |
| `position_number` | integer | Sí | Contexto. Solo cascos montados. |
| `casing_code` | string | Sí | Destino a historial. En `kind='unit'` siempre `NULL`. |

### 2.1 Valores de `status`

- `kind='unit'`: `units.status` tal cual — `active` \| `pending_validation` \| `inactive`.
- `kind='casing'`: derivado — `installed` \| `in_inventory` \| `discarded`.
  - `discarded` ⇔ `tire_casings.status = 'discarded'`.
  - `installed` ⇔ ciclo activo con instalación activa (no retirada).
  - `in_inventory` ⇔ ciclo activo sin instalación activa.

Los tres son mutuamente excluyentes y cubren todo casco. Un casco que no cae en ninguno es un
error de contrato: se reporta, no se oculta.

## 3. Composición del `haystack`

**Es la parte crítica del contrato.** Un `haystack` incompleto produce objetos invisibles sin
error visible.

### 3.1 `kind='unit'`

`units.plate` · `units.vehicle_type` · `vehicle_configs.notation`.

### 3.2 `kind='casing'`

`tire_casings.code` · **`tire_code` de la última medición asociada** · `tire_casings.brand_name` ·
`model_name` · `size_name` · `condition` del ciclo vigente · `retread_design` del ciclo vigente ·
`unit_plate` · `position_number`.

Además, cuando difieran de los del casco, los `brand_name` / `model_name` / `size_name` /
`retread_design` **de la medición**: son campos duplicados y divergentes por diseño (`AUDIT.md` §5.1).

**Regla dura (D6):** el `haystack` debe contener tanto `tire_casings.code` como el `tire_code` de la
medición más reciente asociada al casco. `inspection_measurements` **no tiene FK a `tire_casings`**:
la asociación se resuelve por el camino
`tire_casings → tire_life_cycles → tire_installations (unit_id, position_number) → inspections →
inspection_measurements`, tomando la instalación más reciente (activa o no) y la inspección más
reciente de esa unidad en esa posición. Es el mismo camino que usa `v_unit_position_state`.

Criterio de aceptación: un casco con `code_mismatch` conocido debe encontrarse **por ambos códigos**.

## 4. Consulta

```js
RenovaSupabase.fetchView("v_search_index", {
  order: "kind.asc,label.asc.nullslast",
});
```

Sin filtros de cliente: el aislamiento lo da la RLS. **No mandar `company_id` desde el navegador
como sustituto de RLS.**

**Precondición de volumen.** PostgREST puede imponer un `max-rows` del proyecto. `task_03` debe
confirmar que la respuesta trae **todas** las filas de la empresa comparando contra
`count(*)`. Un truncado silencioso reproduce el techo de 200 filas de `instalacion.html`
(`AUDIT.md` §6) y es motivo de bloqueo, no de límite tolerado.

## 5. Caché de sesión

Un fetch por sesión de navegador, guardado en `sessionStorage` bajo una clave versionada.

- La clave incluye una versión de esquema del índice; un cambio de forma invalida cachés viejas.
- La caché se descarta al cerrar sesión o cambiar de empresa: `supabase-demo.js` ofrece «Cambiar
  empresa» vía logout. **Una caché que sobreviva a un cambio de empresa es una fuga entre
  inquilinos** y es criterio de rechazo.
- Realtime no refresca el índice en caliente en este alcance: se acepta que un objeto creado en otra
  pestaña no aparezca hasta recargar. Debe documentarse como limitación conocida, no ocultarse.

Dimensionar contra **~500 unidades / ~3 800 neumáticos** (`AUDIT.md` §6), no contra los 36 cascos de
hoy. Si el payload medido resulta desproporcionado, el corte acordado es cargar `kind='unit'` en el
arranque y `kind='casing'` bajo demanda, nunca truncar sin aviso.

## 6. Destinos de navegación

El SQL no construye URLs. El cliente resuelve:

| Condición | Destino |
|---|---|
| `kind='unit'` | `Inspecciones por unidad.html?plate=<enc(label)>` |
| `kind='casing'` y `casing_code` no nulo | `historial-neumatico.html?serie=<enc(casing_code)>&from=buscador` |
| `kind='casing'`, `casing_code` nulo, `unit_plate` no nulo | `Inspecciones por unidad.html?plate=<enc(unit_plate)>` |
| `kind='casing'`, ambos nulos | **Sin enlace.** Resultado visible y no navegable. |

`encodeURIComponent` siempre. Un `label` nulo se muestra como `SIN CÓDIGO` y **nunca produce un
enlace falso** — misma regla que ya aplica `WEB/inventario`.

## 7. Modelo de UI

1. No mutar las filas fuente.
2. `null` se conserva en el modelo; el render decide `—` o `SIN CÓDIGO`.
3. La normalización usa el módulo compartido de `task_04`; **el `haystack` viaja crudo** y se
   normaliza en cliente (D7).
4. Ranking: prefijo de `label` > palabra completa en `haystack` > substring. Desempate estable por
   `kind` y luego `label`.
5. Frecency afecta solo el orden, nunca la existencia de un resultado (D13), con histéresis: un ítem
   necesita ventaja sostenida para desplazar al primero, y el primer resultado no se reordena
   durante una sesión activa.
6. Las facetas producen listas filtradas de objetos, no páginas propias (D3).

## 8. Estados y errores

- `loading`: mensaje y `aria-busy=true`.
- `ready`: resultados agrupados por `kind` con conteo.
- `empty`: «sin coincidencias» distinto de «sin datos».
- `unauthorized`: pedir iniciar sesión; **no decir «sin resultados»**.
- `error`: mensaje seguro y reintento.
- `stale`: si la caché es de una sesión previa válida, se usa y se marca; nunca se presenta como
  fresca.

No se registra en consola el token, la sesión, el `haystack` completo ni filas completas.
