# Contratos reales para la UI de Cambios de Neumáticos

Fecha de verificación: 2026-07-13

Proyecto remoto verificado: `fbxupwwgiebhlciqftpw`

Estado: contratos backend aplicados; frontend pendiente (Fase 2).

Este documento es autocontenido. La Fase 2 puede implementar el modo **Cambios** sin modificar
el backend y sin depender de la conversación que originó estas tareas.

## 1. Resumen de integración

El flujo de la pantalla es:

1. Exigir sesión con `await RenovaSupabase.requireAuth()`.
2. Resolver el `unit_id` desde el `inspection_id`/`plate` que hoy recibe la pantalla.
3. Leer todas las posiciones desde `v_unit_position_state`.
4. Leer ciclos disponibles desde `v_tire_inventory_available` cuando haga falta montar.
5. Mantener los movimientos como estado provisional en el navegador.
6. Generar un `batch_id` una sola vez, persistir el payload y llamar
   `confirm_tire_change_batch({ p_batch })`.
7. Tras el éxito, recargar ambas vistas. Ante `[estado_desactualizado]`, descartar el borrador,
   recargar el estado y pedir al usuario que rearme el lote.

La empresa nunca se envía: el backend la deriva del JWT. Las vistas aplican RLS por empresa y la
RPC valida empresa y rol. No usar `service_role` ni claves secretas en el navegador.

## 2. Contrato de lectura: `v_unit_position_state`

### 2.1 Propósito

Entrega una fila por cada posición de la configuración de una unidad, incluidas las posiciones
sin instalación o sin medición. Es la fuente del diagrama en modo Cambios; no se debe derivar el
número de posiciones desde la inspección ni hardcodear P1–P6/P1–P8.

Seguridad remota comprobada:

- `security_invoker=true`.
- `authenticated`: `SELECT`.
- `anon`: sin `SELECT`.
- Las tablas base filtran por la empresa del perfil autenticado.

### 2.2 Columnas exactas

| # | Columna | Tipo PostgreSQL | ¿Puede ser NULL? | Semántica |
|---:|---|---|:---:|---|
| 1 | `company_id` | `uuid` | No | Empresa de la unidad; informativa, no se envía a la RPC. |
| 2 | `unit_id` | `uuid` | No | Identidad que exige el lote. |
| 3 | `plate` | `text` | No | Placa/número interno de la unidad. |
| 4 | `config_id` | `uuid` | No | Configuración PATRON de la unidad. |
| 5 | `position_number` | `smallint` | No | Posición P1…Pn. |
| 6 | `side` | `text` | Sí | Lado configurado (`Izq`/`Der` u otro valor de catálogo). |
| 7 | `axle_number` | `smallint` | No | Número de eje. |
| 8 | `axle_type` | `text` | No | Tipo de eje configurado. |
| 9 | `is_ground` | `boolean` | No | Si la posición rueda en piso. |
| 10 | `installation_id` | `uuid` | Sí | Instalación activa; `NULL` si la posición está vacía. |
| 11 | `life_cycle_id` | `uuid` | Sí | Ciclo montado. Se copia a `expected_life_cycle_id*` al retirar/intercambiar. |
| 12 | `casing_id` | `uuid` | Sí | Casco del ciclo montado. |
| 13 | `casing_code` | `text` | Sí | Código permanente del casco; un casco puede no tener código visible. |
| 14 | `brand_name` | `text` | Sí | Marca del casco. |
| 15 | `model_name` | `text` | Sí | Modelo del casco. |
| 16 | `size_name` | `text` | Sí | Medida del casco. |
| 17 | `condition` | `tire_condition` | Sí | `N`, `R1`, `R2`, `R3` o `R4` del ciclo activo. |
| 18 | `retread_design` | `text` | Sí | Diseño de reencauche; normalmente `NULL` para `N`. |
| 19 | `cycle_number` | `smallint` | Sí | 0 para nuevo, 1 para R1, etc. |
| 20 | `installed_at` | `date` | Sí | Fecha de inicio de la instalación activa. |
| 21 | `odometer_at_install` | `integer` | Sí | Odómetro al instalar. |
| 22 | `rtd_at_install_mm` | `numeric` | Sí | RTD al instalar. |
| 23 | `is_empty` | `boolean` | No | `true` cuando no existe instalación activa. |
| 24 | `last_inspected_on` | `date` | Sí | Fecha de la última medición de esa unidad+posición. |
| 25 | `last_rtd_movi_mm` | `numeric` | Sí | RTD MOVI de esa medición. |
| 26 | `last_pressure_psi` | `numeric` | Sí | Presión de esa medición. |
| 27 | `last_inspection_tire_code` | `text` | Sí | Código observado en la última inspección, aunque no haya instalación. |
| 28 | `code_mismatch` | `boolean` | No | Hay instalación y el código observado difiere del casco tras `trim/upper`. |

