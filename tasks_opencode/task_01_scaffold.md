# Task 01 — Scaffold de la app (Vite + React + TS + Capacitor)

## Objetivo
Crear el proyecto `app/` vacío pero funcional: React + Vite + TypeScript, con Capacitor
configurado para Android y la estructura de carpetas que usarán los tasks siguientes.
Al final, la app arranca en navegador y compila; el proyecto está **listo para que más adelante
se genere el APK** (no se genera todavía).

## Contexto
- Repo raíz: la app vive en `app/` (no existe aún; este task la crea).
- Prototipos de referencia visual en `/UI/*.jsx|tsx` (NO se importan tal cual; se portarán en
  task 03). No los muevas.
- Lee `/CLAUDE.md` (stack y reglas) antes de empezar.

## Pasos
1. Crear `app/` con Vite (`react-ts`). Node 18+.
2. Dependencias base:
   - runtime: `react`, `react-dom`, `react-router-dom`, `uuid`.
   - Capacitor: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/camera`.
   - SQLite (se usa en task 02, instalar ya): `@capacitor-community/sqlite`, `jeep-sqlite`.
   - dev/test: `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`.
3. Configurar Capacitor: `appId` `com.renova.inspector`, `appName` `RENOVA Inspector`,
   `webDir` = `dist`. Crear `capacitor.config.ts`.
4. Estructura de carpetas (crear vacías con un `.gitkeep` o un index placeholder):
   ```
   app/
   ├── src/
   │   ├── main.tsx, App.tsx          # router raíz
   │   ├── core/                      # calculations.ts (task 02)
   │   ├── db/                        # sqlite, schema, seed, repos (task 02)
   │   ├── state/                     # estado compartido (task 03)
   │   ├── screens/                   # home, unidad, inspeccion (task 03)
   │   ├── components/                # piezas compartidas (StepDots, etc.)
   │   └── theme.ts                   # tokens NAVY/ORANGE/etc. (de los prototipos)
   ├── index.html
   ├── capacitor.config.ts
   ├── vite.config.ts
   ├── tsconfig.json
   ├── package.json
   └── README.md
   ```
5. `src/theme.ts`: exportar los tokens de color y la fuente MONO que repiten todos los prototipos
   (`NAVY=#15233f`, `ORANGE=#e85420`, `YELLOW=#f4b821`, `INK=#15233f`, `BORDER=#c7d0de`,
   `FIELD_BG=#f6f8fb`, `MUTED=#7b879c`, `GREEN=#1f9d6b`, `MONO=...`). Los siguientes tasks importan de aquí.
6. `App.tsx`: router con una ruta placeholder (`/` → un componente "RENOVA — scaffold OK") solo
   para verificar que arranca. Las pantallas reales llegan en task 03.
7. `README.md` de `app/`: documentar comandos (`npm install/dev/build/test`, `npx cap sync`,
   `npx cap add android`) y dejar anotado que el APK se genera tras el review de Opus.
8. Asegurar que `app/node_modules`, `app/dist`, `app/android` queden ignorados (ya están en el
   `.gitignore` raíz; verificar).

## Criterios de aceptación
- `cd app && npm install` sin errores.
- `npm run build` produce `dist/` sin errores de TypeScript.
- `npm run dev` levanta y muestra el placeholder en el navegador.
- `npx cap sync` corre sin error (aún sin plataforma android añadida está OK; documentar en README).
- Existe la estructura de carpetas y `src/theme.ts` con los tokens.

## Cómo verificar
```bash
cd app
npm install
npm run build      # debe terminar verde
npm run dev        # abrir el navegador, ver "RENOVA — scaffold OK"
```

## Fuera de alcance
- Nada de SQLite real, pantallas reales, ni lógica de negocio (eso es task 02–04).
- NO ejecutar `npx cap add android` ni generar APK todavía.
