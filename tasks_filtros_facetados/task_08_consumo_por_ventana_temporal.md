# task_08 — Consumo por ventana temporal

## 1. Propietario

**CLAUDE + USUARIO** (aplica DDL remoto: requiere autorización explícita).

## 2. Objetivo y resultado observable

Responder la pregunta que la persona responsable planteó y que **hoy no tiene datos que la
soporten**: «los Michelin en este mes, ¿cuánto me han consumido? ¿y de mayo a junio?».

Resultado observable: con un rango de fechas seleccionado, Rendimiento muestra el consumo **ocurrido
dentro de ese rango**, no el acumulado desde la instalación.

Es la tarea más pesada de la fase y la única que necesita modelo de datos nuevo.

## 3. Dependencias y bloqueos

Depende de `task_07`. Bloquea `task_09`.

> **Riesgo de no ser implementable.** Si el historial de `inspection_measurements` no permite
> recuperar dos mediciones dentro de una ventana típica, la capacidad no existe con los datos
> actuales. Ver §8 y la regla de bloqueo 6.

## 4. Archivos exclusivos

- `supabase/migrations/<ts>_tire_rtd_history.sql` (nuevo)
- La sección de ventana temporal de `WEB/rendimiento.html`

Solo lectura: el resto de `supabase/migrations/`.

## 5. Contratos

### Por qué hace falta una vista nueva

`v_rendimiento_dashboard_rows` se construye sobre `v_tire_performance`, que resuelve la inspección
con:

```sql
order by i.inspected_on desc
limit 1
```

**Colapsa el historial a la última medición.** Con eso se puede preguntar «¿cuánto lleva consumido
desde que se instaló?», nunca «¿cuánto consumió en mayo?». El dato existe en
`inspection_measurements`; la vista lo descarta.

### El cálculo

Consumo dentro de `[desde, hasta]` para un casco:

```
rtd_inicio  = RTD de la primera medición del rango
rtd_fin     = RTD de la última medición del rango
km_inicio   = odómetro de esa primera medición
km_fin      = odómetro de esa última medición

rtd_gastado  = rtd_inicio − rtd_fin
km_recorrido = km_fin − km_inicio
km_por_mm    = km_recorrido / rtd_gastado
```

**La fórmula es la misma que `computeTire`.** Lo que cambia es de dónde salen los extremos: en vez
de instalación → última inspección, es primera → última **dentro del rango**. Esto no es una fórmula
nueva y no debe presentarse como tal (límite duro 9).

### La vista

Historial por casco: una fila por medición con `casing_id`, `inspected_on`, `rtd_movi_mm`,
`odometer_km`, más las facetas necesarias para filtrar (marca, modelo, condición, medida, diseño,
eje, unidad).

Restricciones:

- `security_invoker = true`.
- `SELECT` **solo a `authenticated`**. Nunca `anon` — criterio de `v_search_index`, y el más
  estricto de los dos precedentes.
- Desde **tablas base**, no desde otras vistas. Mismo límite que la fase anterior.
- Sin extensiones nuevas.

### Volumen

Es historia completa, no estado actual: **crece con cada inspección**. `task_01` midió cientos de
filas para el estado actual; esto puede ser un orden de magnitud más.

**Medirlo antes de decidir si F9 (filtrado en cliente) sigue siendo viable.** Si no lo es, la
decisión se plantea al humano: acotar el rango recuperable, filtrar en servidor, o no implementar.
**No se pagina en silencio.**

### Al menos dos mediciones

Un casco con **una sola** medición en el rango no tiene consumo calculable en ese rango. No es cero:
es indeterminado. Se excluye y se cuenta aparte (F10), con su propia razón — distinta de
`valid:false` y de «rancio».

Que esto ocurra mucho es información valiosa sobre la cadencia real de inspección, y por eso el
conteo debe verse.

## 6. Pasos

1. **Antes de escribir DDL**: medir sobre la base real cuántos cascos tienen ≥2 mediciones en
   ventanas de 30 días, y en rangos de 2–3 meses. **Es el dato que decide si la tarea sigue.**
2. Si la cobertura es baja, **detenerse y reportar**. Una pantalla que responde «sin datos» para casi
   todas las consultas no es una capacidad entregada.
3. Diseñar la vista desde tablas base.
4. Medir el volumen y contrastar con F9.
5. **Revisar con `sync-migration-reviewer`.** Obligatorio.
6. **Pedir autorización explícita** antes de aplicar.
7. Aplicar y verificar: conteos, aislamiento por empresa (dos empresas distintas), grants solo
   `authenticated`, REST anónimo rechazado.
8. Implementar `computeWindow` en cliente, reutilizando la fórmula existente.
9. Habilitar el control de rango en Rendimiento — **recién ahora** (F11).
10. Smoke con rangos reales.

## 7. Invariantes

- **No aproximar.** Si no hay dos mediciones en el rango, el resultado es «sin datos», nunca una
  estimación con la última medición disponible. Responder «mayo» con datos de otro período es
  exactamente lo que esta tarea existe para evitar (regla de bloqueo 6).
- No cambiar la fórmula de consumo. Cambian los extremos, no la matemática.
- `SELECT` solo a `authenticated`.
- Vista desde tablas base.
- No modificar `v_rendimiento_dashboard_rows` ni `v_tire_performance`.
- Sin extensiones nuevas.
- No aplicar sin revisión del agente y autorización humana.

## 8. Casos de error

- Casco con 0 o 1 medición en el rango → excluido, contado aparte con su razón.
- `rtd_gastado <= 0` (RTD que sube: reencauche intermedio o dato erróneo) → **no es consumo
  negativo**. Excluir y contar como anomalía. Un reencauche dentro del rango parte el ciclo y el
  cálculo directo no aplica.
- Instalación o retiro dentro del rango → el casco estuvo montado parte del tiempo. Decidir
  explícitamente si se incluye y **documentarlo**; no dejarlo implícito.
- Rango sin ninguna inspección → estado vacío honesto.
- Rango invertido → normalizar o rechazar, sin romper.
- Volumen que hace inviable el cliente → detener y plantear al humano.

## 9. Aceptación

- Cobertura de ≥2 mediciones medida y documentada **antes** del DDL.
- `sync-migration-reviewer`: APPROVE, salida registrada.
- Autorización humana registrada.
- Post-aplicación: aislamiento entre dos empresas verificado, grants solo `authenticated`, REST
  anónimo = 401 o 0 filas.
- Un rango conocido verificado **a mano** contra las mediciones crudas de un casco: el número que
  muestra la pantalla debe reproducirse con lápiz y papel.
- Los tres conteos de exclusión (datos insuficientes, rancios, sin dos mediciones) visibles y
  distintos entre sí.
- Suites verdes, `npm run docs:check`, `git diff --check`.

## 10. Rollback

`drop view` de la vista nueva y revertir la sección de rango en `rendimiento.html`. Nada más la
consume: reversión limpia. El resto de la fase sigue funcionando sin esta capacidad.

## 11. Handoff

Actualizar fila 08 con: cobertura de ≥2 mediciones por ventana, volumen y su impacto en F9, salida
de `sync-migration-reviewer`, autorización, verificación de aislamiento y grants, verificación manual
de un rango, y decisión documentada sobre instalaciones/retiros dentro del rango.

Si la tarea se detuvo por cobertura insuficiente, **decirlo con los números**: es un hallazgo sobre
la operación real, no un fracaso de la implementación, y probablemente la información más útil que
produzca esta fase.
