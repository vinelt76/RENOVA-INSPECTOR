# Migración Supabase Virginia → São Paulo — Plan de implementación

> # ⛔ NO EJECUTAR — MIGRACIÓN DESCARTADA EL 2026-07-29
>
> **Este plan es archivo, no trabajo pendiente.** La migración se descartó tras medir la latencia real desde
> Lima: Virginia (`us-east-1`) resultó unas tres veces más rápido que São Paulo (`sa-east-1`), con mediana de
> 28 ms contra 86 ms y ventaja en todos los percentiles. La premisa del plan —que São Paulo bajaría la latencia
> de la flota peruana— era falsa.
>
> Se ejecutó únicamente Task 0 (herramientas y verificación de red). **No se tocó Virginia, São Paulo quedó
> vacío y no hubo ningún cambio en el código de las apps ni en la configuración.** No hay nada que revertir.
>
> Motivo completo, salvedades de la medición y hallazgos colaterales:
> `knowledge/ai/bitacora/2026/2026-07-29.md` y `knowledge/ai/08 - Infraestructura seguridad y despliegue.md`.
>
> **Se conserva** porque el análisis sigue siendo válido si algún día la decisión de región cambia, y porque
> documenta riesgos reales del sistema que no dependen de la región: pérdida de la cola de sync ante desajuste
> de firma del APK, URLs firmadas persistidas en `tire_casings.discard_photo_url`, historial de
> `supabase_migrations` desincronizado y paridad de RLS/ACL. Si se reabre, **volver a validar todo contra el
> estado del repo y de los proyectos en ese momento**: lo de abajo refleja el 2026-07-29.
>
> ---
>
> **Estado original:** revisión 3, corregida el 2026-07-29 contra el repositorio, ambos proyectos remotos y la
> documentación vigente de Supabase.
>
> **Ejecución original prevista:** completar las 10 tareas en orden, de Task 0 a Task 9. Cada paso marcado
> **[APROBACIÓN REQUERIDA]** necesita confirmación humana inmediata antes de ejecutarse. No delegar la ventana
> de corte a subagentes autónomos.

## Objetivo y decisión de corte

Mover RENOVA INSPECTOR del proyecto Supabase de Virginia
(`fbxupwwgiebhlciqftpw`, `us-east-1`, Postgres 17) al proyecto de São Paulo
(`xuvwbikycdzwbdsmxhnb`, `sa-east-1`, Postgres 17), preservando:

- esquema `public`, vistas, funciones, triggers, RLS y privilegios;
- historial remoto de `supabase_migrations`;
- datos de negocio;
- usuarios de Auth y sus contraseñas;
- bucket, políticas y objetos de Storage;
- configuración de Realtime, Auth, Data API y demás servicios usados.

El corte será **duro y coordinado**. Las apps Android llevan la URL de Supabase compilada dentro del APK, por
lo que no existe un corte progresivo seguro sin replicación continua. Virginia seguirá intacto hasta la ventana
de corte y quedará bloqueado contra nuevas escrituras durante el período de gracia.

## Estado verificado al redactar este plan

- Virginia y São Paulo están `ACTIVE_HEALTHY`.
- Virginia tiene 23 tablas `public`, todas con RLS; São Paulo aún no tiene tablas de negocio.
- Virginia publica en Realtime `public.inspections` y `public.inspection_measurements`.
- Virginia tiene 5 usuarios, 5 identidades, sin MFA configurado ni SSO, un bucket y un objeto de Storage.
- Virginia tiene tres políticas personalizadas en `storage.objects` para `tire-discard-photos`.
- Ambos proyectos tienen 77 migraciones internas de Auth y 61 de Storage. **Esos historiales gestionados no se
  exportan ni se sobrescriben.**
- El historial de aplicación de `supabase_migrations` existe en Virginia y está vacío en São Paulo.
- São Paulo trae objetos de plataforma propios, entre ellos `public.rls_auto_enable()`. Los advisors se comparan
  contra el baseline de cada proyecto, no por igualdad literal.
- No hay Edge Functions ni secretos de Vault en Virginia.
- El repositorio no tiene workflows activos de GitHub Pages. `git push` no equivale a publicar.

## Reglas globales

- Nunca guardar contraseñas, `service_role`, secret keys ni tokens en el repo, el plan o notas.
- Usar connection strings de **Session pooler, puerto 5432**, salvo que se haya verificado conexión directa IPv6.
- Todos los dumps viven fuera del repo, bajo un directorio con permisos `0700`.
- Toda restauración SQL usa `--single-transaction --variable ON_ERROR_STOP=1`.
- No escribir en `auth.schema_migrations`, `storage.migrations` ni `realtime.schema_migrations`.
- No confiar solo en conteos: comparar esquema, ACL, checksums, FK, Storage y flujos reales.
- Antes de aplicar SQL sensible, ejecutar la revisión exigida por `CLAUDE.md`. Si
  `sync-migration-reviewer` no está disponible en la sesión, hacer una revisión humana equivalente y registrar
  quién la aprobó; no omitir el control.
- Los archivos existentes de `supabase/migrations/` no se reejecutan para reconstruir `public`: el remoto es la
  fuente autoritativa. La única excepción permitida es usar la migración de Storage como referencia legible
  para comprobar las tres políticas, no aplicarla completa.

## Material de trabajo

```bash
umask 077
export MIG="$HOME/renova-migracion-sp"
mkdir -p "$MIG/artifacts" "$MIG/baselines" "$MIG/storage-tool" "$MIG/bin"
chmod 700 "$MIG"
export PATH="$MIG/bin:$PATH"
```

