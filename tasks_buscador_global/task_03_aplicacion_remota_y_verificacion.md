# task_03 — Aplicación remota y verificación

## 1. Propietario

**CLAUDE + USUARIO.** La aplicación al proyecto productivo requiere autorización humana explícita.

## 2. Objetivo y resultado observable

Aplicar `v_search_index` al remoto y probar tres cosas antes de que ningún frontend la consuma:
que **cubre** el universo, que **aísla** por empresa y que **no llega truncada** por el Data API.

## 3. Dependencias y bloqueos

Depende de `task_02`. Bloquea `task_05`.

## 4. Archivos exclusivos

Ninguno. La evidencia se registra en `STATE.md` fila 03.

## 5. Precondiciones

1. `sync-migration-reviewer` cerró `task_02` sin hallazgos abiertos.
2. **Autorización explícita del humano** para aplicar DDL en el proyecto productivo
   (`CLAUDE.md`: no aplicar cambios remotos sin aprobación).
3. Plan de reversión confirmado: `drop view public.v_search_index;`.

## 6. Pasos

1. Aplicar la migración.
2. Ejecutar las cuatro consultas de cobertura de `task_02` §9 contra el remoto.
3. **Verificar permisos reales**, no los declarados:

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'v_search_index';
-- authenticated/SELECT presente; anon ausente
```

4. **Verificar aislamiento con dos cuentas de empresas distintas.** Con sesión de empresa A,
   confirmar que `select distinct company_id from v_search_index` devuelve exactamente un valor, y
   que es el de A. Repetir con B.
5. **Verificar truncado.** Comparar el número de filas que devuelve
   `RenovaSupabase.fetchView("v_search_index", {})` desde el navegador contra `count(*)` en SQL.
   PostgREST puede imponer un `max-rows` del proyecto.
6. Medir el tamaño real del payload y proyectarlo a ~500 unidades / ~3 800 neumáticos.
7. Verificar el caso `code_mismatch`: elegir un casco donde `tire_casings.code` difiera del
   `tire_code` de su última medición y confirmar que **ambos** están en su `haystack`.

## 7. Invariantes

- `authenticated` por sí solo **no** demuestra aislamiento. La prueba con dos empresas es
  obligatoria y no se sustituye por leer las policies.
- No usar `service_role` para ninguna verificación: enmascara exactamente el fallo que se busca.
- No registrar en logs filas completas, tokens ni la URL privada del proyecto.

## 8. Casos de bloqueo

- Conteo del índice ≠ `count(*)` de la tabla base → `BLOQUEADA`. Hay cascos o unidades invisibles.
- Filas duplicadas por `entity_id` → `EN CORRECCIÓN` en `task_02`.
- `anon` con `SELECT` → revertir de inmediato y corregir grants.
- Respuesta truncada por `max-rows` → `BLOQUEADA POR DECISIÓN HUMANA`. Un techo silencioso repite el
  defecto de `instalacion.html` y **no se acepta como límite tolerado**; requiere decidir entre
  subir el techo o paginar el índice.
- Payload proyectado desproporcionado → decisión humana entre carga diferida de `kind='casing'` o
  cambio de estrategia. Nunca truncar sin aviso.

## 9. Aceptación

Los siete pasos ejecutados con evidencia numérica registrada en `STATE.md`: conteos, grants
observados, `company_id` distintos por sesión, filas recibidas vs `count(*)`, tamaño de payload y el
caso `code_mismatch` resuelto.

## 10. Rollback

`drop view public.v_search_index;`. Sin consumidores todavía, la reversión no afecta ninguna
pantalla.

## 11. Handoff

Actualizar fila 03. Confirmar a `task_05` el tamaño real del payload y si aplica carga diferida.
