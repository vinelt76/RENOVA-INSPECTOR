# PLAN — Pantalla de Inventario · Retén y Descartados

Fecha: 2026-07-15. Basado en `AUDIT.md`, `DECISIONES.md` y `CONTRATOS_DATOS.md`.

## 1. Resultado funcional

Agregar `WEB/inventario.html` como pantalla autenticada de consulta con dos pestañas:

1. **Retén** lista ciclos activos fuera de una unidad y montables.
2. **Descartados** lista cascos dados de baja definitivamente.

Cuando Movimientos confirma retén o descarte, la pantalla refleja el resultado al recargar o por
Realtime. No se agrega lógica de escritura.

## 2. Arquitectura

```text
Supabase
  v_tire_inventory_available ──▶ data.js ──┐
  v_inventory_status          ──▶ data.js ──┼─▶ inventory-model.js
                                             │
                                             ▼
inventario.html ◀── inventory-controller.js + inventario.css
       │
       └── historial-neumatico.html?serie=…&from=inventario
```

Archivos nuevos previstos:

- `WEB/inventario.html`: estructura semántica, carga de dependencias y contenedores.
- `WEB/inventario/data.js`: loaders y adaptadores; sin DOM.
- `WEB/inventario/inventory-model.js`: partición, búsqueda, filtros, orden y conteos; puro.
- `WEB/inventario/inventory-controller.js`: sesión, estado, render, tabs y Realtime.
- `WEB/inventario/inventario.css`: estilos propios sobre `renova-office-shell.css`.
- `WEB/inventario/__tests__/*.test.js`: pruebas puras/integración sin red.

No importar `WEB/movimientos/movimientos-controller.js`. Se pueden extraer/reutilizar patrones
puros solo si la tarea propietaria lo permite; no romper el diálogo de montaje.

## 3. Experiencia

- Header RENOVA y navegación compartida.
- Pestañas `Retén` y `Descartados`, cada una con contador.
- Búsqueda por código, marca, modelo, medida, condición y diseño.
- Búsqueda común sin catálogos hardcodeados.
- Cards/lista compacta pero no tabla tipo Excel. El dato principal es código/identidad.
- Retén muestra condición, medida, retiro/antigüedad y RTD cuando existen.
- Descartados muestra causa, fecha y última unidad/posición; “Evidencia registrada” como booleano,
  sin URL ni miniatura.
- Código navegable al historial con `encodeURIComponent`; un código nulo no crea enlace falso.

## 4. Accesibilidad y responsive

- `role=tablist`, `role=tab`, `role=tabpanel`, `aria-selected`, `aria-controls` y panel asociado.
- Flechas izquierda/derecha, Home/End y activación/foco conforme al patrón elegido.
- Estado activo no depende solo del color; foco visible único.
- Cambios de conteo/error con región viva prudente.
- Objetivos táctiles de al menos 44 px.
- Sin overflow horizontal a 390×844; grilla adaptable en escritorio.
- `prefers-reduced-motion` y sin animaciones decorativas necesarias.

## 5. Seguridad

- Solo configuración publicable y sesión de `supabase-demo.js`.
- Vistas de lectura; no acceso directo a tablas ni RPCs.
- No `service_role`, secretos, token, URL privada ni objeto de sesión en logs.
- Datos remotos mediante `textContent`/creación DOM segura; no interpolar en `innerHTML`.
- `authenticated` no basta por sí solo para aislamiento: la prueba final comprueba empresa A/B.
- Si `v_inventory_status` no cumple el contrato, bloquear; no usar privilegios mayores como parche.

## 6. Realtime y recuperación

Suscribirse a las tablas ya observadas por taller (`tire_installations`, `tire_removals`,
`tire_life_cycles`, `tire_casings`) a través del helper existente. El helper agrupa eventos
cercanos. La recarga conserva la pestaña; un error ofrece reintento seguro.

## 7. Pruebas

Vitest 4.1.9 exacto, entorno `node`, sin red:

- adaptación de las dos fuentes y `NULL` válidos;
- filtro estricto de descartados;
- filas `installed` excluidas;
- conjuntos disjuntos;
- búsqueda acento/caso/tokens;
- orden estable y no mutación;
- carga paralela, 0 filas, error y no autorizado con mocks.

Navegador:

- fixture local para DOM, tabs, filtros, teclado, foco y responsive;
- sesión autenticada de lectura para forma real del contrato y aislamiento;
- escritura controlada exclusivamente mediante la UI existente de Movimientos sobre una unidad QA
  aprobada: un retén y un descarte aparecen en sus pestañas después de confirmar/recargar;
- recarga y Realtime; consola limpia y sin secretos;
- limpieza acordada y documentada.

## 8. Dependencias y propiedad

```text
task_01 (auditoría cerrada)
  ├── task_02 N/A (sin migración)
  └── task_03 N/A (sin aplicación remota)
          │
          ▼
task_04 (datos/modelo/tests puros)
  ▼
task_05 (pantalla/controlador/CSS)
  ▼
task_06 (navegación en HTML vigentes)
  ▼
task_07 (suite integral + smoke)
  ▼
task_08 (docs + revisión cruzada)
```

Las tareas 04–08 son secuenciales. Ninguna tarea concurrente comparte archivo.

## 9. Rollback

Como no hay esquema ni escritura propia, el rollback de producción es estático:

1. retirar enlaces a `inventario.html`;
2. retirar el HTML y módulos nuevos;
3. no tocar vistas, historia ni Movimientos.

Los datos controlados del smoke se limpian según el acuerdo de QA; nunca mediante borrado manual
no auditado.

## 10. Definición de terminado

- Fuentes canónicas y conjuntos disjuntos.
- Retén/descarte de Movimientos visible en la pestaña correcta.
- Sin acciones fuera de alcance.
- Aislamiento por empresa y sesión verificados.
- Estados loading/empty/error/no autorizado/reintento.
- Teclado, foco, 390×844 y escritorio verificados.
- Vitest, bundle, `git diff --check` y `npm run docs:check` verdes.
- Smoke autenticado completado por la persona responsable antes de publicar.
- `REVISION_FINAL.md` registra por separado evidencia local y evidencia de campo.
