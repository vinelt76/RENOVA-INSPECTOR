-- RENOVA — Pruebas del bucket privado de evidencia de descarte y su RLS.
--
-- Requiere que 20260715000000_tire_discard_photos_bucket.sql esté aplicada.
-- Se ejecuta como un solo DO block; el error TESTS_PASSED del final revierte
-- todos los objetos de Storage insertados y el resto del setup (sin residuo).
--
-- Simula sesión con request.jwt.claims + `set local role authenticated`, igual
-- que unit_state_reads.test.sql. Aislamiento verificado por path de empresa.

do $$
declare
  v_profile_a   public.profiles%rowtype;
  v_profile_b   public.profiles%rowtype;
  v_batch       uuid := gen_random_uuid();
  v_name_a      text;
  v_name_b      text;
  v_count       integer;
  v_bucket_pub  boolean;
begin
  -- Dos tenants reales cualesquiera con perfil activo.
  select p.* into v_profile_a
    from public.profiles p
   where p.active
   order by p.company_id, p.id
   limit 1;

  select p.* into v_profile_b
    from public.profiles p
   where p.active
     and p.company_id <> v_profile_a.company_id
   order by p.company_id, p.id
   limit 1;

  if v_profile_a.id is null or v_profile_b.id is null then
    raise exception 'SETUP: se necesitan perfiles activos de dos empresas';
  end if;

  -- Precondición: el bucket existe y es privado.
  select public into v_bucket_pub
    from storage.buckets where id = 'tire-discard-photos';
  if v_bucket_pub is null then
    raise exception 'SETUP: el bucket tire-discard-photos no existe (¿migración aplicada?)';
  end if;
  if v_bucket_pub then
    raise exception 'T0: el bucket tire-discard-photos NO debe ser público';
  end if;

  v_name_a := v_profile_a.company_id::text || '/' || v_batch::text || '/1.jpg';
  v_name_b := v_profile_b.company_id::text || '/' || v_batch::text || '/1.jpg';

  -- ── Sesión de la empresa A ──────────────────────────────────────────────
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_a.id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- T1: A puede insertar un objeto bajo el prefijo de SU empresa.
  insert into storage.objects (bucket_id, name, owner_id)
  values ('tire-discard-photos', v_name_a, v_profile_a.id::text);

  -- T2: A NO puede insertar bajo el prefijo de otra empresa (RLS with check).
  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('tire-discard-photos', v_name_b, v_profile_a.id::text);
    raise exception 'T2: se permitió insertar en el path de otra empresa';
  exception
    when insufficient_privilege then
      null; -- esperado: new row violates row-level security policy
  end;

  -- T3: A ve su propio objeto.
  select count(*) into v_count
    from storage.objects
   where bucket_id = 'tire-discard-photos' and name = v_name_a;
  if v_count <> 1 then
    raise exception 'T3: A no ve su propio objeto (obtuvo %)', v_count;
  end if;

  -- ── Sesión de la empresa B ──────────────────────────────────────────────
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_profile_b.id, 'role', 'authenticated')::text,
    true
  );

  -- T4: B no ve el objeto de A (RLS de SELECT por empresa).
  select count(*) into v_count
    from storage.objects
   where bucket_id = 'tire-discard-photos' and name = v_name_a;
  if v_count <> 0 then
    raise exception 'T4: B ve % objeto(s) de la empresa A', v_count;
  end if;

  -- Nota: el DELETE de la limpieza de huérfanos NO se puede ejercitar por SQL
  -- directo: el trigger `storage.protect_delete()` bloquea todo `delete from
  -- storage.objects` con 42501 ("Direct deletion from storage tables is not
  -- allowed. Use the Storage API instead."). El borrado real ocurre vía Storage
  -- API (supabase.storage.remove), gobernado por la policy
  -- `tire_discard_delete_own_upload`. Su enforcement se verifica en el smoke de
  -- navegador de task_12; aquí solo se comprueba abajo que la policy existe.
  execute 'reset role';

  -- ── T7: el rol anon no tiene ningún acceso (no hay policies `to anon`) ────
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
  execute 'set local role anon';

  select count(*) into v_count
    from storage.objects
   where bucket_id = 'tire-discard-photos' and name = v_name_a;
  if v_count <> 0 then
    raise exception 'T7: anon ve % objeto(s) del bucket privado', v_count;
  end if;

  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values ('tire-discard-photos', v_name_a || '.anon', null);
    raise exception 'T7: anon logró insertar en el bucket privado';
  exception
    when insufficient_privilege then
      null; -- esperado
  end;

  execute 'reset role';

  -- GRANTS: las 3 policies esperadas presentes y acotadas al bucket.
  select count(*) into v_count
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in (
       'tire_discard_insert_own_company',
       'tire_discard_select_own_company',
       'tire_discard_delete_own_upload'
     );
  if v_count <> 3 then
    raise exception 'GRANTS: faltan policies del bucket (encontradas %)', v_count;
  end if;

  raise exception 'TESTS_PASSED';
end;
$$;
