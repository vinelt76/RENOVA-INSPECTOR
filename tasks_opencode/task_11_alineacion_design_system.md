# task_11 — Alinear la app al design system (DESIGN.md)

## Objetivo

Auditar `app/src/` contra **`DESIGN.md`** (raíz del repo — leerlo COMPLETO antes de empezar; es
la fuente de verdad visual) y corregir toda desviación. Incluye los dos pedidos explícitos de
Facundo tras usar la app en campo:

1. **Campo activo visible**: al tocar cualquier input/select/autocomplete, el borde debe pasar
   a `2px solid #F06822` (ember-orange) de forma inequívoca — hoy "no sabes si estás en ese
   coso". Como en Excel: la celda activa se ilumina.
2. **Texto en blanco**: subtítulos y datos precargados legibles bajo sol — todo dato ingresado
   o precargado en `VALUE_COLOR #F0F8FF`, labels en `LABEL_BLUE #7AABCC`, nada de grises
   apagados heredados (`MUTED #7b879c` no se usa en pantallas de campo).

## Contexto / archivos

- `DESIGN.md` — sistema completo (paleta, tipografía, reglas nombradas, componentes, Do/Don't).
- `.impeccable/design.json` — tokens en JSON (misma fuente, formato máquina).
- `app/src/theme.ts` — tokens en código. Los "legados" (`BORDER`, `FIELD_BG`, `MUTED`) son
  para superficies claras que ya casi no existen; verificar dónde se siguen usando.
- Pantallas: `EmpresaScreen.tsx`, `UnidadScreen.tsx`, `InspeccionScreen.tsx`, `FormBody.tsx`,
  `components/AutocompleteField.tsx`. (`GrillaBody` está archivado en `app/_archivo/` — NO tocarlo.)

## Pasos (checklist de auditoría — aplicar en cada pantalla)

1. **Foco**: todo input, select y autocomplete usa borde `2px solid BORDER_DARK` en reposo →
   `2px solid ORANGE` en foco/abierto, con `transition: border-color 0.15s`. Verificar que el
   foco por teclado (auto-avance RTD) también lo dispara, no solo el touch.
2. **Regla del Naranja Único**: nunca dos bordes naranjas simultáneos fuera de foco. Si algo
   destaca sin ser la acción activa → amarillo (`#f4b821`), no naranja.
3. **Regla del Verde Exclusivo**: `GREEN #1f9d6b` solo en el punto de "posición completa".
4. **Colores de texto**: valores del usuario → `VALUE_COLOR`; labels/unidades (mm/psi/km) →
   `LABEL_BLUE`; placeholders y disabled → `BORDER_DARK`. Eliminar cualquier `MUTED`/gris
   heredado en pantallas de campo.
5. **`font-variant-numeric: tabular-nums`** en todo valor numérico (remanente, presión,
   odómetro, código, posición).
6. **Sombras**: `box-shadow` SOLO en overlays flotantes (dropdown autocomplete, sugerencias,
   bottom sheet). Quitar cualquier sombra en cards/botones/inputs del flujo normal.
7. **Disabled sin opacity**: recolorear a `FIELD_DARK`/`BORDER_DARK` explícito.
8. **Transiciones**: 0.15–0.28s, `ease-out`/`cubic-bezier(0.22,1,0.36,1)`, sin rebote.
9. Documentar en `STATE.md` cada desviación encontrada y corregida (lista corta por pantalla).

## Criterios de aceptación

- Tocar cualquier campo de cualquier pantalla ilumina su borde en naranja al instante; al
  perder foco vuelve a `BORDER_DARK`. Un solo campo naranja a la vez.
- Cero texto gris apagado en pantallas de campo; datos precargados se leen igual de fuerte
  que los recién tipeados (`VALUE_COLOR`).
- Grep sin resultados en `app/src/screens/` y `components/` de: `MUTED`, `box-shadow` fuera
  de los 3 overlays permitidos.
- Sin regresiones de layout (headers con safe-area, footers, sheet de posiciones).

## Cómo verificar

Smoke test en navegador OBLIGATORIO (CLAUDE.md): `npm run dev`, recorrer empresa → unidad →
inspección, tocar cada tipo de campo verificando el foco naranja, 0 errores de consola, y
anotar el recorrido en `STATE.md`. `npm run build` + `npm run lint` verdes.

## Fuera de alcance

- Cambios de flujo/estructura (acordeón, selector de posiciones, scroll) → task_13.
- No inventar patrones nuevos: si algo que se necesita no está en DESIGN.md, anotarlo en
  `STATE.md` como pregunta para Opus/Facundo — NO improvisar (regla de CLAUDE.md).
- No tocar lógica de datos, repos ni cálculos.
