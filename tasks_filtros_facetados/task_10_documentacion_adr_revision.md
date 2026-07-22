# task_10 — Documentación, ADR y revisión cruzada

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

Cerrar la fase: registrar en `decisions/` las decisiones que sobreviven al código, actualizar
`knowledge/` para que la próxima sesión encuentre el estado real, y dejar `REVISION_FINAL.md` con la
evidencia y la deuda **sin ocultarlas**.

Resultado observable: ADR creado, knowledge actualizado, `npm run docs:check` verde, y un documento
de revisión que separa lo entregado de lo pendiente.

## 3. Dependencias y bloqueos

Depende de `task_09`. Cierra la fase.

## 4. Archivos exclusivos

- `REVISION_FINAL.md` (nuevo, esta carpeta)
- `decisions/0006-filtros-facetados-inspecciones-rendimiento.md` (nuevo — confirmar que `0006` está
  libre; el último registrado es `0005`)
- Notas de `knowledge/` enumeradas en §5
- Columna Resultado/Revisión de `STATE.md`

Solo lectura: todo el código.

## 5. Contratos

### ADR

Decisiones que trascienden esta fase y merecen quedar registradas:

- **Filtro y buscador son cosas distintas** (F2). El buscador enruta; el filtro reduce. Comparten
  primitivas, no destino. Es la decisión de arquitectura más importante de la fase y la más fácil de
  perder: sin registrarla, la próxima sesión intentará fusionarlos.
- **Rendimiento cambió de naturaleza** (F3): de detalle jerárquico a agregación sobre conjunto
  filtrado. Con el porqué: las facetas pedidas no significan nada sobre una sola posición.
- **Inspecciones lista neumáticos** (F4), no unidades.
- **Semántica OR dentro / AND entre** (F8), convergente con `WEB/neumaticos/`.
- **Filtrado en cliente** (F9), con el volumen medido que lo justifica y el umbral a partir del cual
  dejaría de ser válido.
- **Frescura ≠ ventana temporal** (F11). La distinción que más cuesta explicar y la que más fácil se
  difumina.
- **Exclusiones visibles** (F10), con sus tres razones distinguibles.

Alternativas descartadas y por qué — un ADR sin esto no sirve dentro de seis meses:

- Filtrar en servidor: latencia por pulsación y complejidad de estado sin beneficio a esta escala.
- Componentes separados por pantalla: es lo que la petición humana descartó explícitamente.
- Aproximar el consumo por ventana con la última medición: respondería «mayo» con datos de otro
  período.
- Conservar el selector de unidad como control dedicado: cómo se resolvió D-BLOQ-2, con la razón.

### Knowledge

Actualizar, siguiendo `knowledge/ai/14 - Mantenimiento documental.md`:

- `05 - Datos y Supabase.md` — vistas nuevas o extendidas (`last_inspected_on`, historial de RTD si
  `task_08` cerró). Registrar también la deuda de `v_tire_performance` fuera de la cadena de
  migraciones (F14) y el grant a `anon` de `v_rendimiento_dashboard_rows`.
- `07 - Web dashboards y taller.md` — qué son ahora Rendimiento e Inspecciones. **Es la nota que más
  desactualizada queda**: las dos pantallas cambiaron de naturaleza, no de aspecto.
- `09 - Diseno y UX.md` — el componente de filtro como patrón, y su relación con los chips ya
  existentes en el buscador y en `WEB/neumaticos/`.
- `10 - Roadmap deuda y riesgos.md` — la deuda de §6.
- `12 - Decisiones e historia.md` — indexar el ADR nuevo.

### `REVISION_FINAL.md`

Separar con claridad:

1. **Entregado**, con evidencia.
2. **Verificado en campo** vs. **verificado solo en local**. No son lo mismo y la fase anterior tuvo
   cuidado de distinguirlos.
3. **Deuda y limitaciones conocidas** (§6).
4. **Capacidades pedidas y no entregadas**, con la razón. Si `task_08` se detuvo por cobertura, o si
   D-BLOQ-1 nunca se resolvió, **acá se dice con todas las letras**.

## 6. Deuda esperable al cierre

Registrar al menos:

1. **`v_tire_performance` fuera de la cadena de migraciones** (`AUDIT.md` §2.5). `schema_draft.sql`
   está desactualizado. Amerita una fase de esquema propia.
2. **Grant a `anon` en `v_rendimiento_dashboard_rows`** (`AUDIT.md` §2.6), más amplio de lo necesario
   y divergente del criterio de `v_search_index`.
3. **D-BLOQ-1 sin resolver**, si sigue así: la faceta de observación de reencauche no existe y
   requiere que alguien defina las bandas de RTD.
4. **Cobertura de inspecciones**, si `task_08` la midió baja: es un hallazgo sobre la operación real
   —cada cuánto se inspecciona de verdad— y probablemente lo más accionable que produzca la fase.
5. **Allowlist del bundle**: `renova-animate.js` y `renova-format.js`, heredado de la fase anterior.

## 7. Invariantes

- **No ocultar deuda ni capacidades faltantes.** El valor de este documento está en lo que admite.
- No marcar como verificado en campo lo que solo se probó en local.
- No documentar como implementado lo que quedó bloqueado.
- No duplicar especificaciones extensas en knowledge: resumir y enrutar (`CLAUDE.md`).
- Convertir fechas relativas a absolutas.
- No corregir código en esta tarea.

## 8. Casos de error

- El número de ADR ya está tomado → usar el siguiente libre y registrarlo.
- `npm run docs:check` falla → corregir la documentación, nunca relajar el check.
- Una decisión del ADR contradice una de `tasks_buscador_global/DECISIONES.md` → **detenerse**.
  Ningún ejecutor deroga una decisión previa; se plantea al humano.
- Una tarea quedó `BLOQUEADA` → se documenta como tal, no se omite del cierre.

## 9. Aceptación

- ADR en `decisions/` con decisiones, alternativas descartadas y limitaciones.
- Las cinco notas de knowledge actualizadas.
- `REVISION_FINAL.md` con las cuatro secciones de §5.
- Deuda de §6 registrada en `10 - Roadmap deuda y riesgos.md`.
- `npm run docs:check` verde.
- `STATE.md` completo, sin filas sin resultado.

## 10. Rollback

Solo documentación. Revertir los archivos.

## 11. Handoff

Actualizar fila 10 con: número de ADR, notas de knowledge actualizadas, resultado de `docs:check` y
la lista de deuda registrada.

**Cerrar el ciclo con el humano**: si D-BLOQ-1 o D-BLOQ-2 quedaron sin resolver, o si alguna
capacidad pedida no se entregó, decirlo explícitamente al entregar — no dejarlo enterrado en un
documento que quizá nadie abra.
