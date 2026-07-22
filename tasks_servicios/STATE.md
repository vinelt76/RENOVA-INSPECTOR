# STATE — Sección Servicios

Estados: `PENDIENTE` · `EN CURSO` · `EN REVISIÓN` · `APROBADO` · `APROBADO CON DEUDA` ·
`EN CORRECCIÓN` · `BLOQUEADA POR DECISIÓN HUMANA` · `N/A`.

`APROBADO CON DEUDA` se agregó el 2026-07-21 para `task_08`: la tarea cumple la definición de
terminado de `PLAN.md` §10, pero dejó un hallazgo real sin corregir por decisión humana. Marcarla
`APROBADO` a secas ocultaría que el refresco automático no funciona; dejarla bloqueada afirmaría
que la fase no cumple sus criterios, y sí los cumple. La deuda vive en `REVISION_FINAL.md` §5 y en
`knowledge/ai/10`.

Cada ejecutor actualiza solo su fila al iniciar y terminar. La autoridad sigue siendo el código, el
esquema y las pruebas; esta tabla es la bitácora.

| # | Título | Propietario | Estado | Depende de | Archivos exclusivos | Resultado/Revisión |
|---|---|---|---|---|---|---|
| 01 | Auditoría y contrato de datos | CLAUDE | APROBADO | — | Documentos de esta carpeta | Auditoría cerrada. Hallazgo central: `sequence - 1` es índice exacto en `request_items`, verificado en los 4 puntos de la cadena (`AUDIT.md` §6). Contrato congelado en `CONTRATOS_DATOS.md`. **D11 (zona horaria) queda pendiente de confirmación humana y bloquea el cierre de task_02.** |
| 02 | Migración `v_tire_services` | CLAUDE | APROBADO | 01 | `supabase/migrations/20260721130000_tire_services_view.sql` | D11 confirmada por el humano el 2026-07-20 (`America/Lima`, ver `DECISIONES.md`). Migración escrita conforme a `CONTRATOS_DATOS.md`. `sync-migration-reviewer`: sin hallazgos bloqueantes — `security_invoker`/grants correctos, sin filtro de `company_id`, pareo de dos niveles sin duplicados, `casing_exists` sin `upper()`, `installation` no toca el enum y guarda de índice negativo en `prev_item` correcta. Cierre 2026-07-20 sin rama efímera por decisión humana: el `SELECT` completo pasó `EXPLAIN (FORMAT JSON)` contra el esquema remoto PostgreSQL 17.6 en modo de solo lectura; se confirmaron tablas, tipos, RLS, grants e índices base, incluido el uso de `tire_casings_company_code_uidx`. La propiedad del tope de pareo pasó 4,851 combinaciones locales y `git diff --check` quedó limpio. No se aplicó DDL remoto. Las 4 queries de aceptación sobre la vista (conteos, invariante, duplicados y distribución de `rotation_pairing`) quedan para `task_04`, inmediatamente después de la aplicación autorizada. |
| 03 | Pruebas SQL de la vista | CLAUDE | APROBADO | 02 | `supabase/tests/tire_services_view.test.sql` | Suite S1–S9 ejecutada en producción inmediatamente después de aplicar la vista: resultado esperado `P0001 TESTS_PASSED`; el `DO` revirtió todos los fixtures. Cubre rotación exacta, no duplicación, instalación sintética, orden mixta, desalineación `inferred`, tope 2:1, normalización de marca, código sin historial y aislamiento A/B bilateral con control positivo propio. Revisión independiente: APTO, sin bloqueantes. |
| 04 | Aplicación remota y verificación | CLAUDE + USUARIO | APROBADO | 03 | Evidencia en esta tabla | Autorizada por el humano el 2026-07-20 al indicar continuar todos los tasks, manteniendo su decisión de no crear rama efímera. Migración `tire_services_view` aplicada en producción; rollback verificado: `drop view` + `drop index`. Conteos reales: vista=0, salidas=0, entradas=0, instalaciones=0, rotaciones vista/ejecución=0/0, sin historial=0, duplicados=0; distribuciones de tipo, marca y `rotation_pairing` vacías porque aún hay 0 ejecuciones. `security_invoker=true`; `anon SELECT=false`, `authenticated SELECT=true`; índice exacto `(company_id, captured_at DESC, sequence)`. Dos sesiones de empresas distintas: visibles=0 y cross-tenant=0 en ambas; el control positivo bilateral quedó cubierto por S9. `EXPLAIN ANALYZE` autenticado: usa `tire_movement_executions_company_captured_idx`, 1.080 ms, 0 lecturas de disco. Advisors antes/después sin avisos nuevos; permanecen solo deudas preexistentes. Volumen: 269 unidades, 0 ejecuciones; proyección contractual ~500 unidades/~3,800 neumáticos. HTTP con `apikey` pública y sin sesión: **401**, PostgreSQL `42501 permission denied for view v_tire_services`; no se expone a `anon`. |
| 05 | Capa de datos, modelo puro y Vitest | CODEX | APROBADO | 04 | `WEB/servicios/{package.json,vitest.config.js,data.js,servicios-model.js,__tests__/*}` | `data.js` consulta solo `v_tire_services` con 38 columnas explícitas, sin `company_id`, orden contractual, límite 2.000 y aviso `truncated`; normaliza numéricos sin tocar identidades y carga el perfil mínimo para decidir acceso antes de interpretar una lista vacía. Modelo puro: 8 tipos reutilizando `MOVEMENT_REASONS`, 12 facetas en orden contractual, URL multivalor, AND/OR compartido, búsqueda por tokens, resumen, segmentos que suman 100 exacto y enlaces seguros. Suite nueva 34/34. Regresión sin modificar suites existentes: shared 50/50, movimientos 176/176, inventario 15/15, buscador 19/19, neumáticos 3/3. `node --check` y `git diff --check` limpios. |
| 06 | Pantalla, controlador y CSS | CODEX | APROBADO | 05 | `WEB/servicios.html`, `WEB/servicios/{servicios-controller.js,servicios.css}` | Pantalla de solo lectura completa: shell, buscador global, filter-bar compartido, URL multivalor con Atrás/Adelante, 4 tiles, barra/leyenda accesible, filas no clicables y enlaces puntuales, 8 estados, rol previo a lista vacía, truncado y Realtime sobre `tire_movement_executions`. Smoke HTTP/Chrome con fixture controlado: 3 filas → OR de unidad 2/3, AND con tipo 1/3, URL y chips restaurados por historial; porcentajes 33,4+33,3+33,3, `aria-label` completo; rotación `P3 → P7`; casco registrado navega, no registrado queda `SIN HISTORIAL`; buscador abre con Ctrl+K fuera del filtro y no captura el atajo dentro; 1280×900 y 390×844 sin overflow; `prefers-reduced-motion` = 0 s; vacío = cuatro `—` y sin barra; corte real de 2.000 muestra banner; rol `inspector` muestra acceso denegado. Realtime simulado recargó vacío/truncado. Consola limpia, sin excepciones. Producción sigue con 0 ejecuciones (task 04), por eso el tag `ATRIBUCIÓN INFERIDA` no pudo aparecer con dato real; su render se cubrió con fixture controlado. Suite Servicios 34/34, `node --check` y `git diff --check` limpios. |
| 07 | Navegación y bundle estático | CODEX | APROBADO | 06 | Los 8 HTML de `AUDIT.md` §9, `scripts/prepare-static-hosting.mjs` | Enlace `Servicios` insertado exactamente una vez después de Inventario en las 8 variantes documentadas: Inspecciones por fecha, Inspecciones por unidad (`a.chip`), Rendimiento, Historial, Importar, Inventario, Neumáticos e Instalación; orden previo y activos conservados. Bundle regenerado: incluye `servicios.html` y los cuatro JS/CSS de producción; excluye `package.json`, `vitest.config.js` y `__tests__`. Se corrigió una inconsistencia del task: el filtro por extensión sí copiaba `vitest.config.js`, por lo que el script ahora lo omite explícitamente en todos los módulos. Bundle servido por HTTP: todos los recursos propios 200/304, sin 404, consola limpia; smoke funcional completo repetido desde `deploy-static/web`. `git diff --check` limpio. |
| 08 | Suite integral y smoke autenticado | CODEX + USUARIO | APROBADO CON DEUDA | 07 | `PRUEBA_CAMPO.md` | Núcleo real aprobado el 2026-07-21 sin rama efímera: orden QA `71f7aaba-01f0-4a78-9270-e33dd03a6f26` emitida por UI y cerrada por la app normal; estado `completed`, 2 ejecuciones y exactamente 1 servicio `rotation` P3→P7 con `rotation_pairing='exact'`; tile 0→1 y barra 100,0 %. Aislamiento de campo: MÓVIL BUS=1, CIVA=0. **Hallazgo:** el punto 17 falla realmente porque `tire_movement_executions` no está en `supabase_realtime`; las pestañas no actualizaron sin recarga aunque la consulta autenticada ya veía la fila. **Resolución humana del 2026-07-21:** se descarta la migración de excepción y se acepta como deuda registrada — el refresco automático no figura en `PLAN.md` §10, así que no es criterio de terminado; el punto 17 era verificación adicional. La deuda queda en `knowledge/ai/10` y `REVISION_FINAL.md` §5 con su remedio nombrado. Cinco puntos N/A de campo (5, 6, 7, 12, 14) registrados como pendientes de firma visual, con cobertura SQL/modelo, en `REVISION_FINAL.md` §4. Suites/evidencia local verdes: Servicios 34/34, shared 50/50, buscador 19/19, Neumáticos 3/3, Inventario 15/15, Movimientos 176/176 y SQL S1–S9. |
| 09 | Documentación, ADR y revisión cruzada | CLAUDE | APROBADO | 08 | `REVISION_FINAL.md`, `decisions/0007-*`, knowledge enumerado en `task_09`, `DESIGN.md`, columna Revisión de esta tabla | ADR-0007 escrito con los seis puntos de `task_09` §6.1; se verificó explícitamente que D5 **no** contradice ADR-0005 —lo aplica: Servicios es el tercer consumidor del patrón «enruta, no ejecuta», junto con el buscador y Neumáticos—, por lo que no correspondió detener por §8. `DESIGN.md` §8 recibió las dos viñetas (captura vs. filtro; rampa monocroma + color nunca como único canal). Cinco notas de `knowledge/ai` actualizadas con `updated`/`sources`: `05` (vista + convención horaria `America/Lima` como regla **del proyecto**), `07` (Servicios como superficie: qué mide, qué no, a qué enruta, y su par con el modo Movimientos), `09` (los dos patrones visuales), `10` (siete deudas, incluida la de Realtime) y `12` (índice del ADR). Se corrigieron de paso dos afirmaciones vencidas en knowledge: «7 pantallas» → 8 en `07` y «7 HTML» → 8 en `10`. `REVISION_FINAL.md` separa evidencia local (§2) de campo (§3), registra los N/A con motivo (§4) y las deudas (§6). `npm run docs:check` verde; `git diff --check` limpio. No se tocó `WEB/`, `supabase/` ni `scripts/`. |

