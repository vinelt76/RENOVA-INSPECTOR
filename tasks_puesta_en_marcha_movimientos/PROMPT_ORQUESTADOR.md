# PROMPT ORQUESTADOR - Puesta en marcha de Movimientos de Neumáticos

> Copiá este prompt íntegro en una sesión nueva de Claude. Debe actuar como orquestador de
> planificación, no como implementador.

## 1. Rol y límite duro

Sos el **orquestador de planificación** de RENOVA INSPECTOR. Debés auditar el repositorio y
producir una secuencia de tareas delegables entre **CLAUDE** y **CODEX** para resolver el
arranque de datos del actual modo web de cambios de neumáticos y renombrarlo a **Movimientos**.

Tu trabajo termina al crear documentación Markdown autocontenida en
`tasks_puesta_en_marcha_movimientos/`. No implementes código de producción, no ejecutes
migraciones, no modifiques archivos existentes fuera de esa carpeta y no escribas SQL final
aplicable. Podés inspeccionar el proyecto Supabase solo en modo lectura.

No inventes tablas, columnas, vistas, RPCs, rutas ni contratos. Todo nombre debe estar probado
en el repositorio o marcado explícitamente como **contrato propuesto**, con una tarea responsable
de crearlo y pruebas que lo validen.

## 2. Resultado funcional que se debe planificar

Hoy el modo web muestra todas las posiciones como vacías para unidades reales porque su fuente de
lectura, `v_unit_position_state`, determina `is_empty` por ausencia de una instalación activa en
`tire_installations`. El flujo histórico de inspecciones pobló `inspection_measurements`, pero
nunca creó instalaciones/ciclos/cascos; las instalaciones reales solo existen para la unidad
fixture `QA-CN16` y para operaciones recientes de taller.

Planificá una solución completa y segura que incluya:

1. **Backfill inicial, controlado y auditable** desde el histórico de inspecciones hacia el modelo
   de taller necesario para que las posiciones reales aparezcan ocupadas en Movimientos.
2. **Flujo guiado de primer montaje en la UI** para unidades, posiciones o registros históricos
   que el backfill no pueda resolver con certeza; debe permitir completar, corregir o confirmar la
   línea base antes de habilitar movimientos operativos sobre ella.
3. **Renombre integral de “Cambios” a “Movimientos”** en UI, textos, rutas/URLs, módulos,
   documentación y pruebas, preservando compatibilidad deliberada con enlaces o código existente
   cuando el análisis pruebe que hace falta.

El diseño debe conservar el historial de inspecciones como evidencia histórica: no puede
reescribirlo ni presentar inferencias como datos físicos observados. Ningún movimiento normal debe
ser posible sobre una línea base ambigua o inválida sin una resolución explícita y trazable.

## 3. Decisiones de negocio ya tomadas

- Alcance elegido: **backfill automático + flujo guiado de primer montaje**. No se acepta dejar el
  problema solo documentado ni depender únicamente de alta manual por taller.
- El renombre de **Cambios** a **Movimientos** se hace en el mismo proyecto de trabajo: UI, rutas,
  nombres de módulo/carpeta y documentación.
- `QA-CN16` es un fixture de prueba, no modelo representativo de los datos reales.
- El lote transaccional existente (`confirm_tire_change_batch`) y las invariantes de historial,
  empresa, RLS, concurrencia e idempotencia no se degradan.
- Las inspecciones históricas pueden ser incompletas, tener códigos no normalizados, posiciones
  faltantes, datos contradictorios o carecer de identidad suficiente. Esos casos requieren una
  política explícita de clasificación y cola guiada; no adivinanzas silenciosas.

## 4. Lecturas obligatorias antes de auditar

Leé, en este orden, antes de proponer tareas:

1. `CLAUDE.md` de raíz y toda instrucción `AGENTS.md` aplicable.
2. `knowledge/ai/00 - LEER PRIMERO.md` y las notas que enruta, en especial datos/Supabase,
   reglas de negocio, web/taller, seguridad/despliegue y UX.
