-- RENOVA — Español neutro en los mensajes de error visibles.
--
-- `CLAUDE.md` exige español neutro cercano al uso peruano en todo texto visible para personas
-- usuarias, y prohíbe el voseo argentino. Varias RPC levantan excepciones cuyo mensaje llega
-- CRUDO a la pantalla: `app movimientos/src/screens/ExecutionScreen.tsx` muestra `cause.message`
-- tal cual, y los controladores de `WEB/` hacen lo mismo. Un operario peruano lee "debés" en la
-- primera pantalla que toca.
--
-- POR QUÉ ESTA MIGRACIÓN NO COPIA LOS CUERPOS DE LAS FUNCIONES
--
-- Las funciones afectadas suman ~36 kB de plpgsql; `confirm_tire_change_batch_legacy` sola tiene
-- 23 kB. Reproducirlas a mano para cambiar siete palabras es la forma más probable de introducir
-- una regresión silenciosa: basta una diferencia entre el archivo de migración y lo que realmente
-- corre en producción para revertir un arreglo posterior sin que nadie lo note.
--
-- En su lugar se parchea la definición VIGENTE: se lee con `pg_get_functiondef`, se reemplazan
-- únicamente las cadenas de voseo y se vuelve a ejecutar el `CREATE OR REPLACE` resultante. Así el
-- cambio es exactamente "estas siete palabras", sobre lo que de verdad está desplegado, sin tocar
-- ninguna otra línea de lógica.
--
-- Propiedades:
--   * Idempotente: en una segunda corrida ninguna función coincide con el patrón y no hace nada.
--   * Acotado: solo funciones plpgsql de `public`; solo reemplazos dentro de literales de texto.
--   * Sin cambio de firma, permisos ni `security definer` — `pg_get_functiondef` los conserva.
--
-- Alcance esperado (medido el 2026-07-25 contra producción): 6 funciones.
--   assign_unit_route, complete_tire_movement_order, confirm_tire_change_batch_legacy,
--   fn_create_casing_cycle_installation, fn_require_tire_movement_profile,
--   fn_require_workshop_profile
--
-- NOTA: "armaste" NO se toca. El pretérito de segunda persona singular es idéntico en español
-- rioplatense y neutro; no es voseo.

do $$
declare
  v_fn      record;
  v_def     text;
  v_new     text;
  v_count   integer := 0;
begin
  for v_fn in
    select p.oid, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
       and pg_get_functiondef(p.oid) ~ '(Necesitás|debés|Usá|Corregí|Recargá|rearmá|reintentá)'
     order by p.proname
  loop
    v_def := pg_get_functiondef(v_fn.oid);

    v_new := v_def;
    v_new := replace(v_new, 'Necesitás', 'Necesitas');
    v_new := replace(v_new, 'debés',     'debes');
    v_new := replace(v_new, 'Usá',       'Usa');
    v_new := replace(v_new, 'Corregí',   'Corrige');
    v_new := replace(v_new, 'Recargá',   'Recarga');
    v_new := replace(v_new, 'rearmá',    'rearma');
    v_new := replace(v_new, 'reintentá', 'reintenta');

    if v_new is distinct from v_def then
      execute v_new;
      v_count := v_count + 1;
      raise notice 'Español neutro aplicado a public.%', v_fn.proname;
    end if;
  end loop;

  raise notice 'Funciones actualizadas: %', v_count;
end;
$$;

-- Verificación: debe devolver 0 filas después de aplicar.
--
--   select p.proname
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and pg_get_functiondef(p.oid) ~ '(Necesitás|debés|Usá|Corregí|Recargá|rearmá|reintentá)';
