# DECISIONES — Sección Servicios

Cada decisión lleva su porqué y qué la revertiría. **Ningún ejecutor deroga una decisión**: si una
tarea parece exigirlo, se detiene y se registra aquí con aprobación humana.

---

## D1 — Un servicio es una salida

Un servicio = un renglón `direction='exit'` con su `movement_reason` como tipo.

**Por qué.** Es lo único que tiene tipo por constraint (`tire_movement_executions_reason_by_direction`).
Contar órdenes no sirve: una orden puede mezclar tipos (sacar dos a scrap y uno a reencauche), así
que el tipo sería multivaluado y ninguna barra sumaría el total.

**Qué la revierte.** Que el negocio empiece a facturar o reportar por orden y no por neumático
atendido. Entonces se agrega un segundo nivel de agregación, no se cambia este.

---

## D2 — `installation` es un tipo sintético derivado

Los `entry` que no cierran rotación reciben `service_type='installation'` **en la vista**. No se
agrega al enum de la base.

**Por qué.** Sin esto, «instalé 30 neumáticos» no tiene métrica y el desglose por tipo no cuadra con
el total de renglones. Y no puede ir al enum: la constraint prohíbe que un `entry` lleve
`movement_reason`, por diseño.

**Qué la revierte.** Que el negocio distinga tipos de instalación (montaje nuevo vs. reposición). Ahí
haría falta un dato real capturado por el operario, no una derivación.

---

## D3 — El pareo de rotación es estructural, nunca textual

Se emparejan renglones por `sequence - 1` como índice en `request_items`. **Prohibido** usar el texto
de `observations`.

**Por qué.** La cadena `addRotation` → `draftFromOrder` → `ExecutionScreen` → RPC preserva orden y
cardinalidad (`AUDIT.md` §6). En cambio `observations` se inicializa con las notas pero el operario
lo edita libremente: un pareo por prosa se rompe el primer día.

**Qué la revierte.** Que se agregue `request_item_index` a la tabla — entonces el pareo deja de ser
inferencia y pasa a ser un dato. Es la mitigación recomendada, fuera de esta fase.

---

## D4 — Dos niveles de pareo, con `rotation_pairing` visible

Nivel 1 exacto por posición estructural; nivel 2 inferido acotado por conteo. La vista expone cuál
aplicó.

**Por qué.** `complete_tire_movement_order` no valida que `p_items` tenga la misma longitud que
`request_items`. La alineación es una propiedad emergente del cliente, **no una invariante del
esquema**: un cliente futuro podría romperla en silencio. El nivel 2 protege el invariante de conteo;
la columna admite que la atribución por fila es aproximada.

Sin la columna, la vista sería una caja negra: nadie podría distinguir un conteo confiable de uno
degradado.

**Qué la revierte.** `request_item_index` en la tabla (ver D3), o una validación de longitud en la
RPC. Cualquiera de las dos elimina el nivel 2.

---

## D5 — Servicios no es un objeto navegable

No hay `servicio.html?id=`, no se registra `kind:'service'` en `v_search_index`, y la fila de la
lista **no es clicable**: solo la placa y el código de casco son enlaces.

**Por qué.** `decisions/0005-buscador-global-objetos-navegables.md` fija dos sustantivos navegables:
Unidad y Neumático. Las facetas resuelven a listas filtradas, jamás a páginas propias. Servicios es
una lista filtrable que **enruta hacia** esos dos objetos.

**Qué la revierte.** Un ADR nuevo que derogue explícitamente ADR-0005. No se hace por conveniencia de
una pantalla.

---

## D6 — La normalización de marca y medida va en SQL

La vista expone `brand_key` / `size_key` (`upper(btrim(...))`) además de la grafía cruda.

**Por qué.** La deuda de caja documentada (`GOODYEAR` vs `goodyear`) parte las agregaciones en filas
separadas. Es distinto del caso de búsqueda: buscar tolera variantes porque el usuario ve los
resultados; **agrupar no**, porque produce dos barras donde debía haber una.

No contradice D7 de `tasks_buscador_global` («normalización en cliente»): esa decisión es sobre
búsqueda de texto. Esta es sobre agregación.

**Qué la revierte.** Que se limpien los datos de origen y se agregue una constraint de normalización
en `tire_movement_executions`. Entonces `*_key` sobra.

---

## D7 — `reconciliation_status` se expone como faceta

Aunque hoy sea `pending` en el 100 % de los renglones.

**Por qué.** Es cómo el usuario descubre que estos servicios **no están ligados a un casco ni a su
ciclo de vida**. Ocultar la faceta haría parecer la pantalla más completa de lo que es. La pantalla
mide actividad declarada por personas; decirlo es parte del contrato con quien la lee.

**Qué la revierte.** Que exista un reconciliador y la columna deje de ser uniforme. Ahí la faceta pasa
de advertencia a filtro útil, y se queda.

---

## D8 — No se filtran los datos `QA-TEST`

**Por qué.** Cualquier patrón que se invente (prefijo de placa, nombre de empresa, unidad `QA-CN16`)
es una adivinanza que puede ocultar datos reales. Esconder filas en una vista es la peor forma de
resolverlo: el problema deja de verse pero sigue contaminando.

Lo correcto es borrarlos de producción o marcarlos con una columna. Es una decisión humana pendiente,
registrada en `knowledge/ai/10`.

