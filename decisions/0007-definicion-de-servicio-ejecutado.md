# ADR-0007: Definición de servicio ejecutado — una salida es un servicio

> **PARCIALMENTE SUPERADO (2026-07-22) por
> [ADR-0008](0008-servicio-por-posicion-atendida.md).**
>
> - **D1 superada.** La unidad de conteo dejó de ser «una salida» y pasó a ser **una posición
>   atendida**. Una rotación entre dos posiciones cuenta 2, no 1. El criterio de campo de esta fase
>   —«una rotación produce una fila y no dos»— queda derogado con fecha.
> - **D2 sin objeto.** `installation` ya no se deriva para todo ingreso sin pareo de rotación: con
>   el par explícito, un ingreso plegado no genera fila y `installation` queda solo para el montaje
>   que realmente no reemplaza nada.
> - **D3 a D14 siguen vigentes**, en particular D5 (Servicios no es objeto navegable), D6, D8, D9,
>   D10, D11, D13 y D14.
> - **La limitación aceptada sigue vigente**: los servicios no están reconciliados contra cascos.
>
> El cuerpo de este ADR **no se reescribe**. D1 y D2 fueron correctas dado lo que la app capturaba
> entonces; lo que cambió es la captura. Se lee para entender por qué se decidió así, no como regla
> vigente.

Segundo ADR de superficie de lectura, después de ADR-0005 (buscador) y ADR-0006 (filtros
facetados). Registra qué cuenta la pantalla Servicios y por qué, porque «una rotación = un
servicio» es exactamente el tipo de definición que se re-litiga a los seis meses y que cualquier
reporte, tablero o facturación futura va a heredar.

Detalle completo y qué revierte cada decisión: `tasks_servicios/DECISIONES.md` (D1-D14).
Contrato de columnas: `tasks_servicios/CONTRATOS_DATOS.md`. Evidencia:
`tasks_servicios/REVISION_FINAL.md`.

## Contexto

`tire_movement_orders` separa la indicación del supervisor de la ejecución en campo, y
`tire_movement_executions` conserva cada salida/ingreso capturado por el operario. Hasta esta fase
no existía ninguna superficie que respondiera «cuántos neumáticos se atendieron y de qué tipo»: los
renglones existían, pero sin una unidad de conteo acordada, dos personas contando lo mismo llegaban
a números distintos.

El problema no es de presentación. Una rotación se modela como **dos** renglones —una salida
`rotation` del origen más una entrada en el destino (`knowledge/ai/07`, flujo activo, paso 3)— así
que contar renglones duplica cada rotación, y contar órdenes colapsa las mixtas. La unidad de
conteo es la decisión, no la pantalla.

## Decisión

### 1. Un servicio es una salida (D1)

Un servicio = un renglón `direction='exit'`, con su `movement_reason` como tipo.

**Por qué:** es lo único que tiene tipo por constraint
(`tire_movement_executions_reason_by_direction`). Contar órdenes no sirve: una orden puede mezclar
tipos —sacar dos a scrap y uno a reencauche— así que el tipo sería multivaluado y ninguna barra de
distribución sumaría el total. La salida es la unidad natural porque es donde el negocio declara
*qué* pasó con el neumático.

**Consecuencia verificada en campo:** una rotación real produce **una** fila, no dos
(`PRUEBA_CAMPO.md` punto 4, criterio central).

### 2. `installation` es un tipo sintético derivado, no un valor del enum (D2)

Los `entry` que no cierran una rotación reciben `service_type='installation'` **en la vista**.

**Por qué:** sin esto, «instalé 30 neumáticos» no tiene métrica y el desglose por tipo no cuadra con
el total de renglones. Y no puede ir al enum de la base: la constraint prohíbe que un `entry` lleve
`movement_reason`, por diseño. Derivarlo en la vista mantiene la restricción del esquema intacta y
al mismo tiempo hace medible el hecho.

**Qué lo revierte:** que el negocio distinga tipos de instalación (montaje nuevo vs. reposición).
Eso exige un dato real capturado por el operario, no una derivación.

### 3. El pareo de rotación es estructural, nunca textual (D3)

Se emparejan renglones por `sequence - 1` como índice en `request_items`. **Prohibido** usar el
texto de `observations`.

**Por qué:** la cadena `addRotation` → `draftFromOrder` → `ExecutionScreen` → RPC preserva orden y
cardinalidad, verificado en los cuatro puntos (`tasks_servicios/AUDIT.md` §6). En cambio
`observations` se inicializa con las notas pero el operario lo edita libremente: un pareo por prosa
se rompe el primer día. Es el mismo principio que ADR-0005 §3 fija para el buscador —sin parsing
silencioso de prosa— y por la misma razón de seguridad: este sistema decide retiros de neumáticos,
y una inferencia de texto mal resuelta produce un conteo que nadie sabe que está mal.

### 4. Dos niveles de pareo, con `rotation_pairing` visible como contrato de honestidad (D4)

