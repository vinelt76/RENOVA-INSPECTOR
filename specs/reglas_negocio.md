# Reglas de Negocio — RENOVA INSPECTOR

Fuente de verdad de TODAS las fórmulas, umbrales y lógica de decisión.
Toda implementación (Python backend, Dart cliente) debe replicar exactamente este documento.
Si el código y este archivo difieren, el código está mal.

---

## 1. RTD MOVI

El remanente operativo es el valor mínimo de todos los canales medidos.

```
RTD MOVI = MIN(RTD_A, RTD_B, RTD_C)          -- 3 canales (Dirección, Tracción)
RTD MOVI = MIN(RTD_A, RTD_B, RTD_C, RTD_D)   -- 4 canales (Libre, Dual)
```

**El número de canales lo determina el TIPO EJE de la posición**, no el neumático en sí.
El `tipo_eje` viene del catálogo `configuracion_vehiculo` (PATRON).

**Validación de entrada:** cada RTD_x debe ser ≥ 0 mm. Si es negativo, rechazar.
Rango esperado en campo: 0–22 mm. Valores > 22 mm deben generar advertencia (posible error de tipeo).

---

## 2. ESTADO RTD

**Evaluación secuencial (if/elif) — NO paralela:**

```
if   RTD_MOVI ≤ rtd_cambio:   ESTADO = "Para Reencauche"     # 🔴
elif RTD_MOVI ≤ rtd_proximo:  ESTADO = "Próximo a Reencauche" # 🟡
else:                          ESTADO = "Normal"               # 🟢
```

**Umbrales por defecto** (configurables por empresa y medida en tabla `umbral_rtd`):

| Campo | Default actual | Comentario |
|---|---|---|
| `rtd_cambio` | 4 mm | Límite operativo mínimo |
| `rtd_proximo` | 7 mm | Zona de advertencia |
| `rtd_normal_min` | 8 mm | Referencia informativa (>7 = Normal) |

**NUNCA hardcodear estos valores.** Siempre leer de `umbral_rtd` filtrado por `empresa_id` + `medida`.

---

## 3. ESTADO PRESIÓN

**Evaluación secuencial:**

```
if   presion IS NULL or sin_medir = TRUE:    ESTADO = "Sin Medir"    # ⚫
elif presion > presion_ref * (1 + delta_alto_pct/100): ESTADO = "Alta Presión"  # 🔴
elif presion < presion_ref * (1 - delta_bajo_pct/100): ESTADO = "Baja Presión"  # 🔴
else:                                         ESTADO = "Normal"       # 🟢
```

**Umbrales por defecto** (configurables por empresa, medida y tipo_eje en `umbral_presion`):

| Campo | Default | Comentario |
|---|---|---|
| `delta_alto_pct` | 5% | +5% sobre referencia → Alta |
| `delta_bajo_pct` | 10% | −10% bajo referencia → Baja |

**`presion_ref` según temperatura:**
- FRÍO: usar `presion_frio` de la tabla `umbral_presion`.
- CALIENTE: **⚠️ PENDIENTE DE DEFINICIÓN** — el ajuste de referencia para temperatura CALIENTE
  no está especificado en el Excel ni en la documentación actual. Antes de implementar el
  cálculo para CALIENTE, obtener del equipo RENOVA el valor correcto y documentarlo aquí.
  NO usar un valor inventado. Opciones típicas de la industria: +6% a +8% sobre presión fría,
  pero deben confirmarse contra los datos reales del Excel.

**Ejemplo real del Excel** (para verificar implementación):
- 315/80R22.5 Dirección: ref = 110 PSI → Alta desde 116 PSI (110 × 1.05), Baja desde 99 PSI (110 × 0.90)
- 315/80R22.5 Tracción/Libre: ref = 115 PSI → Alta desde 122 PSI, Baja desde 103 PSI

---

## 4. IDI — Índice de Desgaste Irregular

```
IDI = MAX(RTD_A..canales) - MIN(RTD_A..canales)
```

Usar los mismos canales que RTD MOVI (3 o 4 según tipo_eje).

| IDI | Estado | Color |
|---|---|---|
| 0–1 | Desgaste parejo — Normal | 🟢 |
| 2–3 | Desgaste leve — Monitorear | 🟡 |
| ≥ 4 | Desgaste irregular — Alerta | 🔴 |

**Evidencia del Excel:** bus 8260, posición 7: RTD_A=10, B=9, C=7, D=4 → IDI=6, anomalía "Desgaste excesivo en hombro interno". El IDI es la señal anticipatoria.

---

## 5. DESECHO automático

