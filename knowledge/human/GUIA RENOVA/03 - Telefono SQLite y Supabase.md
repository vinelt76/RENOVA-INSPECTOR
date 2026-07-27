---
title: "Teléfono, SQLite y Supabase"
updated: 2026-07-26
status: vigente
sources: [app/src/db, app/src/sync, supabase/migrations, decisions/0001-tenancy.md, decisions/0010-exposicion-anon-de-la-app-de-inspeccion.md, Supabase read-only audit 2026-07-26]
---

# Teléfono, SQLite y Supabase

## SQLite: la libreta del teléfono

SQLite es un archivo-base de datos dentro del aparato. Guarda empresas, unidades, catálogos, inspecciones y la cola. No necesita internet. En el navegador de desarrollo se usa una imitación compatible para poder probar.

## Supabase: el archivo central

Supabase guarda la historia de todos los dispositivos, separa empresas y hace cuentas compartidas
para los tableros. También avisa en vivo cuando entran inspecciones.

Al 26 de julio, el remoto tiene RLS en sus tablas y las vistas de los tableros exigen una sesión.
Realtime avisa directamente los cambios de inspecciones y mediciones. Los servicios del operario
todavía usan una consulta periódica adicional porque su tabla no está publicada en Realtime.

## La cola: el cadete

La cola lleva una lista de sobres pendientes. Si entrega uno, lo marca entregado. Si falla, anota el error y espera un poco antes de repetir. Cada nuevo fallo aumenta la espera hasta un máximo de cinco minutos.

Si el inspector cambia una rueda mientras el sobre anterior viaja, la cola reconoce que hay una versión nueva. No deja que la confirmación del sobre viejo haga pasar la nueva como entregada.

## Quién manda

- Mientras no subió: manda la copia del teléfono.
- Cuando subió: Supabase es el archivo consolidado.
- Para saber por qué una rueda fue marcada: se conserva una copia de los límites usados ese día.
- Para saber qué trabajo se pidió: manda la orden del supervisor.
- Para saber qué ocurrió: manda la captura del operario.
- Para la vida canónica del neumático: mandan casco, ciclo, instalación y retiro; hoy falta
  reconciliar automáticamente varias capturas del operario contra esa historia.

## Seguridad en criollo

RLS es como un portero que mira el usuario y solo abre el archivador de su empresa. La clave pública
no es una contraseña secreta y puede estar en una app o navegador.

Pero RENOVA tiene una excepción importante: la app de inspección todavía no inicia sesión. Para que
pueda trabajar, tres RPC especiales siguen abiertas con esa clave pública. Esas RPC permiten buscar
una unidad, leer umbrales y guardar inspecciones. Como son `SECURITY DEFINER`, no pasan por el
portero normal de las filas.

En sencillo: **los dashboards están cerrados con login, pero esas tres ventanillas de la app móvil
todavía no**. Esto está aceptado solo para el piloto. Ver [[11 - Seguridad usuarios y empresas]].

Seguir con [[04 - La vida de un neumatico]].
