# REVISIÓN FINAL — Sección Servicios

Cierre de fase: **2026-07-21**
Proyecto remoto: `fbxupwwgiebhlciqftpw` (producción, sin rama efímera, por decisión humana)
Autoridad de esta nota: `STATE.md` para el estado por tarea, `PRUEBA_CAMPO.md` para el recorrido
numerado, `DECISIONES.md` para el porqué de cada decisión, ADR-0007 para lo que sobrevive a la fase.

---

## 1. Qué se entregó

| Capa | Entregable |
|---|---|
| Esquema | `supabase/migrations/20260721130000_tire_services_view.sql` — vista `v_tire_services`, `security_invoker=true`, `SELECT` solo a `authenticated`, índice `(company_id, captured_at desc, sequence)` |
| Pruebas SQL | `supabase/tests/tire_services_view.test.sql` — suite S1–S9 transaccional |
| Datos y modelo | `WEB/servicios/data.js`, `servicios-model.js` — 38 columnas explícitas, sin `company_id`, límite 2.000 con aviso `truncated`, 12 facetas, AND/OR compartido |
| Pantalla | `WEB/servicios.html`, `servicios-controller.js`, `servicios.css` — 4 tiles, barra segmentada accesible, 8 estados, URL multivalor con historial |
| Navegación | Enlace `Servicios` tras Inventario en las 8 variantes de HTML; bundle estático regenerado |
| Documentación | ADR-0007, `DESIGN.md` §8 (2 viñetas), `knowledge/ai/{05,07,09,10,12}`, esta nota |

La unidad de conteo del negocio quedó fijada: **un servicio es una salida**. Una rotación produce
una fila, no dos. Es lo que hereda cualquier reporte o facturación futura, y por eso tiene ADR.

---

## 2. Evidencia LOCAL (automática, reproducible)

No toca datos persistentes: fixtures transaccionales SQL o datos controlados en el navegador.

| Verificación | Resultado |
|---|---|
| `WEB/servicios` (suite nueva) | **34/34** |
| `WEB/shared` | **50/50** — sin modificar |
| `WEB/movimientos` | **176/176** — sin modificar |
| `WEB/buscador` | **19/19** — sin modificar |
| `WEB/inventario` | **15/15** — sin modificar |
| `WEB/neumaticos` | **3/3** — sin modificar |
| SQL `tire_services_view.test.sql` | **S1–S9 aprobados**, centinela `P0001 TESTS_PASSED`, fixtures revertidos |
| Propiedad del tope de pareo | 4.851 combinaciones locales |
| HTTP anónimo | clave pública sin sesión → **401**, PostgreSQL `42501 permission denied for view v_tire_services` |
| Bundle | contiene `servicios.html` + los 4 JS/CSS; **no** contiene `package.json`, `vitest.config.js` ni `__tests__/` |
| Bundle servido por HTTP | recursos propios 200/304, **0** 404 propios, **0** errores de consola, **0** excepciones |
| Accesibilidad | leyenda `--label-blue` sobre `--field-dark` = **6,83:1**; `--value-ice` = **15,67:1** |
| Responsive | 390×844 y 1280 px sin overflow horizontal |
| `prefers-reduced-motion` | duración del segmento = **0 s** |
| Integridad | `node --check` y `git diff --check` limpios |

Que ninguna suite existente necesitara modificación es el dato relevante: la fase agregó una
superficie sin cambiar el comportamiento de las otras seis.

---

## 3. Evidencia de CAMPO (datos reales, producción)

Recorrido real con una orden QA emitida y cerrada **mediante las interfaces y RPC normales**. Sin
inserciones directas, sin `service_role`.

```text
Responsable: Codex, con autorización humana explícita
Fecha y hora (America/Lima): 2026-07-21 00:46:25
Empresa: MÓVIL BUS · Unidad: QA-CN16 · Operario: Móvil Bus 01
order_id: 71f7aaba-01f0-4a78-9270-e33dd03a6f26
```