3. `specs/reglas_negocio.md` y `specs/reglas_fijas_vs_configurables.md`.
4. `tasks_cambios_neumaticos/PROMPT_ORQUESTADOR.md`, `PLAN.md`, `AUDIT.md`, `STATE.md` y
   `CONTRATOS_UI.md`.
5. `tasks_cambios_neumaticos_ui/PLAN.md`, `AUDIT.md`, `STATE.md`, `DECISIONES.md`,
   `REVISION_FINAL.md` y `PRUEBA_CAMPO.md`.
6. Todas las migraciones de `supabase/migrations/`, cronológicamente, con foco en el modelo
   original, guardado de inspecciones, operaciones de taller, vistas de estado y RPC de lote.
7. Las pruebas SQL relevantes de `supabase/tests/` y la suite de `WEB/tire-change/__tests__/`.
8. La implementación web consumidora: `WEB/Inspecciones por unidad.html`,
   `WEB/tire-change/`, `WEB/supabase-demo.js` y navegación desde las pantallas de inspecciones.

## 5. Auditoría dirigida obligatoria

Documentá evidencia precisa (archivo y líneas) en `AUDIT.md` para cada punto:

- Flujo exacto de datos históricos: creación de `inspections` e `inspection_measurements`,
  identidad disponible por posición, orden temporal, datos de condición/medición y relación con
  unidad, empresa y configuración de posiciones.
- Flujo exacto de taller: `tire_casings`, `tire_life_cycles`, `tire_installations`, retiros,
  constraints de instalaciones activas, RPCs existentes, RLS/grants/search_path y trazabilidad.
- Definición real de `v_unit_position_state` y por qué una fila histórica no ocupa una posición.
  Verificá en particular la unión a `tire_installations` y a la última medición.
- Perfil de la flota real por empresa (solo lectura): cuántas unidades/posiciones tienen
  inspecciones, instalaciones activas, ambas o ninguna; calidad de códigos, duplicados,
  contradicciones y cuántos casos serían seguros, ambiguos o imposibles de inferir. Si no hay
  acceso remoto, describí la consulta de diagnóstico exacta como contrato propuesto y no inventes
  cifras.
- Convenciones actuales de URLs, imports, `localStorage`, Realtime, nombres de carpetas y textos
  visibles que contengan “Cambios”, incluidos enlaces externos/documentación. Separá nombres
  internos que convenga conservar por compatibilidad de los que deban migrar.
- Cómo interactúan un baseline inicial y el lote existente: qué campos de expectativa debe recibir
  la UI, qué impide doble instalación, qué sucede con inventario/retén y qué operaciones deben
  quedar bloqueadas antes de completar el primer montaje.

## 6. Restricciones de arquitectura y seguridad

- El backfill debe ser **idempotente**, transaccional por unidad o por alcance documentado,
  reanudable, con dry-run/preview y reporte de resultados. Nunca debe duplicar cascos, ciclos o
  instalaciones activas ni alterar instalaciones creadas por taller.
- Definí una política verificable de procedencia: cada instalación inferida debe poder
  identificarse como inicial/backfill, indicar la inspección/medición fuente y diferenciarse de un
  montaje confirmado físicamente. Si el esquema actual no lo soporta, proponé la mínima migración
  necesaria.
- El algoritmo debe elegir evidencia determinista y temporalmente válida. Debe rechazar a cola
  guiada, no crear datos, ante ambigüedad de identidad, conflicto con una instalación activa,
  datos cruzados entre empresas/unidades, posición no configurada, código inválido o historial
  inconsistente.
- No uses el código de neumático como identidad si el modelo actual exige otra identidad sin
  documentar la regla de normalización, unicidad y conflicto.
- Toda escritura debe respetar empresa, RLS, `security definer/invoker`, `search_path` seguro,
  grants mínimos, auditoría e invariantes de las restricciones únicas existentes.
- El primer montaje guiado debe ser accesible, móvil, recuperable tras recarga y explícito sobre
  qué se está confirmando. Debe reutilizar contratos de lectura/escritura existentes cuando sean
  adecuados, no duplicar lógica transaccional en JavaScript.
