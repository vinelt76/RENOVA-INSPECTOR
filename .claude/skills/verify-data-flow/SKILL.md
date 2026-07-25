---
name: verify-data-flow
description: Verifica extremo a extremo que RENOVA INSPECTOR sea coherente — fórmulas (paridad Python/TS y conformidad con specs/reglas_negocio.md), persistencia local, cola de sync, contrato de RPC con Supabase y las vistas que consumen los dashboards de WEB/. Usar antes de cerrar cambios que toquen calculations.ts/.py, app/src/db/, app/src/sync/, migraciones de Supabase, o cuando se sospeche que app y dashboard muestran datos distintos para el mismo neumático.
---

# Verificar el flujo de datos de RENOVA INSPECTOR

Nace del recorrido de verificación de 2026-07-24/25 (`verificacion/` en la raíz del repo, tasks
T01-T12). Encapsula lo que se aprendió sobre dónde suele romperse la coherencia del sistema, para
que la próxima verificación no empiece de cero.

## Capas, en orden

### 1. Fórmulas — sin red, rápido

```bash
node .claude/skills/verify-data-flow/scripts/compare_golden.mjs
```

Corre `fixtures/golden.json` contra `reference/calculations.py` Y `app/src/core/calculations.ts`
en la misma pasada. Reporta dos veredictos independientes: **paridad** (¿las dos implementaciones
coinciden entre sí?) y **conformidad** (¿coinciden con `specs/reglas_negocio.md`?). Un caso
puede tener paridad perfecta y aun así no seguir la spec al pie de la letra — la tabla lo separa.
Casos donde la spec no fija un resultado único llevan `"spec_ambigua": true` en el fixture y no
cuentan como fallo salvo con `--strict-spec`.

Al tocar una función: agregar el caso en `fixtures/golden.json` (un solo fixture para ambos
lenguajes), nunca duplicarlo en las suites de pytest/vitest por separado — eso es exactamente lo
que causó que ambas suites divergieran sin que nadie lo notara (T01 del recorrido de 2026-07-24).

### 2. Persistencia local y cola de sync — vitest, sin red

```bash
cd app && npm test && npm run lint && npm run build
```

Puntos que la verificación de 2026-07-24 encontró como frágiles y vale la pena revisar cada vez:
- `isa_peso_snap`/`idi` calculados en `inspeccionRepo.ts` — confirmar que siguen sin viajar al
  payload de `pushInspeccion.ts` (o que alguien decidió arreglarlo; si es así, actualizar este
  hallazgo y `verificacion/T05.md`).
- El guard `id + created_at + enviado=0` de `syncQueueRepo.marcarEnviado`/`marcarError` — no
  tiene test de regresión (`verificacion/T06.md`). Si se toca ese archivo, considerar agregarlo.

### 3. Contrato RPC app↔Supabase — MCP Supabase, SOLO LECTURA

Con el MCP de Supabase (`mcp__supabase__execute_sql`, nunca `apply_migration` en este flujo):

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('save_inspection', 'get_umbrales_rtd', 'get_unidad_preload', ...);
```

Comparar contra las llamadas `.rpc(...)` reales en `app/src/sync/*.ts`. Además, para cualquier
función SQL que reimplemente una regla de negocio (`fn_rtd_state`, `fn_channel_rtd_state`,
`fn_pressure_state_fixed`, etc.), leer su definición con `pg_get_functiondef` y compararla a mano
contra la función TS equivalente — no hay comparador automatizado para esto (a diferencia de la
capa 1) porque las dos viven en dialectos distintos. Ver `verificacion/T08.md` para dos
divergencias reales ya encontradas (estado RTD recalculado con umbral vigente, no snapshot;
`fn_pressure_state_fixed` con regla fija 100/130 PSI que ignora medida/eje).

**Importante:** una función puede existir y funcionar en producción sin estar en ningún archivo
de `supabase/migrations/` (pasó con `fn_rtd_state`, ver T07) — `grep` sobre las migraciones NO es
suficiente para confirmar que algo existe; hay que consultar `pg_proc` en vivo.

### 4. Vistas y grants de `WEB/` — MCP Supabase, SOLO LECTURA

```sql
select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v' and c.relname = '<vista>';
-- reloptions debe incluir security_invoker=on/true

select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='<vista>' and grantee in ('anon','authenticated');
-- una vista de solo lectura NO debería tener INSERT/UPDATE/DELETE/TRUNCATE a anon
```

`mcp__supabase__get_advisors(type: "security")` es un buen primer filtro pero no detecta grants
de DML excesivos sobre vistas (solo detecta funciones SECURITY DEFINER ejecutables por
anon/authenticated) — no basta por sí solo, ver `verificacion/T09.md`.

### 5. Coherencia de datos — MCP Supabase, SOLO LECTURA

Contrastar conteos reales contra lo que `knowledge/ai/10 - Roadmap deuda y riesgos.md` documenta.
Si un número no reproduce, **no ajustar la nota de conocimiento en silencio** — dejarlo como
discrepancia declarada (ver `verificacion/T10.md` para un ejemplo real: "~316 cascos sin código"
no se pudo reproducir contra el estado actual de `tire_casings`).

### 6. Smoke test de `WEB/` — navegador, sin credenciales reales

```bash
python3 -m http.server 8934   # desde WEB/
```

Con Chrome MCP: navegar cada HTML de nivel superior, confirmar que `requireAuth()` muestra el
modal de login sin errores de consola antes de cualquier fetch a Supabase. Verificar datos reales
post-login requiere credenciales que esta skill no asume tener — si no hay cuenta de prueba
disponible, declarar el límite explícitamente en vez de omitirlo silenciosamente
(`verificacion/T11.md`).

### 7. Tests SQL (`supabase/tests/*.sql`) — requieren escritura, casi siempre fuera de alcance

`scripts/run_sql_tests.sh` documenta cómo correrlos (necesitan una base con permiso de escritura
— idealmente una branch efímera de Supabase, nunca producción sin autorización explícita). No se
ejecutan como parte de las capas 1-6. Si el usuario autoriza una branch o un entorno de escritura,
usar ese script; si no, declarar la capa como no ejecutada.

## Principio general

Cada capa que toca Supabase es de **solo lectura** salvo autorización explícita del usuario para
escribir (branch efímera o similar). Un hallazgo de fórmula/dato/permiso se reporta con evidencia
— no se corrige automáticamente salvo que sea un arreglo trivial y aislado (ejemplo real: el
import roto de `reference/test_calculations_golden.py`, T01). Ver `references/flujos.md` para el
mapa completo de qué archivo/tabla/RPC pertenece a qué capa.
