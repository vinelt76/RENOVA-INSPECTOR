# PRUEBA DE CAMPO — Servicios ejecutados

> **HISTÓRICO (Fase 1).** Su definición de servicio —«una salida es un servicio», «una
> rotación se cuenta una sola vez»— quedó **superada el 2026-07-22** por
> `decisions/0008-servicio-por-posicion-atendida.md`: un servicio es una **posición
> atendida**, y una rotación entre dos posiciones cuenta 2. Este documento no se reescribe:
> describe correctamente lo que se decidió entonces, y era correcto dado lo que la app
> capturaba. Ver `PLAN_PAREO.md`.

Fecha de preparación: **2026-07-20**  
Fecha de ejecución: **2026-07-21**  
Proyecto remoto: `fbxupwwgiebhlciqftpw` (producción, sin rama efímera)  
Responsable de la ejecución real: **Codex, con autorización humana explícita del 2026-07-21**

## 1. Estado de la evidencia

- **Automática/local:** completa y aprobada. Usa fixtures transaccionales SQL o datos controlados
  en el navegador; no crea ejecuciones persistentes.
- **Remota de solo lectura:** completa. Antes del recorrido había **0 ejecuciones** y **0 filas** en
  `v_tire_services`; después hay **2 ejecuciones** y **1 fila** para la orden QA autorizada.
- **Campo real:** núcleo 1–4 aprobado con una orden QA emitida y cerrada mediante las interfaces y
  RPC normales. No hubo inserciones directas ni uso de `service_role`.
- **Hallazgo de campo:** el refresco sin recarga falló porque `tire_movement_executions` no pertenece
  a la publicación `supabase_realtime`. Corregirlo exige una segunda migración o una decisión de
  producto sobre fallback, y la regla 7 de `STATE.md` prohíbe ampliar el esquema en silencio.

El criterio central de una rotación como una sola fila está aprobado.

**Resolución del punto 17 (2026-07-21, decisión humana):** se descarta la migración de excepción y
el hallazgo se acepta como **deuda registrada**. El refresco automático no figura entre los criterios
de `PLAN.md` §10, así que no bloquea el cierre; el punto 17 era una verificación adicional. Servicios
refleja los cambios al recargar, y eso queda dicho donde se lee: `REVISION_FINAL.md` §5 y
`knowledge/ai/10 - Roadmap deuda y riesgos.md`. La fase cierra con `task_08` en `APROBADO CON DEUDA`.

**Resolución posterior (2026-07-22):** se implementó el fallback elegido: lectura silenciosa al
volver a la pestaña y cada 10 segundos mientras Servicios está visible. El punto 17 permanece
`RECHAZADO CAMPO` como resultado histórico de aquella versión; falta repetirlo con una orden real
después de la recarga limpia de datos.

## 2. Evidencia automática

| Verificación | Resultado medido |
|---|---|
| `WEB/servicios` | **34/34** |
| `WEB/shared` | **50/50** |
| `WEB/buscador` | **19/19** |
| `WEB/neumaticos` | **3/3** |
| `WEB/inventario` | **15/15** |
| `WEB/movimientos` | **176/176** |
| SQL `tire_services_view.test.sql` | **S1–S9 aprobados**; terminó con el centinela esperado `P0001 TESTS_PASSED` y revirtió fixtures |
| HTTP anónimo | clave pública sin sesión → **401**, PostgreSQL `42501 permission denied for view v_tire_services` |
| Bundle | `servicios.html` + `data.js`, `servicios-model.js`, `servicios-controller.js`, `servicios.css`; sin `package.json`, `vitest.config.js` ni `__tests__/` |
| Bundle servido por HTTP | recursos propios **200/304**, **0 recursos propios 404**, consola **0 errores**, excepciones **0** |
| Integridad | `node --check` y `git diff --check` limpios |

## 3. Recorrido numerado

Estados: **APROBADO LOCAL**, **PENDIENTE CAMPO**, **N/A CAMPO**. Un aprobado local no sustituye la
firma de campo cuando el punto exige datos o identidades reales.

