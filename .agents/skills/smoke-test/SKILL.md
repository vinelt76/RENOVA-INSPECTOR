---
name: smoke-test
description: Use when ejecutando cambios en el repo tyre-watch-main que requieren verificación por-smoke tras cada tarea, o cuando se necesita validar que una modificación no rompió el surface afectado. Proyecto-específica, no solapa skills globales.
---

# Smoke test — Tyre Watch

Verificación de humo por superficie tras cada cambio discreto en el repo. No reemplaza `npm run verify` (gate final), sino que da feedback rápido por tarea.

## Superficies y comandos

| Si tocaste... | Smoke test |
|---|---|
| `package.json` raíz (deps/scripts) | `npm install --package-lock-only` + `node --check <scripts tocados>` |
| `app/package.json` (deps) | `cd app && npm install --package-lock-only` + `node -e "require('./package.json')"` |
| `WEB/<modulo>/` JS | `cd WEB/<modulo> && npx vitest run` |
| `app/src/` TS | `cd app && npm test && npm run build` |
| `app movimientos/src/` TS | `cd "app movimientos" && npm run build` |
| `reference/calculations.py` | `cd .agents/skills/verify-data-flow && node scripts/compare_golden.mjs` |
| `supabase/migrations/` | `npm run verify` (solo gate final, no smoke por tarea) |

## Ejemplo

Tras quitar un dep de `package.json` raíz:

```bash
npm install --package-lock-only
node --check scripts/verify-all.mjs
```

Tras mover `createElement()` a shared/:

```bash
cd WEB/shared && npx vitest run
cd WEB/movimientos && npx vitest run
```

## Gate final

Siempre cerrar el lote con:

```bash
npm run verify
cd "app movimientos" && npm run build
```