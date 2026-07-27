# Auditoría de flujos — lunes 2026-07-27

Auditoría de los flujos de punta a punta (app de inspección, app de movimientos, dashboards web)
para decidir si el sistema está listo para presentarse el lunes. Ejecutada el 2026-07-25 sobre el
commit `ddcc9d2`.

Continúa `verificacion/` (2026-07-24), que cubrió el motor de cálculo y el flujo de datos. Esta
auditoría verifica si aquello sigue abierto y añade lo que faltaba: permisos reales, datos reales
de producción, contrato supervisor→operario y estado de las suites.

## Documentos

- **[TRASPASO.md](TRASPASO.md)** — **empezar por acá si retomas desde cero.** Documento
  autocontenido: estado, lo aplicado a producción, decisiones, lo que sigue abierto, y las trampas
  que ya costaron tiempo una vez.
- **[ESTADO.md](ESTADO.md)** — qué se implementó y qué quedó pendiente, en tabla.
- **[REPORTE.md](REPORTE.md)** — veredicto, lo verificado verde y los 13 hallazgos. Lleva al inicio
  un bloque con las tres correcciones del 2026-07-25.
- **[COMPARACION.md](COMPARACION.md)** — contraste con `REPORTE_IA_DEMO_LUNES_2026-07-25.md`, el
  reporte independiente de Codex: dónde coinciden, qué encontró cada uno y por qué.
- **evidencia/** — salidas crudas y consultas.
  - `A-app-lint-test-build.txt` — `app/`: lint, 47/47, build.
  - `B-app-movimientos-test-build.txt` — `app movimientos/`: 5/5, build.
  - `C-web-suites.txt` — suites de `WEB/`.
  - `D-supabase-lecturas.md` — consultas de solo lectura contra producción, con SQL y resultados.
  - `E-smoke-navegador.md` — smoke autenticado de los 4 dashboards, con lo medido detrás de cada
    número que aparece en pantalla.

## Tasks

Ordenados por lo que más cambia lo que el cliente ve el lunes.

| # | Título | Prioridad | ¿Antes del lunes? |
|---|---|---|---|
| [06](tasks/task_06_regla_presion.md) | Implementar la regla de presión real | Alta | **Al menos el rango impreso** |
| [05](tasks/task_05_quitar_voseo.md) | Quitar el voseo argentino (7 textos) | Alta | **Sí** |
| [04](tasks/task_04_cuentas_operario.md) | Operario en la empresa que se demuestre | Alta | **Sí** |
| [10](tasks/task_10_odometro.md) | Odómetro: el importador convierte «sin dato» en 0 | Alta | El defecto sí |
| [11](tasks/task_11_defectos_ui.md) | Defectos de UI vistos en pantalla | Baja | Sí (minutos) |
| [01](tasks/task_01_exposicion_anon.md) | Cerrar la lectura de datos de flota sin sesión | Alta | Decisión sí, fix no |
| [09](tasks/task_09_sacar_qa_de_agregaciones.md) | Marcar los datos de prueba | Alta | La recarga cubre el síntoma |
| [03](tasks/task_03_limpiar_datos_qa.md) | Sacar la orden QA colgada de la bandeja | Media | Lo cierra la recarga |
| [02](tasks/task_02_revocar_grants_vistas.md) | Revocar el DML concedido sobre 19 vistas | Media | No |
| [07](tasks/task_07_motor_calculo_sin_destino.md) | Motor de cálculo sin destino (VUR, tasa, IDI, RTD histórico) | Alta | No |
| [08](tasks/task_08_verificacion_de_un_tiron.md) | Verificar todo con un comando | Media | No |

Del reporte de Codex conviene adoptar tal cual, sin rehacer: su §14 (checklist P0/P1/P2), §16
(riesgos de presentación) y §17 (guion técnico mínimo).

## Alcance y límites

- **No se aplicó ninguna escritura en producción.** Todas las consultas fueron `SELECT`.
- **No se corrigió nada**: esta auditoría reporta y propone, como pide `CLAUDE.md` ante un
  conflicto entre intención e implementación.
- **Smoke de navegador hecho** sobre `http://localhost:8766/` con sesión de
  SUPERVISOR DE NEUMÁTICOS · MÓVIL BUS, iniciada por el usuario. Los tres hallazgos de mayor
  impacto (H-10, H-11, H-02) salieron de ahí, no del código.
- **Pendiente**: los 6 tests SQL de `supabase/tests/`, que necesitan escritura; la app de
  inspección y la de movimientos en APK sobre dispositivo real; y el aislamiento visual entre dos
  empresas distintas en los dashboards.
