# Run 1 — Datos faltantes y preguntas abiertas

Lo que el esquema NO puede cerrar solo. Ordenado por impacto: lo primero bloquea el rendimiento
real; lo último es pulido.

## Bloqueantes para que Rendimiento deje de ser mock

1. **OTD (profundidad original) — ¿de dónde sale?**
   Todas las fórmulas de consumo/proyección dependen de OTD y hoy solo existe en el mock.
   ¿RENOVA tiene tabla OTD por medida+marca+modelo? ¿El OTD de un reencauchado lo define el
   diseño de reencauche? Borrador: `tires.otd_mm` por casco + `catalog_sizes.default_otd` como
   fallback. **Falta la fuente real del dato.**

2. **RTD Retiro recomendado** (`rtd_removal_mm`) — Km Proyectado lo necesita. ¿Es igual a
   `rtd_cambio` (4 mm) o es otro valor por empresa/medida/eje? El mock usa 4.0–6.0 según
   posición. ¿Quién lo define y dónde vive hoy?

3. **Costo del neumático** — Costo/Km lo necesita. ¿Existe registro de compras/costos por casco
   y por reencauche? ¿Moneda (los mocks usan $, la operación es Perú — PEN/USD)? ¿El costo del
   ciclo actual es solo el reencauche o acumula el casco?

4. **Eventos de instalación/retiro** — no hay pantalla ni proceso digital hoy. Sin
   `rtd_at_install`/`odometer_at_install` no hay RTD Gastado ni Km Recorrido reales.
   ¿Quién registra el montaje (taller)? ¿Se puede reconstruir el histórico desde los Excels de
   `docs/`? Para la demo del jueves se puede sembrar la instalación manualmente.

5. **Identidad del neumático entre inspecciones** — hoy se une por `codigo` texto (frágil:
   "No visible", "Sin código", tipeos). ¿El código de fuego es confiable y único por empresa?
   ¿Hay plan de etiquetado/QR? Afecta tasa de desgaste, VUR y todo el historial por casco.

## Decisiones de negocio ya conocidas como abiertas (confirmar dueño y fecha)

6. **Presión de referencia en CALIENTE** — sigue ABIERTA (CLAUDE.md). El esquema deja
   `pressure_thresholds.hot_psi` NULL. NO inventar valor.

7. **Umbral de balance de eje** — el 15% de `rendimiento.html` está marcado "pendiente de
   definir con RENOVA". ¿15% es el valor de arranque para todas las empresas?

8. **Umbrales RTD/presión por empresa y medida** — la tabla existe pero, ¿cuáles son los valores
   REALES por empresa? Hoy la app usa 4/7 global (deuda). Necesitamos la matriz
   empresa × medida → umbrales para sembrar `rtd_thresholds`/`pressure_thresholds`.

9. **Máximo de reencauches** — el panel de taller muestra "2 / MÁX 3". ¿El máximo es política
   por empresa, por medida, o fijo? ¿Va en `companies`, en thresholds, o en catálogo?

## Alcance de captura (app) — confirmar para Run 2/3

10. **Temperatura FRÍO/CALIENTE y checkbox "Sin medir"** — en spec pero no en FormBody. ¿Se
    agregan a la captura antes de conectar Supabase, o la fase 1 sincroniza sin ellos
    (temperatura NULL = FRÍO implícito)?

11. **Anomalía de Aro** — la spec la separa de la anomalía de neumático; la app captura solo una
    `anomalia`. ¿Una medición puede tener VARIAS anomalías (el panel de taller pinta lista)?
    Hoy local es 1:1 → si es N:1 hará falta tabla `measurement_anomalies`.

12. **ESTADO PRESIÓN persistido** — la app no lo calcula al guardar (existe la función). ¿Se
    persiste desde el cliente en fase 1 (necesita umbrales sincronizados) o lo deriva una vista
    server-side transitoria?

13. **Inspector** — sin auth todavía. ¿La demo del jueves necesita inspector real logueado o
    basta `inspector_id` NULL?

## Datos maestros / importación

14. **Excels golden (`docs/` del repo original)** — no están en este clon. ¿Qué contienen
    exactamente (histórico de inspecciones, inventario, unidades)? Define el formato de
    `import_batches.source` y los parsers de Run 3+.

15. **Flotas reales** — `empresa.flota` está NULL en la semilla. ¿Las 5 empresas dividen su
    flota en operaciones/rutas, o la tabla `fleets` queda dormida por ahora?

16. **Placas/números de unidad** — ¿la placa es estable como identificador visible
    (`UNIQUE(company_id, plate)`) o una unidad puede cambiar de placa (habría que separar
    número interno vs placa)?

## Técnica de sync (no bloquea el draft, sí la migración)

17. **Resolución placa→uuid en el push** — la cabecera local referencia
    `numero_unidad+empresa_id`; el server usa `unit_id`. ¿El drainer resuelve/crea la unidad en
    el mismo push (upsert por `(company_id, plate)`)? Propuesto: sí.
18. **Fotos** — dataURL base64 en SQLite hoy. ¿Push directo a Storage con URL en la fila, o
    primera fase con base64 en una columna y migración posterior? Propuesto: Storage desde el
    inicio para no inflar Postgres.
19. **Zona horaria** — `fecha` local es date del dispositivo (`localDate()`), Perú UTC−5.
    Confirmar que "una inspección por día" se evalúa en hora local de la operación.
