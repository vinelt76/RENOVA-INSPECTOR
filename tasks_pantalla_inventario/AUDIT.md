# AUDIT — Pantalla de Inventario

Fecha: 2026-07-15. Alcance: auditoría de planificación, sin ediciones de producción, DDL, DML ni
consultas remotas nuevas.

## 1. Resultado ejecutivo

La pantalla se puede construir como frontend de consulta sobre contratos ya existentes. Retén
tiene una vista local, versionada y probada. Descartados puede leerse desde la vista histórica
`v_inventory_status`, cuyo contrato remoto fue auditado y documentado en fases anteriores, aunque
su DDL continúa sin estar versionado en las migraciones locales. Por decisión de alcance, esta fase
no corrige esa deriva: la trata como precondición verificable y se detiene si el remoto no coincide.

No se realizó una nueva consulta al proyecto Supabase durante esta auditoría. La evidencia remota
citada proviene de `tasks_cambios_neumaticos/AUDIT.md`, `BASELINE_REMOTO.md`, `STATE.md` y
`REVISION_FINAL.md`, generados por las fases que sí inspeccionaron el proyecto.

## 2. Convención de coordinación

El repositorio usa carpetas raíz `tasks_*` autocontenidas con `AUDIT.md`, `PLAN.md`,
`DECISIONES.md`, `STATE.md`, tareas numeradas y revisión final. Ejemplos vigentes:
`tasks_cambios_neumaticos_ui/` y `tasks_puesta_en_marcha_movimientos/`.

El nombre `tasks_pantalla_inventario/` evita confundir la fase con el cajón para elegir un montaje
que ya vive en `WEB/movimientos/inventory-ui.js`.

## 3. Decisión de negocio reabierta

`WEB/inventario.html` fue eliminado intencionalmente en el commit `175e9ed`. Las notas vigentes
`knowledge/ai/07 - Web dashboards y taller.md` y `knowledge/ai/09 - Diseno y UX.md` registran que
esa pantalla y `comparativo.html` fueron retirados por decisión del negocio.

La nueva instrucción humana reemplaza esa decisión para una superficie más pequeña: dos pestañas,
Retén y Descartados. No autoriza restaurar las funciones eliminadas del HTML histórico:
reinstalación, reencauche, ranking de causas ni comparativo.

## 4. Retén: contrato comprobable en el repositorio

`supabase/migrations/20260714100000_unit_position_state_and_inventory_views.sql` define
`v_tire_inventory_available` con `security_invoker=true`, revoca acceso general y concede `SELECT`
solo a `authenticated`.

La vista devuelve ciclos y cascos activos sin instalación activa. Su condición canónica es:

- `tire_life_cycles.status='active'`;
- `tire_casings.status='active'`;
- ausencia de una `tire_installations` activa para el ciclo.

Expone 15 columnas documentadas en `tasks_cambios_neumaticos/CONTRATOS_UI.md §4`, incluidas
identidad, marca/modelo/medida, condición, ciclo, último retiro, RTD y días en inventario. Los
campos del último retiro son `NULL` para ciclos nunca retirados y siguen siendo válidos.

`WEB/movimientos/data.js` ya carga esta vista y `WEB/movimientos/inventory-ui.js` ya prueba
filtrado tolerante a `NULL`. La pantalla nueva puede reutilizar las reglas puras, no el diálogo ni
su acoplamiento al borrador de Movimientos.

## 5. Descartados: contrato conocido y deriva abierta

`v_inventory_status` discrimina al menos `installed`, `in_inventory` y `discarded`. La consumen
`WEB/historial-neumatico.html` y las vistas de historia. La fase backend registró que existe en el
proyecto remoto y que convive con `v_tire_inventory_available`.

Sin embargo, ninguna migración local define su DDL. La deriva está documentada en
`tasks_cambios_neumaticos/AUDIT.md §5.2` y no debe ocultarse. Esta fase usa únicamente las columnas
enumeradas en `CONTRATOS_DATOS.md`; la primera carga autenticada del smoke debe comprobar su forma.
Una ausencia, permiso inesperado o forma incompatible bloquea `task_04`/`task_07` y abre una fase
de esquema separada. No se inventa una vista desde el navegador.

## 6. Flujo que ya produce los dos estados

`confirm_tire_change_batch` implementa lotes atómicos e idempotentes:

- `send_to_retention` cierra la instalación y conserva casco/ciclo activos; por derivación el ciclo
  entra en `v_tire_inventory_available`.
- `discard` cierra instalación, ciclo y casco, guarda causa y foto; deja de ser montable y
  `v_inventory_status` lo clasifica `discarded`.

La pantalla no escribe esos estados ni replica su lógica. Tras recarga o evento Realtime debe leer
la verdad consolidada.

## 7. Arquitectura y navegación

Las superficies web son HTML estático con módulos ES y usan `WEB/supabase-demo.js`,
`WEB/renova-ready.js` y `WEB/renova-office-shell.css`. La navegación se repite en varios HTML;
por eso una tarea única debe ser propietaria de todos los enlaces nuevos.

Arquitectura propuesta:

```text
WEB/inventario.html
WEB/inventario/
  data.js
  inventory-model.js
  inventory-controller.js
  inventario.css
  __tests__/
```

La lógica pura no toca DOM. Los módulos DOM se validan en navegador real, siguiendo el patrón de
`WEB/movimientos/README.md`; Vitest usa entorno `node`.

## 8. Riesgos y controles

| Riesgo | Control |
|---|---|
| Revivir alcance eliminado | Pantalla solo lectura; exclusiones en cada tarea. |
| Descartados depende de DDL no versionado | Contrato mínimo, validación temprana y bloqueo explícito. |
| Fuga entre empresas | Sesión autenticada, vistas con RLS de tablas subyacentes y prueba cruzada. |
| Estado duplicado | Partición por fuente canónica y aserción de IDs disjuntos. |
| Datos remotos inyectados en HTML | `textContent`/atributos seguros; URL codificada para historial. |
| Foto privada | No mostrar foto en MVP; causa y trazabilidad textual bastan. |
| Navegación inconsistente | Un dueño para todos los HTML vigentes. |
| UI inaccesible o densa | Tabs semánticas, teclado, foco, 390×844 y escritorio. |

## 9. Fuera de alcance

Migraciones, RPCs, escritura remota, reinstalar, reencauchar, recuperar descartados, editar causa o
foto, ranking agregado, comparativo, cambios a la app móvil y cambios a Movimientos.
