---
name: calc-parity-check
description: Verifica la paridad Python/TypeScript del motor de cálculo. Usar siempre antes de cerrar cambios en reference/calculations.py, app/src/core/calculations.ts, fórmulas, umbrales o fixtures golden.
---

# Paridad del motor de cálculo

1. Leer `specs/reglas_negocio.md` y `decisions/0002-calc-parity.md`.
2. Ejecutar el comparador golden compartido — reemplaza las dos suites sueltas, corre ambas
   implementaciones contra el MISMO fixture y falla si divergen:

```bash
node .claude/skills/verify-data-flow/scripts/compare_golden.mjs
```

   Añadir `--strict-spec` si además se quiere que el build falle ante cualquier desviación de
   `specs/reglas_negocio.md` (no solo divergencia Python↔TS). Las suites individuales
   (`cd reference && python -m pytest test_calculations_golden.py -v`,
   `cd app && npm test -- calculations.test.ts`) siguen existiendo y pueden correrse aparte, pero
   ya no prueban paridad entre sí — cada una valida su propio lenguaje contra sus propios casos.
3. Si se modifica o agrega una función: añadir el caso a
   `.claude/skills/verify-data-flow/fixtures/golden.json` (un solo fixture, no dos) en vez de
   duplicarlo en ambas suites. Casos donde la spec no resuelve el resultado se marcan
   `"spec_ambigua": true` — no cuentan como fallo salvo con `--strict-spec`.
4. No implementar presión CALIENTE: continúa sin especificación aprobada.

Reportar la tabla que imprime `compare_golden.mjs` (función/caso/Python/TS/esperado/paridad/spec).
Una fila con paridad `XXX` deja la tarea abierta — indicar archivos y líneas involucrados. Para
verificar además la cadena completa (persistencia local, sync, contrato Supabase, dashboards), usar
la skill `verify-data-flow`.
