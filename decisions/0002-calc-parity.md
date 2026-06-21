# ADR-0002: Paridad de Cálculo Python/Dart — Golden Test Obligatorio

## Decisión

La lógica de cálculo (RTD MOVI, ESTADO RTD, ESTADO PRESIÓN, IDI, VUR) existe en **dos
implementaciones**: Python en el backend (para persistencia y reportes) y Dart en el cliente
(para el semáforo en tiempo real, offline). Ambas implementaciones deben pasar el mismo
**golden test** contra el Excel real antes de que cualquier feature use esos cálculos.

## Por qué dos implementaciones son inevitables

- El semáforo en tiempo real debe funcionar sin red (el inspector está en campo, offline).
  Esto requiere la lógica en el cliente (Dart).
- El backend necesita la misma lógica para validar los datos al sync, generar el Excel,
  y calcular métricas agregadas en queries SQL.
- No hay alternativa que evite la duplicación sin sacrificar el offline-first.

## Golden Test — qué es y dónde vive

**Archivo:** `backend/tests/test_calculations_golden.py`
**Fixtures:** `backend/tests/fixtures/real_sample.xlsx` — slice del Excel real de RENOVA
  con columnas originales (RTD A/B/C/D, PRESIÓN, TEMPERATURA, MEDIDA, TIPO EJE) y sus
  valores calculados ya conocidos (RTD MOVI, ESTADO RTD, ESTADO PRESIÓN, IDI).

El test:
1. Carga el slice del Excel real.
2. Ejecuta las funciones Python: `calcular_rtd_movi()`, `calcular_estado_rtd()`,
   `calcular_estado_presion()`, `calcular_idi()`.
3. Compara cada output con el valor ya calculado en el Excel (fuente de verdad).
4. Falla si hay una sola discrepancia.

**Companion test Flutter:** `mobile/test/golden_test.dart` — mismo fixture en JSON,
mismas aserciones, contra las funciones Dart equivalentes.

## Regla operativa

- El golden test es el **primer artefacto** de Sprint 1. Antes de escribir endpoints.
- Cualquier cambio en `calcular_*` en Python requiere actualizar el Dart equivalente
  y pasar ambos tests. Una implementación sin la otra es un bug abierto.
- Al agregar un nuevo tipo de eje o nueva medida, agregar casos al fixture.

## Responsabilidad del fixture

RENOVA provee un slice representativo del Excel real (mínimo 50 filas, cubriendo al menos:
un neumático de 3 canales, uno de 4 canales, presión normal/alta/baja, RTD en los 3 estados,
IDI en los 3 rangos). El equipo técnico NO inventa datos de prueba.
