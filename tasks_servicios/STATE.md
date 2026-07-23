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

## Fase 1 — Superficie de lectura (cerrada 2026-07-21)

Entregó `v_tire_services` y `servicios.html` sobre el modelo de captura existente. **Su definición de
servicio quedó parcialmente superada por ADR-0008** (Fase 2): D1 —«un servicio es una salida»— y D2
—«`installation` es un tipo sintético»— se reabrieron al descubrirse que el modelo de captura no puede
representar un servicio completo. Las filas 01–09 son **historia**: describen correctamente lo que se
decidió entonces y no se reescriben.

| # | Título | Propietario | Estado | Depende de | Archivos exclusivos | Resultado/Revisión |
|---|---|---|---|---|---|---|
| 01 | Auditoría y contrato de datos | CLAUDE | APROBADO | — | Documentos de esta carpeta | Auditoría cerrada. Hallazgo central: `sequence - 1` es índice exacto en `request_items`, verificado en los 4 puntos de la cadena (`AUDIT.md` §6). Contrato congelado en `CONTRATOS_DATOS.md`. **D11 (zona horaria) queda pendiente de confirmación humana y bloquea el cierre de task_02.** |
| 02 | Migración `v_tire_services` | CLAUDE | APROBADO | 01 | `supabase/migrations/20260721130000_tire_services_view.sql` | D11 confirmada por el humano el 2026-07-20 (`America/Lima`, ver `DECISIONES.md`). Migración escrita conforme a `CONTRATOS_DATOS.md`. `sync-migration-reviewer`: sin hallazgos bloqueantes — `security_invoker`/grants correctos, sin filtro de `company_id`, pareo de dos niveles sin duplicados, `casing_exists` sin `upper()`, `installation` no toca el enum y guarda de índice negativo en `prev_item` correcta. Cierre 2026-07-20 sin rama efímera por decisión humana: el `SELECT` completo pasó `EXPLAIN (FORMAT JSON)` contra el esquema remoto PostgreSQL 17.6 en modo de solo lectura; se confirmaron tablas, tipos, RLS, grants e índices base, incluido el uso de `tire_casings_company_code_uidx`. La propiedad del tope de pareo pasó 4,851 combinaciones locales y `git diff --check` quedó limpio. No se aplicó DDL remoto. Las 4 queries de aceptación sobre la vista (conteos, invariante, duplicados y distribución de `rotation_pairing`) quedan para `task_04`, inmediatamente después de la aplicación autorizada. |
| 03 | Pruebas SQL de la vista | CLAUDE | APROBADO | 02 | `supabase/tests/tire_services_view.test.sql` | Suite S1–S9 ejecutada en producción inmediatamente después de aplicar la vista: resultado esperado `P0001 TESTS_PASSED`; el `DO` revirtió todos los fixtures. Cubre rotación exacta, no duplicación, instalación sintética, orden mixta, desalineación `inferred`, tope 2:1, normalización de marca, código sin historial y aislamiento A/B bilateral con control positivo propio. Revisión independiente: APTO, sin bloqueantes. |
| 04 | Aplicación remota y verificación | CLAUDE + USUARIO | APROBADO | 03 | Evidencia en esta tabla | Autorizada por el humano el 2026-07-20 al indicar continuar todos los tasks, manteniendo su decisión de no crear rama efímera. Migración `tire_services_view` aplicada en producción; rollback verificado: `drop view` + `drop index`. Conteos reales: vista=0, salidas=0, entradas=0, instalaciones=0, rotaciones vista/ejecución=0/0, sin historial=0, duplicados=0; distribuciones de tipo, marca y `rotation_pairing` vacías porque aún hay 0 ejecuciones. `security_invoker=true`; `anon SELECT=false`, `authenticated SELECT=true`; índice exacto `(company_id, captured_at DESC, sequence)`. Dos sesiones de empresas distintas: visibles=0 y cross-tenant=0 en ambas; el control positivo bilateral quedó cubierto por S9. `EXPLAIN ANALYZE` autenticado: usa `tire_movement_executions_company_captured_idx`, 1.080 ms, 0 lecturas de disco. Advisors antes/después sin avisos nuevos; permanecen solo deudas preexistentes. Volumen: 269 unidades, 0 ejecuciones; proyección contractual ~500 unidades/~3,800 neumáticos. HTTP con `apikey` pública y sin sesión: **401**, PostgreSQL `42501 permission denied for view v_tire_services`; no se expone a `anon`. |
| 05 | Capa de datos, modelo puro y Vitest | CODEX | APROBADO | 04 | `WEB/servicios/{package.json,vitest.config.js,data.js,servicios-model.js,__tests__/*}` | `data.js` consulta solo `v_tire_services` con 38 columnas explícitas (incluye `company_id`, que RLS ya acota a la empresa de la sesión; no filtra por él en el cliente), orden contractual, límite 2.000 y aviso `truncated`; normaliza numéricos sin tocar identidades y carga el perfil mínimo para decidir acceso antes de interpretar una lista vacía. Modelo puro: 8 tipos reutilizando `MOVEMENT_REASONS`, 12 facetas en orden contractual, URL multivalor, AND/OR compartido, búsqueda por tokens, resumen, segmentos que suman 100 exacto y enlaces seguros. Suite nueva 34/34. Regresión sin modificar suites existentes: shared 50/50, movimientos 176/176, inventario 15/15, buscador 19/19, neumáticos 3/3. `node --check` y `git diff --check` limpios. |
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

   > **Esta regla se evaluó y NO se activó.** Al auditar el defecto se comprobó que corregirlo no
   > necesita ninguna tabla nueva: ver `PLAN_PAREO.md` §3. Lo que sí exigía esquema se sacó a
   > `FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`.

