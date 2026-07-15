# DECISIONES — Puesta en marcha de Movimientos

Fecha: 2026-07-14. Solo se listan decisiones que **no se pueden deducir** del código, el esquema,
las specs o los ADRs vigentes. Las preferencias menores están resueltas dentro del `PLAN.md` y no
bloquean nada.

| # | Decisión | Estado | Elección | Aprueba | Bloquea |
|---|---|---|---|---|---|
| D0 | Cuándo nace la línea base | **RESUELTA (2026-07-14)** | **Perezosa: solo al operar**. Sin backfill masivo. | Humano/Producto | todo el plan |
| D1 | Etiqueta y visibilidad de la línea base | **RESUELTA (2026-07-14)** | Etiquetar "LÍNEA BASE", no bloquear | Producto | task_03, task_07 |
| D2 | Alcance del gate de bloqueo | **RESUELTA (2026-07-14)** | Por **posición**, solo sobre `mount` con evidencia contradictoria | Producto/Operaciones | task_04, task_08 |
| D3 | Vigencia del alias `?mode=cambios` | PENDIENTE | Permanente en lectura | Tech lead | task_02 |

---

### D0 — ¿Cuándo se crean las instalaciones de la línea base? — **RESUELTA (humano, 2026-07-14)**

> **Elección**: **perezosa**. No se corre ningún backfill masivo. Cuando alguien va a operar una
> posición sin línea base, la UI ofrece el primer montaje con los datos de la inspección
> precargados y la línea base nace ahí, confirmada por una persona.

- **Conflicto declarado**: `PROMPT_ORQUESTADOR.md:45-47` fijaba como decisión de negocio ya tomada
  "backfill automático + flujo guiado", y explícitamente "no se acepta … depender únicamente de alta
  manual por taller". El humano **revisó ese alcance** el 2026-07-14. Se registra acá en vez de
  resolverlo en silencio (`knowledge/ai/00 - LEER PRIMERO.md:44`).
- **Alternativas evaluadas**:
  - (a) **Perezosa** (elegida): cero escritura masiva en producción; cada línea base la confirma
    quien tiene el neumático delante; se reutilizan las RPCs ya implementadas.
  - (b) Masiva: 1 660 instalaciones inferidas de una; flota visible el día 1; ~449 posiciones a la
    cola guiada; exige RPC de backfill, cola de excepciones, dry-run, rollback probado y una ventana
    de producción.
  - (c) Masiva a pedido, unidad por unidad.
- **Lo que se gana**: desaparecen de este plan el RPC `backfill_unit_baseline`, la tabla
  `unit_baseline_exceptions`, `v_baseline_candidates`, `rollback_unit_baseline`, el dry-run global y
  las dos tareas de escritura en producción. El plan pasa de 13 tareas a 10 y de "escribir 1 660
  filas de negocio" a "solo DDL aditivo". **Y la calidad del dato es mejor**: nadie infiere nada; la
  identidad la confirma una persona.
- **Lo que se pierde, dicho claro**: la flota **no** se ve completa el día 1. Las 262 unidades
  siguen mostrando posiciones sin línea base hasta que taller pase por cada una. Para el jefe de
  flota, el tablero consolidado llega de a poco, o no llega. Riesgo registrado como `AUDIT.md` B12 y
  **aceptado**.
- **Puerta abierta**: si el ritmo no alcanza, el backfill masivo se puede sumar después **sobre
  exactamente los mismos contratos** (`fn_create_casing_cycle_installation`, `record_origin`,
  `source_measurement_id`). Nada de este plan lo impide; solo se posterga.
- **Impacto**: define todo el plan. **Bloquea**: nada (ya resuelta).

### D1 — ¿Cómo se muestra una posición cuya línea base nació de una inspección? — **RESUELTA (humano, 2026-07-14)**

> **Elección**: mostrar la etiqueta neutra **«LÍNEA BASE»**, sin bloquear operaciones y con la
> inspección fuente visible al abrir el detalle.

- **Evidencia**: tras `PLAN.md §3.1` habrá `origin='baseline'` + `source_measurement_id`. El
  requisito duro es "no presentar inferencias como datos físicos observados". Con línea base
  perezosa, la **identidad sí la confirmó una persona**; lo que sigue sin estar observado es la
  **fecha de montaje** (solo sabemos que el neumático estaba ahí el día de la inspección fuente).