Cuando el inspector selecciona una anomalía con `desecho = TRUE` en el catálogo PATRON,
el campo `desecho` del registro `inspeccion_neumatico` se marca automáticamente.

El campo `desecho` también puede marcarse manualmente por el inspector independientemente
de la anomalía (neumático destruido por accidente, etc.).

Anomalías con `desecho=TRUE` en el catálogo (lista no exhaustiva):
Carcasa fatigada, Desgarro en flanco cuerdas expuestas, Exceso de rodado, Exceso de frenado,
Rotura de cuerdas radiales, Separación de cinturones, Separación estructural, Zipper en flanco.

---

## 6. ISA — Índice de Severidad de Anomalías

```
ISA = Σ(peso_i) / total_inspecciones_del_período
```

| Condición | Peso por defecto | Configurable |
|---|---|---|
| Anomalía con `desecho=TRUE` | 5 | Sí, por empresa |
| Anomalía con `desecho=FALSE` | 1 | Sí, por empresa |
| Sin anomalía (Normal) | 0 | — |

---

## 7. Tasa de Desgaste

Requiere ≥ 2 inspecciones del mismo neumático (`codigo`) en la misma posición del mismo vehículo,
con `km_actual > km_anterior`.

```
Tasa_instanea (mm/1000km) = (RTD_MOVI_anterior - RTD_MOVI_actual) / (km_actual - km_anterior) * 1000
```

Almacenar tanto tasa instantánea (entre las dos últimas) como tasa acumulada (desde instalación).
La tasa acumulada es más confiable para proyección.

**Condición de validez:** si `km_actual == km_anterior` → tasa = NULL (no calcular, no dividir por cero).

---

## 8. VUR — Vida Útil Remanente

Requiere tasa acumulada disponible y ≥ 2 inspecciones.

```
VUR (km) = (RTD_MOVI - rtd_cambio) / Tasa_acumulada * 1000
```

**Casos especiales (obligatorio manejar):**

| Condición | Resultado |
|---|---|
| `Tasa_acumulada == 0` o NULL | VUR = NULL — "Sin datos suficientes" |
| `RTD_MOVI ≤ rtd_cambio` | VUR = 0 — "Cambio inmediato" |
| `Tasa_acumulada < 0` | VUR = NULL — "Dato inválido" (RTD aumentó entre inspecciones — error de medición) |

---

## 9. Cumplimiento de Presión (%)

```
Cumplimiento_pct = count(ESTADO_PRESION = 'Normal') / count(ESTADO_PRESION != 'Sin Medir') * 100
```

Segmentar por tipo_eje, vehículo, empresa, período.

---

## 10. Distribución ESTADO RTD

```
pct_normal  = count(ESTADO_RTD = 'Normal')               / total * 100
pct_proximo = count(ESTADO_RTD = 'Próximo a Reencauche') / total * 100
pct_para    = count(ESTADO_RTD = 'Para Reencauche')       / total * 100
```

Comparar con el período anterior para detectar tendencia de deterioro.

---

## 11. Desecho Prematuro

Requiere: VUR calculada antes del desecho + km efectivos recorridos desde instalación.

```
desecho_prematuro = TRUE  si (VUR_proyectada - km_efectivos_recorridos) > umbral_configurable
```

Al marcar desecho, atribuir causa según `posible_causa` del catálogo PATRON.

---

## Fuente de verdad del catálogo PATRON

Toda lista de valores válidos (anomalías, tapas de válvula, diseños de reencauche,
configuraciones de vehículo, umbrales) vive en la base de datos PostgreSQL.
Se sincroniza al dispositivo vía catálogo versionado. NUNCA hardcodear en el cliente.

### Versioning del catálogo (a definir en `decisions/0004-catalog-sync.md`)

El catálogo debe tener un campo `catalog_version` o `updated_at` que permita al cliente
detectar si necesita re-sincronizar. Esquema a definir antes de Sprint 1.

---

## Tipos de vehículo y configuraciones (del PATRON)

| Tipo | Configuración | Posiciones | Descripción |
|---|---|---|---|
| BUS | 2-4-2 | 8 | Eje dir (2) + tracción (4) + libre (2) |
| TRACTO | 2-2-2 | 6 | — |
| TRACTO | 2-4 | 6 | — |
| TRACTO | 2-2-4-4 | 12 | — |
| CARRETA | 4-4 | 8 | — |
| CARRETA | 4-4-4 | 12 | — |
| SEMIREMOLQUE | 4-4-4 | 12 | — |
| FURGON | 2-4 | 6 | — |

El campo `piso` (SÍ/NO) indica si la posición es neumático en tierra o repuesto elevado.
