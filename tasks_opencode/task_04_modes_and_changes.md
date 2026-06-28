# Task 04 — Toggle Formulario/Grilla + los 4 cambios pedidos

## Objetivo
Aplicar los 4 cambios que pidió Facundo sobre las pantallas portadas en task 03, y dejar la app
**lista para generar el APK** (sin generarlo). Estos cambios son el corazón de la prueba del flujo.

## Contexto
- Depende de task 03 (APROBADO). Estado real tras task 03 (no asumir el prototipo):
  - Hay **dos rutas separadas**: `/inspeccion/:cabeceraId` (Formulario) y `/grilla/:cabeceraId`
    (Grilla), ambas leyendo/escribiendo la misma `inspeccion_cabecera` vía `inspeccionRepo`.
  - La **Grilla ya deriva sus filas de `cat_configuracion`** (`FILAS = configPos.map(c => c.posicion)`),
    NO del array hardcodeado del prototipo.
  - El **mapa panorámico ya es dinámico** (se genera desde `configPos` agrupado por eje) y muestra
    "X / N listas" (N = nº de posiciones de la config, no fijo en 8).
  - `inspeccionRepo.crearCabecera(empresa_id, numero_unidad, fecha, km_odometro, foto_unidad?)` ya
    acepta `foto_unidad`.
- Prototipos de referencia visual: `/UI/renova_inspeccion_v4.jsx`, `/UI/renova_grilla_v1.jsx`.

## Cambios

### 1. Toggle Formulario ↔ Grilla EN VIVO (decisión de Facundo: opción A)
Unificar las dos rutas separadas de hoy (`/inspeccion/:cabeceraId` y `/grilla/:cabeceraId`) en
**una sola pantalla** de inspección con un **toggle segmentado EN VIVO** en la barra superior:
`Formulario | Grilla`. Default: **Formulario**.
- **En vivo:** el inspector cambia de vista cuando quiera, **sin salir ni recargar**, y siempre
  sobre la **misma cabecera** y los mismos `inspeccion_neumatico`. Lo que captura en un modo se ve
  inmediatamente en el otro (mismo estado/DB).
- Implementación sugerida: una `InspeccionScreen` que tiene `modo: 'form' | 'grilla'` en estado y
  renderiza el cuerpo Formulario o Grilla según el toggle, compartiendo la carga de neumáticos.
  Consolidar la ruta en `/inspeccion/:cabeceraId` (la `/grilla/:cabeceraId` puede eliminarse o
  redirigir). NO duplicar la lógica de datos: un solo origen (`inspeccionRepo`) para ambos.
- La última vista elegida puede recordarse en `localStorage`, pero el toggle siempre está visible.

**Estructura de archivos (decisión de Facundo — el archivo actual ~665 líneas es muy grande):**
dividir en `src/screens/inspeccion/`:
- `InspeccionScreen.tsx` → **orquestador**. Aquí vive el **estado y los datos compartidos**: carga
  de `inspeccionRepo.listNeumaticos`, el `store`, `configPos`, los catálogos, los handlers de
  guardado/finalizar, y el `modo: 'form' | 'grilla'` + el toggle. Monta `FormBody` o `GrillaBody`.
- `FormBody.tsx` y `GrillaBody.tsx` → **componentes presentacionales**. Reciben datos y callbacks
  **por props** desde el orquestador. **NO** deben cargar/poseer su propia copia de los neumáticos
  ni abrir la DB por su cuenta — un **único origen de datos** en el orquestador. (Esto es lo que
  garantiza que el toggle en vivo no desincronice ambos modos.)
- Esto reemplaza/absorbe la nota pendiente de "código repetido entre screens / `src/components/`".

### 2. Grilla en orden normal 1→8 (ascendente por posición)
Las filas de la Grilla deben ir en orden **ascendente por `posicion`** (1,2,3,…), no en recorrido
físico de caminata.
- La Grilla ya deriva `FILAS` de `cat_configuracion`. Asegurar que ese listado quede **ordenado
  por `posicion` ascendente** (ordenar `configPos`/`FILAS` por `posicion`, o que
  `catalogoRepo.configuracion` haga `ORDER BY posicion`). Para 2-4-2 → `[1..8]`; para 2-4 → `[1..6]`.