- **Alternativas**:
  - (a) **Etiqueta neutra "LÍNEA BASE"** en la posición, sin bloquear nada, con la fecha de
    inspección fuente visible al abrir el detalle.
  - (b) Sin etiqueta: una vez confirmada, es una instalación como cualquiera.
  - (c) Etiqueta + bloqueo de cálculos de rendimiento hasta que se cargue un odómetro real.
- **Recomendación**: **(a)**. (b) pierde el rastro de que la fecha de montaje es declarada, no
  observada — y ese rastro es barato de mantener y valioso para auditar km. (c) es sobreingeniería:
  el km ya queda NULL solo si falta el odómetro (`20260706120000:60-61`, `:242`), sin necesidad de
  un bloqueo nuevo. Precedente directo: `code_mismatch` se resolvió igual — etiqueta neutra que no
  bloquea (`tasks_cambios_neumaticos_ui/DECISIONES.md:136-141`).
- **Impacto**: `task_03` (comentario del enum y semántica de `origin`), `task_07` (proyección).
- **Bloquea**: `task_03`, `task_07`.

### D2 — ¿Qué bloquea exactamente el gate de línea base? — **RESUELTA (humano, 2026-07-14)**

> **Elección**: rechazar únicamente `mount` cuando la posición tiene evidencia de inspección y no
> tiene instalación activa. El error será `[linea_base_pendiente]`; una posición vacía sin evidencia
> conserva el montaje normal.

- **Evidencia**: `AUDIT.md §6` — el riesgo real es montar inventario sobre una posición físicamente
  ocupada por un neumático nunca registrado. Las ops de retiro/rotación/retén ya exigen instalación
  activa en el origen (`20260714120000:390-399`), o sea, ya tienen línea base. El único hueco es
  `mount`. Hoy afecta a **2 092 posiciones** (`AUDIT.md §4.4`, medido por `task_01`).
- **Alternativas**:
  - (a) **Rechazar `mount` solo donde hay evidencia contradictoria**: la última inspección **midió**
    esa posición y no hay instalación activa → `[linea_base_pendiente]`, con el primer montaje como
    salida explícita.
  - (b) Rechazar todo `mount` sobre cualquier posición vacía de una unidad que no tenga la línea
    base completa.
  - (c) Sin gate en la base: solo aviso en la UI.
- **Recomendación**: **(a)**. (b) inmoviliza las 17 posiciones legítimamente vacías (un bus al que
  realmente le falta un neumático) y castiga a la unidad entera por una posición. (c) deja el
  agujero abierto: la UI se puede saltear, la RPC no.
- **Actualización de `task_01` (2026-07-14)**: el contrapunto que tenía esta decisión **se cerró**.
  Decía que (a) no podía cubrir las 309 posiciones con neumático pero sin código legible. El
  diagnóstico mostró que **sí puede**: toda medición tiene RTD, marca, medida y condición
  (`AUDIT.md §4.3`), así que la existencia de la medición —no la del código— es la prueba de que
  había un neumático. Con el predicado por medición, (a) cubre las 2 092. **(a) ya no tiene punto
  débil conocido frente a (b).**
- **Impacto**: `task_04` (el `create or replace` de `confirm_tire_change_batch`), `task_08` (UI).
- **Bloquea**: `task_04`, `task_08`.

### D3 — Vigencia del alias `?mode=cambios`

- **Evidencia**: `?mode=cambios` está en la guía humana
  (`knowledge/human/GUIA RENOVA/08 - Estado actual y futuro.md:25`) y en `PRUEBA_CAMPO.md:21`; puede
  haber enlaces guardados que no vemos. El alias cuesta 3 líneas (`mode-toggle.js:6-11`) y la
  canonicalización ya existe (`:13-23`).
- **Alternativas**: (a) **permanente en lectura**, canonicalizando a `?mode=movimientos`;
  (b) temporal con fecha de baja; (c) sin alias.
- **Recomendación**: **(a)**. (c) rompe enlaces en silencio; (b) agenda una tarea futura para
  ahorrar 3 líneas. Si el humano elige (b), `task_02` registra la fecha en el README del módulo y
  crea la tarea de baja.
- **Bloquea**: `task_02` (solo el párrafo de vigencia; el resto del renombre avanza igual).

---

## Resumen para el humano

Quedan **3 respuestas**, ninguna bloqueante para empezar:

- **D1** y **D2** tienen recomendación fuerte y precedente en el propio proyecto. D2 tiene un
  contrapunto real que conviene leer: la variante recomendada no cubre las 309 posiciones sin código.
- **D3** es de bajo impacto.

`task_01`, `task_02` y el diseño de `task_03` pueden arrancar ya.
