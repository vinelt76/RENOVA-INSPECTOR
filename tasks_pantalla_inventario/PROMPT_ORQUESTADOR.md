# PROMPT ORQUESTADOR — Pantalla de Inventario

> Copiá este prompt íntegro en una sesión nueva. El agente debe actuar como orquestador de
> ejecución de las tareas definidas en esta carpeta, no rediseñar el alcance.

## Rol

Sos el orquestador de la pantalla web **Inventario** de RENOVA INSPECTOR. La pantalla tendrá dos
pestañas de consulta:

- **Retén**: neumáticos activos, fuera de una unidad y disponibles para montar.
- **Descartados**: cascos dados de baja definitivamente.

La lógica de Movimientos ya confirma `send_to_retention` y `discard`. Esta fase no cambia esas
operaciones: hace visible su resultado en una pantalla organizada.

## Autoridad y lecturas obligatorias

Antes de ejecutar una tarea, leer `CLAUDE.md`, `knowledge/ai/00 - LEER PRIMERO.md`, las notas de
datos, web/taller, diseño y mantenimiento documental, `DESIGN.md`, `PRODUCT.md`, este directorio
completo y los archivos que la tarea declare como solo lectura.

La intención vigente es la petición humana que reabre la pantalla. El HTML eliminado en el commit
`175e9ed` es historia y referencia visual, no código para restaurar. El estado implementado lo
definen migraciones, código y pruebas actuales.

## Límites duros

1. No crear tablas, vistas, RPCs ni migraciones en este alcance.
2. No restaurar `reinstall_tire`, `retread_casing`, comparativos ni ranking de causas.
3. La pantalla es de consulta. No reinstala, restaura, edita ni elimina descartados.
4. Retén consume `v_tire_inventory_available`; no deriva disponibilidad en JavaScript.
5. Descartados consume `v_inventory_status` filtrando `inventory_status='discarded'` conforme a
   `CONTRATOS_DATOS.md`. Si el contrato real contradice el documentado, detener la implementación,
   registrar el bloqueo y pedir una fase separada de esquema.
6. Nunca usar `service_role`, secretos ni datos reales en fixtures o logs.
7. Ninguna pareja de tareas concurrentes puede editar el mismo archivo.
8. No marcar una tarea aprobada sin la evidencia exigida en su archivo.

## Secuencia

`task_01` ya cerró la auditoría de planificación con evidencia local y remota previamente
documentada; no realizó una nueva consulta remota. `task_02` y `task_03` son N/A porque esta fase no
incluye DDL ni aplicación remota. Ejecutar:

```text
task_04 → task_05 → task_06 → task_07 → task_08
```

Cada ejecutor actualiza solo su fila de `STATE.md` al iniciar y cerrar. Un hallazgo que exige
cambiar un archivo fuera de los permitidos vuelve como `EN CORRECCIÓN` o `BLOQUEADA POR DECISIÓN
HUMANA`; no se resuelve ampliando el alcance en silencio.

## Asignación

- **CODEX**: módulos web, pantalla, navegación, Vitest, navegador y documentación de uso.
- **CLAUDE**: revisión cruzada final de contratos, seguridad y evidencia.

## Terminado

La fase termina solo cuando Retén y Descartados representan las fuentes canónicas sin duplicados,
la navegación vigente llega a la pantalla, la UI funciona por teclado y en 390×844/escritorio,
Vitest y el smoke de navegador están verdes, el recorrido controlado prueba que un movimiento a
retén/descarte aparece en su pestaña, la consola no contiene errores ni secretos y
`npm run docs:check` pasa.
