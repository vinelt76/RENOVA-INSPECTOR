# REVISIÓN FINAL — Fase 2: el servicio es una posición atendida

Cierre de fase: **2026-07-22**
Proyecto remoto: `fbxupwwgiebhlciqftpw` (producción)
Autoridad: `STATE.md` para el estado por tarea, `DECISIONES.md` y ADR-0008 para el porqué,
`PLAN_PAREO.md` §6 para la definición de terminado.

> **Evidencia de campo completada el 2026-07-22.** `task_12` emitió y cerró una rotación real de
> 2 servicios/4 ejecuciones y un scrap con reemplazo sobre MÓVIL BUS 2145. El detalle separado
> está en `PRUEBA_CAMPO_PAREO.md`.

---

## 1. Qué se entregó

| Capa | Entregable |
|---|---|
| Emisión | `WEB/movimientos/supervisor-order-model.js` — `addRotation` emite el par completo por posición; completitud como puerta de emisión; `setExitWithoutEntry`, `removeOrderPosition`, `groupDraftByPosition` |
| UI de emisión | `supervisor-orders-ui.js`, `movimientos.css` — una fila por posición atendida, como la planilla; `QUITAR` sobre la posición entera; botón `SIN REEMPLAZO` |
| Esquema | `supabase/migrations/20260722090000_tire_services_view_pairing.sql` — pareo general por posición, nivel 2 acotado por posición, `entry_origin_position` derivado |
| Pantalla | `WEB/servicios/{data.js,servicios-controller.js,servicios.css}`, `WEB/servicios.html` — posición dicha una vez, qué entra y desde dónde, párrafo de alcance con qué **no** cuenta |
| Documentación | ADR-0008, superseción en ADR-0007, `knowledge/ai/{05,07,10,12}`, notas de histórico en los 6 documentos de Fase 1, esta nota |

**La unidad de conteo cambió**: un servicio es una posición atendida. Una rotación entre dos
posiciones cuenta 2; un scrap con reemplazo cuenta 1. Es lo que hereda cualquier reporte futuro, y
por eso tiene ADR.

**Lo que NO se tocó, a propósito**: ninguna tabla, ningún enum, ninguna RPC, ninguna policy, y
**ninguna línea de la app móvil**.

---

## 2. Evidencia LOCAL (automática, reproducible)

| Verificación | Resultado |
|---|---|
| `WEB/movimientos` | **186/186** |
| `WEB/servicios` | **38/38** |
| `WEB/shared` | **50/50** — sin modificar |
| `WEB/buscador` | **19/19** — sin modificar |
| `WEB/inventario` | **15/15** — sin modificar |
| `WEB/neumaticos` | **3/3** — sin modificar |
| Verificación de extremo a extremo del modelo (Node) | rotación → 4 ítems; 2 servicios; `P3=CASCO-B P7=CASCO-A`; **cascos sin registro de salida: ninguno** |
| Bundle estático | contiene `servicios.html` + los 4 JS/CSS y los módulos de movimientos; **0** `package.json`, `__tests__` o `vitest.config.js` |
| Bundle servido por HTTP | 7/7 recursos propios **200**, sin 404 |
| Integridad | `node --check` y `git diff --check` limpios; `npm run docs:check` verde |

El único test existente reescrito es el que fijaba la forma de 2 ítems de `addRotation`. Cambió
porque el comportamiento cambió a propósito; está justificado en la fila 10 de `STATE.md`.

---

## 3. Evidencia de ESQUEMA (producción, solo lectura + una vista)

Verificado **antes** de aplicar, ejecutando el `SELECT` nuevo sobre datos sintéticos en modo lectura:

| orden | posición | tipo | sale | entra | `pair_pos` | origen | pareo |
|---|---|---|---|---|---|---|---|
| ROT | 3 | rotation | A | B | 3 | **P7** | exact |
| ROT | 7 | rotation | B | A | 7 | **P3** | exact |
| SCRAP | 2 | discard | C | D | 2 | — | exact |
| MIXTA | 1 | retention | E | — | — | — | not_paired |
| MIXTA | 4 | installation | F | — | — | — | not_applicable |

**Scrap con reemplazo = 1 servicio.** Bajo la v1 eran 2 (`discard` + `installation` fantasma). Es la
comprobación central de la fase: la asimetría que la originó desapareció.

Estado post-aplicación en producción:

```text
security_invoker = true · anon SELECT = false · authenticated SELECT = true
filas = 2 · service_id duplicados = 0
```

