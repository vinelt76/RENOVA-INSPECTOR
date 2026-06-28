# Flujo de trabajo opencode — RENOVA INSPECTOR

Este directorio es el contrato entre **Opus** (planifica + revisa) y **opencode** (ejecuta).

## Para opencode — cómo trabajar aquí

1. Lee `STATE.md` para ver qué task sigue.
2. Abre el task `task_NN_*.md` correspondiente. Es **autocontenido**: tiene objetivo, pasos,
   criterios de aceptación y cómo verificar.
3. Implementa **solo ese task**. No adelantes trabajo de otros tasks ni features fuera de alcance.
4. Respeta la **constitución** (`/CLAUDE.md`) y las **reglas de negocio** (`/specs/reglas_negocio.md`).
   En conflicto, manda `specs/`.
5. Al terminar:
   - Verifica con los comandos de la sección "Cómo verificar" del task.
   - **Smoke test en navegador OBLIGATORIO** (si el task toca UI o el camino web de SQLite):
     verde en `build`/`test`/`lint` NO alcanza. `npm run dev`, recorre el flujo afectado, y
     confirma: (a) **cero errores en la consola** del navegador (sobre todo init de SQLite/seed),
     (b) los datos **se ven** (no listas vacías), (c) si hay persistencia, captura algo y
     **recarga** verificando que sobrevive. Anota en `STATE.md` qué recorriste y el resultado.
     (No aplica a tasks de lógica pura cubiertos por unit tests.)
   - Actualiza `STATE.md`: marca el task como `LISTO PARA REVIEW` y anota qué hiciste, qué
     comandos corriste, el resultado del smoke test y cualquier desviación.
   - **No** marques `APROBADO` — eso lo hace Opus en el review.
6. Si un task es **ambiguo o imposible como está escrito**: NO improvises. Anota el bloqueo en
   `STATE.md` (`BLOQUEADO` + descripción) y detente. Opus corrige el spec.

## Reglas duras

- **No toques** `specs/`, `decisions/`, `docs/`, `reference/`, `CLAUDE.md` ni los `task_*.md`.
  Esos son de Opus. Tu trabajo vive en `app/`.
- **No hardcodees catálogos** (marcas, anomalías, válvulas, configuraciones) en componentes:
  van en SQLite (seed) y la UI los lee de la DB.
- **IDs de inspección = UUID v4 generados en cliente.** Nunca autoincrement.
- **No implementes presión CALIENTE** (valor pendiente). Ni login, ni sync con servidor, ni
  reportes Excel — fuera de alcance del lote actual.

## Para Opus — review

- Revisar el diff de `app/` contra los **criterios de aceptación** del task.
- Correr la verificación. Si pasa y cumple, marcar `APROBADO` en `STATE.md`. Si no, dejar
  hallazgos concretos y devolver a `EN CORRECCIÓN`.
- Para tasks de UI/SQLite web: **no aprobar sin evidencia de smoke test en navegador** en la
  bitácora. Si falta, devolver por "smoke test pendiente".

## Estados de un task (en `STATE.md`)

`PENDIENTE` → `EN PROGRESO` → `LISTO PARA REVIEW` → (`APROBADO` | `EN CORRECCIÓN`) ; `BLOQUEADO`