### 2.3 Semántica que la UI no debe reinterpretar

- `is_empty=true` significa **sin instalación activa**. Puede coexistir con
  `last_inspection_tire_code` por datos legados de Excel.
- Una posición vacía debe seguir visible y seleccionable para `mount`.
- `code_mismatch` compara con `IS DISTINCT FROM`: `NULL` también participa. Una instalación
  con código de casco pero sin código inspeccionado puede quedar marcada. Mostrarlo como
  discrepancia/identidad por revisar, no afirmar automáticamente que el neumático físico es otro.
- En una posición vacía `code_mismatch` siempre es `false`.
- Los datos de última inspección pertenecen a la unidad+posición, no necesariamente a la
  instalación activa actual.

### 2.4 Lectura recomendada

Equivalente REST requerido: `unit_id=eq.<uuid>&order=position_number.asc`.

```js
async function loadUnitPositionState(unitId) {
  return RenovaSupabase.fetchView("v_unit_position_state", {
    unit_id: `eq.${unitId}`,
    order: "position_number.asc",
  });
}
```

Si devuelve cero filas, tratarlo como unidad inexistente/no autorizada o configuración sin
posiciones; no inventar posiciones en el cliente.

## 3. Resolver `unit_id` desde la navegación actual

`WEB/INSPECCIONES POR FECHA.html` navega hoy con:

```text
Inspecciones por unidad.html?inspection_id=<uuid>&plate=<placa>&date=<yyyy-mm-dd>
```

El parámetro llamado `inspection_id` es realmente el ID de inspección, no el `unit_id`.
`v_inspection_dashboard_rows` tampoco expone `unit_id`. La receta compatible es:

1. Cargar la inspección como hoy y obtener `rows[0].plate`.
2. Resolver la unidad por placa en `v_unit_position_state`; la placa es única dentro de empresa
   y RLS aporta implícitamente la empresa.
3. Usar `unit_id` de la primera fila para las lecturas y el lote.

```js
async function resolveUnitId({ inspectionId, plate }) {
  let resolvedPlate = plate;

  if (!resolvedPlate && inspectionId) {
    const inspectionRows = await RenovaSupabase.fetchView(
      "v_inspection_dashboard_rows",
      {
        select: "plate",
        inspection_id: `eq.${inspectionId}`,
        limit: "1",
      },
    );
    resolvedPlate = inspectionRows[0]?.plate;
  }

  if (!resolvedPlate) return null;

  const unitRows = await RenovaSupabase.fetchView("v_unit_position_state", {
    select: "unit_id,plate",
    plate: `eq.${resolvedPlate}`,
    order: "position_number.asc",
    limit: "1",
  });

  return unitRows[0]?.unit_id ?? null;
}
```

No guardar una tabla global `plate → unit_id` sin contexto de sesión. Volver a resolver al
cambiar de empresa/sesión.

## 4. Contrato de lectura: `v_tire_inventory_available`

### 4.1 Propósito

Lista ciclos que pueden montarse: ciclo `active` + casco `active` + ninguna instalación activa.
El **retén es derivado**, no una columna persistida. Incluye ciclos retirados por retención,
rotación u otro motivo que siga activo, y ciclos que nunca fueron instalados.

No reemplaza ni modifica `v_inventory_status`.

Seguridad remota comprobada:

- `security_invoker=true`.
- `authenticated`: `SELECT`.
- `anon`: sin `SELECT`.

### 4.2 Columnas exactas

