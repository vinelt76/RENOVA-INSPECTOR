# task_03 — Aplicación remota y pruebas SQL

## 1. Propietario y estado

**CLAUDE. N/A.**

## 2. Evaluación

No existe una migración de `task_02`; por tanto no hay DDL que revisar, aplicar o revertir. Esta
fase no autoriza cambios remotos.

## 3. Restricción explícita

Ningún ejecutor debe llamar herramientas de aplicación de migraciones, ejecutar DDL/DML, cambiar
grants/RLS ni “sincronizar” el DDL remoto faltante bajo esta tarea.

Las lecturas autenticadas necesarias para `task_07` son pruebas de la pantalla, no aplicación de
esquema. Cualquier escritura del smoke ocurre únicamente a través del flujo de Movimientos ya
aprobado, con unidad QA y autorización humana específica.

## 4. Dependencias y archivos

Dependería de `task_02`, que es N/A. No posee archivos.

## 5. Criterio de aceptación

Fila 03 de `STATE.md` en N/A y evidencia final de que no cambió `supabase/` ni el historial de
migraciones.

## 6. Rollback y handoff

N/A. Si se requiere un cambio remoto, detener esta fase y crear otra planificación con migración,
pruebas SQL autorreversibles, advisors, aprobación y rollback.
