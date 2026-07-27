-- RENOVA — Dejar constancia de que las mediciones vigentes son en FRÍO.
--
-- EL PROBLEMA QUE EVITA
--
-- `inspection_measurements.temperature_mode` (enum `temperature_mode`: 'COLD' / 'HOT') existe
-- desde la primera migración (`20260706120000_demo_vertical_slice.sql:48`) y está **vacía en las
-- 2 247 mediciones**: nada la escribe. `save_inspection` no la menciona y el payload de
-- `pushInspeccion.ts` no la envía.
--
-- Hoy se puede afirmar con certeza que todas las mediciones son en frío, porque así opera el
-- procedimiento de las cuatro empresas actuales. El día que entre la primera agencia que mide en
-- caliente, esa certeza se pierde PARA SIEMPRE sobre las filas ya guardadas: quedan mezcladas y
-- sin forma de distinguirlas.
--
-- Escribir 'COLD' ahora cuesta una línea y acota la deuda de CALIENTE: cuando exista la data de
-- las agencias, se implementa la regla y nada más. Sin esto, además habría que adivinar
-- retroactivamente qué era cada fila vieja.
--
-- POR QUÉ UN DEFAULT Y NO UN CAMBIO EN save_inspection
--
-- `save_inspection` no nombra la columna en su INSERT, así que el DEFAULT alcanza para que toda
-- fila nueva quede marcada. Modificar esa RPC —el único camino de escritura de la app de campo—
-- para setear una constante sería un riesgo desproporcionado a días de la demo.
--
-- Cuando la app capture la temperatura de verdad, `save_inspection` empezará a enviarla explícita
-- y el DEFAULT pasará a ser solo la red de seguridad.

alter table public.inspection_measurements
  alter column temperature_mode set default 'COLD'::public.temperature_mode;

comment on column public.inspection_measurements.temperature_mode is
  'Temperatura de la medición de presión. Default COLD: refleja el procedimiento vigente de las empresas actuales, no una suposición sobre datos futuros. Una agencia que mida en caliente debe enviar HOT explícito — fn_pressure_state() devuelve NULL en ese caso porque la regla CALIENTE no está definida (specs/reglas_negocio.md §3).';

-- Backfill de lo existente, mientras la afirmación sigue siendo verificablemente cierta.
-- Acotado a filas sin valor: no pisa nada que alguien haya marcado a mano.
update public.inspection_measurements
   set temperature_mode = 'COLD'::public.temperature_mode
 where temperature_mode is null;

-- Verificación esperada tras aplicar: 0 filas.
--   select count(*) from public.inspection_measurements where temperature_mode is null;
