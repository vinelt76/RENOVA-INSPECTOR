---
title: "Mapa técnico sencillo"
updated: 2026-07-26
status: vigente
sources: [CLAUDE.md, repository tree, package.json, knowledge/ai/11, repository audit 2026-07-26]
---

# Mapa técnico sencillo

## Carpetas principales

| Carpeta | Qué contiene |
|---|---|
| `app/` | App del inspector: React, TypeScript, Vite, Capacitor y SQLite |
| `app movimientos/` | App del operario: login, órdenes y captura |
| `WEB/` | Siete pantallas web HTML/JavaScript |
| `WEB/shared/` | Buscador, filtros y reglas compartidas de interfaz |
| `supabase/migrations/` | Historia ejecutable de la base, permisos, vistas y RPC |
| `supabase/tests/` | Pruebas SQL de taller y movimientos |
| `specs/` | Reglas de negocio y flujo deseado |
| `decisions/` | Decisiones formales y alternativas descartadas |
| `reference/` | Fórmulas Python y ejemplos golden |
| `knowledge/` | Estas explicaciones y la bitácora |
| `tasks_*/`, `docs/run*`, `FASE_02/` | Historia y planificación; no son automáticamente pendientes actuales |
| `UI/` | Prototipos visuales, no la aplicación activa |

## Tecnologías

- React + TypeScript para las dos apps.
- Vite para desarrollo y build.
- Capacitor para Android.
- SQLite para trabajar sin señal.
- Supabase/PostgreSQL para la verdad central.
- HTML, CSS y módulos JavaScript para los dashboards.
- Vitest para pruebas de JavaScript/TypeScript.
- Pruebas SQL para contratos de la base.

## De dónde sale la verdad

No existe un solo archivo que mande sobre todo:

1. **Regla deseada:** `specs/` y decisiones aprobadas.
2. **Lo que realmente está implementado:** código, migraciones y pruebas.
3. **Explicación y navegación:** `knowledge/ai` y `knowledge/human`.
4. **Historia:** bitácora, tareas antiguas y documentos de auditoría.

Si una spec y el código no coinciden, no elegir en silencio. Puede ser un bug o una decisión de
negocio que no se documentó.

## Archivos que conviene conocer

- `CLAUDE.md`: límites e invariantes permanentes.
- `PRODUCT.md`: producto y usuarios.
- `DESIGN.md`: lenguaje visual.
- `specs/reglas_negocio.md`: fórmulas autoritativas.
- `specs/flujo_inspeccion.md`: recorrido del inspector.
- `knowledge/ai/00 - LEER PRIMERO.md`: entrada técnica.
- `knowledge/ai/10 - Roadmap deuda y riesgos.md`: deuda canónica resumida.
- `knowledge/ai/15 - Bitacora diaria.md`: historia por fecha.
- `scripts/verify-all.mjs`: verificación completa.

## Reglas para no romper RENOVA

- Nunca impedir el guardado local por falta de internet.
- Nunca borrar sin confirmación remota.
- Nunca inventar una tabla, campo, ruta o fórmula.
- Nunca hardcodear empresas, catálogos o umbrales dentro de una pantalla.
- Nunca mezclar orden del supervisor con ejecución del operario.
- Nunca inferir una instalación histórica solo porque existe una inspección.
- Nunca publicar una clave secreta.
- Nunca confiar en una tarea antigua sin mirar código y migraciones actuales.
- Nunca llamar “completo” a un total recortado o a datos insuficientes.

## Para transferir el proyecto a otra IA

1. Compartir el consolidado `RENOVA_CONOCIMIENTO_COMPLETO_2026-07-26.md`.
2. Indicar la fecha y el commit actual.
3. Avisar si hay cambios sin commit.
4. Pedir que lea primero la auditoría y después las copias exactas.
5. Exigir que contraste cualquier cambio con specs, código, pruebas y Supabase.

