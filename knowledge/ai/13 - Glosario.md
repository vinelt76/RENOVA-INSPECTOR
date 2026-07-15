---
title: "Glosario RENOVA"
updated: 2026-07-14
status: vigente
sources: [WEB/movimientos, supabase/migrations/20260716100000_baseline_provenance_and_helper.sql, domain terminology]
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
- **Movimientos:** modo web antes llamado «Cambios», que prepara retiros, descartes, montajes e
  intercambios en un borrador local antes de confirmarlos como lote. La nomenclatura técnica del
  esquema se conserva: `tire_change_batches` y `confirm_tire_change_batch`; su URL canónica es
  `?mode=movimientos` y `?mode=cambios` permanece como alias de lectura.
- **Línea base:** primer registro de taller de un neumático que estaba respaldado por una medición
  de inspección. Nace al operar una posición, tras confirmación humana; no se crea por backfill.
- **Procedencia (`origin`):** marca si casco, ciclo o instalación provienen de una operación de
  taller (`workshop`) o de una línea base confirmada (`baseline`). En una instalación baseline,
  `source_measurement_id` conserva la evidencia; `installed_at` es fecha declarada, no observada.
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
