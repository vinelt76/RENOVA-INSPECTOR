# task_06 — Navegación web consistente

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Agregar “Inventario” a la navegación de las superficies web vigentes y marcarlo activo en la
nueva pantalla, sin revivir Comparativo ni cambiar rutas existentes.

## 3. Dependencias y bloqueos

Depende de `task_05`. Bloquea `task_07`.

## 4. Archivos exclusivos

- `WEB/INSPECCIONES POR FECHA.html`
- `WEB/Inspecciones por unidad.html`
- `WEB/instalacion.html`
- `WEB/rendimiento.html`
- `WEB/importar.html`
- `.github/workflows/web-preview.yml`
- `scripts/prepare-static-hosting.mjs`

`WEB/inventario.html` se considera cerrado por task 05; si necesita corregir su nav, devolver a
task 05 antes de empezar. `historial-neumatico.html` conserva su navegación contextual “Volver” y
no se convierte en pantalla principal salvo evidencia de un shell global equivalente.

## 5. Pasos

1. Auditar cada grupo `.nav`/`.screen-nav`/chips existente.
2. Agregar enlace relativo `inventario.html` con texto `Inventario` en orden consistente.
3. No eliminar enlaces ni reestructurar header.
4. Verificar URLs con espacios y navegación desde/volver a cada pantalla.
5. Comprobar móvil: nav envuelve sin overflow.
6. Incluir `inventario/` y `movimientos/` en los dos empaquetados estáticos.

## 6. Invariantes

Un solo dueño edita estos HTML. No modificar lógica, scripts, estilos o datos salvo lo mínimo del
enlace. No agregar `comparativo.html`, que no existe.

## 7. Pruebas y aceptación

- `rg` encuentra el enlace en todas las superficies enumeradas.
- Cada link abre `inventario.html` por HTTP sin 404.
- Inventario muestra su estado activo; las demás pantallas conservan el suyo.
- Navegación con Tab y Enter.
- 390 px sin overflow horizontal.
- Consola sin errores nuevos y `git diff --check` limpio.

## 8. Rollback

Retirar exclusivamente los enlaces agregados. No tocar la pantalla nueva ni datos.

## 9. Handoff

Fila 06: matriz pantalla→enlace probado, viewport y cualquier excepción justificada.
