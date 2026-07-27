# Auditoría — evidencia recogida el 2026-07-26

Todo lo de acá se midió contra producción (`fbxupwwgiebhlciqftpw`) o contra la planilla real. Cada
afirmación trae la consulta o la celda que la sostiene.

---

## 1. La planilla real de la unidad 225

Fuente: captura de la hoja de rendimiento de RENOVA, inspección del **07/05/26**.

| Vehículo | Pos | Código | Fecha insp. | Km insp. | RTD mín | Fecha inst. | Km inst. | RTD inicial | RTD consumido | RTD retiro | % desgaste | Km acumulado | Km x mm | Km proyectado | Precio | $ x Km |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 225 | 3 | 241088 | 07/05/26 | 607 467 | 4 | 28/11/25 | 553 857 | 16,0 | 12,0 | 4,0 | 100 % | 53 610 | 4 468 | 53 610 | 95,00 | 0,0018 |
| 225 | 5 | N/V | 07/05/26 | 607 467 | 10 | 28/11/25 | 553 857 | 16,0 | 6,0 | 4,0 | 50 % | 53 610 | 8 935 | 107 220 | 95,00 | 0,0009 |
| 225 | 4 | N/V | 07/05/26 | 607 467 | 4 | 28/11/25 | 553 857 | 16,0 | 12,0 | 4,0 | 100 % | 53 610 | 4 468 | 53 610 | 95,00 | 0,0018 |
| 225 | 6 | 25602 | 07/05/26 | 607 467 | 4 | 28/11/25 | 553 857 | 16,0 | 12,0 | 4,0 | 100 % | 53 610 | 4 468 | 53 610 | 95,00 | 0,0018 |
| **total** | | IZE2W | | | 6 | | | 16,0 | **10,5** | 4,0 | **88 %** | 53 610 | **5 584** | **67 013** | | **0,0016** |

### Fórmulas que se dedujeron, y que cierran las 17 celdas

```
Km acumulado   = Km inspección − Km instalación          607 467 − 553 857 = 53 610
RTD consumido  = RTD inicial − RTD mínimo                16 − 4 = 12
% desgaste     = RTD consumido / (RTD inicial − RTD retiro)   12 / 12 = 100 %
Km/mm          = Km acumulado / RTD consumido            53 610 / 12 = 4 468
Km proyectado  = Km/mm × (RTD inicial − RTD retiro)      4 468 × 12 = 53 610
$/Km           = Precio / Km proyectado                  95 / 53 610 = 0,0018
```

El renglón total **promedia las cuatro llantas**, no las pondera:

| Celda | Promedio simple | Razón de sumas | Excel |
|---|---|---|---|
| RTD consumido | (12+6+12+12)/4 = **10,5** | — | 10,5 ✔ |
| % desgaste | 10,5 / 12 = **87,5 %** | — | 88 % ✔ |
| Km x mm | **5 584,75** | 5 105,7 | 5 584 ✔ |
| Km proyectado | **67 012,5** | 61 269 (ponderado) | 67 013 ✔ |
| $ x Km | **0,001575** | — | 0,0016 ✔ |

**Alcance de esta evidencia:** demuestra cómo la planilla resume **los neumáticos de un vehículo**.
No dice nada sobre cómo agregar por marca, diseño, medida o flota entera. Ver `DECISIONES.md` D3.

## 2. Dónde difiere el sistema

Consulta usada: `v_rendimiento_dashboard_rows` sobre las 14 filas reales.

| Concepto | Planilla | Sistema hoy | Efecto medido |
|---|---|---|---|
| % desgaste | sobre `inicial − retiro` | sobre `otd` | 256 P7/P8: **100 % vs 75 %** |
| Km proyectado | base `RTD inicial` | base `otd` | coinciden hoy (`rtd_at_install == otd` en 14/14) |
| $/Km | `precio / km proyectado` | `costo / km recorrido` | 225 P4: **0,0004 vs 0,0012** |
| Km acumulado | km de esta instalación | km de todo el casco | distinto significado |

