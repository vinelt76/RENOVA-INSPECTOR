# Contratos de datos y fórmulas

Este archivo es la referencia única de la fase. Si una tarea necesita una fórmula, la lee de acá.
Cambiar algo de este archivo es cambiar el contrato: se discute, no se ajusta al pasar.

---

## 1. Vocabulario

| Término | Definición | Origen |
|---|---|---|
| **RTD inicial** | Profundidad al montar ESTE neumático en ESTA posición | `tire_installations.rtd_at_install_mm` |
| **OTD** | Profundidad original de la banda del ciclo | `tire_life_cycles.otd_mm` |
| **RTD retiro** | Umbral por empresa bajo el cual se baja el neumático | `rtd_thresholds.rtd_removal_mm` |
| **RTD actual** | RTD MOVI de la última inspección | `inspection_measurements.rtd_movi_mm` |
| **Profundidad útil** | `OTD − RTD retiro` — la vida realmente disponible de la banda | derivado |

**Los milímetros por debajo del RTD de retiro no son vida.** Son margen de seguridad. Por eso todo
se mide contra la profundidad útil y no contra la profundidad total. Esto está **probado** contra la
planilla: dos filas independientes fijan el denominador en 12 y no en 16.

**La base es el OTD del ciclo, siempre (D1, decidida 2026-07-26).** Vale igual si el neumático se
rota dentro de la unidad, se trae de otro vehículo o sale del retén: el OTD es una propiedad del
ciclo de vida y el ciclo no cambia porque cambie el carro. Lo que sí viaja con el neumático es **el
kilometraje que hizo en los vehículos anteriores dentro de su vida actual**.

## 2. Por neumático

```
RTD gastado        = OTD − RTD actual              ← lo gastado en la VIDA ACTUAL
Profundidad útil   = OTD − RTD retiro              ← la banda entera, D1
Km ciclo           = Σ km de instalaciones de la vida actual
% desgaste         = RTD gastado / Profundidad útil × 100
Km/mm              = Km ciclo / RTD gastado
Km proyectado      = Km/mm × Profundidad útil
VUR                = max(0, Km/mm × (RTD actual − RTD retiro))
Costo/Km           = Costo / Km ciclo               [definición vigente; D6 abierta]
Km acumulado       = Km ciclo
```

### Identidades que deben cumplirse

```
% desgaste = 100 %  ⟺  RTD actual = RTD retiro           (siempre)
Km ciclo + VUR = Km proyectado                            (siempre, con ciclo completo)
```

Rotar, pasar por retén o trasladar el neumático no reinicia OTD, RTD gastado ni kilómetros. Un nuevo
reencauche sí abre otro ciclo. `casing_km_accumulated`, que suma todas las vidas, pertenece al
historial del neumático y no participa de Rendimiento.

El acumulado del ciclo solo existe si todos sus tramos tienen kilometraje. La vista usa
`bool_and(km_run is not null)`; si falta un tramo devuelve `NULL`, nunca una suma parcial.

### Reglas de nulidad

- Sin `RTD retiro` → `% desgaste`, `Km proyectado` y `Costo/Km` son **null**. `Km/mm` sigue válido:
  el ritmo se conoce aunque no se sepa hasta dónde proyectarlo.
- Profundidad útil ≤ 0 → mismas métricas en **null**. No se divide por cero ni se invierte el signo.
- Costo ausente → `Costo/Km` **null**, nunca `0`. Un costo desconocido no es gratis.
- `null` nunca se sustituye por `0` en ningún punto de la cadena.

## 3. Por conjunto

Una sola estadística para cualquier conjunto, incluso una única unidad. La cantidad de placas no
cambia el significado de las tarjetas.

```
Km/mm          = Σ Km ciclo / Σ RTD gastado
% desgaste     = Σ RTD gastado / Σ Profundidad útil × 100
Km proyectado  = Σ(Km proyectado × RTD gastado) / Σ RTD gastado
Costo/Km       = Σ Costo / Σ Km ciclo                [definición vigente; D6 abierta]
VUR            = mediana(VUR)
Km acumulado   = mediana(Km acumulado)   [la tarjeta] · suma [el total]
```

La paridad con la planilla se exige por fila/neumático. El promedio del renglón total del Excel
queda como referencia histórica y no gobierna el KPI del panel.

### 3.1 Identidad del ponderado

Cuando la profundidad útil es igual para todo el conjunto —el caso normal—:

```
Km proyectado (ponderado) = Km/mm (razón de sumas) × Profundidad útil       [exacto]
```

Con profundidades útiles distintas **la identidad no aplica** y no debe afirmarse. Sigue siendo un
ponderado válido: siempre cae dentro de `[mín, máx]` de las proyecciones individuales.

## 4. Medición inconsistente

Una posición cuya última inspección declara **más RTD que la anterior** no puede producir métricas
de rendimiento: el neumático no crece.

```
inconsistente ⟺ ∃ inspecciones consecutivas i, i+1 en la ventana de la instalación
                 tales que rtd_movi(i+1) > rtd_movi(i)
```

Vale igual si hubo un cambio de neumático real: **hasta que el cambio se registre como instalación,
la fila no describe a ningún neumático**, porque mezcla el RTD inicial de uno con el RTD actual de
otro. Registrar el cambio es fase 2.

Una posición inconsistente:

- **no aporta** a ninguna agregación;
- **se declara** en pantalla con su motivo, como ya se hace con `units.is_test`;
- **no se esconde**: ADR-D8 rechazó ocultar filas en silencio.

Señal secundaria, útil para el motivo pero insuficiente como detector: el `tire_code` de la última
inspección difiere del `casing_code` de la instalación. No alcanza porque hay posiciones sin código
en ninguna de las dos inspecciones (225 P4 y P5), y ahí el salto de RTD es la única evidencia.

## 5. Contrato de la vista

`v_rendimiento_dashboard_rows` debe exponer, además de lo que ya tiene:

| Columna | Tipo | Para qué |
|---|---|---|
| `prev_inspection_rtd_mm` | `numeric` | Detectar el RTD creciente |
| `prev_inspection_on` | `date` | Declarar contra qué inspección se comparó |
| `last_inspection_tire_code` | `text` | Distinguir «cambio no registrado» de «error de medición» |

`CREATE OR REPLACE VIEW` **solo permite agregar columnas al final**. Las tres van al final, en ese
orden, sin tocar ni reordenar las existentes.

## 6. Qué queda fuera de este contrato

- **El balance Izquierda/Derecha del eje**, que usa `mean()` de km/mm. Cambiarlo mueve el umbral de
  balance del 15 %: es decisión de negocio.
- **La duplicación SQL / JS.** Las mismas fórmulas viven en `supabase/views_demo.sql` y en
  `WEB/rendimiento.html`. `task_03` las alinea; unificarlas es otra fase.
