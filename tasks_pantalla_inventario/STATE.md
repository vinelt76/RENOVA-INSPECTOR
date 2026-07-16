# STATE — Pantalla de Inventario

Estados: `PENDIENTE` · `EN CURSO` · `EN REVISIÓN` · `APROBADO` · `EN CORRECCIÓN` ·
`BLOQUEADA POR DECISIÓN HUMANA` · `N/A`.

Cada ejecutor actualiza solo su fila al iniciar y terminar. La autoridad sigue siendo el código,
el esquema y las pruebas; esta tabla es la bitácora.

| # | Título | Propietario | Estado | Depende de | Archivos exclusivos | Resultado/Revisión |
|---|---|---|---|---|---|---|
| 01 | Auditoría y contrato de datos | CLAUDE | APROBADO | — | Documentos iniciales de esta carpeta | Auditoría local + evidencia remota previamente documentada; sin consulta remota nueva. Contrato congelado en `CONTRATOS_DATOS.md`. |
| 02 | Migración/vista de lectura | CLAUDE | N/A | 01 | Ninguno | No habrá migración en este alcance; una incompatibilidad abre otra fase. |
| 03 | Aplicación remota y pruebas SQL | CLAUDE | N/A | 02 | Ninguno | No hay DDL que aplicar ni autorización de cambio remoto. |
| 04 | Datos, modelo puro y Vitest | CODEX | APROBADO | 01 | `WEB/inventario/{package.json,package-lock.json,vitest.config.js,data.js,inventory-model.js,__tests__/data.test.js,__tests__/inventory-model.test.js}` | 15/15 pruebas; dos lecturas paralelas, filtro remoto de descartados, `NULL`, búsqueda y conjuntos disjuntos cubiertos. |
| 05 | Pantalla, controlador y estilos | CODEX | APROBADO | 04 | `WEB/inventario.html`, `WEB/inventario/inventory-controller.js`, `WEB/inventario/inventario.css` | Pantalla solo lectura; tabs ARIA, teclado, búsqueda, estados vacío/error/reintento, historial y Realtime implementados; sintaxis verde. |
| 06 | Navegación web consistente | CODEX | APROBADO | 05 | Enlaces de los HTML enumerados en `task_06`, workflow y bundle estático | Seis superficies enlazan Inventario; bundle contiene `inventario/` y corrige la omisión previa de `movimientos/`. |
| 07 | Suite integral y smoke de navegador | CODEX + USUARIO | EN REVISIÓN | 06 | Evidencia local; `PRUEBA_CAMPO.md` si se ejecuta | Suite Inventario 15/15, Movimientos 165/165 y bundle verdes. El usuario ejecutará el smoke autenticado/responsive. |
| 08 | Documentación y revisión cruzada | CLAUDE | EN REVISIÓN | 07 | `REVISION_FINAL.md`, knowledge enumerado en `task_08`, columna Revisión de esta tabla | Knowledge actualizado y revisión local cerrada; el veredicto final espera el smoke del usuario. |

Regla: si `task_04` o `task_07` encuentra que `v_inventory_status` contradice
`CONTRATOS_DATOS.md`, pasa a `BLOQUEADA POR DECISIÓN HUMANA`; no reactiva las tareas 02/03 dentro
de este alcance.
