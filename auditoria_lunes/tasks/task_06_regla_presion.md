# task_06 — Implementar la regla de presión real

**Hallazgo:** H-02 · **Prioridad:** Alta · **Tipo:** implementación + corrección de la spec
**Bloquea la demo:** el rango impreso sí; la clasificación en sí, menos de lo que se creía

## La regla real (declarada por el dueño de negocio, 2026-07-25)

| medida | tipo de eje | rango normal |
|---|---|---|
| 295/80R22.5 | Dirección | **100 – 125 PSI** |
| 295/80R22.5 | Tracción / Libre | **100 – 125 PSI** |
| 315/80R22.5 | Tracción / Libre | **100 – 125 PSI** |
| 315/80R22.5 | **Dirección** | **105 – 125 PSI** |

Fuera de rango por arriba → Alta Presión. Por abajo → Baja Presión. Sin lectura → Sin Medir.

## Corrección importante al reporte inicial

El reporte de esta auditoría midió **110 de 698 mediciones (15.8 %) mal clasificadas**. Ese número
se calculó contra `specs/reglas_negocio.md` §3, cuyos valores de ejemplo (315/80R22.5 Dirección:
`presion_ref = 110` → 99–115.5 PSI) **no son la regla que usa el negocio**.

Recalculado contra la regla real, sobre **las 2 247 mediciones** (todas son de estas dos medidas):

| lo que muestra hoy | regla real | n | % |
|---|---|---:|---:|
| Normal | Normal | 1 961 | 87.3 % |
| Sin Medir | Sin Medir | 232 | 10.3 % |
| **Normal** | **Alta Presión** | **34** | **1.5 %** |
| Baja Presión | Baja Presión | 13 | 0.6 % |
| **Normal** | **Baja Presión** | **6** | **0.3 %** |
| Alta Presión | Alta Presión | 1 | 0.0 % |

**40 mediciones mal clasificadas (1.8 %), no 110 (15.8 %).** El problema es real pero **9 veces más
chico** de lo que reporté. La regla plana 100/130 resulta estar mucho más cerca de la regla real
que de la spec: las únicas diferencias son la banda 125–130 (mostrada Normal, es Alta) y el piso
de 105 en Dirección de 315.

Aun así, 34 mediciones de sobreinflado se muestran como normales.

## El hallazgo que queda en pie, y es más grave que el número

**`specs/reglas_negocio.md` §3 documenta una regla que el negocio no usa.** No es solo que los
valores difieran: difiere el **modelo**. La spec define `presion_ref` + `delta_alto_pct` +
`delta_bajo_pct` por empresa/medida/eje; la regla real son **rangos absolutos mín–máx** por
medida/eje, sin porcentajes y sin distinción por empresa.

Esto explica por qué `calcularEstadoPresion` quedó sin llamador: implementa fielmente un modelo
—ref ± porcentajes— que nadie iba a usar. La spec estaba equivocada, no la implementación ausente.

Según `CLAUDE.md`, un conflicto entre intención e implementación no se resuelve en silencio. Acá la
autoridad de negocio ya se pronunció, así que corresponde **corregir la spec**, no el código.

## Trabajo

1. **Actualizar `specs/reglas_negocio.md` §3** al modelo de rangos absolutos, con la tabla de
   arriba, y un ADR en `decisions/` que registre el cambio de modelo (ref+deltas → mín/máx) y por
   qué. Sin esto, la próxima persona vuelve a implementar el modelo viejo.
2. **Reemplazar `fn_pressure_state_fixed(p_psi)`** por una función que reciba medida y tipo de eje.
   Los umbrales van en datos (`umbral_presion`, que ya existe y está inerte), no en el cuerpo de la
   función: `CLAUDE.md` es explícito en que umbrales no se hardcodean.
   **Aunque hoy los rangos sean iguales para las cuatro empresas, la tabla se siembra igual por
   empresa.** Un valor universal escrito en la función parece más simple y obliga a una migración
   el día que una empresa pida algo distinto; sembrado en datos, ese día es un `UPDATE`.
3. **Corregir el rango impreso en la ficha.** Hoy `Inspecciones por unidad` muestra
   «RANGO NORMAL: 100-130 PSI» para toda posición. Es lo único de este task que se ve directamente
   en pantalla y lo más barato de arreglar.
4. **Decidir qué pasa con `calcularEstadoPresion`**: adaptarla al modelo de rangos y conectarla a
   la app —para que inspector y dashboard usen la misma regla por construcción— o retirarla.
   Ver `task_07`.

## Decisiones tomadas (dueño de negocio, 2026-07-25)

- **Los rangos son de medición en FRÍO.** Aplican a las cuatro empresas actuales.
- **CALIENTE sigue siendo deuda, y es genuina:** las empresas que miden siempre en caliente son
  agencias de las que todavía no hay data. No es una decisión postergada por descuido — no existe
  la información para tomarla. `specs/reglas_negocio.md:74` sigue vigente: no inventar un ajuste.

Esto **desbloquea** la implementación: se implementa FRÍO ahora, completo, sin esperar a CALIENTE.

## El detalle que hace que la deuda de CALIENTE sea pagable

`inspection_measurements.temperature_mode` **ya existe** —enum `temperature_mode` con valores
`'COLD'` / `'HOT'`, creado en la primera migración (`20260706120000_demo_vertical_slice.sql:48`)—
y está **vacío en las 2 247 mediciones**. Nada lo escribe: `save_inspection` no lo recibe y
`pushInspeccion.ts` no lo envía.

Consecuencia práctica: hoy se puede afirmar con certeza que **todas** las mediciones son en frío,
porque así opera el procedimiento actual. El día que entre la primera agencia que mide en caliente,
esa certeza se pierde para siempre sobre las filas ya guardadas — quedarán mezcladas y sin forma de
distinguirlas.

**Escribir `'COLD'` desde ahora cuesta casi nada y acota la deuda.** Es la diferencia entre una
deuda que se paga cuando llegue la data, y una deuda que además obliga a adivinar retroactivamente
qué eran los datos viejos. Incluir esto en el trabajo, y hacer el backfill de las 2 247 filas
existentes a `'COLD'` mientras la afirmación siga siendo cierta.

## Trabajo (continuación)

5. **Escribir `temperature_mode`** en `save_inspection` (valor `'COLD'`, enviado desde la app, no
   asumido en el servidor) y hacer backfill de las filas existentes.
6. **Que la función de estado exija el modo**: si `temperature_mode` es `'HOT'`, devolver un estado
   explícito de «sin regla definida» en vez de aplicar la regla de frío. Así, cuando llegue la
   primera agencia, el sistema lo dice en lugar de clasificar mal en silencio.

## Criterio de cierre

- La ficha de un neumático 315/80R22.5 en Dirección imprime «RANGO NORMAL: 105-125 PSI».
- Un neumático a 128 PSI aparece como Alta Presión en el dashboard.
- Las 34 mediciones hoy mal clasificadas cambian de estado, y el conteo se puede reproducir.
- `specs/reglas_negocio.md` §3 y el ADR reflejan el modelo de rangos, la decisión de FRÍO y el
  estado de la deuda de CALIENTE con su razón real (falta de data de agencias, no falta de
  decisión).
- `temperature_mode` deja de estar en NULL: las mediciones nuevas llegan con `'COLD'` y las 2 247
  existentes quedan backfilleadas.
- `/calc-parity-check` verde y `sync-migration-reviewer` sobre el cambio de `save_inspection`.
