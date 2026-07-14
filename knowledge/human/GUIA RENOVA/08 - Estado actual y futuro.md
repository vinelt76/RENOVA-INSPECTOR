---
title: "Estado actual y futuro"
updated: 2026-07-14
status: vigente
sources: [git, app/src, WEB, WEB/tire-change, supabase/migrations, tasks_opencode/STATE.md, tasks_cambios_neumaticos_ui/REVISION_FINAL.md]
---

# Estado actual y futuro

## Ya existe

- App de inspección para Android y navegador de prueba.
- Guardado local sin internet.
- Precarga de datos conocidos.
- Cálculos principales de captura.
- Umbrales RTD cambiables por empresa/medida.
- Cola durable con reintentos y protecciones contra pérdida.
- Supabase con separación por empresa para usuarios web.
- Tableros de inspección, flota, rendimiento e historial.
- Pantalla/RPCs de taller para instalar, retirar y trasladar, más rutas temporales.
- Modo **Cambios de neumáticos** en el tablero por unidad: arma varios movimientos (retén,
  descarte con foto, montaje, intercambio) y los confirma juntos en una sola operación. Probado
  de punta a punta con base real el 14 de julio.
- Guía de prueba de campo para ese modo: levantar `WEB/` en local, abrir la unidad `QA-CN16` en
  `?mode=cambios`, probar una posición vacía, una identidad marcada para revisar y confirmar el
  lote con odómetro. Quedó documentado para repetir la prueba sin improvisar.
- Inventario y Comparativo retirados intencionalmente del producto web.
- Automatización para APK y publicación web.

## Hay que terminar o validar

- Login propio del inspector en la app móvil.
- Prueba completa de taller y rutas con base real y roles.
- Envío automático justo al vencer la espera, aunque nadie toque la app.
- Evitar algunos reenvíos innecesarios al precargar.
- Completar sincronización/versionado de catálogos.
- Regla de presión CALIENTE.
- Acordar la fórmula final de porcentaje de desgaste.
- Reporte Excel definitivo y consola administrativa.
- Definir el flujo futuro para abrir R1/R2 después de retirar por reencauche.
- Probar APK en condiciones reales de campo.

## Plan a futuro razonable

1. Blindar lo existente con pruebas de extremo a extremo.
2. Cerrar identidad/login del inspector.
3. Convertir taller/rutas en proceso operativo validado.
4. Centralizar las cuentas que todavía queden repetidas en HTML.
5. Crear reportes e importaciones auditables.
6. Sumar otras configuraciones de vehículo solo después de validar buses.

## Regla para leer tareas viejas

Una tarea que dice “pendiente” puede haber sido ejecutada sin actualizar la tabla. Primero mirar el programa y las migraciones; la tarea sirve para entender la intención y la historia.

Seguir con [[09 - Links para seguir aprendiendo]].
