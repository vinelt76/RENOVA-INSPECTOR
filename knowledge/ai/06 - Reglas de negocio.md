---
title: "Reglas de negocio"
updated: 2026-07-26
status: vigente
sources: [specs/reglas_negocio.md, specs/reglas_fijas_vs_configurables.md, reference/calculations.py, app/src/core/calculations.ts, decisions/0009-regla-de-presion-por-rangos.md]
---

# Reglas de negocio

> [!CAUTION]
> Esto es un mapa. La autoridad literal es `specs/reglas_negocio.md`. No cambiar fórmulas leyendo solo esta nota.

## Captura

- `RTD MOVI = MIN(canales medidos)`. Tres canales en Dirección/Tracción; cuatro donde la posición exige R4. El código actual acepta R4 opcional y lo incluye si existe.
- Estado RTD es secuencial: `<= cambio` -> Para Reencauche; `<= próximo` -> Próximo; resto -> Normal.
- `IDI = MAX - MIN` de los mismos canales.
- Anomalía con `desecho=true` marca desecho automático.
- Presión FRÍO usa **rangos absolutos mín–máx por medida y tipo de eje** (ADR-0009, 2026-07-25),
  no referencia ± porcentajes: 100–125 PSI en todo, salvo 315/80R22.5 Direccional que va 105–125.
  Extremos inclusivos. Viven en `pressure_thresholds`; resuelve `fn_effective_pressure_thresholds`.
  CALIENTE no se implementa y `fn_pressure_state` devuelve NULL ante `'HOT'` en vez de clasificar.
- Los valores 4/7/8 son fallback histórico, no regla universal.

## Rendimiento

- Instalación conserva `km` y `RTD` iniciales como hechos del montaje.
- Retiro cierra el intervalo; si falta odómetro usa la última inspección o `NULL`, nunca inventa cero.
- Profundidad útil: OTD del ciclo menos umbral de retiro (D1); el desgaste usa
  `RTD gastado / profundidad útil`, por lo que un neumático en el umbral marca 100 %.
- Rendimiento usa kilómetros y desgaste acumulados de la vida/ciclo actual. Una rotación o traslado
  no los reinicia; un nuevo reencauche sí. El total de todas las vidas solo aparece en Historial.
- Km/mm se agrega siempre como `Σ km / Σ mm`, incluso dentro de una unidad. Km proyectado se
  pondera por mm gastado; la cantidad de placas no cambia la estadística.
- Una última medición con RTD creciente no aporta a ningún KPI y se declara con su motivo.
- VUR: `(RTD actual - RTD cambio) / tasa * 1000`; cero al requerir cambio, `NULL` sin tasa válida.
- Km de ciclo y km de vida del casco son métricas distintas.
- Derivados agregados viven en vistas SQL; hechos capturados viven en tablas.

## Fijo y configurable

| Fijo | Configurable |
|---|---|
| Forma de RTD MOVI/IDI/VUR | Umbrales RTD por empresa y medida |
| Orden secuencial del estado | Presión por empresa/medida/eje |
| UUID en dispositivo | Pesos ISA |
| Desecho deriva del catálogo | Balance de eje, retiro recomendado |
| Historia no se pisa | Empresas, catálogos, configuraciones |

## Paridad

`reference/calculations.py` y `app/src/core/calculations.ts` deben producir el mismo resultado sobre fixtures golden. En servidor, cualquier fórmula equivalente necesita prueba de paridad antes de retirar el fallback del frontend.

## Preguntas abiertas

- Referencia de presión CALIENTE. **Deuda genuina, no decisión postergada** (2026-07-25): las
  empresas que miden siempre en caliente son agencias de las que todavía no hay data. Acotada:
  `inspection_measurements.temperature_mode` tiene default `'COLD'` y las 2 247 filas previas
  quedaron backfilleadas, así que cuando llegue esa data no hay que adivinar el pasado.
- Completitud del kilometraje acumulado del ciclo cuando algún tramo carece de odómetro.
- Política/versionado completo del catálogo.
- Máximo de reencauches por empresa/casco si se exige como regla.
