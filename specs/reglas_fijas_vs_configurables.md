# Reglas FIJAS vs CONFIGURABLES — RENOVA INSPECTOR

Documento de **insight de gobernanza**. Resume qué de la lógica de negocio es estructuralmente fijo
(no se negocia esta fase) y qué está pensado como configurable por empresa/medida, y deja registrado el
**estado real de la implementación hoy** (la deuda). Fuente de verdad de las fórmulas:
`specs/reglas_negocio.md`. Si el código difiere de las reglas, el código está mal.

> Para qué sirve: dar visibilidad de qué números puede tocar cada empresa a futuro y qué *no* cambia nunca,
> y evitar que se "hardcodee" como definitivo algo que debe ser parametrizable.

---

## 1. FIJO — la *forma* de la fórmula no se negocia

Estas reglas están implementadas en `app/src/core/calculations.ts` (paridad con
`reference/calculations.py`, ver `decisions/0002-calc-parity.md`). Su **estructura** es inmovible:

| Regla | Definición fija | Dónde |
|---|---|---|
| **RTD MOVI** | `MIN` de los canales **medidos** (A,B,C siempre; D opcional en CUALQUIER eje, no solo Libre/Dual). El `tipo_eje` es descriptivo, no restringe canales. Nunca sustituir un canal faltante por 0. | `calcularRtdMovi` |
| **ESTADO RTD** | `if/elif` **secuencial**: `≤ rtd_cambio` → "Para Reencauche"; `≤ rtd_proximo` → "Próximo a Reencauche"; else "Normal". | `calcularEstadoRtd` |
| **IDI** | `MAX − MIN` de los mismos canales. | `calcularIdi` |
| **DESECHO** | Se auto-marca si la anomalía tiene `desecho=TRUE` en `cat_anomalia` (solo 13 de 67). También manual. Nunca por heurística. | `inspeccionRepo.calcularDesecho` |
| **ESTADO PRESIÓN (FRÍO)** | Secuencial: Sin Medir / Alta (`> ref·(1+delta_alto)`) / Baja (`< ref·(1−delta_bajo)`) / Normal. | `calcularEstadoPresion` |
| **VUR** | `(RTD_MOVI − rtd_cambio) / tasa_acum · 1000`, con casos NULL/0/<0 obligatorios. | `calcularVur` |
| **Tasa de desgaste** | `(RTD_anterior − RTD_actual)/(km_actual − km_anterior)·1000`; NULL si km iguales. | `calcularTasaDesgaste` |
| **ISA** | `Σ(peso_i)/total_inspecciones`. | `calcularIsaPeso` |

**Prohibido esta fase (no inventar):**
- **PRESIÓN en CALIENTE**: la referencia para temperatura CALIENTE **no está definida**. NO implementar el
  cálculo de estado de presión en CALIENTE hasta confirmarlo con RENOVA y documentarlo en
  `reglas_negocio.md`. (Nota: los Excels reales de CTA traen filas con `TEMPERATURA = CALIENTE`; se puede
  **guardar el dato**, pero NO calcular su estado.)
- **Solo BUSES** (configuraciones `2-4` y `2-4-2`) en el MVP. El resto del catálogo queda `mvp=false`.

---

## 2. CONFIGURABLE por diseño — parámetros por empresa / medida / eje

Según `reglas_negocio.md`, estos valores son **parámetros**, no constantes. La *forma* de la fórmula es fija
(§1); estos números deberían venir de configuración por empresa (a futuro, tablas `umbral_rtd` /
`umbral_presion`):

| Parámetro | Default | Varía por | Regla |
|---|---|---|---|
| `rtd_cambio` | 4 mm | empresa + medida | Estado RTD §2, VUR |
| `rtd_proximo` | 7 mm | empresa + medida | Estado RTD §2 |
| `presion_ref` (frío) | p.ej. 110/115 PSI según medida y eje | empresa + medida + tipo_eje | Estado presión §3 |
| `delta_alto_pct` | 5 % | empresa + medida + eje | Estado presión §3 |
| `delta_bajo_pct` | 10 % | empresa + medida + eje | Estado presión §3 |
| pesos ISA | 5 / 1 / 0 (desecho / anomalía / normal) | empresa | ISA §6 |
| umbral desecho prematuro | configurable | empresa | §11 |

---

## 3. Estado REAL hoy (la deuda — esto es lo que conviene tener presente)

A pesar de que §2 dice "configurable", **hoy nada de eso es configurable en runtime**. La app MVP usa
valores fijos:

- **Umbrales RTD hardcodeados.** `app/src/db/repos/inspeccionRepo.ts:8-9`:
  `DEFAULT_RTD_CAMBIO = 4`, `DEFAULT_RTD_PROXIMO = 7`. Es exactamente el "NUNCA hardcodear 4/7" que advierte
  `CLAUDE.md`; está como deuda consciente, con `TODO`.
- **No existen las tablas `umbral_rtd` / `umbral_presion`.** El schema (`schema.ts`) no las tiene; no hay
  capa de configuración por empresa.
- **El seed ya contempla umbrales por neumático.** `seed.ts` usa `n.umbral_cambio ?? 4` /
  `n.umbral_proximo ?? 7` (y los datos demo pueden traer `umbral_cambio/proximo/normal`). O sea: el dato de
  origen ya admite umbrales variables, pero la app no los consume de forma configurable.
- **Estado de presión / VUR / tasa / ISA: implementados pero NO conectados a la UI.**
  `calcularEstadoPresion`, `calcularVur`, `calcularTasaDesgaste`, `calcularIsaPeso` existen en
  `calculations.ts` con tests, pero ninguna pantalla los muestra todavía. La inspección hoy solo persiste y
  muestra RTD MOVI / IDI / estado RTD.

### Resumen de una línea
> **Estructura de fórmulas = fija y correcta.** **Parametrización por empresa = diseñada pero no
> implementada** (hoy todo corre con defaults fijos). Llevar los umbrales a configuración por empresa es
> trabajo de **fase futura**; en esta fase **solo se documenta** (decisión de Facundo, 2026-06-27).

---

## 4. Cuándo cerrar la deuda (fase futura, no ahora)
- Diseñar `umbral_rtd` / `umbral_presion` (por empresa + medida + eje) y sembrarlas desde el catálogo.
- Reemplazar el `4/7` hardcodeado de `inspeccionRepo.ts` por lectura de esas tablas.
- Conectar presión/VUR/tasa/ISA a la UI cuando el flujo lo requiera.
- Confirmar y documentar la referencia de presión **CALIENTE** antes de habilitar su cálculo.

Ver también: `decisions/0004-catalog-sync.md` (versionado del catálogo) y `specs/reglas_negocio.md`.
