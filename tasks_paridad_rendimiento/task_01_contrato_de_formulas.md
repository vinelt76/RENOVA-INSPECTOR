# task_01 — Contrato de fórmulas verificado contra la planilla

## 1. Objetivo y resultado observable

Fijar por escrito, y verificado celda por celda, qué fórmula usa RENOVA para cada métrica de
rendimiento. Sin esto, cualquier cambio de cálculo es una opinión.

Resultado observable: `CONTRATOS_DATOS.md` §2 y §3 reproducen las 17 celdas de la hoja de la 225,
y existe un script o consulta que lo demuestra sin intervención manual.

## 2. Estado

**Hecha el 2026-07-26.** `CONTRATOS_DATOS.md` y `AUDIT.md` §1 son su entregable.

Lo que queda pendiente **no bloquea** las tareas siguientes, pero sí cierra esta:

- Confirmar `$/Km` contra otra hoja de la planilla (ver `DECISIONES.md` D6).
- Confirmar si la planilla tiene algún nivel de agrupación por encima del vehículo (marca, diseño,
  flota) y, si lo tiene, con qué estadística lo resume (ver D9).

## 3. Dependencias

Ninguna. Bloquea `task_02` y `task_05`.

## 4. Archivos

- `tasks_paridad_rendimiento/CONTRATOS_DATOS.md`
- `tasks_paridad_rendimiento/AUDIT.md`

Solo lectura: la planilla de RENOVA, `supabase/views_demo.sql`, `WEB/rendimiento.html`.

## 5. Criterio de cierre

- [x] Las seis fórmulas por neumático deducidas y verificadas contra las celdas.
- [x] El renglón total identificado como promedio simple, con las cinco celdas verificadas.
- [x] Documentado el alcance de la evidencia: la hoja demuestra el resumen **de un vehículo**, no
      los agrupamientos generales.
- [ ] `$/Km` confirmado en una segunda hoja (D6).
- [ ] Niveles de agrupación de la planilla relevados (D9).

## 6. Trampas

- **No generalizar desde una hoja.** Ya pasó una vez en esta sesión: se concluyó que toda la
  agregación del panel debía volver a promedio simple, cuando la hoja solo evidencia el resumen de
  un vehículo. Ver `AUDIT.md` §6.
- **La planilla es una foto del 07/05/26**, anterior a la inspección de julio que tiene el sistema.
  Comparar contra la inspección equivalente, no contra la última.
