---
title: "Decisiones e historia"
updated: 2026-07-21
status: vigente
sources: [decisions, docs/ARCHITECTURE_DECISIONS.md, tasks_opencode, tasks_cambios_neumaticos_ui/REVISION_FINAL.md, tasks_cambios_neumaticos_ui/PRUEBA_CAMPO.md, tasks_buscador_global/DECISIONES.md, tasks_buscador_global/REVISION_FINAL.md, tasks_filtros_facetados/REVISION_FINAL.md, tasks_servicios/DECISIONES.md, tasks_servicios/REVISION_FINAL.md]
---

# Decisiones e historia

## Decisiones vigentes

- React + Vite + TypeScript + Capacitor, Android primero.
- Offline-first con SQLite y UUID generados en dispositivo.
- Supabase como verdad consolidada, row-level tenancy por `company_id`.
- Paridad de cálculos entre referencia Python, TypeScript y SQL cuando corresponda.
- Catálogos y umbrales en datos, no componentes.
- Casco/ciclo/instalación/inspección como entidades separadas.
- Derivados agregados en vistas; hechos en tablas.
- RPC transaccional para operaciones multi-paso.

## Historia que no debe confundirse con vigencia

Hubo un enfoque previo con Flutter + FastAPI + Railway, reemplazado por el stack actual. `tasks_opencode/` refleja un flujo anterior entre agentes y estados en el momento de cada lote; no es un tablero vivo confiable sin auditarlo contra el repo.

El 2026-07-14 quedó cerrada una decisión operativa para probar Cambios de neumáticos sin ensuciar la
flota real: usar una unidad dedicada `QA-CN16` con neumáticos `QA-TEST`, incluida una posición vacía,
una identidad intencionalmente inconsistente y un neumático disponible en inventario. Esa guía de
prueba vive en `tasks_cambios_neumaticos_ui/PRUEBA_CAMPO.md` y sirve como runbook reproducible para
smokes reales del modo taller.

## ADRs

- ADR 0001: tenancy row-level.
- ADR 0002: golden tests de paridad.
- ADR 0003: sesión offline; la dirección sigue vigente, pero la app móvil todavía no completa Auth.
- ADR 0004: versionado de catálogo; protocolo deseado, implementación parcial.
- ADR 0005: buscador global — primer ADR de UI del proyecto. Dos objetos navegables (Unidad,
  Neumático), índice `v_search_index` cacheado en cliente por sesión, sin parsing silencioso de
  prosa a filtros, el buscador enruta y no ejecuta. Descarta la Command Palette como interacción
  principal. Detalle completo en `tasks_buscador_global/DECISIONES.md` y
  `tasks_buscador_global/REVISION_FINAL.md`.
- ADR 0006: filtros facetados — el buscador enruta y el filtro reduce; Rendimiento agrega sobre el
  conjunto filtrado e Inspecciones lista neumáticos; OR dentro/AND entre facetas; frescura distinta
  de ventana temporal y exclusiones visibles. La ventana quedó sin entregar por cobertura real
  insuficiente. Detalle en `tasks_filtros_facetados/REVISION_FINAL.md`.
- ADR 0007: definición de servicio ejecutado — **un servicio es una salida** (`direction='exit'`),
  no una orden ni un renglón, así que una rotación cuenta una vez y no dos. `installation` es tipo
  sintético de la vista porque la constraint impide llevarlo al enum. El pareo de rotación es
  estructural (`sequence - 1` sobre `request_items`), nunca textual, con `rotation_pairing` visible
  como contrato de honestidad cuando la atribución degrada. Servicios **no** es un objeto navegable:
  aplica el límite de ADR-0005 y enruta a Unidad y Neumático. Fija además la convención de zona
  horaria del proyecto (`America/Lima`). Limitación aceptada: los servicios no están reconciliados
  contra cascos. Detalle en `tasks_servicios/DECISIONES.md` y `tasks_servicios/REVISION_FINAL.md`.

## Principio para futuras decisiones

Preferir cambios que preserven hechos históricos, funcionen sin red y centralicen reglas compartidas. Una alternativa más simple en demo no es aceptable si puede perder una inspección, mezclar empresas o hacer imposible explicar después por qué apareció un estado.
