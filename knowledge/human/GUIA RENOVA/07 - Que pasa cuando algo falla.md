---
title: "Qué pasa cuando algo falla"
updated: 2026-07-26
status: vigente
sources: [app/src/sync, WEB, app movimientos, supabase/migrations, knowledge/ai/10, CLAUDE.md]
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

## Alguien consulta una unidad sin login

Hoy puede ocurrir mediante las tres RPC de la app de inspección. No es una falla nueva ni significa
que RLS de todas las tablas esté roto: es una excepción conocida para mantener el piloto móvil.
Debe registrarse como riesgo crítico y cerrarse con identidad de dispositivo/inspector. Ver
[[11 - Seguridad usuarios y empresas]].

## Un número no coincide entre pantallas

Revisar si una pantalla todavía calcula por su cuenta. La meta es que todos lean la misma vista o regla probada. No arreglarlo copiando otra constante.

## El RTD aumenta de una inspección a otra

Puede ser un cambio de neumático no registrado o una medición incorrecta. Rendimiento deja la fila
visible, la saca del KPI y muestra el motivo. No crea automáticamente una instalación.

## El supervisor emitió pero no aparece en la historia

La orden y la ejecución pueden existir aunque sigan `pending` de reconciliación. Revisar la orden,
la captura del operario y después el casco/ciclo/instalación. No inventar una fecha o un movimiento
para hacer coincidir las pantallas.

## Servicios no se refresca al instante

La tabla de ejecuciones todavía no está publicada en Realtime. La pantalla vuelve a consultar al
recuperar foco y cada diez segundos mientras está visible. Si falla, conserva los datos anteriores
y se debe revisar conexión, sesión y consola.

## Hay más de 2.000 servicios

La pantalla muestra un aviso porque actualmente no pagina. No ignorar el aviso ni presentar el
recorte como un total completo.

## Prueba mínima después de un cambio

Abrir el flujo real, cargar datos, comprobar que se ven, recargar, confirmar que siguen y revisar
que la consola no tenga errores. Si toca nube, confirmar además la fila o respuesta real. Si toca
seguridad, probar al menos usuario correcto, otro usuario/empresa y cliente sin sesión.

Seguir con [[08 - Estado actual y futuro]].
