# task_07 — Suite, smoke y verificación de extremo a extremo

## 1. Objetivo y resultado observable

Que la fase cierre con evidencia, no con afirmaciones. Ejecutar y **mostrar la salida**, no decir que
pasó.

Resultado observable: las fórmulas por fila quedan fijadas con los valores reales de la planilla;
la agregación y los estados de calidad se recorren en navegador. La comparación productiva de la
225 P3 espera la depuración/recarga limpia decidida en D7.

## 2. Dependencias

Todas las tareas de código: `task_02`, `task_03`, `task_04`, `task_05`, `task_06`.

## 3. Qué correr

```bash
npm run verify              # 8 suites + lint + docs + builds
npm run verify -- --fast    # sin builds, para iterar
```

El piso por suite de `scripts/verify-all.mjs` **se sube en el mismo commit** que agrega pruebas. El
script existe porque una revisión independiente reportó «124 tests verdes» cuando el total real era
385: se había perdido el 68 % de la cobertura sin que nada fallara.

Después del build se revisa `git status --short` sin borrar ni restaurar cambios ajenos. En esta
corrida `app movimientos/dist` no quedó listado.

## 4. Smoke obligatorio

Build y pruebas verdes **no alcanzan** para una pantalla. Se ejecutó un navegador headless con el
adaptador autenticado simulado y conjuntos deterministas:

| Paso | Qué verificar |
|---|---|
| Abrir Rendimiento | Consola limpia. Chip de mes en curso aplicado. |
| Leer las tarjetas | Misma unidad: `130 000 / 8,1 = 16 049,38 km/mm`; etiqueta `Sobre 2 neumáticos`. |
| Proyección | `Ponderado por mm gastado`; 192 592,59 km. |
| Todas inconsistentes | Mensaje explícito; 4 filas visibles con sus motivos; ningún KPI en cero. |
| Escritorio y 390×844 | Sin overflow. |
| Recargar | Filas y estado persisten. |
| Consola | Sin `console.error` ni `pageerror`. |

**`Ctrl+Shift+R`, no F5.** El navegador cachea los módulos JS aparte del HTML; ya hizo parecer dos
veces que un arreglo no funcionaba cuando sí funcionaba.

## 5. Verificación contra la planilla

Prueba unitaria fijada con la 225 P3 y P5 de la inspección del 07/05/26:

| Celda | Planilla | Panel |
|---|---|---|
| Km acumulado | 53 610 | 53 610 |
| RTD consumido | 12,0 | 12,0 |
| % desgaste | 100 % | 100 % |
| Km/mm | 4 468 | 4 468 |
| Km proyectado | 53 610 | 53 610 |
| $/Km | 0,0018 proyectado | 0,0018 realizado en P3; no discrimina D6 |

El renglón total promedio de la planilla no es criterio del panel después de D3: el panel usa
razón de sumas aun para una sola unidad.

La inspección productiva vigente de julio mezcla neumáticos y la P3 de mayo conserva el dato sucio.
Por eso no se presenta el smoke simulado como prueba de campo ni como reconciliación productiva.

## 6. Criterio de cierre

- [x] `npm run verify`: 411 pruebas, lint, docs y builds en verde.
- [x] Smoke automatizado: todos los controles de §4 pasan.
- [x] Tabla por fila completada; límite de D6 y espera de recarga D7 declarados.
- [x] `app movimientos/dist` no aparece en `git status --short`.

## 7. Trampa

**Rendimiento tarda en cargar** tras un hard reload y el screenshot puede fallar con «script
injection timed out». Esperar y reintentar; no asumir que se rompió.
