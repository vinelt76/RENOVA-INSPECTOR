# PLAN — Modo Cambios de Neumáticos (backend Supabase)

Fecha: 2026-07-13. Basado en `AUDIT.md` (misma carpeta). Esta fase entrega **solo backend**:
migraciones, estructuras de lectura, RPC transaccional de lote y pruebas SQL. Ninguna tarea
modifica `WEB/` ni `app/`.

---

## 1. Arquitectura encontrada (qué se reutiliza)

| Pieza existente | Ruta | Uso en este plan |
|---|---|---|
| Modelo casco/ciclo/instalación/retiro + índices parciales de unicidad | `supabase/migrations/20260706120000_demo_vertical_slice.sql:161-242` | Base del lote; los índices `active_pos_uidx`/`active_cycle_uidx` son el candado final de concurrencia |
| RLS por empresa + `current_company_id()` | `supabase/migrations/20260710090000_dashboard_public_rls.sql` | La tabla nueva de lotes replica el patrón `select_own_company` |
| `fn_require_workshop_profile()` | `20260712000000_workshop_tire_operations_rpcs.sql:28-53` | Autenticación/rol/empresa de la RPC de lote |
| `fn_validate_free_position()` | ídem:62-102 | Validación de posición destino en montajes |
| `register_removal()` | ídem:204-282 | Se **compone** dentro del lote para retén/descarte/desmontes de swap (no se duplica su lógica) |
| Patrón de pruebas `TESTS_PASSED` | `supabase/tests/workshop_rpcs.test.sql` | Plantilla de los dos archivos de test nuevos |
| Umbrales efectivos `fn_effective_rtd_thresholds` | `20260710200000` | La vista de estado de unidad expone RTD de última inspección; los umbrales NO se hardcodean |

No se reutilizan: `register_full_installation` (crea casco nuevo; el lote monta ciclos
**existentes**) y `transfer_tire` (no soporta swap; el lote implementa su propia fase de
montaje tras los retiros).

## 2. Contratos propuestos

Todo lo de esta sección es **contrato propuesto** (no existe hoy). Cada objeto indica la tarea
que lo crea. Nombres en inglés, coherentes con el esquema existente.

### 2.1 Vista `v_unit_position_state` — estado completo de la unidad (crea: task_02)

Una fila por **posición de la configuración** de cada unidad (incluidas vacías).

```sql
create view public.v_unit_position_state
with (security_invoker = true) as
-- units × tire_positions (config) LEFT JOIN instalación activa
--   LEFT JOIN ciclo/casco LEFT JOIN última medición inspeccionada de esa posición
```

Columnas (tipos del esquema existente):

| Columna | Tipo | Origen |
|---|---|---|
| `company_id` | uuid | units |
| `unit_id`, `plate`, `config_id` | uuid, text, uuid | units |
| `position_number`, `side`, `axle_number`, `axle_type`, `is_ground` | smallint, text, smallint, text, boolean | tire_positions/axles |
| `installation_id` | uuid \| null | tire_installations activa (`not removed`) |
| `life_cycle_id`, `casing_id` | uuid \| null | vía instalación activa |
| `casing_code`, `brand_name`, `model_name`, `size_name` | text \| null | tire_casings |
| `condition`, `retread_design`, `cycle_number` | tire_condition \| null, text \| null, smallint \| null | tire_life_cycles |
| `installed_at`, `odometer_at_install`, `rtd_at_install_mm` | date, integer, numeric \| null | tire_installations |
| `is_empty` | boolean | `installation_id is null` |
| `last_inspected_on`, `last_rtd_movi_mm`, `last_pressure_psi`, `last_inspection_tire_code` | date, numeric, numeric, text \| null | última `inspection_measurements` de esa unidad+posición |
| `code_mismatch` | boolean | instalación activa presente y `last_inspection_tire_code` distinto de `casing_code` (deriva 5.5 del AUDIT: legado Excel visible, no oculto) |

Grants: `grant select … to authenticated` (NO anon). RLS de tablas base aplica por
`security_invoker`.

### 2.2 Vista `v_tire_inventory_available` — inventario/retén disponible (crea: task_02)