| # | Verificación de campo | Resultado |
|---:|---|---|
| 1 | Orden real con rotación P3→P7 emitida por UI normal | **APROBADO** — tile previo = 0 (UI `—`) |
| 2 | Operario real toma y cierra la orden | **APROBADO** — estado remoto `completed`, 2/2 ejecuciones, odómetro 2.500.002 |
| 3 | `servicios.html` con la empresa de la orden | **APROBADO** — la fila aparece, `aria-busy=false` |
| 4 | **Criterio central:** una fila, no dos | **APROBADO** — tile **0→1**, lista = **1** fila, tipo `rotation`, P3→P7, `rotation_pairing='exact'`, barra 1 · 100,0 % |
| 16 | Aislamiento entre empresas | **APROBADO PARCIAL POSITIVO** — MÓVIL BUS ve **1** fila propia; sesión CIVA ve **0** y no ve la fila de MÓVIL BUS |
| 17 | Actualización sin recargar | **RECHAZADO** — ver §5 |

Verificación remota de solo lectura previa: antes del recorrido había **0 ejecuciones** y **0 filas**
en la vista; después, **2 ejecuciones** y **1 fila**. `EXPLAIN ANALYZE` autenticado usa
`tire_movement_executions_company_captured_idx`, 1,080 ms, 0 lecturas de disco. Advisors antes/después
sin avisos nuevos.

El criterio central de la fase —una rotación real es un solo servicio— está verificado con datos
reales, no con fixtures. Es lo que hacía falta demostrar.

---

## 4. Puntos N/A de campo y su motivo

Producción tenía **0 ejecuciones** antes del recorrido, y el recorrido creó exactamente una orden.
Los puntos que exigen otros tipos de movimiento real no pudieron ejercitarse sin ensuciar la flota:

| # | Punto | Motivo del N/A | Cobertura sustituta |
|---:|---|---|---|
| 5 | `entry` suelto → fila `INSTALACIÓN` | No había ejecución real de ese tipo | SQL **S3** + modelo puro |
| 6 | Salida `discard` → un solo naranja persistente | Sin ejecución real | DOM controlado: 1 tipo `alert`; suite confirma exactamente uno |
| 7 | Orden mixta (scrap + reencauche + rotación) | Sin orden real | SQL **S4** aprobó el conteo mixto |
| 12 | Código no registrado sin enlace | 0 filas reales con esa condición | Local: presente, sin `href` |
| 14 | Empresa sin servicios, con sesión humana | Verificado en remoto de solo lectura (0 filas), falta evidencia visual con sesión | Simulación DOM: cuatro `—`, 0 segmentos |

Ninguno de estos es un criterio de `PLAN.md` §10 que quede sin cubrir: los cinco tienen cobertura
SQL o de modelo, y lo que falta es la firma visual, no la corrección. **Se registran como pendientes
de campo, no como hechos.** Se cubrirán solos cuando la operación real genere esos movimientos.

El tag `ATRIBUCIÓN INFERIDA` no pudo aparecer con dato real porque el 100 % de los datos actuales es
`exact`/`not_applicable` — que es el resultado deseado. Su render se cubrió con fixture controlado.

---

## 5. El bloqueo de Realtime, y por qué la fase cierra igual

**Hallazgo (punto 17, campo real):** `tire_movement_executions` **no pertenece a la publicación
`supabase_realtime`**. Cinco pestañas autenticadas conservaron 0 filas tras el cierre de la orden,
mientras una consulta directa desde esas mismas sesiones ya devolvía 1. `pg_publication_tables`
confirma que la publicación solo incluye `inspections` e `inspection_measurements`. La recarga
manual sí muestra la fila.

**Consecuencia real:** Servicios refleja los cambios **al recargar**, no automáticamente.

