# Product

## Register

product

## Users

Inspectores de campo en empresas de buses interprovinciales (~5 empresas clientes en Perú:
Cruz del Sur, ITTSA, Movil Bus, CIVA, CTA). Registran datos de neumáticos por unidad y
posición directamente en el patio/taller: sol directo, manos posiblemente sucias o con
guantes, conectividad intermitente (por eso offline-first). El trabajo es repetitivo y de
alto volumen (varias unidades por turno, hasta 8 posiciones por bus) — la velocidad y el
mínimo de toques por campo importan tanto como la precisión del dato.

## Product Purpose

Reemplazar un proceso 100% manual en hoja de cálculo para inspección de neumáticos de
flota. El inspector registra RTD (remanente), presión y anomalías por vehículo/posición;
el sistema calcula el estado de salud (RTD, presión, DESECHO) aplicando las mismas
fórmulas y umbrales que el Excel original (paridad obligatoria, ver
`reference/calculations.py` / `app/src/core/calculations.ts`). Éxito = un inspector puede
completar una unidad completa más rápido que en Excel, sin perder precisión, y sin
conexión a internet.

## Brand Personality

Robusto e industrial: confiable, técnico, sin adornos — como una herramienta de taller o
de flota, no una app de consumo. Ya expresado en el sistema visual existente: navy
(`#15233f`) + naranja (`#F06822`) + tipografía monoespaciada (JetBrains Mono) para los
datos, con una pantalla oscura dedicada (`SCREEN_DARK #07111C`) para el flujo de
inspección activa — pensada para minimizar distracción y maximizar legibilidad en campo.

## Anti-references

Evitar el look de apps de flotas/logística existentes en Perú: interfaces anticuadas tipo
"Excel metido en una app" o paneles ERP legacy densos y sin jerarquía. También evitar el
cliché de dashboard B2B genérico (tarjetas con gradiente, iconografía de startup
intercambiable, "panel de admin" sin personalidad) — esta herramienta debe sentirse hecha
a medida para el dominio (neumáticos, ejes, posiciones), no una plantilla SaaS reutilizada.

## Design Principles

- **Cero fricción en campo**: cada toque de menos importa (ver auto-avance RTD, autocomplete,
  auto-selección de unidad al match exacto). Optimizar para velocidad de entrada, no para
  estética de formulario tradicional.
- **El dato manda, no la decoración**: los campos de medición (código, remanente, presión)
  flotan sin card wrapper — son el contenido principal de la pantalla, no un elemento más
  dentro de una tarjeta.
- **Paridad antes que preferencia visual**: los cálculos y umbrales vienen de
  `specs/reglas_negocio.md`; el diseño nunca debe sugerir un dato o estado que el motor de
  cálculo no produce.
- **Offline-first es un requisito de diseño, no solo técnico**: nada de spinners que
  asuman red, nada de estados que dependan de conectividad para ser legibles.
- **Catálogo vive en la base, no en el componente**: anomalías, válvulas, marcas,
  configuraciones se leen de SQLite — la UI nunca hardcodea listas de dominio.

## Accessibility & Inclusion

Requisito duro confirmado: **legibilidad bajo sol directo** — alto contraste en toda
pantalla de campo (ya aplicado: labels a 7.5:1, texto de valores en `VALUE_COLOR
#F0F8FF` sobre fondo oscuro). No hay un nivel WCAG formal exigido más allá de ese
contraste; no se pidió soporte explícito para daltonismo ni requisitos de targets táctiles
especiales, pero al introducir nuevos estados de color (RTD, DESECHO, presión) es buena
práctica no depender solo del color cuando sea barato hacerlo.
