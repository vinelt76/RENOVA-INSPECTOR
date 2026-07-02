# task_12 — FIX bloqueante: crash al buscar otra unidad (o la recién inspeccionada)

> **PRIORIDAD 1 del Lote 5. Este task va PRIMERO** — es un bug funcional reportado por Facundo
> usando la app en campo: *"se sigue rompiendo al buscar otra unidad o la que acabas de
> inspeccionar"*. Nada del rediseño (task_11) ni de la precarga (task_13) se empieza hasta que
> este flujo esté verde.

## Objetivo

Que el ciclo completo **buscar unidad → inspeccionar → volver → buscar otra unidad (o la misma)
→ inspeccionar de nuevo** funcione N veces seguidas sin crash, sin pantalla rota y sin errores
de consola.

## Contexto / archivos

- `app/src/screens/UnidadScreen.tsx` — búsqueda con autocomplete, auto-selección en match
  exacto (`handleSearch`), carga de `ultimaInsp`, y `handleContinue` que crea cabecera nueva y
  clona neumáticos de la inspección anterior (`clonarNeumaticos`).
- `app/src/db/repos/unidadRepo.ts` — `search()`, `getUltimaInspeccion()`.
- `app/src/db/repos/inspeccionRepo.ts` — `crearCabecera`, `clonarNeumaticos`, `upsertNeumatico`.
- `app/src/screens/InspeccionScreen.tsx` — botón Volver (`aria-label="Volver"`) regresa a `/unidad`.
- **Script de repro ya escrito**: `app/.repro.tmp.mjs` (Playwright, ya instalado en
  `app/node_modules`). Reproduce exactamente el ciclo del bug: busca `7244`, inspecciona,
  vuelve, busca `7244` de nuevo (caso A), busca `7216` (caso B), continúa inspección (caso C),
  y repite el ciclo. Ajustar `BASE` al puerto real del dev server antes de correrlo, y correrlo
  con `cd app && node .repro.tmp.mjs` (resuelve `playwright` desde `app/node_modules`).

## Pasos

1. Correr el repro contra `npm run dev` y capturar el error real (consola + pageerror +
   screenshots que el script deja en su carpeta scratch — ajustar la ruta `SCRATCH` a un
   directorio local, p.ej. `app/.repro-out/`).
2. Diagnosticar. Hipótesis a verificar (no asumir — confirmar con el error real):
   - Estado stale en `UnidadScreen` al volver de inspección (la unidad/última inspección
     anterior queda en estado y choca con la nueva búsqueda).
   - `getUltimaInspeccion` ahora devuelve la cabecera **recién creada** (posiblemente sin
     odómetro o incompleta) y algún campo `null` revienta el render o el clonado.
   - Doble `crearCabecera` para la misma unidad/fecha (¿constraint UNIQUE?) al re-entrar.
   - Auto-selección por match exacto disparándose durante el re-render con resultados viejos.
3. Arreglar la causa raíz (no parchear el síntoma con un try/catch que esconda el error).
4. Si el fix toca el clonado: garantizar que re-inspeccionar la misma unidad el mismo día NO
   duplique cabeceras ni neumáticos — definir y documentar en el código el comportamiento
   (reusar la cabecera del día o reemplazarla, lo que sea consistente con el modelo).

## Criterios de aceptación

- El script de repro corre completo (casos A, B, C y ciclo 2) **sin excepciones y con 0
  errores de consola**.
- Buscar la unidad recién inspeccionada muestra su última inspección correctamente (con los
  datos que se acaban de guardar, no rota ni vacía).
- Repetir el ciclo 3+ veces manualmente en el navegador no degrada nada (sin cabeceras
  duplicadas: verificar con una query a `inspeccion_cabecera` por unidad/fecha).

## Cómo verificar

1. `cd app && npm run dev` + `node .repro.tmp.mjs` (con `BASE` correcto) → todo verde.
2. Smoke test manual en navegador (OBLIGATORIO por CLAUDE.md): recorrer el ciclo completo 2
   veces con unidades distintas, recargar la página al final y confirmar que las inspecciones
   persisten. Anotar en `STATE.md` qué se recorrió y el resultado.
3. `npm run build`, `npm test`, `npm run lint` en verde.

## Fuera de alcance

- Cambios visuales (task_11), acordeón/precarga UX (task_13), Supabase (task_14).
- No tocar `calculations.ts` ni el seed.
