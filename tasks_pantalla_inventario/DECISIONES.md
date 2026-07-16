# DECISIONES — Pantalla de Inventario

Fecha: 2026-07-15.

No hay decisiones humanas bloqueantes pendientes para empezar. La petición actual resuelve el
cambio principal de negocio.

| ID | Decisión | Estado | Consecuencia |
|---|---|---|---|
| D1 | Reabrir una pantalla web de Inventario. | RESUELTA por el humano | Reemplaza la decisión que eliminó el HTML anterior. |
| D2 | Dos pestañas: **Retén** y **Descartados**. | RESUELTA por el humano | No hay una tercera pestaña de instalados. |
| D3 | Alcance de consulta, sin acciones. | RESUELTA por análisis de alcance | No se restauran RPCs ni flujos eliminados. |
| D4 | Retén usa `v_tire_inventory_available`. | RESUELTA por contrato vigente | La disponibilidad no se recalcula en JS. |
| D5 | Descartados usa `v_inventory_status` filtrado. | RESUELTA con precondición | Si el remoto contradice el contrato, se bloquea y se abre otra fase. |
| D6 | Sin migración ni aplicación remota en esta fase. | RESUELTA por el orquestador | `task_02` y `task_03` quedan N/A. |
| D7 | Descartado es estado final de solo lectura. | RESUELTA por modelo vigente | No hay restaurar, eliminar ni editar. |
| D8 | La pantalla no muestra fotos privadas en el MVP. | RESUELTA por mínimo alcance y seguridad | Puede mostrar que existe evidencia y enlazar historial; no firma URLs. |
| D9 | Navegación visible desde las superficies web vigentes. | RESUELTA por coherencia de producto | Una tarea única edita todos los enlaces. |
| D10 | El recorrido de escritura usa solo una unidad QA acordada. | RESUELTA por convención previa | Requiere autorización explícita antes de confirmar datos remotos y limpieza documentada. |

Una futura petición de reinstalación, firma de fotos, exportación, ranking o recuperación de
descartados debe abrir una fase separada con contratos y permisos propios.
