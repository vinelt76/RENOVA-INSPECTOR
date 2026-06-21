# ADR-0001: Estrategia de Multi-Tenancia — Row-Level con empresa_id

## Decisión

Usar **un schema PostgreSQL único** con columna `empresa_id` en todas las tablas de negocio,
enforceado en la API mediante el JWT. No usar schema-per-company.

## Contexto

El plan original proponía `schema empresa_{id}` (un schema PostgreSQL separado por cliente).
Con 5 clientes actuales, esa opción tiene costos reales:

- **Migraciones:** cada cambio de schema debe correr N veces (una por empresa). Con Alembic
  en Railway, esto es complejidad operativa injustificada para 5 tenants.
- **Analytics cruzado:** consultas cross-empresa (e.g., "benchmark de presión entre todas
  las flotas") requieren UNION o conexiones múltiples en lugar de un WHERE.
- **Connection pooling:** Railway gestiona el pool de conexiones; schemas por empresa
  complican el routing sin beneficio real a esta escala.
- **Aislamiento:** el aislamiento real que necesitas no es a nivel de schema PostgreSQL
  sino a nivel de aplicación — el JWT garantiza que ningún inspector ve datos de otra empresa.

## Consecuencias

- Todas las tablas de negocio llevan `empresa_id UUID NOT NULL`.
- El backend valida siempre que `empresa_id` del JWT coincida con el de la fila.
- El catálogo PATRON (`configuracion_vehiculo`, `anomalia_neumatico`, etc.) es compartido
  (sin `empresa_id`).
- Las tablas de umbrales (`umbral_rtd`, `umbral_presion`) tienen `empresa_id` para
  permitir configuración por empresa.
- Si en el futuro un cliente requiere aislamiento físico, migrar a una DB separada en
  Railway es trivial (nueva instancia + dump/restore). Más barato que gestionar schemas.

## Revisión si...

Reconsiderar schema-per-company solo si algún cliente requiere cumplimiento normativo que
exija separación física de datos (GDPR, contratos enterprise con auditoría de aislamiento).
A la fecha de este ADR, ningún cliente lo requiere.
