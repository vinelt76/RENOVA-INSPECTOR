# task_10 — Odómetro: el importador convierte «sin dato» en 0

**Hallazgo:** H-11 · **Prioridad:** Alta · **Tipo:** defecto de una línea + datos
**Bloquea la demo:** el 10 000 000 km sí (se ve en pantalla); el resto depende de la base limpia

## Corrección al reporte inicial

Afirmé que «la app de inspección no valida nada». **Era incorrecto, y el recuerdo del usuario era
el correcto.** `app/src/screens/UnidadScreen.tsx:79-81`:

```ts
const kmPrev = match ? (ultimaInsp?.odometro ?? 0) : 0;
const kmBajo = match && odometro.length > 0 && kmActual < kmPrev;
const canContinue = !!match && odometro.length > 0 && !kmBajo;
```

La app **sí impide** ingresar un odómetro menor al de la última inspección. Lo que no hace es:

- **impedir el 0**, porque cuando no hay inspección previa `kmPrev = 0` y `0 < 0` es falso;
- **poner un techo**: 10 000 000 pasa sin resistencia;
- **comparar contra `unidad.odometro_ultimo`**, solo contra la última inspección local.

## La causa real de los 140 ceros

`WEB/importar.html:585`:

```js
odometer_km: g.km ?? 0,
```

**El importador de Excel convierte silenciosamente un kilometraje ausente en 0.** No avisa, no
rechaza la fila, no lo marca. Y `inspections.odometer_km` es `NOT NULL`, así que el esquema no
tiene forma de distinguir «no se midió» de «midió cero».

Eso explica la distribución sin necesidad de culpar a la app:

| empresa | inspecciones | odómetro 0 | máximo |
|---|---|---|---|
| MÓVIL BUS | 109 | 86 (79 %) | 10 000 000 |
| CIVA | 114 | 47 (41 %) | 3 185 857 |
| ITTSABUS | 65 | 7 (11 %) | 2 921 296 |
| **total** | **288** | **140 (48.6 %)** | |

El odómetro es el denominador de `km_run`, `km_per_mm`, `km_projected`, `cost_per_km` y
`consumption_pct`.

Contraste útil: la app de **movimientos** sí valida bien —entero ≥ 0, no menor al último conocido
(`app movimientos/src/lib/model.ts:130-134`), repetido server-side en
`complete_tire_movement_order`—. Es el patrón a copiar.

## Contexto del dueño de negocio (2026-07-25)

La unidad `5028` con 10 000 000 km fue **una prueba deliberada de caso límite**, igual que
`QA-CN16`. Se va a recargar la base limpia. Eso resuelve los datos existentes, pero **no** el
defecto que los permitió entrar: si el importador vuelve a recibir un Excel sin columna de
kilometraje, vuelve a escribir ceros.

## Trabajo

1. **Arreglar `WEB/importar.html:585`.** Un kilometraje ausente no puede convertirse en 0. Las
   opciones, en orden de preferencia: rechazar la fila con error visible (el importador ya muestra
   estado por fila), o permitir `NULL` en el esquema y enviarlo.
2. **Decidir si `odometer_km` debe aceptar `NULL`.** Hoy es `NOT NULL`, y esa restricción es la que
   fuerza el `?? 0`. Un `NULL` dice la verdad; un `0` miente. La app ya tiene el precedente con la
   presión (`not_measured`).
3. **Poner un techo de plausibilidad** en la captura y en `save_inspection`. No hace falta ser
   sofisticado: un bus no pasa de ~3 millones de km, y cualquier cosa por encima merece que alguien
   confirme antes de guardar.
4. **Comparar contra `unidad.odometro_ultimo`**, no solo contra la última inspección local. Hoy un
   dispositivo sin historial local acepta cualquier valor.
5. **Confirmar la franja alta con el cliente.** Las 60 inspecciones entre 1.5M y 3.2M km **no se
   tocan** hasta saberlo: un bus interprovincial peruano de muchos años puede acercarse a esas
   cifras. No convertir una sospecha en un borrado.

## Criterio de cierre

- Un Excel sin columna de kilometraje falla con error por fila, o guarda `NULL` — nunca 0.
- Una inspección nueva con un odómetro imposible no se guarda.
- El encabezado de Inspecciones por unidad no muestra 10 000 000 km.
- Rendimiento declara cuántos neumáticos excluyó por odómetro no confiable, igual que hoy declara
  los excluidos por datos insuficientes.
- `sync-migration-reviewer` sobre cualquier cambio de `save_inspection` o del esquema.
