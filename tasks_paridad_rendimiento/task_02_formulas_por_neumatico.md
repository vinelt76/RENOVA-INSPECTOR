# task_02 — Fórmulas por neumático en el panel

## 1. Objetivo y resultado observable

Que `computeTire()` produzca los mismos números que la planilla de RENOVA para el mismo neumático.

Resultado observable: con los datos de la fila 225 P3 de la planilla (inspección 07/05/26), el panel
muestra **100 % de desgaste**, no 75 %. Y una prueba fija las seis fórmulas contra las celdas reales.

Es la tarea con consecuencia operativa directa: hoy un neumático **en el umbral de retiro** se
muestra al 75 %, como si le quedara un cuarto de vida.

## 2. Dependencias y bloqueos

Depende de `task_01`. Bloquea `task_03` y `task_04`.

**Un bloqueo parcial permanece:**

| Parte | Estado | Bloqueo |
|---|---|---|
| `% desgaste` sobre profundidad útil | **Libre** — evidencia sólida | — |
| Base `otd` | **Resuelta e implementada** | D1 |
| `Costo/Km` sobre km proyectado | **Bloqueada** | D6 |

D1 fue resuelta por el dueño: el OTD pertenece al ciclo y no cambia al rotar o trasladar el
neumático. D6 continúa abierta, por lo que Costo/Km conserva la definición realizada.

## 3. Archivos exclusivos

- `WEB/rendimiento.html` — solo el bloque de cálculo (`computeTire`) y el comentario de fórmulas de
  la cabecera
- `WEB/rendimiento/__tests__/computeGroup.test.js`

Solo lectura: `CONTRATOS_DATOS.md`, `supabase/views_demo.sql`.

**No tocar** `computeGroup` en esta tarea: es `task_04`. Si al cambiar `computeTire` alguna
agregación queda inconsistente, se anota y se resuelve allá, no acá.

## 4. Qué implementar

Según `CONTRATOS_DATOS.md` §2:

```js
// D1: OTD, RTD gastado y km acumulado pertenecen al ciclo actual.
const utilMm       = t.rtdRetiro == null ? null : (t.otd - t.rtdRetiro);
const tieneUtil    = utilMm != null && utilMm > 0;
const rtdGastado   = t.otd - t.rtdActual;
const kmCiclo      = t.kmCicloAcumulado;
const pctConsumo   = tieneUtil ? (rtdGastado / utilMm) * 100 : null;   // ← lo que cambia
const kmProyectado = tieneUtil ? kmMm * utilMm : null;                 // ← mismo valor que hoy,
                                                                       //   pero ya sin el bug de §9
const costoKm      = ...;                                              // ← intacto hasta D6
```

`utilMm` viaja en el resultado de `computeTire` para que `task_04` pueda hacer la razón de sumas del
desgaste sin despejarlo del porcentaje.

D1 queda fijada por pruebas discriminantes con `rtdInstalacion < otd`.

## 5. Reglas que no se pueden tocar

- `null` **nunca** se sustituye por `0`. Sin `rtdRetiro` el porcentaje y la proyección son `null`,
  pero `Km/mm` sigue válido: el ritmo se conoce aunque no se sepa hasta dónde proyectarlo.
- `rtdRetiro` sigue viniendo de los datos (`rtd_thresholds`), nunca hardcodeado.
- La condición de validez del neumático (`rtdGastado > 0 && kmRecorrido > 0`) **no cambia**.
- Un costo ausente no es S/ 0.

## 6. Pruebas obligatorias

Con los valores reales de la planilla (`AUDIT.md` §1), no con números inventados:

| Prueba | Esperado |
|---|---|
| `% desgaste` de la 225 P3 (RTD mín 4, inicial 16, retiro 4) | 100 % |
| `% desgaste` de la 225 P5 (RTD mín 10) | 50 % |
| `Km/mm` de P3 y P5 | 4 468 y 8 935 |
| `Km proyectado` de P3 y P5 | 53 610 y 107 220 |
| Sin `rtdRetiro` | `% desgaste` y proyectado en `null`; `Km/mm` con valor |

**Pruebas discriminantes de D1:**

| Prueba | Esperado |
|---|---|
| Casco montado usado (inicial 12, OTD 16) | proyecta sobre 12 mm útiles, no sobre 8 |
| `Km ciclo + VUR` | igual a `Km proyectado` |

Son el único caso donde OTD y RTD inicial se separan. Hoy no existe en los datos productivos, por
eso se cubre de forma sintética.

## 7. Efecto esperado en pantalla

Con el alcance recortado y el alcance por defecto de hoy (4 neumáticos de la 225):

| Métrica | Antes | Después |
|---|---|---|
| Consumo | 26,6 % | **35,4 %** |
| Km/mm, Km Proyectado, Costo/km, VUR | — | **sin cambio** |

Es decir: **esta tarea mueve un solo número.** Y es el que hace que un neumático en el umbral de
retiro deje de leerse como si le quedara un cuarto de vida.

Cuando D6 se resuelva a favor: **Costo/km S/ 0,0012 → S/ 0,0005**.

## 8. Criterio de cierre

- [x] Las pruebas de §6 y las dos discriminantes de D1 están en verde.
- [x] `npm run verify -- --fast` en verde, con el piso de `WEB/rendimiento` actualizado en el mismo
      commit (`scripts/verify-all.mjs` lo pide explícitamente).
- [x] Smoke automatizado con sesión/datos simulados: consola limpia y recarga persistente.
- [x] El comentario de fórmulas de la cabecera de `rendimiento.html` refleja lo implementado.

## 9. Trampas

- **`Ctrl+Shift+R`.** El navegador cachea los módulos JS aparte del HTML; un `?v=2` no los busta.
- **`t.otd - t.rtdRetiro` con `rtdRetiro` en `null`** hoy da `otd - 0 = otd` en vez de fallar. Es un
  bug latente que esta tarea cierra; no reproducirlo con `utilMm`.
- **El detalle por eje** (`computeAxle`) consume las mismas métricas. Verificar que sus tarjetas
  sigan teniendo sentido, aunque su estadística la decida `task_04`.
