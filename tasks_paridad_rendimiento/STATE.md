# Estado de la fase

Actualizar al terminar cada tarea. Una tarea sin criterio de cierre marcado no está hecha, aunque el
código esté escrito.

---

## Tablero

| Tarea | Estado | Bloqueo |
|---|---|---|
| `task_01` Contrato de fórmulas | **Hecha**, con D6 y D9 abiertas | — |
| `task_02` Fórmulas por neumático | **Hecha, salvo Costo/Km** | D6 |
| `task_03` Paridad SQL | **Hecha** | — |
| `task_04` Agregación ponderada uniforme | **Hecha** | — |
| `task_05` Detección de inconsistencias | **Hecha** | D8 resuelta |
| `task_06` Dato sucio 225 P3 | **Hecha: esperar recarga limpia** | — |
| `task_07` Suite y smoke | **Hecha en alcance automatizable** | comparación productiva espera recarga |
| `task_08` Documentación y ADR | **Hecha** | `TRASPASO.md` no existe |

## Estado del árbol al abrir la fase — 2026-07-26

Nada de esto está commiteado. `git status --short` lo lista.

Lo que **sí** está aplicado y verificado, de la sesión anterior y de hoy:

- Las 5 migraciones del 2026-07-25 (voseo, umbrales de presión, `temperature_mode`, revocación de
  DML en vistas, `units.is_test`).
- `Km Proyectado` agregado como **ponderado por mm gastados** en `computeGroup`, con pruebas y
  documentación. Esta fase lo mantiene para grupos y le agrega el modo por unidad (`task_04`).
- `scripts/verify-all.mjs` con piso por suite. **398 pruebas en verde.**

Lo que se **revirtió** deliberadamente el 2026-07-26, para rehacerlo con este plan en vez de al
paso: fórmulas por neumático sobre profundidad útil y separación unidad/grupo. Se había implementado
sin plan, con dos pruebas rojas y sin decidir D6, D7 ni D8. El árbol volvió a 398 pruebas verdes
antes de escribir estas tareas.

## Números de referencia — 2026-07-26

Para saber si algo se movió sin querer.

### Panel, alcance por defecto (chip julio 2026 → 4 neumáticos de la 225)

| KPI | Valor |
|---|---|
| Km/mm | 18 446 |
| Km Proyectado | 221 348 |
| Consumo | 26,6 % |
| Km Acumulado | 78 394 |
| VUR | 156 788 |
| Costo/km | S/ 0,0012 |

### Panel, sin chip (14 neumáticos)

| KPI | Valor |
|---|---|
| Km/mm | 8 703 |
| Km Proyectado | 99 503 |
| VUR | 20 706 · 3 bajo 10 000 |

### Flota sin la 225 (10 filas consistentes)

| KPI | Valor |
|---|---|
| Km/mm | 6 996 |
| Km Proyectado | 78 149 |

### Efecto esperado de la fase

| Métrica | Antes | Después |
|---|---|---|
| Consumo (4 neumáticos) | 26,6 % | **35,4 %** |
| Costo/km (4 neumáticos) | 0,0012 | **0,0005** (si D6 va a favor) |
| Km/mm y Km Proyectado | — | **sin cambio** (`rtd_at_install == otd` en 14/14) |
| Resumen de unidad | ponderado | **ponderado (decisión confirmada)** |

## Composición de la flota — importa para saber qué se puede verificar

| Dato | Valor | Consecuencia |
|---|---|---|
| Llantas con `condition = R1` | **14 de 14** | Todo el parque es reencauche; no hay caso «nuevo» con el cual contrastar |
| Llantas con `rtd_at_install == otd` | **14 de 14** | **D1 es indistinguible con estos datos** |
| Diseños distintos | **1** (IZE2W) | Agrupar por diseño devuelve la flota entera: la mitad «por grupo» de D3 no se puede contrastar |
| `model_name` | null en todas | La faceta de modelo no tiene con qué trabajar |
| OTD distintos | solo la 5021 P5 (10 mm vs 16) | Único caso que rompe el span constante |

La flota **no tiene variedad suficiente** para validar contra la realidad las decisiones sobre
agrupación ni sobre la base de la proyección. Es la razón por la que buena parte de la fase espera
respuestas en vez de análisis.

## Bitácora

### 2026-07-26

- Contrastada la planilla real de la 225 contra el panel. Tres problemas distintos, tratados hasta
  entonces como uno solo. Evidencia en `AUDIT.md`.
- Corregidas cuatro conclusiones propias equivocadas, anotadas en `AUDIT.md` §6 para que no se
  repitan.
- Fase abierta. `task_01` cerrada con dos pendientes que no bloquean.
- D3 reemplazada por decisión del dueño: ponderado para cualquier conjunto, incluida una unidad.
- D1 resuelta por el dueño: OTD es propiedad del ciclo y es la base incluso tras una rotación o
  traslado. Las dos pruebas discriminantes quedaron activas.
- Migraciones remotas aplicadas: fórmula de desgaste sobre profundidad útil con base OTD (D1) y
  evidencia de inspección anterior. `security_invoker` y grants verificados.
- D8 resuelta con estado vacío explícito; 18 instalaciones activas marcadas por RTD creciente.
- D7 resuelta: no corregir manualmente la 225 P3; esperar la depuración/recarga limpia en curso.
- Cierre automatizado: 411 pruebas, lint, docs y dos builds en verde. Smoke escritorio/móvil con
  datos simulados, recarga estable, sin overflow ni errores de consola.
