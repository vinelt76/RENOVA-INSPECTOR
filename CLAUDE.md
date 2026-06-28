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
- **Servidor / sync / auth:** **fase futura.** Por ahora todo es local; se dejan IDs UUID y
  `updated_at` listos y un `sync_queue` stub para reintegrar sync sin reescribir.
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
├── tasks_opencode/           ← task specs + WORKFLOW.md + STATE.md (ver "Cómo trabajamos")
└── app/                      ← LA APP (React + Vite + Capacitor) — la construye opencode
```

## Cómo trabajamos — flujo de dos IAs

El desarrollo se reparte entre dos agentes. **Detalle operativo en `tasks_opencode/WORKFLOW.md`.**

1. **Facundo** define la intención.
2. **Opus** (este agente) investiga, escribe el plan y **task specs autocontenidos** en
   `tasks_opencode/` (un `.md` numerado por task: objetivo · contexto/archivos · pasos ·
   criterios de aceptación · cómo verificar · fuera de alcance).
3. **opencode** (agente ejecutor) lee `tasks_opencode/`, implementa y marca estado en `STATE.md`.
4. **Opus** revisa el diff contra los criterios de aceptación: aprueba o pide correcciones.
5. Se itera hasta verde; recién entonces se avanza al siguiente lote (y, cuando aplique, se
   genera el APK).

Reglas del flujo:
- **opencode ejecuta tasks; no decide arquitectura.** Si un task es ambiguo, se corrige el spec,
  no se improvisa.
- **Opus es el dueño de la gobernanza:** `CLAUDE.md`, `specs/`, `decisions/` y los task specs los
  escribe Opus, no opencode.
- **Spec-first.** Antes de codear una feature, verificar contra `/specs`. Si la spec es ambigua,
  **preguntar — no asumir**.
- **Smoke test en navegador OBLIGATORIO** antes de marcar `LISTO PARA REVIEW`, para todo task que
  toque UI o el camino web de SQLite. Verde en `build`/`test`/`lint` **NO alcanza** (justo así se
  coló el bug de "empresas vacías": todo compilaba, pero nadie corrió el flujo en el navegador).
  opencode debe: (1) `npm run dev` y recorrer el flujo afectado; (2) confirmar **cero errores en la
  consola** del navegador (sobre todo init de SQLite/seed) y que los datos **se ven** (no listas
  vacías); (3) si hay persistencia, capturar algo y **recargar** verificando que sobrevive; (4)
  anotar en `STATE.md` qué recorrió y el resultado. Opus **no aprueba** un task de UI sin esa
  evidencia. (No aplica a tasks de lógica pura cubiertos por unit tests, p.ej. el motor de cálculo.)

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
# App (se completan cuando opencode cree app/)
cd app && npm install
cd app && npm run dev          # navegador (SQLite fallback web)
cd app && npm run build
cd app && npm test             # tests del data layer / calculations.ts
cd app && npx cap sync         # sincronizar al proyecto nativo
cd app && npx cap add android  # generar proyecto Android (APK tras review)
```

## Estado actual

**Reset hecho.** Stack viejo borrado; conservado lo fundacional. Pendiente: opencode construye
`app/` según `tasks_opencode/` (lote 1: scaffold → data layer → pantallas → 4 cambios), deja la
app **lista para generar el APK**, y Opus revisa antes de generarlo.

## Decisiones abiertas que bloquean implementación futura

| Decisión | Estado | Dónde se cierra |
|---|---|---|
| Ajuste de presión en CALIENTE | **ABIERTA** — nunca especificada | `specs/reglas_negocio.md` |
| Estrategia de sync con servidor | **ABIERTA** (fase futura) | `decisions/0003-jwt-offline.md`, `0004-catalog-sync.md` |
| Versioning del catálogo desde servidor | **ABIERTA** (fase futura) | `decisions/0004-catalog-sync.md` |

## Idioma

Responder en **español**. Términos de dominio en español (medida, presión, desecho, remanente,
RTD MOVI, eje, posición).