Las tres primeras filas de la tabla de abajo son neumáticos **exactamente en el umbral de retiro**.
La planilla dice «100 %, cambiar»; el panel dice 75 % y 60 %.

| Unidad · Pos | RTD actual | Retiro | % sistema | % planilla |
|---|---|---|---|---|
| 256 P7 / P8 | 4,0 | 4,0 | 75,0 % | **100 %** |
| 5021 P5 | 4,0 | 4,0 | 60,0 % | **100 %** |
| 2134 P3-P6 | 6,0 | 4,0 | 62,5 % | **83,3 %** |
| 5021 P3/P4/P6 | 7,0 | 4,0 | 56,3 % | **75,0 %** |
| 225 P4/P5/P6 | 12,0 | 4,0 | 25,0 % | **33,3 %** |

## 3. Datos que describen algo imposible

### 3.1 El caso que lo destapó

Unidad 225, entre el 07/05/26 y el 06/07/26:

| Pos | RTD mayo | RTD julio | Código mayo | Código julio |
|---|---|---|---|---|
| P3 | 9,0 | 11,0 | 241088 | **241679** |
| P4 | 4,0 | 12,0 | — | — |
| P5 | 10,0 | 12,0 | — | — |
| P6 | 4,0 | 12,0 | 25602 | **241667** |

Le cambiaron los cuatro neumáticos y nadie lo registró como instalación.

### 3.2 Y además, un valor mal importado

La planilla marca **4 / 4 / 4 → mín 4** para la P3 el 07/05/26. La base tiene **9 / 9 / 9 → 9**.
Las otras tres posiciones coinciden exactamente con la planilla (P5: 10/10/10, P4: 4/4/5,
P6: 4/4/4) y el odómetro 607 467 también. Es un solo valor, y es de la P3.

### 3.3 Alcance en toda la flota

```sql
with hist as (
  select u.plate, m.position_number, i.inspected_on, m.rtd_movi_mm, m.tire_code,
         lag(m.rtd_movi_mm) over w as rtd_prev,
         lag(m.tire_code)   over w as code_prev
  from inspection_measurements m
  join inspections i on i.id = m.inspection_id
  join units u on u.id = i.unit_id
  where not u.is_test
  window w as (partition by u.id, m.position_number order by i.inspected_on)
)
select count(*) filter (where rtd_prev is not null)      as pares,
       count(*) filter (where rtd_movi_mm > rtd_prev)     as rtd_subio,
       count(*) filter (where rtd_movi_mm > rtd_prev + 1) as salto_mayor_1mm,
       count(distinct plate) filter (where rtd_movi_mm > rtd_prev) as unidades
from hist;
```

| Métrica | Valor |
|---|---|
| Pares de inspecciones consecutivas | 93 |
| Con RTD que sube | **35 (38 %)** |
| Con salto > 1 mm | **28** |
| Unidades afectadas | **10** |

**27 de los 28 saltos coinciden con un cambio de código de neumático** en la misma posición
(2151 P3: 24798→25303 con +7 mm · 5032 P3: 241470→2024308 con +8 mm · 120 P1: 051125→090426 con
+6 mm · 431, 620, 2145, 2120…). La única excepción es **620 P2**, mismo código `20887` con +2 mm:
ese sí es un error de medición.

### 3.4 Contexto de movimientos

| Dato | Valor |
|---|---|
| Instalaciones | 45 (7 retiradas) |
| Ciclos | 41 · con más de una instalación: **4** |
| Ciclos reencauchados (`cycle_number > 1`) | **0** |
| Órdenes de movimiento | 4 |
| Filas de Rendimiento con `rtd_at_install ≠ otd` | **0 de 14** |

Los 4 ciclos con dos instalaciones son de QA-CN16 (prueba) o rotaciones P1↔P2 dentro de la misma
unidad. **No hay ningún movimiento real entre unidades.** Y esos ciclos producen filas nulas en
Rendimiento, no filas mal calculadas.

