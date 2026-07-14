---
title: "Decisiones e historia"
updated: 2026-07-14
status: vigente
sources: [decisions, docs/ARCHITECTURE_DECISIONS.md, tasks_opencode, tasks_cambios_neumaticos_ui/REVISION_FINAL.md, tasks_cambios_neumaticos_ui/PRUEBA_CAMPO.md]
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

## Principio para futuras decisiones

Preferir cambios que preserven hechos históricos, funcionen sin red y centralicen reglas compartidas. Una alternativa más simple en demo no es aceptable si puede perder una inspección, mezclar empresas o hacer imposible explicar después por qué apareció un estado.