Los dumps contienen datos de producción y hashes de contraseña. No subirlos a Git ni copiarlos al chat.

`$MIG/bin` contiene dos utilidades creadas al ejecutar Task 0 (ver ese task para el porqué):

- `pg17` — cliente Postgres 17.10 en contenedor podman. **Todos los `psql`/`pg_dump` del plan se invocan a
  través de él**: `pg17 psql ...`, `pg17 pg_dump ...`.
- `set-credenciales` — captura interactiva de hosts y contraseñas hacia `$MIG/.pgpass` y `$MIG/conn.env`.

---

# FASE A — Construir y validar São Paulo

### Task 0: Precondiciones, acceso y baseline inmutable

**Produce:** herramientas listas, credenciales verificadas y baselines de ambos proyectos.

- [x] **Paso 1: Confirmar el método de restauración** — decidido 2026-07-29

  **Restore lógico**, por decisión explícita del usuario. No se usa «Restore to another project». El resto del
  plan (Tasks 1 a 3) queda vigente tal como está escrito.

- [x] **Paso 2: Instalar/verificar clientes Postgres 17** — hecho 2026-07-29, con desviación registrada

  **No instalar `postgresql` con `dnf` en esta máquina.** Verificado el 2026-07-29: Fedora 44 solo ofrece
  `postgresql` 18.3 y `postgresql16` 16.13; no existe paquete 17.x. Ambos proyectos corren Postgres 17, y un
  dump producido por `pg_dump` 18 queda fuera del envelope soportado para restaurar en un servidor 17 (la
  salida de `pg_dump` está garantizada solo hacia servidores de versión igual o mayor). Instalar 18.3 habría
  introducido ese riesgo en silencio.

  Vía adoptada: cliente **17.10 exacto** en contenedor, vía `podman` 5.8.4, sin `sudo` y sin modificar el
  sistema. El wrapper `$MIG/bin/pg17` monta `$MIG` en la **misma ruta absoluta** dentro del contenedor, así
  que todos los comandos `psql`/`pg_dump` del plan funcionan sin reescribir rutas:

  ```bash
  export MIG="$HOME/renova-migracion-sp"
  export PATH="$MIG/bin:$PATH"
  pg17 pg_dump --version   # pg_dump (PostgreSQL) 17.10
  pg17 psql --version      # psql (PostgreSQL) 17.10
  ```

  A partir de acá, en todo el plan, leer `psql ...` como `pg17 psql ...` y `pg_dump ...` como
  `pg17 pg_dump ...`. Detalles del wrapper: usa `--userns=keep-id` (sin eso, el UID cae en el rango subuid de
  podman rootless y la escritura en `$MIG` falla con `Permission denied`), `--network=host` y `:Z` para
  SELinux.

  CLI de Supabase: 2.109.1, confirmada.

- [ ] **Paso 3: Obtener las dos connection strings**

  Verificado el 2026-07-29: la **conexión directa no sirve en esta máquina**. `db.<ref>.supabase.co` resuelve
  solo a IPv6 y la red no tiene ruta IPv6 (`Network unreachable`). Los cuatro poolers candidatos sí responden
  por IPv4 en el puerto 5432 (`aws-0`/`aws-1` de `us-east-1` y `sa-east-1`), así que el Session pooler no es
  una preferencia sino un requisito, tal como fija la regla global.

  Las credenciales **no se exportan a mano ni se pegan en el chat**. Correr el helper interactivo, que pide el
  host y la contraseña con `read -s` (sin eco, sin historial, sin aparecer en `ps`) y escribe dos archivos
  `0600` dentro de `$MIG`:

  ```bash
  MIG="$HOME/renova-migracion-sp" "$MIG/bin/set-credenciales"
  ```

  Produce:
  - `$MIG/.pgpass` — formato `host:5432:postgres:postgres.<ref>:<password>`, leído por libpq;
  - `$MIG/conn.env` — `VIRGINIA_DB_URL`, `SAO_PAULO_DB_URL` y `PGPASSFILE`, **sin contraseña embebida**.

  Esto se desvía de la redacción original («exportarlas interactivamente, nunca en archivos») por una razón
  concreta: la shell del agente no conserva estado entre comandos, así que un `export` interactivo no llega a
  las invocaciones siguientes. Un archivo `0600` dentro de un directorio `0700`, eliminado en Task 9 Paso 5, es
  el equivalente práctico y mantiene el secreto fuera de la conversación, que es la propiedad que importa.

  Cada comando posterior arranca con:

  ```bash
  export MIG="$HOME/renova-migracion-sp"; export PATH="$MIG/bin:$PATH"; . "$MIG/conn.env"
  ```

  Verificación de este paso:

  ```bash
  pg17 psql "$VIRGINIA_DB_URL"   -c 'select current_database(), version();'
  pg17 psql "$SAO_PAULO_DB_URL"  -c 'select current_database(), version();'
  ```

  Ambos deben reportar Postgres 17.

- [ ] **Paso 4: Resolver el acceso CLI**

  El perfil usado durante la revisión devolvió `403 LegacyDbConfigLoginRoleStatusError`. Autenticar una cuenta
  Owner/Admin si se van a usar comandos `--linked`:

  ```bash
  npx supabase login
  npx supabase link --project-ref fbxupwwgiebhlciqftpw
  npx supabase db dump --linked --dry-run
  ```

  Los dumps principales de este plan usan `--db-url`, por lo que pueden continuar con credenciales DB aunque
  `link` no esté disponible. No continuar si tampoco funciona la conexión DB.

