# REVISIÓN FINAL — Pantalla de Inventario

Estado: **EN REVISIÓN — evidencia local aprobada; smoke autenticado delegado al usuario**.

## Resultado local

- Pantalla global `WEB/inventario.html`, separada del modo por unidad.
- Retén lee `v_tire_inventory_available` sin filtrar el motivo del último retiro.
- Descartados pide solo `inventory_status=eq.discarded`; el adaptador rechaza otra clasificación.
- Una intersección de `casing_id` entre pestañas produce error de contrato.
- No hay migraciones, RPCs, escrituras, fotos privadas ni acciones históricas restauradas.
- Navegación agregada a las cinco pantallas vigentes y a la propia pantalla de Inventario.
- El empaquetado local y Pages incluye `inventario/` y, al corregir una omisión existente,
  `movimientos/`.

## Evidencia ejecutada

- `cd WEB/inventario && npm test` → **2 archivos, 15/15 pruebas**.
- `cd WEB/movimientos && npm test` → **12 archivos, 165/165 pruebas**.
- `node --check` sobre los tres módulos nuevos → verde.
- `node scripts/prepare-static-hosting.mjs` → contiene HTML, controlador de Inventario y
  controlador de Movimientos.
- `npm run docs:check` → 15 notas IA / 12 humanas.
- `git diff --check` → verde.

## Pendiente antes del veredicto de campo

El usuario ejecutará el smoke. Debe confirmar, sin hacer escrituras no acordadas:

1. contrato real de Retén y Descartados;
2. aislamiento por empresa y sesión;
3. prueba de movimiento a retén y descarte en unidad QA;
4. estados vacíos/error/recuperación/Realtime;
5. teclado, foco, móvil y escritorio;
6. consola sin errores ni secretos;
7. suite Vitest, documentación y `git diff --check`;
8. ausencia de cambios de esquema y de acciones fuera de alcance.

Si esos puntos pasan, el veredicto será **APTO**. Un fallo de contrato, aislamiento o navegación
debe volver a la tarea propietaria antes de publicar.

Los hallazgos se devuelven a la tarea propietaria; la revisión no corrige módulos de producción.