## 4. Las dos corridas comparativas

Sobre las **10 filas limpias** (excluyendo las 4 de la 225 por RTD creciente):

### Por unidad — el promedio y el ponderado casi no se separan

| Unidad | n | Km/mm promedio | Km/mm ponderado | Diferencia |
|---|---|---|---|---|
| 2134 | 4 | 5 084 | 5 084 | **0,0 %** |
| 256 | 2 | 4 179 | 4 179 | **0,0 %** |
| 5021 | 4 | 11 717 | 11 362 | **−3,0 %** |

### Por grupo — ahí sí se separan

| Métrica | Promedio | Ponderado | Diferencia |
|---|---|---|---|
| Km/mm | 7 556 | **6 996** | **−7,4 %** |
| Km proyectado | 81 298 | **78 149** | −3,9 % |
| % desgaste | 85,8 % | 85,1 % | −0,9 % |

**Dato que respalda la decisión:** el promedio de los tres promedios por unidad da **6 993**, contra
**6 996** del ponderado por llanta. A nivel flota las dos rutas convergen; el ponderado no distorsiona.

## 5. Qué está mostrando el panel ahora mismo

Por defecto se aplica un chip de **mes calendario en curso** (`withCurrentMonthByDefault`,
`WEB/rendimiento.html:1745`), que además fuerza `includeStale = true` (`:1763`, `:1812`).

Hoy, 2026-07-26, eso deja **4 neumáticos**: las posiciones 3-6 de la 225 — las cuatro contaminadas.

| KPI | En pantalla | Flota sin la 225 (10 limpias) |
|---|---|---|
| Km/mm | 18 446 | **6 996** |
| Km proyectado | 221 348 | **78 149** |

Ordenadas por km/mm, **las cuatro primeras de toda la flota son las cuatro de la 225**
(15 679–19 599). Las de identidad consistente rinden 4 179–10 415. El «mejor rendimiento de la
flota» es un artefacto.

## 6. Correcciones que se hicieron sobre esta misma auditoría

Vale leerlas: son errores ya cometidos una vez en esta sesión.

1. **«El KPI no reconcilia por un factor de 2»** comparaba 18K (4 neumáticos) contra 109K (14). Dos
   alcances distintos. La discrepancia real era del 6 %.
2. **«La base debe ser `rtd_at_install` en vez del OTD»** se argumentó primero al revés, sosteniendo
   que el OTD del modelo era lo correcto. La planilla lo resuelve: la columna es `RTD INICIAL` y
   está en el bloque de instalación.
3. **«No es data sucia, es un cambio no registrado»** descartó de más: la planilla prueba que el
   valor de la P3 en mayo está mal importado. Las dos cosas son ciertas a la vez.
4. **«Hay que revertir toda la agregación a promedio»** generalizó desde una hoja que solo evidencia
   el resumen de un vehículo.
5. **«La planilla prueba que la base es el `RTD inicial`»** — no la prueba. Las 14 llantas son
   reencauches R1 montados con banda entera (`rtd_at_install == otd` en todas) y la hoja ni siquiera
   tiene columna OTD: las dos lecturas dan el mismo número en cada celda. Se dio por resuelto un
   punto que sigue abierto (D1), **dentro del mismo documento donde se catalogó el error #4**. Es la
   tercera vez que este punto se afirma con confianza y la segunda que se afirma al revés. No se
   cierra analizando: se cierra preguntándole a RENOVA.

**El patrón que se repite en los cinco:** confundir «los datos son compatibles con X» con «los datos
demuestran X». En una flota de 14 llantas, todas del mismo diseño, todas reencauche, todas montadas
con banda entera, casi cualquier hipótesis es compatible con casi cualquier evidencia. Antes de
afirmar, buscar el caso que discriminaría entre las dos lecturas — y si no existe en los datos,
decirlo.