| # | Columna | Tipo PostgreSQL | ¿Puede ser NULL? | Semántica |
|---:|---|---|:---:|---|
| 1 | `company_id` | `uuid` | No | Empresa del ciclo. |
| 2 | `life_cycle_id` | `uuid` | No | ID que se envía en un movimiento `mount`. |
| 3 | `casing_id` | `uuid` | No | Casco del ciclo. |
| 4 | `casing_code` | `text` | Sí | Código del casco. |
| 5 | `brand_name` | `text` | Sí | Marca. |
| 6 | `model_name` | `text` | Sí | Modelo. |
| 7 | `size_name` | `text` | Sí | Medida. |
| 8 | `condition` | `tire_condition` | No | `N`, `R1`, `R2`, `R3` o `R4`. |
| 9 | `cycle_number` | `smallint` | No | Número de ciclo. |
| 10 | `retread_design` | `text` | Sí | Diseño de reencauche. |
| 11 | `otd_mm` | `numeric` | Sí | Profundidad original del ciclo. |
| 12 | `last_removed_at` | `date` | Sí | Fecha del último retiro del ciclo. |
| 13 | `last_removal_reason` | `removal_reason` | Sí | Motivo del último retiro. |
| 14 | `last_rtd_mm` | `numeric` | Sí | RTD del último retiro. |
| 15 | `days_in_inventory` | `integer` | Sí | `current_date - last_removed_at`. |

Los cuatro campos finales son `NULL` para un ciclo nunca instalado/retirado. Eso no lo vuelve
inválido: puede montarse si sigue apareciendo en esta vista.

### 4.3 Lectura recomendada

Equivalente REST mínimo: `order=last_removed_at.desc`.

```js
async function loadAvailableInventory() {
  return RenovaSupabase.fetchView("v_tire_inventory_available", {
    order: "last_removed_at.desc",
  });
}
```

Si se quiere dejar los ciclos nunca retirados al final, PostgREST admite:
`last_removed_at.desc.nullslast,casing_code.asc`.

La UI puede filtrar por `size_name`, `condition` o texto, pero la disponibilidad final siempre
la revalida la RPC; no asumir que una fila sigue disponible después de haberla cargado.

## 5. RPC `confirm_tire_change_batch`

### 5.1 Firma y acceso

Firma remota exacta:

```sql
public.confirm_tire_change_batch(p_batch jsonb) returns jsonb
```

- `SECURITY DEFINER`, `search_path=public`.
- `EXECUTE` para `authenticated`.
- Sin `EXECUTE` para `anon` ni `PUBLIC`.
- Roles admitidos por el backend: `workshop_manager`, `fleet_manager` y `admin`, con perfil
  activo.
- Una llamada aplica todos los movimientos o ninguno.

### 5.2 Encabezado del payload v1

| Campo | Tipo JSON | Requerido | Regla real aplicada |
|---|---|:---:|---|
| `batch_version` | number entero | Sí | Debe ser exactamente `1`; no enviar `"1"`. |
| `batch_id` | string UUID | Sí | Lo genera el navegador **una vez** con `crypto.randomUUID()`. |
| `unit_id` | string UUID | Sí | Sale de `v_unit_position_state`. Debe pertenecer a la empresa del JWT. |
| `performed_at` | string `YYYY-MM-DD` | Sí | Fecha efectiva de todos los retiros/montajes. |
| `odometer` | number entero o `null` | No | Se aplica a todos los movimientos del lote. |
| `notes` | string o `null` | No | Se conserva en el payload auditable; la implementación actual no la pasa a cada operación. |
| `movements` | array no vacío | Sí | Uno o más movimientos v1. |

Campos adicionales se conservan en `payload`, pero no forman parte del contrato de ejecución.

### 5.3 Campos comunes de movimiento

| Campo | Tipo JSON | Regla |
|---|---|---|
| `seq` | number entero | Obligatorio y único dentro del lote. La respuesta se ordena por `seq`. |
| `op` | string | `send_to_retention`, `discard`, `mount` o `swap`. |
| `notes` | string o `null` | Opcional; se pasa a los retiros/montajes generados por ese movimiento. |

