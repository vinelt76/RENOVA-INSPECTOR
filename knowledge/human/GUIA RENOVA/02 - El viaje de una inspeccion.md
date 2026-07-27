---
title: "El viaje de una inspección"
updated: 2026-07-26
status: vigente
sources: [specs/flujo_inspeccion.md, app/src/screens, app/src/db, app/src/sync, decisions/0009]
---

# El viaje de una inspección

## Paso a paso

1. El inspector abre la app y elige la empresa.
2. Busca el número o placa de la unidad.
3. La app trae lo conocido de la inspección anterior para no escribir todo de nuevo.
4. El inspector anota odómetro y recorre las posiciones.
5. En cada rueda carga código, medida, marca, diseño, remanentes, presión, válvula y anomalía.
6. La app guarda los datos y las cuentas de captura en el mismo teléfono.
7. Primero guarda en su base local.
8. Después pone la inspección en una cola para enviarla.
9. Supabase confirma la recepción y actualiza los tableros.

La app puede consultar previamente la unidad y los umbrales desde Supabase. Si esa consulta falla,
la captura local no debe bloquearse.

## Por qué guarda toda la inspección cada vez

La cola usa una ficha por inspección, no una ficha por rueda. Cuando cambia una posición, vuelve a mandar la foto completa de esa inspección. Como usa el mismo identificador, Supabase actualiza y no duplica.

Es parecido a corregir una planilla con el mismo número de documento: se envía la versión nueva, no
se crea otro documento.

## Al terminar el día

La app fuerza un último intento. Solo limpia del teléfono lo que la nube confirmó. Si algo no subió, queda guardado para otro intento. Esta regla existe porque “no veo una fila pendiente” no alcanza para asegurar que la nube la tenga.

## Límites actuales del viaje

- Cada error aumenta la espera hasta un máximo de cinco minutos, pero la cola no tiene un reloj que
  se despierte solo al vencer esa espera. Vuelve a intentar cuando ocurre otro disparador, como
  abrir, guardar, recuperar conexión o terminar el día.
- Precargar datos conocidos puede volver a encolar una copia y producir un envío redundante.
- La app envía como usuario anónimo porque todavía no tiene identidad de inspector.
- La presión en frío se clasifica en Supabase con el rango de la medida y el eje. La medición
  caliente queda sin veredicto.

Seguir con [[03 - Telefono SQLite y Supabase]].
