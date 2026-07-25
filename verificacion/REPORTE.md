# Reporte final — Verificación end-to-end de fórmulas y flujos de datos

**Fecha:** 2026-07-24/25. **Alcance:** motor de cálculo (paridad Py/TS + conformidad con
`specs/reglas_negocio.md`), persistencia local, cola de sync, contrato RPC con Supabase (solo
lectura en producción, proyecto `fbxupwwgiebhlciqftpw`), vistas de `WEB/`, coherencia de datos,
smoke test de navegador. Detalle completo por task en `T02.md`–`T11.md`.

## Resumen ejecutivo

El motor de cálculo (`calculations.ts`/`.py`) tiene **paridad perfecta** entre Python y
TypeScript (48/48 casos) y sigue la spec fielmente, con matices menores documentados. Los
problemas reales no están en el cálculo — están en **lo que pasa después de calcular**: datos
que se pierden al sincronizar, reglas que se recalculan distinto del lado del servidor, y grants
de base de datos más amplios de lo que deberían ser. Nada de esto se corrigió en este recorrido
(fuera de un import roto trivial) — se reporta para decisión humana, como pide `CLAUDE.md`.

## Hallazgos por severidad

### Alto

1. **El estado RTD mostrado en el dashboard usa el umbral vigente de la empresa, no el snapshot
   histórico que el dispositivo capturó y envió.** (T05, T08) `fn_rtd_state` recalcula con
   `fn_effective_rtd_thresholds(empresa, medida)` — los campos `rtd_for_change`/`rtd_next_change`
   que la app sí envía en el payload de `save_inspection` no tienen columna donde aterrizar en la
   versión vigente de la RPC. Si una empresa cambia sus umbrales hoy, el estado de TODAS sus
   inspecciones pasadas cambia retroactivamente en el dashboard, contradiciendo el propósito
   documentado de la funcionalidad de snapshots (task_16).
   → `app/src/sync/pushInspeccion.ts`, `supabase/migrations/20260710210000_...sql`.

2. **`fn_pressure_state_fixed` usa un umbral plano 100/130 PSI para toda medida y eje**, en vez
   de `presion_ref`+deltas por empresa/medida/tipo_eje que exige `specs/reglas_negocio.md` §3.
   (T08) Verificado con los propios ejemplos del Excel de referencia: un neumático de Tracción a
   122 PSI (que el Excel marca "Alta Presión") se muestra "Normal" en el dashboard. Mitigante: ya
   está documentado en código como regla provisional (`WEB/Inspecciones por unidad.html:794`), no
   es un descubrimiento oculto, pero sigue siendo una desviación real y verificada que un fleet
   manager puede estar leyendo sin saberlo.

3. **`idi` (Índice de Desgaste Irregular) nunca llega a Supabase.** (T05) Se calcula
   correctamente en el dispositivo (`calcularIdi`, paridad 6/6 confirmada) pero
   `pushInspeccion.ts` no lo incluye en el payload y ninguna migración remota tiene columna para
   él. Ningún dashboard de `WEB/` puede mostrar jamás la "señal anticipatoria" que la spec §4
   describe como el propósito del IDI.

### Medio-Alto

4. **4 vistas de dashboard (`v_inspection_dashboard_rows`, `v_rendimiento_dashboard_rows`,
   `v_inventory_status`, `v_casing_history_summary`) tienen INSERT/UPDATE/DELETE/TRUNCATE
   otorgados a `anon` y `authenticated`**, no solo SELECT. (T09) Verificado en vivo contra
   producción. No explotable hoy porque son joins complejos no auto-actualizables, pero es un
   descuido de higiene de permisos (`GRANT ALL ON ALL TABLES IN SCHEMA public` casi con certeza)
   con riesgo latente si alguna vista se simplifica en el futuro. Amplía el alcance de la deuda
   ya conocida ("grant amplio a `anon` en `v_rendimiento_dashboard_rows`") a 3 vistas más.

### Medio

5. **`isa_peso_snap` nunca puede valer 0** — `calcularIsaPeso(desecho: boolean)` no distingue
   "sin anomalía" de "anomalía sin desecho"; toda fila sin desecho recibe peso 1. (T02, T05) Sin
   impacto visible hoy (ISA no está conectado a ningún dashboard), pero los datos ya persistidos
   localmente están sesgados desde ya.
6. **El guard anti-carrera de `syncQueueRepo.marcarEnviado`/`marcarError`** (protege contra
   marcar como enviada una edición reencolada mientras un push viejo resuelve tarde) no tiene
   ningún test de regresión, pese a que el comentario del código documenta un bug real ya
   encontrado en revisión (task_17). (T06)
