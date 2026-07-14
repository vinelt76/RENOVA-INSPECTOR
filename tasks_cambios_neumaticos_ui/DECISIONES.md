# DECISIONES — Fase 2 UI · Modo Cambios de Neumáticos

Fecha: 2026-07-13. Cada decisión trae evidencia, alternativas, recomendación, impacto, quién
aprueba y la tarea que bloquea. Las que cambian materialmente flujo o seguridad y no se resuelven
desde fuentes vigentes marcan su tarea **BLOQUEADA POR DECISIÓN HUMANA**. El resto del plan sigue
siendo utilizable aunque estas queden abiertas.

Fuente de contratos: `tasks_cambios_neumaticos/CONTRATOS_UI.md` (canónica).

> **Cierre de decisiones — 2026-07-13 (task_01)**: el humano respondió las 10 decisiones. Todas
> quedan **RESUELTAS**. Dos elecciones difieren de la recomendación original y se propagaron a los
> documentos dependientes: **D1 = tabs sobre el diagrama** (no toggle en header) y
> **D6 = odómetro obligatorio** (no opcional). `task_03`, `task_12` y `task_16` quedan
> **desbloqueadas** (PENDIENTE) en `STATE.md`.

## Tabla resumen

| # | Decisión | Estado | Elección final (2026-07-13) | Aprueba | Bloquea |
|---|---|---|---|---|---|
| 1 | UX del selector Inspección/Cambios | RESUELTA | **Tabs sobre el diagrama** (no header); modo por URL `?mode=`; Inspección intacto | Humano/Diseño | task_09 |
| 2 | Interacción primaria swap/rotación + fallback | RESUELTA | Selección por toques (origen→destino) con botón/teclado; D&D opcional después | Humano/Diseño | task_10 |
| 3 | Storage: bucket, privacidad, path, ciclo de vida foto | RESUELTA | Bucket **privado** `tire-discard-photos`, path `<company_id>/<batch_id>/<seq>`, **URL firmada**, ~5 MB JPEG/WebP, upload pre-sellado, limpieza de huérfanos | Humano/Seguridad | task_03, task_12 |
| 4 | Persistencia borrador editable vs payload sellado | RESUELTA (desde contratos) | Dos claves `localStorage` separadas; sellado inmutable | CLAUDE (documentada) | task_06 |
| 5 | Realtime mientras hay borrador | RESUELTA | **No auto-recargar**: banner "el estado cambió, revisá" | Humano/Producto | task_13 |
| 6 | Fecha/odómetro/notas del lote: defaults y validación | RESUELTA | `performed_at`=hoy editable; **odómetro OBLIGATORIO**; notas opcionales | Humano/Producto | task_13 |
| 7 | Tratamiento de `code_mismatch` | RESUELTA (desde contratos) | Etiqueta "REVISAR IDENTIDAD", no bloquea, no afirma cambio físico | CLAUDE (documentada) | task_08 |
| 8 | Pin de supabase-js y política de retry | RESUELTA | **Fijar versión exacta ≥2.102.0 y conservar** el retry automático (solo idempotente) | Humano/Tech lead | task_07 |
| 9 | Modularización mínima + runner de tests | RESUELTA (recomendación) | Módulos ES bajo `WEB/tire-change/` + vitest scoped | CLAUDE (documentada) | task_02 |
| 10 | Datos/usuario de prueba y smoke seguro | RESUELTA | **Unidad/usuario de taller de prueba dedicada** en prod + limpieza (o historia acordada) | Humano/Seguridad | task_16 |

---

## Detalle

### Decisión 1 — Contrato de UX exacto del selector Inspección/Cambios
- **Evidencia**: no existe selector hoy (pantalla monomodo). `FASE_02/Untitled.jpg` marca un
  "MODO INTERACTIVO" separado (`AUDIT.md §5.1`). Paleta: un solo foco naranja
  (`knowledge/ai/09:16-22`).
- **Alternativas**: (a) toggle segmentado en el header junto a la navegación; (b) dos tabs sobre
  el stage; (c) botón que expande un panel de Cambios.
- **RESOLUCIÓN (humano, 2026-07-13)**: **opción (b) — tabs sobre el diagrama**. Dos pestañas
  "Inspección | Cambios" ubicadas sobre el gemelo/diagrama (no en el header), con `aria-pressed`,
  estado inicial "Inspección". El modo se refleja en la URL (`?mode=cambios`) para compartir/recargar
  sin perder contexto. Cambiar de modo **no** recarga datos de Inspección ya cargados; carga
  perezosa del estado de taller al entrar a Cambios por primera vez. Cuidar que las tabs no compitan
  con el `stage-eyebrow` existente (`Inspecciones por unidad.html:274-279`, `:529-532`).
