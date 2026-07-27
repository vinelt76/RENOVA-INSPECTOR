# Reporte independiente para comparación entre IAs

## Preparación de RENOVA INSPECTOR para la demo del lunes 2026-07-27

**Fecha de evaluación:** 2026-07-25, zona horaria `America/Lima`  
**Commit evaluado:** `ddcc9d241f7c830f1acfc5db885fff12c5fdbc00` (`main`, alineado con `origin/main`)  
**Proyecto Supabase documentado:** `fbxupwwgiebhlciqftpw`  
**Instancia web evaluada:** `http://127.0.0.1:8766/`  
**Ruta principal solicitada:** `rendimiento.html`  
**Autor del análisis:** agente Codex, revisión independiente  
**Documento base contrastado:** `verificacion/REPORTE.md` y evidencias `T01`–`T12`  
**Otro audit detectado:** `auditoria_lunes/`, deliberadamente no leído para preservar independencia

---

## 1. Propósito del documento

Este reporte consolida:

1. El audit técnico guardado en `verificacion/`.
2. El estado actual del código en Git.
3. Las pruebas ejecutadas nuevamente el 2026-07-25.
4. Un smoke test real en Chrome contra el servidor local del puerto `8766`.
5. Una revisión crítica de las conclusiones y severidades del audit original.
6. Un veredicto separado para:
   - estabilidad técnica;
   - exactitud funcional;
   - seguridad;
   - reproducibilidad;
   - preparación operativa de la demo.

Está escrito para que otra IA pueda comparar resultados sin tener que inferir qué se verificó
realmente y qué se heredó de documentación previa.

Este documento **no modifica código, datos, Supabase, usuarios, RLS ni configuración remota**.

---

## 2. Veredicto ejecutivo

### 2.1 Veredicto corto

**La demo local en laptop está técnicamente preparada para abrir y navegar hasta el login.**

La superficie web:

- responde correctamente desde el servidor local;
- carga scripts y estilos;
- no presenta errores de JavaScript en Rendimiento, Servicios e Inspecciones;
- presenta correctamente el login en desktop y móvil;
- tiene suites locales verdes.

Sin embargo, **no existe evidencia nueva de un ensayo autenticado completo de los dashboards**
en esta revisión. Por lo tanto:

- la demo visual y de navegación puede considerarse **GO condicionado**;
- la demo autenticada con datos reales es **GO pendiente de ensayo**;
- una demostración que afirme exactitud definitiva de presión, IDI o snapshots RTD es **NO-GO**;
- el producto completo no debe declararse “terminado” solo porque la UI cargue.

### 2.2 Clasificación general

| Dimensión | Estado | Confianza | Comentario |
|---|---|---:|---|
| Servidor local | GO | Alta | Puerto `8766`, páginas principales con HTTP 200 |
| Render inicial | GO | Alta | Chrome real, desktop y móvil |
| Login visual | GO | Alta | Modal visible, usable y sin errores de consola |
| Login con credenciales reales | PENDIENTE | Baja | No se usaron credenciales en esta revisión |
| Datos post-login | PENDIENTE | Baja | No observados por esta IA |
| Tests unitarios | GO | Alta | 124 tests ejecutados nuevamente, todos verdes |
| Lint app principal | GO | Alta | `oxlint` sin hallazgos |
| Documentación | GO | Alta | `docs:check` correcto |
| Build app principal | GO según evidencia | Media-Alta | Build verde en evidencia del audit |
| App de movimientos | GO técnico parcial | Media | Tests verdes; login remoto no demostrado |
| Exactitud RTD histórica | DEUDA | Alta | Snapshots enviados pero no persistidos por RPC vigente |
| Exactitud presión web | PROVISIONAL | Alta | Regla fija 100/130, distinta de la spec configurable |
| IDI remoto | AUSENTE | Alta | Se calcula localmente, no cruza el sync |
| Seguridad de grants | DEUDA | Media-Alta | Audit remoto detectó DML excesivo en 4 vistas |
| Reproducibilidad desde migraciones | DEUDA | Alta | `fn_rtd_state` falta en migraciones locales |
| Demo local de laptop | GO condicionado | Alta | Requiere ensayo autenticado antes del lunes |
| Demo móvil de Inspecciones web | NO recomendada | Alta | Diseño deliberadamente fijo a 1280 px |

---

## 3. Alcance evaluado

### 3.1 Incluido

- Motor de cálculo Python/TypeScript, mediante evidencia golden existente.
- App móvil de inspección (`app/`).
- App de movimientos del operario (`app movimientos/`).
- Cola durable de sincronización.
- Payload de `save_inspection`.
- Migraciones relacionadas con inspecciones y dashboards.
- Vistas web y permisos reportados por el audit.
- Dashboards:
  - Rendimiento;
  - Servicios;
  - Inventario;
  - Inspecciones por unidad.
- Estado del repositorio y artefactos `dist`.
- Pruebas unitarias/lint/docs disponibles.
- Smoke en navegador desktop y móvil.
- Preparación práctica para demo local.

### 3.2 Excluido o no verificable en esta revisión

