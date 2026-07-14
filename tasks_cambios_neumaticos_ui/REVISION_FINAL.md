# REVISIÓN FINAL — Fase 2 UI · Modo Cambios de Neumáticos

**Veredicto: APTO ✓** · Revisor: CLAUDE (revisión independiente) · Fecha: 2026-07-14

Smoke real E2E ejecutado con sesión de rol de taller sobre una unidad de prueba dedicada en el
proyecto productivo, con navegador Chrome real (Playwright, no unit tests). Toda la evidencia
proviene de la ejecución real; la suite automatizada estaba verde antes de empezar.

## 1. Entorno y datos de prueba

- Proyecto: `fbxupwwgiebhlciqftpw` (único productivo). Empresa: **MÓVIL BUS**
  (`f243affb-…`). Usuario de taller: rol `fleet_manager` activo (aceptado por
  `fn_require_workshop_profile`). Credenciales entregadas por el humano solo en la sesión, nunca
  al repo.
- **Unidad de prueba dedicada `QA-CN16`** (Decisión 10), config 2-4-2 (8 posiciones), creada para
  esta validación. Casings/ciclos propios `CN16-0001..0008` (marca `QA-TEST`) para no tocar datos
  reales de la flota. Estado inicial sembrado:
  - P1..P6 ocupadas y limpias · **P7 con `code_mismatch` (REVISAR IDENTIDAD)** por diseño ·
    **P8 vacía** · ciclo `CN16-0008` en `v_tire_inventory_available` (sin retiro previo).
- **La unidad se conservó** tras el smoke (pedido explícito del humano para la prueba de campo):
  se reseteó al estado prístino inicial y se limpió la historia/foto generadas por el smoke.

## 2. Servido y arranque

- `WEB/` servido estático; login por el modal de `supabase-demo.js` con la clave publicable/anon
  de `supabase-config.public.js` (sin secretos). URL de entrada:
  `Inspecciones por unidad.html?plate=QA-CN16&mode=cambios`.
- Resolución perezosa de unidad por placa → carga en paralelo de `v_unit_position_state` y
  `v_tire_inventory_available` reutilizando la sesión. Estado del controlador: `status: ready`.

## 3. Lote mixto confirmado (evidencia real)

Armado en la UI y confirmado con **una sola** `confirm_tire_change_batch`:

| seq | Operación | Posición | Detalle |
|---|---|---|---|
| 1 | `send_to_retention` | P1 | ciclo `CN16-0001` a retén |
| 2 | `discard` | P2 | causa `Servicio` + **foto real** subida a Storage |
| 3 | `swap` | P3 ⇄ P4 | intercambio cruzado |
| 4 | `mount` | P8 | montaje de `CN16-0008` desde inventario |

Resultado verificado en la base tras el éxito:

- `tire_change_batches`: 1 fila, `applied=true`, 4 movimientos, `odometer=250800`,
  `performed_at=2026-07-14`.
- `tire_removals`: retención `CN16-0001`; rotación `CN16-0003`+`CN16-0004` (swap); descarte
  `CN16-0002` con `discard_cause=Servicio` y **`photo_url` no nulo**.
- Posiciones finales: P1/P2 vacías, **P3=`CN16-0004` y P4=`CN16-0003`** (cruce correcto),
  P8=`CN16-0008`, P5..P7 intactas.
- Foto de descarte real en el bucket privado `tire-discard-photos` en
  `<company>/<batch_id>/2.jpg` (14.6 KB, `image/jpeg`, owner = usuario de taller).

## 4. Persistencia tras recarga

- Recarga del navegador tras confirmar: el estado aplicado persiste (P1/P2 vacías, P3⇄P4,
  P8 montada) por venir de la base.
- **Borrador editable restaurado**: armado un retén sobre P5, tras recargar el mismo contexto el
  borrador se restauró con su movimiento intacto (scope por usuario/empresa/unidad en
  `localStorage`).

## 5. Error real provocado y manejo

- Se simuló un **cambio concurrente**: P5 se retiró por fuera del borrador armado. Al reabrir e
  intentar confirmar, la UI:
  - mostró el banner **"El estado de la unidad cambió. Revisá el borrador antes de confirmar."**,
  - bloqueó el confirm con la validación **"No se puede retirar desde una posición vacía."**,
  - **conservó el borrador** (no lo descartó ni aplicó nada parcial).
- El backstop server-side `[estado_desactualizado]` (revalidación optimista por
  `expected_life_cycle_id` con bloqueo) y el retry idempotente por `batch_id` están cubiertos por
  la suite SQL/integración (task_15) y por `tasks_cambios_neumaticos/`.

## 6. Consola, seguridad y no-regresión

- **Consola sin errores de aplicación.** El único 404 es la petición automática de Chrome a
  `/favicon.ico` (no referenciado por la app); benigno y ajeno al código. Sin `pageerror`.
- **Sin secretos ni datos sensibles en logs**: no aparece la contraseña, `anonKey`,
  `service_role` ni tokens en la consola ni en peticiones ≥400.
- **Sin regresión en Inspección**: sin `?mode` abre en Inspección (tab seleccionada, panel de
  Cambios oculto); ida y vuelta Inspección↔Cambios restaura la navegación y limpia `?mode`.
- `code_mismatch` (REVISAR IDENTIDAD) se rinde correctamente en P7 y en las posiciones cuya
  identidad cambió tras swap/mount.

## 7. Cierre documental y suite

- Suite scoped `WEB/tire-change`: **10 archivos, 132/132 verde** (previo al smoke).
- `npm run docs:check`: **verde** (15 notas IA + 12 humano) tras actualizar
  `knowledge/ai/05` (vistas/datos validados) y `knowledge/ai/07` (UI de taller implementada y
  smoke ejecutado).

## 8. Limpieza / estado dejado

- Unidad `QA-CN16` **conservada** y reseteada al estado prístino inicial (P1..P6 limpias, P7 con
  REVISAR IDENTIDAD, P8 vacía, `CN16-0008` en inventario) para la prueba de campo del 2026-07-15.
- Historia del smoke eliminada: lote, retiros e instalaciones generadas; foto huérfana de descarte
  borrada vía Storage API (la policy DELETE por owner+empresa funcionó; el borrado SQL directo está
  bloqueado por `storage.protect_delete`, como documenta task_03).

## 9. ⚠ Hallazgos devueltos a su tarea dueña

- **Ninguno bloqueante.** Observación menor (no bloquea el veredicto): la tarjeta "UNIDAD EN
  BAHÍA" rotula la configuración 2-4-2 como **"BUS · 7 POS"** cuando la unidad tiene 8 posiciones
  (parece contar posiciones ocupadas, no configuradas). Es sólo un texto de encabezado del panel
  histórico de Inspección; no afecta el diagrama de Cambios (que rinde P1–P8 correctamente) ni el
  lote. Se sugiere revisar el conteo en la tarea dueña del encabezado si se desea que refleje las
  posiciones configuradas.
