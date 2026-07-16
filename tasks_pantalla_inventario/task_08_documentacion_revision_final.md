# task_08 — Documentación y revisión cruzada final

## 1. Propietario

**CLAUDE**, como revisor distinto del implementador.

## 2. Objetivo y resultado observable

Contrastar la entrega contra contratos, pruebas, seguridad y diseño; actualizar conocimiento
canónico y emitir `REVISION_FINAL.md` con un veredicto basado en evidencia.

## 3. Dependencias

Depende de `task_07`. Cierra la fase.

## 4. Archivos exclusivos

- `tasks_pantalla_inventario/REVISION_FINAL.md`
- columna Revisión de `tasks_pantalla_inventario/STATE.md`
- `knowledge/ai/02 - Estado actual.md`
- `knowledge/ai/05 - Datos y Supabase.md`
- `knowledge/ai/07 - Web dashboards y taller.md`
- `knowledge/ai/09 - Diseno y UX.md` solo si la pantalla introduce un patrón reutilizable
- `knowledge/ai/10 - Roadmap deuda y riesgos.md`
- `knowledge/human/GUIA RENOVA/05 - Tableros inventario y taller.md`

Producción y tests son solo lectura. Hallazgos vuelven al dueño; el revisor no los corrige.

## 5. Checklist de revisión

1. Retén coincide con `v_tire_inventory_available`.
2. Descartados contiene solo `inventory_status='discarded'`.
3. Conjuntos disjuntos; instalados ausentes.
4. Empresa A/B y anon verificados.
5. Ningún archivo en `supabase/` cambió.
6. Sin acciones eliminadas restauradas.
7. Datos remotos renderizados de forma segura; foto no expuesta.
8. Navegación consistente y sin rutas rotas.
9. Teclado, foco, 390×844/escritorio y estados de error.
10. Retén/descarte reales de QA visibles tras recarga.
11. Consola limpia, sin secretos.
12. Vitest, `docs:check` y `git diff --check` verdes.

## 6. Documentación

Actualizar `updated`, `sources` y estado según `knowledge/ai/14`. Registrar que la decisión previa
de retirar Inventario fue reemplazada por una pantalla nueva y limitada; no reescribir la historia.
Explicar en lenguaje humano que Retén es montable y Descartados es final.

## 7. Veredicto

- **APTO**: todos los criterios y smoke real pasan.
- **APTO CON DEUDA ABIERTA**: solo observaciones no bloqueantes, enumeradas con dueño.
- **NO APTO**: contrato, seguridad, transición real, accesibilidad o regresión falla.

No usar APTO si faltó autorización/fixture para las dos transiciones reales.

## 8. Comandos

Reejecutar de forma independiente:

```bash
cd WEB/inventario && npm test
cd ../.. && npm run docs:check
git diff --check
git diff --name-only
```

Repetir el smoke crítico de navegador, no confiar solo en el handoff.

## 9. Rollback

Si NO APTO, retirar enlaces públicos o mantener la pantalla sin publicar hasta corregir. No tocar
datos/esquema. Documentar cualquier residuo QA.

## 10. Handoff final

Completar `REVISION_FINAL.md`, actualizar fila 08 y resumir archivos, pruebas, evidencia, deudas y
próximo paso. La fase queda cerrada solo con un veredicto explícito.