- [ ] **Paso 5: Guardar baseline de ambos proyectos**

  Ejecutar en ambos y guardar la salida bajo `$MIG/baselines/`:

  ```sql
  select n.nspname as schema_name, c.relname, c.relkind,
         pg_get_userbyid(c.relowner) as owner
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','auth','storage','supabase_migrations')
   order by 1,2;

  select schemaname, tablename, rowsecurity
    from pg_tables where schemaname='public' order by 1,2;

  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public','auth','storage')
   order by 1,2,3;

  select table_name, grantee, privilege_type
    from information_schema.role_table_grants
   where table_schema='public' and grantee in ('anon','authenticated')
   order by 1,2,3;

  select routine_name, specific_name, grantee, privilege_type
    from information_schema.role_routine_grants
   where routine_schema='public' and grantee in ('anon','authenticated')
   order by 1,2,3;

  select schemaname, tablename
    from pg_publication_tables
   where pubname='supabase_realtime' order by 1,2;

  select extname, extversion, n.nspname as extension_schema
    from pg_extension e join pg_namespace n on n.oid=e.extnamespace
   order by 1;

  select count(*) from vault.secrets;
  ```

  Además, guardar advisors de seguridad y rendimiento de ambos proyectos. Los warnings preexistentes de São
  Paulo, incluido `rls_auto_enable`, forman su baseline y no cuentan como regresión de la migración.

- [ ] **Paso 6: Confirmar alcance especial de Auth**

  ```sql
  select
    (select count(*) from auth.users) users,
    (select count(*) from auth.identities) identities,
    (select count(*) from auth.mfa_factors) mfa_factors,
    (select count(*) from auth.sso_providers) sso_providers,
    (select count(*) from auth.custom_oauth_providers) custom_oauth_providers;
  ```

  Este plan presupone password login, sin MFA/SSO/custom OAuth. Si cualquiera de los tres últimos conteos es
  distinto de cero, detenerse y ampliar el dump de Auth antes de seguir.

---

### Task 1: Crear y revisar los dumps autoritativos

**Produce:** esquema `public`, datos iniciales, Auth mínimo e historial de migraciones de aplicación.

- [ ] **Paso 1: Dump de roles solo si existen roles personalizados**

  Comparar `pg_roles` contra los roles gestionados por Supabase. Si no hay roles propios, registrar “no aplica”.
  Si existen:

  ```bash
  npx supabase db dump --db-url "$VIRGINIA_DB_URL" \
    --role-only -f "$MIG/roles_virginia.sql"
  ```

  Revisar y eliminar únicamente grants incompatibles documentados por Supabase. Las contraseñas de roles LOGIN
  no viajan y deberán establecerse de forma interactiva.

- [ ] **Paso 2: Dump de esquema `public`**

  ```bash
  npx supabase db dump --db-url "$VIRGINIA_DB_URL" \
    --schema public -f "$MIG/schema_public.sql"
  ```

  Verificar tablas, vistas `security_invoker`, funciones, triggers, índices, RLS, políticas y GRANT. Revisar
  cualquier `OWNER`, `SECURITY DEFINER`, `search_path`, referencia al ref viejo y cláusula de versión explícita
  en extensiones.

- [ ] **Paso 3: Capturar las políticas personalizadas de Storage**

  Crear `$MIG/storage_custom.sql` con **solo** estas políticas, después de comprobar que sus expresiones coinciden
  con el baseline remoto:

  ```sql
  drop policy if exists "tire_discard_insert_own_company" on storage.objects;
  create policy "tire_discard_insert_own_company" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'tire-discard-photos'
      and (storage.foldername(name))[1] = (select public.current_company_id())::text
    );

  drop policy if exists "tire_discard_select_own_company" on storage.objects;
  create policy "tire_discard_select_own_company" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'tire-discard-photos'
      and (storage.foldername(name))[1] = (select public.current_company_id())::text
    );

  drop policy if exists "tire_discard_delete_own_upload" on storage.objects;
  create policy "tire_discard_delete_own_upload" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'tire-discard-photos'
      and (storage.foldername(name))[1] = (select public.current_company_id())::text
      and owner_id = (select auth.uid())::text
    );
  ```

  No incluir tablas, funciones ni migraciones internas de `storage`.

- [ ] **Paso 4: Dump mínimo de Auth**

  Exportar únicamente usuarios e identidades. No exportar sesiones, refresh tokens, MFA de sesión,
  `auth.schema_migrations` ni otras tablas gestionadas:

  ```bash
  pg_dump "$VIRGINIA_DB_URL" \
    --data-only --no-owner --no-privileges --format=plain \
    --table=auth.users --table=auth.identities \
    --file="$MIG/auth_users_identities.sql"
  ```

  Inspeccionar el archivo y exigir que solo tenga datos de `auth.users` y `auth.identities`.

- [ ] **Paso 5: Dump de datos `public`**

  ```bash
  npx supabase db dump --db-url "$VIRGINIA_DB_URL" \
    --data-only --use-copy --schema public \
    -f "$MIG/data_public.sql"
  ```

- [ ] **Paso 6: Dump del historial de aplicación**

  No copiar el esquema ni los historiales internos de Auth/Storage:

  ```bash
  pg_dump "$VIRGINIA_DB_URL" \
    --data-only --no-owner --no-privileges --format=plain \
    --table=supabase_migrations.schema_migrations \
    --file="$MIG/application_migration_history.sql"
  ```

  Comparar previamente las columnas de `supabase_migrations.schema_migrations` en ambos proyectos. Deben ser
  compatibles.