**Por qué no se corrigió dentro de la fase:** corregirlo exige una segunda migración, que la regla 7
de `STATE.md` prohíbe — ampliar el esquema dentro de una fase funcional mezcla dos riesgos y
complica el rollback de ambos.

**Por qué la fase cierra igual:** el refresco automático **no está en `PLAN.md` §10**. Ninguna de sus
dieciséis viñetas lo menciona; el punto 17 era una verificación adicional, no un criterio de
terminado. Todo `PLAN.md` §10 está cubierto.

**Decisión humana (2026-07-21):** aprobar `task_08` con la deuda registrada, en vez de aplicar la
migración de excepción. Queda en `knowledge/ai/10` con su remedio nombrado.

Se registra así, y no como «Realtime pendiente», porque la diferencia importa para quien use la
pantalla: **lo que ve puede estar desactualizado hasta que recargue.**

---

## 6. Deuda que la fase deja viva

Sin maquillar. Detalle canónico en `knowledge/ai/10 - Roadmap deuda y riesgos.md`.

1. **`sequence ↔ request_items` es propiedad del cliente, no invariante del esquema.**
   `complete_tire_movement_order` no valida longitudes. Mitigación propuesta: `request_item_index`
   escrito por la RPC — convierte el pareo en dato y elimina el nivel 2 inferido.
2. **`reconciliation_status` sigue `pending` al 100 %:** no hay reconciliador. Servicios mide
   actividad declarada, no consumo ni vida útil.
3. **`QA-TEST` en producción** (D8): no se filtra por diseño. Cualquier patrón inventado puede
   ocultar datos reales; lo correcto es borrarlos o marcarlos con una columna.
4. **Límite 2.000 sin paginación** (D10), con banner visible. Con ~500 unidades el banner empezará a
   aparecer: ese es el momento de implementar paginación por cursor o ventana temporal.
5. **Navegación duplicada en 8 HTML** (D12): la fase insertó el enlace en los 8 y no unificó el
   shell. Extraerlo es una fase propia.
6. **`casing_exists` con posible falso negativo por caja:** no aplica `upper()`, así que un código
   con grafía distinta puede mostrarse como `SIN HISTORIAL` teniendo historia.
7. **`tire_movement_executions` fuera de `supabase_realtime`** (§5).

Deuda preexistente que la fase **no** empeoró ni resolvió: grant amplio de
`v_rendimiento_dashboard_rows` a `anon`, esquema de Rendimiento fuera de la cadena local, variantes
de caja en `brand_name`.

---

## 7. Fuera de alcance, por decisión explícita

- **Servicios como objeto navegable** (D5): lo prohíbe ADR-0005 §1. Derogarlo exige un ADR nuevo,
  no la conveniencia de una pantalla.
- **Cualquier escritura desde la pantalla** (D9): no se cancela, no se reabre, no se corrige, no se
  reconcilia. Una operación de corrección sería una fase propia con su RPC y su auditoría.
- **`installation` en el enum de la base** (D2): la constraint lo prohíbe por diseño.
- **Pareo por texto de `observations`** (D3): prohibido, no pendiente.
- **Unificación del shell de navegación** (D12) y **paginación** (D10): diseñadas, no implementadas.

---

## 8. Handoff — lo que queda abierto con nombre

1. `request_item_index` en `tire_movement_executions`, escrito por `complete_tire_movement_order`.
2. Reconciliación de ejecuciones contra `tire_casings` / `tire_life_cycles` / `tire_installations`.
   Desbloquea métricas de consumo y vida útil por servicio.
3. Publicación de `tire_movement_executions` en `supabase_realtime`, o fallback explícito de refresco.
4. Paginación por cursor o ventana temporal, cuando el banner de truncado empiece a aparecer.
5. KPIs operativos: `issued → started → completed`, carga por operario, tasa de completado.
6. Limpieza o marcado de los datos `QA-TEST`.
7. Extracción del shell de navegación compartido.
8. Firma visual de los cinco puntos N/A de §4, cuando la operación real genere esos movimientos.
