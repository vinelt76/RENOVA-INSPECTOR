# task_04 — Datos, modelo puro y Vitest

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Crear el scope modular `WEB/inventario/`, cargar las dos fuentes y producir un modelo puro,
normalizado, filtrable y disjunto. Toda prueba funciona sin DOM, red ni sesión real.

## 3. Dependencias y bloqueos

Depende de `task_01`. `task_02`/`task_03` son N/A. Bloquea `task_05`.

## 4. Archivos exclusivos

- `WEB/inventario/package.json`
- `WEB/inventario/package-lock.json`
- `WEB/inventario/vitest.config.js`
- `WEB/inventario/data.js`
- `WEB/inventario/inventory-model.js`
- `WEB/inventario/__tests__/data.test.js`
- `WEB/inventario/__tests__/inventory-model.test.js`

Solo lectura: `WEB/movimientos/{data.js,inventory-ui.js,README.md}`, `WEB/supabase-demo.js` y
`CONTRATOS_DATOS.md`. Prohibido editar HTML, controlador, CSS, Movimientos o Supabase.

## 5. Contratos

Implementar loaders inyectables para `v_tire_inventory_available` y `v_inventory_status`, con
filtro remoto de descartados cuando el helper lo soporte. Adaptar únicamente columnas de
`CONTRATOS_DATOS.md`. Los números PostgreSQL llegan como string o number y se normalizan sin
convertir `NULL` a cero.

## 6. Pasos

1. Crear package privado ESM con Vitest **4.1.9 exacto** y lockfile.
2. Configurar entorno `node` e include `__tests__/**/*.test.js`.
3. Implementar loaders con dependencia `fetchView` inyectable y carga paralela.
4. Implementar adaptadores Retén/Descartados sin mutar filas.
5. Implementar búsqueda normalizada, filtros derivados, orden estable y conteos.
6. Detectar intersección de `casing_id` y devolver error de contrato.
7. Añadir tests exhaustivos.

## 7. Estados/error/concurrencia

- Propagar no autorizado distinto de red/error general.
- 0 filas es éxito vacío.
- Rechazar/ignorar defensivamente una fila de Descartados cuyo status no sea `discarded` según el
  contrato elegido, con prueba explícita.
- No cachear inventario como verdad persistente.

## 8. Invariantes de seguridad

Sin `service_role`, sesiones, UUIDs reales, URLs reales ni datos de cliente en fixtures. No enviar
`company_id` como filtro de autorización. No acceder a tablas base.

## 9. Pruebas mínimas

- Retén con retiro y ciclo nunca retirado.
- Descartado con causa/foto y con `NULL` válidos.
- `installed`/`in_inventory` nunca se muestran como descartados.
- Intersección detectada.
- Búsqueda por tokens, acentos, código, marca, medida y condición.
- Orden por fecha, nulos al final, empate por código.
- No mutación.
- Carga paralela, error individual, no autorizado y 0+0.

## 10. Aceptación y comandos

```bash
cd WEB/inventario
npm install
npm test
node --check data.js
node --check inventory-model.js
```

Suite verde, versión fijada, lockfile presente y `git diff --check` limpio.

## 11. Rollback

Eliminar el scope nuevo. No hay impacto remoto ni sobre Movimientos.

## 12. Handoff

Actualizar fila 04 con cantidad de archivos/pruebas, comandos y forma exacta de los exports que
usará `task_05`.