- **Impacto**: bajo en Inspección (se conserva intacto); define la estructura de `task_09`
  (actualizado: tabs sobre el diagrama, no header).
- **Aprueba**: Humano/Diseño (RESUELTA). **Bloquea**: `task_09`.

### Decisión 2 — Interacción primaria swap/rotación y alternativa accesible
- **Evidencia**: boceto sugiere mover neumáticos entre posiciones (`AUDIT.md §5.2`), pero **no
  autoriza** D&D/swipe (`AUDIT.md §5.3`). Ruedas hoy no son accesibles por teclado
  (`Inspecciones por unidad.html:1008`). Objetivos táctiles del 3D poco fiables.
- **Alternativas**: (a) selección secuencial: tocar posición origen → elegir acción (retén/
  descarte/swap/mount) → si swap, tocar destino; (b) drag-and-drop de una posición a otra;
  (c) swipe.
- **Recomendación**: **(a) como interacción primaria** (accesible por botón y teclado desde el
  inicio); D&D **opcional y aditivo** sólo si Diseño lo aprueba, siempre con el fallback (a)
  intacto. Nunca depender de gesto para completar una operación.
- **RESOLUCIÓN (humano, 2026-07-13)**: **(a)** — selección por toques origen→destino como
  interacción primaria, accesible por botón/teclado desde el inicio; drag-and-drop queda como
  extensión opcional posterior sin romper el fallback.
- **Impacto**: define `task_10`. **Aprueba**: Humano/Diseño (RESUELTA). **Bloquea**: `task_10`.

### Decisión 3 — Estrategia de Storage y ciclo de vida de la foto — **RESUELTA (humano, 2026-07-13)**

> **Elección del humano**: bucket **privado** `tire-discard-photos`, **URL firmada** (vigencia
> corta; el historial re-firma al leer), path `<company_id>/<batch_id>/<seq>.<ext>` con RLS que
> valida el primer segmento contra `current_company_id()`, límite ~5 MB, JPEG/WebP con compresión
> en cliente, **upload antes de sellar** el lote, y **borrado de huérfanos** al cancelar/editar.
> Desbloquea `task_03` y `task_12` (pasan a PENDIENTE). La migración del bucket/policies debe pasar
> por `sync-migration-reviewer` y aplicarse solo con aprobación explícita.

- **Evidencia**: backend exige `photo_url` no vacío sin validar Storage
  (`CONTRATOS_UI.md:294`, `:687`); remoto **sin buckets ni policies** (`AUDIT.md §4`, §9). Es una
  decisión de negocio/seguridad no tomada.
- **Alternativas y sub-decisiones** (todas para el humano):
  1. Bucket **nuevo** `tire-discard-photos`, **privado**. (Recomendado: evidencia sensible.)
  2. Path `<company_id>/<batch_id>/<seq>.jpg`; RLS que exige que el primer segmento sea la empresa
     del perfil (`current_company_id()`), no metadata del cliente.
  3. URL **firmada** de vigencia corta para mostrar; el historial re-firma al leer. (Alternativa:
     pública permanente — más simple, menos segura.)
  4. Formatos JPEG/WebP, límite ~5 MB, compresión en cliente.
  5. **Momento de upload**: subir **antes** de sellar el lote para tener `photo_url`; si el lote
     se cancela/edita, **borrar** el objeto (limpieza de huérfanos verificable).
  6. Reintento de upload independiente del retry de RPC.
- **Recomendación**: privado + firmado + path por empresa/lote + upload pre-sellado + limpieza al
  cancelar/editar. Formalizar policies en una migración revisable (`task_03`).
- **Impacto**: alto (seguridad). Sin esta decisión, `task_12` (foto real) no puede cerrarse; el
  resto del editor sí avanza usando un **placeholder de `photo_url`** solo en pruebas, nunca en
  producción.
- **Aprueba**: Humano/Seguridad (RESUELTA). **Bloquea**: `task_03` y `task_12` — desbloqueadas
  (PENDIENTE); aplicar la migración de Storage sigue exigiendo aprobación humana explícita.

