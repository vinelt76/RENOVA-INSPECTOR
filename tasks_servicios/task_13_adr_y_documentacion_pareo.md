# task_13 — ADR-0008, barrido de afirmaciones vencidas y cierre

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

La corrección queda registrada con su porqué, y **ninguna afirmación del modelo viejo sobrevive
citada como vigente**. Ese barrido es la mitad del valor de la tarea: la Fase 1 escribió «una
rotación se cuenta una sola vez» en siete lugares.

## 3. Dependencias y bloqueos

Depende de `task_12`. Cierra la fase.

## 4. Archivos exclusivos

- `decisions/0008-servicio-por-posicion-atendida.md`
- `decisions/0007-definicion-de-servicio-ejecutado.md` (**solo** el bloque de superseción)
- `tasks_servicios/REVISION_FINAL_PAREO.md`
- `knowledge/ai/05 - Datos y Supabase.md`
- `knowledge/ai/07 - Web dashboards y taller.md`
- `knowledge/ai/10 - Roadmap deuda y riesgos.md`
- `knowledge/ai/12 - Decisiones e historia.md`
- Columna Revisión de `STATE.md`

## 5. Contratos

`knowledge/ai/14 - Mantenimiento documental.md` para formato y alcance. `CLAUDE.md`: **no duplicar
especificaciones extensas en `knowledge/`** — la nota resume y enruta.

## 6. Pasos

1. **ADR-0008 — «un servicio es una posición atendida».** Corto y con evidencia. Contenido mínimo:
   - **La unidad de conteo**: una posición atendida, con su salida y su entrada. Con la evidencia:
     la planilla ancla en `BUS`+`POS`, y las dos órdenes reales de producción dejaban posiciones
     vacías.
   - **Por qué la asimetría era un defecto**: un scrap con reemplazo contaba 2 y una rotación 1, para
     el mismo hecho físico.
   - **Por qué no hizo falta cambiar el esquema.** Es el punto más valioso del ADR y el que evita que
     alguien reabra una fase de esquema innecesaria dentro de un año: el pareo estructural de la
     Fase 1 ya era correcto; el defecto estaba en lo que el supervisor emitía (`addRotation` con dos
     ítems en vez de cuatro) y en que la vista solo pareaba `rotation`.
   - **El origen es derivado, no capturado.** Si el casco que entra salió en la misma orden, el
     origen es esa posición. El operario solo declara los datos del neumático que sale y su
     observación; pedirle que escriba el origen sería pedirle un dato que el sistema ya tiene.
   - **El límite de esa derivación**: origen externo —retén, reparación, nuevo— requiere el historial
     del casco, y eso es la fase futura. La columna lo declara indeterminado en vez de fingir.
   - **Qué lo revierte.**

2. **Superseción en ADR-0007.** Bloque al inicio, con fecha: **D1 queda superada** (la unidad de
   conteo cambia de «una salida» a «una posición atendida»); **D2 queda matizada** (`installation`
   sigue siendo sintética, pero ya no aparece donde hay par); **D3 a D14 siguen vigentes**, en
   particular D5 (Servicios no es objeto navegable), D6, D8, D9, D10 y D11.

   **No borrar ni reescribir el cuerpo de ADR-0007.** Un ADR superado se lee para entender por qué se
   decidió así entonces, y en este caso la decisión fue correcta dado lo que se capturaba.

3. **Barrido de afirmaciones vencidas.** Dos tratamientos distintos:
   - Documentos **históricos** de la Fase 1 (`AUDIT.md`, `PLAN.md`, `CONTRATOS_DATOS.md`,
     `REVISION_FINAL.md`, `PRUEBA_CAMPO.md`, filas 01–09 de `STATE.md`): **no se reescriben.** Se les
     agrega una nota de cabecera que remita a ADR-0008.
   - Documentos **vigentes** (`knowledge/`, ADR-0007, `servicios.html`): se corrigen o se marcan
     superados. `servicios.html` lo hizo `task_11`; verificar que quedó hecho.