- Login con una cuenta real de dashboard.
- Datos visibles después del login.
- Escritura real contra `save_inspection`.
- Reenvío/idempotencia real de RPC ante timeout.
- Los seis tests SQL de `supabase/tests/`.
- APK instalado y probado en dispositivo Android físico.
- Cámara, SQLite nativo, pérdida/recuperación de red en Android real.
- Aislamiento visual entre dos empresas autenticadas.
- Reconsulta remota nueva de grants, advisors y funciones de producción.
- Corrección o aplicación de migraciones.
- Borrado/limpieza de datos QA.

### 3.3 Importante sobre Supabase

Los hechos sobre producción contenidos en `T07`, `T09` y `T10` fueron obtenidos por el audit
original mediante consultas de solo lectura el 2026-07-24/25. Esta revisión contrastó esos hechos
contra código y migraciones locales, pero **no repitió las consultas remotas** porque las
herramientas Supabase MCP no estuvieron expuestas en esta sesión.

Por esa razón:

- se consideran evidencia reciente y razonable;
- no se presentan como una segunda medición independiente de producción;
- cualquier cambio manual hecho directamente en Supabase después del audit podría no estar
  reflejado aquí.

---

## 4. Fuentes de autoridad utilizadas

Orden de autoridad aplicado:

1. `specs/reglas_negocio.md` y decisiones vigentes para comportamiento deseado.
2. Código, migraciones y tests actuales para comportamiento implementado.
3. Evidencia del audit en `verificacion/`.
4. `knowledge/ai/` para contexto y deuda conocida.
5. Smoke real en navegador para comportamiento visible.

Fuentes principales:

- `CLAUDE.md`
- `knowledge/ai/00 - LEER PRIMERO.md`
- `knowledge/ai/02 - Estado actual.md`
- `knowledge/ai/10 - Roadmap deuda y riesgos.md`
- `knowledge/ai/11 - Mapa del repo y runbook.md`
- `verificacion/REPORTE.md`
- `verificacion/T02.md`–`T11.md`
- `verificacion/evidencia/`
- `app/src/core/calculations.ts`
- `app/src/db/repos/inspeccionRepo.ts`
- `app/src/db/repos/syncQueueRepo.ts`
- `app/src/sync/pushInspeccion.ts`
- `supabase/migrations/`
- `WEB/*.html`
- `WEB/supabase-demo.js`

---

## 5. Metodología y niveles de evidencia

### 5.1 Niveles

| Nivel | Definición |
|---|---|
| E1 | Inferencia por documentación o comentario |
| E2 | Lectura directa de código/migración |
| E3 | Test automatizado local reproducible |
| E4 | Smoke real en navegador o entorno local activo |
| E5 | Consulta/prueba remota autenticada en Supabase |

### 5.2 Regla usada para “corregido”

Un hallazgo se marca corregido únicamente cuando:

1. existe un cambio implementado;
2. existe una prueba proporcional al riesgo;
3. si toca Supabase, hay verificación remota o de esquema;
4. si toca UI, hay smoke en navegador;
5. no depende de un artefacto local no publicado sin declararlo.

Tener código presente no equivale automáticamente a tener el hallazgo cerrado.

---

## 6. Estado del repositorio

### 6.1 Git

Commit:

```text
ddcc9d241f7c830f1acfc5db885fff12c5fdbc00
```

`main` coincide con `origin/main`.

Cambios pendientes observados:

```text
M  .tokensave/tokensave.db-shm
D  app movimientos/dist/assets/index-dZrqAUm5.js
M  app movimientos/dist/index.html
?? app movimientos/dist/assets/index-Cpv5s2V-.js
?? auditoria_lunes/
```

Interpretación:

- `.tokensave` es estado auxiliar y no forma parte de este audit.
- `auditoria_lunes/` pertenece al usuario y no fue tocado ni leído.
- `app movimientos/dist` contiene un bundle local regenerado que todavía no está consolidado en
  Git como un cambio limpio.

### 6.2 Implicación para la demo

El bundle sucio de `app movimientos/dist` no afecta directamente a
`http://127.0.0.1:8766/rendimiento.html`, que sirve `WEB/`.

Sí importa si la demo incluye:

- APK de la app de movimientos;
- copiar `dist` manualmente;
- construir un paquete Capacitor desde ese directorio;
- comparar exactamente el bundle versionado con el bundle ejecutado.

---

## 7. Pruebas ejecutadas nuevamente

### 7.1 Resultado consolidado

| Componente | Archivos | Tests | Resultado |
|---|---:|---:|---|
| `app/` | 7 | 47 | PASS |
| `app movimientos/` | 1 | 5 | PASS |
| `WEB/buscador/` | 2 | 19 | PASS |
| `WEB/servicios/` | 3 | 38 | PASS |
| `WEB/inventario/` | 2 | 15 | PASS |
| **Total ejecutado** | **15** | **124** | **PASS** |

Comprobaciones adicionales:

| Comando | Resultado |
|---|---|
| `app/npm run lint` | PASS, sin salida de errores |
| `npm run docs:check` | PASS, 38 notas IA + 12 humanas |