- Verificar que NO se reintroduzca el orden de caminata `[1,3,4,7,8,6,5,2]`.
- Las etiquetas por posición (derivadas de `tipo_eje`/`lado`) se mantienen; solo importa el orden.

### 3. Formulario sin "Guardar y siguiente" (navegación por selección)
En el Formulario, **quitar el CTA inferior** "GUARDAR Y SIGUIENTE → POS. N" / "GUARDAR Y
FINALIZAR" (`renova_inspeccion_v4.jsx` líneas 333–339).
- La navegación entre posiciones queda **solo por selección**: el botón `POS.` de la barra abre el
  carrito panorámico (mapa de la unidad) y el inspector toca la llanta que quiere inspeccionar.
  Eso ya existe en el prototipo (`switchPos`); mantenerlo.
- Los datos **ya se autoguardan** en cada cambio, así que "Guardar" era redundante.
- **Finalizar:** como se quita el CTA, mover la acción **"Finalizar inspección"** al sheet del
  carrito panorámico (el mapa, que ya muestra "X / N listas", N según la config). Debe servir a
  **ambos** modos (Formulario y Grilla comparten ese cierre). En la Grilla, el botón inferior
  "FINALIZAR" puede permanecer o delegar al mismo flujo — mantener un único `finalizar()`.
- Al finalizar: marcar la inspección y volver al flujo de Unidad/Empresa (no implementar sync).

### 4. Botón "Tomar foto" debajo del odómetro (pantalla Unidad)
En la pantalla **Unidad** (`renova_unidad_v4`), agregar un botón **"Tomar foto"** **debajo del
campo de odómetro**, en ambos estados:
- estado **match** → debajo de "ODÓMETRO ACTUAL".
- estado **unidad nueva** → debajo de "ODÓMETRO INICIAL".
- Usa **Capacitor Camera** (`@capacitor/camera`) para capturar; en web (dev) cae a `<input
  type="file" accept="image/*" capture>` como fallback.
- Mostrar miniatura de la foto tomada y permitir reemplazarla.
- Al crear la cabecera, guardar la referencia en `inspeccion_cabecera.foto_unidad` (ruta/base64
  según corrija el repo; para el lote local basta guardar el dataURL o el filePath de Capacitor).

## Criterios de aceptación
- En `/inspeccion/:id` hay un toggle EN VIVO `Formulario | Grilla`; alternar **no** pierde datos,
  no recarga, y ambos modos reflejan los mismos valores de la misma cabecera (un solo origen de
  datos). La ruta `/grilla/:id` queda consolidada/redirigida.
- Estructura: `InspeccionScreen.tsx` (orquestador, dueño del estado/datos) + `FormBody.tsx` +
  `GrillaBody.tsx` (presentacionales, reciben todo por props; no abren la DB por su cuenta).
- La Grilla muestra las filas en orden ascendente por posición (2-4-2 → 1..8, 2-4 → 1..6); nunca
  el orden de caminata.
- El Formulario **no** tiene el botón "Guardar y siguiente"; se navega por el botón `POS.` (mapa);
  "Finalizar inspección" está en el sheet del mapa y cierra la inspección en ambos modos.
- En Unidad, debajo del odómetro (match y nueva), el botón "Tomar foto" captura y muestra
  miniatura; la foto queda persistida en `inspeccion_cabecera.foto_unidad`.
- `npm run build` verde. El proyecto queda listo para `npx cap add android && npx cap sync`
  (documentado en `app/README.md`), **sin** generar el APK.

## Cómo verificar
```bash
cd app && npm run dev
# 1) Unidad: tomar foto debajo del odómetro (en web usa el file picker) → ver miniatura.
# 2) Entrar a inspección: alternar Formulario/Grilla, comprobar que comparten datos.
# 3) Grilla: filas en orden 1..8.
# 4) Formulario: sin botón "Guardar y siguiente"; navegar por el botón POS; finalizar desde el mapa.
npm run build   # verde
npx cap sync    # sin error
```

## Fuera de alcance
- Generar el APK (lo decide Facundo tras el review de Opus).
- Fotos en anomalías del neumático, semáforo en vivo, login, sync con servidor, reporte Excel.
