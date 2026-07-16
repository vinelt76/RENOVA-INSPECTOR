# task_01 — Auditoría y contrato de datos

## 1. Propietario y estado

**CLAUDE. APROBADO.** Tarea de planificación cerrada el 2026-07-15.

## 2. Objetivo y resultado observable

Determinar si la pantalla puede construirse con contratos existentes, registrar riesgos y congelar
la forma mínima consumible. Resultado: `AUDIT.md`, `DECISIONES.md` y `CONTRATOS_DATOS.md`.

## 3. Dependencias y bloqueos

Sin dependencias. Desbloquea `task_04`. `task_02` y `task_03` se evaluaron y quedaron N/A.

## 4. Evidencia usada

- Migración local que define `v_tire_inventory_available`.
- Contratos y pruebas de `tasks_cambios_neumaticos/`.
- Implementación/pruebas de `WEB/movimientos/`.
- Knowledge vigente y Git, incluido el retiro histórico de `inventario.html`.
- Auditorías remotas previamente documentadas por fases anteriores.

No se realizó una consulta remota nueva. No se presentan conteos actuales ni se afirma que el
estado productivo no haya cambiado desde esas auditorías.

## 5. Archivos permitidos/exclusivos

Solo los documentos iniciales de `tasks_pantalla_inventario/`. Ningún archivo de producción.

## 6. Decisiones

- Reusar `v_tire_inventory_available` para Retén.
- Consumir `v_inventory_status` para Descartados como precondición documentada.
- No migrar ni aplicar cambios remotos.
- Pantalla de consulta con alcance menor que el HTML histórico.

## 7. Invariantes

No inventar esquema; no ocultar la deriva de DDL; no confundir evidencia remota histórica con una
consulta actual; no autorizar acciones de escritura.

## 8. Criterios de aceptación

- Contratos con columnas, nullabilidad, seguridad y errores.
- Riesgo de `v_inventory_status` explícito.
- Alcance y exclusiones inequívocos.
- Grafo sin archivos compartidos en paralelo.

## 9. Pruebas/evidencia

Lectura de archivos, búsquedas con `rg`, inspección de Git y contraste con knowledge. No aplica
Vitest, navegador ni SQL remoto.

## 10. Rollback

N/A: documentación nueva, sin cambios funcionales.

## 11. Handoff

Fila 01 de `STATE.md` en `APROBADO`, indicando “sin consulta remota nueva”. `task_04` debe validar
la primera respuesta autenticada antes de considerar estable el adaptador de Descartados.
