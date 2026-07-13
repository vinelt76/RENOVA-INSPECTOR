---
title: "RENOVA INSPECTOR - Leer primero"
updated: 2026-07-12
status: vigente
sources: [CLAUDE.md, PRODUCT.md, DESIGN.md, tasks_opencode/STATE.md, git]
---

# RENOVA INSPECTOR - Leer primero

> [!IMPORTANT]
> Fecha de corte: **2026-07-12**. Esta base resume el repo, pero no reemplaza la lectura del código que se vaya a modificar. Si una nota contradice una migración o el código actual, manda el código y la nota debe corregirse.

RENOVA INSPECTOR digitaliza la inspección y gestión de neumáticos de flotas peruanas. El inspector captura en Android aun sin señal; SQLite conserva el trabajo; Supabase consolida la operación; los dashboards web muestran inspecciones, estado, rendimiento, inventario y taller.

## Lectura mínima para una IA nueva

1. [[01 - Producto y alcance]]: problema, usuarios, límites y objetivos.
2. [[02 - Estado actual]]: qué existe de verdad y qué no debe darse por terminado.
3. [[03 - Arquitectura del sistema]]: componentes, responsabilidades y fuentes de verdad.
4. [[04 - Flujo de inspeccion y sincronizacion]]: recorrido exacto de una captura.
5. [[06 - Reglas de negocio]]: invariantes que nunca deben improvisarse.
6. [[10 - Roadmap deuda y riesgos]]: decisiones abiertas y siguiente trabajo.

## Reglas duras

- La app es **offline-first**. Un fallo de red nunca debe impedir guardar localmente.
- SQLite es la copia de trabajo del dispositivo; Supabase es la verdad consolidada.
- Los UUID de inspección nacen en el dispositivo. No usar autoincrementos de servidor.
- Umbrales, empresas, catálogos, configuraciones y número de posiciones no se hardcodean.
- `specs/reglas_negocio.md` manda sobre cualquier implementación de fórmulas.
- Presión CALIENTE no está definida. No inventar una referencia.
- Toda UI o persistencia web exige smoke test real, no solo build/tests.
- No exponer `service_role`, claves secretas ni contraseñas en app, dashboards o notas.

## Autoridades

| Tema | Fuente primaria |
|---|---|
| Constitución del proyecto | `CLAUDE.md` |
| Reglas y fórmulas | `specs/reglas_negocio.md` |
| Fijo vs configurable | `specs/reglas_fijas_vs_configurables.md` |
| UX de inspección | `specs/flujo_inspeccion.md` |
| Diseño visual | `DESIGN.md` y `PRODUCT.md` |
| Esquema remoto vigente | `supabase/migrations/` en orden cronológico |
| Esquema local | `app/src/db/sqlite.ts` y `app/src/db/schema.ts` |
| Estado comprobable | código + tests + Git; `STATE.md` es bitácora, no autoridad absoluta |
| Historia y alternativas | `decisions/`, `docs/run*`, `tasks_opencode/` |

## Navegación por tarea

- App/SQLite: [[04 - Flujo de inspeccion y sincronizacion]] y [[11 - Mapa del repo y runbook]].
- Supabase/RLS/RPC: [[05 - Datos y Supabase]] y [[08 - Infraestructura seguridad y despliegue]].
- Dashboard/taller: [[07 - Web dashboards y taller]].
- UI: [[09 - Diseno y UX]].
- Planificación: [[10 - Roadmap deuda y riesgos]] y [[12 - Decisiones e historia]].

