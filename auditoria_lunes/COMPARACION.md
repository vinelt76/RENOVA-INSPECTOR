# Comparación: `auditoria_lunes/REPORTE.md` vs `REPORTE_IA_DEMO_LUNES_2026-07-25.md` (Codex)

Ambos evalúan el commit `ddcc9d2` el mismo día. Codex declaró no haber leído esta auditoría, para
preservar independencia. Esta comparación se escribe **después** de leer la suya.

## Respuesta corta

**No son el mismo reporte, y la diferencia es una sola: Codex no tuvo sesión iniciada ni acceso a
Supabase.** Su propio reporte lo declara con honestidad (F-09: «post-login no verificado»; §3.3:
«las herramientas Supabase MCP no estuvieron expuestas»).

Todo lo que Codex marca como PENDIENTE es exactamente donde aparecieron los hallazgos de mayor
impacto de esta auditoría. Los dos reportes coinciden casi punto por punto en lo que se puede ver
leyendo código; divergen en todo lo que exige mirar los datos.

Su reporte es mejor que el mío en preparación operativa: guion de demo, checklist P0/P1/P2, tabla
de riesgos de presentación. **Eso conviene adoptarlo tal cual, no rehacerlo.**

---

## Dónde coincidimos

| Hallazgo | Mío | Codex |
|---|---|---|
| Snapshots RTD no persistidos por la RPC vigente | H-08 | F-01 |
| Presión con regla fija 100/130 ≠ spec | H-02 | F-02 |
| IDI no cruza el sync | H-03 | F-03 |
| Grants DML excesivos sobre vistas | H-06 | F-04 |
| `fn_rtd_state` fuera de las migraciones | H-08 (nota) | F-07 |
| Tests SQL no ejecutados | declarado | F-10 |
| `isa_peso_snap` no puede valer 0 | deuda conocida | F-05 |
| Datos QA contaminan agregados | H-10 | F-14 |
| Suites verdes, lint limpio, `docs:check` OK | sí | sí |

En las dos afirmaciones que importan —qué está roto y qué no— los reportes son consistentes. Eso
es una señal buena: dos revisiones independientes no se contradicen sobre el estado del código.

---

## Lo que Codex encontró y yo no

Los tres son reales; los verifiqué antes de aceptarlos.

1. **F-12 — `Inspecciones por unidad` es desktop-only.** Confirmado:
   `WEB/Inspecciones por unidad.html:51` tiene `min-width:1280px`. No es un error de meta tag,
   es diseño fijo. **Implicación directa para el lunes: esa pantalla no se demuestra desde
   teléfono.** Yo la revisé solo en escritorio y no lo detecté.
   → incorporado a `task_11`.

2. **F-13 — `/favicon.ico` devuelve 404.** Trivial, pero es gratis arreglarlo.
   → incorporado a `task_11`.

3. **F-08 — el arreglo de login de la app de movimientos no está demostrado.** Confirmado:
   `app movimientos/.env.local` define solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; **no**
   define `VITE_SUPABASE_LOGIN_EMAIL_DOMAINS`, así que sigue vigente el fallback
   `operarios.renova.local`. Codex tiene razón en que el cambio puede no haber tocado la causa
   original. Mi H-04 llega al mismo lugar desde el otro lado —medí que solo existe 1 cuenta
   `operator`— y las dos observaciones se refuerzan.
   → incorporado a `task_04`.

Además, Codex **corrige acertadamente** al reporte del 2026-07-24 en un punto: el guard
anti-carrera de la cola **sí tiene pruebas unitarias** del contrato SQL; lo que falta es una
integración SQLite real. La afirmación «no tiene ningún test de regresión» era demasiado amplia.

---

## Lo que yo encontré y Codex no

Todo esto salió de tener sesión iniciada y acceso de lectura a Supabase.

1. **El KPI principal de Rendimiento está 13× desviado.** Codex nombra el riesgo QA en abstracto
   (F-14: «QA puede contaminar agregados»); nunca lo midió. Medido: 5 neumáticos de prueba a
   233 542 km/mm contra 10 717 reales, y la pantalla mostrando **138K km/mm**.

2. **140 de 288 inspecciones (49 %) con odómetro 0, y una unidad con 10 000 000 km** visible en
   pantalla. No aparece en su reporte de ninguna forma.