### 7.2 Evidencia heredada del audit

- Paridad Python ↔ TypeScript: 48/48.
- `reference/test_calculations_golden.py`: 31/31.
- Build de `app/`: PASS.
- 47/47 tests de `app/` en el audit original.

### 7.3 Qué no demuestran estos tests

Los tests verdes no demuestran:

- que una credencial real pueda iniciar sesión;
- que el perfil tenga el rol correcto;
- que RLS permita las consultas esperadas;
- que la RPC escriba en producción;
- que los dashboards presenten datos correctos después del login;
- que un APK real funcione con SQLite nativo;
- que el dashboard no muestre clasificaciones de presión conceptualmente incorrectas.

---

## 8. Smoke real contra el servidor local

### 8.1 Entorno

- Chrome real en modo headless.
- Ejecutable: `/usr/bin/google-chrome`.
- Desktop: `1440 × 1000`.
- Móvil: `390 × 844`.
- Contextos limpios, sin sesión persistida.
- Navegación esperando `networkidle`.
- Captura de:
  - errores de consola;
  - excepciones JS;
  - requests fallidos;
  - respuestas HTTP >= 400;
  - ancho del documento;
  - visibilidad del login.

### 8.2 Resultado por página

| Página | Desktop | Móvil | Consola | Login | Observación |
|---|---|---|---|---|---|
| `rendimiento.html` | 200 | 200 | Limpia | Visible | Sin overflow |
| `servicios.html` | 200 | 200 | Limpia | Visible | Recursos correctos |
| `inventario.html` | 200 | 200 | 1 error 404 aislado en desktop | Visible | `favicon.ico` ausente |
| `Inspecciones por unidad.html` | 200 | 200 | Limpia | Visible | Layout fijo de 1280 px |

### 8.3 Rendimiento

Confirmado:

- título `RENOVA — Rendimiento`;
- scripts de configuración, auth, ready y animación cargados;
- estilos locales cargados;
- modal de login visible;
- `documentWidth == viewportWidth` en desktop y móvil;
- cero errores de consola;
- cero excepciones JS;
- cero recursos propios con error;
- visualmente centrado y legible.

Conclusión: **la superficie pre-login de Rendimiento está lista para demo**.

### 8.4 Servicios

Confirmado:

- HTTP 200;
- controlador `servicios-controller.js` cargado;
- CSS específico cargado;
- login visible;
- cero errores de consola;
- sin overflow horizontal en las dimensiones evaluadas.

Conclusión: **la superficie pre-login de Servicios está lista para demo**.

### 8.5 Inventario

Confirmado:

- HTTP 200;
- controlador y CSS cargados;
- login visible;
- sin overflow.

Hallazgo cosmético:

- el servidor devuelve `404` para `/favicon.ico`;
- no afecta lógica, datos, login ni navegación;
- severidad: informativa.

Conclusión: **Inventario está listo para demo; el favicon no bloquea**.

### 8.6 Inspecciones por unidad

Confirmado:

- HTTP 200;
- scripts y estilos cargados;
- login visible;
- consola limpia.

Comportamiento responsive:

- el HTML tiene `meta viewport`;
- el CSS define `.dash { min-width: 1280px; }`;
- en emulación móvil el viewport lógico termina en 1280 px;
- no es un error accidental de meta tag, sino un diseño desktop fijo.

Conclusión:

- **apto para demo en laptop**;
- **no apto como experiencia móvil web**;
- no afecta la app Android de inspección, que es otra superficie.

---

## 9. Hallazgos críticos y estado actual

### F-01 — Snapshots RTD enviados pero no persistidos por la RPC vigente

**Severidad producto:** Alta  
**Severidad para demo actual:** Media  
**Estado:** No corregido  
**Evidencia:** E2 + audit remoto E5

La app envía:

- `rtd_for_change`;
- `rtd_next_change`;
- `rtd_normal`.

La versión vigente versionada de `save_inspection` no incluye columnas destino para esos campos
en el `INSERT/UPDATE` de `inspection_measurements`.

Consecuencias:

- se pierde la capacidad de reconstruir exactamente con qué umbrales se clasificó la medición;
- `tire_status`, `retread_observation` y estados por canal usan umbrales efectivos actuales desde
  `fn_effective_rtd_thresholds`;
- un cambio posterior de umbrales puede cambiar la interpretación visible de datos históricos.

#### Revisión crítica de la afirmación “cambia todo el histórico”

La afirmación requiere matiz:

- `inspection_measurements.rtd_state` sí se guarda durante `save_inspection`;
- sin embargo, la vista vigente prioriza el lateral `th` actual para `tire_status` y
  `retread_observation`;
- los estados de canal llaman `fn_channel_rtd_state`, que también usa umbrales actuales;
- por tanto, partes relevantes del dashboard sí pueden cambiar retroactivamente.

El audit original es sustancialmente correcto, aunque conviene decir “clasificaciones derivadas
del dashboard” y no asumir que cada campo almacenado cambia físicamente.

#### Impacto demo

No debería producir un crash. Se vuelve visible si:

