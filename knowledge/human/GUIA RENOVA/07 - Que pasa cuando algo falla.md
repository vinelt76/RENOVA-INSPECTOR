---
title: "Qué pasa cuando algo falla"
updated: 2026-07-12
status: vigente
sources: [app/src/sync, tasks_opencode/STATE.md, CLAUDE.md]
---

# Qué pasa cuando algo falla

## No hay internet

La inspección queda en el teléfono. La cola vuelve a probar al abrir la app, recuperar conexión, guardar algo nuevo o cerrar el día.

## Se corta internet durante el envío

No se pierde lo local. Queda un error y un próximo intento. Un fallo no bloquea las otras inspecciones.

## El inspector cambia algo mientras se está enviando

La versión nueva queda pendiente. La respuesta vieja no puede marcarla como entregada.

## Se aprieta “terminar”

Solo se borra del teléfono lo confirmado en Supabase. Lo dudoso se conserva.

## Un tablero queda vacío

No asumir enseguida que no hay datos. Puede faltar sesión, permiso, configuración, respuesta de la vista o puede haber un error de JavaScript. Hay que mirar el badge y la consola.

## Una empresa ve datos de otra

Es un problema grave de seguridad. Dejar de publicar esa superficie y revisar RLS, perfil, grants y si la vista usa permisos del usuario.

## Un número no coincide entre pantallas

Revisar si una pantalla todavía calcula por su cuenta. La meta es que todos lean la misma vista o regla probada. No arreglarlo copiando otra constante.

## Prueba mínima después de un cambio

Abrir el flujo real, cargar datos, comprobar que se ven, recargar, confirmar que siguen y revisar que la consola no tenga errores. Si toca nube, confirmar además la fila o respuesta real.

Seguir con [[08 - Estado actual y futuro]].

