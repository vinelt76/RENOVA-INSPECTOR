---
title: "Estado actual y futuro"
updated: 2026-07-26
status: vigente
sources: [git, app/src, app movimientos/src, WEB, supabase/migrations, specs, decisions, knowledge/ai/10, repository and Supabase audit 2026-07-26]
---

# Estado actual y futuro

## Ya existe

- App de inspección para Android y navegador de prueba.
- App separada del operario con login, bandeja de órdenes y borrador local.
- Guardado local sin internet.
- Precarga de datos conocidos.
- Cálculos principales de captura.
- Umbrales RTD cambiables por empresa/medida.
- Rangos de presión en frío por empresa, medida y eje.
- Cola durable con reintentos y protecciones contra pérdida.
- Supabase con RLS por empresa y vistas protegidas para usuarios autenticados.
- Siete pantallas web: inspecciones por fecha/unidad, rendimiento, historial, inventario,
  importación y servicios.
- Buscador global de unidades/neumáticos y filtros facetados.
- Inventario actual de solo lectura: Retén y Descartados.
- Modo Servicios por unidad para que el supervisor emita órdenes.
- App del operario para tomar y completar esas órdenes.
- Servicios ejecutados contados por posición atendida.
- RPCs de taller, línea base, movimientos por lote y rutas temporales.
- Fórmula de desgaste por profundidad útil y agregación ponderada aprobada.
- 411 pruebas, lint, documentación y builds verdes el 26 de julio.

## Hay que terminar o validar

- Identidad del inspector o, como paso intermedio, cuenta de dispositivo por empresa.
- Cerrar la exposición anónima de las tres RPC móviles.
- Reconciliar ejecuciones del operario con casco/ciclo/instalación.
- Resolver cambios físicos detectados por inspección pero no registrados como movimiento.
- Prueba completa de taller y rutas con base real y roles.
- Envío automático justo al vencer la espera, aunque nadie toque la app.
- Evitar algunos reenvíos innecesarios al precargar.
- Completar sincronización/versionado de catálogos.
- Regla de presión CALIENTE.
- Definir costo/km proyectado; la fórmula de porcentaje de desgaste ya está acordada.
- Reporte Excel definitivo y consola administrativa.
- Definir el flujo futuro para abrir R1/R2 después de retirar por reencauche.
- Probar APK en condiciones reales de campo.
- Aislar o retirar de forma auditada datos de prueba.
- Normalizar marcas y mejorar identidad de cascos sin código.
- Paginar Servicios cuando el volumen llegue al límite.
- Definir publicación y entrega: los workflows automáticos de APK/web fueron eliminados del commit
  actual; los builds locales siguen funcionando.

## Plan a futuro razonable

1. Cerrar identidad y exposición anónima.
2. Reconciliar movimientos y completar la línea base.
3. Blindar lo existente con pruebas de extremo a extremo y APK real.
4. Convertir taller/rutas en proceso operativo aceptado.
5. Sanear datos y centralizar las cuentas repetidas que todavía queden.
6. Crear consola, reportes e importaciones auditables.
7. Sumar otras configuraciones de vehículo solo después de validar buses.

## Regla para leer tareas viejas

Una tarea que dice “pendiente” puede haber sido ejecutada sin actualizar la tabla. Primero mirar el programa y las migraciones; la tarea sirve para entender la intención y la historia.

Seguir con [[09 - Links para seguir aprendiendo]].