- se cambian umbrales antes de la demo;
- se compara una inspección histórica con el umbral original;
- se intenta demostrar reproducibilidad histórica.

Recomendación para el lunes:

- no cambiar umbrales;
- no afirmar que el dashboard conserva snapshots históricos;
- no corregir apresuradamente en producción sin staging.

---

### F-02 — Regla web de presión fija 100/130

**Severidad producto:** Alta si se presenta como regla definitiva  
**Severidad para demo:** Media  
**Estado:** No corregido; provisional y documentado  
**Evidencia:** E2 + audit remoto E5

La función:

```sql
fn_pressure_state_fixed(p_psi numeric)
```

clasifica:

- `<= 100`: Baja Presión;
- `101..130`: Normal;
- `> 130`: Alta Presión.

La spec aprobada considera:

- `presion_ref`;
- empresa;
- medida;
- tipo de eje;
- deltas porcentuales.

Ejemplo documentado:

- Tracción a 122 PSI puede corresponder a Alta Presión;
- la función web fija la presenta como Normal.

#### Matiz de severidad

El código llama explícitamente a esta regla “fija” y “exclusiva de dashboards web”. Además, la
presión CALIENTE sigue bloqueada como decisión de negocio.

Por tanto:

- es una divergencia real;
- no es un bug oculto;
- no debería describirse como una implementación accidental;
- sí es peligroso mostrarla como una clasificación final aprobada.

#### Impacto demo

La UI funciona. El riesgo es semántico.

Recomendación:

- presentar presión como indicador provisional;
- evitar usar un ejemplo de 122 PSI para justificar exactitud;
- no prometer configuración por empresa/eje hasta aprobar la regla.

---

### F-03 — IDI no llega a Supabase

**Severidad producto:** Alta  
**Severidad para demo:** Baja-Media  
**Estado:** No corregido  
**Evidencia:** E2

`idi`:

- se calcula en `app/src/db/repos/inspeccionRepo.ts`;
- se persiste en SQLite;
- no está en el payload de `pushInspeccion.ts`;
- no tiene columna remota versionada;
- no puede llegar a los dashboards.

No rompe la captura ni el dashboard. Produce una omisión funcional:

- la app conoce el IDI;
- el sistema consolidado no;
- ninguna UI remota puede mostrarlo.

Recomendación demo:

- no mostrar IDI como capacidad remota;
- si se menciona, presentarlo como cálculo local pendiente de integración.

---

### F-04 — Grants DML excesivos sobre cuatro vistas

**Severidad:** Medio-Alto  
**Estado:** No corregido según repositorio/audit  
**Evidencia:** audit remoto E5

Vistas afectadas reportadas:

- `v_inspection_dashboard_rows`;
- `v_rendimiento_dashboard_rows`;
- `v_inventory_status`;
- `v_casing_history_summary`.

El audit observó para `anon` y `authenticated`:

- INSERT;
- UPDATE;
- DELETE;
- TRUNCATE;
- REFERENCES;
- TRIGGER.

Mitigación actual:

- las vistas son joins complejos no autoactualizables;
- tienen `security_invoker=on`;
- no se encontraron triggers `INSTEAD OF`.

Interpretación:

- no hay evidencia de explotación actual;
- sigue siendo mala higiene de permisos;
- el riesgo puede materializarse si una vista futura se vuelve actualizable.

Impacto demo:

- no bloquea visualmente;
- sí impide declarar que el modelo de permisos está completamente saneado.

Remedio futuro:

- migración explícita de `REVOKE`;
- conservar solo `SELECT` para los roles necesarios;
- verificar grants reales después de aplicar;
- ejecutar advisors y smoke autenticado.

---

### F-05 — `isa_peso_snap` no puede representar “sin anomalía = 0”

**Severidad:** Media  
**Estado:** No corregido  
**Evidencia:** E2 + golden conceptual

Firma actual:

```ts
calcularIsaPeso(desecho: boolean)
```

Solo distingue:

- desecho: 5;
- no desecho: 1.

No recibe la información necesaria para devolver 0 cuando no existe anomalía.

Impacto:

- datos locales sesgados;
- sin impacto visible hoy porque ISA no está conectado a la UI;
- deuda futura de backfill si ISA se habilita.

Impacto demo: no bloqueante.

---

### F-06 — Guard anti-carrera de la cola

**Severidad original:** Media  
**Severidad revisada:** Baja-Media  
**Estado:** Implementado y cubierto parcialmente  
**Evidencia:** E2 + E3

El audit original afirma que el guard no tiene test de regresión. Esa afirmación es demasiado
amplia.

Sí existen pruebas unitarias que verifican:

- `marcarEnviado` incluye `created_at` en el `WHERE`;
- `marcarError` incluye `created_at`;
- `enqueue` reemplaza `created_at` al reencolar.

Lo que no existe es una integración SQLite real que ejecute simultáneamente:

1. push en vuelo;
2. edición nueva;
3. reencolado;
4. resolución tardía del push viejo;
5. confirmación de que la fila nueva continúa pendiente.

Conclusión:

- el fix está implementado;
- el contrato SQL tiene tests;
- queda un hueco de integración, no una ausencia total de regresión.

