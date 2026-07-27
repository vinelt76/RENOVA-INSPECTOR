# Datos verificados para la presentación del lunes 2026-07-27

Toda cifra que aparezca en el deck debe salir de esta tabla. **Si un dato no está acá, no se
escribe en un slide.** Medido el 2026-07-26 contra el proyecto de producción
`fbxupwwgiebhlciqftpw` con consultas de solo lectura, o citado de `knowledge/` y `auditoria_lunes/`.

---

## 1. Volumen operativo (consulta directa a producción, 2026-07-26)

| Dato | Valor | Fuente |
|---|---:|---|
| Empresas | 4 | `select count(*) from companies` |
| Unidades | 269 | `select count(*) from units` |
| Unidades marcadas como prueba | 2 | `units where is_test` |
| Inspecciones | 288 | `select count(*) from inspections` |
| Mediciones de neumático | 2 247 | `inspection_measurements` |
| Mediciones con RTD | 2 241 | `rtd_movi_mm is not null` |
| Mediciones con presión | 2 015 | `pressure_psi is not null` |
| RTD promedio | 9,79 mm | `avg(rtd_movi_mm)` |
| Marcas distintas | 14 | `count(distinct upper(trim(brand_name)))` |
| Medidas distintas | 2 | `count(distinct size_name)` |
| Rango de fechas | 2026-01-10 → 2026-07-15 | `min/max(inspected_on)` |
| Cascos con ciclo | 40 | `tire_casings` |
| Ciclos de vida | 41 | `tire_life_cycles` |
| Instalaciones | 45 | `tire_installations` |
| Órdenes de movimiento | 4 | `tire_movement_orders` |
| Ejecuciones de movimiento | 8 | `tire_movement_executions` |

### Desglose por empresa

| Empresa | Unidades | Inspecciones | Mediciones |
|---|---:|---:|---:|
| CIVA | 107 | 114 | 903 |
| MÓVIL BUS | 98 | 109 | 824 |
| ITTSABUS | 64 | 65 | 520 |
| CRUZ DEL SUR | 0 | 0 | 0 |

> **CRUZ DEL SUR está en cero.** Existe como empresa provisionada pero sin datos cargados. No la
> presentes como flota activa. Sirve para demostrar el aislamiento multiempresa, no la tracción.

---

## 2. Calidad del dato

| Dato | Valor | Fuente |
|---|---:|---|
| Distribución de presión tras ADR-0009 | Normal 1 961 · Sin medir 232 · Alta 35 · Baja 19 | `auditoria_lunes/ESTADO.md` |
| Mediciones con `temperature_mode` nulo | 0 | backfill del 2026-07-25 |
| Variantes de caja en `brand_name` | 13 de 2 247 (~0,6 %) | `knowledge/ai/10` |
| Mediciones sin `life_cycle_id` | 2 183 de 2 247 | `knowledge/ai/10` |

---

## 3. Ingeniería

| Dato | Valor | Fuente |
|---|---:|---|
| Migraciones SQL versionadas | 50 | `supabase/migrations/` |
| Pruebas automatizadas verdes | 385 | `npm run verify`, 2026-07-25 |
| Suites en la verificación | 8 + lint + docs + builds | `auditoria_lunes/ESTADO.md` |
| Pantallas web autenticadas | 7 | `WEB/` |
| Aplicaciones Android | 2 | `app/`, `app movimientos/` |
| ADRs escritos | 11 | `decisions/` |
| PostgreSQL de producción | 17.6 | verificado 2026-07-25 |

---

## 4. Números que **NO** van en un slide

Estos existen y son ciertos, pero el producto los muestra en vivo. Si el deck los repite y la
pantalla dice otra cosa, se pierde credibilidad delante del técnico.

| Dato | Por qué no va impreso |
|---|---|
| KPI km/mm | Cambió tres veces en dos días (138K → 18K → ~7K) por correcciones legítimas de fórmula. Lo muestra Rendimiento en vivo. |
| VUR mediana (156 788 km al 2026-07-25) | Misma razón: se recalcula con cada migración de fórmula. |
| Consumo %, costo/km, km proyectado | Tarjetas vivas de Rendimiento. |
| Posiciones `baseline_pending` | El conteo de referencia era 2 094, pero avanza con cada montaje confirmado. |