---

# Fase 2 — El servicio es una posición atendida

Plan: `PLAN_PAREO.md`. Orquestador: `PROMPT_ORQUESTADOR_PAREO.md`.
Fuera de alcance, con su razonamiento: `FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`.

**El problema.** La planilla real (`app movimientos/Untitled.jpg`) ancla cada fila en `BUS`+`POS`: una
fila es una posición atendida. `addRotation` emite la mitad —`exit@origen` + `entry@destino`, un casco
reubicándose— y la única orden real de producción lo demuestra: `exit P3 rotation` + `entry P7` con el
**mismo casco** dejó P3 vacía y el ocupante de P7 sin registro de salida. La otra orden real es un
`exit` de `retention` en P1 sin entrada. Además el conteo es asimétrico: un scrap con reemplazo cuenta
2 servicios y una rotación cuenta 1, para el mismo hecho físico.

**Por qué son 4 tareas y no 12.** Se verificó en modo lectura que si `addRotation` emite 4 ítems
(`exit@3, entry@3, exit@7, entry@7`), la vista **actual** ya produce 2 servicios pareados en su misma
posición, sin `installation` fantasma. El pareo estructural de la Fase 1 estaba bien diseñado; fallaba
lo que el supervisor le mandaba. Y `draftFromOrder` es `request_items.map(newExecutionItem)`, genérico
sobre N ítems: **la app móvil no cambia**. El origen, además, se deriva —no se captura— cuando el
casco que entra salió en la misma orden.

