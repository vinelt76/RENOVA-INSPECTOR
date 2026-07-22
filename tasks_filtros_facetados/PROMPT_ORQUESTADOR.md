# PROMPT ORQUESTADOR — Filtros facetados

> Copiá este prompt íntegro en una sesión nueva. El agente actúa como orquestador de ejecución de
> las tareas de esta carpeta, **no rediseña el alcance**.

## Rol

Sos el orquestador de la fase de **filtros facetados** de RENOVA INSPECTOR (web). La fase entrega un
único componente de filtro con autocomplete y chips, reutilizado en dos pantallas que cambian de
naturaleza:

- **Rendimiento** pasa de detalle de una unidad a **agregación sobre un conjunto filtrado**.
- **Inspecciones** pasa de listar unidades a listar **neumáticos**.

Es una capa de **consulta y agregación**. No agrega escritura.

## Autoridad y lecturas obligatorias

Antes de ejecutar una tarea, leer `CLAUDE.md`, `knowledge/ai/00 - LEER PRIMERO.md` y las notas que
esa nota enrute para datos, web/taller, diseño y mantenimiento documental; `DESIGN.md`, `PRODUCT.md`,
esta carpeta completa, y los archivos que la tarea declare como solo lectura.

**Lectura adicional obligatoria**: `tasks_buscador_global/` completo, en particular `DECISIONES.md`
y `task_13`. Esta fase se apoya en sus activos y no puede contradecir sus decisiones vigentes.

La intención vigente es la petición humana que abre la fase, reencuadrada en `AUDIT.md` §1: **no se
piden dos buscadores**, se pide un filtro reutilizado en dos pantallas — y ya existe un buscador
global aparte, que esta fase no toca.

El estado implementado lo definen migraciones, código y pruebas actuales. Ante conflicto entre
intención e implementación: detenerse, mostrar evidencia, pedir confirmación. Nunca resolverlo en
silencio (`CLAUDE.md`).

## Límites duros

1. **Un solo componente** (F1). Prohibido crear una variante por pantalla. Si las dos pantallas
   parecen exigir componentes distintos, se detiene y se registra en `DECISIONES.md`.
2. **No tocar `WEB/buscador/`** (F2). El buscador enruta; el filtro reduce. Son cosas distintas.
3. **No duplicar la primitiva de búsqueda.** `WEB/shared/search.js` ya la unifica. Nadie la copia.
4. **Converger con `WEB/neumaticos/`**, que ya implementa facetas con chips. Si el componente nuevo
   diverge de esa mecánica, se detiene: no nacen dos sistemas de chips.
5. **Filtrado en cliente** (F9). Sin endpoints, índices, extensiones ni filtros enviados a PostgREST.
6. **Sin interpretación silenciosa** (F6). Todo filtro aplicado es un chip visible y removible.
7. **Sin catálogos hardcodeados** (F7). Las opciones salen de los datos cargados.
8. **No inventar umbrales.** Ni bandas de reencauche (D-BLOQ-1), ni RTD de retiro, ni frescura fija
   en el componente. `CLAUDE.md` es explícito.
9. **No cambiar fórmulas de cálculo.** `computeGroup` reordena la entrada de `computeAxle`; la
   matemática es idéntica. Cualquier divergencia numérica invalida la tarea.
10. **Migraciones aditivas únicamente**, al final del `select`, con `security_invoker = true`.
    Precedente: `20260719180841_search_index_facets.sql`.
11. **No regularizar `v_tire_performance`** (F14). Deuda registrada, fase aparte.
12. Nunca usar `service_role`, secretos ni datos reales en fixtures o logs.
13. Ninguna pareja de tareas concurrentes edita el mismo archivo.
14. No marcar una tarea aprobada sin la evidencia que su archivo exige.

## Secuencia

```text
task_01 → task_02 → task_03 → task_04 → task_05 → task_06
       → task_07 → task_08 → task_09 → task_10
```

Todas secuenciales. Cada ejecutor actualiza **solo su fila** de `STATE.md` al iniciar y al cerrar.

Un hallazgo que exija tocar un archivo fuera de los permitidos vuelve como `EN CORRECCIÓN` o
`BLOQUEADA POR DECISIÓN HUMANA`. No se resuelve ampliando el alcance en silencio.

## Bloqueos abiertos al inicio de la fase

Dos decisiones humanas están **sin resolver** y detienen tareas. Están documentadas en
`DECISIONES.md`.

- **D-BLOQ-1 — bandas de observación de reencauche.** Los valores *para reencauche* / *próximo a
  reencauche* / *desecho* **no existen** en el esquema, specs ni catálogos. Son derivados de RTD y
  las bandas no están definidas. Bloquea esa faceta de `task_06`; el resto de la tarea procede.
  **No se inventa una banda provisional.**
- **D-BLOQ-2 — desaparición del selector de unidad en Rendimiento.** Bloquea `task_05` completa. La
  propuesta de la auditoría es conservar la capacidad como faceta `unidad` en vez de eliminarla.
  Requiere confirmación humana.

Las tareas 01–04 no dependen de ninguna de las dos. Conviene plantearlas al humano temprano.

## Puntos de bloqueo previstos

- **`task_01`**: si `brand_name` o la notación de configuración no existen en
  `v_rendimiento_dashboard_rows`, decidir entre extender la vista (aditivo) o **retirar la faceta del
  alcance**. Prohibido derivarlas por heurística desde otra columna.
- **`task_01`**: si el payload medido hace inviable el filtrado en cliente, F9 se revisa con el
  humano. **No se pagina en silencio.**
- **`task_01`**: si REST con clave anónima devuelve filas de `v_rendimiento_dashboard_rows`, deja de
  ser deuda (`AUDIT.md` §2.6) y pasa a incidente de seguridad. La fase se detiene y se reporta.
- **`task_04`**: si `computeGroup` sobre un eje difiere numéricamente de `computeAxle`, la
  refactorización cambió comportamiento. `EN CORRECCIÓN`. **No se ajustan los valores esperados.**
- **`task_05` / `task_06`**: si las suites existentes requieren modificación para pasar, el cambio
  rompió comportamiento. Se bloquea. **No se ajustan los tests.**
- **`task_08`**: si el historial de `inspection_measurements` no permite recuperar dos mediciones en
  una ventana típica, la capacidad no es implementable con los datos actuales. Se reporta como
  limitación real; **no se aproxima con la última medición disponible**.

## Autorización remota

`task_07` y `task_08` aplican DDL en el proyecto productivo. Conforme a `CLAUDE.md`:

1. revisión previa con el agente `sync-migration-reviewer`;
2. **autorización explícita del humano** antes de aplicar;
3. plan de reversión verificado.

## Asignación

- **CODEX**: módulos web, componente, refactorización de cálculo, pantallas, Vitest, navegador.
- **CLAUDE**: auditoría remota, contrato, migraciones, aplicación remota, ADR y revisión final.

## Terminado

Ver `PLAN.md` §7. En síntesis: un componente sirviendo a dos pantallas sin copias; el agregado de
Rendimiento recalcula al filtrar y muestra cuántos neumáticos excluyó por datos insuficientes;
`computeGroup` sobre un eje coincide exactamente con el `computeAxle` anterior; Inspecciones lista
neumáticos con la fecha como chip removible; suites verdes sin tocar las existentes;
`npm run docs:check` verde y ADR registrado en `decisions/`.
