# RENOVA INSPECTOR — Constitución del Proyecto

App móvil para inspección de neumáticos en flotas de buses interprovinciales en Perú.
Reemplaza un proceso 100% manual en hoja de cálculo. ~5 empresas clientes.
Inspectores en campo registran RTD, presión y anomalías por vehículo/posición; el sistema
calcula salud y (a futuro) genera reportes Excel por empresa.

## Stack (cerrado — no proponer alternativas salvo pedido explícito)

- **App:** React + Vite + TypeScript, empaquetada a **APK con Capacitor** (Android primero).
  Las pantallas nacen de los prototipos React en `UI/`.
- **Persistencia:** **SQLite local, offline-first** vía `@capacitor-community/sqlite`
  (fallback web `jeep-sqlite`/sql.js para `npm run dev`).
- **Servidor / sync / auth:** **Supabase** (decidido 2026-07-01; fase 1 en `tasks_opencode/
  task_14_supabase_sync_fase1.md`). La app sigue siendo offline-first: sin configuración de
  Supabase funciona 100% local; el sync drena `sync_queue` cuando hay red. IDs UUID y
  `updated_at` ya estaban listos para esto.
- **Cálculos:** se replican en `app/src/core/calculations.ts` con **paridad** contra
  `reference/calculations.py`. Los cálculos de servidor (agregaciones, reportes) son fase futura.
- **Fotos:** Capacitor Camera. En este momento solo foto a nivel unidad (debajo del odómetro).

> Historial: hubo un enfoque previo Flutter + FastAPI + PostgreSQL + Railway (ver
> `implementation_plan.md`, anotado como **stack reemplazado**). El roadmap de features y el
> modelo de datos de ese documento siguen vigentes; el stack no.

## Estructura del repo

```
/
├── CLAUDE.md                 ← este archivo (constitución global)
├── specs/                    ← fuente de verdad de dominio
│   ├── reglas_negocio.md     ← ÚNICA fuente de fórmulas y umbrales
│   ├── flujo_inspeccion.md   ← flujo UX del inspector
│   └── catalogo_patron.md    ← categorías y valores reales del catálogo
├── decisions/                ← ADRs (tenancy, calc-parity, jwt-offline, catalog-sync)
├── docs/                     ← Excels REALES (fuente golden) — intocable
├── reference/                ← calculations.py + golden test (referencia para portar a TS)
├── implementation_plan.md    ← roadmap de features + modelo de datos (stack reemplazado)
├── UI/                       ← prototipos React originales (referencia visual)
├── tasks_opencode/           ← historial de specs + STATE.md (bitácora de trabajo, ver abajo)
├── knowledge/                ← contexto canónico para IA y guía humana; se sincroniza a Obsidian
└── app/                      ← LA APP (React + Vite + Capacitor)
```

### Contexto rápido para una IA nueva

Después de este archivo, leer `knowledge/ai/00 - LEER PRIMERO.md`. Esa base enlaza arquitectura,
datos, flujos, estado, roadmap, diseño y runbooks sin exigir releer todo el repo. Los archivos
en `knowledge/` son la fuente versionada; `npm run docs:sync` publica copias navegables en los
vaults de Obsidian. Si una nota contradice el código o la última migración, manda el código y
la nota debe actualizarse.

## Cómo trabajamos

Claude Code investiga, planifica y ejecuta directo sobre el repo — ya no hay un agente ejecutor
separado (el flujo previo de dos IAs vía `opencode` quedó discontinuado; `tasks_opencode/`
se conserva como bitácora histórica y se puede seguir usando para registrar specs/estado de
trabajo grande, pero no es obligatorio por task).

Reglas de trabajo:
- **Spec-first.** Antes de codear una feature, verificar contra `/specs`. Si la spec es ambigua,
  **preguntar — no asumir**.
