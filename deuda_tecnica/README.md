# Deuda técnica — ejecución posterior al saneamiento de datos

Este directorio ordena toda la deuda técnica activa. Su primer bloque **no debe
ejecutarse sobre el dataset productivo actual**, porque todavía mezcla datos
operativos con datos de prueba y conserva deuda de identidad/normalización.

No es una fuente de verdad nueva: el estado canónico sigue en
`knowledge/ai/10 - Roadmap deuda y riesgos.md`. Esta carpeta transforma esa
deuda en fases ejecutables, con condiciones de entrada, salida y verificación.

## Inventario y orden de ejecución

1. [Inventario completo y prioridades](00-inventario.md).
2. [Saneamiento de datos y rendimiento de Supabase](01-saneamiento-y-performance-supabase.md).
3. Reperfilar las consultas reales con datos ya saneados.
4. Aplicar únicamente los índices que el plan de ejecución justifique.

## Regla de seguridad

No se crea ni aplica un índice de rendimiento por intuición. Antes de cada
migración se debe medir con datos saneados, revisar el `EXPLAIN (ANALYZE,
BUFFERS)` de la consulta consumida por la pantalla y confirmar que el costo de
escritura del índice es aceptable.

Los índices únicos que preservan integridad (por ejemplo, una instalación activa
por posición) no pertenecen a esta postergación: son reglas de consistencia y
ya forman parte del esquema.
