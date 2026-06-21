# STATUS — RENOVA INSPECTOR

**Fase actual:** Fase 0 — Scaffold del repo  
**Sprint activo:** ninguno (pre-Sprint 1)  
**Fecha:** 2026-06-21

---

## Próximo paso

**Fase 0 completa → empezar Sprint 1:**
1. Proveerte un slice real del Excel → `backend/tests/fixtures/real_sample.xlsx`
2. Confirmar ajuste de presión CALIENTE con RENOVA
3. `calcular_rtd_movi` + golden test verde

---

## Checklist Fase 0

- [x] `CLAUDE.md` (constitución global)
- [x] `specs/reglas_negocio.md` (fórmulas)
- [x] `specs/flujo_inspeccion.md` (UX)
- [x] `decisions/0001-tenancy.md`
- [x] `decisions/0002-calc-parity.md`
- [x] `decisions/0003-jwt-offline.md`
- [x] `decisions/0004-catalog-sync.md`
- [x] `STATUS.md`
- [x] Backend scaffold (`backend/app/`, `pyproject.toml`, venv)
- [x] Mobile scaffold (Flutter project inicializado, deps instaladas)
- [x] `.gitignore`, `.cursorignore`, `.cursor/rules/`
- [ ] `backend/tests/fixtures/real_sample.xlsx` ← **PENDIENTE (necesito el Excel)**
- [ ] Confirmar presión CALIENTE con RENOVA ← **PENDIENTE (decisión de negocio)**

---

## Blockers

| Blocker | Responsable | Estado |
|---|---|---|
| Slice del Excel real para fixtures | RENOVA (Facundo) | Pendiente |
| Valor de ajuste presión CALIENTE | RENOVA (Facundo) | Pendiente — ver `specs/reglas_negocio.md §3` |

---

## Checklist Sprint 1 (empieza cuando Fase 0 esté completa)

- [ ] `backend/app/core/calculations.py` — funciones puras
- [ ] `backend/tests/test_calculations_golden.py` — verde contra real_sample
- [ ] Modelos SQLAlchemy + migración Alembic inicial
- [ ] JWT auth + endpoints base
- [ ] Endpoint sync (UPSERT por UUID)
- [ ] Endpoints catálogo PATRON
