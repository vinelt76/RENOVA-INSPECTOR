# Task 07 — Datos de empresa: volcar CIVA/CTA reales + quitar conteo fantasma

## Objetivo
1. Que **las 5 empresas** tengan unidades reales sembradas (hoy CIVA y CTA están vacías → su autocomplete
   siempre vuelve vacío).
2. Quitar el **conteo "N unidades"** de las tarjetas de empresa (es texto hardcodeado y engañoso: Cruz del
   Sur muestra "112 unidades" y solo tiene 4 sembradas).

## Reparto de trabajo (importante)
- **La extracción Excel → JSON YA LA HIZO Opus ✅** (2026-06-27). `seed_unidades_demo.json` ya incluye
  **CIVA (6 buses 2-4-2)** y **CTA (6 buses 2-4)**, curados desde `docs/excels/`, mismo esquema que el
  resto. Además Opus **dedujo un bug de datos preexistente** (neumáticos duplicados por posición en
  cruz/ittsa/movil) y lo **deduplicó** (1 neumático por posición). Verificado en vivo: las 5 empresas con
  autocomplete OK, consola limpia. **opencode NO toca el JSON ni abre los Excels.**
- **opencode** hace SOLO el ajuste de UI (quitar el conteo) y re-verifica que el seed carga bien.

## Contexto (fuentes reales, ya verificadas por Opus)
- CIVA: `docs/excels/REPORTE_INSPECCIÓN_GENERAL_CIVA.xlsx` (hoja REPORTE; sin columna de configuración →
  se infiere por nº de posiciones: 6=2-4, 8=2-4-2).
- CTA: `docs/excels/CTA 12 Y 18 DE JUNIO.xlsx` (hoja REPORTE; trae `TIPO VEHÍCULO`/`CONFIGURACIÓN`
  explícitos, ej. BUS 2-4) y/o `docs/excels/DATA CTA actual (1).xlsx` (hoja BD_INSPECCIÓN).
- El campo `flota` ("N unidades") se siembra en `seed.ts` (EMPRESAS) y se muestra en
  `app/src/screens/EmpresaScreen.tsx`.

## Pasos (opencode)
1. Tomar el `seed_unidades_demo.json` actualizado (provisto por Opus con CIVA/CTA). **No** editar ese JSON
   ni abrir los Excels.
2. En `app/src/screens/EmpresaScreen.tsx`: **no renderizar** la línea de conteo "N unidades" (el campo
   `flota`) en la tarjeta de empresa. Dejar nombre + inicial/acrónimo. No romper el layout.
   - Opcional (si es limpio): que `seed.ts`/EMPRESAS deje `flota = null`; pero como mínimo, no mostrarlo.
3. No tocar la lógica de búsqueda ni el seed de catálogo.

## Criterios de aceptación
- Las **5 empresas** muestran resultados en el autocomplete con un prefijo válido (incluidas CIVA y CTA con
  sus unidades reales). Ej.: elegir CIVA → escribir un prefijo de una unidad sembrada → aparece.
- Las tarjetas de empresa **ya no muestran** "N unidades".
- Si Task 06 está hecho: `npm run verify:db` lista las 5 empresas con sus unidades/inspecciones.
- `npm run build` / `npm test` (23) / `npm run lint` verdes.
- **Smoke test en navegador OBLIGATORIO:** recorrer las 5 empresas, confirmar autocomplete con datos y cero
  errores de consola. Anotar en STATE.

## Cómo verificar
```bash
cd app && npm run build && npm test && npm run lint && npm run dev
```
Smoke: abrir cada empresa, buscar una unidad sembrada, ver sugerencias; confirmar que no aparece el texto
"N unidades" en las tarjetas.

## Fuera de alcance
- Agregar la 6ta empresa **Flores** (`docs/excels/INSPECCION FLORES BD.xlsx`) — queda anotada como decisión
  pendiente de Facundo, no entra acá.
- Cargar la flota completa de cada empresa (esto es una **rebanada de demo**, como las otras).
- Derivar un conteo "real" dinámico (se decidió **quitar** el texto, no recalcularlo).
