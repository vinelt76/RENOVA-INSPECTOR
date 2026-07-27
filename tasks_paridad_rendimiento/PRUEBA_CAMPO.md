# PRUEBA DE CAMPO — Paridad de Rendimiento

Fecha de revisión: **2026-07-26**.

No hubo una sesión real automatizable de jefe de flota. El recorrido se hizo en Chrome headless con
el adaptador de autenticación y la respuesta de Supabase simulados. Esto valida integración y
render; no sustituye una prueba humana sobre producción.

## Suite completa

```text
app                  47
app movimientos       5
WEB/movimientos      186
WEB/shared            50
WEB/servicios         38
WEB/rendimiento       51
WEB/buscador          19
WEB/inventario        15
total                411
lint                  OK
docs:check            OK
build app             OK
build movimientos     OK
```

## Recorrido de navegador

| Punto | Resultado | Evidencia |
|---|---|---|
| Una placa con 0,1 mm y 8 mm gastados | PASA | `Σkm/Σmm = 130 000/8,1 = 16 049,38`; no promedio simple |
| Etiquetas | PASA | `Sobre 2 neumáticos` y `Ponderado por mm gastado` |
| Proyección ponderada | PASA | 192 592,59 km |
| Todas las filas inconsistentes | PASA | Mensaje explícito y 4 exclusiones declaradas |
| Filas inconsistentes visibles | PASA | P3–P6 permanecen en la lista con motivo |
| Móvil 390×844 | PASA | Sin overflow horizontal del documento |
| Escritorio 1440×1000 | PASA | Tarjetas y tabla completas |
| Recarga | PASA | 2 y 4 filas respectivamente después de recargar |
| Consola | PASA | Sin errores de consola ni de página |

Capturas de la corrida: `/tmp/rendimiento-paridad-clean.png` y
`/tmp/rendimiento-paridad-inconsistent.png`. Son artefactos temporales, no se versionan.

## Verificación remota

| Control | Resultado |
|---|---:|
| Filas activas | 38 |
| Filas con tasa de ciclo calculable | 19 |
| Ciclos incompletos | 17; todos ya carecían de km en el tramo vigente |
| Filas reencauchadas (`cycle_number > 1`) | 0 |
| Divergencias de consumo | 0 |
| Divergencias de proyección | 0 |
| Filas con medición anterior | 27 |
| RTD creciente | 18 |
| Exactamente en umbral y 100 % | 3 |

La migración final cambia la tasa a nivel ciclo y vuelve `NULL` un ciclo incompleto. Ninguna fila
previamente calculable quedó invalidada por un tramo histórico faltante: los 17 incompletos ya
carecían de km en su tramo vigente. Los datos actuales no contienen reencauches ni traslados reales
que separen la fórmula nueva de la anterior; el caso discriminante queda cubierto por prueba
sintética.

`v_rendimiento_dashboard_rows` conserva `security_invoker=true`; `authenticated` tiene `SELECT` y
`anon` no. Las advertencias de los asesores son preexistentes y no apuntan a las vistas modificadas.

## Límites pendientes

- D6: la hoja sugiere costo/km proyectado; el panel mantiene costo/km realizado hasta confirmación.
- D7: se decidió esperar la depuración/recarga limpia; no se modificó la 225 P3.
- La inspección vigente de la 225 mezcla cambios no registrados; no sirve como golden de pantalla.
- Falta recorrido humano con una sesión real y datos productivos limpios.
