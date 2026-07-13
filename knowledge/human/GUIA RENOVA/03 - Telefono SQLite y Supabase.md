---
title: "Teléfono, SQLite y Supabase"
updated: 2026-07-12
status: vigente
sources: [app/src/db, app/src/sync, supabase/migrations]
---

# Teléfono, SQLite y Supabase

## SQLite: la libreta del teléfono

SQLite es un archivo-base de datos dentro del aparato. Guarda empresas, unidades, catálogos, inspecciones y la cola. No necesita internet. En el navegador de desarrollo se usa una imitación compatible para poder probar.

## Supabase: el archivo central

Supabase guarda la historia de todos los dispositivos, controla quién puede ver cada empresa y hace cuentas compartidas para los tableros. También avisa en vivo cuando entran inspecciones.

## La cola: el cadete

La cola lleva una lista de sobres pendientes. Si entrega uno, lo marca entregado. Si falla, anota el error y espera un poco antes de repetir. Cada nuevo fallo aumenta la espera hasta un máximo de cinco minutos.

Si el inspector cambia una rueda mientras el sobre anterior viaja, la cola reconoce que hay una versión nueva. No deja que la confirmación del sobre viejo haga pasar la nueva como entregada.

## Quién manda

- Mientras no subió: manda la copia del teléfono.
- Cuando subió: Supabase es el archivo consolidado.
- Para saber por qué una rueda fue marcada: se conserva una copia de los límites usados ese día.

## Seguridad en criollo

RLS es como un portero que mira el usuario y solo abre el archivador de su empresa. Tener la dirección de Supabase o una clave pública no da permiso para mirar todo; las reglas de acceso siguen siendo obligatorias.

Seguir con [[04 - La vida de un neumatico]].