- [ ] **Paso 7: Revisión sensible** **[APROBACIÓN REQUERIDA]**

  Revisar los cinco SQL antes de aplicar nada. Confirmar:

  - ningún secreto o connection string;
  - ningún DDL de `auth`, `storage` o `realtime`;
  - ningún COPY de sus tablas de migración internas;
  - Auth contiene solo users/identities;
  - Storage contiene solo las tres políticas;
  - el esquema contiene ACL y RLS esperadas.

---

### Task 2: Restaurar esquema, historial, ACL y Storage en São Paulo

**Produce:** backend vacío pero estructuralmente equivalente.

- [ ] **Paso 1: Aplicar roles personalizados si existen** **[APROBACIÓN REQUERIDA]**

  ```bash
  psql "$SAO_PAULO_DB_URL" \
    --single-transaction --variable ON_ERROR_STOP=1 \
    -f "$MIG/roles_virginia.sql"
  ```

- [ ] **Paso 2: Aplicar esquema `public`** **[APROBACIÓN REQUERIDA]**

  ```bash
  psql "$SAO_PAULO_DB_URL" \
    --single-transaction --variable ON_ERROR_STOP=1 \
    -f "$MIG/schema_public.sql"
  ```

  Un error aborta toda la transacción. Corregir el dump con intención y repetir; no continuar parcialmente.

- [ ] **Paso 3: Restaurar historial de aplicación** **[APROBACIÓN REQUERIDA]**

  Confirmar que la tabla destino está vacía y cargar solo sus datos:

  ```bash
  psql "$SAO_PAULO_DB_URL" \
    --single-transaction --variable ON_ERROR_STOP=1 \
    -f "$MIG/application_migration_history.sql"
  ```

  Verificar igualdad exacta de `version`, `name` y cantidad de filas con Virginia. No esperar que
  `supabase migration list` coincida con los nombres de los archivos locales: esa desincronización ya existía y
  se resolverá en otro trabajo.

- [ ] **Paso 4: Aplicar políticas de Storage** **[APROBACIÓN REQUERIDA]**

  Las políticas pueden existir antes de crear la fila del bucket. El bucket se crea mediante API en Task 4:

  ```bash
  psql "$SAO_PAULO_DB_URL" \
    --single-transaction --variable ON_ERROR_STOP=1 \
    -f "$MIG/storage_custom.sql"
  ```

- [ ] **Paso 5: Verificar Data API, ACL y advisors**

  Comparar contra Virginia:

  - RLS por tabla y definición de políticas;
  - GRANT de tablas, vistas y rutinas a `anon`/`authenticated`;
  - schemas expuestos en Dashboard → Integrations → Data API;
  - vistas con `security_invoker=true`;
  - funciones `SECURITY DEFINER` y sus EXECUTE;
  - advisors contra el baseline de São Paulo.

  Los proyectos creados desde 2026-05-30 pueden no exponer automáticamente nuevas tablas. Si falta un GRANT,
  restaurar exactamente el ACL de Virginia; no conceder privilegios globales “por si acaso”.

---

### Task 3: Cargar y validar datos iniciales

**Produce:** réplica inicial funcional, mientras Virginia sigue activo.

- [ ] **Paso 1: Cargar Auth y `public`** **[APROBACIÓN REQUERIDA]**

  ```bash
  psql "$SAO_PAULO_DB_URL" \
    --single-transaction \
    --variable ON_ERROR_STOP=1 \
    --command 'SET session_replication_role = replica;' \
    -f "$MIG/auth_users_identities.sql" \
    -f "$MIG/data_public.sql"
  ```

- [ ] **Paso 2: Verificar todas las tablas**

  Generar conteos para cada tabla `public`, no una lista manual. Comparar también `auth.users` e
  `auth.identities`.

- [ ] **Paso 3: Comparar checksums determinísticos**

  Usar la misma versión de `psql` en ambos proyectos. Antes de calcular, fijar y registrar los parámetros de
  sesión que afectan la representación textual de `timestamptz` y flotantes:

  ```sql
  \set ON_ERROR_STOP on
  set TimeZone = 'UTC';
  set extra_float_digits = 3;
  show TimeZone;
  show extra_float_digits;

  select format(
    $q$select %L table_name, count(*) rows,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ''
           order by md5(to_jsonb(t)::text)), '')) checksum
       from public.%I t;$q$,
    table_name, table_name
  )
  from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
  order by table_name
  \gexec
  ```

  Guardar los dos `SHOW` junto con cada salida y hacer `diff`. Cualquier diferencia bloquea el avance. Repetir
  exactamente estos parámetros en el gate final de Task 7.

- [ ] **Paso 4: Verificar FK y secuencias**

  Buscar huérfanos para todas las FK, incluida `profiles.id → auth.users.id`. Comparar `pg_sequences`; aplicar
  `setval` solo si se demuestra una divergencia.

- [ ] **Paso 5: Actualizar estadísticas**

  ```bash
  psql "$SAO_PAULO_DB_URL" --variable ON_ERROR_STOP=1 -c 'ANALYZE;'
  ```

---

### Task 4: Migrar Storage y corregir el contrato de fotos

**Produce:** objetos copiados, políticas utilizables y rutas persistentes no ligadas al proyecto viejo.

- [ ] **Paso 1: Preparar herramienta temporal con dependencia fijada**

  ```bash
  cd "$MIG/storage-tool"
  npm init -y
  npm install --save-exact @supabase/supabase-js@2.110.1
  ```

  Conservar `package-lock.json` dentro de `$MIG` hasta cerrar la migración.

