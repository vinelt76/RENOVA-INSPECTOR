---
title: "Roadmap, deuda y riesgos"
updated: 2026-07-12
status: vigente
sources: [tasks_opencode/STATE.md, specs, decisions, docs/run6_known_limits.md, code audit 2026-07-12]
---

# Roadmap, deuda y riesgos

## Prioridad inmediata

1. Validar E2E las migraciones/UI del 12 de julio: taller, rutas y comparativo.
2. Cerrar el paquete de calidad de task 18: probar `pushInspeccion` directamente, decidir/implementar partición de bundles y verificar build.
3. Corregir la documentación histórica solo mediante notas de auditoría; no reescribir la bitácora como si nunca hubiera existido.
4. Probar APK en dispositivo real: SQLite nativo, cámara, pérdida/recuperación de red y cierre del día.

## Deuda activa conocida

- La app móvil opera como `anon`, sin identidad de inspector.
- `drainQueue` no agenda un despertar autónomo al vencer backoff.
- Precargar desde Supabase reencola datos espejo y puede hacer un push redundante.
- `rtd_removal_mm` se mapea al snapshot `rtd_normal`, conceptos distintos aunque hoy no afecte vistas.
- Backfill de `isa_peso_snap` omite algunas filas legacy sin RTD.
- `umbral_presion` local existe pero no participa del flujo.
- Pull/versionado/borrado de catálogos no está completo.
- `vite.config.ts` no tiene `manualChunks`; el punto de task 18 sigue abierto.
- Hay documentos run/STATE con afirmaciones vencidas.

## Decisiones bloqueantes

- Regla de presión CALIENTE.
- Definición canónica de `% DESGASTE`.
- Estrategia final de login/sesión offline para inspectores.
- Versionado y eliminación segura de catálogo.
- Criterio de “producto listo” para taller/rutas, más allá de que exista SQL/UI.

## Evolución prevista

- Consola administrativa de empresas, perfiles, umbrales y catálogos.
- Reporte Excel canónico generado desde datos/vistas de servidor.
- Imports auditables por lote con errores por fila.
- Más tipos/configuraciones de vehículo tras validar buses.
- Analytics sobre series de casco/ciclo/instalación sin alterar tablas de hechos.
- Materialized views solo si las vistas se vuelven lentas y la medición lo justifica.

## Riesgos que ameritan test

- Borrado local sin confirmación remota.
- Dos ediciones mientras hay push en vuelo.
- Mezcla de empresas por grants/RLS/vistas sin `security_invoker`.
- Fórmulas distintas entre app, SQL y HTML.
- Operación de taller que deja intervalos abiertos o dos neumáticos en una posición.
- Datos legacy sin cola/snapshots.

