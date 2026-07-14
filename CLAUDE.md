# RENOVA INSPECTOR

App Android para inspección de neumáticos de flotas peruanas. Inspectores de campo capturan
unidad, posición, identidad del neumático, RTD, presión y anomalías aun sin señal; jefes de flota
y taller consultan y operan sobre la información consolidada.

## Arquitectura y límites

- `app/`: React + Vite + TypeScript + Capacitor. SQLite es la copia de trabajo offline y
  `app/src/sync/` envía una cola durable a Supabase sin bloquear la captura.
- `supabase/migrations/`: esquema remoto ejecutable, RLS, vistas y RPCs. `WEB/` contiene los
  dashboards estáticos. Supabase es la verdad consolidada multiempresa.
- `app/src/core/calculations.ts` debe conservar paridad con `reference/calculations.py` y sus
  pruebas golden.
- El MVP de inspección cubre buses 2-4 y 2-4-2. No ampliar alcance ni cambiar el stack salvo
  pedido explícito.

Mapa detallado y comandos: `knowledge/ai/11 - Mapa del repo y runbook.md`.

## Knowledge y Obsidian: obligatorio antes de decidir

`knowledge/` es la fuente versionada; Obsidian recibe copias mediante `npm run docs:sync`.
Antes de planificar o implementar cambios de negocio, arquitectura, datos, sync o diseño:

1. Leer `knowledge/ai/00 - LEER PRIMERO.md`.
2. Abrir las notas y fuentes primarias que esa nota indique para la tarea.
3. Contrastar con el código, tests y migraciones que realmente se modificarán.

No duplicar especificaciones extensas en instrucciones. Actualizar knowledge cuando cambien el
estado, un contrato, una decisión, una regla o un patrón visual; seguir
`knowledge/ai/14 - Mantenimiento documental.md` y ejecutar `npm run docs:check`.

Autoridad resumida: specs aprobadas y ADRs vigentes definen la intención; código, esquema y tests
definen el estado implementado; knowledge lo resume y navega; `docs/run*` y `tasks_opencode/` son
historia. Un conflicto entre intención e implementación no se resuelve silenciosamente: detenerse,
mostrar la evidencia y confirmar si corresponde corregir código o aprobar/documentar el cambio.

## Invariantes críticas

- Offline-first: un fallo de red nunca impide guardar localmente ni autoriza borrar sin
  confirmación remota. UUID de inspecciones nacen en el dispositivo; sync/RPCs deben tolerar
  reintentos, ediciones en vuelo y datos heredados.
- Fórmulas y umbrales: consultar `specs/reglas_negocio.md` y
  `specs/reglas_fijas_vs_configurables.md`; no inventar ni hardcodear. La presión CALIENTE sigue
  sin definición. Catálogos, empresas, configuraciones y umbrales viven en datos, no componentes.
- Supabase: leer migraciones en orden antes de tocar el esquema. Preservar RLS por empresa,
  `security_invoker` donde corresponda, idempotencia, compatibilidad legacy y operaciones
  transaccionales. Nunca exponer `service_role`, secretos o contraseñas.
- No inventar tablas, campos, rutas o contratos. Buscar usos y pruebas existentes; separar UI,
  persistencia local, sync, reglas de negocio y agregaciones SQL.
- Diseño: leer `DESIGN.md`, `PRODUCT.md`, `knowledge/ai/09 - Diseno y UX.md` y el prototipo
  relevante en `UI/`. Reutilizar tokens/componentes; mantener navegación, jerarquía, estados,
  espaciado y respuesta móvil. Documentar antes de introducir un patrón sistémico nuevo.
- `docs/` contiene auditorías históricas; las planillas locales bajo `docs/` (si están presentes)
  son fuentes reales de solo lectura. Los fixtures golden del motor están en `reference/`.

## Cierre proporcional al cambio

- Ejecutar tests/lint/build relevantes; para cálculos usar `/calc-parity-check`.
- Si toca UI o SQLite web, hacer smoke test del flujo afectado con consola limpia, datos visibles
  y recarga persistente. Build/tests por sí solos no bastan.
- Antes de aplicar una migración sensible, usar el agente `sync-migration-reviewer` y verificar
  orden, RLS, permisos, idempotencia, legacy y tests SQL. No aplicar cambios remotos destructivos
  o difíciles de revertir sin aprobación explícita.
- Responder en español y usar los términos de dominio del proyecto.
