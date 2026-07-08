# RUN 6 — Límites conocidos y pendientes

## Seguridad (bloqueante antes de producción / deploy público)
- **RLS deshabilitado en las 14 tablas** — cualquiera con la anon key lee y
  escribe todo. Aceptado SOLO para demo privada/local. Antes de exponer nada:
  habilitar RLS + políticas por empresa (profiles ya modela usuario↔empresa↔rol)
  y restringir el grant de `save_inspection` a `authenticated`.
- Sin auth: `inspector_id` siempre NULL ("Inspector: sin dato" en dashboards).

## Sync de la app
- **No hay cola persistente.** El push es automático al completar la inspección
  (debounce 1.2 s) y reintenta mientras la pantalla siga abierta; si se cierra la
  app con el push fallido, NO se reintenta al recuperar red. El flag local
  `sincronizado` existe pero no se actualiza. Pendiente: `sync_queue` +
  drenador (task 14 fase 1 completa).
- Fotos (unidad y anomalía) no se suben (Storage pendiente).
- `temperature_mode` (FRÍO/CALIENTE) no viaja — y la referencia de presión en
  CALIENTE sigue **ABIERTA** en specs (no se implementa hasta definirla).

## Datos / fórmulas
- **% DESGASTE difiere del Excel**: Excel = consumido/(inicial−retiro) (→100%);
  vista y HTML = consumido/OTD (→75%). Decidir la fórmula oficial con RENOVA y
  alinear `specs/reglas_negocio.md` + vista + HTML.
- Seed: unidad 225 pos 3 tiene RTD 9.0 (el PDF muestra 4). Corregir seed si se
  quiere paridad exacta con el PDF en la demo.
- Posiciones 1 y 2 (Dirección): **intencionalmente fuera del alcance del
  rendimiento actual** — el Excel real no las evalúa. No es dato faltante; no
  crear filas falsas.
- Umbral de balance de eje sigue hardcodeado en rendimiento.html (15%); existe
  `company_settings`/`v_axle_performance.balance_threshold_pct` para leerlo.

## Dashboards
- inventario.html e historial-neumatico.html siguen 100% mock. Los links
  "Ver historial" desde rendimiento con códigos reales caen en el mock (muestra
  "sin datos"). Candidatas: v_inventory_status, v_casing_history_summary.
- Retén / descarte / reinstalación / retiro: **NO conectados a propósito**
  (regla del run). tire_removals tiene 1 fila seed únicamente.
- vista-flota muestra 1–2 unidades por fecha con datos reales (así es el Excel);
  si se quiere "toda la flota en una fecha", definir la regla (última inspección
  por unidad) como vista nueva.
- En máquinas sin `supabase-config.local.js`, la consola loguea un 404 por ese
  script antes de caer a mock (inherente al patrón script-tag opcional).

## Proyectos Supabase
- Existe un segundo proyecto **vacío** llamado "RENOVA-INSPECTOR"
  (`zkifhlayacqexksrfdxc`, creado 2026-07-07). Todo el backend real está en
  `fbxupwwgiebhlciqftpw`. Decidir: migrar al proyecto con nombre correcto
  (re-aplicar migraciones + seed) o borrar el vacío para evitar confusión.
- La migración local `supabase/migrations/20260709090000_minimal_inspections_schema.sql`
  (borrador `inspection_items`/`plate_number`) **nunca se aplicó** y su contrato ya
  no lo usa nadie: considerarla obsoleta/borrarla en el próximo run.