### Decisión 4 — Persistencia del borrador editable vs payload sellado — RESUELTA
- **Evidencia**: `CONTRATOS_UI.md:514-519`, `:592-604`, `:650-674`.
- **Resolución**: dos artefactos separados en `localStorage`, con clave que incluye
  usuario+empresa+unidad+`batch_id`:
  - Borrador editable (movimientos sin sellar): se puede modificar/deshacer; al editar tras sellar,
    se descarta el sellado y se genera un `batch_id` nuevo.
  - Payload sellado pendiente de reintento: inmutable; solo se reintenta idéntico ante red/timeout;
    se borra ante éxito o error de dominio.
- **Impacto**: define `task_06`. **Aprueba**: documentada por CLAUDE. **Bloquea**: `task_06`.

### Decisión 5 — Comportamiento ante Realtime mientras existe un borrador
- **Evidencia**: hoy Realtime recarga inspección sin resetear selección
  (`Inspecciones por unidad.html:1059-1063`); no cubre tablas de taller ni borradores.
- **Alternativas**: (a) no auto-recargar el estado de taller si hay borrador; mostrar un banner
  no intrusivo "el estado de la unidad cambió — revisá antes de confirmar"; (b) auto-recargar y
  descartar borrador (destructivo); (c) ignorar Realtime en modo Cambios.
- **Recomendación**: **(a)**. Nunca sobrescribir un borrador en silencio (`AUDIT.md §3.1`). La RPC
  ya protege con bloqueo optimista `[estado_desactualizado]`, así que un borrador desincronizado
  falla de forma segura al confirmar; el banner solo mejora la UX.
- **RESOLUCIÓN (humano, 2026-07-13)**: **(a)** — no auto-recargar si hay borrador; banner no
  intrusivo "el estado de la unidad cambió — revisá antes de confirmar". Sin borrador, recargar.
- **Impacto**: `task_13`. **Aprueba**: Humano/Producto (RESUELTA). **Bloquea**: `task_13`.

### Decisión 6 — Fecha, odómetro y notas del lote
- **Evidencia**: `performed_at` obligatorio `YYYY-MM-DD`; `odometer` entero o `null`; `notes`
  opcional (`CONTRATOS_UI.md:229-239`). Regla: `performed_at` no anterior a `installed_at` de una
  instalación retirada (`:423`, error real sin prefijo estable `:539-541`).
- **Alternativas**: default de fecha hoy vs. fecha de última inspección; odómetro obligatorio vs.
  opcional; notas visibles vs. ocultas.
- **RESOLUCIÓN (humano, 2026-07-13)**: `performed_at` = fecha de hoy, **editable**, con validación
  de cliente que advierte (no bloquea) si es anterior a algún `installed_at` visible. **Odómetro
  OBLIGATORIO**: la confirmación se deshabilita sin un odómetro entero válido (nunca inventar 0);
  se envía en `odometer` (entero) y se aplica a todos los movimientos del lote
  (`CONTRATOS_UI.md:234-236`, `:424`). Notas del encabezado opcionales; **notas por movimiento**
  disponibles porque son las que llegan a los retiros/instalaciones (`:686-688`).
- **Nota de contrato**: el backend acepta `odometer` `null` (`CONTRATOS_UI.md:235`); la
  obligatoriedad es **regla de UI**, no del contrato — se valida en el cliente antes de sellar.
- **Impacto**: `task_13` (actualizado: odómetro obligatorio). **Aprueba**: Humano/Producto
  (RESUELTA). **Bloquea**: `task_13`.

### Decisión 7 — Tratamiento de `code_mismatch` — RESUELTA
- **Evidencia**: `CONTRATOS_UI.md:82-85` — comparación `IS DISTINCT FROM`; `NULL` participa; en
  vacía siempre `false`. No afirmar que el neumático físico es otro.
- **Resolución**: mostrar una etiqueta textual neutra ("REVISAR IDENTIDAD") en la posición, sin
  bloquear ninguna operación ni colorear como alarma. No inventar rojo. El usuario decide.
- **Impacto**: `task_08` (proyección). **Aprueba**: documentada por CLAUDE. **Bloquea**: `task_08`.

### Decisión 8 — Versión fijada de supabase-js y política de retry
- **Evidencia**: importado `@supabase/supabase-js@2` sin minor (`supabase-demo.js:18`); retry
  automático desde 2.102.0 (`CONTRATOS_UI.md:602-604`). La atomicidad/idempotencia hacen seguro
  repetir el **mismo** payload.
- **Alternativas**: (a) fijar `@2.x.y` exacto y **conservar** retry (seguro por idempotencia);
  (b) fijar y **desactivar** retry, manejando reintentos manualmente; (c) dejar sin pin.
