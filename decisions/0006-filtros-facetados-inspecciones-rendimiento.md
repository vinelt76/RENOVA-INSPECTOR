# ADR-0006: Filtros facetados en Inspecciones y Rendimiento

## Contexto

El buscador global de ADR-0005 encuentra objetos y navega. Las pantallas operativas necesitaban
otra capacidad: reducir el conjunto visible por atributos y, en Rendimiento, recalcular el agregado
sobre ese subconjunto sin ocultar exclusiones.

## Decisión

1. **Buscar y filtrar siguen siendo responsabilidades distintas.** El buscador global enruta a una
   Unidad o Neumático; `WEB/shared/filter-bar.js` reduce las filas de la pantalla actual. Comparten
   normalización y vocabulario, no overlay, destino ni estado.
2. **Rendimiento agrega un conjunto filtrado.** Inicia con toda la flota, permite combinar unidad,
   marca, modelo, medida, condición, diseño y eje, y abre el detalle jerárquico desde una fila. El
   selector dedicado de unidad desaparece porque una unidad es otra faceta del mismo conjunto.
3. **Inspecciones lista el último estado de neumáticos, no unidades ni historia mezclada.** Sin
   fecha/unidad muestra la última fecha global; una unidad muestra su última inspección. Elegir una
   fecha explícita abre el histórico. Unidad y posición son atributos de cada fila y el resumen usa
   exactamente el mismo corte temporal visible.
4. **OR dentro de una faceta y AND entre facetas.** Dos marcas amplían el conjunto; marca + eje lo
   intersectan. Todo filtro aplicado queda como chip visible y removible.
5. **Filtrado en cliente.** Los volúmenes medidos son pequeños: 38 filas en Rendimiento y entre 520
   y 903 en Inspecciones por empresa. Se revisará esta decisión si un payload sostenido supera unos
   pocos MiB o el universo crece un orden de magnitud.
6. **Las exclusiones se explican.** Datos insuficientes y datos antiguos son conteos distintos. La
   ventana temporal tendría un tercer conteo —cascos sin dos mediciones—, pero no se entregó por
   cobertura insuficiente.
7. **Frescura no es ventana temporal.** Frescura descarta filas cuya última inspección supera 30
   días (o no tiene fecha) sin alterar la fórmula. Consumo por rango requeriría dos mediciones del
   mismo ciclo dentro del rango; nunca se aproxima usando mediciones externas.

## Alternativas descartadas

- Filtrar en servidor: añade latencia por pulsación y estado remoto sin beneficio a esta escala.
- Mantener componentes separados por pantalla: contradice la necesidad de una interacción común y
  volvería a duplicar semántica y accesibilidad.
- Conservar el selector de unidad: crea dos sistemas de filtrado para el mismo atributo.
- Aproximar mayo–junio con instalación y última inspección: respondería una pregunta temporal con
  datos de otro período.

## Limitaciones

La vista remota ya exponía `last_inspection_on`, aunque esa extensión no está representada por una
migración local propia. El consumo por ventana quedó sin implementar: al 2026-07-19, 2.183 de 2.247
mediciones no tenían `life_cycle_id`; hubo 0 cascos calculables en 30/60 días y 4 de 24 en 90 días.
El recorrido autenticado de campo y el aislamiento visual entre dos empresas siguen pendientes.

## Revisión si...

- los datasets dejan de ser triviales para memoria de cliente;
- la cadencia y el enlace a ciclos permiten dos mediciones por casco en rangos habituales;
- el umbral de frescura pasa de constante nombrada a configuración por empresa.
- el índice liviano de inspecciones alcanza 1.000 filas y necesita paginación o una vista resumida.
