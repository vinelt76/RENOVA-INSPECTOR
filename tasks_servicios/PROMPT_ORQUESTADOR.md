# PROMPT ORQUESTADOR — Sección Servicios

> Copia este prompt íntegro en una sesión nueva. El agente debe actuar como orquestador de ejecución
> de las tareas definidas en esta carpeta, no rediseñar el alcance.

## Rol

Eres el orquestador de la fase **Servicios** de RENOVA INSPECTOR (web). La fase entrega una sola
cosa: **una superficie de lectura que responde cuántos servicios se hicieron y de qué tipo**, sobre
los movimientos que los operarios ya ejecutan.

Es una capa de consulta. No agrega escritura, no cambia el ciclo operativo y no toca el esquema de
las tablas existentes.

## Autoridad y lecturas obligatorias

Antes de ejecutar una tarea, leer `CLAUDE.md`, `knowledge/ai/00 - LEER PRIMERO.md` y las notas que esa
nota enrute para datos, web/taller, diseño y mantenimiento documental; `DESIGN.md`, `PRODUCT.md`,
esta carpeta completa y los archivos que la tarea declare como solo lectura.

**Orden de autoridad dentro de la carpeta**: `CONTRATOS_DATOS.md` > `DECISIONES.md` > `PLAN.md` >
archivos de tarea. Si un archivo de tarea contradice el contrato, manda el contrato y se registra la
divergencia.

La intención vigente es la petición humana reencuadrada en `AUDIT.md` §1: **la lógica de servicios no
falta, falta la superficie de lectura.** El estado implementado lo definen migraciones, código y
pruebas actuales.

## Límites duros

1. **Una sola migración**: `v_tire_services` más su índice. Aditiva, de lectura. No crear tablas ni
   RPCs, no modificar vistas, policies ni enums existentes.
2. La vista se construye desde **tablas base** (`tire_movement_executions`, `tire_movement_orders` y
   los catálogos). Prohibido derivarla de `v_operator_movement_orders`.
3. `security_invoker = true` y `SELECT` **solo** a `authenticated`. Nunca a `anon`.
4. **Prohibido filtrar `company_id`** dentro de la vista o desde el cliente. El aislamiento lo da la
   RLS de las tablas base.
5. **Sin ninguna acción de escritura** en la pantalla. Ni cancelar, ni corregir, ni reconciliar. No
   existe camino desde `servicios.html` a una RPC.
6. **No crear una segunda primitiva de filtrado ni un tercer sistema de modal.** Se reutilizan
   `WEB/shared/filter-bar.js`, `filter-facets.js`, `search.js`, `inspection-date-facets.js` y
   `WEB/movimientos/a11y.js`.
7. **No crear un cuarto glosario de tipos.** `servicios-model.js` reutiliza `MOVEMENT_REASONS` de
   `WEB/movimientos/supervisor-order-model.js`.
8. **No promover Servicio a objeto navegable** (D5, ADR-0005). Sin `servicio.html?id=`, sin
   `kind:'service'` en `v_search_index`, fila no clicable.
9. **El pareo de rotación es estructural, nunca textual** (D3). Quien lo resuelva por el texto de
   `observations` está fuera de contrato.
10. **`rotation_pairing` no es opcional** (D4). Una vista que no declare la calidad de su pareo es
    una caja negra.
11. **No filtrar datos `QA-TEST`** (D8).
12. **Ningún ejecutor deroga una decisión.** Si una tarea parece exigirlo, se detiene y se registra en
    `DECISIONES.md` con aprobación humana.
13. Ninguna pareja de tareas concurrentes puede editar el mismo archivo.
14. Nunca usar `service_role`, secretos ni datos reales en fixtures o logs.
15. No marcar una tarea aprobada sin la evidencia exigida en su archivo.

## Secuencia

```text
task_01 → task_02 → task_03 → task_04 → task_05 → task_06 → task_07 → task_08 → task_09
```

Todas secuenciales. Cada ejecutor actualiza **solo su fila** de `STATE.md` al iniciar y cerrar.

Un hallazgo que exige cambiar un archivo fuera de los permitidos vuelve como `EN CORRECCIÓN` o
`BLOQUEADA POR DECISIÓN HUMANA`; no se resuelve ampliando el alcance en silencio.

## Puntos de bloqueo previstos

- **`task_02`**: no cierra sin la confirmación humana de **D11 (zona horaria)**. Sin ella, `captured_on`
  agruparía en UTC y un servicio de las 20:00 en Lima caería al día siguiente. No se elige por
  defecto ni se deja «para después».
- **`task_03`**: si el caso de orden desalineada no consigue mantener el invariante de conteo, el
  diseño de dos niveles está mal y la vista vuelve a `task_02`. No se relaja la aserción.
- **`task_04`**: si `group by rotation_pairing` sobre datos reales devuelve `inferred` o `not_paired`,
  se **bloquea**. Significa que la alineación ya está rota en producción y hay que entender por qué
  antes de publicar métricas que la gente va a creer.
- **`task_04`**: si el conteo de la vista no cuadra con `salidas + entradas − rotaciones cerradas`, la
  definición de servicio no se está materializando: vuelve a `task_02`.
- **`task_05`**: si alguna suite existente (`shared`, `movimientos`, `inventario`, `buscador`,
  `neumaticos`) requiere modificación para pasar, algo cambió de comportamiento. Se bloquea y se
  revisa. **No se ajustan los tests.**
- **`task_07`**: si el bundle estático no contiene `servicios/`, la página se despliega rota. Es
  condición de aceptación, no un detalle.

## Autorización remota

`task_04` aplica DDL en el proyecto productivo. Conforme a `CLAUDE.md`, requiere:

1. revisión previa con el agente `sync-migration-reviewer`;
2. **autorización explícita del humano** antes de aplicar;
3. plan de reversión verificado:
   `drop view public.v_tire_services;` +
   `drop index if exists public.tire_movement_executions_company_captured_idx;`

La vista es aditiva y nada más la consume, por lo que la reversión es limpia. Aun así no se aplica sin
el visto bueno. Preferible aplicar primero en rama efímera (`mcp__supabase__create_branch`) o stack
local.

## Asignación

- **CODEX**: módulos web, pantalla, navegación, Vitest, navegador y bundle estático.
- **CLAUDE**: auditoría, contrato, migración, pruebas SQL, aplicación remota, ADR y revisión cruzada.

## Terminado

La fase termina solo cuando una rotación real emitida y ejecutada de punta a punta produce **una**
fila y no dos; un `entry` suelto produce una instalación; `rotation_pairing` es `exact`/`not_applicable`
en la totalidad de los datos reales o las excepciones quedaron explicadas; el conteo cuadra con el
invariante del contrato; un código no registrado no produce enlace falso; el aislamiento por empresa
está verificado con dos cuentas; un `inspector` ve el mensaje de rol y no «sin datos»; con cero
servicios los tiles muestran `—` y no se pinta barra; el banner de truncado se disparó en prueba; la
UI funciona por teclado y en 390×844 y escritorio; el contraste de la leyenda está medido; las suites
nuevas y las existentes están verdes sin modificar estas últimas; el bundle contiene `servicios.html`
y `servicios/` y no contiene `package.json` ni `__tests__/`; la consola no tiene errores ni secretos;
`npm run docs:check` pasa; D11 está confirmada y documentada; y
`decisions/0007-definicion-de-servicio-ejecutado.md` está registrado.
