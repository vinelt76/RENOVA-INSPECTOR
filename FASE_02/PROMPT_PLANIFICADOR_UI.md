# PROMPT PARA CLAUDE — Plan de implementación de la Fase 2 UI

> Copiar este archivo completo en una sesión nueva de Claude abierta en la raíz de
> `RENOVA-INSPECTOR`.

---

## Rol

Actúa como **arquitecto y planificador de implementación** de RENOVA INSPECTOR. Debes auditar el
estado real del repositorio y diseñar un plan detallado, secuencial, verificable y delegable para
implementar la **Fase 2 de UI del modo Cambios de Neumáticos**.

La fase backend anterior terminó en `task_07` con veredicto **APTO PARA FASE 2**. No confundas esa
numeración de tareas con esta Fase 2 de frontend.

Tu trabajo en esta sesión es **solo planificar**. No implementes HTML, CSS, JavaScript, tests,
migraciones ni configuración de Storage. No apliques cambios remotos. No corrijas hallazgos aunque
parezcan triviales: conviértelos en decisiones o tareas del plan.

## Resultado funcional que debes planificar

Extender `WEB/Inspecciones por unidad.html`, conservando la navegación actual desde
`WEB/INSPECCIONES POR FECHA.html`, para incorporar un selector claro entre:

- **Modo Inspección:** conserva el comportamiento vigente y muestra la inspección histórica
  seleccionada desde `v_inspection_dashboard_rows`.
- **Modo Cambios:** muestra el estado **actual** completo de la unidad desde
  `v_unit_position_state`, incluidas posiciones vacías, y permite armar un lote provisional de
  movimientos sin persistir nada hasta una confirmación general.

El modo Cambios debe permitir, conforme al contrato desplegado:

1. Enviar un neumático a retén.
2. Descartarlo con causa y foto real obligatoria.
3. Montar un ciclo existente desde inventario/retén.
4. Intercambiar neumáticos entre dos posiciones.
5. Combinar movimientos válidos en un solo lote.
6. Ver la representación provisional en el diagrama antes de confirmar.
7. Revisar una lista/resumen de movimientos, deshacer y editar sin escribir en Supabase.
8. Confirmar mediante una única llamada a `confirm_tire_change_batch({ p_batch })`.
9. Recuperarse correctamente de pérdida de red, reintento idempotente, sesión/rol no autorizado,
   inventario ocupado y estado desactualizado.
10. Recargar el estado real después del éxito y demostrar persistencia mediante un smoke test real.

No propongas encadenar `register_removal`, `transfer_tire` u otras escrituras individuales desde
esta pantalla. El lote se confirma exclusivamente con `confirm_tire_change_batch`.

## Límites duros

- No cambies el stack ni conviertas los dashboards estáticos a React/Vue/Svelte sin una decisión
  humana explícita. Planifica sobre la arquitectura real de `WEB/`.
- No toques `app/`, SQLite, Capacitor ni el flujo móvil de inspección.
- No cambies fórmulas, umbrales ni semáforos del modo Inspección.
- No derives posiciones desde la inspección ni hardcodees P1–P6/P1–P8. En modo Cambios manda
  `v_unit_position_state` y la configuración real de la unidad.
- No inventes tablas, columnas, vistas, buckets, rutas, claves de Storage, roles, enums ni firmas.
  Si algo no existe, regístralo como **decisión pendiente** o **contrato propuesto**, con una tarea
  explícita para crearlo y verificarlo.
- Nunca expongas `service_role`, secret keys, contraseñas ni datos de sesiones en el frontend,
  fixtures, documentos o logs.
- No alteres ni limpies cambios existentes del worktree. Empieza registrando `git status --short`
  y trata como propiedad del usuario todo archivo modificado o no rastreado.
- La planificación no puede declarar resuelto algo que no haya verificado en el repositorio o, si
  corresponde, por consulta remota de solo lectura.

## Lecturas obligatorias, en este orden

Lee completamente y contrasta entre sí:

