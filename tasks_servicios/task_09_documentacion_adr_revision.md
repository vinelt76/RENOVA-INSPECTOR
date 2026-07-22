# task_09 — Documentación, ADR y revisión cruzada

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

La fase queda registrada donde alguien la va a buscar dentro de seis meses: un ADR con la definición
de servicio, `knowledge/` actualizado, `DESIGN.md` con el patrón que se venía usando sin documentar, y
`REVISION_FINAL.md` con la deuda a la vista.

## 3. Dependencias y bloqueos

Depende de `task_08`. Cierra la fase.

## 4. Archivos exclusivos

- `decisions/0007-definicion-de-servicio-ejecutado.md`
- `tasks_servicios/REVISION_FINAL.md`
- `DESIGN.md` (una viñeta en §8)
- `knowledge/ai/05 - Datos y Supabase.md`
- `knowledge/ai/07 - Web dashboards y taller.md`
- `knowledge/ai/09 - Diseno y UX.md`
- `knowledge/ai/10 - Roadmap deuda y riesgos.md`
- `knowledge/ai/12 - Decisiones e historia.md`
- Columna Revisión de `STATE.md`

## 5. Contratos

`knowledge/ai/14 - Mantenimiento documental.md` para el formato y el alcance de cada nota.

## 6. Pasos

1. **ADR-0007** — `decisions/0007-definicion-de-servicio-ejecutado.md`. Contenido mínimo:
   - la definición de servicio (D1) y por qué no se cuenta por orden;
   - `installation` como tipo derivado y por qué no puede ir al enum (D2);
   - el pareo estructural y por qué se descartó el textual (D3);
   - los dos niveles y `rotation_pairing` como contrato de honestidad (D4);
   - por qué Servicios **no** es objeto navegable, y su relación con ADR-0005 (D5);
   - la limitación aceptada: los servicios no están reconciliados contra cascos.

   **Por qué merece ADR:** «una rotación = un servicio» es exactamente el tipo de definición que se
   re-litiga a los seis meses, y que cualquier reporte, tablero o facturación futura va a heredar. Si
   no está escrita con su porqué, la próxima persona la cambiará sin saber qué rompe.

2. **`DESIGN.md` §8** — añadir una viñeta que distinga **input de captura** de **input de filtro**
   (D13). §8 dice «cero inputs, cero foco naranja», pero Inspecciones, Rendimiento y Neumáticos **ya**
   montan un combobox de filtro con foco naranja. La regla real es que el dashboard no captura datos;
   un control de lectura que solo acota lo mostrado no la viola, y el foco es exclusivo por definición.
   Servicios solo hereda el patrón: se documenta ahora para que la próxima pantalla no lo vuelva a
   litigar.

   Añadir también, en la misma sección, la regla de que una distribución con más categorías que
   colores semánticos usa **rampa monocroma + los semánticos solo donde hay carga real** (D14), y que
   el color nunca es el único canal.

3. **`knowledge/ai/05`** — `v_tire_services` como vista de lectura desde tablas base, la definición de
   servicio, el pareo por `sequence`, y **la convención de zona horaria** decidida en D11 (que es del
   proyecto, no solo de esta vista).

4. **`knowledge/ai/07`** — Servicios como superficie nueva: qué mide, qué no mide, a qué enruta, y su
   relación con el modo movimientos (uno ejecuta, el otro consulta).

5. **`knowledge/ai/09`** — el patrón de barra segmentada con más de tres categorías, y la distinción
   input de captura / input de filtro.

6. **`knowledge/ai/10`** — deuda que la fase deja viva, sin maquillar:
   - la alineación `sequence ↔ request_items` es propiedad del cliente, no invariante del esquema;
     mitigación propuesta: `request_item_index` escrito por la RPC;
   - `reconciliation_status` sigue `pending` al 100 %: no hay reconciliador;
   - `QA-TEST` en producción (D8);
   - límite 2000 sin paginación (D10);
   - navegación duplicada en 8 HTML (D12);
   - `casing_exists` con posible falso negativo por caja.

7. **`knowledge/ai/12`** — indexar ADR-0007.

8. **`REVISION_FINAL.md`** — revisión cruzada de la fase: qué se entregó, qué evidencia lo respalda
   (local vs. campo, **separadas**), qué quedó fuera de alcance y qué deuda se abrió. Registrar los
   puntos N/A de `task_08` con su motivo.

9. `npm run docs:check`.

## 7. Invariantes

- **No duplicar especificaciones extensas en `knowledge/`**: la nota resume y enruta al contrato y al
  ADR, no los reescribe (`CLAUDE.md`).
- La deuda se registra **sin maquillar**. Una fase que se cierra ocultando lo que dejó abierto obliga
  a redescubrirlo.
- Evidencia local y evidencia de campo van separadas en `REVISION_FINAL.md`.
- No marcar la fase terminada si D11 no quedó documentada como convención del proyecto.
- No tocar `WEB/`, `supabase/` ni `scripts/`.

## 8. Casos de error

- Si `npm run docs:check` falla, corregir la nota, no el check.
- Si al escribir el ADR aparece una contradicción con ADR-0005, **detener**: significa que D5 se
  interpretó mal en alguna tarea, y hay que revisarla antes de documentar algo incorrecto como
  decisión vigente.
- Si un punto de `task_08` quedó N/A y afecta la definición de terminado de `PLAN.md` §10, la fase no
  cierra: se registra como pendiente, no como hecho.

## 9. Aceptación

- `decisions/0007-definicion-de-servicio-ejecutado.md` existe y cubre los seis puntos de §6.1.
- `DESIGN.md` §8 tiene las dos viñetas nuevas.
- Las cinco notas de `knowledge/ai/` actualizadas.
- `REVISION_FINAL.md` separa evidencia local de campo y lista las seis deudas de §6.6.
- `npm run docs:check` verde.
- `STATE.md` con las 9 filas en `APROBADO` y la columna Revisión completa.
- `git diff --check` limpio.

## 10. Rollback

`git checkout` de los archivos de documentación. No afecta código ni esquema.

## 11. Handoff

La fase cierra. Lo que queda abierto y **con nombre** para una fase futura:

1. `request_item_index` en `tire_movement_executions`, escrito por `complete_tire_movement_order`.
   Convierte el pareo de inferencia en dato y elimina el nivel 2 (D3, D4).
2. Reconciliación de ejecuciones contra `tire_casings` / `tire_life_cycles` / `tire_installations`.
   Desbloquea métricas de consumo y vida útil por servicio (D7).
3. Paginación por cursor o ventana temporal, cuando el banner de truncado empiece a aparecer (D10).
4. KPIs operativos: `issued → started → completed`, carga por operario, tasa de completado.
5. Limpieza o marcado de los datos `QA-TEST` (D8).
6. Extracción del shell de navegación compartido (D12).