## Orden de ejecución

Los números son etiquetas; la verdad es la columna «Depende de». Secuencia real:

```text
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09
```

Todas secuenciales. Ninguna pareja de tareas comparte archivo.

Las pruebas SQL (`03`) van **antes** de aplicar al remoto (`04`) a propósito: si la definición de
servicio se materializa mal, el error se hereda sin que se note en ninguna capa superior.

## Reglas de bloqueo

1. **`task_02` no cierra sin D11 confirmada.** Sin decisión de zona horaria, `captured_on` agrupa en
   UTC y un servicio capturado a las 20:00 en Lima cae al día siguiente en las facetas. No se elige
   un default en silencio.

2. Si el caso de **orden desalineada** de `task_03` no mantiene el invariante de conteo del contrato
   §1, el diseño de dos niveles está mal: `task_02` pasa a `EN CORRECCIÓN`. **No se relaja la
   aserción para que pase.**

3. Si `select rotation_pairing, count(*) ... group by 1` sobre datos reales en `task_04` devuelve
   `inferred` o `not_paired`, la tarea pasa a `BLOQUEADA POR DECISIÓN HUMANA`. Significa que la
   alineación `sequence ↔ request_items` ya está rota en producción, y publicar métricas que la gente
   va a creer sin entender por qué es peor que no publicarlas.

4. Si el conteo de la vista no cuadra con `salidas + entradas − rotaciones cerradas`, la definición de
   servicio no se está materializando: `task_02` vuelve a `EN CORRECCIÓN`.

5. Si `task_05` necesita modificar alguna suite existente (`shared`, `movimientos`, `inventario`,
   `buscador`, `neumaticos`) para que pase, algo cambió de comportamiento: `EN CORRECCIÓN`.
   **No se ajustan los tests.**

6. Si el bundle estático de `task_07` no contiene `servicios/`, la tarea no se aprueba. Una página que
   se despliega con sus módulos en 404 es peor que no desplegarla.

7. Si cualquier tarea necesita una segunda migración, un cambio de RPC o una columna nueva en tabla,
   se detiene: eso es una fase de esquema separada, no una ampliación silenciosa de esta.