1. `CLAUDE.md`.
2. `knowledge/ai/00 - LEER PRIMERO.md` y las notas que enruta para UI, dashboard, datos,
   Supabase, seguridad, roadmap y mantenimiento documental; como mínimo:
   - `knowledge/ai/05 - Datos y Supabase.md`
   - `knowledge/ai/07 - Web dashboards y taller.md`
   - `knowledge/ai/08 - Infraestructura seguridad y despliegue.md`
   - `knowledge/ai/09 - Diseno y UX.md`
   - `knowledge/ai/10 - Roadmap deuda y riesgos.md`
   - `knowledge/ai/11 - Mapa del repo y runbook.md`
   - `knowledge/ai/14 - Mantenimiento documental.md`
3. `PRODUCT.md`, `DESIGN.md` y `design-principle.md`.
4. Las especificaciones y decisiones vigentes relevantes, en particular
   `specs/reglas_negocio.md` y `specs/reglas_fijas_vs_configurables.md`.
5. La puerta de entrada cerrada por la fase backend:
   - `tasks_cambios_neumaticos/REVISION_FINAL.md`
   - `tasks_cambios_neumaticos/CONTRATOS_UI.md` **completo**
   - `tasks_cambios_neumaticos/PLAN.md`, especialmente la sección de Fase 2
   - `tasks_cambios_neumaticos/STATE.md`
   - Las tres migraciones `20260714100000`, `20260714110000` y `20260714120000`
   - `supabase/tests/unit_state_reads.test.sql`
   - `supabase/tests/tire_change_batch.test.sql`
6. El código web real:
   - `WEB/Inspecciones por unidad.html`
   - `WEB/INSPECCIONES POR FECHA.html`
   - `WEB/supabase-demo.js`
   - `WEB/renova-ready.js`
   - `WEB/supabase-config.public.js`
   - `WEB/renova-office-shell.css`
   - `WEB/instalacion.html`
   - `WEB/historial-neumatico.html`
7. La referencia visual manuscrita `FASE_02/Untitled.jpg`.

No uses `docs/run*` o `tasks_opencode/` como autoridad vigente; solo como historia o referencia de
formato cuando no contradigan las fuentes anteriores.

## Uso obligatorio de Supabase

Esta planificación involucra Auth, vistas, RPC, Data API y Storage. Usa la skill de Supabase
disponible en el entorno y sigue sus controles vigentes.

Antes de proponer tareas Supabase:

1. Revisa el changelog actual de Supabase y la documentación oficial vigente sobre los temas que
   efectivamente afecten al plan: `supabase-js`, RPC/retries, Auth, Storage uploads, RLS de
   `storage.objects`, URLs públicas o firmadas y limpieza de objetos huérfanos.
2. Si el MCP del proyecto está disponible, realiza solo consultas de lectura para verificar el
   proyecto productivo, las vistas, firma/ACL de la RPC, RLS/grants y si ya existe algún bucket o
   política reutilizable. No apliques migraciones ni escribas datos.
3. Si no hay acceso remoto, no bloquees todo el plan: documenta exactamente qué verificación queda
   pendiente antes de implementar la tarea afectada.
4. Distingue siempre GRANT, RLS y autorización de dominio. No asumas que `authenticated` por sí
   solo aísla empresas.
5. El cliente público solo puede usar la clave publicable/anon prevista por la arquitectura.

El proyecto productivo registrado por la revisión anterior es `fbxupwwgiebhlciqftpw`, pero debes
reverificarlo; existe un proyecto homónimo vacío que no debe confundirse con producción.

## Auditoría dirigida obligatoria

Documenta evidencia con `archivo:línea` para cada punto.

### 1. Estado actual de la pantalla

- Estructura de layout, diagrama/gemelo digital, ruedas existentes en el DOM y comportamiento
  responsive.
- Construcción de `POSICIONES`, `selected`, `renderDock`, `updateWheelStates`, `select`,
  `renderPanel` y `estadoEfectivo`.
- Qué partes dependen de `v_inspection_dashboard_rows` y no deben reutilizarse como si fueran
  estado actual de taller.
- Botones de retén/descarte y modal simulado: qué hacen hoy y qué no persisten.
- Inicialización, sesión, navegación, Realtime, estados vacío/error y cierre de sesión.
- Limitaciones de accesibilidad, teclado, foco, touch y resoluciones móvil/escritorio.