- [ ] **Paso 2: Implementar copia recursiva y paginada**

  Crear `$MIG/storage-tool/migrate-storage.mjs` con:

  - clientes origen/destino construidos desde URL y `service_role` en env vars;
  - `list(prefix, {limit, offset})` recursivo para pseudo-carpetas;
  - descarga y upload `upsert:true`;
  - preservación de MIME;
  - log de cada fallo y exit code 1 si queda uno;
  - modo `--ensure-bucket` idempotente para crear/verificar el bucket;
  - modo `--verify` que compare lista de paths, tamaño y MIME, no solo conteo;
  - modo `--list-target-extras` de solo lectura para detectar objetos de pruebas que no existen en Virginia.

  La subida con `service_role` no conserva el `owner_id` histórico. Registrar esta desviación: los objetos
  migrados son evidencia ya confirmada y no deben borrarse; las nuevas fotos posteriores al corte se subirán con
  el JWT del usuario y sí conservarán propietario.

- [ ] **Paso 3: Copiar objetos** **[APROBACIÓN REQUERIDA]**

  ```bash
  cd "$MIG/storage-tool"
  SUPABASE_URL_ORIGEN=https://fbxupwwgiebhlciqftpw.supabase.co \
  SUPABASE_URL_DESTINO=https://xuvwbikycdzwbdsmxhnb.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY_ORIGEN=*** \
  SUPABASE_SERVICE_ROLE_KEY_DESTINO=*** \
    node migrate-storage.mjs --ensure-bucket --copy --verify \
    | tee "$MIG/storage_migration.log"
  ```

  Exigir cero fallos y paridad de paths/tamaños/MIME.

- [ ] **Paso 4: Normalizar datos existentes en São Paulo** **[APROBACIÓN REQUERIDA]**

  Previsualizar tres filas y luego:

  ```sql
  update public.tire_casings
     set discard_photo_url = regexp_replace(
           split_part(discard_photo_url, '?', 1),
           '^.*/object/sign/tire-discard-photos/', ''
         )
   where discard_photo_url like '%/object/sign/tire-discard-photos/%';
  ```

  Verificar que cada ruta resultante exista en `storage.objects`.

- [ ] **Paso 5: Corregir futuras escrituras antes de construir**

  Modificar `WEB/movimientos/storage-client.js` para persistir la ruta canónica y firmar únicamente al mostrar.
  Crear `WEB/movimientos/__tests__/storage-client.test.js` —hoy no existe cobertura de este módulo— y probar al
  menos:

  - upload devuelve/persiste la ruta canónica, nunca la URL firmada;
  - la URL firmada se solicita únicamente al leer/mostrar;
  - el parser acepta tanto una ruta canónica como una URL firmada histórica;
  - delete opera sobre la ruta canónica;
  - los errores de upload, firma y delete se propagan sin persistir un valor inválido.

  Ejecutar el test con el runner existente de `WEB/movimientos`. No permitir nuevas URLs firmadas persistentes
  después del corte.

---

### Task 5: Paridad de configuración y smoke de backend

**Produce:** Fase A aprobada con São Paulo funcional y Virginia intacto.

- [ ] **Paso 1: Replicar Realtime**

  Replicar exactamente la publicación de Virginia:

  ```sql
  alter publication supabase_realtime add table public.inspections;
  alter publication supabase_realtime add table public.inspection_measurements;
  ```

  Ejecutar solo para tablas ausentes y verificar igualdad posterior.

- [ ] **Paso 2: Replicar configuración de servicios**

  Comparar y documentar:

  - Auth: password login, confirmación de email, Site URL, redirect URLs, JWT expiry, rate limits, CAPTCHA,
    hooks, SMTP y plantillas;
  - Data API: schemas expuestos y grants;
  - extensiones instaladas;
  - webhooks, `pg_net`, `pg_cron`, Vault y custom domains;
  - configuración del bucket.

  En proyectos Free nuevos, las plantillas personalizadas requieren SMTP propio. No asumir paridad si el
  dashboard impide configurarlas.

- [ ] **Paso 3: Login real con JWT de São Paulo**

  Iniciar sesión con un usuario migrado y la misma contraseña. Los tokens viejos no son válidos porque cada
  proyecto tiene un JWT secret distinto; el nuevo login es esperado.

- [ ] **Paso 4: Probar RLS desde el cliente**

  Ejecutar `supabase.rpc('current_company_id')` y `supabase.rpc('current_profile_role')` desde una sesión
  autenticada real. No usar SQL Editor/MCP para esta prueba porque ejecutan con rol administrador.

  Confirmar:

  - datos visibles solo de la empresa del usuario;
  - usuario de otra empresa no accede;
  - upload, signed URL y delete de una foto de prueba respetan las políticas;
  - los RPC de inspección y movimientos funcionan.

- [ ] **Paso 5: Checkpoint de Fase A** **[APROBACIÓN REQUERIDA]**

  No continuar si schema, ACL, Auth, RLS, Storage, checksums o advisors muestran una regresión nueva.

---

# FASE B — Preparar distribución y corte

### Task 6: Inventario, builds Android y despliegue ensayado

**Produce:** APK firmados, artefactos auditados y procedimiento real de publicación.

- [ ] **Paso 1: Inventariar todos los dispositivos**

  Registrar dispositivo, responsable, app instalada, `applicationId`, `versionCode`, firma y última actividad.
  La consulta de referencia usa la columna real:

  ```sql
  select p.id, p.role, max(i.created_at) as ultima_inspeccion
    from public.profiles p
    left join public.inspections i on i.inspector_id = p.id
   group by 1,2 order by 3 desc nulls last;
  ```