Impacto demo: bajo.

---

### F-07 — `fn_rtd_state` falta en migraciones locales

**Severidad:** Media  
**Estado:** No corregido  
**Evidencia:** E2 + audit remoto E5

La función:

- existe en producción;
- es usada por `save_inspection`;
- no está definida en `supabase/migrations/`.

Consecuencia:

- reconstruir un proyecto desde cero solo con las migraciones puede dejar `save_inspection`
  inutilizable;
- producción actual funciona porque la función existe fuera de la cadena versionada.

Impacto demo local actual: bajo.

Impacto staging/recuperación: alto.

---

### F-08 — Cambio de login de la app de movimientos

**Severidad:** Media como incertidumbre  
**Estado:** Implementado, no demostrado contra Auth real  
**Evidencia:** E2 + E3

El commit actual introdujo:

- dominios internos configurables;
- varios candidatos de email;
- diferenciación de `invalid_credentials` y `email_not_confirmed`;
- tests de normalización.

Evaluación crítica:

- `.env.local` no define `VITE_SUPABASE_LOGIN_EMAIL_DOMAINS`;
- el fallback sigue siendo `operarios.renova.local`;
- con la configuración actual, la transformación principal es la misma que antes;
- no existe evidencia de que este cambio resolviera la causa original del login;
- configurar varios dominios multiplica intentos de contraseña y puede acercar rate limits.

Posible causa real no cubierta:

- usuario Auth inexistente;
- correo interno distinto;
- correo no confirmado;
- perfil ausente;
- `profiles.active = false`;
- rol distinto de `operator`;
- empresa relacionada ausente;
- RLS bloqueando `profiles`.

Conclusión:

- no se detecta una rotura de compilación/tests;
- no debe declararse “login arreglado” sin una cuenta real;
- no afecta directamente el login de los dashboards `WEB/`, que usa correo completo.

---

### F-09 — Dashboards post-login no verificados en esta revisión

**Severidad para demo:** Alta  
**Estado:** Pendiente operativo  
**Evidencia:** E4 solo pre-login

Se confirmó:

- login gate visible;
- recursos cargados;
- no fetch de datos antes de sesión;
- consola limpia.

No se confirmó:

- autenticación exitosa;
- perfil/empresa;
- filas visibles;
- filtros;
- navegación con sesión;
- refresh persistente;
- datos aislados por empresa.

Este es el principal pendiente antes de la demo.

No requiere necesariamente un cambio de código. Requiere ejecutar el guion real con la cuenta
demo que se usará el lunes.

---

### F-10 — Tests SQL y escrituras remotas no ejecutados

**Severidad:** Media-Alta para una demo end-to-end  
**Estado:** Pendiente  
**Evidencia:** declaración del audit

No ejecutados:

- `baseline_mount`;
- `tire_change_batch`;
- `tire_discard_photos`;
- `tire_services_view`;
- `unit_state_reads`;
- `workshop_rpcs`.

Tampoco se probó remotamente:

- idempotencia ante reenvío;
- timeout seguido de retry;
- ejecución real de `save_inspection`;
- escritura de movimientos durante esta revisión.

Recomendación:

- no ejecutar pruebas destructivas sobre datos de cliente antes de la demo;
- usar un entorno efímero/staging o una unidad QA explícitamente autorizada.

---

### F-11 — GitHub Pages y servidor local son superficies distintas

**Severidad:** Informativa  
**Estado:** Aclarado

Una comprobación inicial a GitHub Pages devolvió 404. Eso no es un defecto del proyecto porque la
demo indicada por el usuario es local y el servidor no se había levantado en ese momento.

Después de levantar `8766`, la ruta local respondió correctamente.

Conclusión:

- retirar el 404 público como bloqueo de la demo local;
- no afirmar que existe despliegue público;
- no mezclar “sitio no publicado” con “aplicación rota”.

---

### F-12 — Inspecciones por unidad es desktop-only

**Severidad:** Baja para demo, Media para experiencia web móvil  
**Estado:** Comportamiento vigente/intencional  
**Evidencia:** E2 + E4

CSS:

```css
.dash {
  min-width: 1280px;
}
```

Impacto:

- laptop: correcto;
- teléfono: página escalada/ancha;
- el modal de login sigue usable;
- el dashboard post-login no es responsive.

Recomendación:

- usar laptop con resolución suficiente;
- no demostrar esa pantalla desde teléfono;
- no confundirla con la app Android.

---

### F-13 — Favicon ausente

**Severidad:** Informativa  
**Estado:** No corregido  
**Evidencia:** E4

`/favicon.ico` devuelve 404.

No afecta:

- autenticación;
- datos;
- JS;
- navegación;
- demo.

Puede corregirse después con un favicon o `<link rel="icon">`, pero no merece cambios de último
momento.

---

### F-14 — Calidad y coherencia de datos de producción

**Severidad:** Mixta  
**Estado:** No corregido  
**Evidencia:** audit remoto E5

Datos reportados:

