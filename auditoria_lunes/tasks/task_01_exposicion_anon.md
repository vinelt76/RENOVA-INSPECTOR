# task_01 — Cerrar la lectura de datos de flota sin sesión

**Hallazgo:** H-01 · **Prioridad:** Alta · **Tipo:** decisión + implementación
**Bloquea la demo:** no técnicamente, sí como afirmación («los datos requieren login» hoy es falso)

## Problema

`anon` ejecuta tres RPC `SECURITY DEFINER` que no pasan por RLS: `get_unidad_preload`,
`get_umbrales_rtd` y `save_inspection`. Con la clave publicable —commiteada en
`WEB/supabase-config.public.js` y publicada en el bundle estático— se leen 14 filas reales de la
unidad 2145 de MÓVIL BUS sin sesión, y se pueden escribir inspecciones en cualquier empresa
resolviendo el nombre desde el payload.

Evidencia: `../evidencia/D-supabase-lecturas.md` §D7 y §D8.

## Por qué no es un fix mecánico

Revocar `anon` deja la app de inspección sin poder sincronizar: **no tiene login**. Esa es la
deuda madre («la app móvil opera como `anon`, sin identidad de inspector») y está listada como
decisión bloqueante en el roadmap junto a «estrategia final de login/sesión offline para
inspectores».

## Opciones (elegir una, con ADR)

1. **Identidad de inspector con Auth** — la app de inspección hace login como las otras dos apps;
   se revoca todo a `anon`. Es la solución correcta y la más cara: hay que resolver sesión offline
   (el inspector trabaja sin señal) y provisionar cuentas.
2. **Clave restringida por rol** — un rol Postgres dedicado para la app con `EXECUTE` acotado, y
   `anon` sin nada. No resuelve la identidad, pero saca la superficie del navegador público.
3. **Aceptar y acotar** — dejarlo, documentarlo en el ADR como riesgo asumido para la etapa piloto,
   y **no** afirmar ante el cliente que los datos exigen autenticación. Requiere al menos que
   `get_unidad_preload` deje de aceptar cualquier empresa por nombre.

## Criterio de cierre

- ADR en `decisions/` con la opción elegida y su razón.
- Si es (1) o (2): `select count(*) from public.get_unidad_preload(...)` como `anon` devuelve
  error de permisos, y la app de inspección sigue sincronizando (prueba en APK real, no solo build).
- Si es (3): el riesgo queda escrito en `knowledge/ai/08 - Infraestructura seguridad y despliegue.md`
  y nadie afirma lo contrario en la demo.

## No hacer

No revocar `anon` sin probar antes que la app de inspección sigue sincronizando. Un `REVOKE`
suelto rompe el flujo de campo completo, en silencio, hasta que un inspector se queda sin subir el
día.
