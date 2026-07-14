-- RENOVA — Storage para la evidencia obligatoria de descarte (Fase 2 UI).
--
-- Contexto: la RPC confirm_tire_change_batch exige photo_url no vacío en cada
-- movimiento `discard` (ver tasks_cambios_neumaticos/CONTRATOS_UI.md §5.5), pero
-- el backend valida photo_url solo como TEXTO, no como objeto de Storage. Este
-- prerrequisito acotado crea el bucket y las policies para que el frontend suba
-- la foto real y obtenga una URL firmada. NO modifica el backend ya cerrado.
--
-- Decisión 3 (tasks_cambios_neumaticos_ui/DECISIONES.md, aprobada 2026-07-13):
--   bucket PRIVADO + URL firmada; path <company_id>/<batch_id>/<seq>.<ext>;
--   límite ~5 MB; JPEG/WebP; upload antes de sellar el lote; limpieza de
--   huérfanos por el mismo usuario que subió.
--
-- Aislamiento multiempresa: el primer segmento del path DEBE ser el company_id
-- del perfil autenticado (public.current_company_id(), definida en
-- 20260710090000_dashboard_public_rls.sql). No se confía en metadata editable
-- del cliente. Las policies se acotan a este bucket con bucket_id.
--
-- Idempotente: `on conflict do nothing` en el bucket y `drop policy if exists`
-- antes de cada create.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bucket privado
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tire-discard-photos',
  'tire-discard-photos',
  false,                                   -- privado: se sirve con URL firmada
  5242880,                                 -- 5 MiB
  array['image/jpeg', 'image/webp']        -- formatos admitidos
)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Policies sobre storage.objects (RLS ya habilitada por Supabase)
--    Todas se acotan a bucket_id = 'tire-discard-photos' para no afectar otros
--    buckets. La empresa se deriva del path, validada contra el perfil.
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. INSERT: solo authenticated, y solo dentro del prefijo de su propia empresa.
--     Nota: no validamos owner_id en el INSERT porque el Storage API de Supabase
--     lo asigna de forma autoritativa desde el JWT del uploader (ignora valores
--     de cliente). Si en el futuro se insertara por otro camino (p. ej. una
--     función security definer propia), NO asumir esa garantía y validar owner_id.
drop policy if exists "tire_discard_insert_own_company" on storage.objects;
create policy "tire_discard_insert_own_company" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tire-discard-photos'
    and (storage.foldername(name))[1] = (select public.current_company_id())::text
  );

-- 2b. SELECT: solo authenticated, solo objetos de su empresa. Habilita también la
--     creación de URLs firmadas (createSignedUrl exige acceso de lectura al objeto).
drop policy if exists "tire_discard_select_own_company" on storage.objects;
create policy "tire_discard_select_own_company" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tire-discard-photos'
    and (storage.foldername(name))[1] = (select public.current_company_id())::text
  );

-- 2c. DELETE: limpieza de huérfanos (cancelar/editar un descarte antes de sellar).
--     Restringida al usuario que subió el objeto (owner_id) DENTRO de su empresa,
--     para proteger la evidencia de descartes confirmados de otros usuarios.
drop policy if exists "tire_discard_delete_own_upload" on storage.objects;
create policy "tire_discard_delete_own_upload" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tire-discard-photos'
    and (storage.foldername(name))[1] = (select public.current_company_id())::text
    and owner_id = (select auth.uid())::text
  );

-- No se crea policy de UPDATE: los objetos no se mutan; una corrección sube un
-- objeto nuevo y borra el anterior. anon queda sin acceso (no tiene policies).

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback seguro (ejecutar manualmente solo si NO hay objetos productivos):
--   drop policy if exists "tire_discard_delete_own_upload" on storage.objects;
--   drop policy if exists "tire_discard_select_own_company" on storage.objects;
--   drop policy if exists "tire_discard_insert_own_company" on storage.objects;
--   delete from storage.buckets where id = 'tire-discard-photos';
-- (el delete del bucket falla si quedan objetos; borrarlos antes con cuidado).
-- ─────────────────────────────────────────────────────────────────────────────
