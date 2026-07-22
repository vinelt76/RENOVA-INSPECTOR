# PLAN — Buscador global y objetos navegables

Fecha: 2026-07-19. Basado en `AUDIT.md`, `DECISIONES.md` y `CONTRATOS_DATOS.md`.

## 1. Resultado funcional

Dar a la web **dos objetos navegables** (Unidad y Neumático) y **una forma de llegar a ellos desde
cualquier pantalla**.

1. Un buscador global, abierto por barra visible en el header o por `Ctrl/Cmd+K`, que encuentra
   unidades y neumáticos por fragmento de placa, de código, de marca, de medida o de diseño.
2. Resultados ricos: cada fila se reconoce sin abrirla.
3. Las dos páginas de objeto pasan a ser alcanzables y enlazadas entre sí.

No se agrega lógica de escritura. El buscador **enruta, no ejecuta** (D9).

## 2. Arquitectura

```text
Supabase
  v_search_index (nueva, desde tablas base) ──▶ data.js ──┐
                                                           │
                                          sessionStorage ◀─┤
                                                           ▼
                                                   search-model.js
                                                           │
  renova-office-shell.css (barra + Ctrl/K) ──▶ finder-controller.js
                                                           │
                        WEB/movimientos/a11y.js ──▶ overlay accesible
                                                           │
                                   ┌───────────────────────┴──────────────┐
                                   ▼                                      ▼
             Inspecciones por unidad.html?plate=…      historial-neumatico.html?serie=…&from=buscador
```

Archivos nuevos previstos:

- `supabase/migrations/<ts>_search_index_view.sql`: la vista.
- `WEB/shared/search.js`: normalización y tokenización compartidas (extraídas del duplicado).
- `WEB/buscador/data.js`: carga del índice y caché de sesión; sin DOM.
- `WEB/buscador/search-model.js`: filtrado, ranking, agrupación, frecency; puro.
- `WEB/buscador/finder-controller.js`: overlay, teclado, estado, render.
- `WEB/buscador/buscador.css`: estilos propios sobre `renova-office-shell.css`.
- `WEB/buscador/__tests__/*.test.js`: pruebas puras, sin red.

## 3. Experiencia

- Entrada **visible y persistente** en el header compartido, más `Ctrl/Cmd+K` (D10). El atajo no es
  la única puerta.
- Estado vacío: objetos recientes y destinos de pantalla. Es la superficie que decide si el buscador
  sirve a un usuario no experto.
- Resultados agrupados por tipo, con conteo. Para un neumático: código + marca + diseño + medida +
  unidad + posición + estado, suficiente para reconocerlo sin abrirlo.
- Alias mostrados como pista junto al resultado; **nunca obligatorios**.
- Facetas resuelven a listas filtradas, no a páginas propias (D3).
- Sin parsing silencioso: lo interpretado se muestra como chip removible (D8).
- Un `label` nulo se muestra `SIN CÓDIGO` y no genera enlace falso.

## 4. Accesibilidad y responsive

- Patrón `combobox`: `role=combobox`, `aria-expanded`, `aria-controls`, `role=listbox`/`option`,
  `aria-activedescendant`. La navegación por flechas **no mueve el foco del input**.
- Focus trap y región viva reutilizando `WEB/movimientos/a11y.js`; no crear un tercer sistema de
  modal (`AUDIT.md` §4).
- `Escape` cierra y devuelve el foco al disparador. `Enter` navega al resultado activo.
- Estado activo no depende solo del color; foco visible único.
- Objetivos táctiles ≥44 px. Sin overflow horizontal a 390×844.
- `prefers-reduced-motion` desactiva toda animación.

## 5. Diseño

Conforme a `DESIGN.md`:

- Overlay flotante: sombra permitida, `0 8px 24px rgba(0,0,0,0.4)`.
- **Regla del Naranja Único**: el resultado activo es el único elemento naranja mientras el overlay
  está abierto.
- JetBrains Mono; `tabular-nums` en RTD, presión, posición y fechas.
- Estado por borde 2px; disabled por recolor, nunca `opacity`.
- Motion 0.15–0.28 s, `ease-out`, sin rebote.
- Badges de estado sin rojo; el naranja es la severidad máxima.

