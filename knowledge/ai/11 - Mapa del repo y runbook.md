---
title: "Mapa del repositorio y runbook"
updated: 2026-07-24
status: vigente
sources: [repository tree, package.json, app/package.json, CLAUDE.md]
---

# Mapa del repositorio y runbook

## Dónde leer y modificar

| Zona | Responsabilidad |
|---|---|
| `app/src/screens/` | Flujo y pantallas móviles de inspección |
| `app/src/db/` | SQLite, migraciones, seed, repositorios |
| `app/src/sync/` | Supabase, pull/push, cola y cierre |
| `app/src/core/` | Cálculos puros |
| `app movimientos/` | App Android separada del operario: login propio, empresa derivada del perfil, órdenes y borrador local |
| `supabase/migrations/` | Historia ejecutable del esquema remoto |
| `supabase/tests/` | Pruebas SQL |
| `WEB/` | Dashboards, operaciones de taller y pestaña Movimientos (emite órdenes, no ejecuta retiros/instalaciones) |
| `specs/` | Reglas/flujo/catálogo |
| `decisions/` | ADRs |
| `docs/` | Auditorías, mapeos y resultados de runs — histórico |
| `deuda_tecnica/` | Inventario de deuda técnica — histórico/planificación |
| `FASE_02/` | Prompts y planificación de una fase — histórico |
| `tasks_*/` (`tasks_puesta_en_marcha_movimientos/`, `tasks_buscador_global/`, etc.) | Bitácora y specs de lotes de trabajo — histórico, uno por iniciativa |
| `tasks_opencode/` | Bitácora de un flujo de trabajo abandonado — leer solo como archivo, nunca como pendientes |
| `UI/` | Prototipos visuales, no app activa |
| `reference/` | Cálculos Python y fixtures golden |
| `knowledge/` | Fuente de estas notas para Obsidian |

## Comandos

```bash
cd app && npm ci
cd app && npm run dev
cd app && npm run lint
cd app && npm test
cd app && npm run build
cd app && npm run verify:db
cd app && npx cap sync android
npm run docs:check
npm run docs:sync -- --dry-run
npm run docs:sync
```

## Checklist antes de cambiar

1. Leer `CLAUDE.md` y la spec autoritativa.
2. Buscar implementación y tests actuales; no confiar en nombres de tasks.
3. Revisar `git status` y preservar cambios ajenos.
4. Para Supabase, leer migraciones en orden; una definición temprana puede estar reemplazada.
5. Para UI, localizar prototipo/tokens y preparar smoke test.

## Checklist de cierre

- Lint, tests y build verdes.
- Tests específicos del comportamiento nuevo.
- Smoke test si toca UI/SQLite web.
- Verificación real de RLS/RPC/vista si toca Supabase.
- APK/dispositivo si depende de plugin nativo.
- Actualizar [[02 - Estado actual]], [[10 - Roadmap deuda y riesgos]] y/o la nota del subsistema.
- Ejecutar `npm run docs:check` y sincronizar.

