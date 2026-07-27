---
title: "Seguridad, usuarios y empresas"
updated: 2026-07-26
status: vigente
sources: [decisions/0001-tenancy.md, decisions/0010-exposicion-anon-de-la-app-de-inspeccion.md, knowledge/ai/08, Supabase read-only audit 2026-07-26]
---

# Seguridad, usuarios y empresas

## La idea sencilla

RENOVA guarda información de varias empresas en la misma base. La regla es que una persona debe ver
solo la empresa asociada a su cuenta.

Supabase aplica esa separación de dos maneras:

1. **Login:** demuestra quién es el usuario.
2. **RLS:** revisa a qué empresa pertenece y filtra las filas.

Una vista debe usar `security_invoker` para respetar los permisos de quien la abre. Una RPC de
taller además valida el rol permitido antes de escribir.

## Qué está protegido hoy

En la revisión remota del 26 de julio:

- las tablas públicas tenían RLS;
- las 24 vistas públicas respetaban los permisos del usuario;
- esas vistas permitían lectura a usuarios autenticados, no a clientes anónimos;
- la app del operario exigía login;
- el operario y el supervisor recibían la empresa desde su perfil.

Tener la URL de Supabase o una clave publicable no permite leer directamente todas esas tablas y
vistas.

## La excepción importante de la app de inspección

La app del inspector todavía no tiene login. Para que pueda buscar una unidad y sincronizar, tres
RPC siguen abiertas sin sesión:

- `get_unidad_preload`: busca los datos conocidos de una unidad;
- `get_umbrales_rtd`: entrega límites de desgaste;
- `save_inspection`: guarda una inspección.

Son funciones `SECURITY DEFINER`. Trabajan con permisos especiales y no pasan por la RLS normal de
las filas. El asesor de Supabase también las marca como expuestas.

En palabras simples:

> El login protege los dashboards, pero no cierra esas tres ventanillas móviles.

Una persona que tenga la clave pública y conozca empresa/placa puede intentar usarlas. Por eso no se
debe afirmar en una presentación que todos los datos exigen autenticación.

## Por qué no se cierran de inmediato

Si se revocan hoy, la app de inspección deja de sincronizar. El trabajo quedaría guardado en el
teléfono, pero no llegaría al archivo central.

La opción intermedia recomendada es una cuenta de dispositivo por empresa, iniciada de forma
silenciosa. La solución final es identidad real del inspector con una sesión que siga funcionando
sin señal.

Este riesgo está aceptado solo para el piloto. Debe cerrarse antes de operar en volumen con varios
clientes reales.

## Claves públicas y claves secretas

- La clave publicable o `anon` puede ir en una app o navegador; su seguridad depende de permisos,
  RLS y RPC bien cerradas.
- `service_role` y las claves secretas nunca deben ir en el APK, HTML, Git ni estas notas.
- Una contraseña de usuario tampoco debe copiarse a documentación compartida.

## Roles principales

- **Inspector:** todavía sin identidad propia en la app de inspección.
- **Operario:** toma y completa órdenes.
- **Supervisor de neumáticos:** emite órdenes.
- **Jefe de flota:** rol histórico admitido en algunas operaciones.
- **Administrador:** acceso más amplio, que debe seguir limitado por empresa y función.

## Si aparece una mezcla entre empresas

1. Detener la publicación o demo de esa superficie.
2. Confirmar usuario y empresa del perfil.
3. Revisar RLS, grants y `security_invoker`.
4. Revisar controles internos de la RPC.
5. Probar con dos cuentas de empresas distintas y con cliente sin sesión.
6. No “arreglar” el problema ocultando filas en JavaScript.

Seguir con [[12 - Deuda riesgos y decisiones pendientes]].
