# task_05 — Detectar y declarar mediciones inconsistentes

## 1. Objetivo y resultado observable

Que una posición cuyo RTD creció entre inspecciones **no produzca un número**. El neumático no crece:
o hubo un cambio no registrado, o hay un error de medición. En los dos casos la fila mezcla el RTD
inicial de un neumático con el RTD actual de otro.

Resultado observable: las cuatro posiciones de la 225 dejan de aportar al KPI y aparecen declaradas
con su motivo, igual que hoy se declara «7 excluidos por ser de unidades de prueba».

## 2. Por qué no alcanza con comparar códigos

27 de los 28 saltos coinciden con un cambio de `tire_code`, pero **la 225 P4 y P5 no tienen código
en ninguna de las dos inspecciones**. Ahí el salto de RTD es la única evidencia. El código sirve para
distinguir el motivo, no para detectar.

## 3. Dependencias y bloqueos

Depende de `task_01`. Bloquea `task_06`.

**D8 resuelta:** se conserva el período y se muestra un estado explícito sin KPI en cero; las filas
siguen visibles con su motivo.

**Migración sobre vista con dependientes: pasa por `sync-migration-reviewer`.**

## 4. Archivos exclusivos

- `supabase/migrations/` — una migración nueva
- `WEB/rendimiento.html` — mapeo, filtro y nota de exclusión
- `WEB/rendimiento/__tests__/`

## 5. Qué implementar

### 5.1 La vista expone la evidencia

`CONTRATOS_DATOS.md` §5. Tres columnas **al final** de `v_rendimiento_dashboard_rows`
(`CREATE OR REPLACE VIEW` solo permite agregar al final):

| Columna | Para qué |
|---|---|
| `prev_inspection_rtd_mm` | Detectar el salto |
| `prev_inspection_on` | Declarar contra qué inspección se comparó |
| `last_inspection_tire_code` | Distinguir «cambio no registrado» de «error de medición» |

La comparación es con la inspección **inmediatamente anterior dentro de la ventana de la
instalación**, no con cualquier inspección histórica de la posición.

### 5.2 El panel excluye y declara

Mismo patrón que `units.is_test`: se filtra antes de agregar y se cuenta aparte para declararlo.

```
«N excluidos por medición inconsistente (el RTD creció respecto de la inspección anterior)»
```

El motivo distingue los dos casos:

| Condición | Motivo mostrado |
|---|---|
| RTD creció y el código cambió | Cambio de neumático sin registrar |
| RTD creció y el código es el mismo | Medición a revisar |
| RTD creció y no hay código | Sin código: no se puede distinguir |

## 6. Reglas que no se pueden tocar

- **Excluir y declarar, nunca esconder.** ADR-D8. Una fila que desaparece sin explicación hace que
  el problema deje de verse sin dejar de existir.
- **No inferir la instalación.** Detectar el cambio no autoriza a crearlo: eso es fase 2
  (`DECISIONES.md` D5). No se escribe en `tire_installations` desde acá.
- El detector es sobre el **RTD**, no sobre el código. El código solo etiqueta el motivo.

## 7. Pruebas obligatorias

| Prueba | Esperado |
|---|---|
| Posición con RTD 9 → 11 | inconsistente, excluida de la agregación |
| Posición con RTD 12 → 11 | consistente |
| Posición sin inspección anterior | consistente (no hay con qué comparar) |
| RTD creció y el código cambió | motivo «cambio sin registrar» |
| RTD creció con el mismo código (caso 620 P2) | motivo «medición a revisar» |
| Conjunto entero inconsistente | lo que decida D8, no un KPI en 0 |

## 8. Criterio de cierre

- [x] D8 resuelta y documentada.
- [x] Migración revisada manualmente y aplicada.
- [x] 18 instalaciones activas marcadas; los 28 saltos históricos siguen siendo el universo de la
      auditoría, pero una vista de instalaciones activas no expone filas históricas cerradas.
- [x] La nota de exclusión y los tres motivos están implementados y probados.
- [x] Smoke móvil con consola limpia, cuatro filas visibles y estado explícito de exclusión total.

## 9. Trampas

- **La ventana de la instalación importa.** Comparar contra toda la historia de la posición mezcla
  neumáticos anteriores y marca inconsistencias donde no las hay.
- **Un salto de 1 mm puede ser precisión de medición**, no un cambio. El corte de `> prev` es el
  más estricto; `> prev + 1` deja pasar 7 de los 35. Decidir el corte con dato, no por defecto.
- Este detector **no arregla** el rendimiento de la 225: lo hace visible. Arreglarlo es fase 2.
