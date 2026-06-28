# Análisis de Calidad de Código — RENOVA INSPECTOR

Fecha: 2026-06-27
Alcance: `app/src/` completo (8 componentes, 4 repos, 1 motor de cálculo, 1 DB manager, 1 seed)

---

## Resumen ejecutivo

Tu proyecto tiene una **base arquitectónica sólida**: separación de capas, cálculos puros con tests, schema TypeScript, repo pattern. Para un primer proyecto serio, eso está muy bien.

Los problemas principales son: (1) la capa de base de datos tiene deuda técnica que va a doler cuando tengas datos reales, y (2) los componentes UI son muy grandes y repetitivos, lo que dificulta hacer cambios sin romper cosas.

---

## 1. PROBLEMAS DE BASE DE DATOS (prioridad alta)

### 1.1 Migraciones no versionadas

**Archivo**: `app/src/db/sqlite.ts:66-166`

`runMigrations()` ejecuta un bloque gigante de `CREATE TABLE IF NOT EXISTS`. Esto funciona para arrancar de cero, pero:

- Si mañana necesitás agregar una columna a `inspeccion_neumatico`, no hay forma de aplicar ese cambio a tablas que ya existen con datos.
- No hay tabla de versiones — la app no sabe qué migraciones ya corrió.

**Solución concreta**: crear una tabla `schema_version (version INTEGER PRIMARY KEY)` y envolver cada migración en un `if (currentVersion < N)`:

```sql
-- En runMigrations:
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0);
SELECT version FROM schema_version; -- obtener versión actual

-- Si version < 1: crear tablas iniciales + INSERT 1
-- Si version < 2: ALTER TABLE agregar columna X + UPDATE version = 2
```

Esto es estándar en apps móviles y te va a salvar cuando tengas 500 inspecciones guardadas.

---

### 1.2 Seed corre en CADA startup

**Archivo**: `app/src/db/sqlite.ts:179-188`

```typescript
export function initApp(): Promise<void> {
  if (!initAppPromise) {
    initAppPromise = (async () => {
      const db = await getDb();
      await runMigrations(db);
      await runSeed(); // <-- SIEMPRE corre
    })();
  }
  return initAppPromise;
}
```

`runSeed()` hace ~50+ inserts individuales cada vez que la app arranca. En un celular real eso puede tomar 200-500ms innecesarios.

**Solución**: agregar una tabla `app_meta`:

```sql
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT);
```

Y en `runSeed()`:

```typescript
const result = await db.query("SELECT value FROM app_meta WHERE key = 'seed_version'");
const current = result.values?.[0]?.value ?? '0';
if (parseInt(current) < 1) {
  // ejecutar seed...
  await db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seed_version', '1')");
}
```

---

### 1.3 Schema duplicado (código muerto)

**Archivos**:
- `app/src/db/sqlite.ts:67-166` — DDL que SÍ se ejecuta
- `app/src/db/schema.ts:104-227` — `TABLE_SQL` que NO se ejecuta nunca

`TABLE_SQL` en `schema.ts` exporta el mismo DDL pero no lo usa ninguna función. Si modificás uno y no el otro, tenés un bug silencioso.

**Acción**: eliminar `TABLE_SQL` de `schema.ts` (líneas 104-227). Mantener una sola fuente de verdad.

---

### 1.4 Repo reimplementa cálculos (rompe paridad)

**Archivo**: `app/src/db/repos/inspeccionRepo.ts:78-96`

```typescript
// Lo que hace el repo (líneas 88-92):
rtd_movi = Math.min(...canales);
idi = Math.max(...canales) - Math.min(...canales);
estado_rtd = calcularEstadoRtd(rtd_movi, DEFAULT_RTD_CAMBIO, DEFAULT_RTD_PROXIMO);
```

El repo calcula RTD MOVI e IDI a mano, ignorando las funciones `calcularRtdMovi()` y `calcularIdi()` de `calculations.ts`. Además, el `try/catch` vacío en línea 93 traga errores silenciosamente.