- **Smoke test en navegador OBLIGATORIO** antes de dar por terminado cualquier cambio que toque UI
  o el camino web de SQLite. Verde en `build`/`test`/`lint` **NO alcanza** (justo así se coló el
  bug de "empresas vacías": todo compilaba, pero nadie corrió el flujo en el navegador). Recorrer:
  (1) `npm run dev` y el flujo afectado; (2) confirmar **cero errores en la consola** del navegador
  (sobre todo init de SQLite/seed) y que los datos **se ven** (no listas vacías); (3) si hay
  persistencia, capturar algo y **recargar** verificando que sobrevive. (No aplica a cambios de
  lógica pura cubiertos por unit tests, p.ej. el motor de cálculo.)

## Reglas de negocio — NUNCA negociar

Fuente de verdad de TODA la lógica de cálculo: `specs/reglas_negocio.md`. Si el código difiere,
el código está mal.

- **RTD MOVI** = MIN de los canales medidos (A,B,C para Dirección/Tracción; A,B,C,D para Libre/Dual).
- **ESTADO RTD** es if/elif **secuencial**, NO paralelo:
  1. `RTD MOVI ≤ rtd_cambio` → "Para Reencauche"
  2. `RTD MOVI ≤ rtd_proximo` → "Próximo a Reencauche"
  3. else → "Normal"
- Umbrales (`rtd_cambio`, `rtd_proximo`, `presion_ref`, `delta_alto_pct`, `delta_bajo_pct`,
  pesos ISA) son **configurables por empresa y medida**. NUNCA hardcodear 4/7/8 ni %.
- **DESECHO** se auto-marca cuando la anomalía tiene `desecho=TRUE` en el catálogo.
- El **catálogo vive en la base de datos** (hoy SQLite local sembrado; a futuro sync desde
  servidor). NUNCA hardcodear listas (anomalías, válvulas, diseños, configuraciones) en
  componentes — la UI lee de la DB.
- **Paridad de cálculo:** la lógica existe en `reference/calculations.py` (Python) y debe
  replicarse en `app/src/core/calculations.ts` (TS). Ver `decisions/0002-calc-parity.md`.
- `inspeccion_cabecera.id` e `inspeccion_neumatico.id` son **UUID v4 generados en el dispositivo**.
  NUNCA autoincrement — el sync futuro colisionaría.
- **PRESIÓN CALIENTE:** la referencia en modo CALIENTE **no está definida**. NO implementar
  `calcular_estado_presion` para CALIENTE hasta confirmar el valor con RENOVA y documentarlo en
  `specs/reglas_negocio.md`. NO inventar el valor.
- **Alcance MVP: SOLO BUSES** (configuraciones 2-4 y 2-4-2). El resto del catálogo queda con
  `mvp=false`. Ver `specs/catalogo_patron.md`.

## Comandos

```bash
cd app && npm install
cd app && npm run dev          # navegador (SQLite fallback web)
cd app && npm run build
cd app && npm test             # tests del data layer / calculations.ts
cd app && npx cap sync         # sincronizar al proyecto nativo
cd app && npx cap add android  # generar proyecto Android (APK tras review)
npm run docs:check             # valida notas, wikilinks y posibles secretos
npm run docs:sync -- --dry-run # muestra qué se copiará a Obsidian
npm run docs:sync              # sincroniza los dos vaults
```

## Estado actual

**Corte verificado: 2026-07-12.** La app React/Capacitor, SQLite offline-first, proyecto Android,
CI/CD, sincronización con Supabase, RLS de dashboards, Realtime y umbrales RTD configurables ya
están implementados. La cola de sync es durable y protege contra reintentos, datos legacy y
ediciones mientras un push está en vuelo. La última bitácora registra 44 tests verdes; volver a
ejecutarlos antes de tomar ese número como estado presente.

