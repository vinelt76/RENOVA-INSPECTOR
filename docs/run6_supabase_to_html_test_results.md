# RUN 6 — Test Supabase → HTML (Fase 4)

Método: smoke test **headless Chrome real** (playwright-core + /usr/bin/google-chrome),
sirviendo el repo por HTTP local, capturando errores de consola y screenshots
(regla CLAUDE.md: recorrer el flujo, cero errores de consola, datos visibles).

## Con Supabase disponible (config local presente)

| Página | Badge | Datos visibles | Consola |
|---|---|---|---|
| rendimiento.html | `DATOS: SUPABASE · CIVA` | 7 unidades reales (225, 256, 2134, 2145, 2151, 5021, 5032); KPIs de eje calculados (ej. Km Acumulado total 214,440); panel "Datos fuente" con casco 241088, R1, IZE2W, MICHELIN, 315/80R22.5, instalado 28/11/2025 @553,857 km | **0 errores** |
| inspecciones-demo.html | `DATOS: SUPABASE · CIVA` | 10 inspecciones reales; cabecera ej. "225 · 07/05/2026 · 607,467 km · 4 posiciones · Inspector sin dato" | **0 errores** |
| vista-flota.html | `DATOS: SUPABASE · CIVA` | Fechas reales de inspección (07/05, 01/04, 26/03, 20/03/2026…); grid con la unidad inspeccionada en cada fecha; semáforo calculado por el HTML sobre RTD MOVI real | **0 errores** |

Screenshot de evidencia: panel de datos fuente abierto sobre datos reales (unidad
225, P3, casco 241088, Km/mm 7,659, % consumo 43.8, proyectado 91,903 km).

## Con Supabase caído (red bloqueada hacia el proyecto — fallback)

| Página | Badge | Comportamiento |
|---|---|---|
| rendimiento.html | `DATOS: DEMO LOCAL (MOCK) · fallback` | vuelve a B-118/B-204 mock, sin pantalla en blanco |
| inspecciones-demo.html | `DATOS: DEMO LOCAL (MOCK) · fallback` | 1 inspección mock |
| vista-flota.html | `DATOS: DEMO LOCAL (MOCK) · fallback` | 32 unidades mock |

## Checks de seguridad

- Solo clave **anon/publishable** (`sb_publishable_…`) en `supabase-config.local.js`
  y `app/.env.local` — **ambos gitignoreados**, verificado con `git status`.
- `supabase-config.example.js` committeado con campos vacíos.
- service_role: **no usada en ningún lado**.
- Nota: en una máquina SIN `supabase-config.local.js`, el navegador loguea un 404
  por ese script (inherente al patrón de script-tag opcional); el fallback funciona
  igual. En la máquina de la demo el archivo existe y la consola queda limpia.
