# REVISIÓN FINAL — Paridad de Rendimiento

Fecha: **2026-07-26**.

## Veredicto

**Implementación aprobada en el alcance decidido; fase cerrada con pendientes explícitos.**

Las tareas 01–08 están resueltas. En `task_06`, D7 decidió esperar la depuración/recarga limpia y no
alterar puntualmente la 225 P3. D6 mantiene Costo/Km con la definición realizada y D9 no bloquea.

## Entregado

- Desgaste sobre profundidad útil: `OTD − RTD retiro`; 100 % exactamente en el umbral.
- D1 cubierta con pruebas de casco montado usado: OTD pertenece al ciclo.
- Rendimiento basado en kilómetros y desgaste de la vida actual; el total de todas las vidas queda
  reservado para Historial de neumático.
- Razón de sumas y ponderación por mm en cualquier conjunto, incluida una sola unidad.
- Detección de RTD creciente contra la inspección anterior dentro de la instalación.
- Exclusión declarada, motivos visibles y estado explícito cuando todo el período es inconsistente.
- Paridad SQL/JS del alcance vigente, migraciones aplicadas sin borrar historial.
- ADR-0011, specs, knowledge, documento de lógica y bitácora actualizados.

## Evidencia

- `npm run verify`: **411 pruebas**, lint, docs y dos builds en verde.
- Smoke escritorio/móvil con recarga estable, sin overflow ni errores.
- Producción: 38 filas, 19 tasas de ciclo calculables, 0 diferencias de tasa/consumo/proyección,
  18 RTD crecientes y 3 filas en umbral con 100 %.
- Seguridad de la vista: `security_invoker=true`, lectura autenticada, sin lectura anónima.

Detalle reproducible en `PRUEBA_CAMPO.md`.

## Pendientes reales

1. D6: confirmar costo/km realizado frente a proyectado.
2. Ejecutar validación humana autenticada después de la recarga limpia.

`auditoria_lunes/TRASPASO.md` no existe; se dejó constancia en vez de fabricar una actualización.
