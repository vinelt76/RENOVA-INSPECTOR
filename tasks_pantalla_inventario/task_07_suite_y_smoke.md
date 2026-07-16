# task_07 — Suite integral y smoke de navegador

## 1. Propietario

**CODEX.**

## 2. Objetivo y resultado observable

Probar en conjunto datos/modelo/UI/navegación y verificar con una sesión real controlada que los
resultados de Movimientos aparecen en Retén y Descartados.

## 3. Dependencias y bloqueos

Depende de `task_06`. Bloquea `task_08`.

## 4. Archivos exclusivos

- `WEB/inventario/__tests__/integration.test.js`
- `tasks_pantalla_inventario/PRUEBA_CAMPO.md`, solo si se ejecuta el smoke autenticado

Todo `WEB/inventario/*.js|css|html` y demás HTML son solo lectura. Un fallo vuelve a task 04, 05 o
06; esta tarea no corrige producción.

## 5. Suite automatizada

Con módulos reales y mocks de `fetchView`:

- 0/1/N filas en ambas fuentes;
- normalización + filtros + orden + conteos;
- installed excluido, descartado incluido, conjuntos disjuntos;
- no autorizado, red, respuesta inválida y reintento;
- dos recargas sucesivas sin estado obsoleto ni mutación.

No usar jsdom como sustituto del smoke; Vitest sigue en `node`.

## 6. Smoke local de navegador

- carga y navegación desde cada pantalla;
- tabs por click y teclado (flechas, Home/End, Tab);
- foco visible y anuncios;
- búsqueda/filtros y limpieza;
- estados loading, vacío, error y retry mediante fixture;
- 390×844 y escritorio; cero overflow;
- historial con código escapado;
- consola 0 errores de aplicación.

## 7. Verificación autenticada de lectura

Antes de cualquier escritura, confirmar:

- las dos vistas responden con la forma mínima;
- sesión A solo ve empresa A;
- sesión B o una consulta cruzada controlada no ve A;
- `anon` no obtiene inventario protegido;
- no se imprimen tokens, sesiones, URLs de foto ni filas completas.

Si `v_inventory_status` contradice el contrato, detener y marcar bloqueo. No ejecutar escrituras.

## 8. Recorrido controlado de dominio

Solo con autorización humana explícita y unidad QA acordada:

1. tomar foto/conteo previo;
2. confirmar desde Movimientos un `send_to_retention`;
3. confirmar un `discard` con evidencia conforme al flujo vigente;
4. abrir/recargar Inventario;
5. probar que el primer ciclo aparece en Retén y no en Descartados;
6. probar que el segundo casco aparece en Descartados y no en Retén;
7. recargar y, si es viable, observar Realtime;
8. limpiar/restaurar solo según procedimiento QA acordado y registrar residuo.

Nunca operar una unidad arbitraria de cliente. Si no hay autorización/fixture, el smoke de
escritura queda pendiente y la fase no recibe veredicto APTO.

## 9. Criterios de aceptación

- Suite completa verde.
- Contrato real compatible.
- Aislamiento por empresa.
- Dos transiciones de dominio verificadas y disjuntas.
- Persistencia tras recarga/Realtime.
- Accesibilidad y responsive aprobados.
- Consola limpia y sin secretos.

## 10. Comandos

```bash
cd WEB/inventario
npm test
cd ../..
npm run docs:check
git diff --check
```

Servir `WEB/` por HTTP para el navegador; no abrir `file://` como evidencia final.

## 11. Rollback/limpieza

La suite local no deja estado. La escritura real usa el procedimiento de la unidad QA; documentar
qué se limpió y qué quedó intencionalmente. No borrar historia directamente para “dejar verde”.

## 12. Handoff

Fila 07 con matriz caso→resultado, comandos, viewports, usuario/empresa anonimizados, IDs de QA
solo si ya son públicos en el repo, conteo de consola y residuo. Enlazar `PRUEBA_CAMPO.md`.
