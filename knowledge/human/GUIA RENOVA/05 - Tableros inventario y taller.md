---
title: "Tableros, inventario y taller"
updated: 2026-07-12
status: vigente
sources: [WEB, supabase/migrations/20260712*]
---

# Tableros, inventario y taller

## Los tableros

- **Por fecha:** muestra cómo está la flota en un día.
- **Por unidad:** baja al detalle de posiciones de un bus.
- **Rendimiento:** calcula kilómetros, desgaste y costo/rendimiento de instalaciones.
- **Comparativo:** compara ciclos por marca, diseño, condición, eje o ruta.
- **Historial:** cuenta la película completa de un casco.

## El taller

Las pantallas de instalación e inventario permiten registrar movimientos reales:

- instalar un neumático;
- retirarlo con un motivo;
- transferirlo a otra posición;
- reinstalar uno guardado;
- crear el siguiente ciclo al reencauchar.

Estas acciones se hacen como una sola operación en Supabase. Es como una transferencia bancaria: no debe descontar de un lado si no puede acreditar del otro.

## Las rutas

Una unidad puede cambiar de ruta. Por eso la ruta no se pega para siempre a la ficha del bus: se guardan períodos con fecha desde/hasta. Así se puede atribuir el rendimiento al recorrido que realmente hizo durante esa instalación.

## Estado prudente

El código y las migraciones de taller, rutas y comparativo existen desde el 12 de julio. Antes de usarlos como proceso definitivo hay que repetir pruebas completas contra la base real y con los distintos roles.

Seguir con [[06 - Diccionario en criollo]].

