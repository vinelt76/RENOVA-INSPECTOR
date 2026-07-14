# AUDIT — Modo Cambios de Neumáticos (backend)

Fecha de auditoría: **2026-07-13**. Orquestador: Fable 5. Alcance: lógica backend pura
(Supabase). El frontend es Fase 2 futura; los archivos de `WEB/` se auditaron solo como
consumidores.

---

## 1. Pantalla objetivo: `WEB/Inspecciones por unidad.html` (solo lectura en esta fase)

### 1.1 Carga de datos y navegación

- Única fuente de datos: `RenovaSupabase.fetchView('v_inspection_dashboard_rows', params)`
  (línea 755), filtrando por `inspection_id=eq.…` o `plate=eq.…` según query params (753-754).
  No existe **ninguna** llamada `.rpc(` ni escritura en todo el archivo (verificado por grep).
- Navegación de entrada: `WEB/INSPECCIONES POR FECHA.html:381-389` (`openInspection(unitId)`)
  arma `?inspection_id&plate&date` y navega. Ojo con el naming: `u.id` es en realidad el
  `inspection_id` de `v_fleet_unit_status` (línea 332: `id: r.inspection_id`), no un `unit_id`.
  La navegación se conserva tal cual; los contratos nuevos deben poder resolverse desde
  `inspection_id` **o** `plate` (la vista de lectura de unidad debe aceptar `unit_id`, que hoy
  la pantalla NO tiene directamente — lo obtiene de las filas: la fila de
  `v_inspection_dashboard_rows` no incluye `unit_id`; ver brecha 5.4).

### 1.2 Gemelo digital y selección de posiciones

- Diagrama: divs con CSS 3D, ruedas `wheel-1`..`wheel-8` con posición hardcodeada
  (líneas 561-582). **Deriva respecto al hecho inicial 6**: el markup contempla 8 posiciones
  (2-4-2), no 6; `updateWheelStates()` (líneas 984-996) oculta con `display:none` las ruedas
  sin datos en `POSICIONES`. El mapa `SHORT` (línea 968) también cubre P1-P8.
- Selección: dock `#pos-dock` (línea 972, `renderDock()`) + click en `.wheel` (línea 1007);
  `select(n)` (líneas 986-1005 aprox.) exige que `POSICIONES[n]` exista → **una posición vacía
  hoy no es seleccionable ni visible**. `POSICIONES` se construye solo con filas de la
  inspección (`rowsToPositions`, líneas 683-712): si la inspección no midió una posición, esa
  posición desaparece del diagrama.
- Colores: `estadoEfectivo()` (líneas 817-828) combina anomalía crítica → naranja, RTD
  "Para Reencauche" → naranja, "Próximo"/anomalía → amarillo, resto verde. Los estados vienen
  precalculados de la vista (`rtd_state`, `rtd_a_state..d_state`, `pressure_state_fixed`); el
  HTML no recalcula umbrales.
- Para el modo Cambios futuro haría falta: posiciones vacías renderizadas y seleccionables
  (la config de la unidad como fuente, no la inspección), y un estado visual "provisional"
  por movimiento pendiente. Eso justifica que la estructura de lectura entregue **todas** las
  posiciones de `tire_positions` de la config, con `is_empty`.

### 1.3 Botones de acción actuales (no persisten)

- `#btn-reten` y `#btn-descartar` (líneas 519-520). Handlers: `enviarARetenAction()` solo
  `showToast` (líneas 919-921); modal de descarte (`overlay-descartar`, líneas 612-633) exige
  foto+causa pero `ds-confirmar` solo `showToast` (líneas 957-961). La "foto" es un booleano
  simulado (`descartarFotoTomada = true` al click, línea 946) — no hay captura ni upload real.
  **Hecho inicial 1 confirmado.**
- Las causas del `<select id="ds-causa">` (líneas 620-627) coinciden 1:1 con el enum
  `discard_cause` de la migración base (`20260706120000:52-55`).

## 2. Sesión y cliente compartido: `WEB/supabase-demo.js`

- Expone `window.RenovaSupabase` (líneas 192-203): `enabled`, `supabase` (cliente supabase-js
  completo), `fetchView`, `showBadge`, `signIn/signOut`, `getSession`, `onAuthStateChange`,
  `requireAuth`, `onDataChange`.
- `requireAuth()` (158-166) pinta modal de login si no hay sesión. `fetchView` (24-37) hace GET
  REST con el `access_token` de la sesión (o anon key si no la hay).
- **Para escritura no falta nada estructural**: `instalacion.html` ya llama
  `RenovaSupabase.supabase.rpc(...)` directamente. Es el patrón a reutilizar en Fase 2.
- Carga como módulo diferido; los dashboards deben arrancar con `onRenovaSupabaseReady(fn)`
  (`renova-ready.js`).

## 3. Operaciones reutilizables de `WEB/instalacion.html`

- Patrón de invocación (reutilizable en Fase 2): `const { error } = await
  RenovaSupabase.supabase.rpc("register_full_installation", {p_…})` (línea 643),
  `register_removal` (717), `transfer_tire` (782). Manejo de errores: `if(error) throw error`
  → `showToast(esc(err.message), true)`; recarga con `await load()` tras éxito.
