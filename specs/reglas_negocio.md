# Reglas de Negocio — RENOVA INSPECTOR

Fuente de verdad de TODAS las fórmulas, umbrales y lógica de decisión.
Toda implementación (Python backend, Dart cliente) debe replicar exactamente este documento.
Si el código y este archivo difieren, el código está mal.

---

## 1. RTD MOVI

El remanente operativo es el valor mínimo de todos los canales medidos.

```
RTD MOVI = MIN(RTD_A, RTD_B, RTD_C)          -- 3 canales medidos
RTD MOVI = MIN(RTD_A, RTD_B, RTD_C, RTD_D)   -- 4 canales medidos
```

**El número de canales lo determina cuáles vienen medidos, NO el TIPO EJE de la
posición.** RTD_D es opcional en cualquier eje — Libre/Dual lo miden casi siempre,
pero hay medidas/diseños que también se miden en 4 puntos en Dirección o Tracción.
El `tipo_eje` (catálogo `configuracion_vehiculo`, PATRON) es metadato descriptivo
de la posición; no restringe cuántos canales se pueden capturar.

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

> [!IMPORTANT]
> **Corregido el 2026-07-25** por el dueño de negocio. La versión anterior de esta sección
> modelaba la presión como `presion_ref` ± porcentajes (`delta_alto_pct` / `delta_bajo_pct`).
> **Ese modelo nunca fue el que usa el negocio** y sus valores de ejemplo eran incorrectos.
> La regla real son **rangos absolutos mín–máx por medida y tipo de eje**.
> Ver `decisions/0009-regla-de-presion-por-rangos.md`.

**Evaluación secuencial:**

```
if   presion IS NULL or sin_medir = TRUE:  ESTADO = "Sin Medir"      # ⚫
elif temperatura = CALIENTE:               ESTADO = NULL (sin regla)  # ⚪
elif presion > psi_max:                    ESTADO = "Alta Presión"    # 🔴
elif presion < psi_min:                    ESTADO = "Baja Presión"    # 🔴
else:                                      ESTADO = "Normal"          # 🟢
```

Los extremos son **inclusivos**: `psi_min` y `psi_max` son Normal.

**Rangos vigentes** (medición en FRÍO, iguales para las cuatro empresas actuales):

| Medida | Tipo de eje | Rango normal |
|---|---|---|
| 295/80R22.5 | Direccional | 100 – 125 PSI |
| 295/80R22.5 | Tracción / Libre | 100 – 125 PSI |
| 315/80R22.5 | Tracción / Libre | 100 – 125 PSI |
| **315/80R22.5** | **Direccional** | **105 – 125 PSI** |

**NUNCA hardcodear estos valores.** Viven en `pressure_thresholds`, filtrados por `company_id` +
`size_name` + `axle_type`; resuelve `fn_effective_pressure_thresholds()`, que aplica la fila más
específica (medida+eje > medida > eje > genérica). `size_name` o `axle_type` en NULL son comodín.

**Temperatura:**
- **FRÍO**: los rangos de arriba. Es el procedimiento de todas las empresas actuales, y
  `inspection_measurements.temperature_mode` tiene default `'COLD'` para dejarlo registrado.
- **CALIENTE**: **⚠️ PENDIENTE DE DEFINICIÓN, y es deuda genuina.** Las empresas que miden siempre
  en caliente son agencias de las que todavía no hay data; no es una decisión postergada por
  descuido, es información que no existe. **NO usar un valor inventado ni aplicarle la regla de
  frío.** `fn_pressure_state()` devuelve `NULL` —no un veredicto— cuando la medición es `'HOT'`.
  Reabrir cuando haya mediciones reales de una agencia contra las que calibrar.

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

### Rendimiento por ciclo actual y por conjunto

Contrato vigente del panel (ADR-0011):

```text
RTD gastado        = OTD del ciclo − RTD actual
Profundidad útil   = OTD − RTD retiro                 [D1]
Km ciclo           = Σ km de instalaciones de la vida actual
% desgaste         = RTD gastado / Profundidad útil × 100
Km/mm              = Km ciclo / RTD gastado
Km proyectado      = Km/mm × Profundidad útil
```

Para cualquier conjunto, incluida una sola unidad:

```text
Km/mm              = Σ Km ciclo / Σ RTD gastado
% desgaste         = Σ RTD gastado / Σ Profundidad útil × 100
Km proyectado      = Σ(Km proyectado × RTD gastado) / Σ RTD gastado
```

No se promedian tasas según la cantidad de placas. Una última medición con RTD mayor que la
inmediatamente anterior dentro de la instalación queda excluida de las métricas y declarada en
pantalla. El OTD es una propiedad del ciclo y se conserva como base tras rotaciones o traslados.
El kilometraje total de todas las vidas del casco se reserva para Historial de neumático.

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
