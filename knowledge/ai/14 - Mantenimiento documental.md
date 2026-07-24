---
title: "Mantenimiento documental"
updated: 2026-07-23
status: vigente
sources: [scripts/sync-project-docs.mjs, scripts/knowledge-day.mjs, package.json]
---

# Mantenimiento documental

## Modelo

`knowledge/ai` y `knowledge/human` son las fuentes versionadas. Los vaults son destinos navegables. No editar una copia sincronizada esperando que vuelva al repo: el siguiente sync puede reemplazar archivos administrados.

Antes de decidir, buscar desde [[00 - LEER PRIMERO]] por tema y seguir `sources` hasta la spec,
ADR, migración, código o diseño primario. Preferir actualizar una nota canónica y enlazarla; no
crear otra explicación del mismo concepto.

La documentación tiene dos ejes complementarios:

- Las notas temáticas explican **cómo funciona RENOVA hoy**.
- [[15 - Bitacora diaria]] explica **qué se cambió cada día, por qué y dónde encontrarlo en Git**.

La bitácora no reemplaza una spec, ADR o nota vigente. Sirve para reconstruir contexto y localizar
regresiones sin convertir las notas temáticas en una lista cronológica interminable.

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

## Bitácora diaria

Al comenzar o cerrar una jornada:

```bash
npm run docs:day
```

Para registrar otro día:

```bash
npm run docs:day -- --date 2026-07-23
```

El comando crea `knowledge/ai/bitacora/YYYY/YYYY-MM-DD.md`, actualiza
[[15 - Bitacora diaria]] y refresca los commits encontrados por Git para esa fecha. No sobrescribe
el resumen ni las decisiones escritas manualmente.

Para reconstruir fechas anteriores desde el historial completo:

```bash
npm run docs:backfill
```

El backfill no reemplaza entradas existentes. Genera una reconstrucción por cada día con commits:
hash, mensaje, autor, archivos, estadísticas, áreas afectadas y enlaces a GitHub. Un mensaje pobre
no se completa con una explicación inventada: queda marcado y se orienta a revisar el diff y las
fuentes contextuales. `--since YYYY-MM-DD` y `--until YYYY-MM-DD` limitan el rango; `--force` existe
para regenerar notas automáticas, pero no debe usarse sobre días editados manualmente.

Cada cambio diario debe responder:

1. Qué cambió.
2. Por qué se hizo.
3. Qué archivos o migraciones tocó.
4. Cómo se validó.
5. Qué riesgo o rollback tiene.
6. En qué commit o PR quedó.

Si todavía no existe commit, escribir **pendiente**. Después de publicar, volver a ejecutar
`npm run docs:day` y completar el hash exacto en el cambio correspondiente.

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