- **RESOLUCIÓN (humano, 2026-07-13)**: **(a)** — fijar una versión exacta ≥2.102.0 y **conservar**
  el retry automático, documentando que sólo aplica a payloads idempotentes. `task_07` debe elegir
  y anotar la versión exacta concreta (p. ej. la última estable ≥2.102.0) al implementar. Este pin
  afecta a `supabase-demo.js` (compartido por todos los dashboards): cambio mínimo y revisable;
  verificar que los demás dashboards siguen cargando.
- **Impacto**: `task_07`; toca `supabase-demo.js`. **Aprueba**: Humano/Tech lead (RESUELTA).
  **Bloquea**: `task_07`.

### Decisión 9 — Modularización mínima y runner de tests — RESUELTA (recomendación)
- **Evidencia**: WEB/ sin build ni tests; `app/` tiene vitest+playwright (`AUDIT.md §6`).
- **Resolución recomendada**: módulos ES bajo `WEB/tire-change/` (ver `PLAN.md §1`) importados con
  `type="module"`. Lógica pura testeable con **vitest** en un scope propio (config y
  `package.json` mínimos en `WEB/tire-change/` o raíz, **sin** tocar `app/`). Smoke real con
  navegador (playwright de `app/` reutilizable o corrida manual — ver Decisión 10). El pin de
  versión exacta de vitest/playwright se fija en `task_02`.
- **Impacto**: `task_02` (andamiaje). **Aprueba**: documentada por CLAUDE, confirmar con Tech lead
  si se agrega infra de test en la raíz. **Bloquea**: `task_02`.

### Decisión 10 — Datos/usuarios de prueba y smoke seguro — **RESUELTA (humano, 2026-07-13)**

> **Elección del humano**: **opción (a)** — una unidad y un usuario de taller de prueba dedicados
> en producción, con limpieza posterior acordada (o aceptación de la historia de prueba). El humano
> debe entregar a `task_16` la placa/unidad de prueba y las credenciales del usuario de taller
> (desde el vault privado, `knowledge/ai/08:24`; **nunca** en estos documentos). Desbloquea la parte
> de confirmación real de `task_16` (pasa a PENDIENTE).

- **Evidencia**: el proyecto verificado es **producción** (`fbxupwwgiebhlciqftpw`, único activo,
  `AUDIT.md §9`). El backend probó contra datos efímeros con rollback (`CONTRATOS_UI.md:705-712`),
  pero un smoke de navegador **confirma** el lote (escribe historia real).
- **Alternativas**: (a) unidad/empresa de prueba dedicada en producción, con limpieza posterior
  acordada; (b) proyecto/branch de staging separado; (c) smoke de solo lectura + confirmación en
  entorno controlado.
- **Recomendación**: el humano define (a) una unidad de prueba aislada y un usuario con rol de
  taller, y aprueba la limpieza (o acepta la historia de prueba), **o** habilita (b). Sin esto,
  `task_16` no puede ejecutar el smoke con confirmación real.
- **Impacto**: alto (integridad de datos productivos). **Aprueba**: Humano/Seguridad (RESUELTA).
  **Bloquea**: `task_16` — desbloqueada; solo resta el insumo humano (placa/credenciales de prueba).

---

## Preguntas humanas — RESPONDIDAS (2026-07-13, task_01)

1. **Storage** (D3) → **privado + URL firmada**; path `<company_id>/<batch_id>/<seq>`, ~5 MB,
   JPEG/WebP. ✓
2. **Smoke** (D10) → **unidad/usuario de taller de prueba dedicada + limpieza**. Pendiente que el
   humano entregue placa/credenciales a `task_16` desde el vault privado. ✓
3. **supabase-js** (D8) → **fijar versión exacta ≥2.102.0, conservar retry**. ✓
4. **Selector de modo** (D1) → **tabs sobre el diagrama** (no header). ✓
5. **Interacción** (D2) → **selección por toques origen→destino**; D&D después. ✓
6. **Realtime** (D5) → **banner sin recargar el borrador**. ✓
7. **Encabezado del lote** (D6) → **odómetro obligatorio** (regla de UI). ✓

### Insumo que el humano aún debe entregar (no bloquea la planificación)
- Placa/unidad de prueba y credenciales del usuario de taller para el smoke de `task_16` (vía vault
  privado, nunca en el repo).
- Versión exacta concreta de `supabase-js` a fijar (o delegar en `task_07` la última estable
  ≥2.102.0).