| # | Título | Propietario | Estado | Depende de | Archivos exclusivos | Resultado/Revisión |
|---|---|---|---|---|---|---|
| 10 | La rotación emite el par completo por posición | CLAUDE | APROBADO | — | `WEB/movimientos/supervisor-order-model.js`, `supervisor-orders-ui.js`, `movimientos-controller.js`, `movimientos.css`, `__tests__/supervisor-order-model.test.js` | Ejecutada 2026-07-21. `addRotation(3,7)` emite 4 ítems en el orden contractual `exit@3, entry@3, exit@7, entry@7` — cada ingreso pegado a su salida, que es lo que exige el pareo por `sequence - 1`. Verificación de punta a punta simulando la lógica real de la vista sobre ese payload: **2 servicios**, `P3 sale CASCO-A / entra CASCO-B en P3` y `P7 sale CASCO-B / entra CASCO-A en P7`; estado final `P3=CASCO-B P7=CASCO-A` (ambas ocupadas) y **cascos sin registro de salida: ninguno**. Completitud agregada a `validateOrderDraft` como **puerta de emisión**, no de edición: `requireCompleteness` por defecto `true` (lo hereda el emit de `movimientos-controller.js:277`) y `false` en `addOrderItem`/`addRotation`, porque durante el armado una salida suelta es un estado intermedio normal. Ausencia declarada resuelta con la clave `without_entry` en el ítem: `create_tire_movement_order` valida direction/position/reason e **ignora claves extra**, así que viaja a `request_items` sin tocar la RPC. `setExitWithoutEntry` la activa y revierte. UI reescrita a una fila por posición atendida, como la planilla, con `QUITAR` sobre la posición entera (`removeOrderPosition`) para que no se pueda dejar media rotación, y botón `SIN REEMPLAZO` / `PEDIR REEMPLAZO` sobre una salida sin ingreso; el aviso usa texto además de color. `removeOrderItem` quedó sin usos y se eliminó. `supervisor-order-projection.js` **no requirió cambios**: ya agrupaba por posición y etiqueta `CAMBIO ORDENADO` cuando hay salida e ingreso. Suites: movimientos 183/183 (eran 176, +7 nuevas; una existente reescrita —la que fijaba el shape de 2 ítems de la rotación— porque el comportamiento cambió a propósito), servicios 34/34, shared 50/50, buscador 19/19, inventario 15/15, neumáticos 3/3, todas **sin modificar**. `node --check` y `git diff --check` limpios. **Pendiente de `task_12`:** smoke en navegador con sesión real. |
| 11 | Vista: pareo general y origen derivado | CLAUDE | APROBADO CON DEUDA | 10 | `supabase/migrations/20260722090000_tire_services_view_pairing.sql`, `WEB/servicios/{data.js,servicios-controller.js,servicios.css}`, `WEB/servicios.html`, `__tests__/data.test.js` | Ejecutada 2026-07-21. **Pareo generalizado**: `exits_rotation` → `exits` (toda salida), y el par ahora exige **misma posición** en las tres condiciones —`own_item`, `prev_item` y la ejecución real—. Sin esa condición el defecto volvía con otra forma: un ingreso pareando con la salida de otra posición. El nivel 2 inferido también se reescribió para rankear por `(order_id, position_number)` en vez de por orden completa, porque bajo el modelo nuevo el ranking global podía casar posiciones distintas. **Origen derivado** (`entry_origin_position`): CTE `exit_casings` mapea `(order_id, casing_code) → posición de salida`; se resuelve contra `pair_casing_code` en una salida pareada y contra el propio `casing_code` en una instalación. `min()` para que un casco repetido resuelva determinista en vez de duplicar filas. Verificado con SELECT de solo lectura **antes** de aplicar, sobre datos sintéticos: rotación de 4 ítems → **2 servicios**, ambos `exact`, `pair_position_number` = posición propia (3 y 7), y orígenes cruzados (P3 recibe desde P7, P7 desde P3); **scrap con reemplazo en P2 → 1 servicio** (bajo la v1 eran 2: `discard` + `installation` fantasma) — **la asimetría que originó la fase desapareció**; orden desalineada → salida `not_paired` + instalación, sin pareo cruzado. Filas heredadas en producción: `exit@P3 rotation` queda `not_paired` y `entry@P7` queda `installation`, tal como predijo `task_11` §5, y el origen derivado **sí** las resuelve (`entry_origin_position=3`) sin inventar par. Aplicada con `create or replace view`: hubo que mover `entry_origin_position` **al final** de la lista de columnas porque `create or replace` no admite insertar en el medio (`42P16`); así se evitó el `drop view`. Post-aplicación: `security_invoker=true`, `anon SELECT=false`, `authenticated SELECT=true`, 2 filas, 0 duplicados. Web: `positionLabel` deja de mostrar `P3 → P7` (sería siempre `P3 → P3`) y la posición se dice una vez, como la planilla; `entryLabel` nuevo muestra qué entra y desde dónde, con `ORIGEN NO DETERMINADO` cuando vino de afuera y `VUELVE EL MISMO` cuando el casco regresa a su posición. Párrafo de alcance reescrito con qué cuenta **y qué no**: excluye trabajos sin desmontaje e inspecciones. Se corrigió de paso `.services-intro > p:last-child`, que con dos párrafos dejaba el primero sin estilo. Suites: servicios 35/35 (+1), movimientos 183/183, shared 50/50, buscador 19/19, inventario 15/15, neumáticos 3/3, sin modificar las existentes. **Deuda declarada:** no se corrió `sync-migration-reviewer` (el entorno de esta sesión no permite lanzar subagentes) ni el smoke autenticado en navegador; ambos quedan para `task_12`. |
| 12 | Suites y prueba de campo | CODEX + USUARIO | PENDIENTE | 11 | `PRUEBA_CAMPO_PAREO.md` | |
| 13 | ADR-0008, barrido y cierre | CLAUDE | APROBADO | 12 (ejecutada fuera de orden) | `decisions/0008-*`, superseción en `decisions/0007-*`, `REVISION_FINAL_PAREO.md`, `knowledge/ai/{05,07,10,12}`, notas de histórico en 6 documentos de Fase 1, columna Revisión | Ejecutada 2026-07-22, **antes de `task_12`** por decisión humana: la documentación no depende de la prueba de campo y el barrido de afirmaciones vencidas urgía más que el orden nominal. `decisions/0008-servicio-por-posicion-atendida.md` cubre los seis puntos: unidad de conteo, por qué la asimetría era defecto y no simplificación, **por qué no hizo falta cambiar el esquema ni la app móvil** (el punto que evita reabrir una fase grande innecesaria), el origen derivado, su límite declarado, y la ausencia de reemplazo como declaración explícita. ADR-0007 recibió bloque de superseción al inicio con el alcance exacto —D1 superada, D2 sin objeto, D3–D14 vigentes— y **su cuerpo quedó intacto**: D1 y D2 fueron correctas dado lo que la app capturaba entonces. Verificado que ADR-0008 no contradice ADR-0005 (Servicios sigue sin ser navegable) ni ADR-0006. Barrido: los 6 documentos históricos de Fase 1 (`PLAN`, `CONTRATOS_DATOS`, `REVISION_FINAL`, `PRUEBA_CAMPO`, `PROMPT_ORQUESTADOR`, `AUDIT`) recibieron nota de cabecera que remite a ADR-0008 **sin reescribirlos**; las notas vigentes `knowledge/ai/{05,07,10,12}` se corrigieron con `updated: 2026-07-22` y `sources` ampliados. Re-barrido final: 0 afirmaciones vencidas en documentos vigentes. `knowledge/ai/10` registra la deuda nueva de la fase, incluida la que **no** favorece al entregable: sin `sync-migration-reviewer`, sin smoke autenticado, `without_entry` como convención de payload y no dato, y el origen externo sin medir en producción. `REVISION_FINAL_PAREO.md` separa evidencia local (§2) de esquema (§3) y declara en §4 que **no hay evidencia de campo**. `npm run docs:check` verde; `git diff --check` limpio. No se tocó `WEB/`, `app movimientos/`, `supabase/` ni `scripts/`. |

