---
title: "Reglas de negocio"
updated: 2026-07-12
status: vigente
sources: [specs/reglas_negocio.md, specs/reglas_fijas_vs_configurables.md, reference/calculations.py, app/src/core/calculations.ts]
---

# Reglas de negocio

> [!CAUTION]
> Esto es un mapa. La autoridad literal es `specs/reglas_negocio.md`. No cambiar fórmulas leyendo solo esta nota.

## Captura

- `RTD MOVI = MIN(canales medidos)`. Tres canales en Dirección/Tracción; cuatro donde la posición exige R4. El código actual acepta R4 opcional y lo incluye si existe.
- Estado RTD es secuencial: `<= cambio` -> Para Reencauche; `<= próximo` -> Próximo; resto -> Normal.
- `IDI = MAX - MIN` de los mismos canales.
- Anomalía con `desecho=true` marca desecho automático.
- Presión FRÍO compara contra referencia y deltas configurables. CALIENTE no se implementa.
- Los valores 4/7/8 son fallback histórico, no regla universal.

## Rendimiento

- Instalación define `km` y `RTD` iniciales.
- Retiro cierra el intervalo; si falta odómetro usa la última inspección o `NULL`, nunca inventa cero.
- Tasa de desgaste: consumo de mm por distancia.
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

- Referencia de presión CALIENTE.
- Fórmula definitiva de `% DESGASTE` donde el Excel y las vistas difieren.
- Política/versionado completo del catálogo.
- Máximo de reencauches por empresa/casco si se exige como regla.

