---
title: "Glosario RENOVA"
updated: 2026-07-12
status: vigente
sources: [specs, docs/run2_tire_lifecycle_architecture.md, domain terminology]
---

# Glosario

- **RTD/remanente:** profundidad restante de la banda, en milímetros.
- **RTD MOVI:** menor canal medido; valor conservador usado para estado.
- **IDI:** diferencia entre canal mayor y menor; indica desgaste irregular.
- **VUR:** vida útil remanente proyectada en kilómetros.
- **ISA:** índice/peso de severidad de anomalías.
- **Desecho:** neumático/casco no recuperable según anomalía o evento.
- **Casco:** estructura física permanente identificada por código.
- **Ciclo:** una vida de banda: nueva o reencauchada.
- **Instalación:** período de un ciclo montado en unidad/posición.
- **Retiro:** evento que cierra una instalación.
- **Condición N/R1/R2:** banda nueva o número de reencauche.
- **Posición:** lugar numerado del neumático en la configuración.
- **Configuración 2-4-2:** distribución de ruedas/ejes de una unidad.
- **Snapshot:** copia del umbral usado al calcular una medición histórica.
- **Offline-first:** guardar primero de forma durable en el dispositivo.
- **Sync queue:** cola local de trabajos pendientes de confirmar en nube.
- **RPC:** función de base invocada como una operación API.
- **RLS:** reglas de Postgres que limitan filas por usuario/empresa.
- **Realtime:** notificación de cambios de tablas hacia dashboards.
- **LWW:** last-write-wins; resolución por `updated_at` donde aplica.