Los RTD (`rtd_mm`, `rtd_mm_a`, `rtd_mm_b`) son `number` o `null`, opcionales, y se
normalizan como `numeric(5,2)`.

### 5.4 `send_to_retention`

```json
{
  "seq": 1,
  "op": "send_to_retention",
  "position": 1,
  "expected_life_cycle_id": "ec82031c-ba0f-48be-a21b-975338cb5e56",
  "rtd_mm": 10.5,
  "notes": "A retén"
}
```

| Campo propio | Tipo | Requerido | Origen |
|---|---|:---:|---|
| `position` | number `smallint` | Sí | `position_number` de la vista. |
| `expected_life_cycle_id` | string UUID | Sí | `life_cycle_id` que la UI vio en esa posición. |
| `rtd_mm` | number/null | No | RTD al retirar. |

Genera un retiro `reason='retention'`; el ciclo queda activo y pasa a inventario disponible.

### 5.5 `discard`

```json
{
  "seq": 2,
  "op": "discard",
  "position": 2,
  "expected_life_cycle_id": "031b9de6-aa7e-41de-bcfb-8db52beac003",
  "rtd_mm": 2.0,
  "discard_cause": "Neumático",
  "photo_url": "https://example.com/descarte.jpg",
  "notes": "Corte profundo"
}
```

| Campo propio | Tipo | Requerido | Regla |
|---|---|:---:|---|
| `position` | number `smallint` | Sí | Posición origen. |
| `expected_life_cycle_id` | string UUID | Sí | Ciclo que la UI vio. |
| `rtd_mm` | number/null | No | RTD al retirar. |
| `discard_cause` | string | Sí | Debe coincidir exactamente con el enum. |
| `photo_url` | string no vacío | Sí | El backend exige texto, pero no valida formato/alcance de la URL. |

Causas exactas:

```text
Servicio
Neumático
Conducción-Ruta
Mantenimiento Alineación
Proveedor
Otro
```

Genera retiro `discard`, cierra el ciclo y descarta el casco. No aparece en inventario.

### 5.6 `mount`

```json
{
  "seq": 3,
  "op": "mount",
  "position": 3,
  "life_cycle_id": "aef720a6-f634-478f-898c-ac8dab652f46",
  "rtd_mm": 16.8,
  "notes": "Montaje desde retén"
}
```

| Campo propio | Tipo | Requerido | Origen/regla |
|---|---|:---:|---|
| `position` | number `smallint` | Sí | Destino configurado. |
| `life_cycle_id` | string UUID | Sí | Ciclo de `v_tire_inventory_available`. |
| `rtd_mm` | number/null | No | RTD al montar. |

El ciclo debe pertenecer a la empresa, seguir activo, tener casco activo y no estar montado.
La posición debe estar libre después de los retiros del mismo lote.

### 5.7 `swap`

```json
{
  "seq": 4,
  "op": "swap",
  "position_a": 4,
  "expected_life_cycle_id_a": "45ec521c-f459-4289-a2a8-6b1cf038b138",
  "position_b": 5,
  "expected_life_cycle_id_b": "b94d9621-eddf-4071-bac1-9408be2353e7",
  "rtd_mm_a": 12.1,
  "rtd_mm_b": 12.3,
  "notes": "Intercambio preventivo"
}
```

| Campo propio | Tipo | Requerido | Regla |
|---|---|:---:|---|
| `position_a` | number `smallint` | Sí | Origen del ciclo A y destino del ciclo B. |
| `expected_life_cycle_id_a` | string UUID | Sí | Ciclo visto originalmente en A. |
| `position_b` | number `smallint` | Sí | Origen del ciclo B y destino del ciclo A. |
| `expected_life_cycle_id_b` | string UUID | Sí | Ciclo visto originalmente en B. |
| `rtd_mm_a` | number/null | No | RTD del ciclo A; lo acompaña hasta B. |
| `rtd_mm_b` | number/null | No | RTD del ciclo B; lo acompaña hasta A. |

A y B no pueden ser la misma posición. La respuesta conserva el sufijo por **ciclo de
origen**: `installation_id_a` es la nueva instalación del ciclo A en `position_b`, y
`installation_id_b` la del ciclo B en `position_a`.

### 5.8 Payload v1 completo