- Específico de esa pantalla (no reutilizable): su fuente de datos es
  `v_rendimiento_dashboard_rows` (líneas 550-554), que solo lista **instalaciones activas** —
  no sirve para posiciones vacías ni inventario/retén.
- El formulario de retiro muestra causa/foto solo si `reason='discard'` (`onReasonChange`,
  líneas 686-690) — misma regla que la RPC.

## 4. Modelo de datos y RPCs actuales (Supabase, según migraciones locales)

### 4.1 Tablas y candados (migración `20260706120000_demo_vertical_slice.sql`)

- `tire_casings` (161-179): casco; `unique (company_id, code) where code is not null` (176-177).
- `tire_life_cycles` (181-201): ciclo; `unique (casing_id, cycle_number)`; índice parcial
  `tire_life_cycles_active_uidx` = 1 ciclo activo por casco (198-199).
- `tire_installations` (203-223): índices parciales `active_pos_uidx` (unit_id,
  position_number where not removed) y `active_cycle_uidx` (life_cycle_id where not removed)
  (218-221) — **candados finales de concurrencia ya existentes**; cualquier RPC de lote los
  hereda gratis.
- `tire_removals` (225-242): 1:1 con instalación (`installation_id unique`), `reason`,
  `discard_cause`, `photo_url`, `odometer_source`.
- Enums (32-61): `removal_reason` = 'retread','rotation','retention','discard','other';
  `discard_cause` = 6 valores; `tire_condition` = N..R4; `odometer_source`.
  **Hechos iniciales 5 y 7 confirmados.**
- `tire_positions`/`axles`/`vehicle_configs`: posiciones por configuración; catálogo PATRON
  compartido entre empresas (sin company_id).

### 4.2 RLS y permisos (migración `20260710090000_dashboard_public_rls.sql`)

- RLS activa en las 14 tablas (46-59); policies `select_own_company` vía
  `current_company_id()` (security definer, 30-41); catálogo PATRON legible por cualquier
  autenticado (115-125). Escritura revocada de anon/authenticated (135-140): **toda escritura
  pasa por RPCs security definer**.
- Excepciones `anon` móviles: `mobile_anon_read_companies` (20260710240000) y grants de RPCs
  de captura — no afectan este plan pero prohíben abrir vistas nuevas a `anon`.

### 4.3 RPCs de taller (migración `20260712000000_workshop_tire_operations_rpcs.sql`)

- `fn_require_workshop_profile()` (28-53): deriva empresa/rol del JWT; exige
  workshop_manager/fleet_manager/admin activo. `fn_validate_free_position()` (62-102): unidad
  de la empresa, posición existente en config, posición libre.
- `register_full_installation` (110-195): **siempre crea casco nuevo** y falla si el código ya
  existe (156-159). **Hecho 3 confirmado**: no sirve para montar existente.
- `register_removal` (204-282): `select … for update` de la instalación activa (232-237);
  discard → cierra ciclo+casco; retread → cierra ciclo; retention/rotation/other → ciclo queda
  activo y disponible (retén derivado). **Hechos 2 y 5 confirmados.**
- `transfer_tire` (287-339): valida destino libre ANTES, retira con reason='rotation' y monta.
  Falla si destino ocupado — no hay swap ni reemplazo. **Hecho 4 confirmado**: no existe lote,
  swap, montaje de existente ni revalidación de estado esperado.
- Grants: revoke de public/anon, execute a authenticated (345-352). `search_path = public`
  fijo en todas.

### 4.4 Vistas vigentes

- `v_unit_tire_status` / `v_fleet_unit_status` / `v_fleet_status_summary`: última versión en
  `20260710220000_fix_tire_status_anomaly_warning_floor.sql` (12-101), `security_invoker=true`,
  grant a anon+authenticated. Se basan en **inspecciones**, no en instalaciones → no
  representan posiciones vacías ni la instalación activa. **Hecho 6 (parte de vistas)
  confirmado.**
- `v_inspection_dashboard_rows`: última versión en `20260710200000` (línea 30). No incluye
  `unit_id` (ver 5.4).
- `v_rendimiento_dashboard_rows` (20260710160000): solo instalaciones activas.
- `v_unit_current_route`, `v_installation_route_attribution` (20260712010000).

### 4.5 Pruebas SQL

- `supabase/tests/workshop_rpcs.test.sql`: un `DO $$` que simula JWT con
  `set_config('request.jwt.claims', …)` (línea 76), usa datos reales de MOVIL/CRUZ, prueba
  T1-T9 (ocupación, atomicidad de traslado, descarte, retén, aislamiento entre empresas, rol)
  y termina con `raise exception 'TESTS_PASSED'` (línea 180) para revertir todo.
  **Hecho 8 confirmado.** Patrón a seguir en las pruebas nuevas.

## 5. Derivas y discrepancias detectadas (no resueltas en silencio — regla CLAUDE.md)

