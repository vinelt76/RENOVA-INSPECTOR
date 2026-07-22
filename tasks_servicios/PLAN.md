# PLAN — Sección Servicios

Fecha: 2026-07-20. Basado en `AUDIT.md`, `DECISIONES.md` y `CONTRATOS_DATOS.md`.

## 1. Resultado funcional

Dar a la web una superficie que responda **«cuántos servicios se hicieron y de qué tipo»**, sobre lo
que los operarios ya ejecutan.

1. Una pantalla `WEB/servicios.html` de solo lectura, alcanzable desde la navegación de las 8
   superficies.
2. Filtrado facetado con las mismas primitivas que Inspecciones: OR dentro de faceta, AND entre
   facetas, cada restricción como chip removible, estado en URL compartible.
3. Conteo total y distribución por tipo de servicio.
4. Desde cada fila se salta a la Unidad o al historial del Neumático.

No se agrega escritura. La pantalla **lee y enruta** (D9, D5).

## 2. Arquitectura

```text
Supabase
  tire_movement_orders ─┐
                        ├─▶ v_tire_services (nueva, security_invoker)
  tire_movement_executions ─┘          │
                                       ▼
                        WEB/servicios/data.js  (fetchView, {rows, truncated})
                                       │
                        WEB/servicios/servicios-model.js  (puro: facetas, filtro, resumen)
                                       │
        WEB/shared/{filter-bar,filter-facets,search,inspection-date-facets}.js
                                       │
                        WEB/servicios/servicios-controller.js  (DOM, chips↔URL, realtime)
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
   Inspecciones por unidad.html?plate=…     historial-neumatico.html?serie=…&from=servicios
```

Archivos nuevos:

- `supabase/migrations/20260721130000_tire_services_view.sql` — la vista y su índice.
- `supabase/tests/tire_services_view.test.sql` — pruebas SQL.
- `WEB/servicios/data.js` — única capa de red; sin DOM.
- `WEB/servicios/servicios-model.js` — facetas, filtrado, resumen, enlaces; puro.
- `WEB/servicios/servicios-controller.js` — render, chips, URL, realtime.
- `WEB/servicios/servicios.css` — sobre `renova-office-shell.css`.
- `WEB/servicios.html` — la pantalla.
- `WEB/servicios/{package.json,vitest.config.js,__tests__/*}` — suite.

**Ninguna primitiva nueva.** Todo lo de filtrado, normalización, fechas y buscador global ya existe
(`AUDIT.md` §10). `inspection-date-facets.js` es parametrizable por columna y se reutiliza con
`captured_on` sin tocarlo.

## 3. Experiencia

Jerarquía de la pantalla:

```text
header (navy + cinta de seguridad, de renova-office-shell.css)
 ├ brand RENOVA· / SERVICIOS
 ├ nav  … Servicios con class="active" y aria-current="page"
 └ button.finder-trigger (Ctrl/Cmd K)
main
 ├ intro          eyebrow + h1 + párrafo de alcance
 ├ #filtro        ← createFilterBar
 ├ banner         ← solo si truncated
 ├ métricas       4 stat tiles
 ├ mezcla         barra segmentada + leyenda
 ├ #estado        role="status" aria-live="polite"
 └ #lista
footer  "Vista de solo lectura · esta pantalla no ejecuta ni modifica movimientos"
```

### 3.1 El párrafo de alcance

Texto exacto, no negociable en implementación:

> Cada salida que registra un operario cuenta como un servicio. Una rotación se cuenta una sola vez,
> en su salida. Un ingreso que no cierra una rotación se muestra como instalación. Estos registros
> todavía no están ligados a un casco ni a su ciclo de vida.

Las tres primeras frases evitan que alguien audite los números y crea que están mal. La última es la
consecuencia de D7: la pantalla mide actividad declarada, no ciclos de vida.

### 3.2 Facetas

| Faceta | key URL | Columna |
|---|---|---|
| Tipo de servicio | `tipo` | `service_type` |
| Unidad | `unidad` | `plate` |
| Posición | `posicion` | `position_number` |
| Marca | `marca` | `brand_key` |
| Medida | `medida` | `size_key` |
| Condición | `condicion` | `condition` |
| Diseño de reencauche | `reencauche` | `retread_design` |
| Operario | `operario` | `captured_by_name` |
| Supervisor | `supervisor` | `requested_by_name` |
| Mes de servicio | `mes` | `captured_on` |
| Fecha de servicio | `fecha` | `captured_on` |
| Reconciliación | `reconciliacion` | `reconciliation_status` |

- `tipo` se ordena por el orden canónico de los 8 tipos, **no alfabético**.
- `mes` va **antes** de `fecha` en el array, igual que `INSPECCIONES POR FECHA.html:600`: al escribir
  «julio» la opción mensual aparece primero.
- `posicion` se muestra `P{n}` y se ordena numéricamente, no como texto.
- **Sin faceta de empresa**: RLS ya la fija, y ofrecerla sugeriría que hay más de una.
- `reconciliacion` es visible a propósito aunque hoy sea uniforme (D7).

