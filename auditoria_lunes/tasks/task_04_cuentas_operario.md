# task_04 — Que el flujo de movimientos se pueda ejecutar en la empresa que se demuestre

**Hallazgo:** H-04 · **Prioridad:** Alta para la demo · **Tipo:** provisión / alcance
**Bloquea la demo:** sí, si el lunes se muestra una empresa que no sea MÓVIL BUS

## Problema

Perfiles activos en producción: 4 `fleet_manager` (uno por empresa) y **un solo `operator`, en
MÓVIL BUS**. Cero `tire_supervisor` — no importa, porque la migración
`20260720022451_movement_order_fleet_manager_compatibility.sql` autoriza `fleet_manager` tanto en
la política RLS como dentro de `create_tire_movement_order`.

Evidencia: `../evidencia/D-supabase-lecturas.md` §D1.

Si la demo usa CIVA, CRUZ DEL SUR o ITTSABUS: el supervisor emite la orden, se ve en la web… y
nadie puede tomarla. `claim_tire_movement_order` exige rol `operator` de la misma empresa
(`20260720012248…sql:292`). El recorrido se corta a la mitad, en vivo.

## Dos caminos

**A — Acotar el guion (media hora).** Fijar la demo del flujo de movimientos en MÓVIL BUS, que es
además la única empresa con órdenes y ejecuciones reales. Las otras tres se muestran en
dashboards, inspección y Servicios sin tocar la app de operario. Requiere que quien presenta lo
sepa de antemano.

**B — Provisionar cuentas (lo que pide el roadmap).** Crear un `operator` activo por empresa.
Es la decisión bloqueante ya registrada: «crear y provisionar cuentas reales `tire_supervisor`
por empresa». Implica cuentas Auth reales, perfiles con `company_id` correcto y contraseñas
entregadas a alguien — no se improvisa el domingo.

Recomendación: **A para el lunes, B como trabajo real después.** B a último momento produce
cuentas de prueba que después nadie borra, que es exactamente el origen de H-05.

## Criterio de cierre

- Si A: el guion de demo dice explícitamente qué empresa se usa para movimientos, y por qué.
- Si B: cada empresa tiene ≥1 `operator` activo, y se verificó el recorrido completo
  emitir→tomar→completar en al menos una empresa distinta de MÓVIL BUS.
- El dominio de login coincide con el de las cuentas creadas — si no, el operario escribe su
  usuario y el login falla sin explicar por qué.

## Sobre el arreglo de login del último commit (F-08 de Codex, verificado)

Codex observa —con razón— que el cambio de login de la app de movimientos **no está demostrado
contra Auth real**. Verificado: `app movimientos/.env.local` define solo `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`; **no** define `VITE_SUPABASE_LOGIN_EMAIL_DOMAINS`, así que sigue vigente
el fallback `operarios.renova.local` y la transformación efectiva es la misma que antes del cambio.

Es decir: si el login fallaba por otra causa —usuario Auth inexistente, correo no confirmado,
perfil ausente, `profiles.active = false`, rol distinto de `operator`— el commit no la tocó.

Se refuerza con lo medido acá: **existe una sola cuenta `operator` en todo el sistema**. Antes de
declarar el login arreglado hay que iniciar sesión con la cuenta real que se va a usar el lunes.
No es una verificación de código, es un ensayo.