1. **Hecho inicial 6, parcial**: el diagrama NO dibuja solo P1-P6; el markup tiene 8 ruedas
   (líneas 561-582) y oculta las ausentes. Lo que sí es cierto: la fuente de posiciones es la
   inspección, no la configuración, así que las posiciones sin medición desaparecen.
2. **`v_inventory_status` y vistas `v_casing_*` sin DDL versionado**: el test
   (`workshop_rpcs.test.sql:130,144`) y `historial-neumatico.html` las usan, y
   `knowledge/ai/05` las lista como vigentes, pero **ninguna migración de
   `supabase/migrations/` las define** (grep exhaustivo). Existen solo en remoto. Riesgo:
   entorno no reproducible; no se conoce localmente su `security_invoker` ni sus grants.
   → task_01 debe volcar el DDL remoto real y decidir con evidencia si la nueva vista de
   inventario la reemplaza o convive.
3. **Specs sin reglas de cambios**: `specs/reglas_negocio.md` no contiene ninguna regla sobre
   retiro, retén, descarte, rotación ni intercambio (grep sin resultados). La semántica vive
   solo en la migración 20260712000000 y en `knowledge/ai/07`. Los contratos de PLAN.md se
   diseñan como **contratos propuestos** apoyados en esa implementación; si el negocio aprueba
   reglas distintas, hay que actualizar specs + plan juntos.
4. **`v_inspection_dashboard_rows` no expone `unit_id`**: la pantalla objetivo hoy no tiene el
   `unit_id` que las estructuras de lectura y la RPC de lote necesitan. La vista de estado de
   unidad nueva debe ser consultable por `unit_id` y también resoluble desde `plate` (+empresa
   implícita por RLS); documentado como requisito del contrato de lectura.
5. **Inspecciones sin instalación (legado Excel)**: `save_inspection` solo *resuelve*
   `life_cycle_id` desde la instalación activa si existe (`20260710210000:104-105`); nunca crea
   casco/ciclo/instalación. Unidades importadas por `importar.html` pueden mostrar código de
   neumático en la inspección sin que exista `tire_installations`. El estado de lectura debe
   exponer ambas cosas (instalación activa real + último código inspeccionado) para que la UI
   futura muestre la discrepancia en lugar de ocultarla, y el lote debe rechazar operaciones
   sobre posiciones sin instalación real (salvo montar en vacía).
6. **Advisors/permisos remotos no verificados desde el repo**: esta auditoría se hizo sobre
   migraciones locales. task_01 exige contrastar esquema, RLS, grants y advisors reales del
   proyecto (MCP/skill de Supabase, solo lectura) antes de implementar.

## 6. Brechas respecto al objetivo funcional

| # | Brecha | Evidencia |
|---|---|---|
| B1 | No existe RPC de lote atómico con bloqueo optimista ni idempotencia | 20260712000000 completo; no hay tabla de lotes |
| B2 | No se puede montar un neumático existente desde retén | `register_full_installation:156-159` rechaza código existente |
| B3 | No existe intercambio de dos posiciones | `transfer_tire:313` exige destino libre |
| B4 | No hay estructura de lectura con TODAS las posiciones (incl. vacías) + instalación activa | vistas basadas en inspecciones (20260710220000) o en instalaciones activas (20260710160000) |
| B5 | Inventario/retén sin vista versionada en el repo | deriva 5.2 |
| B6 | Sin pruebas SQL de concurrencia (dos transacciones en conflicto) ni de reintento idempotente | workshop_rpcs.test.sql es secuencial |

## 7. Riesgos

- **Seguridad**: las RPCs son `security definer` (bypasean RLS): cada entidad del lote debe
  revalidarse contra `company_id` del perfil; nada de confiar en IDs del navegador. Vistas
  nuevas: `security_invoker=true` y grant **solo a authenticated** (no anon, a diferencia de
  las vistas de flota que sí lo tienen por la deuda móvil).
- **Concurrencia**: el bloqueo optimista del lote (estado esperado) debe complementarse con
  `for update` ordenado por posición para evitar deadlocks entre dos lotes de la misma unidad;
  los índices parciales existentes son el candado final.
- **Idempotencia**: reintento del mismo lote (red móvil de taller) no debe duplicar retiros ni
  instalaciones → identidad de lote persistida.
- **Legado**: posiciones con inspección pero sin instalación (5.5); casings con `code null`;
  ciclos `retreaded` cuyo ciclo siguiente se abre "por fuera" (comentario 20260712000000:200-202).
- **UX futura**: el modal de descarte actual simula la foto; el contrato del lote transporta
  `photo_url` como texto — el flujo real de captura/upload es pendiente de Fase 2 y no bloquea
  el backend.
- **Historial**: prohibido pisar historia — el lote solo agrega filas (removals, installations)
  y cambia status; nunca borra ni reescribe instalaciones cerradas.

## 8. Nota

No se modificó ningún archivo fuera de `tasks_cambios_neumaticos/`. Nada trivial se arregló:
las derivas quedaron registradas arriba y como pasos de task_01.