Nivel 1 exacto por posición estructural; nivel 2 inferido y acotado por conteo. La vista expone
cuál aplicó: `exact` / `inferred` / `not_paired` / `not_applicable`.

**Por qué:** `complete_tire_movement_order` no valida que `p_items` tenga la misma longitud que
`request_items`. La alineación es una propiedad emergente del cliente, **no una invariante del
esquema**: un cliente futuro podría romperla en silencio. El nivel 2 protege el invariante de
conteo; la columna admite que la atribución por fila es aproximada.

Sin la columna la vista sería una caja negra: nadie podría distinguir un conteo confiable de uno
degradado. Exponer la degradación es preferible a promediarla hacia adentro.

**Estado real medido:** 100 % `exact` / `not_applicable` en los datos de producción actuales.

### 5. Servicios no es un objeto navegable (D5)

No hay `servicio.html?id=`, no se registra `kind:'service'` en `v_search_index`, y la fila de la
lista **no es clicable**: solo la placa y el código de casco son enlaces.

**Por qué:** ADR-0005 §1 fija dos sustantivos navegables y solo dos —Unidad y Neumático— y establece
que las facetas resuelven a listas filtradas, jamás a páginas propias. Servicios es una lista
filtrable que **enruta hacia** esos dos objetos. Promoverla a objeto propio no ampliaría una
pantalla: derogaría el límite que impide que cada atributo del dominio pida su propia página.

**Relación con ADR-0005:** esta decisión lo aplica, no lo tensiona. Servicios es el tercer consumidor
del patrón «enruta, no ejecuta», junto con el buscador y Neumáticos. Coherente con D9 de la fase: la
pantalla es de solo lectura y ningún camino desde `servicios.html` alcanza una RPC.

### 6. Convención de zona horaria: `America/Lima` (D11)

`captured_on = (captured_at at time zone 'America/Lima')::date`.

**Por qué:** `grep "at time zone"` sobre las migraciones daba **0 resultados** — el proyecto no tenía
convención porque nunca había necesitado agrupar `timestamptz` por día. Sin conversión explícita,
PostgREST resuelve `::date` en UTC y un servicio capturado a las 20:00 en Lima se agrupa **al día
siguiente**: un jefe de flota vería servicios de ayer contados como de hoy.

Es una convención **del proyecto**, no de esta vista: cualquier agrupación futura de `timestamptz`
por día debe usarla. Registrada en `knowledge/ai/05`.

## Limitación conocida y aceptada

**Los servicios no están reconciliados contra cascos.** `reconciliation_status` es `pending` en el
100 % de los renglones: no existe un reconciliador que ligue una ejecución con
`tire_casings` / `tire_life_cycles` / `tire_installations`.

Esto significa que la pantalla mide **actividad declarada por personas**, no consumo verificado
contra la vida útil del casco. No se puede derivar de ella costo por kilómetro, rendimiento de banda
ni vida remanente.

Se expone deliberadamente como faceta (D7) aunque hoy sea uniforme: es cómo el usuario descubre la
limitación. Ocultar la faceta haría parecer la pantalla más completa de lo que es. La misma lógica
que ADR-0005 aplica a los cascos sin `code`: no se genera un enlace falso a algo que el backend no
puede resolver.

Un código de casco sin historial se muestra con el tag `SIN HISTORIAL` y **sin** `href`.

## Consecuencias

- Cualquier reporte, exportación o facturación futura que cuente «servicios» hereda D1. Cambiar la
  unidad de conteo invalida las series históricas: exige reabrir este ADR, no ajustar una consulta.
- `request_item_index` en `tire_movement_executions`, escrito por `complete_tire_movement_order`,
  convierte el pareo de inferencia en dato y **elimina el nivel 2** (D3, D4). Es la mitigación
  recomendada y queda fuera de esta fase.
- Un reconciliador de ejecuciones contra casco/ciclo/instalación desbloquea métricas de consumo y
  vida útil por servicio, y convierte la faceta `reconciliation_status` de advertencia en filtro
  útil (D7).
- Agregar tipos de instalación distinguibles (D2) o agrupar los 8 tipos en familias semánticas (D14)
  son cambios de negocio, no de presentación.
- La normalización de marca/medida vive en SQL (`brand_key`/`size_key`, D6) porque **agrupar** no
  tolera variantes de caja aunque **buscar** sí. No contradice la normalización en cliente del
  buscador: son dos problemas distintos.

## Revisión si...

- El negocio empieza a facturar o reportar **por orden** y no por neumático atendido. Entonces se
  agrega un segundo nivel de agregación sobre D1, no se cambia D1.
- Se agrega `request_item_index` o una validación de longitud en la RPC: el nivel 2 de pareo (D4)
  deja de tener razón de existir.
- Aparece un reconciliador: la limitación aceptada de esta fase deja de aplicar y las métricas de
  consumo pasan a ser derivables.
- Alguna faceta empieza a devolver `inferred` o `not_paired` sobre datos reales: significa que la
  alineación `sequence ↔ request_items` se rompió en producción y hay que investigarla **antes** de
  seguir publicando la métrica.