Retén = derivado (AUDIT 4.1/4.3): ciclos `status='active'` de cascos `status='active'` **sin**
instalación activa.

| Columna | Tipo |
|---|---|
| `company_id` | uuid |
| `life_cycle_id`, `casing_id` | uuid |
| `casing_code`, `brand_name`, `model_name`, `size_name` | text \| null |
| `condition`, `cycle_number`, `retread_design` | tire_condition, smallint, text \| null |
| `otd_mm` | numeric \| null |
| `last_removed_at`, `last_removal_reason`, `last_rtd_mm` | date \| null, removal_reason \| null, numeric \| null (del último tire_removal del ciclo) |
| `days_in_inventory` | integer \| null (`current_date - last_removed_at`) |

`security_invoker=true`, grant solo a `authenticated`. task_01 decide con evidencia remota si
esta vista reemplaza a la no-versionada `v_inventory_status` o convive con ella (no se toca
`v_inventory_status`: `historial-neumatico.html` depende de ella).

### 2.3 Tabla `tire_change_batches` — identidad e historial de lotes (crea: task_03)

```sql
create table public.tire_change_batches (
  id            uuid primary key,                 -- generado por el CLIENTE (idempotencia)
  company_id    uuid not null references companies(id),
  unit_id       uuid not null references units(id),
  requested_by  uuid not null references profiles(id),
  batch_version smallint not null,
  performed_at  date not null,
  payload       jsonb not null,                   -- lote completo tal como llegó
  result        jsonb not null,                   -- respuesta devuelta (para reintentos)
  applied_at    timestamptz not null default now()
);
```

RLS: enable + policy `select_own_company` (patrón 20260710090000). Sin grants de escritura a
anon/authenticated: solo escribe la RPC (security definer). Índice `(unit_id, applied_at desc)`.

### 2.4 Helper `fn_mount_existing_cycle` (crea: task_03, consume: task_04)

```sql
create function public.fn_mount_existing_cycle(
  p_profile       public.profiles,   -- perfil ya validado (no re-deriva JWT)
  p_life_cycle_id uuid,
  p_unit_id       uuid,
  p_position      smallint,
  p_installed_at  date,
  p_odometer      integer default null,
  p_rtd_mm        numeric default null,
  p_notes         text default null
) returns uuid   -- installation_id creado
language plpgsql security definer set search_path = public;
```

Valida: ciclo existe, es de la empresa, `status='active'`, casco `active`, **sin instalación
activa** (`for update` del ciclo); posición libre vía `fn_validate_free_position`. Inserta
`tire_installations`. `revoke all … from public, anon, authenticated` — helper interno, solo
invocable desde otras funciones definer (mismo criterio que un helper privado; a diferencia de
`fn_validate_free_position`, no se expone).

### 2.5 RPC `confirm_tire_change_batch(p_batch jsonb) returns jsonb` (crea: task_04)

`security definer`, `set search_path = public`, revoke public/anon, grant execute a
`authenticated`. Rol vía `fn_require_workshop_profile()`. **Una llamada = una transacción**:
aplica todos los movimientos o ninguno.

#### Estructura JSON del lote (versión 1)

```json
{
  "batch_version": 1,
  "batch_id": "7c9e1a4e-… (uuid v4 generado por el cliente)",
  "unit_id": "uuid de la unidad",
  "performed_at": "2026-07-13",
  "odometer": 123456,
  "notes": "texto libre opcional",
  "movements": [
    { "seq": 1, "op": "send_to_retention",
      "position": 3, "expected_life_cycle_id": "uuid",
      "rtd_mm": 8.5, "notes": null },

    { "seq": 2, "op": "discard",
      "position": 5, "expected_life_cycle_id": "uuid",
      "rtd_mm": 2.0, "discard_cause": "Neumático",
      "photo_url": "https://…", "notes": "corte profundo" },

    { "seq": 3, "op": "mount",
      "position": 3, "life_cycle_id": "uuid del ciclo del inventario/retén",
      "rtd_mm": 14.8, "notes": null },

    { "seq": 4, "op": "swap",
      "position_a": 1, "expected_life_cycle_id_a": "uuid",
      "position_b": 2, "expected_life_cycle_id_b": "uuid",
      "rtd_mm_a": 9.1, "rtd_mm_b": 10.4, "notes": null }
  ]
}
```

