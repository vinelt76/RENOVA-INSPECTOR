# PRUEBA DE CAMPO — Pareo por posición atendida

Fecha de ejecución: **2026-07-22, 22:22 America/Lima**  
Proyecto remoto: `fbxupwwgiebhlciqftpw`  
Empresa y unidad: **MÓVIL BUS · 2145**  
Responsable: **Codex, con autorización humana explícita**

## 1. Resultado

El recorrido central de `task_12` queda **APROBADO**.

- Rotación P3↔P4: orden `cd5c27db-0d1d-4fd9-96f2-5ebec48223fc`, completada con 4/4
  ejecuciones. Produce 2 servicios `rotation`, ambos con `rotation_pairing='exact'`.
- Scrap con reemplazo P5: orden `b47fd97b-2d20-415a-9eaf-03e5858b49e3`, completada con 2/2
  ejecuciones. Produce exactamente 1 servicio `discard`; no genera una `installation` fantasma.
- Servicios para 2145 pasó de 0 a 2 y luego a 3 filas sin recarga manual. El fallback refrescó al
  recuperar el foco en **7,2 s** y **7,4 s**, respectivamente.
- Consola y excepciones: **0** en supervisor, operario y Servicios.

Las ejecuciones quedan con `reconciliation_status='pending'`, conforme al contrato vigente: esta
captura registra el trabajo real, pero no reconcilia automáticamente las instalaciones históricas
del casco.

## 2. Evidencia automática vigente

| Suite | Resultado |
|---|---:|
| `WEB/servicios` | **38/38** |
| `WEB/movimientos` | **186/186** |
| `app movimientos` | **3/3** |
| Matriz integral ejecutada antes del campo | **380/380** |

## 3. Recorrido de campo

Estados: `OK`, `N/A` con motivo. Los puntos críticos 3, 5 y 8 están en `OK`.

| # | Resultado | Evidencia |
|---:|---|---|
| 1 | **OK** | Rotación P3↔P4 emitida desde el supervisor web sobre la unidad real 2145. |
| 2 | **OK** | `request_items` contiene `exit@P3, entry@P3, exit@P4, entry@P4`, en ese orden. |
| 3 | **OK** | La app procesó las 4 ejecuciones técnicas. **Corrección UX posterior:** ahora las presenta como 2 tarjetas de servicio (P3 y P4), cada una con los grupos «Neumático que sale» y «Neumático que entra», más el origen visible. |
| 4 | **OK** | Orden completada a 2.145.001 km con 4 ejecuciones persistentes y trazabilidad de `Operario Móvil Bus 01`. |
| 5 | **OK** | La base contiene salida e ingreso para P3 y P4. `25324` sale de P3 y entra en P4; `25311` sale de P4 y entra en P3. No queda ninguno de esos cascos sin registro de salida. |
| 6 | **OK** | Servicios devuelve 2 filas de rotación: P3 y P4, ambas con pareo exacto; no hay instalación fantasma. |
| 7 | **OK** | Origen cruzado correcto: P3 recibe `25311` desde P4; P4 recibe `25324` desde P3. |
| 8 | **OK** | Scrap P5: sale `25313`, entra `260546`; exactamente 1 servicio `discard`, pareo exacto. |
| 9 | **N/A campo** | La UI actual no ofrece construir una salida incompleta por accidente. La puerta de emisión está cubierta por la suite de `supervisor-order-model`. |
| 10 | **N/A campo** | No se dejó una posición vacía a propósito para no ampliar la suciedad de datos antes de la recarga anunciada. Cubierto por modelo/RPC. |
| 11 | **N/A campo** | No se introdujo un tercer movimiento con código ilegible. El origen externo de `260546` quedó correctamente como «ORIGEN NO DETERMINADO», sin inventarlo. |
| 12 | **OK histórico** | Las filas heredadas siguen siendo parte del conjunto general y no impidieron el filtro ni las agregaciones de 2145. |
| 13 | **N/A campo** | No se cortó la red durante esta captura real para no arriesgar una orden adicional. Persistencia local del borrador cubierta por la app y su suite. |
| 14 | **N/A campo** | No se reenvió manualmente una orden cerrada. La RPC conserva su retorno idempotente `already_completed`; cubierto por SQL previo. |
| 15 | **OK previo / N/A repetición** | El aislamiento bilateral MÓVIL BUS/CIVA ya fue aprobado en Fase 1. Esta ejecución utilizó solo sesiones MÓVIL BUS. |
| 16 | **OK local** | El rol `inspector` muestra bloqueo por rol; cubierto por smoke autenticado anterior. No se repitió con esta orden. |
| 17 | **OK** | App y Servicios funcionaron en navegador real; Servicios refrescó sin reload. La revisión responsive y `prefers-reduced-motion` permanece cubierta por el smoke local. |
| 18 | **OK** | 0 errores de consola y 0 excepciones en las tres superficies; no se imprimieron credenciales ni tokens. |

## 4. Estado observable final

| Tipo | Posición | Sale | Entra | Origen | Pareo |
|---|---:|---|---|---|---|
| Rotación | P3 | `25324` | `25311` | P4 | `exact` |
| Rotación | P4 | `25311` | `25324` | P3 | `exact` |
| Scrap | P5 | `25313` | `260546` | no determinado (inventario externo a la orden) | `exact` |

Pantalla final filtrada por 2145: **3 servicios, 1 unidad, 2 órdenes**, con distribución
**2 rotaciones (66,7 %) + 1 scrap (33,3 %)**.

## 5. Cierre

El defecto que originó la fase no se reprodujo. Los criterios críticos de `task_12` están
aprobados con datos reales y las interfaces normales. No se usó `service_role`, no hubo inserciones
directas y no se modificaron RLS, esquema ni publicación Realtime.

La corrección de presentación solicitada después del campo se verificó con el mismo contrato:
2 tarjetas de servicio, 4 ejecuciones enviadas en orden, origen P4/P3 en rotación y
`RETÉN / INVENTARIO` con datos precargados para el reemplazo.
