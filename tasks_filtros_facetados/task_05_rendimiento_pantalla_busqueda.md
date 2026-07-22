# task_05 — Rendimiento como pantalla de búsqueda

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Convertir Rendimiento de detalle jerárquico (unidad → eje → posición) en una **pantalla de búsqueda
con agregación sobre el conjunto filtrado** (F3).

Resultado observable, en palabras de la persona responsable: se busca `tracción` y aparecen los
cálculos de todos los neumáticos de tracción; se agrega `Michelin` y el agregado se reduce a esa
marca.

## 3. Dependencias y bloqueos

Depende de `task_03` y `task_04`.

> **BLOQUEADA POR D-BLOQ-2.** No arranca hasta que el humano confirme si el selector de unidad
> desaparece o sobrevive como faceta `unidad`. Ver `DECISIONES.md`.

Bloquea `task_07`.

## 4. Archivos exclusivos

- `WEB/rendimiento.html`

Solo lectura: `WEB/shared/`, `WEB/neumaticos/`, `WEB/buscador/`, `DESIGN.md`,
`knowledge/ai/09 - Diseno y UX.md`, `CONTRATOS_DATOS.md`.

## 5. Contratos

### Estado inicial

Sin filtros: barra de búsqueda y **agregado de toda la flota** (acotado por frescura, ver §Frescura).
Se eliminan de la vista inicial `unitSelect`, `axleSelectorBlock` y `posSelectorBlock`.

La decisión humana es explícita: al entrar no se muestran los elementos de detalle actuales.

### Facetas

Las que `task_01` haya congelado. Previstas: unidad, marca, modelo, condición, medida, diseño de
reencauche, configuración, eje.

**Solo las confirmadas por `task_01`.** Si retiró alguna del alcance, no se implementa ni se
simula.

### Resultado

Dos partes:

1. **Agregado** sobre el conjunto filtrado, vía `computeGroup` de `task_04`: Km/mm promedio, %
   consumo, Km proyectado, Km acumulado, costo/km.
2. **Lista** de los neumáticos del conjunto. Cada fila abre el detalle.

### Excluidos visibles (F10)

Junto al agregado, **cuántos neumáticos quedaron fuera por datos insuficientes**. Obligatorio.
Promediar 40 mostrando el resultado de 12 sin decirlo es un dato falso, y a escala de flota nadie
puede detectarlo a ojo.

### Detalle

El detalle actual (eje, posición, panel de datos fuente, balance izquierda/derecha) **no se borra**:
pasa a ser lo que se abre al elegir una fila. Ahí sí el balance tiene sentido, porque el conjunto es
un eje.

### Frescura

Por F11 y F12, el agregado excluye por defecto las filas cuya última inspección supere 30 días, y
**lo dice**. La columna de fecha la agrega `task_07`; hasta entonces esta tarea deja el punto de
extensión preparado sin inventar el dato.

### Sin rango de fechas todavía

Por F11, **la UI no ofrece selección de rango** hasta que `task_08` exista. Un control que promete
«de mayo a junio» sobre datos que no lo soportan miente. Se agrega cuando haya con qué responderlo.

### URL

El estado de chips vive en la URL con `pushState`, como `WEB/neumaticos/`: el resultado se comparte
y «Atrás» revierte un filtro.

## 6. Pasos

1. Leer `DESIGN.md`, `knowledge/ai/09`, `WEB/neumaticos/` (precedente de facetas + URL) y el
   `CONTRATOS_DATOS.md` congelado.
2. Confirmar que D-BLOQ-2 está resuelta. Si no, **no empezar**.
3. Montar `filter-bar` con las facetas confirmadas.
4. Reemplazar el render: agregado + lista, alimentados por `applyFilters` + `computeGroup`.
5. Conservar el detalle por posición como destino de fila, con el balance izquierda/derecha.
6. Estado de chips en URL con `pushState`.
7. Mostrar el conteo de excluidos.
8. Dejar preparado el punto de extensión de frescura, sin inventar la columna.
9. Smoke completo: 390×844 y escritorio, teclado, consola limpia, recarga persistente.

## 7. Invariantes

- **No cambiar fórmulas.** `computeGroup` viene de `task_04` sin tocar.
- No inventar `0` donde falta un dato; «sin datos» se muestra como tal.
- Sin catálogos hardcodeados (F7).
- Sin interpretación silenciosa (F6).
- Sin escritura. La pantalla es de lectura.
- No tocar `WEB/shared/` ni `WEB/buscador/`.
- Sin dependencias npm nuevas.
- El bundle estático debe seguir incluyendo lo necesario: revisar el allowlist de
  `scripts/prepare-static-hosting.mjs` (precedente: `tasks_buscador_global/task_07` dejó archivos
  fuera del allowlist).

## 8. Casos de error

- Sin datos para la empresa → mensaje honesto, sesión visible, badge correcto. **Conservar el
  comportamiento actual** de `renderNoData`, que ya distingue «sin datos» de «error de conexión».
- Supabase no configurado → como hoy.
- Filtro sin resultados → estado vacío explícito, con los chips visibles para saber qué quitar.
- Conjunto sin ningún válido → agregado «sin datos suficientes», nunca ceros.
- Todo el conjunto excluido por frescura → decirlo, y ofrecer incluir las rancias.
- Casco sin código → visible, sin enlace falso (precedente de la fase anterior).
- URL con faceta desconocida → se ignora ese chip, el resto se aplica.

## 9. Aceptación

```bash
npx vitest run --dir WEB/rendimiento
npx vitest run --dir WEB/shared
npx vitest run --dir WEB/inventario
npx vitest run --dir WEB/movimientos
npx vitest run --dir WEB/buscador
npx vitest run --dir WEB/neumaticos
npm run docs:check
git diff --check
```

Smoke autenticado con evidencia:

1. Sin filtros: agregado de flota + conteo de excluidos.
2. Chip `eje: Tracción` → agregado recalculado; verificado a mano contra un subconjunto pequeño.
3. Agregar `marca: MICHELIN` → se reduce; AND entre facetas confirmado.
4. Dos marcas → OR dentro de la faceta confirmado.
5. Quitar un chip → vuelve al conjunto anterior; «Atrás» también.
6. URL compartida reproduce el resultado.
7. Abrir una fila → detalle correcto, con balance izquierda/derecha.
8. 390×844 sin overflow; teclado completo; 0 errores de consola.

**El punto 2 es el criterio central**: si el agregado filtrado no coincide con el cálculo manual
sobre ese subconjunto, la tarea no pasa.

## 10. Rollback

Restaurar `WEB/rendimiento.html`. Los módulos de `task_02`–`task_04` quedan intactos y sin
consumidor.

## 11. Handoff

Actualizar fila 05 con: facetas efectivamente implementadas (y cuáles se omitieron y por qué), cómo
se resolvió D-BLOQ-2, verificación manual del agregado filtrado, y evidencia del smoke.