Reglas del contrato:

- `batch_id` **nace en el cliente** (mismo principio offline-first que los UUID de inspección).
- `expected_life_cycle_id*`: bloqueo optimista — es el ciclo que el cliente **vio** en esa
  posición al armar el lote. Si el ciclo activo real difiere (o la posición está vacía), la RPC
  rechaza **todo** el lote.
- `mount` exige que la posición quede libre **después** de aplicar los retiros del propio lote
  (retirar P3 a retén y montar otro en P3 en el mismo lote es válido) y que el ciclo esté
  disponible en inventario/retén de la empresa.
- Combinaciones: un mismo lote puede mezclar operaciones; una posición puede aparecer a lo sumo
  una vez como origen de retiro y una vez como destino de montaje. `swap` cuenta como
  origen+destino en ambas posiciones. Duplicados → error de validación.
- Fechas: `performed_at` no puede ser anterior a `installed_at` de ninguna instalación tocada
  (regla heredada de `register_removal:241-243`).
- Semántica interna: `send_to_retention` → `register_removal(reason='retention')`;
  `discard` → `register_removal(reason='discard', causa+foto obligatorias)`;
  `swap` → dos `register_removal(reason='rotation')` + dos `fn_mount_existing_cycle`;
  `mount` → `fn_mount_existing_cycle`. Orden interno: (1) validar payload y lockear las
  instalaciones activas de todas las posiciones tocadas **ordenadas por position_number**
  (anti-deadlock), verificando estado esperado; (2) todos los retiros; (3) todos los montajes;
  (4) persistir `tire_change_batches` y devolver resultado.
- Idempotencia: primer paso, `insert into tire_change_batches … on conflict (id) do nothing`.
  Nota de implementación: como el `result` completo se conoce recién al final, el patrón exacto
  es: intentar `select … from tire_change_batches where id = p_batch_id` (un reintento
  concurrente queda bloqueado por el índice PK hasta el commit del primero); si existe,
  devolver `result` almacenado con `"already_applied": true` **sin re-aplicar nada**.

#### Respuesta de éxito

```json
{
  "batch_id": "7c9e1a4e-…",
  "applied": true,
  "already_applied": false,
  "unit_id": "…", "plate": "AAV-803",
  "movements": [
    { "seq": 1, "op": "send_to_retention", "removal_id": "…", "installation_id": "… (la cerrada)" },
    { "seq": 2, "op": "discard", "removal_id": "…", "casing_id": "…" },
    { "seq": 3, "op": "mount", "installation_id": "… (la nueva)" },
    { "seq": 4, "op": "swap",
      "removal_id_a": "…", "removal_id_b": "…",
      "installation_id_a": "…", "installation_id_b": "…" }
  ]
}
```

Reintento idempotente: misma estructura con `"already_applied": true`.

#### Contrato de errores

Todos vía `raise exception` (la transacción entera revierte; PostgREST los entrega en
`error.message` — patrón que `instalacion.html` ya muestra con toast). Mensaje en español,
prefijado con un código estable entre corchetes para que la UI futura pueda ramificar:

| Código | Cuándo | errcode |
|---|---|---|
| `[lote_invalido]` | JSON malformado, versión no soportada, seq duplicado, posición repetida como origen/destino, op desconocida, campos obligatorios ausentes (p. ej. descarte sin causa/foto) | `22023` |
| `[estado_desactualizado]` | `expected_life_cycle_id` ≠ ciclo activo real en la posición (incluye "ahora está vacía" y "ahora hay otro") | `40001` |
| `[posicion_ocupada]` | destino de `mount` ocupado tras aplicar los retiros del lote | `23505`-like, mensaje claro |
| `[no_disponible]` | ciclo a montar no existe, no es de la empresa, no está `active` o ya está instalado en otra unidad | `22023` |
| `[sin_permiso]` | sesión/rol/empresa inválidos (lo emite `fn_require_workshop_profile`, mensaje existente) | `42501` |

Ejemplo: `[estado_desactualizado] La posición P3 de AAV-803 cambió desde que armaste el lote
(esperabas el ciclo 7c9e…, hoy está vacía). Recargá el estado de la unidad y rearmá los
movimientos.`

