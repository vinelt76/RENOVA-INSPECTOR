---
title: "Tableros y taller"
updated: 2026-07-26
status: vigente
sources: [WEB, WEB/movimientos, WEB/inventario, WEB/buscador, WEB/shared, WEB/servicios, app movimientos, supabase/migrations, decisions/0005, decisions/0006, decisions/0008, decisions/0011, repository audit 2026-07-26]
---

# Tableros y taller

## Las siete pantallas web

- **Inspecciones por fecha:** muestra el último estado o una fecha histórica elegida.
- **Inspecciones por unidad:** baja al detalle de las posiciones de un bus y permite emitir órdenes.
- **Rendimiento:** calcula kilómetros, desgaste y proyección de la vida actual.
- **Historial:** cuenta la película completa de un casco.
- **Inventario:** separa Retén de Descartados.
- **Importar:** carga inspecciones mediante el mismo guardado central.
- **Servicios:** muestra el trabajo que ya ejecutaron los operarios.

Todas exigen sesión. La empresa se obtiene del perfil del usuario; no debería elegirse libremente
desde el navegador.

## Buscador y filtros

Las siete pantallas comparten un buscador global, que también abre con `Ctrl/Cmd+K`. Busca solo dos
cosas navegables:

- una unidad;
- un neumático/casco.

No ejecuta acciones. Los filtros dentro de una pantalla son distintos: reducen lo que se ve sin
navegar. Se pueden combinar por fecha, unidad, marca, medida, condición, eje y otras facetas. Cada
filtro queda visible como una etiqueta y también en la URL.

## El taller: ordenar no es ejecutar

Dentro de **Inspecciones por unidad** hay dos modos:

- **Inspección:** consulta lo medido.
- **Servicios:** el supervisor arma y emite una orden por posición.

La pantalla separada de Instalación se retiró por redundante. El flujo actual es:

1. El supervisor ve el dibujo de la unidad.
2. Elige la posición y el servicio.
3. Para una rotación elige la otra posición.
4. Para otros servicios elige debajo un neumático disponible del Retén.
5. RENOVA emite una orden.
6. El operario la toma en su app y confirma qué sale y qué entra.
7. La página **Servicios** permite consultar lo ejecutado.

La misma llanta de inventario no puede usarse en dos posiciones del mismo borrador.

## Cómo se cuentan los servicios

Un servicio es una **posición atendida**: el neumático que sale y el que entra.

- Rotar P3 con P4 cuenta como dos servicios, uno por posición.
- Desechar y reemplazar en P3 cuenta como un servicio.
- Montar sobre una posición vacía cuenta como instalación.
- Presión, torque y alineación sin desmontar no aparecen en esta pantalla.

La entrada puede mostrar de qué posición vino si salió en la misma orden. Si viene de Retén,
reparación o es nueva, el origen queda como no determinado. No se inventa.

## Inventario actual y lo retirado

**Inventario sí existe hoy.** Es una pantalla de consulta:

- **Retén:** ciclos activos disponibles para montar.
- **Descartados:** bajas definitivas que no pueden volver a montarse.

Permite abrir el Historial por código. Elegir un neumático del Retén para trabajar se hace desde el
modo Servicios de una unidad.

Lo que sigue retirado es:

- la pantalla Comparativo;
- las operaciones antiguas de reinstalar o reencauchar directamente desde Inventario;
- la pantalla separada de Instalación.

## Rendimiento sin números engañosos

Rendimiento usa la profundidad útil del ciclo. Un neumático en el umbral de retiro marca 100 % de
desgaste. Los grupos se calculan con los kilómetros y milímetros totales, no promediando cada fila
por igual.

Por defecto aparta inspecciones de más de 30 días y permite incluirlas con un filtro visible. Esto
es frescura del dato, no consumo ocurrido en treinta días. La comparación temporal real sigue
pendiente porque faltan series enlazadas suficientes.

## Rutas

Una unidad puede cambiar de ruta. La ruta se guarda como un período con fecha desde/hasta, no como
un texto pegado para siempre al bus. Así el rendimiento puede atribuirse al recorrido de cada
instalación. Las tablas y RPC existen, pero las rutas remotas estaban vacías durante la auditoría y
el proceso todavía requiere validación operativa.

## Estado prudente

Hay pruebas reales anteriores de movimientos y servicios, además de 411 pruebas automáticas verdes.
Eso no reemplaza:

- repetir el APK en campo;
- probar cámara y pérdida de señal;
- verificar todos los roles y dos empresas;
- reconciliar los movimientos ejecutados con la historia canónica.

Seguir con [[06 - Diccionario en criollo]].
