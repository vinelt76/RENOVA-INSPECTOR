# task_09 — Documentación, ADR y revisión cruzada

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

Dejar el conocimiento actualizado y registrar la primera decisión de arquitectura de UI del
proyecto. Cerrar la fase con un veredicto que separe lo verificado de lo pendiente.

## 3. Dependencias y bloqueos

Depende de `task_08`. No bloquea nada.

## 4. Archivos exclusivos

- `REVISION_FINAL.md` (nuevo, en esta carpeta)
- ADR nuevo en `decisions/`
- Notas de `knowledge/` enumeradas en §6
- Columna Revisión de `STATE.md`

## 5. ADR — el primero de UI del proyecto

`decisions/` tiene 4 ADRs, **todos de backend**. No existe ninguno sobre navegación, búsqueda ni
filtros (`AUDIT.md` §10). `CLAUDE.md` y `knowledge/ai/14 - Mantenimiento documental.md` exigen
documentar un patrón sistémico nuevo antes de introducirlo.

El ADR debe registrar, con su porqué:

1. **Dos objetos navegables y solo dos** (D2/D3). Es la regla que impide que el lenguaje del
   buscador crezca sin límite; sin ella, cada atributo nuevo pide su pantalla.
2. **Índice cacheado en cliente, no búsqueda servidor** (D4), con la escala que lo justifica y el
   umbral a partir del cual habría que revisarlo.
3. **Sin parsing silencioso de prosa a filtros** (D8), con el argumento de seguridad: un filtro mal
   inferido oculta neumáticos en un sistema que decide retiros.
4. **El buscador enruta, no ejecuta** (D9).
5. La alternativa considerada y descartada: la Command Palette como método principal de
   interacción, y por qué el diagnóstico original no se sostuvo contra la auditoría.

Registrar también la **limitación conocida**: un casco sin código no tiene página de historial
alcanzable, porque `historial-neumatico.html` filtra por `code=eq.`. No se inventó una ruta que el
backend no soporta.

## 6. Knowledge a actualizar

Siguiendo `knowledge/ai/14 - Mantenimiento documental.md`:

- La nota de **web/taller**: el buscador global y las dos páginas de objeto pasan a formar parte del
  mapa de superficies.
- La nota de **datos**: `v_search_index` como vista de lectura, su origen desde tablas base y por
  qué no deriva de las vistas de inventario.
- La nota de **diseño y UX** (`09`): el overlay como patrón, la Regla del Naranja Único aplicada al
  resultado activo y la reutilización de `a11y.js`.
- El **roadmap/deuda**: dejar registrado lo que esta fase destapó sin resolver, con la medición de
  `AUDIT.md` §5.2 ya hecha:
  1. **Variantes de caja en `brand_name`** — `GOODYEAR`/`goodyear`, `HANKOOK`/`hankook`,
     `BRIDGESTONE`/`Bridgestone`. No afecta al buscador; **sí parte tres marcas en seis filas en
     Rendimiento**. Remedio: `upper(trim())` en la RPC de escritura + backfill. Fase corta,
     idealmente **antes** del baseline de las 2 096 posiciones (hoy 36 cascos, después ~3 800).
  2. **`QA-TEST` en producción** — 9 cascos y 14 mediciones de datos de prueba mezclados con datos
     reales, contaminando agregaciones. Requiere decisión humana; no se propone borrado de oficio.
  3. Identidad de cascos sin código.
  4. Nav duplicada a mano en 7 archivos.
  5. `renova-animate.js`/`renova-format.js` fuera de la allowlist del bundle, si `task_07` lo
     confirmó.

  `size_name` **no** es deuda: la medición lo encontró limpio y canónico.

Ejecutar `npm run docs:check`.

## 7. Revisión cruzada

Verificar contra los criterios de `PLAN.md` §10, revisando el diff completo:

- contrato de datos respetado y `security_invoker` presente;
- `SELECT` solo a `authenticated`, nunca `anon`;
- ninguna vista, tabla, RPC o policy existente modificada;
- caché destruida al cambiar de empresa, con evidencia del paso 7 de `task_08`;
- suites existentes verdes **y sin modificar**;
- ningún enlace construido sobre código nulo;
- sin escritura en el buscador;
- sin `service_role`, secretos ni filas completas en logs ni en la bitácora.

## 8. Invariantes

- **No aprobar sin evidencia de smoke autenticado** en la bitácora (`tasks_opencode/WORKFLOW.md`).
- Separar en `REVISION_FINAL.md` la evidencia local de la evidencia de campo.
- Registrar lo pendiente como pendiente. Una fase que declara terminado lo que no se verificó es
  peor que una fase abierta.
- No ampliar el alcance en la documentación: lo de §6 último punto es deuda registrada, no trabajo
  hecho.

## 9. Aceptación

- ADR creado en `decisions/` con las cinco decisiones y la limitación conocida.
- Knowledge actualizado y `npm run docs:check` verde.
- `REVISION_FINAL.md` con veredicto, evidencia separada y deuda registrada.
- `STATE.md` con todas las filas cerradas o con su bloqueo explicado.

## 10. Handoff

Actualizar fila 09 y cerrar la fase. Cualquier petición de verbos en el buscador, filtros facetados,
favoritos almacenados o normalización de catálogos abre una fase separada con contratos propios.