4. **`knowledge/ai/05`** — el pareo general, el origen derivado y su límite, y qué punto de
   `CONTRATOS_DATOS.md` §1 quedó derogado. Mantener la convención `America/Lima` (D11).

5. **`knowledge/ai/07`** — Servicios con la unidad nueva: qué mide, qué **no** mide, a qué enruta.

6. **`knowledge/ai/10`** — deuda, sin maquillar. Declarar cuáles de las siete deudas de la Fase 1
   siguen vivas y cuáles cambiaron:
   - `sequence ↔ request_items` como propiedad del cliente → **sigue viva**; esta fase no agregó
     `request_item_index` ni la validación de longitud en la RPC. Nombrarla como pendiente concreto.
   - `reconciliation_status` `pending` al 100 % → **sigue viva**, y ahora se sabe que es el mismo
     problema que el origen externo.
   - `QA-TEST` en producción (D8) → sigue viva.
   - límite 2.000 sin paginación (D10) → sigue viva.
   - navegación duplicada en 8 HTML (D12) → sigue viva.
   - `casing_exists` con posible falso negativo por caja → sigue viva.
   - `tire_movement_executions` fuera de `supabase_realtime` → sigue viva.

   Más lo que abra esta fase, incluida la ausencia declarada resuelta con una convención de texto en
   vez de un dato (si `task_10` §3 lo resolvió así), que es deuda real.

7. **`knowledge/ai/12`** — indexar ADR-0008 y marcar ADR-0007 parcialmente superado.

8. **`REVISION_FINAL_PAREO.md`** — qué se entregó, evidencia **local y de campo separadas**, los
   `N/A` de `task_12` con motivo, qué quedó fuera por decisión explícita, y la deuda abierta con
   nombre. Enrutar a `FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`.

9. `npm run docs:check`.

## 7. Invariantes

- **No duplicar especificaciones extensas en `knowledge/`**: resumir y enrutar.
- **La deuda se registra sin maquillar.**
- **Evidencia local y de campo separadas.**
- **No se reescribe la historia de la Fase 1.** Se marca superada y se enruta.
- No marcar la fase terminada si los puntos 3, 5 u 8 de `task_12` no quedaron en `OK`.
- No tocar `WEB/`, `app movimientos/`, `supabase/` ni `scripts/`.

## 8. Casos de error

- Si `docs:check` falla, corregir la nota, no el check.
- **Si ADR-0008 contradice ADR-0005 o ADR-0006**, detener: se interpretó mal una decisión en alguna
  tarea. Servicios sigue sin ser objeto navegable y sin una segunda primitiva de filtrado.
- Si al barrer aparece una afirmación vencida en un archivo fuera de alcance, registrarla en
  `REVISION_FINAL_PAREO.md` con su ubicación exacta. No ampliar el alcance en silencio.

## 9. Aceptación

- `decisions/0008-servicio-por-posicion-atendida.md` cubre los seis puntos de §6.1.
- ADR-0007 con su bloque de superseción; su cuerpo intacto.
- Todas las apariciones de la definición vieja, corregidas o marcadas como históricas.
- Las cuatro notas de `knowledge/ai/` actualizadas con `updated`/`sources`.
- `REVISION_FINAL_PAREO.md` separa evidencia local de campo y lista la deuda viva.
- `npm run docs:check` verde.
- `STATE.md` con las 4 filas de la fase en estado final y la columna Revisión completa.
- `git diff --check` limpio.

## 10. Rollback

`git checkout` de los archivos de documentación. No afecta código ni esquema.

## 11. Handoff

La fase cierra. Lo que queda abierto está en
`tasks_servicios/FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`, con la medida concreta que dejó `task_12`:
cuántas entradas quedaron con origen indeterminado. Ese número es el argumento —o la falta de
argumento— para abrir esa fase.