- [ ] **Paso 2: Confirmar distribución y firma** **[APROBACIÓN REQUERIDA]**

  Determinar si se usa Play interno, MDM, APK release o debug. No construir hasta saber qué firma permite
  actualizar cada instalación existente. `app movimientos` no tiene signing config release; resolverlo antes
  de generar su APK final.

- [ ] **Paso 3: Incrementar versiones Android**

  Modificar:

  - `app/android/app/build.gradle`;
  - `app movimientos/android/app/build.gradle`.

  Aumentar `versionCode` y registrar `versionName`. Play/MDM requieren un código superior.

- [ ] **Paso 4: Configurar São Paulo y construir**

  Actualizar los dos `.env.local` ignorados y conservar los valores viejos bajo `$MIG`, con permisos `0600`.

  ```bash
  cd app
  npm ci
  npm run lint
  npm test
  npm run build
  npx cap sync android
  cd android
  ./gradlew assembleRelease

  cd "../../app movimientos"
  npm ci
  npm test
  npm run build
  npx cap sync android
  cd android
  ./gradlew assembleRelease
  ```

  Si la distribución confirmada usa debug, sustituir conscientemente `assembleRelease` por `assembleDebug`.

- [ ] **Paso 5: Auditar los APK, no solo `dist`**

  Copiar APK finales a `$MIG/artifacts`, calcular SHA-256 y extraerlos para verificar:

  - contienen `xuvwbikycdzwbdsmxhnb`;
  - no contienen `fbxupwwgiebhlciqftpw`;
  - firma, package y versionCode esperados;
  - ambos incluyen los assets generados por `cap sync`.

- [ ] **Paso 6: Smoke en dispositivo de prueba**

  Instalar como actualización sobre una instalación existente. Confirmar preservación de SQLite/localStorage,
  login nuevo, cola pendiente, inspección, movimiento y foto contra São Paulo.

- [ ] **Paso 7: Ensayar publicación web real**

  El repo no tiene workflow activo. Confirmar URL y proveedor de producción. Para el mecanismo documentado:

  ```bash
  npm run deploy:bundle
  ```

  Ensayar la generación de `deploy-static/` y el upload manual a Cloudflare Pages/private hosting sin reemplazar
  aún producción. Registrar credenciales humanas, pasos, URL y procedimiento de rollback de la plataforma.

---

# FASE C — Ventana de corte

### Task 7: Bloquear Virginia y hacer la recarga final

**Produce:** snapshot final consistente en São Paulo y Virginia sin nuevas escrituras.

- [ ] **Paso 1: Drenar colas**

  Cada responsable sincroniza y muestra cola vacía. Los RPC actuales toleran reintentos, pero esto sigue siendo
  requisito operativo.

- [ ] **Paso 2: Preparar rollback del write fence**

  Generar `$MIG/restore_source_execute_grants.sql` desde el catálogo con los GRANT EXECUTE actuales para
  `PUBLIC`, `anon` y `authenticated`. Guardar también las tres definiciones de políticas Storage ya capturadas.
  Revisar el archivo antes de revocar.

  ```bash
  psql "$VIRGINIA_DB_URL" -At -c "
  with function_grants as (
    select distinct format(
      'grant execute on function %s to %s;',
      p.oid::regprocedure,
      case when acl.grantee = 0 then 'public' else quote_ident(grantee.rolname) end
    ) statement
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where n.nspname = 'public'
      and acl.privilege_type = 'EXECUTE'
      and (acl.grantee = 0 or grantee.rolname in ('anon','authenticated'))
  ),
  table_grants as (
    select distinct format(
      'grant %s on table %I.%I to %s;',
      lower(privilege_type), table_schema, table_name,
      case when grantee = 'PUBLIC' then 'public' else quote_ident(grantee) end
    ) statement
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('PUBLIC','anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  )
  select statement from function_grants
  union
  select statement from table_grants
  order by 1;
  " > "$MIG/restore_source_execute_grants.sql"
  ```

  El archivo no debe contener revokes, secretos ni roles distintos de los tres esperados.