- 288 inspecciones;
- 2,247 mediciones;
- 2,183 sin `life_cycle_id`;
- 2,094 posiciones `baseline_pending`;
- 14 mediciones QA en `QA-CN16`;
- variantes de caja en marcas;
- 40 cascos en `tire_casings`, 3 sin código.

Implicaciones:

- Rendimiento puede tener métricas incompletas por falta de ciclo de vida;
- QA puede contaminar agregados;
- facetas de marca pueden fragmentarse;
- no debe asumirse que el universo de cascos está completamente reconciliado.

La discrepancia “~316 cascos sin código” no fue reproducible y necesita aclaración humana.

Impacto demo:

- elegir de antemano empresa/unidad/caso;
- evitar navegar al azar buscando un ejemplo;
- no borrar QA sin autorización;
- no prometer cobertura total de rendimiento.

---

## 10. Qué está corregido

| Elemento | Estado | Evidencia |
|---|---|---|
| Import roto de golden Python | Corregido | 31/31 tests |
| Paridad Python/TS | Confirmada | 48/48 |
| Fórmulas base TS/Python | Estables | Golden |
| Cola durable y backoff | Implementados | Tests |
| Aislamiento de una fila fallida | Implementado | Test |
| Guard de `created_at` | Implementado | Tests unitarios SQL |
| Firmas de 3 RPC | Coinciden | Audit remoto |
| `security_invoker` en 8 vistas | Confirmado | Audit remoto |
| Recursos web de demo | Cargan | Smoke Chrome |
| Login gate antes de datos | Correcto | Smoke Chrome |
| Rendimiento pre-login | Correcto | Desktop + móvil |
| Servicios pre-login | Correcto | Desktop + móvil |
| Inventario pre-login | Correcto | Desktop + móvil |
| Navegación local servida | Correcta a nivel HTTP | HTTP 200 |
| Tests/lint/docs | Verdes | Ejecución 2026-07-25 |

---

## 11. Qué no está corregido

| Elemento | Estado |
|---|---|
| Persistencia de snapshots RTD | No corregido |
| Uso histórico de snapshots en vista | No corregido |
| Regla de presión configurable | No corregido / decisión abierta |
| IDI remoto | No corregido |
| ISA peso 0 | No corregido |
| Grants excesivos | No corregido según audit |
| `fn_rtd_state` en migraciones | No corregido |
| Test SQLite real de carrera | Pendiente |
| Tests SQL en entorno seguro | Pendientes |
| Login real app movimientos | No demostrado |
| Login real dashboards en esta revisión | No demostrado |
| Aislamiento entre empresas en smoke actual | No demostrado |
| Responsive móvil de Inspecciones web | No implementado |
| Limpieza de QA | Pendiente de decisión |
| Reconciliación de movimientos/ciclos | Pendiente |

---

## 12. Correcciones al audit original

### 12.1 Correcciones confirmadas

1. **El 404 de GitHub Pages no es un bug de la demo local.**
   La URL local funciona cuando el servidor está levantado.

2. **El guard anti-carrera no está totalmente sin tests.**
   Tiene pruebas unitarias del contrato SQL; falta integración SQLite real.

3. **La presión fija es una divergencia conocida y documentada.**
   Sigue siendo funcionalmente provisional, pero no es una sorpresa oculta.

4. **La afirmación RTD retroactiva necesita precisión.**
   El campo almacenado existe, pero la vista deriva estados relevantes con umbrales actuales.

### 12.2 Puntos del audit que se sostienen

- IDI no cruza el sync.
- Snapshots RTD se descartan en la versión vigente de la RPC.
- Regla de presión web no implementa la spec configurable.
- Grants amplios son deuda real.
- `fn_rtd_state` falta en migraciones.
- Post-login no fue cubierto en el smoke original.
- Tests SQL/escrituras siguen pendientes.

---

## 13. Preparación por tipo de demo

### Escenario A — Demo visual de dashboards locales

Ejemplos:

- abrir Rendimiento;
- mostrar diseño;
- explicar filtros;
- navegar por Servicios/Inventario/Inspecciones.

**Veredicto:** GO condicionado.

Condición:

- iniciar sesión antes o durante la demo con una cuenta probada.

### Escenario B — Demo con datos reales post-login

Ejemplos:

- filtrar empresa/unidad;
- mostrar neumáticos;
- revisar inventario;
- mostrar servicios.

**Veredicto:** GO pendiente de ensayo.

Falta:

- sesión autenticada;
- verificar que los datos elegidos existen y son presentables;
- confirmar consola limpia después del fetch.

### Escenario C — Captura Android → sync → dashboard

**Veredicto:** NO certificado por este reporte.

Falta:

- APK/dispositivo;
- escritura RPC;
- sync real;
- comprobación de aparición del dato;
- retry/offline real.

### Escenario D — Exactitud analítica

Ejemplos:

- afirmar presión por empresa/eje;
- demostrar IDI remoto;
- justificar estado histórico por snapshot.

**Veredicto:** NO-GO.

Las capacidades no están completamente implementadas.

### Escenario E — Movimientos supervisor → operario → servicios

**Veredicto:** existe evidencia previa de smoke autenticado exitoso del 2026-07-22, pero no fue
repetido en esta revisión.

