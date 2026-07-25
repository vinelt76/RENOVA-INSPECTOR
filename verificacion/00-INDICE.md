# Índice — Verificación end-to-end 2026-07-24/25

| Task | Capa | Estado | Hallazgos |
|---|---|---|---|
| T01 (`evidencia/T01-*`) | Fixture golden Py↔TS | OK — 48/48 paridad | Import roto reparado (trivial) |
| [T02](T02.md) | Auditoría fórmulas vs spec | OK con hallazgos | 1 medio, 2 informativo/bajo |
| [T03](T03.md) | Cobertura de casos límite | OK — 9/9 cubiertos | — |
| [T04](T04.md) | test/lint/build de `app/` | OK — 47/47 tests | — |
| [T05](T05.md) | Snapshots de umbral, local→Supabase | Hallazgos | 2 altos, 1 medio |
| [T06](T06.md) | Cola durable de sync | OK con hallazgo | 1 medio (test faltante) |
| [T07](T07.md) | Contrato RPC app↔Supabase | OK con hallazgo | 1 medio |
| [T08](T08.md) | Paridad regla local vs SQL | Hallazgos | 2 altos |
| [T09](T09.md) | Vistas de `WEB/` | OK con hallazgo | 1 medio-alto (grants) |
| [T10](T10.md) | Coherencia de datos en producción | OK con discrepancia | 1 informativo (requiere aclaración humana) |
| [T11](T11.md) | Smoke test navegador | OK, con límite declarado | Sin hallazgos nuevos; datos post-login no verificables sin credenciales |
| [T12](REPORTE.md) | Reporte final + docs:check | OK | Ver `REPORTE.md` |

Ver `REPORTE.md` para el consolidado por severidad. Evidencia cruda en `evidencia/`.

Nota: T01 no tiene archivo propio — su resultado (paridad 48/48, ver
`evidencia/T01-compare-golden.txt`) está resumido en la fila de arriba y detallado en T02/T03.