### 2. Contratos backend realmente disponibles

- Resolución de `unit_id` desde `inspection_id`/placa sin romper la URL existente.
- Las 28 columnas reales de `v_unit_position_state`, incluida la semántica de `is_empty`, datos
  de última inspección y `code_mismatch`.
- Las 15 columnas reales de `v_tire_inventory_available` y sus `NULL` válidos.
- Payload v1 completo, reglas, respuestas, idempotencia y errores de
  `confirm_tire_change_batch`.
- Roles permitidos, aislamiento por empresa y comportamiento de una sesión sin permiso.

No copies parcialmente el contrato al plan de forma que pueda divergir. Declara
`tasks_cambios_neumaticos/CONTRATOS_UI.md` como fuente canónica y coloca en cada tarea los campos
exactos que necesite su ejecutor.

### 3. Estado provisional y reglas del editor de lote

Diseña conceptualmente, sin programar, una máquina de estados o modelo de datos que diferencie:

- snapshot remoto original;
- proyección provisional del diagrama;
- movimientos editables todavía no confirmados;
- payload sellado e inmutable, listo o pendiente de reintento;
- resultado confirmado y estado remoto recargado.

El plan debe impedir como mínimo:

- operar retiro/descarte sobre una posición vacía;
- montar sobre una posición que seguirá ocupada;
- usar dos veces el mismo ciclo de inventario;
- duplicar una posición como origen o destino fuera de las combinaciones permitidas;
- perder `expected_life_cycle_id` al construir retiros o swaps;
- mutar un payload después de asignarle `batch_id`;
- generar otro UUID en un retry de red;
- conservar/reintentar ciegamente un lote rechazado por conflicto de dominio;
- mezclar borradores entre usuario, empresa o unidad;
- sobrescribir silenciosamente un borrador por un evento Realtime.

Explica cómo representar visualmente posiciones ocupadas, vacías, seleccionadas, origen,
destino, retén, descarte, montaje, swap, discrepancia de código y conflicto, sin romper la
semántica cromática vigente ni crear un segundo foco naranja.

### 4. Foto real de descarte y Storage

El backend exige `photo_url` no vacía, pero el repositorio no demuestra todavía una estrategia
aprobada de Storage para este flujo. No inventes la decisión.

El plan debe comparar y recomendar una opción concreta, dejando para aprobación humana los puntos
de negocio/seguridad necesarios:

- bucket nuevo o reutilizado;
- privado con URL firmada frente a público;
- convención de path que aísle empresa/usuario/lote sin confiar en metadata editable;
- formatos admitidos, límite de tamaño, compresión y metadatos;
- captura desde móvil web, selección de archivo y preview;
- RLS/policies exactas necesarias para upload y lectura;
- momento de upload respecto al sellado/confirmación del lote;
- reintento de upload y de RPC;
- eliminación al editar/cancelar y estrategia verificable de objetos huérfanos;
- vigencia de URL si el historial necesita mostrar la evidencia mucho tiempo después.

Si Storage requiere cambios de backend, sepáralos como prerrequisito mínimo y revisable; no
declares que el backend completo debe rediseñarse.

### 5. Referencia visual manuscrita

Inspecciona `FASE_02/Untitled.jpg` y crea en la auditoría una transcripción prudente de lo que se
alcanza a entender (modo interactivo, rotación/intercambio, inventario/retén y gestos). Separa:

- intención inequívoca;
- interpretación probable;
- texto/gesto ambiguo que requiere confirmación humana.

El boceto orienta el flujo, pero no autoriza inventar drag-and-drop, swipe, animaciones o reglas
de negocio. Presenta esas interacciones como alternativas con ventajas, riesgos y fallback
accesible por botones/teclado.

### 6. Estrategia de código y pruebas

Audita si la implementación puede mantenerse responsablemente dentro del HTML o si conviene
extraer módulos JS/CSS pequeños bajo `WEB/`, sin migrar el stack. Define límites concretos entre:

- carga y normalización de datos;
- estado/editor puro del lote;
- proyección del diagrama;
- persistencia local;
- Storage;
- llamada RPC y clasificación de errores;
- render/UI y accesibilidad.

