# task_02 — Andamiaje de módulos + runner de pruebas

1. **Propietario y alcance**: CODEX. Crear la estructura `WEB/tire-change/` y un runner de pruebas
   para JS de dashboard, **sin lógica de negocio**.
2. **Objetivo y resultado observable**: `WEB/tire-change/` existe con `package.json`,
   `vitest.config.js` y un test smoke que corre en verde; los módulos futuros pueden importarse y
   testearse.
3. **Dependencias**: ninguna. **Bloquea**: task_04, task_05, task_06, task_07, task_08 (y por
   cadena, el resto).
4. **Decisiones**: aplica Decisión 9 (modularización + vitest scoped). No bloqueada.
5. **Archivos permitidos**: `WEB/tire-change/package.json`, `WEB/tire-change/vitest.config.js`,
   `WEB/tire-change/README.md`, `WEB/tire-change/__tests__/smoke.test.js`. **Solo lectura**:
   `PLAN.md §1`, `app/package.json` (referencia de versiones). **Prohibido**: tocar `app/`,
   `WEB/*.html`, `WEB/supabase-demo.js`, la raíz `package.json`.
6. **Estado inicial verificado**: WEB/ sin build ni tests (`AUDIT.md §6`); `app/` tiene
   `vitest@4.1.9` y `playwright@1.61.1` (`app/package.json`). Root `package.json` solo `docs:*`.
7. **Contratos**: `vitest.config.js` con entorno `node` (lógica pura) y `jsdom`/`happy-dom` para
   los módulos con DOM (a decidir dentro de la tarea, versión fijada). Scripts `test`, `test:watch`.
8. **Pasos**: (1) Crear `WEB/tire-change/package.json` con `vitest` fijado a versión exacta y un
   entorno DOM fijado. (2) `vitest.config.js` apuntando a `__tests__/**/*.test.js`. (3) `README.md`
   con los límites de módulos (copiar tabla de `PLAN.md §1`). (4) `smoke.test.js` con un
   `expect(1+1).toBe(2)`. (5) Verificar que `npm test` (en `WEB/tire-change/`) corre verde.
9. **Estados**: si falta Node/npm, documentar y detenerse; no improvisar otro runner.
10. **Consistencia/seguridad**: no agregar dependencias de red en runtime del dashboard; vitest es
    solo dev. No incluir secretos.
11. **Pruebas**: el propio `smoke.test.js`. Fixtures: ninguno.
12. **Smoke real**: N/A (no hay UI todavía).
13. **Aceptación**: `npm test` verde en `WEB/tire-change/`; estructura documentada en README.
14. **Comandos** (tras confirmar que existen): `cd WEB/tire-change && npm install && npm test`.
15. **Rollback**: borrar `WEB/tire-change/` (solo contiene andamiaje).
16. **Handoff**: fila `task_02` a APROBADO ✓ con la versión exacta de vitest/entorno DOM fijada.