### 3.3 Fila de la lista

```text
[ROTACIÓN]  P3 → P7   ABC-123   7GH2K4   R2 · SLOT-A   4.8 mm   12 jul 2026 · J. Pérez
```

- **Badge de tipo** con el tono del tipo, fondo `rgba(tono, .13)`.
- **Posición**: `P{n}`; en rotación pareada `P{n} → P{m}`; `P{n} → ?` si `not_paired`. Si
  `rotation_pairing='inferred'`, tag `ATRIBUCIÓN INFERIDA` con `title` que explica que el total es
  correcto pero el pareo de esa fila es aproximado.
- **Placa**: enlace a `Inspecciones por unidad.html?plate=…`.
- **Código de casco**: enlace **solo si** hay código, es legible y `casing_exists`. Si
  `code_unreadable` → `SIN CÓDIGO LEGIBLE` en texto plano. Si el código no está registrado → código
  + `SIN HISTORIAL` en texto plano con `title` explicativo. **Nunca un enlace a una pantalla vacía.**
- Condición + diseño de reencauche, RTD mínimo (`{n} mm` o `—`), marca · medida, fecha + operario.

**La fila no es clicable** (D5).

### 3.4 Estados

| Estado | Qué se ve |
|---|---|
| Cargando | «Cargando servicios ejecutados…» |
| Supabase sin configurar | mensaje + `showBadge("empty")` |
| Sin sesión | `requireAuth()` existente |
| **Rol sin acceso** | «Tu rol no tiene acceso a los servicios de movimiento.» — distinto de sin datos |
| Sin datos | «Todavía no hay servicios ejecutados para tu empresa.» + tiles en `—` |
| Filtros sin coincidencias | «Ningún servicio coincide con los filtros.» + quitar último chip |
| Truncado | banner con el conteo y la instrucción de acotar |
| Error de red | mensaje + `showBadge("empty")` |

El estado de rol importa: las policies no cubren `inspector` ni `workshop_manager` (`AUDIT.md` §7).
Sin distinguirlo, esos usuarios reportarán un bug inexistente.

## 4. Accesibilidad y responsive

- El `filter-bar` ya implementa el patrón `combobox`/`listbox` con `aria-activedescendant`; se usa
  tal cual, sin variantes.
- Teclado: flechas, `Home`/`End`, `Enter` elige, `Escape` cierra, `Backspace` en campo vacío quita el
  último chip.
- Objetivos táctiles ≥44 px. Sin overflow horizontal a 390×844.
- La barra segmentada lleva `role="img"` y un `aria-label` que enumera tipo, conteo y porcentaje.
  **El color nunca es el único canal** (D14).
- `prefers-reduced-motion: reduce` desactiva toda animación y transición.
- Estados deshabilitados por recolor a `field-dark`/`border-dark`, **nunca** `opacity`.

## 5. Diseño

Conforme a `DESIGN.md`, especialmente §8 «Dashboard de mantenimiento», que ya especifica esta clase
de superficie.

- **Stat tiles** (4): card `--field-dark`, borde 2px, chaflán 8px por `clip-path`, label 10px
  `--label-blue` uppercase, valor 28-32px/800 `tabular-nums` en `--value-ice`.
  SERVICIOS · UNIDADES ATENDIDAS · ÓRDENES · PERIODO.
- **Con `total === 0` los cuatro muestran `—`, nunca `0`.** Un cero no distingue «no hubo servicios»
  de «no cargó» (`reglas_negocio` §8).
- **Barra de distribución segmentada**: una sola barra horizontal apilada, 26px, borde 2px, sin
  gradiente. **Nunca torta, nunca 3D.** Con `total === 0` no se renderiza: en su lugar un texto. Nunca
  una barra vacía al 100 % de un color.
- **Paleta**: ver D14. `discard` naranja, `retread` amarillo, resto rampa monocroma azul.
- Chaflán industrial solo en stat tiles (8px). **No** en inputs, filas ni chips.
- Sin sombras salvo el overlay del buscador global, que ya la trae.
- Sin rojo: el naranja es la severidad máxima del sistema.
- Motion 0.15-0.28 s, `cubic-bezier(0.22,1,0.36,1)`, sin rebote. La única transición propia es el
  ancho de los segmentos al cambiar filtros.
- JetBrains Mono en todo; `tabular-nums` en todo número.

La tensión de §8 «cero inputs» está resuelta y registrada en D13; `task_09` la documenta en
`DESIGN.md`.

## 6. Seguridad

- Solo configuración publicable y sesión de `supabase-demo.js`.
- Vista de lectura con `security_invoker`; `SELECT` solo a `authenticated`, **nunca a `anon`**.
- **Prohibido** filtrar por `company_id` desde el cliente: el aislamiento es de la RLS. Un filtro
  explícito daría falsa sensación de seguridad.
