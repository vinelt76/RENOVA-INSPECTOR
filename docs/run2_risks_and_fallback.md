# Run 2 — Riesgos y planes de fallback

## Riesgos de la demo del jueves

| # | Riesgo | Prob. | Impacto | Mitigación / fallback |
|---|---|---|---|---|
| 1 | El sync app→Supabase no llega implementado a tiempo | Alta | Medio | **Fallback ya listo:** `supabase/demo_inspection_example.sql` inserta exactamente el payload que mandaría el teléfono (mismos campos y upserts — `run2_sync_payload_mapping.md`). La demo muestra la captura en la app local + el mismo dato entrando a Supabase "como lo enviará el sync". Narrativa intacta. |
| 2 | Sin internet en la sala | Media | Alto | La app es offline-first (funciona igual). Para el lado Supabase: ensayar y capturar pantallas/video de los SELECT como respaldo; o correr la secuencia completa en un Postgres local (así se validó — `run2_test_checklist.md`). |
| 3 | Proyecto Supabase no creado / credenciales faltantes | Media | Alto | El setup completo son 3 pegadas en el SQL Editor (≤10 min — `run2_demo_backend_setup.md`). Crear el proyecto HOY, no el jueves. |
| 4 | Alguien re-ejecuta seed o inspección durante la demo | Media | Bajo | Todo es idempotente: UUIDs fijos + ON CONFLICT. Verificado con doble ejecución. |
| 5 | Métricas "raras" en vivo (división por cero, RTD subió) | Baja | Medio | Las vistas devuelven NULL ante datos inválidos (fin < inicio, desgaste ≤ 0) — nunca rompen ni inventan. Verificado con el estado pre-inspección. |
| 6 | Se espera ver el dashboard HTML leyendo Supabase | Media | Medio | Decisión explícita: este run NO conecta los HTML (riesgo de romper la demo actual). Mostrar el SELECT con las MISMAS columnas que las cards y el plan de conexión (`run2_dashboard_connection_plan.md`). El mock sigue siendo el plan B visual eterno. |

## Deudas técnicas asumidas a consciencia (no son bugs)

| Deuda | Por qué se acepta ahora | Cuándo se paga |
|---|---|---|
| **RLS desactivada** | La demo opera vía SQL editor/service key; no hay clientes reales conectados. NO publicar la anon key con RLS off. | Run 3, junto con auth + profiles (política por `company_id`; criterio de task_14: probar con 2 usuarios). |
| `inspection_measurements.life_cycle_id` NULL | La app no conoce ciclos; las vistas unen por (unidad, posición, ventana temporal) y funcionan. | Run 3: resolver server-side contra la instalación activa al ingerir; discrepancia con `tire_code` = alerta de rotación no registrada. |
| Marca/modelo/medida como texto | Es lo que la app manda hoy; normalizar antes bloquearía la demo. | Run 3: tablas de catálogo del `schema_draft.sql` + backfill por matching de texto. |
| Umbral por medida con `size_name` texto | Sin catálogo aún. La demo usa la fila default (size NULL). | Run 3 junto con el catálogo. |
| Vistas/seed fuera de `migrations/` | Iterarán durante la demo; una migración debe ser inmutable. | Run 3: `create or replace view` consolidado en migración versionada. |
| Cierre de eventos (retiro/reencauche) sin función SQL | El seed escribe los eventos a mano; las funciones (`fn_register_removal`, `fn_start_retread`) requieren validar reglas con RENOVA (cascada de descarte, causa+foto obligatorias). | Run 3. |
| `unit_photo_url` sin Storage | Evitar bucket + policies para el jueves. | Run 3 (subir a Storage en el drainer). |

## Qué NO se rompió (garantías de este run)

- La app local: **cero cambios en `app/`** — build, flujo y SQLite idénticos.
- Los dashboards HTML y sus mocks/fórmulas: **cero cambios** (solo se documentó su conexión futura).
- El borrador Run 1 (`schema_draft.sql`): intacto salvo una nota de encabezado que remite al
  modelo de ciclos (la tabla `tires` queda supersedida — documentado, no borrado).
- La demo actual (HTML abiertos en navegador): sigue funcionando exactamente igual.

## Señales de alerta para el jueves

- Si el SELECT de `v_tire_performance` devuelve 0 filas → faltó el seed (paso 2 del checklist).
- Si `km_run` es NULL después de insertar la inspección → la fecha `inspected_on` es anterior a
  `installed_at` (2026-01-15) — usar `current_date` o cualquier fecha posterior.
- Si el upsert de mediciones falla por FK → se insertaron mediciones antes que la cabecera
  (orden del drainer: cabecera primero).
