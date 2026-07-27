# Decisiones

Tomadas arriba, abiertas abajo. Una decisión abierta que bloquea una tarea se anota en la tarea.

---

## Tomadas

### D1 — La base es el OTD del ciclo, siempre · 2026-07-26

**Decidida por el dueño de negocio.** La profundidad útil se calcula desde el **OTD del ciclo**, no
desde el RTD que el neumático tenía al montarse en esa posición.

El razonamiento que la cierra, y que vale la pena conservar porque hace innecesarios los dos casos
que parecían distintos:

- **Rotación dentro de la misma unidad** → el OTD es el mismo, obviamente.
- **Traído de otro carro o del retén** → el OTD **también es el mismo**. Es una propiedad del ciclo
  de vida del neumático, y el ciclo no cambia porque cambie el vehículo.

O sea: no hay dos casos. El OTD es la base en todos. Lo que sí tiene que cambiar de vehículo con el
neumático, y el sistema debe recordar, es **el kilometraje que hizo en los carros anteriores dentro
de su vida actual**.

Este punto se afirmó tres veces en esta sesión, dos de ellas en direcciones opuestas y con una
confianza que la evidencia no daba. Queda escrito para que no haya una cuarta.

#### Consecuencia 1 — las pruebas parqueadas están al revés

`computeGroup.test.js` tuvo dos `it.skip` que afirmaban lo contrario («un casco montado usado
proyecta desde RTD de instalación, no desde OTD»). Se invirtieron y hoy se ejecutan. La
implementación (`t.otd - t.rtdRetiro`) es la correcta.

#### Consecuencia 2 — la identidad usa la vida actual

```
Km acumulado del ciclo + VUR = Km proyectado
```

El panel usa el kilometraje acumulado de la vida actual, incluidos los vehículos/posiciones
anteriores. No usa solo la instalación vigente ni mezcla vidas reencauchadas anteriores.

#### Consecuencia 3 — la completitud del km del ciclo pasa a ser obligatoria

Esta decisión **promueve una deuda de opcional a requisito**. Si el sistema tiene que acumular el
kilometraje entre vehículos, `cycle_km_accumulated` tiene que ser confiable — y hoy no lo es:
`cycle_km = sum(k.km_run)` y `sum()` ignora los NULL, así que una instalación sin odómetro
**subcuenta en silencio**. Verificado en la placa `7061`: el tramo activo tiene `km_run = null` y el
acumulado igual muestra 98 800, solo del tramo retirado.

La vista se corrigió con `bool_and(km_run is not null)`: si falta un tramo, el ciclo devuelve
`NULL` en vez de subcontar en silencio. La identidad solo se evalúa para ciclos completos.

### D2 — El desgaste NO se mide sobre el OTD · 2026-07-26

El denominador del `% de desgaste` es **la profundidad útil**, no la profundidad total. Probado con
dos filas independientes de la planilla: la P3 gastó 12 mm y marca **100 %**; la P5 gastó 6 mm y
marca **50 %**. En ambas el denominador es 12, no 16.

Los milímetros por debajo del umbral de retiro no son vida disponible: son el margen con el que el
neumático se baja.

Consecuencia observable, y el motivo por el que esta decisión pesa más que las otras: un neumático
**en el umbral de retiro** pasa a marcar **100 %** en vez de 75 %. Con la fórmula vieja, una llanta
que hay que bajar hoy se lee como si le quedara un cuarto de vida.

**Lo que esta decisión NO fija** es si la profundidad útil se calcula desde el `RTD inicial` o desde
el `otd`: con `rtd_at_install == otd` en las 14 filas, los dos dan 12 y la planilla no los
distingue. Ver D1. La corrección del 75 % → 100 % **no depende de eso**: se sostiene con cualquiera
de las dos lecturas, y por eso se puede implementar antes de resolver D1.

### D3 — Ponderado para todo conjunto, incluida una unidad · 2026-07-26

