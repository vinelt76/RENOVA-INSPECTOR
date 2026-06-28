# Task 03 — Portar las 4 pantallas conectadas a la data layer

## Objetivo
Convertir los 4 prototipos de `/UI` en pantallas reales de la app, enrutadas y conectadas a
SQLite (task 02). En este task se portan **fieles al prototipo** (los 4 cambios pedidos se aplican
en task 04). La única diferencia funcional que SÍ entra aquí: la empresa se elige al inicio,
queda fija, y es **cambiable**.

## Contexto
- Depende de task 02 (data layer lista).
- Prototipos fuente (referencia visual y de comportamiento, NO se importan literal — se portan a TS):
  - `/UI/renova_home_v2.jsx` → pantalla **Empresa** (paso 1).
  - `/UI/renova_unidad_v4.tsx` → pantalla **Unidad** (paso 2).
  - `/UI/renova_inspeccion_v4.jsx` → pantalla **Inspección (Formulario)** (paso 3).
  - `/UI/renova_grilla_v1.jsx` → pantalla **Inspección (Grilla)**.
- Usar los tokens de `src/theme.ts` (task 01). Conservar el look (marco de teléfono, colores,
  fuente MONO, tamaños). Mantener los `minHeight: 44` de touch targets.

## Pasos

### A. Estado compartido (`src/state/`)
- Estado global liviano (Context o store simple) con: `empresaId` seleccionada, `unidad` activa,
  `cabeceraId` de la inspección en curso.
- `empresaId` **persiste** (en SQLite o localStorage). Al abrir la app, si ya hay empresa, saltar
  directo a la pantalla de Unidad; igual debe poder **cambiarse** (ver D).

### B. Router (`App.tsx`)
Rutas: `/empresa` → `/unidad` → `/inspeccion/:cabeceraId`. La selección de empresa solo se ve al
inicio; luego el flujo entra en Unidad → Inspección.

### C. Pantalla Empresa (de `renova_home_v2`)
- Lista de empresas desde `catalogoRepo`/`empresaRepo` (NO el array hardcodeado del prototipo:
  leer de SQLite). Mantener el acordeón, la tarjeta amarilla con la fecha de hoy y el CTA
  "COMENZAR INSPECCIÓN".
- Al elegir empresa + CTA → guardar `empresaId` en estado y navegar a `/unidad`.

### D. Cambiar de empresa
- En la barra superior de Unidad/Inspección (donde el prototipo muestra "Móvil Bus") agregar un
  control para **cambiar de empresa** (vuelve a `/empresa`). Requisito explícito de Facundo: la
  empresa queda fija tras elegirla pero debe poder cambiarse "si pasa algo".

### E. Pantalla Unidad (de `renova_unidad_v4`) — con autocompletado
- **Buscador con autocompletado inteligente** (NO match exacto): a medida que el inspector
  escribe, llamar `unidadRepo.search(empresaId, q)` y mostrar un **dropdown de coincidencias**
  (las que empiezan por lo tecleado; ej. escribir `2` → `2139, 2159, 217…`). El inspector
  **elige una de la lista** — no tiene que acordarse del número/placa completo.
  - Al **seleccionar** una unidad existente → cargar su última inspección
    (`unidadRepo.getUltimaInspeccion`): banner "ÚLTIMA INSPECCIÓN" con fecha + odómetro previo;
    campo "ODÓMETRO ACTUAL"; aviso si el km es menor al anterior; CTA "CONTINUAR INSPECCIÓN".
  - Si **no hay coincidencias** para lo tecleado → opción "Registrar unidad nueva": banner
    "UNIDAD NUEVA"; "ODÓMETRO INICIAL" + selector de CONFIGURACIÓN (desde `cat_configuracion`,
    solo `mvp=true`); CTA "CREAR UNIDAD".
- Mantener el look del prototipo (campo de búsqueda con ícono de lupa, banners navy/naranja); el
  dropdown de sugerencias es el cambio respecto al prototipo, que exigía número exacto.
- Al confirmar (continuar o crear): `unidadRepo.upsert(...)`, `inspeccionRepo.crearCabecera(...)`
  (genera UUID, guarda empresa/unidad/fecha/odómetro), navegar a `/inspeccion/:cabeceraId`.
- (El botón "Tomar foto" debajo del odómetro llega en task 04 — aquí no.)

### F. Pantalla Inspección — Formulario (de `renova_inspeccion_v4`)
- Portar fiel: hero de Código, sheet "Datos del neumático" (marca→modelo dependiente, reencauche
  opcional, medida), Remanente R1–R4, Presión + Válvula, Anomalía, botón `POS.` que abre el
  "carrito panorámico" (mapa de la unidad para saltar de llanta), y **por ahora conservar** el CTA
  inferior "GUARDAR Y SIGUIENTE / GUARDAR Y FINALIZAR" tal cual (se quita en task 04).
- Las posiciones y su layout se derivan de `cat_configuracion` de la unidad activa (no del `POS`
  hardcodeado: leer de la DB; para BUS 2-4-2 deben coincidir con el prototipo).
- Autoguardado: cada cambio llama `inspeccionRepo.upsertNeumatico(...)` (que recalcula derivados).
  Mantener el "✓ Guardado" efímero del prototipo.
- Los selects (marca, modelo, medida, válvula, anomalía) leen del catálogo en SQLite.

### G. Pantalla Inspección — Grilla (de `renova_grilla_v1`)
- Portar fiel: cabecera de columnas R1–R4 + PSI, filas por llanta con barra de estado lateral,
  sheet de detalle por llanta (código, datos, válvula, anomalía), botón inferior "FINALIZAR".
- **Conservar por ahora** el orden de filas del prototipo (`[1,3,4,7,8,6,5,2]`); se normaliza en
  task 04.
- Misma data layer: lee/escribe `inspeccion_neumatico` de la misma cabecera. Autoguardado por celda.

> En este task Formulario y Grilla pueden vivir como dos rutas/vistas separadas; en task 04 se
> unifican bajo un toggle compartiendo la misma cabecera.

## Criterios de aceptación
- Flujo completo en navegador: `/empresa` (lista desde DB) → `/unidad` (buscar/crear) →
  `/inspeccion/:id`, persistiendo en SQLite.
- El buscador de unidad **autocompleta**: teclear un prefijo (ej. `2`) muestra un dropdown con
  las unidades reales que empiezan así; elegir una carga su última inspección real (seed).
- Recargar la página **conserva** los datos (cabecera + neumáticos + empresa elegida).
- Cambiar de empresa funciona desde la barra superior.
- Marca→modelo es dependiente y sale del catálogo en DB; ningún catálogo está hardcodeado en los
  componentes.
- Formulario y Grilla editan datos reales de la misma inspección.

## Cómo verificar
```bash
cd app && npm run dev
# 1) Elegir empresa → Comenzar.
# 2) Buscar una unidad existente (seed) y una nueva; crear/continuar.
# 3) En Formulario: capturar código, datos, R1–R4, presión, anomalía → ver "✓ Guardado".
# 4) Recargar: los datos siguen ahí.
# 5) Abrir la Grilla de la misma unidad: refleja lo capturado.
# 6) Cambiar de empresa desde la barra superior.
npm run build   # verde
```

## Fuera de alcance
- Los 4 cambios (toggle unificado, orden 1→8, quitar "Guardar y siguiente", botón foto): task 04.
- Semáforo RTD en vivo, fotos en anomalías, login, sync, reporte Excel.
