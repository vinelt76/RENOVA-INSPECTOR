---
title: "Diseño y UX"
updated: 2026-07-12
status: vigente
sources: [DESIGN.md, PRODUCT.md, design-principle.md, app/src/index.css, app/src/theme.ts, UI]
---

# Diseño y UX

## Norte creativo

**El cuaderno de bitácora del taller:** herramienta industrial de campo, no dashboard SaaS genérico. Debe funcionar bajo sol, con manos ocupadas y conectividad irregular.

## Lenguaje visual

- Fondo `#07111C`; superficies `#111E2E`; borde `#1B2D42`.
- Naranja `#F06822`: una sola acción/foco dominante por pantalla.
- Amarillo `#f4b821`: hito o valor destacado, no alarma.
- Verde `#1f9d6b`: exclusivamente posición completa.
- JetBrains Mono para datos/prosa; Bebas Neue solo para marca.
- Bordes gruesos, sin sombras/gradientes ni iconografía decorativa.
- Valores escritos por el usuario en alto contraste; etiquetas en azul frío.

## Flujo móvil

- Empresa -> unidad -> inspección.
- El formulario se organiza por posición; identidad precargada y editable.
- Mapa de posiciones comunica pendiente/parcial/completa.
- Autoavance y teclado deben reducir toques, nunca ocultar errores.
- Los objetivos táctiles deben tolerar trabajo de campo.

## Reglas para cambios

1. Revisar `DESIGN.md` y el prototipo relevante en `UI/`.
2. Preservar semántica de colores; no introducir un segundo foco naranja.
3. Probar resolución móvil y escritorio si la superficie web lo requiere.
4. Recorrer el flujo real, no una captura aislada.
5. Verificar teclado, scroll, campos precargados, persistencia y retorno a otra unidad.

## Anti-patrones

- “Excel metido en una app”.
- Cards genéricas con gradiente y sombras.
- Texto pequeño o controles densos.
- Arrays de catálogo dentro de componentes.
- Semáforos recalculados con constantes locales distintas de Supabase.

## Alineación 2026-07-12

Las superficies web vigentes fueron alineadas contra `DESIGN.md` y las pantallas de
Inspecciones/Rendimiento: naranja como máxima severidad (sin rojo), botones primarios naranja
con texto navy y hovers limitados a los tokens de paleta. `instalacion.html` e
`historial-neumatico.html` comparten `WEB/renova-office-shell.css` para tokens, fondo, header,
marca y navegación. `inventario.html` y `comparativo.html` fueron retirados el mismo día y no
son superficies vigentes.
