# PROMPT ORQUESTADOR — Buscador global y objetos navegables

> Copiá este prompt íntegro en una sesión nueva. El agente debe actuar como orquestador de
> ejecución de las tareas definidas en esta carpeta, no rediseñar el alcance.

## Rol

Sos el orquestador del **buscador global** de RENOVA INSPECTOR (web). La fase entrega dos cosas
inseparables:

- **Dos objetos navegables**: Unidad y Neumático, con URL estable y enlazados entre sí.
- **Un punto de entrada único** para llegar a ellos desde cualquier pantalla, por barra visible en
  el header o por `Ctrl/Cmd+K`.

Es una capa de **consulta y navegación**. No agrega escritura. El buscador enruta hacia acciones,
nunca las ejecuta.

## Autoridad y lecturas obligatorias

Antes de ejecutar una tarea, leer `CLAUDE.md`, `knowledge/ai/00 - LEER PRIMERO.md` y las notas que
esa nota enrute para datos, web/taller, diseño y mantenimiento documental; `DESIGN.md`,
`PRODUCT.md`, este directorio completo y los archivos que la tarea declare como solo lectura.

La intención vigente es la petición humana que abre esta fase, reencuadrada en `AUDIT.md` §1: el
problema **no es exceso de filtros** sino ausencia de puntos de entrada y objetos navegables. El
estado implementado lo definen migraciones, código y pruebas actuales.

`docs/dashboard_ui_ux_audit.md` es historia y evidencia del dolor, no una lista de tareas a ejecutar.

## Límites duros

1. **Una sola migración**: `v_search_index`, aditiva, de lectura. No crear tablas, RPCs ni
   modificar vistas existentes. No instalar extensiones (`unaccent`, `pg_trgm`).
2. La vista se construye desde **tablas base**. Prohibido derivarla de `v_unit_position_state`,
   `v_tire_inventory_available` o `v_inventory_status`.
3. `security_invoker = true` y `SELECT` **solo** a `authenticated`. Nunca a `anon`.
4. **Sin parsing silencioso** de prosa a filtros. Toda interpretación se muestra como chip
   removible.

   **Aclaración (2026-07-19, D16).** Este límite prohíbe *inferir filtros de atributo desde texto
   libre*: que `Michelin 315 R2` se convierta en `marca=… AND medida=… AND condición=…` sin que el
   usuario lo vea. **No** prohíbe los prefijos de alcance `uni:`/`neu:`, que el usuario teclea, son
   inequívocos y filtran por `kind` —columna cerrada de dos valores—. La frontera: el buscador
   **acota por tipo de objeto, nunca infiere atributos del texto libre**.

   Una ejecución anterior afirmó que existía «una restricción de no interpretar prefijos» y la dio
   por derogada. Esa restricción nunca existió. **Ningún ejecutor deroga una decisión**: si una
   tarea parece exigirlo, se detiene y se registra en `DECISIONES.md` con aprobación humana.
5. **Sin acciones de escritura** en el buscador. Ni descartar, ni retirar, ni confirmar lotes.
6. No crear un tercer sistema de modal: reutilizar `WEB/movimientos/a11y.js`.
7. No duplicar la primitiva de búsqueda: `task_04` la unifica; nadie la vuelve a copiar.
8. No promover Inspección ni ningún atributo a objeto navegable. Dos sustantivos, y solo dos.
9. La caché de sesión **debe destruirse** al cerrar sesión o cambiar de empresa.
10. Nunca usar `service_role`, secretos ni datos reales en fixtures o logs.
11. Ninguna pareja de tareas concurrentes puede editar el mismo archivo.
12. No marcar una tarea aprobada sin la evidencia exigida en su archivo.

## Secuencia

```text
task_01 → task_02 → task_03 → task_04 → task_05 → task_06 → task_07
       → task_10 → task_11 → task_12 → task_13 → task_08 → task_09
```

Las tareas 10–13 nacen de la revisión humana de `task_07` y se insertan **antes** del cierre; `08`
y `09` cierran la fase completa. `task_07` permanece `APROBADO`: se corrige encima, no se reescribe.

Todas secuenciales. Cada ejecutor actualiza **solo su fila** de `STATE.md` al iniciar y cerrar.

Un hallazgo que exige cambiar un archivo fuera de los permitidos vuelve como `EN CORRECCIÓN` o
`BLOQUEADA POR DECISIÓN HUMANA`; no se resuelve ampliando el alcance en silencio.

### Puntos de bloqueo previstos

- **`task_03`**: si la respuesta de PostgREST está truncada por `max-rows`, o si el conteo del
  índice no coincide con `count(*)` de `units`/`tire_casings`, se bloquea. Un truncado silencioso
  repite el techo de 200 filas de `instalacion.html` y no se tolera como límite.
- **`task_04`**: si las suites existentes de Inventario o Movimientos requieren modificación para
  pasar, la extracción cambió comportamiento. Se bloquea y se revisa; no se ajustan los tests.
- **Cualquiera**: si `task_01` encuentra que el contrato de `CONTRATOS_DATOS.md` es irrealizable
  sobre el esquema real, se detiene y se abre una fase de esquema separada.

## Autorización remota

`task_03` aplica DDL en el proyecto productivo. Conforme a `CLAUDE.md`, requiere:

1. revisión previa con el agente `sync-migration-reviewer`;
2. **autorización explícita del humano** antes de aplicar;
3. plan de reversión verificado (`drop view public.v_search_index;`).

La vista es aditiva y nada más la consume, por lo que la reversión es limpia. Aun así no se aplica
sin el visto bueno.

## Asignación

- **CODEX**: módulos web, overlay, navegación, Vitest, navegador y documentación de uso.
- **CLAUDE**: auditoría, contrato, migración, aplicación remota, ADR y revisión cruzada final.

## Terminado

La fase termina solo cuando el índice cubre exactamente el universo de la empresa sin truncado, un
casco con `code_mismatch` se encuentra por ambos códigos, un casco sin código es visible y no
produce enlace falso, el aislamiento A/B está verificado y la caché muere al cambiar de empresa,
las dos páginas de objeto son alcanzables y el «Volver» roto de `historial-neumatico.html` quedó
reparado, la UI funciona por teclado y en 390×844/escritorio, las suites nuevas y las existentes
están verdes sin modificar estas últimas, la consola no contiene errores ni secretos,
`npm run docs:check` pasa y el ADR de UI está registrado en `decisions/`.
