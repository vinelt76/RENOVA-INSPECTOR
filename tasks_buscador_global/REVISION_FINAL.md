# REVISIÓN FINAL — Buscador global y objetos navegables

Fecha: 2026-07-19. Cierra la fase de `task_01` a `task_13` (`STATE.md`), incluidas las cuatro tareas
(`10`-`13`) que nacieron de la revisión humana de `task_07`.

## Veredicto

**APROBADO**, con la deuda de datos y las dos brechas de cobertura registradas explícitamente en
§5, no ocultadas. Ninguna es un defecto del buscador: son límites de los datos disponibles o
verificaciones que exigen crear datos de prueba en producción, cosa que esta fase evitó por diseño.

- El índice cubre exactamente `count(*)` de `units` y `tire_casings` de la empresa, antes y después
  de agregar las facetas de `task_12` (269 U + 40 C, verificado dos veces).
- Un casco `code_mismatch` se encuentra por ambos códigos.
- Un casco sin código es visible y no produce enlace falso, en el buscador y en `neumaticos.html`.
- Aislamiento por empresa verificado con dos cuentas reales; la caché muere al cambiar de sesión.
- Las dos páginas de objeto son alcanzables desde el buscador y desde la navegación existente.
- Suites nuevas y de regresión verdes, estas últimas **sin modificación** (criterio de bloqueo de
  `task_04`/`task_08`, nunca se activó).
- `git diff --check` y `npm run docs:check` verdes.
- ADR-0005 registrado — primer ADR de UI del proyecto.

## Evidencia local (reproducible, sin sesión real)

```
WEB/shared:      4/4
WEB/buscador:    18/18
WEB/neumaticos:  3/3
WEB/inventario:  15/15  (regresión, sin cambios en sus pruebas)
WEB/movimientos: 166/166 (regresión, sin cambios en sus pruebas)
```

- `node scripts/prepare-static-hosting.mjs`: bundle incluye `buscador/`, `shared/`, `neumaticos/` y
  `neumaticos.html`.
- `git diff --check`: sin conflictos de espacio en blanco.
- `npm run docs:check`: 15 notas IA y 12 notas humanas válidas.
- Migración `20260719180841_search_index_facets.sql`: revisada retrospectivamente por
  `sync-migration-reviewer` → **APPROVE**. Columnas originales sin cambio de orden/tipo,
  `security_invoker=true` y grant solo `authenticated/SELECT` intactos, sin joins nuevos (los
  laterales ya existían en la vista base), sin tocar otra vista/tabla/RPC/policy.
- RLS confirmada en las 6 tablas base de `v_search_index` (`units`, `tire_casings`,
  `tire_life_cycles`, `tire_installations`, `inspections`, `inspection_measurements`): las seis
  tienen `select_own_company` filtrando por `current_company_id()`, sin excepciones para `anon`.
- Advisors de Supabase: sin hallazgos nuevos atribuibles a esta fase; las advertencias existentes
  (RPCs `SECURITY DEFINER` de otras fases, `leaked_password_protection`, extensión `btree_gist` en
  `public`) son preexistentes y fuera de alcance.

Detalle completo por tarea: `STATE.md` filas 01-13.

## Evidencia de campo (sesión real, la ejecuta la persona responsable)

Corrida original (`PRUEBA_CAMPO.md`, sobre el estado de `task_07`): cobertura exacta por empresa
(A: 98/98 U + 40/40 C; B: 107/107 U + 0/0 C), un `code_mismatch` encontrado por ambos códigos, 3
cascos sin código resolviendo a su unidad sin enlace falso, aislamiento A→B confirmado cerrando e
iniciando sesión en la misma pestaña, 0 errores de consola.

