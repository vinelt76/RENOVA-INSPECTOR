# RUN 6 — Estrategia de resolución de IDs (Fase 7)

La app conoce valores humanos (empresa, placa, posición, código); Supabase
necesita UUIDs. **Toda la resolución vive server-side en `save_inspection`**
(la app no cambió su modelo):

```
company_name ──lower(name)──▶ company_id   (fallback: única empresa activa de la demo)
(company_id, plate) ──upsert──▶ unit_id     (unidad nueva: status pending_validation,
                                             config por notation, default demo 2-4-2)
"posición" ──dígitos──▶ position_number     (acepta "3" y "P3")
(unit_id, position_number, removed=false) ──▶ tire_installation activa ──▶ life_cycle_id
life_cycle_id ──▶ casing_id                  (vía tire_life_cycles, para las vistas)
```

## Reglas

1. **Instalación activa por unidad+posición manda.** El código observado se usa
   como validación visual, no como resolutor único: se guarda tal cual en
   `inspection_measurements.tire_code` y cualquier discrepancia con el casco
   instalado queda **visible** comparando `tire_code` vs `casing_code` en
   `v_inspection_dashboard_rows` — nunca se fusiona en silencio.
2. **N/V no es un código.** `'N/V'`, `'NV'`, `'N-V'` (case-insensitive) →
   `tire_code = NULL`. La medición se acepta igual porque unidad+posición son
   conocidas. El estado del código del CASCO (`code_status`:
   valid/not_visible/pending_review) vive en `tire_casings`, no se duplica en
   la medición.
3. **Sin instalación activa** (unidad nueva o posición sin montaje registrado):
   `life_cycle_id = NULL`. La medición vale por sí misma; el rendimiento para esa
   posición aparecerá cuando exista la instalación (no se inventa una).
4. **Códigos duplicados** (caso real del Excel: 25324 en pos 3 y 7 de la unidad
   2145): el seed de run2 ya los marcó `pending_review` en el casco. La
   resolución por posición evita elegir un casco "a dedo"; la ambigüedad queda
   documentada en el `code_status`.
5. **Idempotencia:** `local_id` (UUID del dispositivo) = `inspections.id`;
   UNIQUE(unit, fecha) y UNIQUE(inspección, posición) hacen que reintentar el
   mismo push actualice en lugar de duplicar. Verificado con doble llamada.
