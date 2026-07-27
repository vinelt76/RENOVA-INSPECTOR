# task_06 — Resolver el dato sucio de la 225 P3

## 1. Objetivo y resultado observable

La planilla marca **4 / 4 / 4 → mín 4** para la 225 P3 el 07/05/26. La base tiene **9 / 9 / 9 → 9**.
Las otras tres posiciones de esa misma inspección coinciden exactamente con la planilla, y el
odómetro también. Es un valor mal importado, y es uno solo.

Resultado observable: o la base coincide con la planilla, o está documentado por qué no.

## 2. Dependencias y bloqueos

Depende de `task_05`: el detector es lo que permite encontrar el resto de las divergencias sin
revisarlas a mano.

**D7 resuelta:** esperar la depuración/recarga limpia. No es una decisión técnica.

**Estado 2026-07-26:** no se ejecutó ningún `UPDATE`. La fase preserva el valor productivo y deja la
divergencia visible hasta que el proceso de depuración publique la recarga limpia.

## 3. Por qué no se decide solo

**A favor de corregirlo:** es demostrablemente incorrecto contra la fuente del negocio, y con 9 mm
en vez de 4 la P3 aparece como si tuviera vida cuando estaba para retiro.

**En contra:** el dueño de negocio planea una recarga de base limpia. Un `UPDATE` manual sobre
producción crea una divergencia que la recarga puede volver a pisar, y deja una fila cuya
procedencia no se puede reconstruir.

**Lo que falta saber antes de elegir:** si la P3 es la única divergencia entre la planilla y la base,
o hay más. Con una, un `UPDATE` documentado es razonable; con veinte, la recarga es el camino.

## 4. Archivos

Depende de la decisión:

- **Corregir:** `supabase/migrations/` — migración idempotente, acotada por `inspection_id` y
  `position_number` exactos, nunca por patrón.
- **Esperar:** `tasks_paridad_rendimiento/DECISIONES.md` y `knowledge/ai/15 - Bitacora diaria.md`.

## 5. Si se corrige

- Acotar por identificadores exactos. Nada de `where rtd_movi_mm = 9`.
- Guardar el valor anterior en el comentario de la migración: quién lo revierta tiene que poder.
- **Actualizar también `rtd_a_mm`, `rtd_b_mm`, `rtd_c_mm`**, no solo `rtd_movi_mm`. El MOVI es el
  mínimo de los canales; corregir solo el derivado deja los canales contradiciéndolo.
- Revisar con `sync-migration-reviewer`: escribe sobre datos de producción.
- Verificar después que la fila de `v_rendimiento_dashboard_rows` de esa posición cambió como se
  esperaba.

## 6. Criterio de cierre

- [x] D7 resuelta y anotada con su motivo.
- [x] No se corrigió: ninguna migración de datos ni `UPDATE`.
- [x] Espera anotada en la bitácora; se destraba con la recarga limpia.
- [x] No se hizo una reconciliación completa planilla ↔ base; la fase detecta 18 instalaciones
      activas con RTD creciente y mantiene visible el universo a depurar.

## 7. Trampa

**Corregir este valor no arregla la 225.** El cambio de neumáticos no registrado sigue ahí: aun con
4 mm en mayo, la fila de julio mezcla el RTD inicial del neumático viejo con el RTD actual del
nuevo. Las dos cosas son ciertas a la vez y se arreglan por caminos distintos — esta tarea es el
dato, `task_05` es la mezcla.