3. **`anon` lee datos de flota sin sesión.** Codex marca «Login gate antes de datos: Correcto»
   (§10) basándose en el smoke pre-login. Es cierto para la UI y **engañoso para el sistema**: las
   RPC `get_unidad_preload` / `get_umbrales_rtd` son `SECURITY DEFINER` y saltan RLS. Verificado:
   14 filas reales de MÓVIL BUS 2145 devueltas sin ninguna sesión, con la clave que está
   commiteada. Este es el punto donde su reporte da una garantía que no se sostiene.

4. **Solo 1 de 4 empresas tiene cuenta `operator`** (MÓVIL BUS). Codex especula sobre posibles
   causas del login (F-08: «usuario Auth inexistente, perfil ausente, rol distinto…») sin poder
   medirlo. El dato concreto es que CIVA, CRUZ DEL SUR e ITTSABUS no tienen operario.

5. **19 vistas con grants DML, no 4.** Codex hereda el número 4 del reporte anterior. El barrido
   completo en producción da 19. También verifiqué lo que baja la severidad: **cero vistas
   auto-actualizables**, así que hoy es inerte.

6. **3 de las 7 funciones del motor de cálculo no las llama nadie**
   (`calcularEstadoPresion`, `calcularVur`, `calcularTasaDesgaste`). Ninguno de los dos reportes
   previos lo menciona. Importa porque «paridad 48/48» certifica en parte reglas que no corren.

7. **Voseo argentino en 7 textos visibles**, 3 en el camino de la demo. Viola `CLAUDE.md`
   explícitamente. No aparece en su reporte.

8. **Inventario muestra el correo del usuario** en vez de la empresa, y Rendimiento renderiza una
   pastilla «Incluyendo 0 datos antiguos». Ambos solo visibles con sesión.

---

## Una diferencia que conviene mirar: el conteo de pruebas

Codex reporta **124 pruebas** ejecutadas (app 47, movimientos 5, buscador 19, servicios 38,
inventario 15). El total real es **385**:

| suite | pruebas | ¿la corrió Codex? |
|---|---:|---|
| `app/` | 47 | sí |
| `app movimientos/` | 5 | sí |
| `WEB/movimientos/` | **186** | **no** |
| `WEB/shared/` | **50** | **no** |
| `WEB/servicios/` | 38 | sí |
| `WEB/rendimiento/` | **25** | **no** |
| `WEB/buscador/` | 19 | sí |
| `WEB/inventario/` | 15 | sí |
| **total** | **385** | **124 (32 %)** |

Se perdió el 68 % de la cobertura, incluida la suite más grande del proyecto
(`WEB/movimientos`, 186 pruebas). `WEB/rendimiento` y `WEB/shared` no tienen `package.json`, así
que se saltean en silencio — es exactamente el modo de falla que describe `task_08`. Esto no es un
error de Codex: es la prueba de que el problema de `task_08` es real y ya afectó a una revisión.

---

## Corrección al reporte de Codex sobre el estado de Git

Codex reporta un bundle sucio en `app movimientos/dist` y sugiere que «todavía no está consolidado
en Git como un cambio limpio».

**Eso lo causé yo**, al ejecutar `npm run build` en esa app durante esta auditoría. El árbol estaba
limpio al iniciar la sesión. Ya lo restauré con `git checkout -- "app movimientos/dist"`. No es una
deuda del repositorio.

---

## Qué adopto de su reporte

Sin rehacerlo: su §14 (checklist P0/P1/P2), §16 (tabla de riesgos de presentación) y §17 (guion
técnico mínimo) son mejores que cualquier cosa equivalente en el mío, y son justo lo que hace falta
para el lunes. Están bien como están.

La única enmienda que les haría, con lo medido acá: el checklist P0 dice «saber qué datos QA
existen y no presentarlos como producción». Con los números en la mano eso no alcanza — los datos
QA **no se pueden separar mirando**, definen el KPI principal. Hay que sacarlos (`task_09`), no
esquivarlos en el guion.

## Veredicto sobre los dos veredictos

Codex concluye **«GO condicionado, pendiente ensayo autenticado»**. Ese ensayo se hizo en esta
auditoría, y es lo que cambia la conclusión: la superficie carga bien, pero **los números que
muestra están mal**. Mi veredicto —«el código está sano, los datos que muestra no»— no contradice
el suyo: lo completa con la parte que él no pudo ver.
