---
title: "Mantenimiento documental"
updated: 2026-07-13
status: vigente
sources: [scripts/sync-project-docs.mjs, package.json]
---

# Mantenimiento documental

## Modelo

`knowledge/ai` y `knowledge/human` son las fuentes versionadas. Los vaults son destinos navegables. No editar una copia sincronizada esperando que vuelva al repo: el siguiente sync puede reemplazar archivos administrados.

Antes de decidir, buscar desde [[00 - LEER PRIMERO]] por tema y seguir `sources` hasta la spec,
ADR, migración, código o diseño primario. Preferir actualizar una nota canónica y enlazarla; no
crear otra explicación del mismo concepto.

## Registrar y enlazar

- Cambio de negocio aprobado: actualizar la spec primaria y su resumen en [[06 - Reglas de negocio]].
- Decisión estructural: crear/actualizar el ADR en `decisions/` y resumirla en [[12 - Decisiones e historia]].
- Patrón visual sistémico: actualizar `DESIGN.md` y [[09 - Diseno y UX]]; una pantalla aislada no justifica una regla global.
- Estado de implementación: actualizar la nota del subsistema y [[02 - Estado actual]] o [[10 - Roadmap deuda y riesgos]] solo si cambia el estado real.

Usar enlaces wiki entre notas de knowledge y rutas literales para fuentes del repo. No duplicar
fórmulas, esquemas ni listas extensas: resumir la invariante y enlazar la autoridad.

Si la implementación contradice documentación, aplicar la jerarquía de [[00 - LEER PRIMERO]] y
no ocultar el conflicto. Si dos documentos vigentes se contradicen al mismo nivel, pedir decisión
humana; cuando se resuelva, actualizar la fuente ganadora y marcar la otra como `historico` o
`reemplazado`, con enlace a la decisión.

## Después de cada cambio

| Cambio | Notas mínimas |
|---|---|
| Feature/estado | `02`, `10` |
| App/sync | `04`, `11` |
| Esquema/RLS/RPC | `05`, `08` |
| Dashboard/taller | `07` |
| Fórmula | `06` y la spec primaria |
| UI/tokens/flujo | `09` |
| Decisión estructural | ADR + `12` |
| Concepto para Facundo | nota equivalente en `knowledge/human` |

Actualizar `updated`, `status` y `sources`. Marcar historia como `historico`; no borrarla para ocultar contradicciones.

## Publicación

```bash
npm run docs:check
npm run docs:sync -- --dry-run
npm run docs:sync
```

Variables opcionales: `RENOVA_AI_VAULT` y `RENOVA_HUMAN_VAULT`. El manifest de cada destino lista solo archivos administrados. El script copia Markdown y no toca `.obsidian/` ni elimina notas manuales.

## Revisión trimestral o antes de una entrega

- Comparar estado con Git, tests y migraciones finales.
- Buscar `PENDIENTE`, `TODO`, `ABIERTA` y hardcodes.
- Revisar que links oficiales sigan vigentes.
- Confirmar que no haya secretos.
- Pedir a una IA nueva que explique producto, flujo, datos y siguiente prioridad leyendo solo [[00 - LEER PRIMERO]].
