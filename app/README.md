# RENOVA Inspector — App Móvil

App para inspección de neumáticos en flotas de buses interprovinciales en Perú.

## Stack
- React + Vite + TypeScript
- Capacitor (Android)
- SQLite local via `@capacitor-community/sqlite` (offline-first)
- `jeep-sqlite` / sql.js fallback para `npm run dev` en navegador

## Estructura
```
app/
├── src/
│   ├── main.tsx, App.tsx          # router raíz
│   ├── core/                      # calculations.ts (lógica de negocio pura)
│   ├── db/                        # sqlite, schema, seed, repos
│   ├── state/                     # estado compartido
│   ├── screens/                   # home, unidad, inspeccion
│   ├── components/                # piezas compartidas (StepDots, etc.)
│   └── theme.ts                   # tokens NAVY/ORANGE/etc.
├── capacitor.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Comandos

```bash
# Instalar dependencias
cd app && npm install

# Desarrollo en navegador (usa SQLite fallback web)
npm run dev

# Build de producción
npm run build

# Tests (data layer / calculations.ts)
npm run test

# Sincronizar Capacitor (copia dist/ a proyecto nativo)
npx cap sync

# Generar proyecto Android (solo tras review de Opus)
npx cap add android
```

## Notas importantes
- El APK se genera **solo tras review y aprobación de Opus** (ver `tasks_opencode/WORKFLOW.md`).
- `npx cap add android` no se ejecuta en el task 01; se deja documentado para cuando corresponda.
- IDs de inspección = **UUID v4 generados en cliente** (nunca autoincrement).
- Catálogos (anomalías, válvulas, marcas, configuraciones) viven en SQLite (seed) — **nunca hardcodear en componentes**.
- Cálculos: paridad obligatoria con `reference/calculations.py` (ver `decisions/0002-calc-parity.md`).
- Presión CALIENTE: **no implementar** hasta que RENOVA defina el valor de referencia (ver `specs/reglas_negocio.md` §3 y `CLAUDE.md` decisiones abiertas).