| # | Acción y resultado esperado | Resultado registrado |
|---:|---|---|
| 1 | En Movimientos de `Inspecciones por unidad.html`, emitir una orden real con rotación **P3→P7**. Anotar `order_id`, empresa y total previo del tile, sin copiar tokens ni la fila completa. | **APROBADO CAMPO.** Empresa MÓVIL BUS, unidad QA-CN16, orden `71f7aaba-01f0-4a78-9270-e33dd03a6f26`; tile previo = **0** (UI `—`). Emisión por interfaz normal con marcador QA. |
| 2 | Un operario real toma y cierra esa orden en `app movimientos/`, completando los campos requeridos. Anotar hora Lima y operario. | **APROBADO CAMPO.** Operario Móvil Bus 01; cierre **2026-07-21 00:46:25 America/Lima**; odómetro 2.500.002; estado remoto `completed`; **2/2** ejecuciones. |
| 3 | Abrir/recargar `servicios.html` con la empresa de la orden. | **APROBADO CAMPO.** Recarga autenticada como MÓVIL BUS; la consulta de la misma sesión devolvió la fila y la pantalla terminó con `aria-busy=false`. |
| 4 | Confirmar **una** fila `ROTACIÓN · P3 → P7`, no dos, y que SERVICIOS aumenta exactamente **+1**. Registrar `antes`, `después` y filas encontradas. | **APROBADO CAMPO — criterio central.** Tile **0→1**; lista = **1** fila; tipo `rotation`; posición **P3→P7**; `rotation_pairing='exact'`; barra **1 · 100,0 %**. La vista y la UI no mostraron una segunda instalación. |
| 5 | Cerrar una orden real con un `entry` suelto; debe aparecer una fila `INSTALACIÓN`. | **N/A CAMPO:** no había ejecuciones reales. SQL S3 y modelo puro aprobados. |
| 6 | Cerrar una salida real `discard`; debe existir un solo segmento naranja persistente. | **N/A CAMPO:** sin ejecución real. DOM controlado: 1 tipo `alert`, `discard`; suite confirma exactamente uno. |
| 7 | Ejecutar orden mixta (scrap + reencauche + rotación) y comparar desglose. | **N/A CAMPO:** sin orden real. SQL S4 aprobó el conteo mixto. |
| 8 | Sumar la barra y contrastar leyenda con tile. | **APROBADO LOCAL Y CAMPO:** local 3 filas, **33,4 + 33,3 + 33,3 = 100,0**; campo 1 fila, **100,0 %**; leyenda y tile = 1. |
| 9 | Filtrar por tipo, unidad y mes; tiles/lista deben cambiar juntos. | **APROBADO LOCAL:** unidad `ABC-123` = 2/3; OR con `XYZ-900` = 3/3; AND con `PARA SCRAP` = 1/3. Mes/facetas cubiertos por Vitest. |
| 10 | Copiar URL; comprobar estado en otra pestaña y Atrás/Adelante. | **APROBADO LOCAL:** URL con dos `unidad` y un `tipo`; Atrás restauró 3 filas/2 chips, Adelante 1 fila/3 chips. |
| 11 | Abrir placa y código. | **APROBADO LOCAL:** `Inspecciones por unidad.html?plate=ABC-123` y `historial-neumatico.html?serie=CASCO%2F1&from=servicios`. |
| 12 | Verificar un código no registrado sin enlace y con `SIN HISTORIAL`. | **APROBADO LOCAL:** presente, sin `href`. Campo real N/A por 0 filas. |
| 13 | Entrar como `inspector`; debe decir rol sin acceso, no sin datos. | **APROBADO LOCAL:** texto exacto `Tu rol no tiene acceso a los servicios de movimiento.`; cuatro tiles `—`. |
| 14 | Entrar en una empresa sin servicios. | **APROBADO LOCAL y remoto de solo lectura:** vista remota = 0; simulación DOM = cuatro `—`, 0 segmentos, mensaje explícito. Falta abrirla con sesión humana si se exige evidencia visual real. |
| 15 | Probar el corte y restaurar `SERVICES_FETCH_LIMIT = 2000`. | **APROBADO LOCAL equivalente:** respuesta controlada de 2.000 filas mostró banner; constante verificada en 2.000. No se dejó un valor temporal. |
| 16 | Empresa A no ve B y B no ve A; registrar ambos conteos con controles positivos. | **APROBADO SQL Y CAMPO PARCIAL POSITIVO:** S9 bilateral con controles positivos propios. En campo, MÓVIL BUS ve **1** fila propia; sesión CIVA ve **0** filas y no ve la fila QA de MÓVIL BUS. |
| 17 | Cerrar orden en otra pestaña y esperar actualización sin recargar. | **RECHAZADO CAMPO / BLOQUEO:** cinco pestañas autenticadas conservaron 0 filas tras el cierre; una consulta directa desde esas mismas sesiones ya devolvía 1. `pg_publication_tables` confirmó que `supabase_realtime` solo publica `inspections` e `inspection_measurements`, no `tire_movement_executions`. La recarga manual sí mostró la fila. |
| 18 | `Ctrl/Cmd+K` abre el buscador; dentro del filtro no lo captura. | **APROBADO LOCAL:** fuera `defaultPrevented=true` y overlay abierto; dentro `defaultPrevented=false`. |
| 19 | Recorrer filter-bar con flechas, Home/End, Enter, Escape y Backspace. | **APROBADO LOCAL:** suite shared incluida en **50/50** y selección Enter ejercitada en smoke. |
| 20 | Revisar 390×844 y escritorio sin overflow horizontal. | **APROBADO LOCAL:** 390/390 px y 1280 px, overflow = `false` en ambos. |
| 21 | Emular `prefers-reduced-motion: reduce`. | **APROBADO LOCAL:** duración calculada del segmento = **0 s**. |
| 22 | Medir contraste del texto de leyenda contra `--field-dark`. | **APROBADO LOCAL:** `--label-blue #7AABCC` / `#111E2E` = **6,83:1**; `--value-ice` = **15,67:1**. Los swatches oscuros no se usan como color del texto. |
| 23 | Revisar consola y ausencia de secretos. | **APROBADO LOCAL:** errores de consola = **0**, excepciones = **0**; no se registraron tokens ni filas completas. Campo real pendiente. |
| 24 | Entrar a Servicios desde las ocho superficies y volver. | **APROBADO LOCAL/estático:** cada HTML contiene exactamente 1 enlace tras Inventario; activos previos intactos; bundle carga Servicios sin 404. Los enlaces de fila vuelven a Unidad e Historial. |

## 4. Firma de campo requerida

Registro de los puntos 1–4:

```text
Responsable: Codex, con autorización humana explícita
Fecha y hora (America/Lima): 2026-07-21 00:46:25
Empresa: MÓVIL BUS
order_id (sin otros datos de la fila): 71f7aaba-01f0-4a78-9270-e33dd03a6f26
Tile antes: 0 (UI —)
Tile después: 1
Filas ROTACIÓN P3 → P7 encontradas: 1
Resultado: APROBADO (núcleo 1–4)
Observaciones: rotation_pairing exact; punto 17 rechazado y bloqueado por decisión de esquema/fallback.
```

Si el último conteo no es exactamente **1** o el tile no aumenta exactamente **+1**, detener la
fase y devolver `task_02` a corrección. Si aparece `rotation_pairing='inferred'` en un dato real,
escalarlo antes de firmar.