- Render con `textContent` y creación DOM segura; **nunca** interpolar dato remoto en `innerHTML`.
- Sin `service_role`, secretos, tokens ni filas completas en logs.
- El aislamiento por empresa se verifica con dos cuentas en `task_08`.

## 7. Pruebas

**Vitest, entorno `node`, sin red** (`task_05`):

- rotación pareada cuenta 1 y no genera instalación;
- `entry` suelto cuenta como instalación;
- `summarizeServices([])` devuelve `{total:0, firstDate:null, byType:[]}` — el modelo nunca decide
  mostrar `—`, eso es del controlador;
- los porcentajes suman exactamente 100.0 con 3 y con 7 tipos;
- nunca se emite un segmento con `count === 0`;
- **exactamente un** tipo tiene tono `alert` — Naranja Único verificable en suite;
- todo tipo tiene etiqueta y tono;
- facetas filtran; chip de faceta desconocida se ignora sin lanzar;
- `chipsFromSearch(searchForChips(x))` es idempotente, incluido multivalor;
- `casingHistoryHref` devuelve `null` con `casing_exists:false` y con `code_unreadable:true`;
- `data.js` llama `fetchView` con los parámetros exactos, **no** envía `company_id`, y marca
  `truncated` cuando la respuesta llena el límite.

**SQL** (`task_03`): los 9 casos del contrato, incluyendo orden desalineada y aislamiento por empresa.

**Regresión obligatoria**: las suites de `WEB/shared/`, `WEB/movimientos/`, `WEB/inventario/`,
`WEB/buscador/` y `WEB/neumaticos/` deben pasar **sin modificación**. Esta fase no toca ninguna.

**Navegador** (`task_08`): el smoke que decide es el flujo real completo — emitir orden con rotación,
ejecutarla en la app del operario, y comprobar que aparece **una** fila, no dos.

## 8. Dependencias y propiedad

```text
task_01 (auditoría + contrato congelado)              CLAUDE
  ▼
task_02 (migración v_tire_services)                   CLAUDE
  ▼
task_03 (pruebas SQL de la vista)                     CLAUDE
  ▼
task_04 (aplicación remota + verificación)            CLAUDE + USUARIO
  ▼
task_05 (data.js, modelo puro y Vitest)               CODEX
  ▼
task_06 (pantalla, controlador y CSS)                 CODEX
  ▼
task_07 (navegación y bundle estático)                CODEX
  ▼
task_08 (suite integral + smoke autenticado)          CODEX + USUARIO
  ▼
task_09 (documentación, ADR y revisión cruzada)       CLAUDE
```

Todas secuenciales. Ninguna pareja comparte archivo.

`task_02` es la de mayor riesgo conceptual: si la definición de servicio se materializa mal, todo lo
demás hereda el error sin que se note. Por eso `task_03` va antes de aplicar nada al remoto.

`task_07` es la de mayor riesgo de regresión: toca 8 pantallas en producción para insertar un enlace.

## 9. Rollback

1. Retirar el enlace «Servicios» de los 8 navs y las dos entradas de
   `scripts/prepare-static-hosting.mjs`.
2. Retirar `WEB/servicios.html` y `WEB/servicios/`.
3. `drop view public.v_tire_services;` y
   `drop index if exists public.tire_movement_executions_company_captured_idx;`

La vista es aditiva y nada más la consume, así que la reversión es limpia. No se toca ninguna tabla,
RPC, policy ni vista existente en ningún punto de la fase.

## 10. Definición de terminado

- El conteo de la vista cuadra con `salidas + entradas − rotaciones cerradas`, verificado en SQL.
- Una rotación real, emitida y ejecutada de punta a punta, produce **una** fila y no dos.
- Un `entry` suelto produce una instalación.
- `rotation_pairing` es `exact`/`not_applicable` en la totalidad de los datos reales actuales;
  cualquier `inferred` o `not_paired` quedó investigado y explicado antes de publicar.
- Un código no registrado no produce enlace falso.
- Aislamiento por empresa verificado con dos cuentas.
- Un usuario `inspector` ve el mensaje de rol, no «sin datos».
- Con cero servicios, los cuatro tiles muestran `—` y no se pinta barra.
- El banner de truncado aparece cuando corresponde, verificado bajando el límite.
- Teclado completo, 390×844 y escritorio sin overflow, `prefers-reduced-motion` respetado, contraste
  de la leyenda medido.
- Suites nuevas verdes y suites existentes verdes **sin modificación**.
- El bundle estático contiene `servicios.html` y `servicios/`, y **no** contiene `package.json` ni
  `__tests__/`.
- `git diff --check` y `npm run docs:check` verdes.
- `decisions/0007-definicion-de-servicio-ejecutado.md` registrado.
- D11 (zona horaria) confirmada por decisión humana y documentada en `knowledge/`.
- `REVISION_FINAL.md` separa evidencia local de evidencia de campo y registra la deuda sin ocultarla.