Filas heredadas (`exit@P3 rotation` + `entry@P7`, mismo casco `CN16-0003`): quedan `not_paired` +
`installation`, exactamente como se había previsto. El origen derivado **sí** las resuelve
(`entry_origin_position = 3`) sin inventarles un par.

---

## 4. Evidencia de CAMPO

**Aprobada.** El recorrido usó las interfaces normales y datos reales de MÓVIL BUS 2145:

- rotación P3↔P4: 4 `request_items`, 4 ejecuciones y 2 servicios con pareo `exact`; ambos cascos
  tienen salida e ingreso, con origen cruzado correcto;
- scrap con reemplazo P5: 2 ejecuciones y exactamente 1 servicio `discard`;
- la app operaria manejó las 4 ejecuciones; después del campo su presentación se corrigió a
  2 tarjetas de servicio, cada una con los grupos de salida e ingreso y su origen;
- Servicios refrescó sin recarga manual en 7,2 s y 7,4 s;
- 0 errores de consola o excepciones en las tres superficies.

La evidencia completa, incluidos los `N/A` motivados, está en `PRUEBA_CAMPO_PAREO.md`.

---

## 5. Fuera de alcance, por decisión explícita

Todo en `FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`, con su razonamiento:

- origen externo del neumático que entra (retén / reparación / nuevo);
- reconciliación contra `tire_casings` / `tire_life_cycles` / `tire_installations`;
- `request_item_index` y validación de completitud en `complete_tire_movement_order`;
- la ausencia declarada como dato en vez de convención de payload;
- servicios sin desmontaje: presión, torque, alineación.

El plan original de esta fase tenía **12 tareas** e incluía columna nueva, enum, cambios en la RPC y
en la app móvil. Se redujo a 4 al verificar que el defecto central no necesitaba esquema. Ese
descarte, con su evidencia, es parte del entregable: evita que alguien reabra la fase grande sin
saber por qué se cerró la chica.

---

## 6. Deuda que la fase deja viva

Detalle canónico en `knowledge/ai/10`.

1. **Sin `sync-migration-reviewer`** sobre `20260722090000_tire_services_view_pairing.sql`. Se
   verificó a mano `security_invoker`, grants, duplicados y aislamiento, más un `SELECT` de solo
   lectura contra producción antes de aplicar — pero la revisión formal que pide `CLAUDE.md` no se
   corrió. Pendiente.
2. **Campo ejecutado con reconciliación pendiente**: las 6 ejecuciones reales conservan
   `reconciliation_status='pending'`, como define el flujo actual; la fase futura sigue siendo la
   responsable de reconciliarlas contra instalaciones y ciclos.
3. **La ausencia de reemplazo es una convención de payload** (`without_entry` dentro del ítem), no un
   dato del esquema. Funciona porque `create_tire_movement_order` ignora las claves extra; nada la
   valida.
4. **El origen externo queda indeterminado**, y **no se ha medido en producción** cuántas entradas
   caen en ese caso. Ese número es el disparador de la fase futura.
5. **Las filas heredadas no parean** y conviven con el modelo nuevo. Ninguna serie que cruce ambos
   períodos es comparable.
6. **`sequence ↔ request_items` sigue siendo propiedad del cliente**: la RPC no valida longitud.
7. Sigue viva toda la deuda de la Fase 1 que esta fase no tocó: `reconciliation_status` en `pending`,
   `QA-TEST` en producción, límite de 2.000 sin paginación, navegación duplicada en 8 HTML,
   `casing_exists` con falso negativo por caja y `tire_movement_executions` fuera de
   `supabase_realtime`. Esta última quedó mitigada en cliente el 2026-07-22 con refresco silencioso
   al volver a la pestaña y cada 10 segundos visible.

---

## 7. El límite que la fase no resuelve

Los servicios que **no implican desmontar el neumático** —presión, torque, alineación— siguen sin
modelo, y las inspecciones siguen siendo una cadena separada (`inspections` /
`inspection_measurements`).

La fase **no lo resuelve, pero deja de bloquearlo**: al ser el servicio una posición atendida en vez
de una salida, el concepto admite después un servicio sin par. Bajo ADR-0007 no había forma de
expresarlo sin forzar una salida falsa.

El párrafo de alcance de `servicios.html` lo declara, para que nadie asuma que la pantalla mide todo
el trabajo del taller.

---

## 8. Handoff

`task_12` y `task_13` están ejecutadas. El punto 5 de `task_12` quedó en `OK`: P3 y P4 tienen salida
e ingreso registrados y ninguno de los dos cascos quedó sin salida. La fase queda cerrada; la
reconciliación histórica permanece fuera de alcance según la fase futura documentada.
