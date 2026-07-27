# ADR-0011 — Fórmulas de Rendimiento y agregación ponderada

- Fecha: 2026-07-26
- Estado: aceptada con D6 abierta

## Contexto

La comparación contra la hoja real de la unidad 225 mostró que un neumático en el umbral de retiro
aparecía con 75 % de desgaste. La hoja devuelve 100 % porque mide contra la profundidad útil:
profundidad base menos umbral de retiro.

La misma hoja promedia las tasas de cuatro neumáticos para su renglón total. Ese promedio es paridad
histórica, pero da el mismo peso a instalaciones con evidencia muy distinta. Un neumático con
0,1 mm gastados puede dominar tanto como uno con 8 mm.

## Decisión

1. Por neumático:
   - RTD gastado = OTD del ciclo − RTD actual.
   - Profundidad útil = base vigente − RTD de retiro.
   - Desgaste = RTD gastado / profundidad útil.
   - Km/mm = km acumulado del ciclo actual / RTD gastado.
   - Km proyectado = km/mm × profundidad útil.
2. D1 fija OTD como base del ciclo incluso si la instalación vigente comenzó con el casco usado.
   El kilometraje previo pertenece al ciclo, no se descarta al rotar o trasladar el neumático.
   El kilometraje de vidas/reencauches anteriores pertenece al historial y no al Rendimiento.
3. Todo conjunto, incluida una sola unidad, usa razón de sumas y ponderación por mm gastado. La
   cantidad de placas no cambia la fórmula.
4. Una última medición cuyo RTD creció respecto de la inmediatamente anterior dentro de la
   instalación no aporta métricas. La fila permanece visible con su motivo.
5. Si todo el período queda excluido, se conserva el filtro y se muestra un estado explícito; no se
   publica cero ni se salta automáticamente a otro mes.

## Alternativas descartadas

- **Promedio simple por unidad:** reproduce el total del Excel, pero sobrepondera instalaciones
  incipientes y cambia el significado del KPI al agregar otra placa.
- **Base RTD de instalación:** descartada porque reiniciaría artificialmente el span proyectado al
  rotar o trasladar el mismo ciclo. Una migración inicial que la asumía fue supersedida por una
  correctiva que conserva OTD.
- **Ocultar mediciones inconsistentes:** reduce el KPI sin explicar por qué y esconde cambios no
  registrados.
- **Inferir instalaciones desde el salto de RTD:** mezcla detección con escritura de historial; el
  registro de movimientos pertenece a una fase posterior.

## Evidencia y límites

- P3 de la 225: 12 mm gastados sobre 12 útiles = 100 %.
- P5 de la 225: 6 mm gastados sobre 12 útiles = 50 %.
- Producción después de las migraciones: 38 instalaciones activas, 0 divergencias SQL respecto del
  contrato vigente, 3 filas en umbral con 100 % y 18 instalaciones activas con RTD creciente.
- La planilla prueba filas individuales y su promedio por vehículo. No prueba agrupaciones por
  marca/diseño/flota.
- D6 (costo/km proyectado) permanece abierta. D7 decidió esperar la recarga limpia sin corregir P3
  puntualmente.

## Consecuencias

El total de una unidad puede dejar de coincidir con el renglón promedio del Excel. Es deliberado:
el panel prioriza una estimación estable basada en evidencia. Las etiquetas declaran razón de sumas,
ponderación o mediana según la naturaleza de cada métrica.
