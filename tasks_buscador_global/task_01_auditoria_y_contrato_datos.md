# task_01 — Auditoría y contrato de datos

## 1. Propietario

**CLAUDE.**

## 2. Objetivo y resultado observable

Congelar qué existe hoy, qué duele con evidencia citable, y qué forma tendrá el índice antes de
escribir una línea de SQL. Resultado: `AUDIT.md`, `DECISIONES.md` y `CONTRATOS_DATOS.md` completos y
coherentes entre sí.

## 3. Dependencias y bloqueos

Sin dependencias. Bloquea `task_02` y `task_04`.

## 4. Archivos exclusivos

- `AUDIT.md`, `DECISIONES.md`, `CONTRATOS_DATOS.md`, `PLAN.md`, `PROMPT_ORQUESTADOR.md`, `STATE.md`

Solo lectura: `WEB/`, `supabase/migrations/`, `knowledge/`, `specs/`, `docs/`, `DESIGN.md`,
`PRODUCT.md`, `CLAUDE.md`.

## 5. Alcance de la auditoría

1. Superficie real de filtros y buscadores en `WEB/` — contrastar contra la premisa de la petición.
2. Dolor de navegación con citas `archivo:línea`, apoyándose en `docs/dashboard_ui_ux_audit.md`.
3. Primitivas reutilizables: búsqueda normalizada y overlay accesible.
4. Modelo de datos: identidad del neumático, cobertura de vistas, RLS, índices de texto.
5. Escala actual y proyectada.
6. Restricciones de `DESIGN.md` aplicables a un overlay.
7. Huecos no documentados, marcados como tales.

## 6. Invariantes

- Distinguir **evidencia estructural** (código) de **evidencia observacional** (usuarios). No hay
  telemetría ni observación de usuarios reales: debe decirse explícitamente.
- No proponer alcance que la auditoría no sostenga.
- Todo hallazgo remoto se cita desde documentos previos (`BASELINE_REMOTO.md`, `STATE.md` de fases
  anteriores) y se marca como **pendiente de reconfirmación**, no como verificado ahora.

## 7. Aceptación

- `CONTRATOS_DATOS.md` define columnas, nulabilidad, `status`, composición del `haystack`, destinos
  de navegación, política de caché y estados de error.
- `DECISIONES.md` registra las decisiones humanas D2 (dos objetos) y D4 (índice en cliente) y las
  derivadas de auditoría.
- `AUDIT.md` marca los huecos no documentados en vez de rellenarlos con supuestos.

## 8. Handoff

Actualizar fila 01. Señalar a `task_02` que la evidencia remota citada es de fases previas y debe
reconfirmarse contra el proyecto real antes de escribir la migración.

## 9. Estado

**APROBADO.** Auditoría local cerrada el 2026-07-19 sin consulta remota nueva.