**Regla:** el deck aporta contexto y volumen; la pantalla aporta los KPI.

---

## 5. Huecos que debe llenar Facundo antes del lunes

El plan deja estos espacios marcados en el HTML. **No se inventan.**

Los cinco aparecen en el deck como recuadros amarillos punteados con el texto `[COMPLETAR: …]`.
Son imposibles de pasar por alto a propósito: un hueco visible es preferible a un número plausible
y falso.

| Hueco | Slide | Por qué no lo puedo completar |
|---|---|---|
| Horas por semana que consume hoy el control manual | 2 | No hay medición en el repo. Es la cifra más persuasiva del deck: consíguela. |
| Qué ofrece hoy la competencia | 2 | Afirmar capacidades de una empresa real sin evidencia es donde un técnico te desarma. Pon solo lo que puedas sostener. |
| Precio de la suscripción y unidad de cobro | 17 | No existe en el repo. |
| Empresas objetivo del piloto | 17 | Decisión comercial de RENOVA. |
| Fechas de cada etapa del piloto | 17 | Decisión comercial de RENOVA. |

El **ahorro estimado por flota** no tiene marcador propio: solo es derivable una vez que exista el
dato de horas del primer hueco. Si lo consigues, el lugar natural para decirlo es el slide 2, en voz
alta, no un recuadro nuevo.

---

## 6. Qué no afirmar en voz alta

De `auditoria_lunes/GUION_DEMO.md`. Estos van en las notas del presentador (tecla `D`).

- **No decir que los datos exigen autenticación.** Hoy son legibles sin sesión (ADR-0010). Los
  dashboards piden login; la API no.
- **No decir que el IDI está disponible.** Se calcula en el dispositivo y nunca llega a Supabase.
- **No decir que el dashboard conserva el estado histórico con el umbral de su fecha.** Se
  recalcula con el umbral vigente.
- **No decir que existe regla de presión CALIENTE.** Solo está implementado FRÍO.
- **No demostrar `Inspecciones por unidad` desde el teléfono.** Es desktop-only (`min-width: 1280px`).
- **No cambiar umbrales RTD durante la demo.** Reescribe la lectura de inspecciones pasadas en vivo.
- **Movimientos solo se demuestra con MÓVIL BUS.** Es la única empresa con cuenta `operator`; en
  cualquier otra el recorrido se corta a la mitad sin mensaje que lo explique.

---

## 7. Realtime: qué llega solo y qué no

Consultado el 2026-07-26: `select tablename from pg_publication_tables where
pubname='supabase_realtime'` devuelve **exactamente dos tablas**.

| Tabla | ¿Publicada en Realtime? | Efecto en la demo |
|---|---|---|
| `inspections` | **Sí** | La inspección aparece en el tablero al instante |
| `inspection_measurements` | **Sí** | Las mediciones llegan con la inspección |
| `tire_movement_executions` | **No** | Servicios sondea cada 10 s mientras la pestaña está visible |

**Consecuencia operativa:** el viaje de la inspección es instantáneo y el del movimiento tarda hasta
10 segundos. Medido en campo el 2026-07-22: menos de 8 segundos, sin recarga manual y sin parpadeo.

**Si la pestaña de Servicios está en segundo plano, el sondeo no corre.** Dejarla visible.

---

## 8. Montaje antes de entrar a la sala

En orden. Ninguno es opcional.

- [ ] **Recarga dura** (`Ctrl+Shift+R`) en cada pestaña de Chrome. El navegador cachea los módulos
      JS aparte del HTML y muestra datos viejos sin avisar.
- [ ] Sesión iniciada en los dashboards, con **MÓVIL BUS** seleccionada.
- [ ] Pestañas abiertas y en su lugar: `Inspecciones por unidad`, `Rendimiento`, `Servicios`,
      `Movimientos`.
- [ ] App de inspección abierta en el celular, en la unidad que vas a inspeccionar.
- [ ] App del operario abierta y **con sesión iniciada**. No la dejes para el momento.
- [ ] Unidad de demostración elegida de antemano. No busques ejemplos al azar en vivo.
- [ ] Confirmar en pantalla los KPI de Rendimiento: el deck no los imprime, los lees de ahí.
- [ ] Deck abierto en otra ventana, en pantalla completa (`F`).