**Riesgo**: si mañana cambiás la lógica de `calcularRtdMovi()` (ej: validar canales negativos), el repo no se entera y los datos en DB quedan inconsistentes con la UI.

**Solución**: importar y usar las funciones puras:

```typescript
import { calcularRtdMovi, calcularIdi, calcularEstadoRtd } from '../../core/calculations';

// En upsertNeumatico:
if (canales.length >= 3) {
  rtd_movi = calcularRtdMovi(canales[0], canales[1], canales[2], canales[3] ?? null);
  idi = calcularIdi(canales[0], canales[1], canales[2], canales[3] ?? null);
  estado_rtd = calcularEstadoRtd(rtd_movi, DEFAULT_RTD_CAMBIO, DEFAULT_RTD_PROXIMO);
}
```

---

### 1.5 Umbrales hardcodeados (viola regla de negocio)

**Archivo**: `app/src/db/repos/inspeccionRepo.ts:8-9`

```typescript
const DEFAULT_RTD_CAMBIO = 4;
const DEFAULT_RTD_PROXIMO = 7;
```

CLAUDE.md dice textualmente: *"NUNCA hardcodear 4/7/8 ni %."* Estos valores deben ser configurables por empresa. Por ahora no hay tabla de configuración por empresa — es algo que falta diseñar.

**Solución mínima temporal**: mover a una tabla `empresa_config` o al menos a una constante centralizada en un archivo `config.ts` con un `TODO` claro de que debe ser configurable por empresa.

---

### 1.6 persistDb() se llama en cada escritura

**Archivos**: `unidadRepo.ts:62`, `inspeccionRepo.ts:62,157`

Cada `upsert` llama `persistDb()` que en web ejecuta `saveToStore()`. Si el inspector está escribiendo 8 neumáticos, eso son 8 llamadas a `saveToStore` innecesarias.

**Solución**: persistir una vez al finalizar la inspección completa, o hacer debounce de 500ms.

---

### 1.7 N+1 queries en seed

**Archivo**: `app/src/db/seed.ts:117-127`

```typescript
for (const key of modelosSet) {
  const [marcaKey, modeloNombre] = key.split('|');
  const marcaResult = await db.query(`SELECT id FROM cat_marca WHERE lower(nombre) = ?`, [marcaKey.toLowerCase()]);
  // ...
}
```

Un `SELECT` por cada modelo (~50). Podría ser una sola query con un Map en memoria.

**Solución**:

```typescript
const allMarcas = await db.query('SELECT id, lower(nombre) as nombre_lower FROM cat_marca');
const marcaMap = new Map(allMarcas.values.map(r => [r.nombre_lower, r.id]));
// luego usar marcaMap.get(marcaKey.toLowerCase())
```

---

## 2. PROBLEMAS DE MANTENIBILIDAD

### 2.1 Estilos inline masivos

Todos los componentes usan `style={{ ... }}` con objetos de 20+ propiedades. Ejemplo real de `EmpresaScreen.tsx:56`:

```tsx
<div style={{ width: 390, height: 760, background: '#fff', borderRadius: 28,
  overflow: 'hidden', boxShadow: '0 24px 64px rgba(21,35,63,0.30)',
  display: 'flex', flexDirection: 'column' }}>
```

Esto se repite en cada pantalla con variaciones mínimas. Si querés cambiar el radio de bordes de todas las "cards", tenés que buscar y reemplazar en 15 archivos.

**Solución recomendada**: Tailwind CSS (ya tenés Vite, es trivial integrarlo). Si preferís no agregar dependencias, CSS Modules.

**Solución mínima**: extraer estilos reutilizables a constantes:

```typescript
// styles/shared.ts
export const phoneFrame = {
  width: 390, height: 760, background: '#fff', borderRadius: 28,
  overflow: 'hidden' as const, boxShadow: '0 24px 64px rgba(21,35,63,0.30)',
  display: 'flex' as const, flexDirection: 'column' as const,
};
```

