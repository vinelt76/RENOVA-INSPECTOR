---
title: "Tableros y taller"
updated: 2026-07-22
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

La pantalla separada de Instalación se retiró por redundante. El supervisor prepara el trabajo
desde el modo **Servicios** del tablero Por unidad. Una rotación conserva su flujo entre dos
posiciones. Para cualquier otro servicio, se elige debajo una llanta disponible del inventario;
la orden guarda juntas la salida actual y la entrada seleccionada en la misma posición.

Un retiro puede indicar que el neumático va a reencauche, pero la creación del siguiente ciclo R1/R2 no forma parte del RPC actual.

## Servicios de neumáticos

Dentro del tablero **Por unidad** hay dos modos: **Inspección** y **Servicios**. En Servicios,
el supervisor ve el mismo dibujo del bus y arma una orden para el operario.

- **Rotación:** se elige la otra posición y el sistema arma las dos salidas y las dos entradas.
- **Los demás servicios:** se muestra Inventario/Retén debajo del dropdown y un clic elige la
  llanta que entrará en reemplazo.
- La misma llanta de inventario no puede elegirse para dos posiciones del borrador.

Al emitir, el operario recibe la orden con el ciclo y el código elegidos; la captura técnica de la
ejecución sigue correspondiendo al operario.

El 14 de julio se probó de punta a punta con un bus de prueba real (`QA-CN16`) haciendo los
cuatro tipos de movimiento a la vez: funcionó, la foto de descarte se guardó y el estado quedó
bien tras recargar la página.

## Inventario actual y lo que sigue retirado

La pantalla actual de **Inventario** es de consulta: Retén muestra neumáticos disponibles para
montaje y Descartados organiza las bajas definitivas. Se actualiza a partir de los movimientos
confirmados y permite abrir el Historial por código.

La pantalla **Comparativo** y las operaciones antiguas exclusivas de reinstalar/reencauchar desde
Inventario siguen retiradas. Elegir un neumático del Retén se hace desde Servicios.

## Las rutas

Una unidad puede cambiar de ruta. Por eso la ruta no se pega para siempre a la ficha del bus: se guardan períodos con fecha desde/hasta. Así se puede atribuir el rendimiento al recorrido que realmente hizo durante esa instalación.

## Estado prudente

El código de taller y rutas existe desde el 12 de julio. El modo Cambios de neumáticos ya pasó su
prueba real de punta a punta el 14 de julio; para instalación/retiro/traslado y rutas todavía
conviene repetir pruebas con los distintos roles antes de darlo por proceso definitivo.

Seguir con [[06 - Diccionario en criollo]].
