---
title: "Deuda, riesgos y decisiones pendientes"
updated: 2026-07-26
status: vigente
sources: [knowledge/ai/10, deuda_tecnica, decisions, repository and Supabase audit 2026-07-26]
---

# Deuda, riesgos y decisiones pendientes

Deuda no significa necesariamente que algo esté roto. Significa que existe una limitación conocida,
un trabajo deliberadamente postergado o una decisión que todavía necesita datos.

## Primero: seguridad e historia confiable

### Identidad del inspector

La app de inspección trabaja sin login. Hay que introducir una cuenta de dispositivo o identidad de
inspector y después cerrar las tres RPC anónimas.

### Reconciliación de movimientos

La orden y la ejecución del operario existen, pero todavía no se enlazan automáticamente con casco,
ciclo e instalación. En el snapshot remoto había 8 ejecuciones y las 8 seguían pendientes.

### Cambios físicos detectados por inspección

Una inspección puede mostrar otro código, marca o RTD sin un movimiento registrado. El sistema lo
señala, pero no debe inventar una instalación. Hace falta decidir el flujo humano de corrección.

### Línea base

Muchas posiciones históricas no tienen una instalación canónica. Deben confirmarse de manera
gradual, frente a la unidad, sin inventar fechas a partir de inspecciones.

### Datos de prueba y suciedad

Hay unidades y cascos de QA en la base, además de marcas escritas con distintas mayúsculas. Deben
aislarse, normalizarse o eliminarse con respaldo y aprobación. Nunca borrarlos de oficio.

## Operación de campo

- Probar APK en un teléfono real.
- Probar SQLite nativo, cámara, Storage, pérdida y retorno de señal.
- Repetir flujos con cuentas reales de supervisor y operario.
- Probar visualmente dos empresas para confirmar aislamiento.
- Definir qué evidencia convierte taller y rutas en “listos para operar”.

## Sincronización y catálogos

- La cola no se despierta sola justo al terminar el backoff.
- Una precarga puede volver a mandar datos que solo estaba copiando.
- Falta completar pull, versionado y borrado seguro de catálogos.
- Existe una tabla de presión local que no participa del flujo remoto actual.
- Algunos datos heredados no tienen todos sus snapshots.

## Rendimiento

Ya está acordado:

- desgaste sobre profundidad útil;
- 100 % al llegar al umbral;
- km/mm como razón de sumas;
- ponderación uniforme para una unidad o una flota;
- exclusión explicada de RTD creciente.

Sigue abierto:

- costo/km proyectado;
- presión en caliente;
- frescura configurable por empresa;
- consumo real por ventanas y tendencias, hasta tener más mediciones enlazadas;
- saneamiento y medición antes de crear índices por intuición.

## Taller e inventario

- Crear el ciclo R1/R2 después de un retiro por reencauche.
- Dar identidad útil a cascos sin código.
- Guardar en el esquema la relación exacta entre una solicitud y su ejecución.
- Guardar de forma estructurada cuando una salida deja la posición vacía.
- Determinar el origen externo de un neumático mediante reconciliación.
- Publicar ejecuciones en Realtime o aceptar conscientemente el polling.
- Paginar Servicios antes de que 2.000 filas sean insuficientes.

## Producto y mantenimiento

- Consola administrativa de empresas, usuarios, umbrales y catálogos.
- Reporte Excel central y auditable.
- Importaciones por lote con errores claros por fila.
- Navegación web compartida en vez de repetida en siete HTML.
- Más configuraciones de vehículo después de validar buses.
- Evaluar React para dashboards solo como fase futura con decisión y rollback; no es requisito para
  mejorar la interfaz actual.
- Definir nuevamente cómo se publican web y APK, porque los workflows automáticos fueron retirados.

## Cómo decidir qué hacer primero

1. Riesgo de exposición o mezcla de empresas.
2. Riesgo de perder o falsear historia.
3. Bloqueo del trabajo real en campo.
4. Datos que pueden producir decisiones equivocadas.
5. Mantenibilidad y mejoras futuras.

Seguir con [[13 - Como se prueba y despliega RENOVA]].