---

### 2.2 StepDots duplicado

**Archivos**: `EmpresaScreen.tsx:22-33` y `UnidadScreen.tsx:10-21`

Función idéntica copiada en dos archivos.

**Solución**: crear `src/components/StepDots.tsx` y exportarla.

---

### 2.3 Field helper duplicado

**Archivos**: `FormBody.tsx:5-10` y `GrillaBody.tsx:6-11`

Las constantes `labelStyle`, `selectBase` y la función `Field` están idénticas en ambos archivos.

**Solución**: crear `src/components/Field.tsx`.

---

### 2.4 `empty()` definido en múltiples lugares

**Archivos**: `InspeccionScreen.tsx:11-15` y `GrillaBody.tsx:36-39`

La misma función para generar un registro vacío de neumático. Si agregás un campo, tenés que cambiar en dos lados.

**Solución**: definir una sola vez en `schema.ts` o en un archivo `types/neumatico.ts`.

---

### 2.5 FormBody recibe 17 props

```typescript
interface Props {
  data: Record<string, string>;
  commit: (next: Record<string, string>) => void;
  marcas: CatMarca[];
  modelos: CatModelo[];
  medidas: CatMedida[];
  anomalias: CatAnomalia[];
  valvulas: CatValvula[];
  showSheet: boolean;
  setShowSheet: (v: boolean) => void;
  showReencauche: boolean;
  setShowReencauche: (v: boolean) => void;
  modeloManual: boolean;
  setModeloManual: (v: boolean) => void;
  codigoEditing: boolean;
  setCodigoEditing: (v: boolean) => void;
  codigoRef: React.RefObject<HTMLInputElement | null>;
  r1Ref: React.RefObject<HTMLInputElement | null>;
  // ... 4 refs más
}
```

Esto dificulta agregar un prop nuevo sin romper nada.

**Solución**: agrupar en objetos:

```typescript
interface Props {
  data: NeumaticoData;
  commit: (next: NeumaticoData) => void;
  catalogs: { marcas: CatMarca[]; modelos: CatModelo[]; medidas: CatMedida[]; anomalias: CatAnomalia[]; valvulas: CatValvula[] };
  ui: { showSheet: boolean; setShowSheet: (v: boolean) => void; /* ... */ };
  refs: { codigo: RefObject; r1: RefObject; /* ... */ };
}
```

---

### 2.6 InspeccionScreen es un "god component" (290 líneas)

Maneja: estado de posición, store de datos, catálogos, modos form/grilla, mapa de llantas, bottom sheets, flash de guardado. Todo en un solo archivo.

**Solución**: extraer:
- `WheelMap` — el mapa visual de llantas (líneas 240-267)
- `PositionSelector` — el bottom sheet de posiciones
- `CatalogSheet` — el sheet de datos del neumático (ya existe parcialmente en FormBody)

---

### 2.7 AppContext mezcla estado persistido y transitorio

`AppContext` guarda `empresaId` (persistido en localStorage) junto con `unidadNumero`, `cabeceraId` (solo temporal de la sesión de inspección).

**Solución**: separar en `SessionContext` (empresa, sobrevive refresh) e `InspectionState` (unidad/cabecera, se resetea al salir).

---

### 2.8 Archivo CSS muerto

`App.css` (184 líneas) contiene estilos del template de Vite (`.counter`, `.hero`, `#center`, `#next-steps`, etc.) que no se usan en ningún componente de la app.

**Acción**: eliminar el archivo.

---

## 3. LO QUE ESTÁ BIEN

No todo son problemas. Tu proyecto tiene buenas prácticas que vale la pena reconocer y mantener:

