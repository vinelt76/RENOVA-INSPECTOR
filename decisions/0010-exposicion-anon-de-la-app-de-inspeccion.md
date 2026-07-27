# ADR-0010 — La app de inspección opera como `anon`: riesgo asumido y camino de salida

- **Fecha:** 2026-07-25
- **Estado:** Aceptada (riesgo asumido para la etapa piloto)
- **Contexto de origen:** `auditoria_lunes/` — hallazgo H-01
- **Decisión pendiente relacionada:** «estrategia final de login/sesión offline para inspectores»

## Hecho verificado

`anon` tiene `EXECUTE` sobre tres RPC `SECURITY DEFINER`, que por definición **no pasan por RLS**:

| RPC | Qué expone |
|---|---|
| `get_unidad_preload(company_name, plate)` | Identidad, RTD, presión y anomalías de cada neumático de una unidad |
| `get_umbrales_rtd(company_name)` | Umbrales RTD de la empresa |
| `save_inspection(payload)` | **Escritura**: crea inspecciones; resuelve la empresa **por nombre** desde el payload |

Ejecutado contra producción el 2026-07-25, sin ninguna sesión:

```sql
set local role anon;
select count(*) from public.get_unidad_preload('MÓVIL BUS', '2145');  -- → 14 filas
select count(*) from public.get_umbrales_rtd('CIVA');                 -- → 1 fila
```

La clave publicable está commiteada en `WEB/supabase-config.public.js` y se copia al bundle
estático. El requisito para leer datos de un cliente es «tener la URL del dashboard».

El gate `RenovaSupabase.requireAuth()` de los dashboards **no protege esto**: cierra la puerta de
la UI, no la de la API.

## Por qué no se puede simplemente revocar

La app de inspección **no tiene login**. Revocar `anon` la deja sin poder sincronizar: los
inspectores capturarían en campo y nada llegaría a Supabase. Es la deuda madre ya registrada en el
roadmap («la app móvil de inspecciones opera como `anon`, sin identidad de inspector»).

## Mitigaciones evaluadas y descartadas

Se evaluó «acotar las RPC sin tocar la autenticación». **No existe tal cosa**, y conviene dejarlo
escrito para que nadie vuelva a proponerlo creyendo que resuelve algo:

- **Limitar `get_unidad_preload` a la última inspección** (hoy devuelve el historial completo, y la
  app descarta todo lo demás del lado del cliente). Medido: reduce la exposición de 2 247 a 2 125
  filas, un **5.4 %**. Es una mejora de eficiencia razonable por mérito propio, **no una
  mitigación de seguridad**.
- **Exigir que la empresa no viaje por nombre**: no cambia nada. Sin identidad, cualquier
  identificador que el cliente envíe es igual de adivinable.
- **Dificultar la enumeración de placas**: las placas son cortas y numéricas (`225`, `2145`,
  `5028`). Enumerarlas es trivial.

Sin un límite de autenticación, cualquier restricción es cosmética.

## Decisión

**Se asume el riesgo para la etapa piloto**, con dos condiciones explícitas:

1. **No afirmar que los datos exigen autenticación.** Ni en una demo, ni en documentación, ni ante
   un cliente. Hoy no es cierto.
2. **Cerrarlo antes de operar con datos de más de un cliente real en volumen.** El riesgo crece con
   cada empresa incorporada.

## Camino de salida recomendado: cuenta de dispositivo

La opción con mejor relación costo/beneficio **no es agregar una pantalla de login al inspector**,
sino una **cuenta de dispositivo por empresa**:

- El APK se distribuye con credenciales de una cuenta Auth dedicada por empresa.
- La app inicia sesión en silencio la primera vez; `persistSession` + refresh token la mantienen
  operativa **sin conexión**, exactamente como ya funciona `app movimientos/`.
- `anon` queda sin `EXECUTE` sobre las tres RPC.
- Sin cambio de UX para el inspector: no ve pantalla de login.

Limitaciones honestas: las credenciales viajan dentro del APK y alguien decidido puede
extraerlas. Pero es un límite de autenticación real —revocable, rotable y acotado por empresa vía
RLS— y no una llave pública publicada en un bundle web. Es una mejora de grado, no una solución
definitiva.

La solución definitiva sigue siendo **identidad de inspector**, que además resuelve el otro
problema abierto: hoy `inspections.inspector_id` queda vacío y los dashboards muestran «INSPECTOR:
SIN DATO». Eso exige decidir la estrategia de sesión offline, que es la decisión bloqueante ya
registrada.

## Consecuencias

- El hallazgo queda documentado y con dueño, no silenciado.
- `knowledge/ai/08 - Infraestructura seguridad y despliegue.md` debe reflejar que los datos de
  flota son legibles sin sesión, para que ninguna nota afirme lo contrario.
- La deuda «estrategia final de login/sesión offline para inspectores» pasa de decisión abierta a
  decisión **con opción recomendada** (cuenta de dispositivo) y un criterio de disparo (antes de
  volumen multi-cliente real).
