# ADR-0004: Sincronización del catálogo PATRON

## Decisión

El catálogo se sincroniza usando una tabla `catalog_version` que almacena
un número entero de versión y timestamp. El cliente compara su versión local
con la del servidor y descarga el catálogo completo solo si hay cambios.

## Protocolo

```
Al hacer login (y cada 24h en background):
  1. GET /catalogo/version
     → { version: int, updated_at: datetime }
  2. Comparar con versión almacenada en Drift (tabla CatalogVersion)
  3. Si versión_servidor > versión_local:
       GET /catalogo/completo
       → { anomalias: [...], tapas_valvula: [...], configuraciones: [...], ... }
       Reemplazar tablas de catálogo en Drift
       Actualizar CatalogVersion local
  4. Si sin conexión: usar catálogo local (siempre funciona offline)
```

## Schema

```sql
-- Servidor
catalog_version (
  id SERIAL PRIMARY KEY,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
)
-- Una sola fila. Se incrementa `version` cuando se modifica cualquier tabla de catálogo.
```

```dart
// Drift (cliente)
class CatalogVersionTable extends Table {
  IntColumn get version => integer()();
  DateTimeColumn get updatedAt => dateTime()();
}
```

## Cuándo incrementa la versión del servidor

- Cuando se agrega/modifica/desactiva cualquier anomalía, tapa, diseño o configuración.
- Se hace manualmente vía script o admin panel (cuando exista en Fase 2).
- En Fase 1, el catálogo es relativamente estático (se carga desde el Excel inicial).

## Por qué no webhooks o push

Para 5 clientes con cambios infrecuentes al catálogo, polling en login + 24h background
es más que suficiente y no requiere WebSockets ni push notifications.
Si el catálogo crece y cambia frecuentemente, revisar en Fase 2.
