---
title: "Tableros y taller"
updated: 2026-07-12
status: vigente
sources: [WEB, supabase/migrations/20260712*]
---

# Tableros y taller

## Los tableros

- **Por fecha:** muestra cómo está la flota en un día.
- **Por unidad:** baja al detalle de posiciones de un bus.
- **Rendimiento:** calcula kilómetros, desgaste y costo/rendimiento de instalaciones.
- **Historial:** cuenta la película completa de un casco.
- **Importar:** carga inspecciones mediante el mismo guardado central.

## El taller

La pantalla de Instalación permite registrar tres movimientos reales:

- instalar un neumático;
- retirarlo con un motivo;
- trasladarlo a otra unidad o posición.

Estas acciones se hacen como una sola operación en Supabase. Es como una transferencia bancaria: no debe descontar de un lado si no puede acreditar del otro.

Un retiro puede indicar que el neumático va a reencauche, pero la creación del siguiente ciclo R1/R2 no forma parte del RPC actual.

## Lo que se retiró

Las pantallas separadas de **Inventario** y **Comparativo** se eliminaron el 12 de julio por una decisión de producto. También se quitaron las operaciones exclusivas de reinstalar/reencauchar desde Inventario y la vista de comparación. No fue una pérdida accidental de archivos.

El estado físico de un casco sigue existiendo en la base y alimenta su Historial; simplemente ya no tiene una pantalla propia de Inventario.

## Las rutas

Una unidad puede cambiar de ruta. Por eso la ruta no se pega para siempre a la ficha del bus: se guardan períodos con fecha desde/hasta. Así se puede atribuir el rendimiento al recorrido que realmente hizo durante esa instalación.

## Estado prudente

El código de taller y rutas existe desde el 12 de julio. Antes de usarlo como proceso definitivo hay que repetir pruebas completas contra la base real y con los distintos roles.

Seguir con [[06 - Diccionario en criollo]].