- [ ] **Paso 3: Activar write fence en Virginia** **[APROBACIÓN REQUERIDA — afecta producción]**

  Durante la ventana, revocar únicamente los RPC que escriben. No usar
  `revoke execute on all functions in schema public`: rompería las lecturas RLS y las vistas que dependen de
  `current_company_id()`, `current_profile_role()`, `fn_*`, `get_umbrales_rtd` o `get_unidad_preload`.

  ```sql
  revoke execute on function public.save_inspection(jsonb)
    from public, anon, authenticated;
  revoke execute on function public.register_full_installation(
    text, text, text, text, public.tire_condition, uuid, smallint, date,
    text, numeric, numeric, text, integer, numeric, text
  ) from public, anon, authenticated;
  revoke execute on function public.register_removal(
    uuid, date, public.removal_reason, integer, numeric,
    public.discard_cause, text, text
  ) from public, anon, authenticated;
  revoke execute on function public.transfer_tire(
    uuid, uuid, smallint, date, integer, numeric, integer, text
  ) from public, anon, authenticated;
  revoke execute on function public.assign_unit_route(
    uuid, text, date, text, text, text, integer, smallint, text, text
  ) from public, anon, authenticated;
  revoke execute on function public.create_tire_movement_order(
    uuid, uuid, date, text, jsonb
  ) from public, anon, authenticated;
  revoke execute on function public.claim_tire_movement_order(uuid)
    from public, anon, authenticated;
  revoke execute on function public.complete_tire_movement_order(uuid, integer, jsonb)
    from public, anon, authenticated;
  revoke execute on function public.confirm_tire_change_batch(jsonb)
    from public, anon, authenticated;
  revoke execute on function public.confirm_baseline_mount(jsonb)
    from public, anon, authenticated;

  revoke insert, update, delete, truncate on all tables in schema public
    from public, anon, authenticated;

  alter policy "tire_discard_insert_own_company" on storage.objects
    with check (false);
  alter policy "tire_discard_delete_own_upload" on storage.objects
    using (false);
  ```

  Antes de ejecutar, volver a comparar esta lista con los RPC de escritura del catálogo; un RPC mutador nuevo
  bloquea el corte hasta incorporarlo. Después:

  - verificar `has_function_privilege(..., 'EXECUTE') = false` para cada RPC de escritura;
  - con la URL y publishable key de Virginia, iniciar sesión como un usuario real y usar su JWT para ejecutar
    los SELECT que usa el dashboard, incluido uno protegido por `current_company_id()` y las vistas que consumen
    los helpers `fn_*`; deben devolver datos limitados a su empresa;
  - con ese mismo cliente/JWT, intentar una escritura representativa y comprobar que falla.

  No cuentan como prueba de lectura MCP, SQL Editor ni `service_role`, porque evitan el camino real de
  autorización. Virginia queda legible durante la gracia y el rollback restaura grants y políticas.

  El fence cubre deliberadamente `PUBLIC`, `anon` y `authenticated`; `service_role` conserva capacidad de
  escritura y evita RLS. Confirmar antes del corte que ninguna app, dispositivo, job, webhook o automatización
  sigue escribiendo en Virginia con esa key. Si existe alguno, detenerlo o repuntarlo antes del fence. Durante
  la gracia, reservar esa key para recuperación controlada y no usarla desde clientes.

- [ ] **Paso 4: Confirmar quietud**

  Registrar máximos y conteos de todas las tablas de escritura y de `storage.objects`, esperar unos minutos y
  repetir. No basta con inspecciones y movimientos.

- [ ] **Paso 5: Vaciar datos ensayados de São Paulo** **[APROBACIÓN REQUERIDA — destructivo]**

  Cerrar la sesión del usuario de prueba y ejecutar:

  ```sql
  begin;
  set local session_replication_role = replica;

  do $$
  declare
    table_list text;
  begin
    select string_agg(format('%I.%I', table_schema, table_name), ', ')
      into table_list
      from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE';

    if table_list is null then
      raise exception 'No se encontraron tablas public para truncar';
    end if;

    execute 'truncate table ' || table_list || ' restart identity cascade';
  end
  $$;

  delete from auth.one_time_tokens;
  delete from auth.mfa_amr_claims;
  delete from auth.mfa_challenges;
  delete from auth.mfa_factors;
  delete from auth.refresh_tokens;
  delete from auth.sessions;
  delete from auth.identities;
  delete from auth.users;
  commit;
  ```

  No tocar `auth.schema_migrations`, el bucket, las políticas, los objetos de Storage ni
  `supabase_migrations`: el esquema no cambió.

- [ ] **Paso 6: Repetir dumps finales**

  Crear `$MIG/final_auth.sql` solo con `auth.users`/`auth.identities` y `$MIG/final_public.sql` con datos
  `public`, usando los mismos comandos de Task 1.

- [ ] **Paso 7: Cargar snapshot final** **[APROBACIÓN REQUERIDA]**

  ```bash
  psql "$SAO_PAULO_DB_URL" \
    --single-transaction \
    --variable ON_ERROR_STOP=1 \
    --command 'SET session_replication_role = replica;' \
    -f "$MIG/final_auth.sql" \
    -f "$MIG/final_public.sql"
  ```

  No volver a cargar `storage.buckets`: ya existe y un `COPY` duplicaría su PK.

- [ ] **Paso 8: Copiar delta de Storage y normalizar**

  Reejecutar la herramienta idempotente y repetir la normalización de rutas. Ejecutar primero
  `--list-target-extras`; todo objeto de pruebas presente solo en São Paulo debe eliminarse mediante Storage API
  con aprobación explícita. Terminar con igualdad exacta de paths/tamaños/MIME.

- [ ] **Paso 9: Gate final**

  Exigir:

  - checksums y conteos exactos, repitiendo los `SET` y `SHOW` de Task 3 Paso 3;
  - FK y secuencias correctas;
  - Auth login;
  - ACL/Data API/RLS;
  - Storage, incluida esta consulta después de la carga final de Auth, que debe devolver cero filas:

    ```sql
    select o.bucket_id, o.name, o.owner_id
      from storage.objects o
      left join auth.users u on u.id::text = o.owner_id
     where o.bucket_id = 'tire-discard-photos'
       and o.owner_id is not null
       and u.id is null;
    ```

    `owner_id is null` es aceptable para objetos migrados con `service_role`; un UUID no nulo sin usuario no.
  - Realtime;
  - advisors sin regresiones;
  - `ANALYZE`.

  Este es el último punto barato de abortar.

---

### Task 8: Repuntar, publicar e instalar

**Produce:** todos los clientes activos usando São Paulo.

- [ ] **Paso 1: Cambios de repositorio**

  Actualizar:

  - `WEB/supabase-config.public.js`;
  - `knowledge/ai/05 - Datos y Supabase.md`;
  - `knowledge/ai/08 - Infraestructura seguridad y despliegue.md`;
  - `knowledge/ai/15 - Bitacora diaria.md`;
  - versiones Android y corrección de `storage-client.js`;
  - `app movimientos/dist/` si sigue siendo artefacto versionado;
  - `supabase/.temp/*` después de vincular São Paulo, porque actualmente está versionado.

  Limpiar localmente `.claude/settings.local.json`, pero no intentar agregarlo: está ignorado y no pertenece al
  commit. No agregar assets Android ignorados; los APK auditados viven bajo `$MIG/artifacts`.

