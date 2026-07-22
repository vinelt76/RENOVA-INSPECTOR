# task_04 — Aplicación remota y verificación

## 1. Propietario

**CLAUDE + USUARIO.** El humano autoriza; el agente ejecuta y evidencia.

## 2. Objetivo y resultado observable

`v_tire_services` y su índice existen en el proyecto productivo, con cobertura, calidad de pareo,
aislamiento y plan de rendimiento verificados con datos reales.

## 3. Dependencias y bloqueos

Depende de `task_03`. Bloquea `task_05`.

## 4. Archivos exclusivos

- Ninguno en el repositorio. La evidencia vive en la fila 04 de `STATE.md`.

Solo lectura: la migración de `task_02`, la prueba de `task_03`.

## 5. Contratos

`CONTRATOS_DATOS.md` §1, §4 y §5.

## 6. Pasos

1. **`sync-migration-reviewer` antes de aplicar.** Lo exige `CLAUDE.md`. Verificar orden, RLS,
   `security_invoker`, grants, idempotencia y compatibilidad legacy.
2. Aplicar primero en **rama efímera** (`mcp__supabase__create_branch`) o stack local. Ejecutar la
   prueba de `task_03` ahí.
3. **Pedir autorización explícita al humano** antes de tocar producción. Mostrar el plan de reversión
   verificado.
4. Aplicar en producción.
5. Correr las consultas de control de §9.
6. `mcp__supabase__get_advisors` (security + performance) y separar lo nuevo de lo preexistente.
7. Verificar aislamiento con dos cuentas de empresas distintas.

## 7. Invariantes

- **No aplicar sin autorización humana explícita.** No basta con que la migración sea aditiva.
- Nunca `service_role` ni secretos en logs o evidencia.
- La evidencia se registra con números, no con «verificado».
- Si algo no cuadra, se registra tal cual. Un conteo que no cierra **no se explica en prosa**: se
  bloquea.

## 8. Casos de error

- **`rotation_pairing` con `inferred` o `not_paired` en datos reales** → `BLOQUEADA POR DECISIÓN
  HUMANA` (regla 3 de `STATE.md`). Significa que la alineación ya está rota en producción. Publicar
  métricas que la gente va a creer, sin entender por qué están degradadas, es peor que no publicarlas.
- **Conteo que no cuadra con el invariante** → `task_02` vuelve a `EN CORRECCIÓN` (regla 4).
- Advisor nuevo atribuible a esta vista → corregir antes de cerrar. Los preexistentes se listan y se
  dejan como estaban.
- Si el `explain` no usa el índice nuevo, revisar el orden de columnas antes de aceptar el plan.

## 9. Aceptación

Registrar en `STATE.md` los números de **todas** estas consultas:

```sql
-- 1. invariante de conteo
select
  (select count(*) from public.v_tire_services)                                     as vista,
  (select count(*) from public.tire_movement_executions where direction='exit')     as salidas,
  (select count(*) from public.tire_movement_executions where direction='entry')    as entradas,
  (select count(*) from public.v_tire_services where service_type='installation')   as instalaciones;

-- 2. las rotaciones no se duplican
select count(*) from public.v_tire_services where service_type='rotation';
select count(*) from public.tire_movement_executions
  where direction='exit' and movement_reason='rotation';

-- 3. CALIDAD DEL PAREO — debe ser todo exact / not_applicable
select rotation_pairing, count(*) from public.v_tire_services group by 1 order by 2 desc;

-- 4. cuántos enlaces de historial NO se van a ofrecer
select count(*) from public.v_tire_services
  where casing_code is not null and not casing_exists;

-- 5. distribución por tipo (será la barra de la pantalla)
select service_type, count(*) from public.v_tire_services group by 1 order by 2 desc;

-- 6. la normalización de marca funciona
select brand_key, count(distinct brand_name) as grafias, count(*) as filas
  from public.v_tire_services where brand_key is not null
  group by 1 order by 2 desc;

-- 7. sin duplicados
select service_id, count(*) from public.v_tire_services
  group by 1 having count(*) > 1;   -- 0 filas

-- 8. plan de consulta de la pantalla
explain analyze
select * from public.v_tire_services order by captured_at desc, sequence asc limit 2000;

-- 9. grants
select grantee, privilege_type from information_schema.role_table_grants
  where table_name = 'v_tire_services';   -- solo authenticated / SELECT
```

Más:

- **Aislamiento A/B**: con sesión de empresa A la vista no devuelve ninguna fila de B, y viceversa.
  Registrar los dos conteos y confirmar que los inquilinos fueron distintos.
- **`anon` rechazado**: petición REST sin sesión devuelve HTTP 401.
- Veredicto de `sync-migration-reviewer`.
- Advisors: solo advertencias preexistentes, enumeradas.
- Volumen actual y proyección a ~500 unidades / ~3 800 neumáticos, para dimensionar D10.

## 10. Rollback

```sql
drop view if exists public.v_tire_services;
drop index if exists public.tire_movement_executions_company_captured_idx;
```

Nada consume la vista todavía; la reversión es limpia y no deja huella.

## 11. Handoff

Actualizar la fila 04 de `STATE.md` con todos los números de §9, el veredicto del reviewer, quién
autorizó la aplicación y cuándo.

El resultado de la consulta 3 (calidad del pareo) es el dato que `task_06` necesita para saber si el
tag `ATRIBUCIÓN INFERIDA` será visible en la práctica o es solo una salvaguarda.

El resultado de la consulta 4 dice cuántas filas se mostrarán sin enlace de historial: si es alto,
conviene revisar la decisión de comparación cruda del contrato §3.4 antes de que `task_06` lo dé por
bueno.
