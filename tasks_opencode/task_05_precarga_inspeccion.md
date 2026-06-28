# Task 05 — Selección de unidad (bug) + Precarga "heredar TODO editable"

## Objetivo
Dos cosas en el mismo flujo (seleccionar unidad → CONTINUAR → inspección):
1. **Arreglar el bug de selección** que hoy impide elegir una unidad cuando el prefijo devuelve 2+
   sugerencias (bloquea todo lo demás).
2. **Precargar la inspección anterior**: al CONTINUAR sobre una unidad con inspección previa, la nueva
   nace **poblada** con los datos de la última (identidad + mediciones), todos **editables**. CREAR
   (unidad nueva) sigue naciendo en blanco.

De paso, eliminar la duplicación de lógica de cálculo en el repo (reusar `calculations.ts`).

## Contexto
- Lee `/CLAUDE.md` y `/specs/reglas_negocio.md`. En conflicto manda `specs/`.
- Decisión de Facundo: precarga = **heredar TODO editable** (identidad + R1–R4 + presión + anomalía).
- Archivos:
  - `app/src/screens/UnidadScreen.tsx` — `selectUnidad` (~88-96), `match` (~63), `handleSearch`,
    `reset`, `handleContinue` (~108-122).
  - `app/src/db/repos/inspeccionRepo.ts` — `upsertNeumatico`, `listNeumaticos`, `crearCabecera`;
    aquí va el nuevo `clonarNeumaticos`. Ya importa `calcularEstadoRtd`.
  - `app/src/db/repos/unidadRepo.ts` — `getUltimaInspeccion(empresaId, numero)` ya devuelve
    `{ cabecera, neumaticos[] }`. Reutilizar.
  - `app/src/core/calculations.ts` — `calcularRtdMovi`, `calcularIdi`, `calcularEstadoRtd` (puras).

## Pasos

### A. Bug de selección (BLOQUEANTE)
Hoy `UnidadScreen.tsx:63`:
```ts
const match = sugerencias.length === 1 && sugerencias[0].numero === q ? sugerencias[0] : null;
```
Si el prefijo devolvió 2+ sugerencias (ej. "7" → 7244 y 7216), al hacer clic en una, `selectUnidad`
hace `setQuery(u.numero)` pero **no** reduce `sugerencias` → `match` queda `null` → no se renderiza la
tarjeta de última inspección ni el botón CONTINUAR ("hago clic y no sale nada").
**Fix:** estado explícito de unidad elegida.
1. `const [seleccionada, setSeleccionada] = useState<Unidad | null>(null);`
2. En `selectUnidad(u)`: `setSeleccionada(u)` (además de `setQuery(u.numero)`).
3. En `handleSearch` y `reset`: `setSeleccionada(null)`.
4. Reemplazar la línea de `match` por: `const match = seleccionada;` (o `seleccionada && seleccionada.numero === q ? seleccionada : null` si se quiere invalidar al re-tipear; mantener simple: limpiar `seleccionada` en `handleSearch` ya cubre el re-tipeo).

### B. Precarga "heredar TODO"
5. En `inspeccionRepo.ts`, agregar
   `async clonarNeumaticos(destinoCabeceraId: string, origenCabeceraId: string): Promise<void>`:
   - `const previos = await this.listNeumaticos(origenCabeceraId);`
   - Por cada uno: `await this.upsertNeumatico({ cabecera_id: destinoCabeceraId, posicion, codigo,
     marca, modelo, modelo_actual, reencauche, medida, r1, r2, r3, r4, presion, tapa_valvula,
     anomalia })` **sin** `existingId` (UUID nuevo). `upsertNeumatico` recalcula rtd/idi/estado/desecho.
   - **No** heredar foto.
6. En `UnidadScreen.tsx:handleContinue`, reordenar:
   1. `const previa = await unidadRepo.getUltimaInspeccion(empresaId, match.numero);` **antes** de crear.
   2. `await unidadRepo.upsert(...)` y `const cab = await inspeccionRepo.crearCabecera(...)` (como hoy).
   3. `if (previa && previa.neumaticos.length) await inspeccionRepo.clonarNeumaticos(cab.id, previa.cabecera.id);`
   4. `setUnidad/setCabecera/navigate` (como hoy).
   > Capturar `previa` **antes** de crear la cabecera: si no, `getUltimaInspeccion` (ordena por
   > `fecha DESC, created_at DESC`) devolvería la cabecera nueva (fecha=hoy) y clonaría de sí misma.

### C. Reuso de cálculos en el repo (absorbe deuda §1.4)
7. En `upsertNeumatico`, reemplazar el cálculo inline de `rtd_movi`/`idi` por las funciones puras:
   usar `calcularRtdMovi`/`calcularIdi` de `core/calculations.ts` respetando 3 ó 4 canales según los
   canales medidos (no sustituir null por 0; mantener la lógica actual de "solo con canales medidos").
   Quitar el `try/catch {}` vacío (que traga errores). Mantener el comportamiento: si faltan canales,
   `rtd_movi/idi/estado_rtd` quedan `null`.

## Criterios de aceptación
- Cruz del Sur → escribir "7" → clic en **7244** (lista tenía 2) → aparece la tarjeta de última
  inspección + ODÓMETRO + CONTINUAR (antes no aparecía nada). Idem ITTSABUS y Móvil Bus.
- CONTINUAR sobre `7244` → FORM y GRILLA muestran datos heredados (R1–R4, presión, marca/modelo/medida,
  reencauche, válvula, anomalía), **editables**.
- Editar un valor heredado → **recargar el navegador** → persiste el editado.
- CREAR unidad nueva `2-4` y `2-4-2` → arranca en blanco, no hereda, no crashea (abrir el mapa).
- `npm run build` / `npm test` (23) / `npm run lint` verdes.
- **Smoke test en navegador OBLIGATORIO** (anotar en STATE: flujo recorrido + resultado).

## Cómo verificar
```bash
cd app && npm run build && npm test && npm run lint && npm run dev
```
Smoke: (1) consola sin errores; (2) Cruz del Sur "7" → clic 7244 → tarjeta visible; (3) CONTINUAR →
datos heredados en FORM y GRILLA; (4) editar + recargar → persiste; (5) crear unidad 2-4 → en blanco,
mapa de 6 ruedas sin crash.

## Fuera de alcance
- Deduplicar cabeceras "huérfanas" que crea cada CONTINUAR (backlog).
- Cambiar fórmulas o umbrales (4/7), conectar presión/VUR/ISA a la UI.
- Datos de empresas vacías (Task 07) y conteo de tarjetas (Task 07).