Diseña pruebas proporcionales a la arquitectura real. Como mínimo contempla tests automatizados
para proyección del lote, invariantes, payload exacto, persistencia/reanudación, retry inmutable y
clasificación de errores; además un smoke test real de navegador con sesión autenticada. No
declares una herramienta de testing sin verificar si existe; si hay que incorporarla, crea una
tarea separada con dependencias, versión fijada y archivos exactos.

## Decisiones que el plan debe resolver o escalar

Para cada una incluye: evidencia, alternativas, recomendación, impacto, responsable de aprobar y
tarea bloqueada. No escondas una decisión dentro de pasos genéricos.

1. Contrato de UX exacto del selector Inspección/Cambios.
2. Interacción primaria para swap/rotación y alternativa accesible.
3. Estrategia de Storage y ciclo de vida de la foto.
4. Persistencia del borrador editable frente al payload sellado pendiente de reintento.
5. Comportamiento ante Realtime mientras existe un borrador.
6. Fecha, odómetro y notas del lote: defaults visibles, validación y posibilidad de edición.
7. Tratamiento de `code_mismatch` sin afirmar que el neumático físico es otro.
8. Versión fijada de `supabase-js` y política de retry vigente.
9. Modularización mínima de la pantalla y runner de tests para JS del dashboard.
10. Datos/usuarios de prueba y forma segura de ejecutar el smoke test sin ensuciar producción.

Si una decisión cambia materialmente el flujo o la seguridad y no puede resolverse desde fuentes
vigentes, marca la tarea dependiente como **BLOQUEADA POR DECISIÓN HUMANA**. El resto del plan debe
seguir siendo utilizable.

## Salidas exigidas

Crea una carpeta nueva `tasks_cambios_neumaticos_ui/`. No sobrescribas
`tasks_cambios_neumaticos/`, que conserva la fase backend ya cerrada.

Tu único output persistente en esta sesión son archivos Markdown dentro de esa carpeta:

1. `AUDIT.md`
   - estado real con evidencia `archivo:línea`;
   - contratos disponibles;
   - brechas de UI, datos, Storage, seguridad, accesibilidad y pruebas;
   - lectura prudente de `FASE_02/Untitled.jpg`;
   - riesgos clasificados por severidad.
2. `DECISIONES.md`
   - tabla de decisiones resueltas y pendientes;
   - alternativas, recomendación y tareas que bloquean;
   - preguntas humanas concretas, no preguntas abiertas genéricas.
3. `PLAN.md`
   - arquitectura propuesta y límites de módulos;
   - flujo de usuario paso a paso;
   - modelo de estado provisional y transiciones;
   - estrategia de persistencia/retry/Realtime;
   - estrategia recomendada para foto/Storage;
   - manejo exacto de cada clase de error;
   - mapa de archivos que se crearían/modificarían;
   - grafo de dependencias sin ciclos;
   - hitos de entrega y definición de terminado.
4. `STATE.md`
   - tabla: tarea, título, propietario sugerido (`CLAUDE` o `CODEX`), estado, depende de,
     archivos exclusivos, resultado esperado y revisión;
   - todas empiezan `PENDIENTE`, salvo las bloqueadas por una decisión explícita.
5. `task_NN_slug.md`
   - una secuencia única de tareas implementables y revisables;
   - no crees numeraciones paralelas;
   - evita una mega-tarea que mezcle Storage, editor, UI completa y verificación final.

## Plantilla obligatoria de cada tarea

Cada `task_NN_*.md` debe ser autocontenida y contener:

1. **Propietario sugerido** y alcance.
2. **Objetivo y resultado observable**.
3. **Dependencias** y tareas que bloquea.
4. **Decisiones ya aprobadas** que aplica y decisiones que todavía la bloquean.
5. **Archivos permitidos**, archivos de solo lectura y archivos prohibidos.
6. **Estado inicial verificado**, con referencias a archivos/líneas.
7. **Contratos exactos de entrada/salida** que consume o produce.
8. **Pasos de implementación** ordenados, sin pseudocódigo ambiguo tipo “hacer la UI”.
9. **Estados de carga, vacío, error, éxito y recuperación**.
10. **Reglas de consistencia, seguridad y accesibilidad**.
11. **Casos de prueba automatizados** y fixtures/mocks permitidos.
12. **Recorrido de smoke test real** con precondiciones, acciones, resultados esperados,
    verificación de consola/red y limpieza de datos.