## Orden de ejecución — Fase 2

```text
10 → 11 → 12 → 13
```

Todas secuenciales. Ninguna pareja de tareas comparte archivo.

`task_10` va antes que `task_11` a propósito: la vista parea lo que el supervisor emite, así que
primero tiene que emitirse bien. Parear en la vista lo que se emitió mal sería inventar el dato.

## Reglas de bloqueo — Fase 2

1. **Cero cambios de tabla, enum, RPC y policy.** La única migración es `create or replace view`. Si
   alguna tarea parece exigir más, se detiene: ya se evaluó y está en la fase futura.

2. **Cero cambios en `app movimientos/`.** Si la app falla con 4 renglones (`task_12` punto 3), la
   premisa de la fase resultó falsa: se detiene todo, porque cambia el alcance y el riesgo.

3. **La entrada de cada posición va inmediatamente después de su salida** en `request_items`. La
   vista parea en `sequence - 1`; agruparlas de otra forma rompe el pareo en silencio.

4. **Si el pareo general produce duplicados** (`task_11`), el `left join` no está acotado. Es el error
   más probable de la fase, igual que lo fue en `task_02`.

5. **Si `rotation_pairing` devuelve `inferred` sobre datos reales**, `task_10` no está emitiendo el
   par adyacente. El problema está aguas arriba: **no se relaja la vista**.

6. **Si una rotación real deja una posición vacía o un casco sin registro de salida** (`task_12`
   punto 5), la fase **no cierra**. Es el defecto que existe para corregir.

7. **Si un scrap con reemplazo sigue contando 2** (`task_12` punto 8), la asimetría persiste: vuelve
   a `task_11`.

8. **Ninguna suite existente se modifica para que pase.** Si `movimientos` (176), `shared` (50),
   `inventario` (15), `buscador` (19) o `neumaticos` (3) rompen, algo cambió de comportamiento. Los
   cambios que la decisión de conteo obligue se justifican **uno por uno**.

9. **No se inventa origen.** Sin código legible o sin salida correspondiente en la orden, la columna
   es nula y la pantalla lo muestra indeterminado.

10. **No se reescribe la historia de la Fase 1.** Los documentos 01–09 se marcan superados y se
    enrutan a ADR-0008; no se editan para que parezca que siempre dijeron otra cosa.
