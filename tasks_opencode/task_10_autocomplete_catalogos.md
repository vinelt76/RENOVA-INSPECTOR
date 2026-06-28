# task_10 — Autocomplete en campos de catálogo

## Objetivo

Reemplazar los `<select>` de catálogo en `FormBody` y `GrillaBody` por un componente de
autocomplete: el inspector escribe y la lista se filtra en tiempo real; toca un ítem para
seleccionarlo. Los campos numéricos (código, R1–R4, presión) y los selects cortos (condición,
diseño reencauche, medida) NO se tocan — quedan como están.

## Contexto

La app tiene hasta 109 modelos, 69 anomalías, 28 marcas y 21 válvulas. Un `<select>` nativo con
100 opciones es difícil de usar en móvil. La solución es un autocomplete inline que filtra mientras
se escribe.

Campos que cambian a autocomplete:
- **Marca** (28 opciones)
- **Modelo** (hasta 109, ya filtrado por marca)
- **Válvula** (21 opciones)
- **Anomalía** (69 opciones)

Campos que **NO cambian** (quedan como select o input):
- Código, R1, R2, R3, R4, Presión → inputs numéricos/texto, sin tocar
- Condición (6 opciones) → select, sin tocar
- Diseño de reencauche (7 opciones) → select, sin tocar
- Medida (10 opciones) → select, sin tocar

## Archivos a tocar

- `app/src/screens/FormBody.tsx` — reemplazar selects de marca, modelo, válvula, anomalía
- `app/src/screens/GrillaBody.tsx` — mismos campos en el sheet de detalle

NO tocar: `InspeccionScreen.tsx`, `schema.ts`, `sqlite.ts`, `seed.ts`, repos, `calculations.ts`.

## Componente a crear

Crear `app/src/components/AutocompleteField.tsx`:

```tsx
interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];          // lista plana de opciones (nombres)
  placeholder?: string;
  disabled?: boolean;
}
```

Comportamiento:
1. Muestra un input de texto con el valor actual
2. Al enfocar o escribir, muestra una lista filtrada debajo (máx 6 ítems visibles, scroll interno)
3. La lista filtra por `toLowerCase().includes(query.toLowerCase())`
4. Tocar un ítem → cierra la lista, pone el valor
5. Si el input queda en blanco al perder foco → limpia el valor (`onChange('')`)
6. Si hay un valor seleccionado y el usuario empieza a escribir → busca de nuevo (no bloquea)
7. La lista aparece con `position: absolute`, `zIndex: 100`, ancho del input, fondo blanco,
   borde `BORDER`, `borderRadius: 10`, `boxShadow` sutil — para que flote sobre el resto del form
8. NO usar librerías externas — solo React + inline styles (patrón del proyecto)

## Pasos

### 1. Crear `AutocompleteField.tsx`
Componente según el spec de arriba. Usar los tokens de `../theme` (NAVY, BORDER, MUTED, INK,
FIELD_BG, MONO, ORANGE). El ítem seleccionado se resalta con fondo `NAVY` y texto blanco.

### 2. Actualizar `FormBody.tsx`
Dentro del sheet "Datos del neumático" (`showSheet`):

- **MARCA**: reemplazar `<select value={data.marca} onChange={setMarca}>` por:
  ```tsx
  <AutocompleteField
    label="MARCA DE NEUMÁTICO"
    value={data.marca}
    onChange={marca => { setModeloManual(false); commit({ ...data, marca, modelo: '' }); }}
    options={marcas.map(m => m.nombre)}
    placeholder="Buscar marca…"
  />
  ```

- **MODELO**: reemplazar el bloque de select/input manual por:
  ```tsx
  <AutocompleteField
    label="MODELO DE NEUMÁTICO"
    value={data.modelo}
    onChange={modelo => commit({ ...data, modelo })}
    options={modelos.map(m => m.nombre)}
    placeholder={data.marca ? 'Buscar modelo…' : 'Primero elige una marca'}
    disabled={!data.marca}
  />
  ```
  Eliminar el estado `modeloManual` / `setModeloManual` y los props correspondientes —
  el autocomplete ya permite escribir libremente, así que el botón "¿No está el modelo?" desaparece.

En el form principal (fuera del sheet):

- **VÁLVULA**: reemplazar `<select value={data.tapaValvula}>` por AutocompleteField.
  `options={valvulas.map(v => v.nombre)}`. Mantener el color de alerta ORANGE cuando
  el valor no sea '' ni 'OK'.

- **ANOMALÍA**: reemplazar `<select value={data.anomalia}>` por AutocompleteField.
  `options={anomalias.map(a => a.nombre)}`. "Ninguna" → valor vacío `''`.
  Mantener el badge "⚠ ACTIVA" y el fondo naranja cuando hay anomalía.

Eliminar props `modeloManual`/`setModeloManual` de la interfaz Props de FormBody.

### 3. Actualizar `GrillaBody.tsx`
Mismas sustituciones en el sheet de detalle (`detalle != null`):
- MARCA → AutocompleteField (al cambiar, limpiar modelo)
- MODELO → AutocompleteField (disabled si no hay marca)
- VÁLVULA → AutocompleteField
- ANOMALÍA → AutocompleteField

Eliminar `modeloManual`/`setModeloManual` locales y el botón "Agregar modelo nuevo".

### 4. Actualizar `InspeccionScreen.tsx`
Eliminar los props `modeloManual`/`setModeloManual` de las llamadas a `<FormBody>` y `<GrillaBody>`,
y el estado `modeloManual` del orquestador.

## Criterios de aceptación

- [ ] Escribir "mich" en el campo Marca → aparece "MICHELIN" en la lista filtrada; tocarlo lo selecciona
- [ ] Con MICHELIN seleccionada, escribir "xm2" en Modelo → aparece el modelo filtrado; seleccionarlo cierra la lista
- [ ] Escribir en Anomalía "corte" → aparece la lista de anomalías que contienen "corte"
- [ ] Seleccionar una anomalía → el badge "⚠ ACTIVA" aparece
- [ ] Campo Válvula autocompleta igual
- [ ] En modo Grilla, el sheet de detalle muestra los mismos autocompletes con el mismo comportamiento
- [ ] Condición, Diseño de reencauche y Medida siguen siendo `<select>` (no cambian)
- [ ] R1, R2, R3, R4, Presión, Código no se tocan
- [ ] `npm run build` verde, `npm test` (23) verde, `npm run lint` sin errores nuevos

## Smoke test obligatorio

1. `npm run dev` → empresa Móvil Bus → unidad 88888 (o cualquiera) → inspección
2. Abrir sheet "Datos del neumático":
   - Escribir en Marca → lista filtra en tiempo real, sin errores de consola
   - Seleccionar una marca → Modelo se habilita y filtra por esa marca
   - Seleccionar un modelo → cierra la lista
3. En el form principal:
   - Escribir en Anomalía → filtra; seleccionar → badge "⚠ ACTIVA" aparece
   - Escribir en Válvula → filtra; seleccionar "Pitón averiado" → color naranja
4. Cambiar a modo Grilla → abrir detalle de una posición → mismos autocompletes funcionan
5. Cero errores en la consola del navegador
6. Anotar en `STATE.md` qué se recorrió y el resultado

## Fuera de alcance

- NO cambiar el orden de los campos
- NO cambiar condición, reencauche, medida (quedan como select)
- NO modificar la lógica de RTD/presión/cálculos
- NO usar Tailwind, librerías de UI externas ni componentes de terceros
- NO tocar el data layer (repos, sqlite, seed)