Puede incluirse si:

- se usa la misma cuenta/caso probado;
- la app de movimientos inicia sesión;
- el bundle/APK exacto se ensaya antes.

---

## 14. Checklist obligatorio antes del lunes

### P0 — imprescindible

- [ ] Abrir `http://127.0.0.1:8766/rendimiento.html`.
- [ ] Iniciar sesión con la cuenta exacta que se usará.
- [ ] Confirmar que carga empresa y datos.
- [ ] Confirmar consola limpia post-login.
- [ ] Probar filtros que se mostrarán.
- [ ] Navegar a Servicios, Inventario e Inspecciones sin perder sesión.
- [ ] Elegir previamente una unidad con datos claros.
- [ ] Recargar la página y confirmar que la sesión/estado esperado se conserva.
- [ ] Verificar resolución/proyector en la laptop real.
- [ ] Mantener un guion que no dependa de buscar ejemplos al azar.

### P1 — recomendable

- [ ] Tener captura o video de respaldo.
- [ ] Tener el servidor local ya levantado.
- [ ] Desactivar suspensión automática de la laptop.
- [ ] Confirmar red si Supabase será remoto.
- [ ] Tener un hotspot alternativo.
- [ ] Abrir las pestañas antes de empezar.
- [ ] Evitar modificar umbrales RTD.
- [ ] No usar Inspecciones web desde teléfono.
- [ ] Saber qué datos QA existen y no presentarlos como producción.

### P2 — después de la demo

- [ ] Persistir snapshots RTD.
- [ ] Aprobar/implementar regla de presión.
- [ ] Integrar IDI remoto.
- [ ] Corregir ISA.
- [ ] Revocar grants excesivos.
- [ ] Versionar `fn_rtd_state`.
- [ ] Crear test SQLite real de carrera.
- [ ] Ejecutar SQL tests en staging.
- [ ] Limpiar o marcar datos QA.
- [ ] Definir estrategia de login de inspectores.

---

## 15. Recomendaciones sobre cambios antes de la demo

### No recomendado

- aplicar migraciones grandes directamente en producción;
- cambiar la regla de presión sin decisión de negocio;
- introducir columnas/RPC nuevas sin staging;
- limpiar datos QA de oficio;
- cambiar umbrales RTD;
- refactorizar navegación o convertir dashboards a React;
- tocar RLS/grants sin ensayo autenticado posterior.

### Seguro y opcional

- agregar favicon;
- preparar un guion;
- seleccionar datos demo;
- capturar respaldo;
- ejecutar smoke autenticado;
- consolidar el bundle exacto que se usará;
- documentar métricas provisionales.

---

## 16. Riesgos de presentación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---:|---:|---|
| Credencial no funciona | Media | Alta | Ensayo previo |
| Usuario sin perfil/rol | Media | Alta | Revisar cuenta antes |
| Red falla | Media | Alta | Hotspot + respaldo visual |
| Datos no aparecen | Media | Alta | Seleccionar unidad antes |
| Presión cuestionada | Media | Media | Declarar regla provisional |
| IDI solicitado | Baja | Media | Explicar pendiente de sync |
| Umbral histórico cuestionado | Baja | Alta | No afirmar snapshot remoto |
| QA visible | Media | Media | Filtrar unidad/empresa |
| Inspecciones en móvil | Media | Media | Usar laptop |
| Favicon 404 | Alta | Nulo | Ignorar |
| Servidor no levantado | Media | Alta | Arranque previo/checklist |

---

## 17. Guion técnico mínimo recomendado

1. Levantar el servidor local.
2. Abrir Rendimiento.
3. Iniciar sesión con cuenta previamente validada.
4. Mostrar la empresa activa.
5. Aplicar un filtro conocido.
6. Abrir una unidad previamente seleccionada.
7. Mostrar indicadores sin afirmar que presión/IDI son definitivos.
8. Navegar a Servicios.
9. Mostrar Inventario.
10. Volver a Rendimiento.
11. Cerrar con el alcance actual y próximos pasos.

No se recomienda improvisar:

- cambios de umbral;
- capturas remotas nuevas;
- operaciones de taller no ensayadas;
- datos de otra empresa;
- explicaciones de presión CALIENTE.

---

## 18. Protocolo para comparar este reporte con otra IA

La comparación debe responder:

1. ¿Ambos reportes separan UI funcional de exactitud de negocio?
2. ¿Ambos distinguen pre-login de post-login?
3. ¿Ambos reconocen que el servidor local funciona?
4. ¿Ambos detectan que IDI no cruza el sync?
5. ¿Ambos detectan pérdida de snapshots RTD?
6. ¿Ambos detectan la regla de presión fija?
7. ¿Ambos diferencian la regla provisional de un crash?
8. ¿Ambos mencionan grants excesivos?
9. ¿Ambos detectan `fn_rtd_state` fuera de migraciones?
10. ¿Ambos identifican los tests SQL no ejecutados?
11. ¿Ambos evitan declarar listo el post-login sin credenciales?
12. ¿Ambos clasifican la demo local como distinta del despliegue público?
13. ¿Ambos consideran el layout fijo de Inspecciones?
14. ¿Ambos corrigen la exageración sobre ausencia total de test anti-carrera?
15. ¿Ambos proponen un ensayo concreto antes del lunes?