```json
{
  "batch_version": 1,
  "batch_id": "9d0515b6-98d6-4b14-8b09-aadee10f816b",
  "unit_id": "0ccc3098-d4c5-4a1f-b2cf-09b384c0d500",
  "performed_at": "2026-07-13",
  "odometer": 210000,
  "notes": "Cambio general del turno",
  "movements": [
    {
      "seq": 1,
      "op": "send_to_retention",
      "position": 1,
      "expected_life_cycle_id": "ec82031c-ba0f-48be-a21b-975338cb5e56",
      "rtd_mm": 10.5,
      "notes": "A retén"
    },
    {
      "seq": 2,
      "op": "discard",
      "position": 2,
      "expected_life_cycle_id": "031b9de6-aa7e-41de-bcfb-8db52beac003",
      "rtd_mm": 2.0,
      "discard_cause": "Neumático",
      "photo_url": "https://example.com/descarte.jpg",
      "notes": "Corte profundo"
    },
    {
      "seq": 3,
      "op": "mount",
      "position": 3,
      "life_cycle_id": "aef720a6-f634-478f-898c-ac8dab652f46",
      "rtd_mm": 16.8,
      "notes": "Montaje desde retén"
    },
    {
      "seq": 4,
      "op": "swap",
      "position_a": 4,
      "expected_life_cycle_id_a": "45ec521c-f459-4289-a2a8-6b1cf038b138",
      "position_b": 5,
      "expected_life_cycle_id_b": "b94d9621-eddf-4071-bac1-9408be2353e7",
      "rtd_mm_a": 12.1,
      "rtd_mm_b": 12.3,
      "notes": "Intercambio preventivo"
    }
  ]
}
```

Los UUID del payload son ilustrativos y no deben copiarse. Los IDs de las respuestas y errores
de las secciones siguientes sí fueron capturados del remoto, pero ya no existen porque el bloque
terminó en rollback.

### 5.9 Reglas del lote

- Una posición puede aparecer como máximo una vez como origen y una vez como destino.
- `swap` cuenta como origen y destino para ambos lados.
- Sí se permite retirar de P3 y montar otro ciclo en P3 dentro del mismo lote.
- Todos los retiros se ejecutan antes de cualquier montaje, aunque el array venga intercalado.
- Cada origen se revalida contra `expected_life_cycle_id`; la UI nunca debe omitir ese dato.
- `performed_at` no puede ser anterior a `installed_at` de una instalación retirada.
- `odometer` se usa para todos los movimientos; no hay odómetro individual por movimiento.
- Cualquier fallo revierte todos los retiros, montajes y la fila de lote.
- Los lotes de la misma unidad, los ciclos compartidos y los reintentos del mismo `batch_id`
  se serializan en el backend.

## 6. Respuestas reales

### 6.1 Primer procesamiento exitoso

Respuesta capturada contra el remoto con los cuatro tipos de movimiento:

```json
{
  "plate": "151",
  "applied": true,
  "unit_id": "0ccc3098-d4c5-4a1f-b2cf-09b384c0d500",
  "batch_id": "9d0515b6-98d6-4b14-8b09-aadee10f816b",
  "movements": [
    {
      "op": "send_to_retention",
      "seq": 1,
      "removal_id": "e20b2214-7150-4d8e-b807-d0613ff7f35b",
      "installation_id": "f1d83566-d316-4084-bcc6-897963fd8792"
    },
    {
      "op": "discard",
      "seq": 2,
      "casing_id": "ea54103c-7bf7-4b69-9649-dee067aa08b8",
      "removal_id": "e59862da-ce96-452d-81cd-4c1aaa186f98"
    },
    {
      "op": "mount",
      "seq": 3,
      "installation_id": "47f40ae2-c0df-46df-9e97-21790eeeaff1"
    },
    {
      "op": "swap",
      "seq": 4,
      "removal_id_a": "29fcbbc7-31cd-46da-b9bf-a89b915d6465",
      "removal_id_b": "24644dd3-bb2c-4ca0-bf8a-5896516627c5",
      "installation_id_a": "b6f28b85-9127-4a2d-aea6-532f3a608ee9",
      "installation_id_b": "a28d2cf5-a6ce-4313-ba79-a92ec0d7e309"
    }
  ],
  "already_applied": false
}
```

