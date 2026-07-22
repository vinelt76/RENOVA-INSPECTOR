# Inventario de deuda técnica

Estado: **ACTIVO**. Última consolidación: 2026-07-20.

Este es el backlog operativo completo conocido al momento de crear el
directorio. No autoriza cambios de esquema, datos ni producción por sí solo:
cada ítem debe abrir su propia fase, con dueño, migración/pruebas y aprobación
cuando corresponda.

## Prioridad 0 — datos, seguridad e integridad

| Deuda | Acción para cerrarla | Dependencia / condición |
|---|---|---|
| Datos `QA-TEST` en producción (`QA-CN16`, 9 cascos y 14 mediciones) | Decidir si se conserva aislado, migra a pruebas o se elimina con respaldo y auditoría | Decisión humana explícita; nunca borrado de oficio |
| Variantes de `brand_name` | Normalizar escritura con `upper(trim())` y ejecutar backfill auditable | Resolver antes de métricas/agregados representativos |
| Cascos sin código sin historial navegable | Diseñar una fase de identidad persistente del casco | No inventar identidad desde una consulta o URL |
| Mediciones sin `life_cycle_id` | Mejorar la cadencia/enlace de ciclos y completar línea base | No ofrecer consumo por ventana hasta tener cobertura útil |
| App de inspecciones como `anon` | Definir identidad de inspector, autorización y sesión offline | Decisión de producto/seguridad sobre login offline |
| Grant amplio de `v_rendimiento_dashboard_rows` | Auditar acceso `anon`, RLS y consumidores; migración de seguridad separada | No ocultarlo dentro de una fase funcional |
| Ejecuciones de movimientos sin reconciliar | Reconciliar `tire_movement_executions` contra casco/ciclo/instalación | Después de importar la línea base por empresa |
| Creación del ciclo siguiente tras reencauche | Definir y construir el flujo de ciclo posterior al retiro | Regla de negocio y RPC actuales no lo cubren |
| Convención horaria de servicios | Registrar `America/Lima` como convención del proyecto, no solo de una vista | D11 ya fue decidida; falta llevarla a knowledge al cerrar Servicios |

## Prioridad 1 — calidad operativa y verificaciones de campo

| Deuda | Acción para cerrarla | Dependencia / condición |
|---|---|---|
| Smoke autenticado de Inventario | Probar flujo real y aislamiento entre dos empresas | Cuentas/datos de prueba controlados |
| Smoke autenticado de filtros | Validar móvil y escritorio, teclado y aislamiento visual A/B | Las pruebas locales no sustituyen el campo |
| Fase 2 de Cambios de neumáticos | Smoke real con sesión, lote mixto, reintento, conflicto y recarga; foto real en Storage; posiciones vacías/provisionales y pruebas de UI | Usar unidad/usuario de prueba controlados y limpiar su evidencia según el contrato |
| Cuentas reales `tire_supervisor` | Crear/provisionar por empresa y verificar emisión/seguimiento | Definición de administración y acceso |
| Criterio de producto listo para taller/rutas | Acordar criterios operativos y evidencia de cierre | Decisión humana de aceptación |
| Presión CALIENTE | Definir la regla de negocio canónica | No implementar ni inferir valores antes |
| `% DESGASTE` | Definir fórmula canónica y actualizar implementaciones/documentación | Decisión de negocio |
| Umbral de frescura de Rendimiento fijo en 30 días | Llevarlo a configuración por empresa | No repartir constantes por componentes |

## Prioridad 2 — esquema, rendimiento y sincronización

| Deuda | Acción para cerrarla | Dependencia / condición |
|---|---|---|
| Rendimiento de Supabase | Saneamiento, perfilado y solo entonces índices medidos | Ver [01-saneamiento-y-performance-supabase.md](01-saneamiento-y-performance-supabase.md) |
| Esquema de Rendimiento fuera de la cadena local | Reconstruir migraciones fieles para `v_tire_performance` y `last_inspection_on` | Contrastar contra remoto; no adivinar el DDL |
| Cadena de migraciones no autocontenida | Versionar `fn_effective_rtd_thresholds` para que `supabase db reset` funcione desde cero | La función existe en remoto, pero falta su `CREATE FUNCTION` local |
| Sin prueba SQL contra deriva de estados de neumático | Añadir prueba que compare `tire_status` entre las vistas que intencionalmente duplican lógica | Evitar que una futura modificación de umbrales las separe |
| Rollback no simétrico de vistas con columnas agregadas | Documentar/automatizar rollback mediante `DROP VIEW` + recreación de `GRANT` y `COMMENT` | `CREATE OR REPLACE VIEW` no puede retirar columnas |
| `drainQueue` sin despertar autónomo al vencer backoff | Programar/reanudar el drenaje de cola de forma segura | Preservar offline-first y reintentos idempotentes |
| Precarga que reencola datos espejo | Evitar push redundante tras pull, sin borrar trabajo local | Pruebas de concurrencia y de cola durable |
| `rtd_removal_mm` mapeado a `rtd_normal` | Separar correctamente ambos conceptos en snapshot/vistas | Revisar impacto de datos legacy |
| Backfill de `isa_peso_snap` incompleto | Definir tratamiento de filas legacy sin RTD | No inventar el dato faltante |
| `umbral_presion` local sin participar del flujo | Integrarlo o retirarlo con una decisión explícita | Depende de la regla de presión |
| Pull, versionado y borrado de catálogos incompletos | Diseñar sincronización/versionado y eliminación segura | No romper dispositivos offline |
| Sin `manualChunks` en Vite | Medir bundle y dividir solo donde aporte | Pendiente de task 18 |

## Prioridad 3 — mantenibilidad web y despliegue

| Deuda | Acción para cerrarla | Dependencia / condición |
|---|---|---|
| Navegación duplicada en los HTML del dashboard | Extraer una fuente compartida sin romper navegación/atajos | Smoke de todas las pantallas |
| Allowlist incompleta del bundle estático | Incluir `renova-animate.js` y `renova-format.js` y probar el bundle | Mantener la lista de assets explícita |
| Documentos históricos/`STATE` vencidos | Corregir mediante notas de auditoría, sin reescribir historia | Conservar trazabilidad |
| Acciones históricas de Inventario retiradas | Evitar que reaparezcan sin una decisión y contrato nuevo | Mantener consulta Retén/Descartados |

## Trabajo planificado, no clasificado como deuda

La sección Servicios (`tasks_servicios/`) está totalmente planificada pero aún no ejecutada:
`v_tire_services`, pruebas SQL, aplicación remota, pantalla y smoke. Se mantiene fuera de las
deudas para no confundir una capacidad futura con un defecto del sistema actual. Cuando la fase se
implemente, sus limitaciones reales se incorporarán arriba si permanecen abiertas.

## Fuentes de consolidación

- `knowledge/ai/10 - Roadmap deuda y riesgos.md` — fuente canónica previa y resumen de estado.
- `tasks_buscador_global/REVISION_FINAL.md` — deuda de datos y bundle.
- `tasks_filtros_facetados/REVISION_FINAL.md` — deuda de rendimiento y pruebas de campo.
- `tasks_puesta_en_marcha_movimientos/REVISION_FINAL.md` — línea base e identidad.
- `tasks_opencode/STATE.md` — cola, sincronización y bundle móvil.

Si aparece nueva deuda, agregarla aquí con su condición de cierre y enlazar la evidencia primaria.