- [ ] **Paso 2: Re-vincular CLI**

  ```bash
  npx supabase link --project-ref xuvwbikycdzwbdsmxhnb
  rg "fbxupwwgiebhlciqftpw" supabase/.temp
  ```

  El segundo comando no debe encontrar el ref viejo.

- [ ] **Paso 3: Verificar y commitear** **[APROBACIÓN REQUERIDA]**

  Ejecutar tests, `npm run docs:check`, revisar `git diff` y hacer un commit intencional. No incluir dumps,
  claves, `.env.local`, `.claude/settings.local.json`, keystores ni APK.

- [ ] **Paso 4: Publicar web por el mecanismo real** **[APROBACIÓN REQUERIDA — corte web]**

  Generar `deploy-static/` desde el commit aprobado y subirlo al hosting confirmado en Task 6. Verificar la URL
  pública y el contenido desplegado. `git push` por sí solo no cuenta como publicación.

- [ ] **Paso 5: Instalar APK en todos los dispositivos**

  Verificar hash/firma/versionCode, instalar y tachar el inventario uno por uno. Un dispositivo sin actualizar
  mantiene el corte incompleto.

- [ ] **Paso 6: Reanudar captura**

  Confirmar que las colas conservadas drenan contra São Paulo y que Virginia sigue rechazando escrituras.

---

### Task 9: Smoke end-to-end, rollback, gracia y cierre

**Produce:** migración aceptada, rollback practicable y material sensible eliminado.

- [ ] **Paso 1: Smoke inmediato**

  En el mismo día del corte:

  - login y recarga en todos los dashboards;
  - inspección real desde APK;
  - orden de movimiento completa;
  - foto de descarte: upload, persistencia de ruta, signed URL y visualización;
  - aislamiento entre dos empresas;
  - Realtime de inspección/mediciones;
  - consola y logs sin errores nuevos.

- [ ] **Paso 2: Verificación de flujo**

  Si `verify-data-flow` está disponible, ejecutarla. Si no, realizar y documentar manualmente el mismo recorrido:
  SQLite/localStorage → cola → RPC → tablas → vistas → dashboard. La ausencia de una skill no puede omitir la
  verificación.

- [ ] **Paso 3: Rollback operativo durante la gracia**

  Si se decide volver a Virginia:

  1. detener otra vez la captura;
  2. exportar todas las escrituras ocurridas en São Paulo desde el corte;
  3. restaurar en Virginia `$MIG/restore_source_execute_grants.sql` y las políticas Storage originales;
  4. desplegar el bundle web anterior mediante el hosting real;
  5. reinstalar APK de Virginia;
  6. reconciliar en Virginia los datos creados en São Paulo antes de reabrir.

  Un `git revert && push` no publica ni reconcilia datos por sí solo.

- [ ] **Paso 4: Período de gracia de 2–4 semanas**

  Virginia permanece activo pero con write fence. Monitorear diariamente que no reciba filas ni objetos nuevos.
  Conservar APK, bundle y grants de rollback. No pausar ni borrar antes de la aprobación final.

- [ ] **Paso 5: Cierre definitivo** **[APROBACIÓN REQUERIDA]**

  Al terminar la gracia:

  - hacer dump final de Virginia y guardarlo según la política de backups;
  - decidir pausar o borrar el proyecto;
  - documentar fecha, responsable, checksums, incidentes y decisión;
  - ejecutar `npm run docs:check`;
  - eliminar de forma segura `$MIG`, env vars y credenciales temporales.

  ```bash
  unset VIRGINIA_DB_URL SAO_PAULO_DB_URL PGPASSFILE
  unset SUPABASE_SERVICE_ROLE_KEY_ORIGEN SUPABASE_SERVICE_ROLE_KEY_DESTINO
  shred -u "$MIG"/*.sql "$MIG"/final_*.sql 2>/dev/null || true
  shred -u "$MIG/.pgpass" "$MIG/conn.env" 2>/dev/null || true
  podman rmi docker.io/library/postgres:17-alpine 2>/dev/null || true
  ```

  `.pgpass` y `conn.env` contienen las contraseñas de ambas bases: su borrado no es opcional.

  Revisar manualmente el contenido restante y retirar `$MIG` solo después de confirmar que el backup final está
  almacenado en su destino aprobado.

---

## Referencias oficiales verificadas

- Supabase: `Backup and Restore using the CLI`  
  https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Supabase: `Migrating Auth Users Between Supabase Projects`  
  https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects
- Supabase: `Securing your API`  
  https://supabase.com/docs/guides/api/securing-your-api
- Supabase: `The Storage Schema`  
  https://supabase.com/docs/guides/storage/schema/design
- Supabase changelog: cambios incompatibles  
  https://supabase.com/changelog?types=breaking-change

---

## Criterio de finalización

La migración está completa únicamente cuando:

1. los 10 tasks están cerrados;
2. todos los dispositivos inventariados usan APK verificado de São Paulo;
3. el hosting real sirve la configuración de São Paulo;
4. Auth, ACL, RLS, RPC, Realtime y Storage pasaron pruebas con JWT reales;
5. checksums y conteos del snapshot final coinciden;
6. Virginia permanece sin escrituras durante la gracia;
7. existe un backup final y el material temporal sensible fue eliminado.