7. **`fn_rtd_state` no está definida en ningún archivo de `supabase/migrations/`**, pese a ser
   crítica para `save_inspection`. Existe y corre en producción (confirmado vía `pg_proc`), pero
   probablemente predata el tracking local de migraciones — reconstruir el esquema desde cero con
   solo los archivos versionados rompería el sync completo. (T07)

### Informativo / requiere aclaración humana

8. **"~316 cascos sin código" (deuda documentada) no se pudo reproducir**: la tabla
   `tire_casings` en producción tiene 40 filas totales, solo 3 sin código. Puede ser una nota
   desactualizada o referir a un conteo distinto — se deja como discrepancia declarada, no se
   ajusta la nota de conocimiento sin confirmación humana. (T10)
9. Orden de evaluación en `calcularVur` cuando tasa es NULL y RTD ya está en el límite: la spec
   no fija prioridad entre las dos reglas, la implementación actual devuelve NULL en vez de 0.
   Lectura defendible, no defecto. (T02)
10. `calcularIdi` no repite la validación de negativos que sí tiene `calcularRtdMovi` — sin
    impacto real porque el único llamador real (`inspeccionRepo.ts`) ya filtra antes. (T02)

## Confirmado correcto (vale la pena decirlo, no solo lo que falla)

- Paridad exacta Python↔TypeScript en las 7 funciones del motor de cálculo: 48/48 casos.
- `test_calculations_golden.py` reparado: de **roto** (import a paquete inexistente) a **31/31
  tests verdes**.
- `app/`: 47/47 tests, lint limpio, build limpio.
- Cero constantes 4/7 hardcodeadas fuera de fallbacks documentados y correctamente acotados.
- Firmas de las 3 RPC invocadas por la app (`save_inspection`, `get_umbrales_rtd`,
  `get_unidad_preload`) coinciden exactamente con producción.
- `security_invoker=on` presente en las 8 vistas de dashboard revisadas — sin bypass de RLS.
- Backoff exponencial de sync verificado con reloj real (intento 3 → 8s, intento 20 → tope 300s).
- Aislamiento de fallos en la cola: una fila que falla no bloquea al resto.
- Cifras de deuda técnica del 2026-07-23 en su mayoría **vigentes**: 2183/2247 mediciones sin
  `life_cycle_id` (exacto), ~2094 posiciones `baseline_pending` (exacto), datos QA-TEST con 14
  mediciones en unidad QA-CN16 (exacto, sigue sin resolver).
- Los 4 dashboards de `WEB/` revisados cargan con consola limpia y exigen sesión antes de
  cualquier fetch de datos.

## No verificado en este recorrido (declarado, no silenciado)

- Los 6 tests SQL de `supabase/tests/` (`baseline_mount`, `tire_change_batch`,
  `tire_discard_photos`, `tire_services_view`, `unit_state_reads`, `workshop_rpcs`) — requieren
  escritura; no se ejecutó ninguno. Runner listo en
  `.claude/skills/verify-data-flow/scripts/run_sql_tests.sh` para cuando exista una branch
  efímera de Supabase o entorno local autorizado.
- Idempotencia real de `save_inspection`/`confirm_tire_change_batch` ante reenvío — auditada por
  lectura de código (`on conflict ... do update`, `local_id` fijo), no ejecutada.
- Datos post-login en los 4 dashboards de `WEB/` — sin credenciales de prueba disponibles.
- `reconciliation_status` (distribución real) y publicación `supabase_realtime` para
  `tire_movement_executions` — fuera del set de queries priorizadas.

## Entregables de este recorrido

- `verificacion/T02.md`–`T11.md` + este reporte, con evidencia cruda en `verificacion/evidencia/`.
- `.claude/skills/verify-data-flow/` — skill reutilizable: fixture golden compartido
  (`fixtures/golden.json`, 48 casos), comparador (`scripts/compare_golden.mjs`), runners Python/TS,
  runner de tests SQL documentado, mapa de flujos (`references/flujos.md`).
- `.claude/skills/calc-parity-check/SKILL.md` actualizada para usar el comparador en vez de dos
  comandos sueltos que nunca se comparaban entre sí.
- `reference/test_calculations_golden.py` — import reparado, 31/31 tests verdes (antes: roto).

## Próximo paso sugerido

Los hallazgos 1-3 (Alto) tocan el mismo punto de fricción: el payload de `save_inspection` y la
RPC misma no reflejan completamente lo que la app ya calcula bien. Antes de tocar código, esto
necesita una decisión de producto/negocio (¿el estado RTD del dashboard debe ser histórico o
vigente? ¿se agrega `idi` al esquema ahora?) — no es un fix mecánico. El hallazgo 4 (grants) sí es
mecánico (`REVOKE`) y de bajo riesgo, candidato a corregirse pronto con
`sync-migration-reviewer`. El hallazgo 8 necesita que alguien del equipo confirme qué medía la
cifra original antes de tocar la nota de conocimiento.
