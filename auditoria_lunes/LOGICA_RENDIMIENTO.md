# Lógica de Rendimiento — estado verificado 2026-07-26

Este documento resume el contrato vigente. La evidencia detallada está en
`tasks_paridad_rendimiento/AUDIT.md`; las decisiones, en `DECISIONES.md` y ADR-0011.

## 1. Cadena de datos

```text
inspection_measurements ─┐
tire_installations ──────┼→ v_installation_activity → v_installation_km
tire_life_cycles ────────┘             ↓
                                  v_tire_performance
                                           ↓
                              v_rendimiento_dashboard_rows
                                           ↓
                              buildTireRowsFromSupabase()
                                           ↓
                                  computeTire()
                                           ↓
                                  computeGroup()
```

Las vistas usan `security_invoker=true` y exponen `SELECT` a `authenticated`, no a `anon`.
`v_rendimiento_dashboard_rows` agrega al final:

| Columna | Uso |
|---|---|
| `prev_inspection_rtd_mm` | RTD de la inspección inmediatamente anterior en la instalación |
| `prev_inspection_on` | fecha contra la que se compara |
| `last_inspection_tire_code` | motivo orientativo del salto |

## 2. Fórmulas por neumático

```text
RTD gastado        = OTD del ciclo − RTD actual
Profundidad útil   = OTD − RTD retiro              [D1]
Km ciclo           = Σ km de instalaciones de la vida actual
% desgaste         = RTD gastado / Profundidad útil × 100
Km/mm              = Km ciclo / RTD gastado
Km proyectado      = Km/mm × Profundidad útil
VUR                = max(0, Km/mm × (RTD actual − RTD retiro))
Costo/Km           = Costo / Km ciclo              [D6 abierta]
Km acumulado       = Km ciclo
```

La corrección demostrada por la planilla es el denominador útil:

- 225 P3: 12 mm gastados / 12 útiles = 100 %.
- 225 P5: 6 mm gastados / 12 útiles = 50 %.

### D1 resuelta: OTD del ciclo

En las filas actuales `rtd_at_install_mm == otd_mm`; la planilla no distingue las bases. El dueño
decidió que OTD es propiedad del ciclo y se conserva aunque el neumático rote o cambie de unidad.
Las dos pruebas sintéticas que distinguen el caso están activas:

- proyectar sobre el OTD;
- declarar que `km recorrido + VUR` no incluye los kilómetros de instalaciones anteriores.

Una migración inicial asumió RTD al instalar. La migración
`20260726190723_defer_projection_basis_pending_d1.sql` restableció OTD sin borrar historial; D1
posteriormente confirmó esa base. `20260726213000_rendimiento_current_cycle_metrics.sql` completó
la decisión usando kilómetros y desgaste acumulados del ciclo.

### Nulidad

Sin umbral o con profundidad útil no positiva, desgaste, proyección, VUR y costo quedan `null`.
Km/mm puede seguir siendo válido. Un dato desconocido nunca se convierte en cero.

## 3. Agregación de cualquier conjunto

No existe una rama por cantidad de placas.

| Tarjeta | Estadística |
|---|---|
| Km/mm | `Σ km recorrido / Σ RTD gastado` |
| Consumo | `Σ RTD gastado / Σ profundidad útil × 100` |
| Km proyectado | `Σ(proyectado × RTD gastado) / Σ RTD gastado` |
| Costo/km | razón de sumas sobre la definición vigente |
| Km acumulado | mediana en tarjeta; suma en total |
| VUR | mediana |

### Por qué también dentro de una unidad

Una unidad puede recibir neumáticos en momentos distintos. Promediar las tasas da el mismo peso a
0,1 mm que a 8 mm de desgaste observado. Ejemplo cubierto por prueba:

```text
50 000 / 0,1 = 500 000 km/mm
80 000 / 8   =  10 000 km/mm
promedio simple       = 255 000
razón de sumas        = 130 000 / 8,1 = 16 049
```

Si todos tienen igual rendimiento individual, promedio y ponderado coinciden. Entrar el mismo día
no basta para garantizarlo: si el desgaste difiere, la diferencia es información.

La planilla promedia el total de una unidad. El panel conserva paridad por neumático, pero
deliberadamente no reproduce ese total rápido.

### Identidad de la proyección

Con igual profundidad útil para todas las filas:

```text
Km proyectado ponderado = Km/mm ponderado × profundidad útil
```

Con profundidades distintas sigue siendo un ponderado dentro del rango observado, pero no se
afirma esa identidad.

## 4. Medición inconsistente

```text
inconsistente ⇔ RTD actual > RTD inmediatamente anterior
                dentro de la instalación activa
```

Una fila inconsistente:

- no aporta a ningún KPI;
- permanece en la lista;
- muestra uno de estos motivos:
  - `Cambio de neumático sin registrar` si cambió el código respecto del casco instalado;
  - `Medición a revisar` si el código coincide;
  - `Sin código: no se puede distinguir` si falta identidad.

Si todas las filas del período son inconsistentes, el panel conserva el filtro y muestra un mensaje
explícito. No publica KPI cero ni selecciona otro mes.

Verificación remota posterior a las migraciones:

| Control | Resultado |
|---|---|
| Instalaciones activas en la vista | 38 |
| Divergencias SQL de consumo/proyección | 0 |
| En umbral con consumo 100 % | 3 |
| Instalaciones activas con RTD creciente | 18 |

Los 28 saltos de `AUDIT.md` son históricos. La vista del dashboard solo representa instalaciones
activas, por lo que ambos conteos responden universos distintos.

## 5. Filtros y exclusiones

Orden:

```text
facetas → excluir units.is_test → frescura → cálculo
```

Todo lo excluido se declara. El chip del mes en curso sigue siendo el alcance inicial; si sus filas
son inconsistentes, la pantalla muestra el estado de calidad en vez de cambiar de período.

## 6. Etiquetas

- Km/mm: `Sobre N neumáticos`.
- Km proyectado: `Ponderado por mm gastado`.
- Detalle de eje: `Km/mm ponderado`, `Razón de sumas`, `Sobre profundidad útil`.
- Km acumulado y VUR: `Mediana`.

El balance Izquierda/Derecha conserva `mean()` porque cambiarlo alteraría el significado del umbral
de 15 %; está fuera de ADR-0011.

## 7. Verificación

```bash
cd WEB/rendimiento && npm test
npm run verify -- --fast
npm run verify
```

La suite carga las funciones directamente desde el script real de `rendimiento.html`. Rendimiento
ejecuta 51 pruebas y las dos pruebas discriminantes de D1 están activas.

Consultas remotas de cierre:

```sql
select count(*) filter (
  where current_rtd_mm > prev_inspection_rtd_mm
) as inconsistentes
from v_rendimiento_dashboard_rows;
```

## 8. Pendientes reales

1. D6: costo/km realizado o costo/km proyectado.
2. Completar y validar la depuración/recarga limpia, incluida la 225 P3.
3. Acordar `VUR_URGENT_KM`.
4. Decidir si el balance Izquierda/Derecha también debe ponderarse.