| Fortaleza | Detalle |
|-----------|---------|
| **Cálculos puros** | `calculations.ts` es una joya: funciones puras, sin DB, sin side effects, con tests que cubren edge cases. Esto es lo más profesional del proyecto. |
| **Schema TypeScript** | Interfaces en `schema.ts` con tipos correctos (nullable fields,复合 primary keys). |
| **Repo pattern** | Capa de acceso a datos separada de la UI. Cada tabla tiene su repo. |
| **UUID en dispositivo** | IDs generados con `crypto.randomUUID()`, listos para sync futuro. |
| **PersistDb** | Ya pensado para web (jeep-sqlite) con manejo de errores. |
| **Seed data realista** | Catálogo de patron + unidades demo con datos coherentes. |
| **Memoización** | `initApp()` y `getDb()` están protegidos contra doble inicialización (StrictMode). |
| **Paridad Python↔TS** | `calculations.ts` tiene la misma lógica que `calculations.py`. Los tests lo verifican. |

---

## 4. PLAN DE ACCIÓN (orden de prioridad)

### Fase 1 — Limpieza inmediata (30 min)

| # | Qué | Archivos | Esfuerzo |
|---|-----|----------|----------|
| 1 | Eliminar `TABLE_SQL` duplicado | `schema.ts` | 5 min |
| 2 | Eliminar `App.css` muerto | `App.css` | 2 min |
| 3 | Crear `src/components/StepDots.tsx` compartido | `StepDots.tsx`, `EmpresaScreen.tsx`, `UnidadScreen.tsx` | 10 min |
| 4 | Crear `src/components/Field.tsx` compartido | `Field.tsx`, `FormBody.tsx`, `GrillaBody.tsx` | 10 min |
| 5 | Crear `src/types/neumatico.ts` con `NeumaticoData` y `emptyNeumatico()` | `neumatico.ts`, `InspeccionScreen.tsx`, `GrillaBody.tsx` | 5 min |

### Fase 2 — Base de datos (1-2 horas)

| # | Qué | Archivos | Esfuerzo |
|---|-----|----------|----------|
| 6 | Hacer `inspeccionRepo` use `calculations.ts` en vez de reimplementar | `inspeccionRepo.ts` | 15 min |
| 7 | Eliminar `try/catch` vacío en upsertNeumatico | `inspeccionRepo.ts:93-95` | 2 min |
| 8 | Crear tabla `schema_version` y sistema de migraciones | `sqlite.ts` | 1 hr |
| 9 | Crear tabla `app_meta` para evitar seed repetido | `sqlite.ts`, `seed.ts` | 30 min |
| 10 | Optimizar seed con batch queries (N+1 → 1 query) | `seed.ts` | 30 min |

### Fase 3 — Mantenibilidad UI (2-4 horas)

| # | Qué | Archivos | Esfuerzo |
|---|-----|----------|----------|
| 11 | Mover umbrales hardcodeados a constante centralizada | `inspeccionRepo.ts`, nuevo `config.ts` | 15 min |
| 12 | Debounce `persistDb()` o persistir al final de inspección | `inspeccionRepo.ts`, `unidadRepo.ts` | 30 min |
| 13 | Extraer `WheelMap` de `InspeccionScreen` | `components/WheelMap.tsx` | 30 min |
| 14 | Agrupar props de `FormBody` | `FormBody.tsx` | 20 min |
| 15 | Separar `AppContext` en `SessionContext` + `InspectionState` | `AppContext.tsx`, pantallas | 1 hr |

### Fase 4 — Estilos (futuro, 4+ horas)

| # | Qué | Esfuerzo |
|---|-----|----------|
| 16 | Integrar Tailwind CSS o pasar a CSS Modules | 4+ hr |
| 17 | Eliminar estilos inline de todos los componentes | incluido en 16 |

---

## 5. VERIFICACIÓN DESPUÉS DE CADA CAMBIO

1. `cd app && npm run build` — debe compilar sin errores
2. `cd app && npm run test` — tests de calculations deben pasar
3. `cd app && npm run lint` — oxlint sin warnings nuevos
4. Abrir en navegador con `npm run dev`, recorrer flujo completo: Empresa → Unidad → Inspección → Grilla → Volver
