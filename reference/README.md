# reference/ — Implementación de referencia del motor de cálculo

Material **fundacional**, conservado del backend Python anterior. **No se ejecuta como parte de
la app** (la app es React/TS). Sirve como fuente de verdad ejecutable para portar la lógica a
`app/src/core/calculations.ts` con paridad exacta.

- `calculations.py` — funciones puras: `calcular_rtd_movi`, `calcular_idi`, `calcular_estado_rtd`,
  `calcular_estado_presion`, `calcular_vur`, `calcular_tasa_desgaste`. La fuente de verdad de la
  lógica es `specs/reglas_negocio.md`; este archivo la implementa.
- `test_calculations_golden.py` — golden test contra el Excel real (el import `app.core...` quedó
  obsoleto tras el reset; se conserva como referencia del contrato de tests, a re-portar en TS).

> Al portar a TypeScript: misma firma, mismos casos borde (RTD negativo → error, VUR con tasa
> 0/NULL/negativa → null, if/elif **secuencial** en estado RTD). Ver `decisions/0002-calc-parity.md`.

## `catalogo_patron.json` — seed real del catálogo PATRON

Datos reales extraídos del Excel (1427 líneas): `tapas_valvula` (24), `anomalia_neumatico` (67,
con `posible_causa` y `desecho`; 13 en TRUE), `configuracion_vehiculo` (18, con `posiciones` y
flag `mvp`; solo BUS 2-4 y 2-4-2 son `mvp=true`), `condicion`. **Es la fuente autoritativa** del
catálogo para el seed de SQLite (`app/`), por encima de las listas cortas de los prototipos.
No incluye marcas/modelos/medidas (esos crecen vía REPORTE — aún sin seed real).

## `seed_unidades_demo.json` — rebanada REAL de unidades para el seed de demo

Extraído de `docs/excels/movil_bus__BD.xlsx` (hoja `BD_INSPECCIÓN`): 12 buses reales (config
2-4-2) de Móvil Bus, Cruz del Sur e ITTSABUS, cada uno con su última inspección real (posiciones,
código, marca/diseño, RTD A–D, presión, válvula, anomalías y los umbrales embebidos por fila).
Es **solo una rebanada** para que la UI cargue con datos reales — NO la carga completa (las 43k
filas se importan en una fase de importador/ETL posterior, que también resolverá placas vs número
y la presión CALIENTE).