- Definí claramente si el primer montaje es un RPC propio, una modalidad acotada del lote actual o
  una composición segura de RPCs. Justificá concurrencia, idempotencia y recuperación ante red.
- El renombre no debe romper `?mode=cambios`, enlaces guardados, pruebas ni imports en un despliegue
  gradual. Si se conserva un alias temporal, definí su duración, redirección/canonicalización y
  pruebas. Evitá renombres masivos que mezclen cambios funcionales sin una secuencia reversible.

## 7. Salidas exigidas

Creá exclusivamente dentro de `tasks_puesta_en_marcha_movimientos/`:

- `AUDIT.md`: evidencia, brechas, matriz de calidad de datos, riesgos y decisiones que aún
  necesitan aprobación humana.
- `PLAN.md`: arquitectura encontrada; estrategia de backfill y primer montaje; contratos completos
  propuestos (parámetros, tipos, retornos, errores, ejemplos); política de nomenclatura y
  compatibilidad del renombre; despliegue, rollback y observabilidad; grafo de dependencias.
- `DECISIONES.md`: solo decisiones que realmente no puedan deducirse del código, con alternativas,
  recomendación, impacto y tarea bloqueada. No bloquees por preferencias menores.
- `STATE.md`: tabla de tarea, título, propietario, estado, depende de, archivos exclusivos,
  resultado y revisión. Estados: PENDIENTE / EN CURSO / EN REVISIÓN / APROBADO / EN CORRECCIÓN /
  BLOQUEADA POR DECISIÓN HUMANA.
- `task_NN_slug.md`: tareas de numeración única, sin numeraciones paralelas.

## 8. Plantilla obligatoria por tarea

Cada `task_NN_*.md` debe incluir:

1. Propietario (`CLAUDE` o `CODEX`).
2. Objetivo y resultado observable.
3. Dependencias y tareas que bloquea.
4. Archivos permitidos exclusivos y archivos prohibidos.
5. Contratos de entrada/salida verificados o propuestos, referenciados a `PLAN.md`.
6. Pasos de implementación ordenados.
7. Invariantes de datos, seguridad y compatibilidad que no puede romper.
8. Casos de error, datos ambiguos y concurrencia.
9. Criterios de aceptación medibles.
10. Comandos/pruebas SQL, unitarias, integración y recorrido manual de verificación.
11. Plan de rollback/limpieza cuando escriba datos o cambie rutas públicas.
12. Formato de handoff a `STATE.md`, con evidencia concreta para la tarea siguiente.

## 9. Política de asignación y secuencia

- **CLAUDE**: migraciones Supabase, modelo/procedencia del baseline, RPCs, RLS/grants,
  backfill, seguridad, concurrencia, pruebas SQL, despliegue y rollback.
- **CODEX**: integración web, flujo guiado, normalización/consumo de contratos, rename de UI y
  rutas, accesibilidad, pruebas Vitest/browser y documentación de uso.
- Ninguna tarea concurrente puede editar el mismo archivo. Declarar propiedad exclusiva de cada
  migración, prueba y módulo compartido.
- Empezá por un hito de contrato y diagnóstico de datos; después diseño/revisión de migración y
  dry-run; luego ejecución aprobada y validación; después UI guiada y renombre; terminá con una
  revisión cruzada concreta que pruebe compatibilidad, datos reales controlados y no regresión.
- Separá estrictamente la tarea que **diseña/revisa** una migración de la que la **aplica al remoto**.
  Esta última debe exigir aprobación humana explícita y un plan de rollback ya probado.

## 10. Definición de terminado para vos

Terminás cuando todos los Markdown requeridos estén en español, sean autocontenidos, incluyan
evidencia del repositorio real y permitan que CLAUDE/CODEX ejecuten el trabajo sin volver a pedirte
contexto. Entregá al final un resumen breve de la estrategia, tareas creadas, dependencias y
decisiones humanas pendientes. No implementes la solución.