### 6.2 Reintento idempotente

Al repetir exactamente el mismo `batch_id`, la respuesta real conservó todos los IDs anteriores
y cambió solo `already_applied`:

```json
{
  "batch_id": "9d0515b6-98d6-4b14-8b09-aadee10f816b",
  "applied": true,
  "already_applied": true,
  "unit_id": "0ccc3098-d4c5-4a1f-b2cf-09b384c0d500",
  "plate": "151",
  "movements": [
    {
      "op": "send_to_retention",
      "seq": 1,
      "removal_id": "e20b2214-7150-4d8e-b807-d0613ff7f35b",
      "installation_id": "f1d83566-d316-4084-bcc6-897963fd8792"
    },
    {
      "op": "discard",
      "seq": 2,
      "casing_id": "ea54103c-7bf7-4b69-9649-dee067aa08b8",
      "removal_id": "e59862da-ce96-452d-81cd-4c1aaa186f98"
    },
    {
      "op": "mount",
      "seq": 3,
      "installation_id": "47f40ae2-c0df-46df-9e97-21790eeeaff1"
    },
    {
      "op": "swap",
      "seq": 4,
      "removal_id_a": "29fcbbc7-31cd-46da-b9bf-a89b915d6465",
      "removal_id_b": "24644dd3-bb2c-4ca0-bf8a-5896516627c5",
      "installation_id_a": "b6f28b85-9127-4a2d-aea6-532f3a608ee9",
      "installation_id_b": "a28d2cf5-a6ce-4313-ba79-a92ec0d7e309"
    }
  ]
}
```

Regla crítica: la idempotencia se decide por `batch_id`. Un reintento devuelve el resultado
guardado sin comparar el nuevo payload con el original. Por tanto:

- Reintento de red: reusar el mismo `batch_id` y el mismo payload inmutable.
- Si el usuario edita cualquier movimiento: generar un `batch_id` nuevo.
- Nunca reciclar un UUID de un lote anterior.

## 7. Errores reales y manejo de UI

`supabase-js` devuelve un objeto `error` con `code`, `message`, `details` y `hint`. Registrar el
objeto completo para diagnóstico. Para comportamiento de dominio, usar `error.code` y el prefijo
estable de `error.message`: `[lote_invalido]` y `[no_disponible]` comparten `22023`.

Los ejemplos siguientes fueron ejecutados contra el remoto dentro de la captura revertida.

| Tipo | `error.code` | Ejemplo literal de `error.message` | Acción de UI |
|---|---|---|---|
| Lote inválido | `22023` | `[lote_invalido] Versión de lote no soportada (esperada 1, recibida 2).` | Conservar borrador, corregir validación/payload; no reintentar automáticamente. |
| Estado desactualizado | `40001` | `[estado_desactualizado] La posición P1 de 151 cambió desde que armaste el lote (esperabas el ciclo ec82031c-ba0f-48be-a21b-975338cb5e56, hoy está vacía). Recargá el estado de la unidad y rearmá los movimientos.` | Invalidar movimientos provisionales, recargar la vista y rearmar. |
| Ciclo no disponible | `22023` | `[no_disponible] El ciclo 031b9de6-aa7e-41de-bcfb-8db52beac003 no está disponible (estado del ciclo: discarded, estado del casco: discarded).` | Recargar inventario; quitar/reemplazar ese montaje. |
| Posición ocupada | `23505` | `[posicion_ocupada] La posición P3 de la unidad 151 ya está ocupada por el neumático CONTRACT-15ea5e24. Retiralo primero.` | Recargar estado; mostrar qué destino se ocupó. |
| Sin permiso | `42501` | `[sin_permiso] Tu rol (inspector) no permite registrar operaciones de taller.` | Bloquear confirmación y pedir una sesión/rol autorizado. |

Otros mensajes reales posibles:

- Fecha anterior a la instalación: la validación de `register_removal` puede subir sin uno
  de los cinco prefijos: `La fecha de retiro (...) no puede ser anterior a la de instalación
  (...).`
- Posición inexistente en la configuración: el helper puede devolver un mensaje de dominio sin
  prefijo estable.
