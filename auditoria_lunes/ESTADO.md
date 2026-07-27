# Estado de implementación — 2026-07-25

Ejecución de los tasks de `auditoria_lunes/tasks/`. Migraciones **aplicadas a producción**
(`fbxupwwgiebhlciqftpw`) con aprobación explícita, tras revisión de `sync-migration-reviewer`.

## Hecho y verificado

| Task | Qué se hizo | Verificación |
|---|---|---|
| **06** Presión | Tabla `pressure_thresholds` sembrada por empresa; `fn_effective_pressure_thresholds` + `fn_pressure_state`; vista recreada; ficha imprime el rango real; spec §3 corregida; ADR-0009 | **En pantalla:** P1 Direccional 315/80R22.5 muestra «RANGO NORMAL: 105-125 PSI». Distribución post-migración: Normal 1 961 · Sin Medir 232 · Alta 35 · Baja 19 — coincide exactamente con lo predicho |
| **06** Temperatura | `temperature_mode` default `'COLD'` + backfill | `select count(*) ... where temperature_mode is null` → **0** |
| **05** Voseo | 4 textos en `WEB/`; 6 funciones SQL parcheadas desde su definición vigente | Barrido de voseo en funciones de `public` → **0** |
| **10** Odómetro | Importador ya no convierte «sin dato» en 0: valida ausente / ≤ 0 / > 3 500 000 km y bloquea el envío. La app suma techo y rechazo de 0 (ya impedía bajar) | `npm run verify` verde; lint y `tsc` limpios |
| **11** UI | Inventario muestra la empresa, no el correo; pastilla «Incluyendo 0 datos antiguos» oculta con contador 0; favicon en las 3 páginas que faltaban | **En pantalla:** insignia `· MÓVIL BUS`; pastilla ausente; consola limpia |
| **02** Grants | DML revocado en las 19 vistas; `anon` sin `SELECT` | Consulta de grants indebidos → **0**. Los 4 dashboards siguen cargando datos autenticados |
| **08** Verificación | `npm run verify`: 8 suites + lint + docs + builds, **contando** pruebas contra un piso por suite | **385 pruebas**, verde |

### Nota para el lunes

El navegador cachea los módulos JS por separado del HTML. Durante la verificación, la ficha siguió
mostrando el rango viejo hasta un **recarga dura (Ctrl+Shift+R)**. Conviene hacerla una vez antes
de empezar la demo.

## Segunda tanda (misma sesión)

| Qué | Detalle | Verificación |
|---|---|---|
| **VUR visible** (`task_07`) | Tarjeta «Vida útil remanente» junto a Costo/Km: mediana de km que le quedan a un neumático antes del retiro, más cuántos están por debajo de 10 000 km. Calculado con datos que ya existían (`km/mm × (RTD actual − RTD de retiro)`), sin motor nuevo ni tocar la app | **En pantalla:** 156 788 km · 0 de 4 bajo el umbral |
| **Estadística corregida** | Las tarjetas promediaban razones por neumático. Ahora: **tasas** (km/mm, consumo, costo/km) por **razón de sumas**; **magnitudes** (km proyectado, km acumulado) por **mediana**. Las etiquetas dicen qué estadística es | 10 pruebas nuevas, incluida una que demuestra que un neumático con desgaste mínimo ya no arrastra el km/mm |
| **`units.is_test`** (`task_09`) | Columna real, `QA-CN16` y `5028` marcadas, expuesta en `v_rendimiento_dashboard_rows`. Rendimiento las excluye **y lo declara** | **En pantalla:** «7 excluidos por ser de unidades de prueba» |
| **ADR-0010** (`task_01`) | Riesgo `anon` documentado con evidencia, dos condiciones y camino de salida | Aviso agregado a `knowledge/ai/08` |
| **Guion de demo** (`task_04`) | `GUION_DEMO.md`: movimientos en MÓVIL BUS, qué no afirmar, recarga dura previa | — |

### El efecto que se ve

| KPI | Antes | Ahora |
|---|---|---|
| KM/MM | **138K** | **18K** |
| KM proyectado | 1.9M | 235K |
| Consumo | 42.3 % | 26.6 % |
| KM acumulado | 1.3M | 78K |

El KPI dejó de estar 13 veces desviado **sin esperar a la recarga de base**: la marca `is_test`
saca las unidades de prueba, y la razón de sumas impide que un neumático con denominador chico
vuelva a dominar el promedio.

### Corrección al plan original

Se evaluó «acotar las RPC de `anon` sin tocar autenticación» y **no existe tal cosa**: limitar
`get_unidad_preload` a la última inspección reduce la exposición un 5.4 %, y las placas son
trivialmente enumerables. Queda escrito en ADR-0010 para que nadie lo reproponga como solución.

## Pendiente, con su razón

| Task | Por qué no se hizo |
|---|---|
| **01** Exposición `anon` | Necesita ADR y una decisión de producto: revocar `anon` deja la app de inspección sin poder sincronizar, porque no tiene login. No es un fix mecánico |
| **03** / **09** Datos QA | El dueño de negocio va a **recargar la base limpia**. Hacerlo ahora sería trabajo tirado. Queda vigente la parte que la recarga no resuelve: marcar datos de prueba con una columna real (`is_test`) |
| **04** Cuentas de operario | Requiere crear cuentas Auth reales y entregar credenciales — no es trabajo de código. Alternativa para el lunes: fijar el guion de movimientos en MÓVIL BUS, la única empresa con operario |
| **07** Motor de cálculo | Decisión de producto pendiente: ¿el estado RTD del dashboard es histórico o vigente? ¿se agrega `idi` al esquema? ¿`calcularVur` y `calcularTasaDesgaste` se conectan o se retiran? ADR-0009 ya dejó `calcularEstadoPresion` obsoleta por implementar el modelo descartado |

## Lo que sigue sin resolver y se va a ver el lunes

El KPI de Rendimiento **sigue mostrando 138K km/mm**. Es correcto que siga así: son los 5
neumáticos de `QA-CN16` con odómetro de 2.5 millones de km, y desaparecen con la recarga de base
limpia. El valor real de la flota es ~10 700 km/mm.

**Si la recarga no llega a tiempo, ese número se muestra tal cual.** Es el único hallazgo de la
auditoría que quedó sin mitigación en código, y a propósito: filtrarlo por nombre de unidad es
exactamente lo que ADR-D8 rechazó.

## Migraciones aplicadas

```
20260725100000_spanish_neutral_error_messages.sql
20260725110000_pressure_thresholds_by_size_and_axle.sql
20260725120000_measurements_default_cold_temperature.sql
20260725130000_revoke_dml_on_dashboard_views.sql
```

Revisadas por `sync-migration-reviewer` antes de aplicar: riesgo global BAJO, sin bloqueos. Su
único punto pendiente —`nulls not distinct` exige PG 15+— se descartó verificando que producción
corre **PostgreSQL 17.6**.
