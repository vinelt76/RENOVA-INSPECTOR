# ADR-0005: Buscador global — dos objetos navegables, índice cacheado en cliente

Primer ADR de UI del proyecto. `decisions/` solo tenía backend (`0001`-`0004`); no existía ninguno
sobre navegación, búsqueda ni filtros pese a que esta fase introduce un patrón sistémico nuevo
(`CLAUDE.md`, `knowledge/ai/14 - Mantenimiento documental.md`).

## Contexto

La petición original pedía filtros adicionales en las pantallas de lista. La auditoría
(`tasks_buscador_global/AUDIT.md`) reencuadró el problema: el dolor real no era exceso de filtros
sino ausencia de puntos de entrada y de objetos alcanzables desde cualquier pantalla. Un inspector,
jefe de flota o taller no tenía forma de llegar directo a una unidad o a un neumático sin conocer de
antemano en qué pantalla vivía.

## Decisión

### 1. Dos objetos navegables, y solo dos: Unidad y Neumático

Ningún otro sustantivo del dominio (inspección, marca, medida, condición) se promueve a objeto con
página propia. **Por qué:** sin este límite, cada atributo nuevo pediría su propia pantalla y el
buscador crecería sin fin. Las facetas (marca, modelo, medida, condición, diseño de reencauche,
estado) resuelven a **listas filtradas de esos dos objetos** — hoy, la pantalla única de Neumáticos
de `task_13` — nunca a páginas propias.

### 2. Índice cacheado en cliente, no búsqueda en servidor

`v_search_index` es una vista de lectura sobre `units`/`tire_casings`; el cliente la trae una vez
por sesión (`sessionStorage`) y filtra/rankea en memoria con `search-model.js`. **Por qué:** la
escala actual (309 filas; proyección a 500 unidades + 3 800 cascos ≈ 1.42 MiB antes de las facetas
de `task_12`, ≈ 1.9 MiB después) cabe cómoda en memoria de un navegador de escritorio o tablet de
taller. El esquema no tiene un solo índice de texto (`AUDIT.md` §5.6: todo b-tree, sin `pg_trgm` ni
`tsvector`), así que un `ilike` en servidor sería *seq scan* completo en cada tecla. Un fetch por
sesión evita esa migración y la latencia por tecla.

**Umbral de revisión:** si el universo de cascos crece un orden de magnitud (~30-40 000) o el
payload cacheado supera unos pocos MiB de forma sostenida, esta decisión debe reabrirse — en ese
punto el costo de mantener el índice completo en memoria del cliente puede superar el de indexar en
servidor.

### 3. Sin parsing silencioso de prosa a filtros

El buscador no infiere atributos de lo que el usuario escribe. Lo único interpretado son los
prefijos explícitos `uni:`/`neu:` (D16), que acotan `kind` — una columna cerrada de dos valores — y
se materializan siempre como chip visible y removible. Nunca se infiere marca, medida o condición
desde texto libre. **Por qué (seguridad, no solo UX):** este es un sistema que decide retiros de
neumáticos. Un filtro mal inferido en silencio puede ocultar un casco de los resultados sin que
nadie note que está siendo excluido — el costo de ese error no es una mala búsqueda, es un
neumático que debía revisarse y no apareció.

### 4. El buscador enruta, no ejecuta

Ninguna acción de escritura (descartar, retirar, reinstalar, transferir) es alcanzable desde el
buscador. Encuentra un objeto y navega a su pantalla; el compromiso físico irreversible siempre pasa
por su formulario, con su propia evidencia y confirmación. **Por qué:** descartes y retiros son
decisiones que alteran una flota real; comprimirlas en un atajo de búsqueda las vuelve accidentales.

### 5. Alternativa descartada: Command Palette como interacción principal

El diagnóstico inicial (antes de la auditoría) proponía una Command Palette estilo editor de código
— comandos y navegación mezclados en una sola entrada de teclado — como la puerta principal. Se
descartó porque asumía un usuario teclado-céntrico y experto, algo que `AUDIT.md` §9 marca
explícitamente como no documentado y que contradice el resto del producto: la app de campo es
táctil, bajo sol, con manos ocupadas. La entrada visible y persistente en el header (D10) es la
puerta principal; `Ctrl/Cmd+K` es un acelerador, no el único acceso.

## Limitación conocida y aceptada

Un casco con `code` nulo **no tiene página de historial alcanzable**: `historial-neumatico.html`
filtra por `code=eq.`. El buscador lo muestra igual, con su contexto de unidad y posición, y enruta
a la unidad — nunca genera un enlace falso a un historial que no puede resolver. No se inventó una
ruta que el backend no soporta. Resolverlo de raíz exige una fase de identidad de cascos separada;
`tasks_puesta_en_marcha_movimientos/REVISION_FINAL.md:512` ya registra ~316 neumáticos de deuda de
identidad relacionada.

## Consecuencias

- Cualquier pedido futuro de verbos en el buscador, filtros facetados fuera de Neumáticos, favoritos
  almacenados (en vez de URLs compartibles, D11) o normalización de catálogos abre una fase separada
  con contratos propios — no se resuelve extendiendo esta.
- Agregar una tercera pantalla de objeto (por ejemplo, "Ciclo" o "Inspección" como navegables)
  requiere reabrir este ADR, no solo agregar una ruta.
- La deuda de datos que esta fase destapó sin resolver (variantes de caja en `brand_name`,
  `QA-TEST` en producción) se registra en `knowledge/ai/10 - Roadmap deuda y riesgos.md`, no aquí:
  es deuda de datos, no una decisión de arquitectura de UI.

## Revisión si...

- El universo de cascos crece un orden de magnitud y el payload cacheado deja de ser trivial en
  memoria de cliente (ver umbral en la decisión 2).
- Aparece un tercer objeto de dominio con demanda real de navegación directa propia.
- Un cliente pide búsqueda cross-empresa (hoy fuera de alcance por diseño: RLS por `company_id`).
