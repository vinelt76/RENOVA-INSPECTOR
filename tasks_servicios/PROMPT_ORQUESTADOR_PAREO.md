# PROMPT ORQUESTADOR — Fase 2: el servicio es una posición atendida

> Copia este prompt íntegro en una sesión nueva. El agente actúa como orquestador de ejecución de
> `task_10`–`task_13`, no rediseña el alcance.

## Rol

Eres el orquestador de la **Fase 2** de la sección Servicios de RENOVA INSPECTOR. La Fase 1 entregó
la superficie de lectura. Esta fase corrige **qué emite el supervisor y cómo cuenta la vista**.

Son **4 tareas** y **no tocan ninguna tabla**. Si en algún momento parece que hace falta una columna,
un enum, una RPC o un cambio en la app móvil: **detente**. Eso ya se evaluó y se sacó a
`FASE_FUTURA_ORIGEN_Y_RECONCILIACION.md`, con el razonamiento de por qué no hace falta ahora.

## Autoridad y lecturas obligatorias

Antes de ejecutar una tarea: `CLAUDE.md`, `knowledge/ai/00 - LEER PRIMERO.md` y lo que enrute;
`DESIGN.md`, `PRODUCT.md`; esta carpeta completa; y los archivos que la tarea declare como solo
lectura. Mirar la planilla real: `app movimientos/Untitled.jpg`.

**Orden de autoridad:** `CONTRATOS_DATOS.md` (salvo su §1, que esta fase deroga) > `DECISIONES.md` >
`PLAN_PAREO.md` > archivos de tarea.

La intención vigente es `PLAN_PAREO.md` §1–§4: **la planilla modela el servicio como una posición
atendida, y el supervisor emitía la mitad.**

## Límites duros

1. **Cero cambios de tabla, enum, RPC y policy.** La única migración de la fase es
   `create or replace view`.
2. **Cero cambios en `app movimientos/`.** `draftFromOrder` ya es genérico sobre N ítems. Si la app
   falla con 4 renglones, es un hallazgo grave: se detiene la fase, no se parcha la app.
3. **La entrada de cada posición va inmediatamente después de su salida** en `request_items`. La
   vista parea en `sequence - 1`; agruparlas de otra forma rompe el pareo silenciosamente.
4. **Preservar el 1:1 y el orden** entre `request_items` y las ejecuciones (`AUDIT.md` §6).
5. **No inventar origen.** Sin código legible o sin salida correspondiente en la orden, la columna es
   nula y la pantalla lo muestra indeterminado.
6. **El operario no declara el origen.** Solo los datos del neumático que sale y su observación.
7. **`security_invoker = true`, `SELECT` solo a `authenticated`.** Prohibido filtrar `company_id` en
   la vista o desde el cliente: el aislamiento lo da la RLS.
8. **Servicios sigue sin ser objeto navegable** (D5, ADR-0005) y la pantalla **sin escritura** (D9).
9. **Prohibido emparejar por el texto de `observations`** (D3).
10. **No filtrar `QA-TEST`** (D8). Lo heredado se ve como es y **no se le inventa un par**.
11. **No crear un cuarto glosario de tipos**, ni una segunda primitiva de filtrado, ni un tercer
    sistema de modal.
12. **No se ajusta un test para que pase.** Un cambio de test lleva justificación individual.
13. **No se reescribe la historia de la Fase 1.** Se marca superada y se enruta a ADR-0008.
14. Nunca `service_role`, secretos ni datos reales en fixtures, logs o capturas.
15. No marcar una tarea aprobada sin la evidencia exigida en su archivo.

## Secuencia

```text
task_10 → task_11 → task_12 → task_13
```

Todas secuenciales. Ninguna pareja comparte archivo. Cada ejecutor actualiza **solo su fila** de
`STATE.md` al iniciar y cerrar.

## Puntos de bloqueo previstos

- **`task_10`**: si la rotación de tres o más posiciones aparece como requisito, se registra como
  pendiente. `addRotation` toma dos y el MVP cubre buses 2-4 y 2-4-2; no se improvisa un ciclo.
- **`task_11`**: si el pareo general produce **duplicados**, el `left join` no está acotado. Es el
  error más probable de la fase, igual que lo fue en `task_02`.
- **`task_11`**: si `rotation_pairing` empieza a devolver `inferred` sobre datos reales, `task_10` no
  está emitiendo el par adyacente. El problema está aguas arriba: **no se relaja la vista**.
- **`task_12` punto 3**: si la app móvil no maneja 4 renglones, la premisa de la fase resultó falsa.
  **Detener**: cambia el alcance y el riesgo por completo.
- **`task_12` punto 5**: si una rotación real deja una posición vacía o un casco sin registro de
  salida, la fase **no cierra**. Es el defecto que existe para corregir.
- **`task_12` punto 8**: si un scrap con reemplazo sigue contando 2, volver a `task_11`.
- **`task_12` punto 13**: si un corte de red pierde captura, es regresión de la invariante
  offline-first de `CLAUDE.md`. Bloquea; no es deuda.

## Autorización remota

`task_11` aplica un `create or replace view` en el proyecto productivo. Conforme a `CLAUDE.md`:
revisión previa con `sync-migration-reviewer`, autorización explícita del humano, y reversión
verificada (recrear la v1 desde `20260721130000_tire_services_view.sql`).

A diferencia del plan de 12 tareas que se descartó, **no hay punto sin retorno**: la vista no toca
datos y la v1 se recrea en un comando.

## Asignación

- **CODEX**: supervisor web (`task_10`), capa web de la vista, suites y prueba de campo (`task_12`).
- **CLAUDE**: migración de la vista y su revisión (`task_11`), ADR y documentación (`task_13`).

## Terminado

`PLAN_PAREO.md` §6. En una línea: **una rotación real deja las dos posiciones ocupadas y ningún casco
sin registro de salida**; un scrap con reemplazo cuenta 1 y no 2; el origen se deriva cuando se puede
y se declara indeterminado cuando no; la app móvil no cambió; y ADR-0008 está registrado.
