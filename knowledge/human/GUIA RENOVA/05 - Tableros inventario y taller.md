---
title: "Tableros y taller"
updated: 2026-07-15
status: vigente
sources: [WEB, WEB/movimientos, WEB/inventario, supabase/migrations/20260712*, supabase/migrations/20260714*, tasks_cambios_neumaticos_ui/REVISION_FINAL.md, tasks_pantalla_inventario/STATE.md]
---

# Tableros y taller

## Los tableros

- **Por fecha:** muestra cómo está la flota en un día.
- **Por unidad:** baja al detalle de posiciones de un bus.
- **Rendimiento:** calcula kilómetros, desgaste y costo/rendimiento de instalaciones.
- **Historial:** cuenta la película completa de un casco.
- **Inventario:** separa lo disponible en Retén de las bajas definitivas en Descartados.
- **Importar:** carga inspecciones mediante el mismo guardado central.

## El taller

La pantalla de Instalación permite registrar tres movimientos reales:

- instalar un neumático;
- retirarlo con un motivo;
- trasladarlo a otra unidad o posición.

Estas acciones se hacen como una sola operación en Supabase. Es como una transferencia bancaria: no debe descontar de un lado si no puede acreditar del otro.

Un retiro puede indicar que el neumático va a reencauche, pero la creación del siguiente ciclo R1/R2 no forma parte del RPC actual.

## Movimientos de neumáticos (varios movimientos de golpe)

Dentro del tablero **Por unidad** hay dos modos: **Inspección** y **Movimientos**. En Movimientos,
el taller ve el mismo dibujo del bus pero puede armar una lista de movimientos —mandar
un neumático a retén, descartarlo (con foto obligatoria), montar uno del inventario en una
posición vacía o intercambiar dos— y recién al final confirmar todo junto.

Ese "todo junto" es una sola operación: o entran los cuatro movimientos o no entra ninguno, como
la transferencia bancaria. Si mientras armabas la lista alguien cambió la unidad por otro lado, el
sistema avisa "el estado de la unidad cambió" y no aplica nada a medias. Si se corta internet, el
borrador queda guardado y podés reintentar sin duplicar nada.

El 14 de julio se probó de punta a punta con un bus de prueba real (`QA-CN16`) haciendo los
cuatro tipos de movimiento a la vez: funcionó, la foto de descarte se guardó y el estado quedó
bien tras recargar la página.

## Inventario actual y lo que sigue retirado

La pantalla actual de **Inventario** es de consulta: Retén muestra neumáticos disponibles para
montaje y Descartados organiza las bajas definitivas. Se actualiza a partir de los movimientos
confirmados y permite abrir el Historial por código.

La pantalla **Comparativo** y las operaciones antiguas exclusivas de reinstalar/reencauchar desde
Inventario siguen retiradas. Montar un neumático del Retén se hace desde Movimientos.

## Las rutas

Una unidad puede cambiar de ruta. Por eso la ruta no se pega para siempre a la ficha del bus: se guardan períodos con fecha desde/hasta. Así se puede atribuir el rendimiento al recorrido que realmente hizo durante esa instalación.

## Estado prudente

El código de taller y rutas existe desde el 12 de julio. El modo Cambios de neumáticos ya pasó su
prueba real de punta a punta el 14 de julio; para instalación/retiro/traslado y rutas todavía
conviene repetir pruebas con los distintos roles antes de darlo por proceso definitivo.

Seguir con [[06 - Diccionario en criollo]].