La paridad con la planilla se conserva **por neumático**, no en su renglón total. Un vehículo puede
recibir neumáticos en momentos distintos: el promedio simple da el mismo peso a una tasa apoyada en
0,1 mm que a otra apoyada en 8 mm y puede producir un KPI engañoso.

Por decisión del dueño del producto, `computeGroup` usa una sola estadística cualquiera sea la
cantidad de placas: razón de sumas para tasas y ponderación por mm gastado para la proyección. Si
todos los neumáticos tienen el mismo rendimiento individual, promedio y ponderado coinciden. Haber
entrado el mismo día por sí solo no garantiza igualdad: si el desgaste difiere, el ponderado puede
diferir y esa diferencia es información útil.

**Se descartó** cambiar de fórmula según la cantidad de placas. Además de sobreponderar evidencia
incipiente, hacía que una tarjeta cambiara de significado al agregar o quitar una unidad del filtro.

### D4 — Una posición con RTD creciente no produce métricas · 2026-07-26

Vale igual si el salto se explica por un cambio de neumático real: mientras el cambio no esté
registrado como instalación, la fila mezcla el RTD inicial de un neumático con el RTD actual de
otro, y no describe a ninguno de los dos.

Se excluye **y se declara**, nunca se esconde (ADR-D8).

### D5 — Registrar cambios de neumático es fase 2 · 2026-07-26

La arquitectura existe (`tire_movement_orders`, `baseline_mount_batches`, `tire_installations`) pero
el MVP no la necesita, y el piloto todavía tiene que afinarse. Esta fase **detecta y declara**; no
implementa el registro ni infiere instalaciones desde las inspecciones.

Horizonte del proyecto: asesoramiento durante agosto, implementación total a mediados de agosto o en
septiembre según evolucione.

### D7 — Esperar la depuración/recarga limpia · 2026-07-26

El dueño confirmó que los datos sucios están en proceso de depuración. No se hará un `UPDATE`
puntual sobre la 225 P3: se conserva visible mediante el detector de inconsistencias y se espera la
recarga limpia. Así se evita introducir una corrección manual que luego pueda ser pisada o quedar
sin procedencia reproducible.

---

## Abiertas


### D6 — ¿`$/Km` sobre km proyectado en toda la planilla? · bloquea `task_02` (parcial)

En la hoja de la 225, `$/Km = precio / km proyectado`: la P5 marca 0,0009 (95/107 220) y no 0,0018
(95/53 610). Es un **costo por kilómetro proyectado a lo largo de la vida**, no el costo por
kilómetro realmente rodado.

Falta confirmar que sea así en toda la planilla y no una particularidad de esta hoja. Si es general,
`task_02` lo implementa; si no, el `Costo/Km` queda como está y se documenta la diferencia.

**Fragilidad que se adopta junto con la fórmula, y conviene decirla antes:** el km proyectado depende
de la tasa de desgaste estimada, así que un neumático apenas gastado proyecta muchísimo y muestra un
costo por kilómetro absurdamente bajo. Es el mismo problema del denominador chico que motivó la
razón de sumas, un nivel más abajo. La fórmula del costo realizado (`costo / km recorrido`) no lo
tiene. Si RENOVA confirma la suya, se implementa igual — es su métrica — pero sabiendo esto.

**Mientras no se responda:** `task_02` implementa solo `% desgaste` y deja `Costo/Km` intacto.

### D8 — Estado explícito cuando todo queda excluido · 2026-07-26

Se conserva el período elegido y se muestra «Todas las mediciones de este período son
inconsistentes», con las filas visibles y el motivo de cada una. No se salta a otro mes y no se
publican KPI en cero.

### D9 — ¿Promedio de llantas o de vehículos a nivel flota? · no bloquea

`D3` fija ponderado por llanta. Sobre los datos de hoy las dos rutas convergen (6 996 vs 6 993), así
que la pregunta no urge — pero con una flota desbalanceada (una unidad con 10 neumáticos y otra con
2) se separan. Conviene preguntárselo a RENOVA cuando esté la planilla completa.
