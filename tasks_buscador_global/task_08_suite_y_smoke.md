# task_08 — Suite integral y smoke autenticado

## 1. Propietario

**CODEX + USUARIO.** El smoke autenticado sobre datos reales lo ejecuta la persona responsable.

## 2. Objetivo y resultado observable

Probar el sistema completo contra datos reales, con foco en los tres fallos que serían invisibles
desde el código: **cobertura incompleta**, **fuga entre empresas** y **enlaces falsos**.

## 3. Dependencias y bloqueos

Depende de `task_07`. Bloquea `task_09`.

## 4. Archivos exclusivos

Evidencia local registrada en `STATE.md`; `PRUEBA_CAMPO.md` si se ejecuta el recorrido de campo.

## 5. Suite local

```bash
npx vitest run --dir WEB/shared
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/inventario     # regresión, sin modificar
npx vitest run --dir WEB/movimientos    # regresión, sin modificar
node scripts/prepare-static-hosting.mjs
git diff --check
npm run docs:check
```

Criterio de bloqueo: cualquier archivo bajo `WEB/inventario/__tests__/` o
`WEB/movimientos/__tests__/` modificado en el diff invalida la fase.

## 6. Smoke autenticado

Con sesión real, sobre `WEB/` servido por HTTP.

### 6.1 Cobertura

1. Contar filas del índice en el navegador y comparar contra `count(*)` de `units` y
   `tire_casings` de la empresa. Deben coincidir exactamente.
2. Elegir un casco **en retén** y uno **descartado**; confirmar que ambos aparecen. Es lo que las
   vistas de inventario no cubren juntas y la razón de construir desde tablas base.

### 6.2 Identidad

3. Caso `code_mismatch`: encontrar el mismo neumático **por ambos códigos**.
4. Casco sin código: visible, con `SIN CÓDIGO`, enrutando a su unidad; **sin enlace falso**.
5. Casco sin código y sin unidad: fila visible y no navegable.

### 6.3 Aislamiento

6. Sesión de empresa A: buscar una placa conocida de empresa B. **Cero resultados.**
7. Cerrar sesión, entrar como empresa B **en la misma pestaña**, repetir la búsqueda de A. Cero
   resultados. Esta es la prueba de que la caché murió; si aparecen datos de A, es fuga entre
   inquilinos y la fase se bloquea sin excepción.

### 6.4 Recorrido funcional

8. Desde cada una de las 7 pantallas: abrir el buscador por barra y por atajo, buscar por fragmento
   de placa, de código y de marca, y navegar al objeto.
9. Deep-links vigentes: `?inspection_id=`, `?plate=`, `?date=`, `?mode=movimientos`,
   `?mode=cambios`, `?tab=descartados`.
10. Botón «Volver» de `historial-neumatico.html` desde cada `from` y sin `from`.
11. Recargar sobre un objeto y confirmar que la URL lo sostiene.

### 6.5 Teclado, responsive y consola

12. Recorrido completo por teclado; foco devuelto al cerrar; `aria-activedescendant` correcto.
13. 390×844 sin overflow horizontal; escritorio legible.
14. `prefers-reduced-motion` activo: sin animación.
15. **Consola sin errores y sin secretos**: ni token, ni sesión, ni URL privada, ni filas completas.

## 7. Invariantes

- **Ninguna escritura durante el smoke.** El buscador no escribe (D9); no se confirman lotes ni
  descartes para probarlo.
- `authenticated` no demuestra aislamiento por sí solo: los pasos 6 y 7 son obligatorios.
- No usar `service_role` en ninguna verificación.
- No capturar datos reales en fixtures ni en la bitácora: registrar conteos y resultados, no filas.

## 8. Casos de bloqueo

- Conteo del índice ≠ conteo de tablas base → `BLOQUEADA`.
- Datos de empresa A visibles con sesión de B → `BLOQUEADA`, sin excepción.
- Enlace generado para un código nulo → `EN CORRECCIÓN` en `task_05` o `task_06`.
- Suites existentes que requieren modificación → `EN CORRECCIÓN` en `task_04`.
- Cualquier error o secreto en consola → `EN CORRECCIÓN`.

## 9. Aceptación

Los 15 pasos ejecutados con resultado registrado en `STATE.md`, separando **evidencia local**
(suites, bundle, docs) de **evidencia de campo** (smoke autenticado).

## 10. Handoff

Actualizar fila 08. Si se ejecutó recorrido de campo, dejar `PRUEBA_CAMPO.md` con lo recorrido, lo
observado y lo pendiente.