El 2026-07-12 se agregaron migraciones y superficies web para operaciones transaccionales de
taller y rutas/asignaciones temporales. Están implementadas en código, pero requieren una
validación E2E repetible antes de tratarlas como proceso de campo cerrado. Las pantallas
Inventario y Comparativo (con sus RPCs/vistas exclusivas `reinstall_tire`, `retread_casing`,
`v_removal_cause_ranking`, `v_comparison_cycle_rows`) se retiraron del dashboard web y de
Supabase el mismo día — decisión de producto, no un bug. `tasks_opencode/STATE.md` es bitácora
histórica: varias filas antiguas que dicen `PENDIENTE` quedaron desactualizadas frente al
código. Estado detallado y deuda vigente: `knowledge/ai/02 - Estado actual.md` y
`knowledge/ai/10 - Roadmap deuda y riesgos.md`.

## Decisiones abiertas que bloquean implementación futura

| Decisión | Estado | Dónde se cierra |
|---|---|---|
| Ajuste de presión en CALIENTE | **ABIERTA** — nunca especificada | `specs/reglas_negocio.md` |
| Identidad/login del inspector móvil | **ABIERTA** — la app opera con acceso `anon` acotado; dashboards sí usan Auth | `decisions/0003-jwt-offline.md` |
| Estrategia de sync con servidor | **IMPLEMENTADA fase 1**: `sync_queue` durable, RPC idempotente, backoff y LWW/guards por versión | `app/src/sync/`; `tasks_opencode/STATE.md` Lote 6 |
| Versioning del catálogo desde servidor | **ABIERTA** (el pull/versionado/borrado completo no está cerrado) | `decisions/0004-catalog-sync.md` |

## Idioma

Responder en **español**. Términos de dominio en español (medida, presión, desecho, remanente,
RTD MOVI, eje, posición).

## Cómo explicar fixes y bugs a Facundo

Facundo no es programador — explicarle un bug/fix en términos de código (nombres de archivo,
funciones, "race condition", "snapshot", etc.) no sirve. Para CUALQUIER fix o bug, explicar en
castellano llano, sin jerga técnica, con esta estructura:

1. **Qué pasaba antes** (el problema, en términos de la app real: qué vería o no vería un
   inspector, qué dato se guardaría mal, etc.) — no en términos de código.
2. **Qué se cambió** para arreglarlo, en una idea simple (una analogía o comparación cotidiana
   ayuda más que precisión técnica).
3. **Cuándo importa de verdad** — con qué frecuencia pasa, en qué caso concreto se nota, y en qué
   casos NO pasa nada (para que no piense que todo se rompe todo el tiempo).
4. Si el fix pudo afectar velocidad/experiencia: decirlo explícitamente y con la magnitud real
   (ej. "solo tarda de más en este caso puntual, como mucho X segundos").

Nada de "P1"/"P2", nombres de archivo, ni fragmentos de código salvo que Facundo los pida
explícitamente. Si hace falta profundidad técnica para otra sesión de Claude (seguimiento,
`STATE.md`, etc.), esa sí puede ir técnica — pero lo que se le dice a Facundo en el chat siempre
en este formato simple.

## Design Context

Sistema de diseño documentado para trabajo con `/impeccable` (agente de diseño frontend):

- **`PRODUCT.md`** — register `product`, usuarios (inspectores de campo, ~5 empresas),
  personalidad (robusto e industrial), anti-referencias (apps de flotas/logística legacy,
  dashboards SaaS genéricos), principios (cero fricción en campo, el dato manda no la
  decoración, paridad de cálculo antes que preferencia visual).
- **`DESIGN.md`** — sistema visual extraído del código real: paleta oscura de instrumento
  (navy/naranja/amarillo/verde + escala de grises fríos), tipografía JetBrains Mono para
  todo dato (Bebas Neue solo en el logotipo), estado por borde de 2px (no por sombra —
  sombra reservada a overlays flotantes), componentes documentados con snippets HTML/CSS.
- Sidecars: `.impeccable/design.json` (tokens completos, rampas de color) y
  `.impeccable/live/config.json` (modo live ya configurado sobre `app/index.html`).

Cualquier cambio visual en `app/` debería mantenerse consistente con `DESIGN.md`; si una
feature nueva necesita un patrón no cubierto ahí, actualizar el documento, no improvisar.