### Puntaje sugerido

| Criterio | Puntos |
|---|---:|
| Evidencia reproducible | 20 |
| Separación hecho/inferencia | 15 |
| Exactitud sobre Supabase | 15 |
| Cobertura de riesgos demo | 15 |
| Priorización por severidad real | 10 |
| Reconocimiento de límites | 10 |
| Acciones concretas | 10 |
| No inventar correcciones | 5 |
| **Total** | **100** |

---

## 19. Resumen machine-readable

```yaml
report:
  date: "2026-07-25"
  timezone: "America/Lima"
  commit: "ddcc9d241f7c830f1acfc5db885fff12c5fdbc00"
  independent_from: "auditoria_lunes/"
  supabase_project: "fbxupwwgiebhlciqftpw"

demo:
  target: "local laptop"
  url: "http://127.0.0.1:8766/rendimiento.html"
  pre_login_status: "GO"
  authenticated_status: "PENDING_REHEARSAL"
  full_product_status: "NOT_COMPLETE"
  analytics_accuracy_status: "PROVISIONAL"

tests:
  current_run:
    app: 47
    app_movimientos: 5
    buscador: 19
    servicios: 38
    inventario: 15
    total: 124
    failed: 0
  lint: "PASS"
  docs_check: "PASS"
  golden_parity_from_audit: "48/48"

browser:
  desktop: "PASS"
  mobile_login: "PASS"
  rendimiento: 200
  servicios: 200
  inventario: 200
  inspecciones: 200
  post_login_tested: false
  inventory_favicon_404: true
  inspecciones_min_width_px: 1280

findings:
  - id: F-01
    title: "RTD snapshots discarded"
    severity_product: high
    severity_demo: medium
    fixed: false
  - id: F-02
    title: "Pressure uses fixed 100/130 rule"
    severity_product: high_if_presented_as_final
    severity_demo: medium
    fixed: false
    known_provisional: true
  - id: F-03
    title: "IDI not synced"
    severity_product: high
    severity_demo: low_medium
    fixed: false
  - id: F-04
    title: "Excessive DML grants on views"
    severity_product: medium_high
    fixed: false
  - id: F-05
    title: "ISA cannot represent zero"
    severity_product: medium
    fixed: false
  - id: F-06
    title: "Queue race lacks real SQLite integration"
    severity_product: low_medium
    implemented: true
    unit_tested: true
    integration_tested: false
  - id: F-07
    title: "fn_rtd_state missing from migrations"
    severity_product: medium
    fixed: false
  - id: F-08
    title: "Operator login fix not remotely verified"
    severity_demo: medium
    implemented: true
    verified_real_auth: false
  - id: F-09
    title: "Dashboard post-login not tested in current review"
    severity_demo: high
    fixed: false
  - id: F-10
    title: "SQL/write tests not executed"
    severity_product: medium_high
    fixed: false

recommendation:
  monday_demo: "GO_CONDITIONED"
  mandatory_action: "authenticated dress rehearsal"
  avoid_before_demo:
    - "large production migrations"
    - "changing RTD thresholds"
    - "claiming pressure rule is final"
    - "claiming remote IDI exists"
```

---

## 20. Evidencia reproducible

Comandos relevantes:

```bash
cd app
npm test
npm run lint

cd "../app movimientos"
npm test

cd ../WEB/buscador
npm test

cd ../servicios
npm test

cd ../inventario
npm test

cd ../..
npm run docs:check
```

Smoke HTTP:

```bash
curl -I http://127.0.0.1:8766/rendimiento.html
curl -I http://127.0.0.1:8766/servicios.html
curl -I http://127.0.0.1:8766/inventario.html
curl -I "http://127.0.0.1:8766/Inspecciones%20por%20unidad.html"
```

Artefactos visuales temporales generados:

```text
/tmp/rendimiento-desktop.png
/tmp/rendimiento-mobile.png
```

---

## 21. Conclusión final

RENOVA INSPECTOR tiene una base técnica estable para la demo:

- tests verdes;
- navegación local disponible;
- login gate correcto;
- páginas principales cargando sin fallos funcionales;
- Rendimiento responsive en la superficie evaluada.

Los hallazgos altos del audit no son fallos que derriben la página. Son diferencias entre lo que
el producto calcula/promete y lo que finalmente persiste o presenta:

- snapshots RTD no reproducibles completamente;
- presión web provisional;
- IDI ausente en remoto.

La decisión correcta no es cancelar la demo ni intentar corregir todo de urgencia. Es:

1. hacer un ensayo autenticado exacto;
2. seleccionar los datos que se mostrarán;
3. declarar honestamente qué métricas son provisionales;
4. posponer migraciones sensibles hasta después de la demo y probarlas en staging.

**Veredicto definitivo para el lunes:**  
**GO condicionado para demo local en laptop.**  
**Pendiente obligatorio: ensayo autenticado completo con la cuenta y los datos reales del guion.**
