---
title: "El viaje de una inspección"
updated: 2026-07-12
status: vigente
sources: [specs/flujo_inspeccion.md, app/src/screens, app/src/sync]
---

# El viaje de una inspección

## Paso a paso

1. El inspector abre la app y elige la empresa.
2. Busca el número o placa de la unidad.
3. La app trae lo conocido de la inspección anterior para no escribir todo de nuevo.
4. El inspector anota odómetro y recorre las posiciones.
5. En cada rueda carga código, medida, marca, diseño, remanentes, presión, válvula y anomalía.
6. La app hace las cuentas importantes en el mismo teléfono.
7. Primero guarda en su base local.
8. Después pone la inspección en una cola para enviarla.
9. Supabase confirma la recepción y actualiza los tableros.

## Por qué guarda toda la inspección cada vez

La cola usa una ficha por inspección, no una ficha por rueda. Cuando cambia una posición, vuelve a mandar la foto completa de esa inspección. Como usa el mismo identificador, Supabase actualiza y no duplica.

Es parecido a corregir una planilla con el mismo número de documento: mandás la versión nueva, no creás otro documento.

## Al terminar el día

La app fuerza un último intento. Solo limpia del teléfono lo que la nube confirmó. Si algo no subió, queda guardado para otro intento. Esta regla existe porque “no veo una fila pendiente” no alcanza para asegurar que la nube la tenga.

Seguir con [[03 - Telefono SQLite y Supabase]].

