# task_01 — Auditoría remota y contrato de facetas

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

Congelar `CONTRATOS_DATOS.md` contra la **base real**, no contra el repositorio.

Es la tarea que existe porque `v_tire_performance` **no está en la cadena de migraciones**
(`AUDIT.md` §2.5) y la única definición versionada está desactualizada. Nadie puede escribir una
faceta sin saber qué columnas existen realmente.

Resultado observable: `CONTRATOS_DATOS.md` pasa de BORRADOR a **CONGELADO**, con cada faceta marcada
`Confirmada` o retirada del alcance, y con la evidencia de la consulta que lo prueba.

## 3. Dependencias y bloqueos

Sin dependencias. Bloquea `task_02` y `task_04`.

## 4. Archivos exclusivos

- `CONTRATOS_DATOS.md` (esta carpeta)
- `AUDIT.md` §2.5, §2.6 y §3 (completar con hallazgos remotos)

Solo lectura: todo `supabase/migrations/`, `WEB/rendimiento.html`,
`WEB/INSPECCIONES POR FECHA.html`, `tasks_buscador_global/`.

**No se escribe código de aplicación en esta tarea.**

## 5. Contratos

Lo que hay que resolver, en orden de importancia:

1. **Columnas reales de `v_rendimiento_dashboard_rows`.** La vista expande `p.*` de
   `v_tire_performance`, cuya DDL no está versionada. Obtener la lista completa desde
   `information_schema.columns`.
2. **¿Existe `brand_name`?** `rendimiento.html` no la usa; arma `modelo` con `size_name` +
   `model_name`. Existe en `tire_casings` y en `v_search_index`. Se desconoce si esta vista la
   expone.
3. **¿Existe la notación de configuración (`2-4-2`, `2-4`)?** Vive en `vehicle_configs.notation`. El
   join a `vehicle_configs` **no aparece** en la migración vigente. Probablemente ausente.
4. **Fuente de datos de Inspecciones.** `CONTRATOS_DATOS.md` §3 está sin trazar: la auditoría no
   siguió `INSPECTIONS` hasta su vista de origen. Documentar la vista, sus columnas de estado y de
   fecha, y los **valores crudos reales** del estado (no los del enunciado humano).
5. **Volumen.** Filas y bytes por empresa de ambas fuentes, para validar F9 (filtrado en cliente).
6. **Frescura.** Distribución de antigüedad de la última inspección: cuántas filas superan 30 días.
   Es lo que dimensiona si `task_07` sirve de algo o si excluye media flota.
7. **Grant a `anon`** (`AUDIT.md` §2.6). Verificar empíricamente.

## 6. Pasos

1. Leer `AUDIT.md`, `DECISIONES.md`, `CONTRATOS_DATOS.md` y `tasks_buscador_global/task_01`,
   `task_03` y `task_12` (precedentes de verificación remota y de extensión aditiva).
2. Listar columnas reales de `v_rendimiento_dashboard_rows` y de la vista de Inspecciones.
3. Resolver los puntos 2 y 3 de §5. Para cada faceta ausente, **decidir explícitamente**: extender
   la vista con un cambio aditivo, o retirarla del alcance. Registrar cuál y por qué.
4. Trazar la fuente de Inspecciones y sus valores crudos de estado. Contrastar contra
   `specs/reglas_negocio.md` antes de asumir que los tres valores del enunciado son los reales.
5. Medir volumen por empresa. Confirmar que no hay truncado por `max-rows` (precedente:
   `tasks_buscador_global/task_03`).
6. Medir la distribución de frescura.
7. Verificar el grant a `anon` con una petición REST anónima real.
8. Actualizar `CONTRATOS_DATOS.md`: cada faceta `Confirmada` o retirada, con evidencia.
9. Marcarlo **CONGELADO** con fecha.

## 7. Invariantes

- **No aplicar DDL en esta tarea.** Es auditoría. Las migraciones son `task_07` y `task_08`.
- No usar `service_role`. Las consultas se hacen con la identidad que usaría la app.
- No volcar datos reales de clientes en la documentación: conteos y nombres de columna, no filas.
- **No derivar una faceta ausente por heurística.** Si no hay `brand_name`, no se extrae la marca
  parseando `model_name`.
- No corregir la deuda de `v_tire_performance` (F14). Se documenta.

## 8. Casos de error

- Vista inexistente o inaccesible con la identidad de la app → bloqueo, se reporta.
- Respuesta truncada por `max-rows` → regla de bloqueo 3, se reporta antes de continuar.
- REST anónimo devuelve filas → **incidente de seguridad**, regla de bloqueo 2. La fase se detiene.
- Los valores crudos de estado no son los tres del enunciado → no es error: se documentan los
  reales y se ajusta el contrato. El enunciado humano describe intención, no esquema.

## 9. Aceptación

- `CONTRATOS_DATOS.md` marcado CONGELADO, sin ninguna faceta en estado `POR VERIFICAR`.
- Cada faceta retirada tiene motivo registrado.
- Volumen por empresa documentado y compatible con F9, o F9 revisada con el humano.
- Distribución de frescura documentada.
- Grant a `anon` verificado empíricamente, con el resultado registrado.

## 10. Rollback

Solo documentación. Revertir el archivo.

## 11. Handoff

Actualizar fila 01 de `STATE.md` con: columnas reales confirmadas, decisión sobre `brand_name` y
configuración, fuente y valores crudos de Inspecciones, volumen por empresa, distribución de
frescura y resultado de la verificación anónima.

Si `task_01` retira alguna faceta del alcance, **decirlo explícitamente en el handoff**: `task_05` y
`task_06` construyen su UI a partir de esta lista.
