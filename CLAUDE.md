# RENOVA INSPECTOR — Constitución del Proyecto

App móvil (Flutter) para inspección de neumáticos en flotas de buses interprovinciales en Perú.
Reemplaza un proceso 100% manual en hoja de cálculo. ~5 empresas clientes.
Inspectores en campo registran RTD, presión y anomalías por vehículo/posición; el sistema
calcula salud en tiempo real y genera reportes Excel por empresa.

## Stack (cerrado — no proponer alternativas salvo pedido explícito)

- **Mobile:** Flutter (iOS + Android), offline-first con **Drift** (SQLite local).
- **Backend:** FastAPI (Python), **PostgreSQL** con row-level `empresa_id`, deploy en Railway.
- **Reportes:** `openpyxl` — generado en servidor, NO en cliente.
- **Auth:** JWT + refresh token; `empresa_id` en payload determina acceso a datos.
- **Fotos:** Cloudflare R2 (S3-compatible) — fuera del camino crítico de Sprint 1 y 2.

## Estructura del repo

```
/
├── CLAUDE.md                   ← este archivo (constitución global)
├── specs/
│   ├── reglas_negocio.md       ← ÚNICA fuente de verdad de fórmulas y umbrales
│   └── flujo_inspeccion.md     ← flujo UX del inspector
├── decisions/
│   ├── 0001-tenancy.md         ← por qué row-level, no schema-per-company
│   └── 0002-calc-parity.md     ← golden test: Python = Dart, siempre
├── backend/
│   ├── CLAUDE.md               ← reglas específicas del backend (carga lazy)
│   └── tests/fixtures/         ← slice del Excel real para golden tests
├── mobile/
│   └── CLAUDE.md               ← reglas específicas de Flutter (carga lazy)
└── implementation_plan.md      ← hoja de ruta de sprints
```

## Reglas de negocio — NUNCA negociar

La fuente de verdad de TODA la lógica de cálculo es `@specs/reglas_negocio.md`.
Si este archivo y `specs/reglas_negocio.md` difieren, `specs/reglas_negocio.md` manda.

- **RTD MOVI** = MIN de los canales medidos (A,B,C para Dirección/Tracción; A,B,C,D para Libre/Dual).
- **ESTADO RTD** se evalúa como if/elif secuencial, NO como condiciones paralelas:
  1. `RTD MOVI ≤ rtd_cambio` → "Para Reencauche"
  2. `RTD MOVI ≤ rtd_proximo` → "Próximo a Reencauche"
  3. else → "Normal"
- Los umbrales (`rtd_cambio`, `rtd_proximo`, `presion_ref`, `delta_alto_pct`, `delta_bajo_pct`,
  pesos de severidad ISA) son **configurables por empresa y por medida**. NUNCA hardcodear
  4/7/8 ni +5%/−10% en el código.
- **DESECHO** se auto-marca cuando la anomalía tiene `desecho=TRUE` en el catálogo PATRON.
- El catálogo PATRON **vive en la base de datos** y se sincroniza al dispositivo.
  NUNCA hardcodear listas (anomalías, tapas, diseños, configuraciones) en el cliente.
- **Paridad de cálculo obligatoria:** la lógica existe en Python (backend) Y Dart (cliente,
  semáforo offline). Ambas implementaciones DEBEN pasar el mismo golden test contra el
  Excel real (`@decisions/0002-calc-parity.md`). Cambiar una sin la otra es un bug.
- `inspeccion_cabecera.id` es un **UUID v4 generado en el dispositivo** al crear la inspección.
  NUNCA autoincrement de servidor — el sync offline colisionaría.
- **PRESIÓN CALIENTE:** la referencia de presión en modo CALIENTE no está definida en la spec
  actual. Antes de implementar `calcular_estado_presion()`, preguntar y documentar el ajuste
  en `specs/reglas_negocio.md`. NO inventar el valor.

## Cómo trabajamos

- **Spec-first.** Antes de escribir código de una feature, verificar contra `/specs` qué se
  está construyendo. Si la spec es ambigua, **preguntar — no asumir**. Una suposición
  silenciosa que termina en código es peor que una pregunta directa.
- **Golden test antes de feature.** El primer artefacto de cada módulo de cálculo es
  el test contra fixtures reales, no el feature. Ver `decisions/0002-calc-parity.md`.
- **Resolver, no orbitar.** Si algo falla, diagnosticar la causa raíz y arreglarla. No
  proponer el mismo enfoque dos veces. Si se está trabado, decirlo claramente y proponer
  2 caminos concretos.
- **Diffs pequeños y verificables.** Un cambio coherente por vez, con su test.
  No hacer reescrituras masivas sin avisar.
- **No agregar dependencias** sin decir por qué y qué reemplaza.
- Responder en **español**. Términos de dominio en español (medida, presión, desecho,
  remanente, RTD MOVI, eje, posición).

## Comandos (completar a medida que existan)

```bash
# Backend
cd backend && uvicorn app.main:app --reload
cd backend && pytest
cd backend && pytest tests/test_calculations_golden.py  # ← PRIMER TEST A PASAR

# Mobile
cd mobile && flutter run
cd mobile && flutter test
```

## Estado actual

**Fase 0 — setup.** No hay código de feature. El primer objetivo es:
1. Crear `specs/reglas_negocio.md` completo y aprobado.
2. Crear fixtures del Excel real en `backend/tests/fixtures/`.
3. El golden test del motor de cálculo verde contra el Excel real.

Recién después empieza Sprint 1.

## Decisiones abiertas que bloquean implementación

| Decisión | Estado | Dónde se cierra |
|---|---|---|
| Ajuste de presión en CALIENTE | **ABIERTA** — nunca especificada | `specs/reglas_negocio.md` |
| Expiración del JWT offline | **ABIERTA** | `decisions/0003-jwt-offline.md` |
| Versioning del catálogo PATRON | **ABIERTA** | `decisions/0004-catalog-sync.md` |
| Panel de Admin: ¿Fase 1 o Fase 2? | **ABIERTA** | `implementation_plan.md` |