- Unidad inexistente o de otra empresa: `42501` con prefijo `[sin_permiso]`.

Mostrar `error.message` escapado al usuario; nunca insertar HTML sin escapar.

## 8. Recetas web con `RenovaSupabase`

### 8.1 Inicialización

`supabase-demo.js` es módulo diferido. La pantalla debe seguir el patrón existente de
`renova-ready.js` y autenticar antes de cargar contratos protegidos.

```js
window.onRenovaSupabaseReady(async () => {
  const session = await RenovaSupabase.requireAuth();
  if (!session) return;

  const qs = new URLSearchParams(location.search);
  const unitId = await resolveUnitId({
    inspectionId: qs.get("inspection_id"),
    plate: qs.get("plate"),
  });

  if (!unitId) throw new Error("No se pudo resolver la unidad autorizada.");

  const [positions, inventory] = await Promise.all([
    loadUnitPositionState(unitId),
    loadAvailableInventory(),
  ]);

  // Renderizar modo Cambios con positions e inventory.
});
```

### 8.2 Construcción y persistencia del lote

```js
function createBatch({ unitId, performedAt, odometer, notes, movements }) {
  return {
    batch_version: 1,
    batch_id: crypto.randomUUID(),
    unit_id: unitId,
    performed_at: performedAt,
    odometer: odometer == null ? null : Number(odometer),
    notes: notes?.trim() || null,
    movements,
  };
}

function persistPendingBatch(batch) {
  localStorage.setItem(`renova:tire-change:${batch.batch_id}`, JSON.stringify(batch));
}
```

Persistir antes de la llamada. Si hay timeout o pérdida de red, recuperar ese mismo objeto y
reenviarlo sin cambiar `batch_id`. El backend tolera también un reintento automático del cliente
porque el identificador ya forma parte del payload.

Nota de versión: `supabase-js` 2.102.0+ habilita retries automáticos para fallos transitorios de
PostgREST, incluidas llamadas `.rpc()`. El cliente compartido importa hoy `@supabase/supabase-js@2`
sin fijar minor. La atomicidad e idempotencia del backend hacen seguro repetir **el mismo**
payload; Fase 2 debe fijar la versión y decidir explícitamente si conserva o desactiva ese retry.

### 8.3 Confirmación

```js
async function confirmTireChangeBatch(p_batch) {
  const { data, error } = await RenovaSupabase.supabase.rpc(
    "confirm_tire_change_batch",
    { p_batch },
  );

  if (error) {
    console.error("confirm_tire_change_batch", error);
    throw error;
  }

  localStorage.removeItem(`renova:tire-change:${p_batch.batch_id}`);
  return data;
}
```

No generar el UUID dentro de `confirmTireChangeBatch`: eso crearía otro lote en cada retry.

### 8.4 Clasificación de errores

```js
function classifyBatchError(error) {
  const message = error?.message || "";

  if (error?.code === "40001" || message.startsWith("[estado_desactualizado]")) {
    return "stale_state";
  }
  if (message.startsWith("[no_disponible]")) return "unavailable_cycle";
  if (error?.code === "23505" || message.startsWith("[posicion_ocupada]")) {
    return "occupied_position";
  }
  if (error?.code === "42501" || message.startsWith("[sin_permiso]")) {
    return "forbidden";
  }
  if (message.startsWith("[lote_invalido]")) return "invalid_batch";
  return "unknown";
}
```

### 8.5 Recuperación de estado desactualizado

```js
async function applyPendingBatch(pendingBatch) {
  try {
    const result = await confirmTireChangeBatch(pendingBatch);
    await Promise.all([
      loadUnitPositionState(result.unit_id),
      loadAvailableInventory(),
    ]);
  } catch (error) {
    if (classifyBatchError(error) === "stale_state") {
      // El payload viejo ya no representa el estado real: no reenviarlo.
      localStorage.removeItem(`renova:tire-change:${pendingBatch.batch_id}`);
      clearProvisionalMovements();
      await loadUnitPositionState(pendingBatch.unit_id);
      showToast("La unidad cambió. Recargamos el estado; armá nuevamente los movimientos.", true);
      return;
    }
    throw error;
  }
}
```