## 6. Seguridad

- Solo configuración publicable y sesión de `supabase-demo.js`.
- Vista de lectura con `security_invoker`; `SELECT` solo a `authenticated`. No repetir la deriva de
  `GRANT ALL ... to anon` (`AUDIT.md` §5.5).
- **La caché de sesión se destruye al cerrar sesión o cambiar de empresa.** Una caché que sobreviva
  es una fuga entre inquilinos y bloquea la fase.
- Render con `textContent`/creación DOM segura; nunca interpolar dato remoto en `innerHTML`.
- La prueba final comprueba aislamiento con cuentas de empresa A y B.
- Sin `service_role`, secretos, token ni filas completas en logs.

## 7. Pruebas

Vitest, entorno `node`, sin red:

- normalización: acentos, mayúsculas, espacios colapsados;
- tokenización AND con tokens en columnas distintas;
- ranking: prefijo gana a palabra completa gana a substring; orden estable;
- frecency: reordena, nunca elimina; histéresis respetada;
- `label`/`casing_code` nulos: sin enlace falso;
- resolución de destino para los cuatro casos de §6 del contrato;
- caché: hit, miss, versión inválida, invalidación por cambio de sesión;
- estados 0 filas, error y no autorizado con mocks.

Regresión obligatoria: las suites existentes de `WEB/inventario/__tests__/` y
`WEB/movimientos/__tests__/` deben pasar **sin modificación** tras extraer el módulo compartido.

Navegador:

- fixture local para DOM, teclado, foco y responsive;
- sesión autenticada real para forma del contrato, cobertura del índice y aislamiento A/B;
- búsqueda por fragmento de placa, de código y de marca desde cada pantalla;
- caso `code_mismatch`: encontrable por ambos códigos;
- caso casco sin código: visible, sin enlace falso;
- consola limpia y sin secretos.

## 8. Dependencias y propiedad

```text
task_01 (auditoría + contrato congelado)
  ▼
task_02 (migración v_search_index)
  ▼
task_03 (aplicación remota + verificación de cobertura y aislamiento)
  ▼
task_04 (módulo compartido de búsqueda + migración de los dos consumidores)
  ▼
task_05 (carga, caché de sesión y modelo puro + Vitest)
  ▼
task_06 (overlay del buscador: UI, teclado, accesibilidad)
  ▼
task_07 (puntos de entrada y objetos navegables)
  ▼
task_08 (suite integral + smoke autenticado)
  ▼
task_09 (documentación, ADR y revisión cruzada)
```

Todas secuenciales. Ninguna tarea concurrente comparte archivo.

`task_04` es la de mayor riesgo de regresión silenciosa: toca dos pantallas ya en producción para
eliminar un duplicado. Sus pruebas de regresión son criterio de bloqueo.

## 9. Rollback

1. Retirar la barra del header y el atajo de teclado.
2. Retirar `WEB/buscador/` y revertir `WEB/shared/search.js` restaurando los duplicados originales.
3. `drop view public.v_search_index;` — la vista es aditiva y no la consume nada más.
4. No tocar historia, Movimientos, Inventario ni ninguna RPC.

Los enlaces reparados en `task_07` (el «Volver» roto de `historial-neumatico.html`) **no se
revierten**: son correcciones de defecto independientes del buscador.

## 10. Definición de terminado

- El índice cubre exactamente `count(*)` de `units` y `tire_casings` de la empresa; sin truncado.
- Un casco con `code_mismatch` se encuentra por ambos códigos.
- Un casco sin código es visible y no produce enlace falso.
- Aislamiento por empresa verificado con dos cuentas; caché destruida al cambiar de empresa.
- Las dos páginas de objeto son alcanzables desde el buscador y desde la navegación.
- El «Volver» roto de `historial-neumatico.html` queda reparado.
- Teclado completo, foco devuelto, 390×844 y escritorio verificados.
- Suites nuevas verdes y suites existentes verdes **sin modificación**.
- `git diff --check` y `npm run docs:check` verdes.
- Smoke autenticado completado por la persona responsable antes de publicar.
- ADR de UI registrado en `decisions/` — el primero del proyecto.
- `REVISION_FINAL.md` registra por separado evidencia local y evidencia de campo.
