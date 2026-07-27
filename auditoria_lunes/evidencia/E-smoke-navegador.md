# Evidencia — smoke autenticado en navegador

Sitio local `http://localhost:8766/`, sesión iniciada por el usuario como
**SUPERVISOR DE NEUMÁTICOS · MÓVIL BUS** (rol `fleet_manager`). 2026-07-25.

Recorrido: Rendimiento → Servicios → Inspecciones por unidad → Inventario.
Consola sin errores en las cuatro pantallas.

---

## E1 — Rendimiento: el KPI principal lo dominan los datos de prueba

Pantalla (filtro «Mes de última inspección: julio 2026», 9 de 11 neumáticos aportando):

| KPI | valor mostrado |
|---|---|
| KM/MM | **138K km/mm** |
| KM PROYECTADO | 1.9M km |
| CONSUMO | 42.3 % |
| KM ACUMULADO | 1.3M km |

Un neumático de bus no rinde 138 000 km por milímetro de profundidad. Origen, medido:

```sql
select case when plate='QA-CN16' then 'QA-TEST' else 'REAL' end as origen,
       count(*), round(avg(km_per_mm)), round(avg(km_projected)),
       round(avg(cycle_km_accumulated)), round(avg(consumption_pct),1)
from public.v_rendimiento_dashboard_rows where km_per_mm is not null group by 1;
```

| origen | neumáticos | km/mm prom | km proyectado | km acumulado | consumo |
|---|---|---|---|---|---|
| **QA-TEST** (`QA-CN16`) | 5 | **233 542** | 3 269 590 | 2 300 001 | 54.9 % |
| **REAL** | 14 | **10 717** | 121 905 | 70 868 | 52.5 % |
| **mezcla que ve la pantalla** | 19 | 69 355 | 950 243 | 657 482 | 53.1 % |

Los 5 neumáticos de `QA-CN16` rinden **22 veces** lo que los reales y arrastran el promedio.
Causa directa: esa unidad tiene `odometer_at_install = 200 000` y
`current_odometer_km = 2 500 001` → `km_run = 2 300 001` km en un ciclo.

**La fórmula no está mal.** `km_per_mm = km_run / rtd_worn_mm` es correcta; los valores reales
(10 717 km/mm; unidad 225 → 19 598; unidad 5021 → 15 622 y 10 414) son plausibles. Lo que está
mal es el dato de entrada.

## E2 — Odómetro: la mitad de las inspecciones trae 0

```sql
select count(*), count(*) filter (where odometer_km = 0),
       count(*) filter (where odometer_km > 1500000), max(odometer_km)
from public.inspections;
```

**288 inspecciones · 140 con odómetro 0 (48.6 %) · 60 por encima de 1.5M km · máximo 10 000 000.**

Por empresa:

| empresa | inspecciones | odómetro 0 | > 1.5M km | máximo |
|---|---|---|---|---|
| MÓVIL BUS | 109 | **86 (79 %)** | 3 | **10 000 000** |
| CIVA | 114 | 47 (41 %) | 28 | 3 185 857 |
| ITTSABUS | 65 | 7 (11 %) | 29 | 2 921 296 |

El odómetro es el denominador de todo el módulo de Rendimiento. Los ceros son inequívocamente
inválidos. Los 10 000 000 km de la unidad 5028 también, y **se muestran en el encabezado de
Inspecciones por unidad** («ODÓMETRO 10 000 000 KM»). La franja de 1.5M–3.2M km no la califico:
un bus interprovincial peruano de muchos años puede acercarse; hay que confirmarlo con el cliente
antes de tratarla como error.

## E3 — Presión: 1 de cada 6 mediciones está mal clasificada

La ficha de P1 (DELANTERA IZQUIERDA, 315/80R22.5) imprime literalmente:

> PRESIÓN **110 PSI** · RANGO NORMAL: **100-130 PSI** · NORMAL

Según `specs/reglas_negocio.md` §3, una posición de **Dirección** en esa medida tiene
`presion_ref = 110` → rango normal **99–115.5 PSI**, no 100–130. El rango que la pantalla afirma
es incorrecto para esa posición.

Contraste completo sobre las mediciones de 315/80R22.5 del dashboard de inspecciones (regla
vigente `fn_pressure_state_fixed` vs regla de la spec, Dirección ref 110 / Tracción y Libre ref 115):

| lo que muestra | lo que dice la spec | n | % |
|---|---|---|---|
| Normal | Normal | 424 | 60.7 % |
| Sin Medir | Sin Medir | 155 | 22.2 % |
| **Normal** | **Alta Presión** | **105** | **15.0 %** |
| Baja Presión | Baja Presión | 9 | 1.3 % |
| **Baja Presión** | **Normal** | **3** | **0.4 %** |
| **Normal** | **Baja Presión** | **2** | **0.3 %** |

**110 de 698 mediciones (15.8 %) están mal clasificadas**, y 105 de ellas en el sentido peligroso:
sobreinflado mostrado como normal.

## E4 — Servicios: correcto, con 40 % de datos de prueba

5 servicios · 2 unidades · 3 órdenes · período 21–22 jul 2026. La pantalla explica sus propios
límites en prosa y marca «ORIGEN NO DETERMINADO» y «SIN REEMPLAZO REGISTRADO» donde corresponde,
tal como describe ADR-0008. Sin objeciones de lógica.

De los 5 servicios, **2 son de `QA-CN16`** y aparecen con la marca literal `QA-TEST` en la ficha.
Es coherente con la decisión D8 de no filtrarlos por patrón inventado, pero es lo que se va a
proyectar.

## E5 — Inventario: funciona, pero muestra el correo del usuario

1 neumático en Retén, 1 en Descartados. Lectura correcta y coherente con la línea base sin sembrar.

**Defecto visible:** la insignia de sesión abajo a la derecha muestra
`SN · SUPERVISOR DE NEUMÁTICOS · Y1UEKZD7G@MOZMAIL.COM` — el **correo de la cuenta** en lugar del
nombre de la empresa. Las otras tres pantallas muestran `· MÓVIL BUS` en ese mismo lugar.
Inventario cae a un fallback distinto. Es una inconsistencia del shell y, en una demo con cliente,
un correo personal proyectado en pantalla.

## E6 — Rendimiento: pastilla con texto vacío de sentido

Se muestra la pastilla activa **«Incluyendo 0 datos antiguos ×»** junto al texto «Se incluyen
inspecciones antiguas; esto no calcula consumo por periodo». Con el contador en 0 la pastilla no
debería renderizarse: anuncia una inclusión que no incluye nada.
