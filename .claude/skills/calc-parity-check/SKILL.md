---
name: calc-parity-check
description: Verifica la paridad Python/TypeScript del motor de cálculo. Usar siempre antes de cerrar cambios en reference/calculations.py, app/src/core/calculations.ts, fórmulas, umbrales o fixtures golden.
---

# Paridad del motor de cálculo

1. Leer `specs/reglas_negocio.md` y `decisions/0002-calc-parity.md`.
2. Ejecutar las suites existentes:

```bash
cd reference && python -m pytest test_calculations_golden.py -v
cd app && npm test -- calculations.test.ts
```

3. Confirmar que ambas implementaciones cubren los mismos inputs, casos límite y resultados para
   cada función modificada. Agregar el mismo caso golden en ambos lados cuando la cobertura falte.
4. No implementar presión CALIENTE: continúa sin especificación aprobada.

Reportar función/caso, resultado Python, resultado TypeScript y coincidencia. Una diferencia o una
suite que no pueda ejecutarse deja la tarea abierta; indicar archivos y líneas involucrados.
