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
   `specs/reglas_negocio.md` (no solo divergencia Python↔TS). La suite individual
   `cd app && npm test -- calculations.test.ts` sigue existiendo y puede correrse aparte, pero ya
   no prueba paridad — valida TS contra sus propios casos. (`reference/test_calculations_golden.py`
   se eliminó en 2026-08-31: duplicaba los casos del golden compartido sin cubrir `calcular_isa_peso`).
3. Si se modifica o agrega una función: añadir el caso a
   `.claude/skills/verify-data-flow/fixtures/golden.json` (un solo fixture, no dos) en vez de
   duplicarlo en ambas suites. Casos donde la spec no resuelve el resultado se marcan
   `"spec_ambigua": true` — no cuentan como fallo salvo con `--strict-spec`.
4. No implementar presión CALIENTE: continúa sin especificación aprobada.

Reportar la tabla que imprime `compare_golden.mjs` (función/caso/Python/TS/esperado/paridad/spec).
Una fila con paridad `XXX` deja la tarea abierta — indicar archivos y líneas involucrados. Para
verificar además la cadena completa (persistencia local, sync, contrato Supabase, dashboards), usar
la skill `verify-data-flow`.
