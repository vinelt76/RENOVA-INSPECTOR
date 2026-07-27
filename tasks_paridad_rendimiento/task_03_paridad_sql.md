# task_03 — Alinear el SQL con el mismo contrato

## 1. Objetivo y resultado observable

Que `v_tire_performance` calcule lo mismo que `computeTire()`. Hoy hay **dos implementaciones de las
mismas fórmulas** —`supabase/views_demo.sql:149-172` y `WEB/rendimiento.html`— y `task_02` las separa
todavía más.

Resultado observable: para cualquier fila, `consumption_pct`, `km_projected` y `cost_per_km` de la
vista coinciden con lo que el panel muestra en el detalle de esa posición.

## 2. Por qué importa aunque el panel no las use

El panel recalcula todo en JS y solo muestra las columnas del SQL en el panel de «datos fuente». Pero:

- El panel de datos fuente **queda mintiendo** si las dos difieren, y es justamente donde alguien va
  a mirar para verificar.
- Cualquier reporte, export o vista futura que agregue `km_projected` por su cuenta va a dar otro
  número.
- `v_life_cycle_performance` arrastra las mismas fórmulas y nadie la revisó en esta fase.

## 3. Dependencias y bloqueos

Depende de `task_02` (el contrato tiene que estar implementado y probado de un lado antes de
replicarlo del otro).

**Alcance aplicado:** se alineó el desgaste sobre profundidad útil usando OTD como base de ciclo,
según D1. La migración inicial que asumía RTD de instalación fue supersedida explícitamente por
`20260726190723_defer_projection_basis_pending_d1.sql`; la migración
`20260726213000_rendimiento_current_cycle_metrics.sql` completó la tasa por ciclo. No se borró
historial.

## 4. Archivos exclusivos

- `supabase/migrations/` — una migración nueva
- `supabase/views_demo.sql` — actualizar la referencia local

Solo lectura: `CONTRATOS_DATOS.md`, `WEB/rendimiento.html`.

## 5. Qué cambia

En `v_tire_performance`, según `CONTRATOS_DATOS.md` §2:

```sql
-- % de consumo: sobre la profundidad útil, no sobre la profundidad total
case when (lc.otd_mm - rt.rtd_removal_mm) > 0
          and k.last_inspection_rtd_mm is not null
     then (lc.otd_mm - k.last_inspection_rtd_mm)
          / (lc.otd_mm - rt.rtd_removal_mm) * 100 end  as consumption_pct,

-- Km proyectado: base OTD del ciclo (D1)
     cycle_km / (lc.otd_mm - current_rtd_mm)
       * (lc.otd_mm - rt.rtd_removal_mm)                          as km_projected,
```

`cost_per_km` solo si `DECISIONES.md` D6 se resuelve a favor.

## 6. Cuidados de migración

- `v_tire_performance` **no tiene una migración local fiel**: existe en producción y
  `supabase/views_demo.sql` es una referencia desactualizada (ya anotado como deuda en
  `knowledge/ai/10`). **Leer la definición vigente con `pg_get_viewdef` antes de escribir nada**, no
  asumir que el archivo local es lo que corre.
- `v_rendimiento_dashboard_rows` depende de ella. Verificar el orden y que `security_invoker` se
  conserve.
- `consumption_pct` cambia de valor para **todas** las filas históricas. No es un dato almacenado
  —se recalcula en cada consulta— pero cualquier captura o reporte previo deja de coincidir. Que
  quede escrito en la migración.
- Idempotencia y compatibilidad legacy: la vista se reemplaza, no se dropea.

## 7. Criterio de cierre

- [x] Revisión manual equivalente: forma y tipos preservados, dependientes relevados,
      `security_invoker` y grants verificados.
- [x] Aplicada: 38 filas, 0 divergencias de consumo/proyección con el alcance vigente.
- [x] Tasa por ciclo: 19 filas calculables, 17 ya carecían de km en el tramo vigente y ninguna fila
      previamente calculable quedó invalidada por un tramo histórico incompleto.
- [x] `supabase/views_demo.sql` actualizado.
- [x] Verificado: 3 neumáticos en el umbral devuelven `consumption_pct = 100`.

## 8. Trampas

- **El MCP de Supabase con varios statements** devuelve solo el resultado del último. Una consulta
  por llamada.
- La tasa a nivel ciclo ya es parte del contrato. No volver a `sum()` simple: debe conservar
  `bool_and(km_run is not null)` para no publicar ciclos parciales.
