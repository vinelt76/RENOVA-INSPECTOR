# Guion de demo — lunes 2026-07-27

Decisión tomada el 2026-07-25: **el flujo de movimientos se demuestra con MÓVIL BUS.**

## Por qué MÓVIL BUS y no otra

Es la **única empresa con cuenta `operator`**. Verificado en producción: 4 perfiles
`fleet_manager` (uno por empresa) y un solo `operator`, en MÓVIL BUS.

Si se demuestra CIVA, CRUZ DEL SUR o ITTSABUS, el supervisor **puede emitir** la orden —se ve en
la web— y **nadie puede tomarla**: `claim_tire_movement_order` exige rol `operator` de la misma
empresa. El recorrido se corta a la mitad, en vivo, sin mensaje que explique por qué.

Es además la única empresa con órdenes y ejecuciones reales (4 órdenes, 8 ejecuciones).

## Qué se puede mostrar con cada empresa

| Pantalla | MÓVIL BUS | CIVA / CRUZ DEL SUR / ITTSABUS |
|---|---|---|
| Inspecciones por unidad | ✅ | ✅ |
| Rendimiento | ✅ | ✅ |
| Inventario | ✅ | ✅ (con poco dato) |
| Servicios | ✅ | ✅ (vacío) |
| **Movimientos: emitir orden** | ✅ | ✅ |
| **Movimientos: tomar y ejecutar (app operario)** | ✅ | ❌ **no hay operario** |

## Antes de empezar

- **Recarga dura (Ctrl+Shift+R)** en cada pestaña. El navegador cachea los módulos JS aparte del
  HTML: durante la verificación del 2026-07-25 la ficha siguió mostrando el rango de presión viejo
  hasta forzar la recarga.
- **No cambiar umbrales RTD** durante la demo. El estado del dashboard se recalcula con el umbral
  vigente, así que tocarlos reescribe la lectura de las inspecciones pasadas en vivo.
- Elegir de antemano la unidad que se va a abrir. No buscar ejemplos al azar.
- Confirmar que la recarga de base limpia ya ocurrió: si no, el KPI de Rendimiento muestra
  **138K km/mm** por los neumáticos de prueba de `QA-CN16` (el valor real de la flota es
  ~10 700 km/mm).

## Qué no afirmar

- **Que los datos exigen autenticación.** Hoy son legibles sin sesión — ver ADR-0010. Los
  dashboards sí piden login; la API no.
- **Que el IDI está disponible.** Se calcula en el dispositivo y nunca llega a Supabase.
- **Que el dashboard conserva el estado histórico con el umbral de su fecha.** Se recalcula con el
  umbral vigente.
- **Que la regla de presión CALIENTE existe.** Es deuda declarada; solo está implementado FRÍO.

## Superficie

`Inspecciones por unidad` es **desktop-only** (`min-width: 1280px`). Se demuestra desde laptop, no
desde teléfono. No confundir con la app Android de inspección, que es otra superficie y sí es
móvil.

## Referencia

El checklist operativo detallado (P0/P1/P2), la tabla de riesgos de presentación y el guion paso a
paso están en `REPORTE_IA_DEMO_LUNES_2026-07-25.md` §14, §16 y §17. Están bien como están; este
documento solo fija la decisión de empresa y agrega lo medido después.