Repetición 2026-07-19 (obligatoria tras `task_10`-`task_13`, que tocaron `finder-controller.js`,
`search-model.js`, `data.js` y agregaron `neumaticos.html`): la persona responsable confirmó los 19
puntos de la checklist (los 15 de `task_08` §6 más overlay centrado, frecency persistida y purgada
al cambiar de sesión, chips de alcance `uni:`/`neu:`, y facetas + URL compartible + botón atrás en
`neumaticos.html`). **Salvedad registrada, no ocultada:** esta repetición fue una confirmación
consolidada; no se volvieron a capturar los conteos disgregados por empresa. Los números de
cobertura/aislamiento de la corrida original siguen siendo la evidencia numérica vigente — no
quedaron invalidados, solo no se remidieron dígito por dígito en esta vuelta.

## Revisión cruzada contra `PLAN.md` §10

| Criterio | Resultado |
|---|---|
| Contrato de datos respetado, `security_invoker` presente | Sí — confirmado en `v_search_index` original y en la extensión de `task_12`. |
| `SELECT` solo a `authenticated`, nunca `anon` | Sí — grants verificados dos veces (task_03 y esta revisión). |
| Ninguna vista, tabla, RPC o policy existente modificada | Sí — `task_12` es `create or replace view` aditivo; `sync-migration-reviewer` lo confirma. |
| Caché destruida al cambiar de empresa | Sí — paso 7 de `task_08`, confirmado en ambas corridas de campo. |
| Suites existentes verdes y sin modificar | Sí — Inventario 15/15 y Movimientos 166/166, sin diffs en sus `__tests__/`. |
| Ningún enlace construido sobre código nulo | Sí — casco sin código enruta a unidad en buscador y en `neumaticos.html`. |
| Sin escritura en el buscador | Sí — D9, sin acciones de descarte/retiro/reinstalación alcanzables. |
| Sin `service_role`, secretos ni filas completas en logs/bitácora | Sí — todas las consultas de esta revisión usaron el rol del proyecto vía MCP de solo lectura; ninguna fila completa quedó registrada en `STATE.md`/`PRUEBA_CAMPO.md`, solo conteos. |

## Deuda registrada (no resuelta en esta fase)

Detalle y porqué en `knowledge/ai/10 - Roadmap deuda y riesgos.md`:

1. **Variantes de caja en `brand_name`** — `GOODYEAR`/`goodyear`, `HANKOOK`/`hankook`,
   `BRIDGESTONE`/`Bridgestone`; 13 de 2 247 mediciones. No afecta al buscador; sí parte marcas en
   `v_rendimiento_dashboard_rows`. Remedio: `upper(trim())` en la RPC de escritura + backfill,
   idealmente antes del baseline de las 2 096 posiciones. `size_name` se midió limpio — no es deuda.
2. **`QA-TEST` en producción** — 9 cascos, 14 mediciones, datos de prueba de la unidad `QA-CN16`
   mezclados con datos reales. Requiere decisión humana; no se propone borrado de oficio.
3. Identidad de cascos sin código sin historial alcanzable (limitación aceptada en ADR-0005).
4. Navegación duplicada a mano en los 7 HTML de entrada.
5. `renova-animate.js`/`renova-format.js` fuera de la allowlist del bundle estático — hallazgo
   preexistente de `task_07`, reconfirmado presente y no corregido en esta fase.

## Pendiente explícito

- Caso «casco sin código y sin unidad»: **N/A**, no existe actualmente en los datos; no se creó uno
  de prueba para forzarlo. Queda pendiente de verificar si llega a ocurrir en producción.
- Repetición de campo 2026-07-19: confirmación consolidada de la persona responsable, sin conteos
  disgregados nuevos (ver salvedad arriba). Si se requiere evidencia numérica actualizada
  post-`task_13`, hay que volver a correrla capturando conteos por empresa.
- Payload proyectado de `task_12` (≈2.25 MiB para 500 U + 3 800 C) es una estimación por proxy
  (`to_jsonb` en SQL), no una medición real de payload HTTP como la de `task_03`. No se considera
  desproporcionado, pero no se validó con un fetch real a esa escala.
