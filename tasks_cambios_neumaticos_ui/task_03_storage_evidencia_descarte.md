# task_03 — Storage: bucket privado + RLS para evidencia de descarte

1. **Propietario y alcance**: CLAUDE + `sync-migration-reviewer`. Crear el bucket y las políticas
   de `storage.objects` para la foto obligatoria de descarte. Prerrequisito de backend acotado; no
   rediseña el backend cerrado.
2. **Objetivo y resultado observable**: existe un bucket privado, con RLS que aísla por empresa vía
   path, verificable con una prueba SQL. `task_12` puede subir y leer fotos reales.
3. **Dependencias**: `task_01` (Decisión 3 aprobada). **Bloquea**: `task_12`.
4. **Decisiones**: **Decisión 3 RESUELTA** (2026-07-13) — bucket **privado** `tire-discard-photos`,
   **URL firmada**, path `<company_id>/<batch_id>/<seq>.<ext>`, ~5 MB JPEG/WebP, upload pre-sellado.
   Desbloqueada. La aplicación de la migración sigue exigiendo aprobación humana explícita
   (cambio remoto sensible).
5. **Archivos permitidos**: `supabase/migrations/2026NNNN_tire_discard_photos_bucket.sql`,
   `supabase/tests/tire_discard_photos.test.sql`. **Solo lectura**: migraciones existentes de RLS
   (`20260710090000_dashboard_public_rls.sql`), `CONTRATOS_UI.md §5.5`. **Prohibido**: tocar las 3
   migraciones `20260714*` ya aplicadas ni cualquier archivo de `WEB/`.
6. **Estado inicial verificado**: remoto **sin buckets** ni policies (`AUDIT.md §4`, §9). Patrón de
   RLS por empresa: `current_company_id()` / `select_own_company` (`PLAN.md §1`).
7. **Contratos**: bucket `tire-discard-photos` privado; path `<company_id>/<batch_id>/<seq>.<ext>`;
   policies INSERT/SELECT solo `authenticated` cuyo `(storage.foldername(name))[1]::uuid =
   current_company_id()`; sin acceso `anon`. `photo_url` que consumirá la RPC = URL (firmada o
   pública según Decisión 3) del objeto (`CONTRATOS_UI.md:294`).
8. **Pasos**: (1) Timestamp de migración posterior al último existente. (2) `insert into
   storage.buckets` (privado, límite de tamaño, mime types de Decisión 3). (3) Policies de
   `storage.objects` para INSERT y SELECT con el chequeo de empresa por path; revoke a `anon`.
   (4) Test SQL patrón `TESTS_PASSED` que verifica: bucket existe y es privado; un usuario de
   empresa A no ve/inserta en el path de empresa B; `anon` sin acceso. (5) Pasar por
   `sync-migration-reviewer` antes de aplicar. (6) Aplicar solo con aprobación humana explícita.
9. **Estados**: si la Decisión 3 elige público, ajustar SELECT en consecuencia y documentar el
   riesgo de exposición. Ante error de aplicación, no dejar bucket a medias.
10. **Consistencia/seguridad**: nunca confiar en metadata editable del cliente para el aislamiento;
    la empresa se deriva del path validado contra `current_company_id()`. No exponer `service_role`.
11. **Pruebas**: `supabase/tests/tire_discard_photos.test.sql` (auto-revertible). Sin fixtures que
    dejen objetos reales.
12. **Smoke real**: subir un objeto de prueba con una sesión de empresa A y confirmar que empresa B
    no lo lee; borrarlo. (Coordinado con Decisión 10.)
13. **Aceptación**: bucket + policies verificados; test SQL PASS; `sync-migration-reviewer` sin
    hallazgos P0/P1.
14. **Comandos** (tras confirmar acceso): aplicar la migración vía flujo aprobado; correr el test
    SQL remoto de solo verificación.
15. **Rollback**: `delete from storage.buckets where id='tire-discard-photos'` + `drop policy` de
    las creadas (solo si no hay objetos productivos); documentar en la migración un bloque de
    reversión seguro.
16. **Handoff**: fila `task_03` con el nombre real del bucket, la convención de path final y el
    resultado del reviewer.
