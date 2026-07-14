# task_12 — Foto real de descarte a Storage

1. **Propietario y alcance**: CLAUDE. Captura, preview, upload y limpieza de la foto obligatoria de
   descarte; integración en el flujo de descarte.
2. **Objetivo y resultado observable**: el descarte sube una foto real a Storage y produce una
   `photo_url` no vacía real; hay preview, reintento de upload y borrado de objetos huérfanos al
   cancelar/editar.
3. **Dependencias**: `task_03` (bucket+RLS), `task_10` (flujo de descarte). **Bloquea**: `task_13`.
4. **Decisiones**: **Decisión 3 RESUELTA** (bucket privado + URL firmada + path por empresa/lote +
   upload pre-sellado + limpieza de huérfanos). Desbloqueada; depende de que `task_03` haya aplicado
   el bucket/policies.
5. **Archivos permitidos**: `WEB/tire-change/storage-client.js` y la integración en la sección de
   descarte de `WEB/tire-change/movements-ui.js`. **Solo lectura**: la migración de `task_03`,
   `CONTRATOS_UI.md §5.5`, `AUDIT.md §4`. **Prohibido**: HTML, otros submódulos.
6. **Estado inicial verificado**: hoy la foto es un flag simulado
   (`Inspecciones por unidad.html:950-956`); backend exige `photo_url` no vacío sin validar Storage
   (`CONTRATOS_UI.md:294`, `:687`); remoto sin bucket hasta task_03 (`AUDIT.md §9`).
7. **Contratos**: `uploadDiscardPhoto({file, companyScope, batchId, seq})` → `photo_url` (firmada o
   pública según Decisión 3), usando el path `<company_id>/<batch_id>/<seq>.<ext>`;
   `deleteDiscardPhoto(pathOrUrl)` para huérfanos. Upload **antes** de sellar el lote (`AUDIT.md §4`).
8. **Pasos**: (1) Input `type=file accept=image/* capture=environment` + preview local
   (`URL.createObjectURL`). (2) Compresión/límite según Decisión 3. (3) Upload al bucket con el path
   por empresa/lote usando el cliente Storage de supabase-js. (4) Obtener `photo_url` y adjuntarla
   al movimiento `discard`. (5) Al cancelar/editar el descarte, borrar el objeto subido. (6)
   Reintento de upload independiente del retry de RPC.
9. **Estados**: upload en curso (deshabilitar confirmar); fallo de upload → reintentar/cancelar sin
   sellar; cancelación → borrar huérfano; edición del descarte → reemplazar/borrar la foto previa.
10. **Consistencia/seguridad**: el aislamiento por empresa lo impone la RLS de `storage.objects`
    (task_03), no el cliente; nunca `service_role` en el navegador; no dejar objetos huérfanos.
11. **Pruebas**: helper puro de construcción de path y de nombrado; el upload real se valida por
    smoke. Mock del cliente Storage para el flujo de reintento/borrado.
12. **Smoke real**: descartar con foto real → verificar el objeto en el bucket y la `photo_url`;
    cancelar otro descarte → verificar que el objeto se borró (sin huérfanos). Precondición:
    Decisión 3 y sesión de prueba (Decisión 10).
13. **Aceptación**: `photo_url` real no vacía; preview; huérfanos limpiados; reintento funciona.
14. **Comandos**: smoke desde `WEB/`; consulta de solo lectura al bucket para confirmar
    objeto/limpieza.
15. **Rollback/recuperación**: si el upload deja objetos, borrarlos con `deleteDiscardPhoto`;
    documentar cómo listar/borrar huérfanos por `batch_id`. No tocar la migración de task_03.
    **Nota operativa (verificada en task_03)**: el borrado NO puede hacerse por SQL directo —
    el trigger `storage.protect_delete()` lo bloquea (42501). `deleteDiscardPhoto` debe usar la
    **Storage API** (`RenovaSupabase.supabase.storage.from('tire-discard-photos').remove([path])`),
    gobernada por la policy `tire_discard_delete_own_upload` (solo el uploader dentro de su empresa).
    El upload usa `.upload(path, file, { upsert:false })` con el mismo cliente autenticado; la
    `photo_url` se obtiene con `.createSignedUrl(path, expiresIn)` (bucket privado).
16. **Handoff**: fila `task_12` con evidencia de upload/limpieza y la forma final de `photo_url`.
