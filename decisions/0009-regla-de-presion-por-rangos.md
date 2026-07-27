# ADR-0009 — La regla de presión son rangos por medida y eje, no referencia ± porcentajes

- **Fecha:** 2026-07-25
- **Estado:** Aceptada
- **Autoridad:** dueño de negocio (declaración directa)
- **Contexto de origen:** `auditoria_lunes/` — hallazgo H-02

## Contexto

`specs/reglas_negocio.md` §3 modelaba el estado de presión como una referencia por empresa/medida/
tipo de eje (`presion_ref`) ajustada por dos porcentajes (`delta_alto_pct` +5 %, `delta_bajo_pct`
−10 %), con ejemplos como «315/80R22.5 Dirección: ref 110 → Alta desde 116, Baja desde 99».

Ese modelo se implementó fielmente en `calcularEstadoPresion` (`app/src/core/calculations.ts`),
con paridad Python/TS verificada y cobertura golden. **Nunca tuvo un solo llamador**: la app de
inspección captura la presión y no muestra estado.

Mientras tanto, los dashboards clasificaban con `fn_pressure_state_fixed(p_psi)`, una regla plana
100/130 PSI para toda medida y todo eje, declarada provisional en su propio comentario. Era la
única clasificación de presión que un jefe de flota llegaba a ver.

La auditoría del 2026-07-25 midió la divergencia entre ambas y la reportó como «15.8 % de
mediciones mal clasificadas». Al contrastarla con el dueño de negocio apareció el problema real:
**la spec estaba equivocada**. Ni el modelo ni los valores eran los que usa la operación.

## Decisión

1. **El modelo son rangos absolutos mín–máx**, por medida y tipo de eje, con extremos inclusivos.
   No hay referencia ni porcentajes.

   | Medida | Tipo de eje | Rango |
   |---|---|---|
   | 295/80R22.5 | Direccional / Tracción / Libre | 100 – 125 PSI |
   | 315/80R22.5 | Tracción / Libre | 100 – 125 PSI |
   | 315/80R22.5 | Direccional | 105 – 125 PSI |

2. **Los rangos viven en datos**, en `pressure_thresholds` sembrada por empresa, aunque hoy las
   cuatro empresas compartan los mismos valores. Escribirlos en el cuerpo de la función sería más
   corto y convertiría el primer pedido distinto de una empresa en una migración.

3. **Medición en FRÍO.** `inspection_measurements.temperature_mode` recibe default `'COLD'` y se
   backfillea, para dejar constancia verificable mientras la afirmación es cierta.

4. **CALIENTE no se clasifica.** `fn_pressure_state()` devuelve `NULL` ante `'HOT'`, no un
   veredicto.

## Por qué CALIENTE sigue abierto

No es una decisión postergada: es información que no existe. Las empresas que miden siempre en
caliente son agencias de las que todavía no hay data, y sin mediciones reales contra las que
calibrar, cualquier ajuste sería inventado — que es justamente lo que `specs/reglas_negocio.md`
prohíbe desde el principio.

La deuda queda **acotada**, no abierta: el día que llegue esa data, todas las filas anteriores
están marcadas `'COLD'` y no hay que adivinar retroactivamente qué era cada una.

## Consecuencias

- 40 de 2 247 mediciones cambian de estado: 34 pasan de «Normal» a «Alta Presión» (126–130 PSI),
  6 de «Normal» a «Baja Presión» (315 Direccional entre 100 y 104), y 3 de «Baja Presión» a
  «Normal» (exactamente 100 PSI, que la regla vieja marcaba baja por usar `<=`).
- La ficha de `Inspecciones por unidad` deja de imprimir «RANGO NORMAL: 100–130 PSI» para toda
  posición y muestra el rango que corresponde a esa medida y eje.
- `calcularEstadoPresion` queda **obsoleta tal como está**: implementa el modelo descartado. Hay
  que adaptarla a rangos o retirarla, junto con la decisión sobre `calcularVur` y
  `calcularTasaDesgaste`, que tampoco tienen llamador. Ver
  `auditoria_lunes/tasks/task_07_motor_calculo_sin_destino.md`.
- La columna de la vista conserva el nombre `pressure_state_fixed` por compatibilidad, aunque ya
  no sea una regla fija. Renombrarla exige `DROP`+`CREATE` de una vista con dependientes; queda
  como tarea propia.

## Alternativas descartadas

- **Expresar los rangos como ref ± porcentajes** para no tocar la spec: 105–125 daría +19 %/−4.5 %
  sobre una ref de 110. Números sin sentido físico, elegidos solo para encajar en un modelo que ya
  se sabe equivocado.
- **Dejar la regla plana 100/130 hasta después de la demo**: es la que imprime un rango incorrecto
  en pantalla, y el error va en la dirección peligrosa (sobreinflado mostrado como normal).
