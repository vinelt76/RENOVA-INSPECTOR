# task_02 — Revocar el DML concedido sobre 19 vistas

**Hallazgo:** H-06 · **Prioridad:** Media · **Tipo:** mecánico, bajo riesgo
**Bloquea la demo:** no

## Problema

19 vistas de `public` tienen `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` concedidos a
`anon` **y** `authenticated`, cuando solo necesitan `SELECT`. Patrón inequívoco de un
`GRANT ALL ON ALL TABLES IN SCHEMA public` histórico.

Lista exacta en `../evidencia/D-supabase-lecturas.md` §D6.

**Hoy es inerte**: ninguna vista de `public` es auto-actualizable (§D5), así que ningún `INSERT`
prospera. El riesgo es el día que alguien simplifique una de estas vistas y el permiso ya esté
puesto.

## Trabajo

Una migración idempotente que, para cada una de las 19 vistas:

```sql
revoke all on public.<vista> from public, anon, authenticated;
grant select on public.<vista> to authenticated;
```

Decidir explícitamente por vista si `anon` conserva `SELECT`. Hoy lo tiene y **no filtra nada**
(RLS lo devuelve vacío, §D4), pero mantenerlo solo porque «no molesta» es lo que produjo este
hallazgo. El patrón correcto ya existe en el repo: `v_search_index`, `v_tire_services` y
`v_unit_position_state` conceden únicamente `SELECT` a `authenticated`.

## Criterio de cierre

- `sync-migration-reviewer` ejecutado sobre la migración **antes** de aplicarla (lo pide
  `CLAUDE.md` y es exactamente el caso que cubre).
- Repetir la consulta §D6: las 19 vistas quedan con `SELECT` y nada más.
- Los 4 dashboards de `WEB/` cargan autenticados con consola limpia y datos visibles. Un `REVOKE`
  de más deja una pantalla en blanco.
