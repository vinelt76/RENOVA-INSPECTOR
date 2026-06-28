# Runbook — Re-curar el seed desde los Excel (cuando Facundo entregue los Excel limpios)

Procedimiento que Opus ya ejecutó una vez (2026-06-27) y debe **repetir igual** con los Excel
actualizados/limpiados por Facundo. NO cambia los tasks 05–08 ni el resto del Lote 2; solo regenera
`app/src/db/seed_data/seed_unidades_demo.json`. Es **data-prep de Opus** (no opencode).

## Disparador
Facundo deja los Excel limpios en `docs/excels/` y avisa. Recién ahí Opus abre los Excel.

## ⚠️ Punto a confirmar ANTES de curar (causó el dato malo en la 1ª pasada)
- **Cuál columna es el "número de unidad" canónico.** En la 1ª pasada, para CTA se usó el número entre
  paréntesis de la placa ("AAV-803 (03)" → "3"), porque el buscador filtra a solo dígitos. Eso produjo
  números cortos cuestionables (3, 20…). Facundo observó que "una unidad 'siete' no puede existir".
  **Definir con Facundo qué identificador es el real** (placa completa, nº de flota, o código), y si el
  buscador debe aceptar letras. Si el Excel limpio ya trae el número correcto por unidad, usar ese tal cual.

## Procedimiento (idéntico al ya hecho)
1. **Leer** cada Excel con openpyxl (`docs/excels/`). Identificar la hoja de inspección y los encabezados.
2. **Mapear columnas** a los campos del neumático del JSON: `posicion, codigo, medida, marca,
   diseno_original, diseno_actual, condicion, rtd_a..d, presion, temperatura, tapa_valvula, anomalia_aro,
   anomalia_neumatico` + `umbral_cambio=4, umbral_proximo=7, umbral_normal=8`. Faltantes → `"Normal"`/`null`.
   - CTA trae `TIPO VEHÍCULO`/`CONFIGURACIÓN` explícitos; CIVA infiere config por nº de posiciones
     (6 → `2-4`, 8 → `2-4-2`).
3. **Filtrar SOLO buses MVP**: configuraciones `2-4` y `2-4-2`. Descartar el resto.
4. **Rebanada de demo**: ~6 unidades por empresa (consistente con las demás). Una inspección por unidad
   (la más reciente). Ajustable si Facundo quiere la flota completa.
5. **Deduplicar**: exactamente 1 neumático por posición (la 1ª pasada encontró 2/posición en
   cruz/ittsa/movil). Validar: 6 neumáticos para `2-4`, 8 para `2-4-2`; sin posiciones repetidas.
6. **Normalizar fechas** a `YYYY-MM-DD`. Números/RTD a enteros donde aplique.
7. **Merge** al `seed_unidades_demo.json` (estructura `{ _meta, unidades[], inspecciones[] }`), actualizar
   `_meta.fuentes`.
8. **Validar** (script): conteo de unidades por empresa; neumáticos por inspección correctos; 0 inválidos.
9. **Smoke test en vivo** (Chrome headless sobre `npm run dev`): las 5 empresas con autocomplete real,
   consola **0 errores/warnings**, `npm run build` verde. (Igual que la 1ª pasada: CIVA "4"→…, CTA …,
   Cruz "7"→7216/7244.)
10. Actualizar `STATE.md` (bitácora) y la memoria.

## Lo que NO cambia
- Los task specs **05** (selección+precarga), **06** (verify:db + refactor seed), **07** (quitar conteo
  fantasma, UI) y **08** (limpieza) siguen válidos tal cual. Solo cambian los datos del seed.
- Decisiones cerradas: precarga = heredar TODO · umbrales = solo documentar · conteo "N unidades" = quitar.

## Estado del seed AHORA (provisional, será reemplazado)
La 1ª pasada ya dejó CIVA (6×2-4-2) y CTA (6×2-4) con números provisionales (incluido el caso del
paréntesis a revisar) + dedup de las preexistentes. Sirve como placeholder funcional hasta que lleguen los
Excel limpios; entonces se regenera con este runbook.