13. **Criterios de aceptación verificables**.
14. **Comandos exactos de verificación**, solo después de comprobar que existen.
15. **Rollback o recuperación segura** si la tarea toca Storage/configuración.
16. **Formato de handoff** para actualizar `STATE.md` con evidencia.

Los archivos permitidos deben ser lo más disjuntos posible. Nunca planifiques dos tareas en
paralelo modificando el mismo HTML, JS, CSS, test o migración.

## Cobertura mínima del grafo de tareas

No fuerces esta numeración si la auditoría demuestra otra división mejor, pero el grafo final debe
cubrir explícitamente:

- cierre de decisiones humanas bloqueantes;
- base de pruebas y/o extracción de lógica pura;
- Storage seguro para evidencias de descarte, si no existe;
- resolución de unidad y carga paralela de las dos fuentes sin mezclar semánticas;
- editor/máquina de estados provisional con invariantes;
- persistencia local de borrador y payload sellado idempotente;
- render dinámico de todas las posiciones, incluidas vacías;
- selector de modo y conservación total del modo Inspección;
- flujos retén, descarte, montaje e intercambio;
- inventario/buscador y prevención de selección duplicada;
- resumen, deshacer/editar, confirmación y feedback;
- manejo de errores, retry, conflicto y Realtime;
- accesibilidad y responsive;
- pruebas automatizadas;
- smoke test real end-to-end con lote mixto y recarga persistente;
- actualización documental y revisión cruzada final.

La última tarea debe ser una revisión independiente con checklist concreto; no una tarea genérica
de “arreglar pendientes”. No se aprueba la fase sin evidencia de navegador real, consola limpia,
estado persistido tras recarga y ausencia de regresiones en modo Inspección.

## Casos que deben aparecer en pruebas y aceptación

Incluye al menos:

- unidad con 6 posiciones, con 8 y con una posición vacía;
- cero filas/no autorizada/configuración sin posiciones;
- retén simple y descarte con foto/causa;
- montaje sobre vacía y reemplazo (retiro + montaje en la misma posición);
- swap válido y selecciones inválidas/duplicadas;
- lote mixto con los cuatro tipos de movimiento;
- ciclo que desaparece del inventario mientras se edita;
- timeout después de enviar: mismo payload y mismo `batch_id`;
- edición posterior: nuevo `batch_id`;
- recarga del navegador con borrador editable y con payload sellado;
- `[estado_desactualizado]`, `[no_disponible]`, `[posicion_ocupada]`, `[sin_permiso]`,
  `[lote_invalido]`, error de fecha y error desconocido;
- fallo de upload, cancelación y foto huérfana;
- evento Realtime durante la edición;
- `code_mismatch=true`;
- navegación con teclado, foco de modal, escape/cancelar y objetivos táctiles;
- regreso al modo Inspección sin perder ni contaminar sus datos históricos;
- consola sin errores y sin secretos/datos sensibles en logs.

## Definición de terminado para esta sesión de planificación

Terminas cuando:

- los Markdown exigidos existen en `tasks_cambios_neumaticos_ui/` y están en español;
- los hallazgos citan evidencia verificable;
- `CONTRATOS_UI.md` se mantiene como contrato canónico y el plan no lo contradice;
- las decisiones abiertas están visibles y tienen impacto claro;
- cada tarea puede ejecutarse sin acceder a esta conversación;
- el grafo no tiene ciclos ni escrituras paralelas sobre los mismos archivos;
- cada tarea tiene verificación proporcional y la revisión final exige smoke test real;
- no implementaste ni modificaste código de producción.

Al responder, entrega un resumen breve con: arquitectura recomendada, orden de hitos, decisiones
que requieren aprobación humana, riesgos principales y lista de archivos creados. **No inicies la
primera tarea de implementación.**