Mitigación disponible: la faceta `unidad` permite aislarlos manualmente.

**Qué la revierte.** Que se agregue una columna real de marcado (`is_test`, `environment`) a las
tablas base.

---

## D9 — Pantalla de solo lectura

Ningún camino desde `servicios.html` alcanza una RPC. No se cancela, no se reabre, no se corrige, no
se reconcilia.

**Por qué.** Es el mismo principio que `WEB/movimientos/README.md` fija para su fase («la web dirige
y sigue órdenes; el operario ejecuta») y que ADR-0005 fija para el buscador («enruta, no ejecuta»).
Mezclar lectura y ejecución en una superficie de métricas es lo que `DESIGN.md` §8 prohíbe.

**Qué la revierte.** Nada dentro de esta fase. Una operación de corrección sería una fase propia, con
su RPC, su auditoría y su rastro.

---

## D10 — Límite de 2000 con banner explícito

`SERVICES_FETCH_LIMIT = 2000`. Cuando la respuesta llena el límite, la pantalla lo dice.

**Por qué.** El antipatrón registrado (`limit: '200'` silencioso en `instalacion.html`) hace que el
usuario crea que ve todo. Un tope visible con instrucción de acotar es honesto; un recorte silencioso
es un error de datos disfrazado de rendimiento.

2000 cubre holgadamente el volumen actual y da margen; con ~500 unidades en uso sostenido el banner
empezará a aparecer, y ese es exactamente el momento de implementar paginación.

**Qué la revierte.** Paginación por cursor o ventana temporal en servidor. Diseñada, no implementada.

---

## D11 — Zona horaria: `America/Lima` — **CONFIRMADA (2026-07-20, humano)**

`captured_on = (captured_at at time zone 'America/Lima')::date`.

**Por qué.** `grep "at time zone"` sobre las migraciones da **0 resultados**: el proyecto no tiene
convención porque nunca tuvo que agrupar `timestamptz` por día. Sin conversión explícita, PostgREST
resuelve `::date` en UTC y un servicio capturado a las 20:00 en Lima se agrupa **al día siguiente** en
las facetas de fecha y mes. Un jefe de flota vería servicios de ayer contados como de hoy.

Alternativa peor pero honesta que se descartó: dejar UTC y llamar la columna `captured_on_utc`.

**Estado.** Confirmada por el humano. `task_02` puede cerrar. Pendiente de registrar en `knowledge/`
como convención del proyecto (no solo de esta vista) en `task_09`.

---

## D12 — No se unifica la navegación divergente

Los 8 HTML tienen navs duplicados a mano, con clases distintas (`nav` vs `screen-nav`) y listas de
enlaces que difieren entre archivos. Esta fase **inserta** el enlace en los 8 y no toca nada más.

**Por qué.** Unificar el shell es una refactorización transversal que tocaría las 8 pantallas en
producción. Mezclarla con una funcionalidad nueva hace que un fallo en cualquiera de las dos
contamine la otra y complica el rollback.

Queda como deuda registrada, ya presente en `knowledge/ai/10`.

**Qué la revierte.** Una fase propia de extracción del shell.

---

## D13 — El campo de filtro no viola «cero inputs» de `DESIGN.md` §8

§8 dice que el dashboard no edita: cero inputs, cero foco naranja. La pantalla monta un
`<input role="combobox">` con borde naranja en foco.

**Resolución.** §8 prohíbe inputs de **captura de datos**, no controles de lectura. El campo de
filtro no escribe nada: acota lo mostrado y actualiza la URL. Y el foco naranja no viola la Regla del
Naranja Único porque el foco es exclusivo por definición (§2: «solo un elemento por pantalla en
estado foco/acción a la vez»). El único naranja **persistente** del contenido sigue siendo el
segmento `discard` de la barra.

**Por qué se registra.** Inspecciones, Rendimiento y Neumáticos **ya** lo hacen sin estar
documentado. Esta fase hereda el patrón; `task_09` lo escribe en `DESIGN.md` para que la próxima
pantalla no vuelva a litigarlo.

---

## D14 — Paleta de la barra segmentada: rampa monocroma + dos semánticos

`discard` → `--ember-orange`; `retread` → `--signal-yellow`; los otros seis, una rampa monocroma
descendente sobre el azul del sistema.

**Por qué.** Hay 8 tipos y `DESIGN.md` §8 solo consagra tres colores semánticos, que son el semáforo
RTD. Reusarlos mentiría: un balanceo no es «Normal» ni un reencauche es «Próximo a». Inventar 8 tonos
arbitrarios rompería el sistema.

La rampa mantiene el carácter de instrumento y deja el color semántico solo donde hay carga real:
§8 ya asigna naranja al desecho, y §2 asigna amarillo a los hitos. **Naranja Único se cumple**: un
solo elemento naranja persistente por pantalla.

**Regla que acompaña:** el color nunca es el único canal. Leyenda con conteo y porcentaje en
`tabular-nums`, `title` por segmento y `aria-label` que enumera todo. Un daltónico o un lector de
pantalla obtiene el dato completo.

**Qué la revierte.** Que el negocio agrupe los 8 tipos en 3 familias con semántica propia. Ahí el
semáforo vuelve a aplicar.