## 3. Grafo de dependencias

```
task_01 (CLAUDE, verificación remota/baseline)
  ├── task_02 (CODEX, vistas de lectura + pruebas de lectura)
  └── task_03 (CLAUDE, tabla de lotes + fn_mount_existing_cycle)
          └── task_04 (CLAUDE, RPC confirm_tire_change_batch)
                  └── task_05 (CLAUDE, pruebas de atomicidad/concurrencia/permisos/reintento)
task_02 + task_04 ──→ task_06 (CODEX, documentación de contratos para la UI futura)
task_02 + task_05 + task_06 ──→ task_07 (CLAUDE, revisión cruzada final)
```

Sin ciclos. Hitos revisables: **H1** = task_01+task_02 (lectura fiel aprobada; los contratos de
este PLAN quedan validados contra el remoto). **H2** = task_03+task_04 (lote + idempotencia).
**H3** = task_05+task_06+task_07 (concurrencia, permisos, contratos documentados, revisión).

Exclusión de escritura (archivos disjuntos por tarea):

| Tarea | Archivos que crea/modifica |
|---|---|
| task_01 | `tasks_cambios_neumaticos/BASELINE_REMOTO.md`, `STATE.md` (su fila) |
| task_02 | `supabase/migrations/20260714100000_unit_position_state_and_inventory_views.sql`, `supabase/tests/unit_state_reads.test.sql` |
| task_03 | `supabase/migrations/20260714110000_tire_change_batches_and_mount_helper.sql` |
| task_04 | `supabase/migrations/20260714120000_confirm_tire_change_batch_rpc.sql` |
| task_05 | `supabase/tests/tire_change_batch.test.sql` |
| task_06 | `tasks_cambios_neumaticos/CONTRATOS_UI.md` |
| task_07 | `tasks_cambios_neumaticos/REVISION_FINAL.md`, correcciones que devuelve como tareas ⚠ en `STATE.md` (no edita migraciones ajenas) |

Los timestamps de migración son tentativos: cada ejecutor debe usar un timestamp posterior al
de la última migración existente al momento de ejecutar, manteniendo el orden relativo
02 → 03 → 04.

## 4. Fase 2 (futura) — frontend, NO genera tareas ahora

Pantalla `WEB/Inspecciones por unidad.html`, conservando la navegación desde
`INSPECCIONES POR FECHA.html` (`openInspection`): toggle modo Inspección/Cambios; diagrama con
TODAS las posiciones desde `v_unit_position_state` (incl. vacías seleccionables); estado
provisional del lote en memoria del navegador (nada persiste hasta confirmar); modal
reutilizable de movimiento (retén/descarte con causa+foto real vía Storage, pendiente definir
bucket); buscador de inventario sobre `v_tire_inventory_available`; lista de movimientos
pendientes con deshacer; confirmación general → `RenovaSupabase.supabase.rpc(
'confirm_tire_change_batch', { p_batch })` con `batch_id` UUID generado en el navegador y
reintento seguro; manejo de `[estado_desactualizado]` recargando la vista. Pruebas de UI y
smoke test de navegador pertenecen a esa fase. Los contratos que consumirá son exactamente los
de la sección 2 (task_06 los documenta con ejemplos completos).

## 5. Decisiones y supuestos registrados

- **No se amplía `removal_reason`**: retén = `retention`, swap = `rotation` (semántica ya usada
  por `transfer_tire`). Nada nuevo que aprobar en enums.
- **Foto de descarte**: el backend exige `photo_url` no vacío en `discard` (paridad con la app
  y con `register_removal`); la captura real es de Fase 2.
- **`odometer_source`**: el lote registra `manual` si vino odómetro, `unknown` si no (mismo
  criterio que `register_removal:255-256`). Nunca inventa 0.
- **Reencauche fuera de alcance**: el lote no abre ciclos R+1 (sigue siendo proceso de taller
  físico externo, comentario `20260712000000:200-202`).
- Cualquier conflicto entre estos contratos y lo que task_01 encuentre en remoto se documenta
  en `BASELINE_REMOTO.md` y bloquea task_03/task_04 hasta ajustar este PLAN.