Para un simple error de red/timeout no borrar el lote persistido: reintentar el mismo payload.
Para un error de dominio (`lote_invalido`, estado, no disponible, ocupada, permiso), no hacer
retry ciego.

## 9. Precisiones de la implementación aplicada

Estas precisiones complementan el contrato propuesto de `PLAN.md` y describen lo que está
realmente desplegado:

- La idempotencia usa un advisory lock transaccional derivado de `batch_id`, además de la PK de
  `tire_change_batches`. Reintentos concurrentes del mismo lote se serializan.
- La RPC bloquea la unidad y los ciclos tocados en orden estable para reducir carreras y
  deadlocks.
- `notes` del encabezado solo queda en el payload auditado; usar `notes` por movimiento para que
  llegue a retiros/instalaciones.
- `photo_url` se valida como texto no vacío, no como URL ni como objeto de Storage.
- El resultado de descarte devuelve `removal_id` + `casing_id`; no devuelve
  `installation_id`.
- Un reintento por `batch_id` no compara payloads: el cliente debe tratar el payload como
  inmutable.
- La respuesta ordena movimientos por `seq`, no por el orden original del array.

## 10. Evidencia de verificación

Verificación de solo lectura contra catálogo remoto:

- `information_schema.columns`: 28 columnas en `v_unit_position_state` y 15 en
  `v_tire_inventory_available`, en el orden documentado.
- `pg_proc`: `p_batch jsonb`, retorno `jsonb`, `prosecdef=true`,
  `proconfig={search_path=public}`.
- ACL: función ejecutable por `authenticated`, no por `anon`/`PUBLIC`; vistas con SELECT solo
  autenticado y `security_invoker=true`.

Captura de respuestas:

- Se crearon datos efímeros y se invocó un lote con retén + descarte + montaje + swap dentro
  de un único `DO`.
- Se reinvocó el mismo `batch_id` y se capturaron los cinco errores en subtransacciones.
- El bloque terminó con `ERROR P0001: CONTRACT_CAPTURE {...}` para revertir todo.
- Verificación posterior: `captured_batch_rows=0`, `captured_casings=0`,
  `captured_removals=0`.

Fuentes locales contrastadas:

- `supabase/migrations/20260714100000_unit_position_state_and_inventory_views.sql`.
- `supabase/migrations/20260714110000_tire_change_batches_and_mount_helper.sql`.
- `supabase/migrations/20260714120000_confirm_tire_change_batch_rpc.sql`.
- `WEB/supabase-demo.js` (`fetchView`, sesión y cliente `supabase`).
- `WEB/instalacion.html` (patrón `.rpc()` + `if(error) throw error`).
- `WEB/INSPECCIONES POR FECHA.html` y `WEB/Inspecciones por unidad.html` (navegación actual).

Documentación oficial vigente contrastada:

- [Invocación RPC con supabase-js](https://supabase.com/docs/reference/javascript/rpc).
- [Errores de Data API en supabase-js](https://supabase.com/docs/guides/api/handling-errors-in-supabase-js).
- [Retries automáticos de PostgREST](https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js).
- [Grants explícitos y seguridad de Data API](https://supabase.com/docs/guides/api/securing-your-api).

## 11. Pendientes de Fase 2

- Implementar captura real de la foto de descarte y subida a Storage/servicio aprobado; hoy el
  modal solo simula la foto y el backend recibe una `photo_url`.
- Definir ruta/bucket, permisos, tamaño, compresión, reintentos y limpieza de fotos huérfanas.
- Renderizar todas las posiciones de la configuración, incluidas vacías.
- Diseñar estados provisionales del diagrama para retén, descarte, montaje y swap antes de
  confirmar.
- Evitar que una misma posición se duplique como origen/destino desde el editor de lote.
- Persistir/reanudar lotes pendientes con `batch_id` estable ante recarga o pérdida de red.
- Fijar la versión de `supabase-js` y decidir la política compartida de retry automático.
- Hacer smoke test real en navegador: sesión, lecturas, lote mixto, retry, conflicto, consola
  limpia y recarga persistente.
- Agregar pruebas de UI para render de vacías, armado de payload, errores y reintento.
