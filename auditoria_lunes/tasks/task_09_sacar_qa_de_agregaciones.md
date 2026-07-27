# task_09 — Marcar los datos de prueba para que no vuelvan a contaminar

**Hallazgo:** H-10 (y resuelve H-05) · **Prioridad:** Alta
**Bloquea la demo:** ya no, si la recarga de base limpia ocurre

## Estado tras la aclaración del dueño de negocio (2026-07-25)

Los datos de `QA-CN16` y de la unidad `5028` **eran pruebas deliberadas de casos límite** que
quedaron olvidadas en producción. **Se va a recargar la base de datos limpia.**

Eso resuelve el síntoma medido —el KPI de Rendimiento pasando de 138K a ~10.7K km/mm— sin
necesidad de decidir nada sobre borrado. Lo que este task conserva es lo otro: **por qué nadie se
dio cuenta durante cinco días**.

## Lo que la recarga no arregla

1. **No hay forma de distinguir un dato de prueba de uno real.** `QA-CN16` solo se reconoce por
   convención de nombre y por la marca literal `QA-TEST` en algunos cascos. Nada en el esquema lo
   sabe. La próxima prueba de caso límite vuelve a quedar indistinguible.
2. **Nada avisó de que un neumático rendía 233 542 km/mm.** Ni las 385 pruebas, ni el dashboard,
   ni una alerta. El número imposible se mostró como el KPI principal y solo apareció al mirarlo
   con ojos humanos.
3. **La orden `63b5ccf7…` sigue `in_progress`** desde el 2026-07-20 sobre `QA-CN16`. Si la recarga
   no la incluye, sigue apareciendo en la bandeja del operario (`task_03`).

## Trabajo

1. **Columna real de entorno.** `is_test boolean not null default false` o `environment text` en
   `units` (y propagada a `tire_casings` si hace falta), respetada por las vistas de agregación.
   Es lo que el roadmap ya proponía como la salida correcta, frente a filtrar por patrón inventado
   —prefijo de placa, nombre de unidad— que ADR-D8 rechazó con razón: adivinar un patrón puede
   ocultar datos reales, y esconder filas en una vista hace que el problema deje de verse sin dejar
   de contaminar.
   Con la columna, las pantallas pueden ofrecer «incluir datos de prueba» en vez de mentir por
   omisión, y probar casos límite en producción deja de ser peligroso.
2. **Verificar después de la recarga** que el KPI KM/MM queda en el orden de 10 000–20 000 km/mm y
   que Servicios ya no lista los servicios de `QA-CN16`.
3. **Confirmar que la orden colgada desapareció.** Si no, cerrar `task_03`.

## Criterio de cierre

- Existe una forma de marcar datos de prueba que no dependa del nombre de la unidad.
- KM/MM en Rendimiento dentro de un rango físicamente plausible tras la recarga.
- La bandeja del operario no muestra órdenes de unidades de prueba.
- Lo que se haya tocado en producción queda escrito en `knowledge/ai/15 - Bitacora diaria.md`.

## Nota

Este task perdió urgencia con la recarga, pero es el que más previene: los tres hallazgos más
visibles de esta auditoría (H-10, H-11, H-02) tienen la misma forma —datos implausibles que nadie
detectó— y ninguno lo habría atrapado una prueba unitaria. Ver el cierre de `REPORTE.md`.
