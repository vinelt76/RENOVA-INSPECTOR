# Plan — Paridad de Rendimiento con la planilla de RENOVA

**Abierto el 2026-07-26.** Origen: al contrastar el panel contra la planilla real de la unidad 225
aparecieron tres problemas distintos que se venían tratando como uno solo.

---

## 1. Qué se descubrió

1. **Las fórmulas por neumático del sistema no son las de RENOVA.** La planilla mide sobre la
   profundidad **útil** (`RTD instalación − RTD retiro`), no sobre el OTD. Un neumático que llegó al
   umbral de retiro marca **100 %** en la planilla y **75 %** en el panel.
2. **La agregación rápida de la planilla no mide bien evidencia desigual.** Se decidió mantener
   razón de sumas y ponderados en todos los niveles, incluida una unidad.
3. **Hay datos que describen algo físicamente imposible.** El RTD sube entre inspecciones en 28
   casos de 10 unidades. Casi todos coinciden con un cambio de neumático no registrado; al menos uno
   es un valor mal importado.

La evidencia completa, con consultas reproducibles, está en `AUDIT.md`.

## 1.bis Cuánta evidencia hay realmente detrás de esto

Conviene leerlo antes que el resto, porque la fase se abrió a partir de **una captura de un
vehículo** y es fácil darle más peso del que tiene.

| Afirmación | Evidencia | Fuerza |
|---|---|---|
| El desgaste se mide sobre profundidad útil, no sobre la total | Dos filas de la planilla fijan el denominador en 12, no en 16 | **Sólida** |
| El resumen de un vehículo es promedio simple | Cinco celdas del renglón total; ni razón de sumas ni mediana las reproducen | **Sólida** |
| Hay mediciones que describen algo imposible | 28 saltos de RTD en 10 unidades, consulta reproducible | **Sólida** |
| La 225 P3 tiene un valor mal importado | La planilla marca 4, la base 9; las otras 3 posiciones coinciden | **Sólida** |
| La base es el OTD del ciclo | Decisión del dueño; no es distinguible en las 14 filas actuales | **Tomada (D1)** |
| Todo conjunto debe ir ponderado | Decisión de producto: evita que 0,1 mm pese igual que 8 mm | **Tomada (D3)** |

La base OTD (D1) y la agregación uniforme (D3) son decisiones tomadas. El caso discriminante de un
casco montado usado se cubre con pruebas sintéticas porque no existe en las filas actuales.

## 2. Qué NO es este plan

- **No cambia el motor de cálculo de la app de inspección.** `app/src/core/calculations.ts` y
  `reference/calculations.py` no participan: las fórmulas de Rendimiento viven en SQL y en
  `WEB/rendimiento.html`, no en el motor con paridad golden.
- **No implementa el registro de cambios de neumático.** Eso es fase 2 y su arquitectura ya existe
  (`tire_movement_orders`, `baseline_mount_batches`). Acá solo se **detecta y se declara**.
- **No limpia la base.** La recarga de datos limpios es del dueño de negocio. Acá se deja el
  detector que hace visible qué habría que limpiar.

## 3. Orden y bloques

```
A — Paridad de fórmulas por neumático        A1 → A2 → A3
B — Estadística de agregación                (depende de A2)  B1
C — Calidad de datos                         C1 → C2          (independiente de A y B)
D — Cierre                                   D1 → D2          (último)
```

| Tarea | Qué hace | Depende de |
|---|---|---|
| `task_01` | Contrato de fórmulas verificado contra la planilla | — |
| `task_02` | Fórmulas por neumático en `WEB/rendimiento.html` + pruebas | `task_01` |
| `task_03` | Alinear el SQL (`v_tire_performance`) con el mismo contrato | `task_02` |
| `task_04` | Agregación ponderada uniforme | `task_02` |
| `task_05` | Detectar y declarar mediciones inconsistentes | `task_01` |
| `task_06` | Resolver el dato sucio de la 225 P3 | `task_05` |
| `task_07` | Suite, smoke y verificación de extremo a extremo | A, B, C |
| `task_08` | Documentación, ADR y knowledge | `task_07` |

`task_03` y `task_05` tocan Supabase: pasan por `sync-migration-reviewer` antes de aplicarse.

### El centro de gravedad de la fase no es escribir código

El código de las tareas 02–05 está implementado. D6 mantiene Costo/Km con su definición vigente;
D7 resolvió esperar la depuración/recarga limpia sin `UPDATE` puntual; D9 no bloquea.

## 4. Corte por la demo del lunes 2026-07-27

Esta fase **no llega entera** a la demo, y forzarla sería peor que no hacerla.

**Lo que se puede hacer hoy, si se decide:** `task_02` sola. Es la que corrige el 75 % vs 100 % de
un neumático que está para cambio — el error con consecuencia operativa. Es acotada, con pruebas, y
no toca Supabase.

**Lo que NO conviene hoy:** `task_03` y `task_05` son migraciones sobre vistas con dependientes.

**Lo que hay que saber para presentar, se haga o no la fase:**

- Los KPI del arranque son sobre **4 neumáticos de una sola unidad** (chip de mes en curso), no
  sobre la flota.
- Esos 4 son justamente los contaminados por el cambio no registrado de la 225. La flota sin ellos
  rinde 6 996 km/mm, no 18 446.
- Si `task_05` se aplicara tal cual, la vista por defecto quedaría **vacía**: la 225 es la única
  unidad inspeccionada en julio. Eso hay que resolverlo antes de aplicarlo, no durante.

## 5. Decisiones que faltan

Están en `DECISIONES.md` con su bloqueo.

**Para preguntarle a RENOVA:**

| Pregunta | Bloquea |
|---|---|
| ¿`$/Km` sobre km proyectado en toda la planilla, o solo en esta hoja? | `task_02` parcial (D6) |
| ¿Resumen por marca o diseño: promedio de llantas o de vehículos? | nada hoy (D9) |

**Decisiones de producto, internas:**

| Pregunta | Bloquea |
|---|---|
| Esperar la depuración/recarga limpia, sin corrección puntual | `task_06` resuelta (D7) |

## 6. Criterio de cierre de la fase

1. Una fila de Rendimiento reproduce **celda por celda** la fila equivalente de la planilla, y hay
   una prueba que lo fija con los valores reales de la 225.
2. Todo conjunto, incluida una unidad, usa razón de sumas y ponderación declarada.
3. La paridad con la planilla se exige por neumático; su total promedio queda como referencia.
4. Una posición con RTD creciente no produce un número: produce un estado declarado.
5. `npm run verify` en verde y smoke con consola limpia.
