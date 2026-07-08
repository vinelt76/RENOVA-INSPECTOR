# RENOVA INSPECTOR — RLS multi-empresa, login en dashboards, Realtime y publicación

**Fecha:** 2026-07-08
**Por qué existe este doc:** hoy el proyecto solo tiene datos reales de **MÓVIL BUS** (1 sola
empresa). Cuando se integren las ~4 empresas restantes ("todos los carros"), hay que repetir
exactamente el patrón de alta descrito acá — NO improvisar una variante nueva. Este doc explica
qué se hizo, por qué, y el checklist exacto para agregar la siguiente empresa.

---

## 1. Contexto: el problema que se resolvió

Los dashboards HTML (`rendimiento.html`, `instalacion.html`, y los 2 de `INSPECCIONES/`, hoy
todos dentro de `WEB/`) leían Supabase con la **clave `anon`, sin sesión de usuario**. Las 14
tablas públicas de Supabase **no tenían RLS** (Row Level Security). Esto significaba que
publicar el link de un dashboard a una empresa exponía los datos de **todas** las empresas a
cualquiera con el link — el propio repo ya lo tenía documentado como pendiente crítico en
`docs/run2_risks_and_fallback.md` ("RLS desactivada... NO publicar la anon key con RLS off").

El modelo de tenancy multi-empresa ya estaba **diseñado pero no implementado**: tabla
`profiles` (usuario ↔ empresa ↔ rol) vacía, política RLS ya anotada en un comentario SQL sin
aplicar (`company_id = (select company_id from profiles where id = auth.uid())`). Ver
`decisions/0001-tenancy.md` para la decisión original de tenancy row-level (una sola base
Postgres, columna `company_id`, NO schema-per-company).

---

## 2. Modelo de datos multi-empresa (YA implementado, replicar tal cual)

### 2.1 Clasificación de tablas

**10 tablas con `company_id` directo** (datos propios de cada empresa — nunca visibles entre
empresas): `units`, `rtd_thresholds`, `tire_casings`, `tire_life_cycles`, `tire_installations`,
`tire_removals`, `inspections`, `inspection_measurements`, `profiles`, `company_settings`.

**3 tablas de catálogo PATRON compartido, SIN `company_id`** (legibles por cualquier usuario
autenticado de cualquier empresa — es el catálogo común de configuraciones de vehículo):
`vehicle_configs`, `axles`, `tire_positions`.

**`companies`** es la tabla raíz (no tiene su propio `company_id`, es su propio `id`).

### 2.2 Política RLS (aplicada en `supabase/migrations/20260710090000_dashboard_public_rls.sql`)

```sql
-- Helper: empresa del usuario autenticado (SECURITY DEFINER — evita recursión
-- al evaluarse dentro de la propia policy de profiles)
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- Patrón para las 10 tablas con company_id:
create policy "select_own_company" on public.<tabla>
  for select to authenticated
  using (company_id = (select public.current_company_id()));

-- Patrón para las 3 tablas de catálogo compartido:
create policy "select_authenticated" on public.<tabla>
  for select to authenticated
  using (true);

-- companies (join inverso, es la tabla raíz):
create policy "select_own_company" on public.companies
  for select to authenticated
  using (id = (select public.current_company_id()));
```

Además: `revoke insert, update, delete, truncate, references, trigger on <14 tablas> from anon,
authenticated` — defensa en profundidad (RLS ya bloquea por "deny by default" sin policy de
escritura, pero se revoca explícito para documentar que estos dashboards son 100% lectura).

**Por qué `current_company_id()` es `SECURITY DEFINER`:** sin eso, evaluar la policy de
`profiles` dispararía una lectura de `profiles` que a su vez está protegida por... la misma
policy de `profiles` → recursión infinita. `SECURITY DEFINER` bypasea RLS solo dentro de esa
función puntual.

**Nota de bug real encontrado:** al principio se revocó también `EXECUTE` de
`current_company_id()` para `authenticated` (para que el advisor de seguridad no marcara la
función como invocable vía RPC pública). Esto **rompió todo** — las policies SÍ necesitan que
el rol que dispara la query tenga `EXECUTE`, porque la policy se evalúa con los privilegios del
caller, no como llamada interna sin chequeo. Se revirtió: `grant execute on function
current_company_id() to authenticated;` es obligatorio.

### 2.3 Vistas — ya preparadas, NO tocar

Las 17 vistas del proyecto (`v_tire_performance`, `v_rendimiento_dashboard_rows`,
`v_inspection_dashboard_rows`, `v_inventory_status`, etc.) **ya tienen `security_invoker=on`**
desde antes de este trabajo. Eso significa que heredan automáticamente la RLS de las tablas
base — **no hace falta ni hay que tocar ninguna vista** al dar de alta una empresa nueva.

---

## 3. Cómo dar de alta una empresa nueva (checklist para "todos los carros")

Cuando llegue el momento de integrar las empresas restantes, repetir esto por cada una:

1. **Insertar la fila en `companies`** si no existe todavía (hoy solo existe `MÓVIL BUS`,
   `id = f243affb-9e68-5ac2-838a-d0690ff0a670`, `legacy_code = 'movil'`).
2. **Crear el usuario en Supabase Auth** — Dashboard → Authentication → Users → Add user
   (correo + contraseña). **NO insertar directo en `auth.users` por SQL**, no es la vía
   soportada. Anotar el UUID generado.
3. **Insertar la fila en `profiles`**, uniendo usuario ↔ empresa:
   ```sql
   insert into public.profiles (id, company_id, full_name, role)
   values ('<uuid-del-usuario>', '<uuid-de-la-empresa>', 'Nombre', 'fleet_manager');
   ```
4. Ese usuario ya puede loguearse en cualquiera de los dashboards de `WEB/` y va a ver
   **solo** los datos de su empresa — nada más que hacer, RLS ya lo filtra automáticamente.

**No se necesita ninguna migración SQL nueva por empresa** — el esquema y las políticas son
genéricos, ya cubren N empresas.

### 3.1 El caso especial de `pushInspeccion.ts` (la app móvil hoy hardcodea `'MÓVIL BUS'`)

`app/src/sync/pushInspeccion.ts` tiene HOY dos líneas que asumen una sola empresa:

```ts
if (cabecera.empresa_id !== 'movil') return { ok: false, skipped: true, ... };
...
company_name: 'MÓVIL BUS',
```

y `app/src/sync/readInspecciones.ts` tiene el mismo hardcode (`COMPANY_NAME = 'MÓVIL BUS'`)
para el RPC `get_unidad_preload`. **Esto es deuda técnica pendiente, no un bug** — el proyecto
Supabase hoy solo contiene el dataset de MÓVIL BUS. Cuando se integre la siguiente empresa,
esto tiene que generalizarse: en vez de un string fijo, resolver `company_name` desde
`cabecera.empresa_id` (que ya existe localmente en SQLite, ver `seed_rows.ts` — cada empresa
local tiene un `id` tipo `'movil'`, `'cruz'`, `'civa'`, `'ittsa'`, `'cta'`) contra una tabla de
mapeo local↔Supabase, o — mejor — resolviendo por login del inspector una vez que exista auth
de la app móvil (ver §5, `task_14`).

**No generalizar esto todavía sin que el usuario lo pida explícitamente** — mientras Supabase
solo tenga el dataset de una empresa, el hardcode es correcto y deliberado.

---

## 4. La app móvil sigue sin login — por qué el RPC `get_unidad_preload` existe

La app móvil (inspectores en campo) **todavía no tiene pantalla de login** (eso es
`tasks_opencode/task_14_supabase_sync_fase1.md`, en curso, alcance mayor: auth con sesión
persistida offline, tabla `app_user` propia). Sigue escribiendo/leyendo Supabase como rol
`anon`, sin sesión.

Cuando se activó RLS (§2), esto rompió en silencio (**0 filas devueltas, sin error**) el flujo
`UnidadScreen.tsx` → `preloadUnidadFromSupabase.ts` → `readInspecciones.ts`, que buscaba una
unidad en Supabase para precargar su última inspección (kilometraje, RTD, etc. — el síntoma
reportado fue "el 225 no aparece en sugerencias, el kilometraje no aparece").

**Solución aplicada** (mismo patrón que ya usaba `save_inspection` para escritura): un RPC
`SECURITY DEFINER` de **alcance acotado** — nunca reabrir SELECT a `anon` sobre las tablas/
vistas completas (eso deshace la protección de los dashboards), sino una función que solo
devuelve los campos necesarios, filtrada por una placa + una empresa puntual, callable por
`anon`:

```sql
-- supabase/migrations/20260710120000_preload_unidad_rpc.sql
create or replace function public.get_unidad_preload(p_company_name text, p_plate text)
returns table (...)
language sql stable security definer set search_path = public as $$
  select ... from units u
  join companies co on co.id = u.company_id
  join inspections i on i.unit_id = u.id
  join inspection_measurements im on im.inspection_id = i.id
  ...
  where lower(co.name) = lower(p_company_name) and u.plate = p_plate
  order by i.inspected_on desc, im.position_number asc;
$$;
grant execute on function public.get_unidad_preload(text, text) to anon, authenticated;
```

**Patrón a replicar**: cualquier lectura nueva que la app móvil necesite hacer contra Supabase
SIN login de inspector debe seguir esta receta — RPC `SECURITY DEFINER` de alcance acotado
(una placa/una empresa puntual, nunca "traeme toda la tabla"), nunca una policy RLS que
permita `anon`.

**Cuando `task_14` implemente login de inspector real**, este RPC debería poder jubilarse a
favor de que la app lea directo con la sesión del inspector (mismo mecanismo que los
dashboards, §5) — pero mientras tanto es la vía correcta.

---

## 5. Login mínimo en los dashboards HTML (`WEB/supabase-demo.js`)

Módulo compartido único, cargado con `type="module"` (necesario para poder importar
`@supabase/supabase-js` vía CDN ESM `https://esm.sh/@supabase/supabase-js@2`, sin bundler —
estos son HTML sueltos, no pasan por Vite).

API expuesta en `window.RenovaSupabase`:

- `requireAuth()` — pinta un modal de login inline (email + password, sin dependencias
  externas) si no hay sesión; resuelve la Promise cuando el login tiene éxito.
- `signIn`/`signOut`/`getSession`/`onAuthStateChange` — wrappers directos de `supabase.auth`.
- `fetchView(name, params)` — mantiene la firma vieja (`fetch` crudo a `/rest/v1/<vista>` con
  los mismos `params` de PostgREST que ya usaban los 4 HTML), pero ahora el header
  `Authorization` usa el `access_token` de la sesión activa en vez del `anonKey` fijo. Sin
  sesión, cae al comportamiento de `anon` (que con RLS ve 0 filas).
- `onDataChange(tables, cb)` — Realtime, ver §6.

**Detalle de orden de carga (bug real, ya resuelto):** como `supabase-demo.js` es
`type="module"` (diferido), puede terminar de ejecutarse DESPUÉS de que el `<script>` clásico
de cada dashboard llegue a su bloque de inicio, causando "`RenovaSupabase is not defined`"
intermitente. Se resolvió con un script auxiliar minúsculo `WEB/renova-ready.js` (script
clásico, no-module, cargado ANTES) que expone `window.onRenovaSupabaseReady(fn)`: llama `fn()`
inmediato si `window.RenovaSupabase` ya existe, o espera el evento `renova-supabase-ready`
(disparado al final de `supabase-demo.js`) si no. **Todo dashboard nuevo debe envolver su
arranque así:**

```html
<script src="supabase-config.public.js"></script>
<script src="renova-ready.js"></script>
<script type="module" src="supabase-demo.js"></script>
...
<script>
onRenovaSupabaseReady(async () => {
  await RenovaSupabase.requireAuth();
  cargarDatos();
});
</script>
```

### 5.1 `supabase-config.public.js` vs `supabase-config.local.js`

- `supabase-config.public.js` — **commiteado**, con `url` + `anonKey` reales. Es seguro
  commitearlo: la clave `anon`/`publishable` de Supabase es pública por diseño (viaja siempre
  al navegador). Lo que la hacía peligrosa antes era RLS apagada, ya resuelto.
- `supabase-config.local.js` — sigue gitignoreado, para desarrollo local si alguien no quiere
  tocar el archivo público.

---

## 6. Actualización en vivo (Realtime) — solo en los 2 dashboards de INSPECCIONES por ahora

El usuario pidió explícitamente que los dashboards se actualicen solos (sin recargar la
página) cuando la app móvil guarda una inspección. Implementado con **Supabase Realtime**
(WebSocket sobre replicación lógica de Postgres), acotado por ahora a
`INSPECCIONES POR FECHA.html` e `Inspecciones por unidad.html` (decisión explícita: primero
validar el patrón ahí antes de replicarlo en `rendimiento.html`/`instalacion.html`).

### 6.1 Habilitar Realtime en las tablas (una sola vez, ya aplicado)

```sql
-- supabase/migrations/20260710130000_enable_realtime_inspections.sql
alter publication supabase_realtime add table public.inspections;
alter publication supabase_realtime add table public.inspection_measurements;
```

**Importante:** Realtime respeta la misma RLS que SELECT — un usuario logueado solo recibe
eventos de sus propias filas (`company_id` propio). No hace falta ninguna policy extra para
Realtime, la que ya existe para SELECT alcanza.

### 6.2 `RenovaSupabase.onDataChange(tables, cb)`

```js
function onDataChange(tables, cb) {
  if (!enabled) return () => {};
  let timer = null;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(cb, 400); };
  const channel = supabase.channel(`renova-live-${tables.join("-")}`);
  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
  }
  channel.subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}
```

Debounce de 400ms porque `save_inspection()` escribe varias filas de `inspection_measurements`
de una sola inspección de golpe — sin debounce, dispararía un refresh por cada fila.

### 6.3 Detalle importante: NO resetear el estado de navegación del usuario al refrescar

Al conectar el refresh automático se encontraron dos bugs de UX que hay que evitar al replicar
este patrón en dashboards nuevos:

- `INSPECCIONES POR FECHA.html`: `loadSupabaseFleet()` siempre hacía
  `selectedDate = dates[0]` (saltaba a la fecha más reciente). Si el usuario estaba mirando una
  fecha vieja y llegaba un evento Realtime, lo hubiera sacado de ahí de golpe. Fix: parámetro
  `isRefresh` — en refresh, conserva `selectedDate` salvo que haya dejado de existir.
- `Inspecciones por unidad.html`: `select(pos)` (qué posición del vehículo se muestra) solo se
  llamaba en el arranque, no en cada recarga de datos. Fix: en el callback de `onDataChange`,
  re-llamar `select()` preservando la posición actualmente seleccionada.

**Regla general para cualquier dashboard con Realtime:** el refresh debe re-pintar los datos
sin resetear ningún estado de navegación/selección que el usuario haya elegido manualmente.

---

## 7. Publicación pública (GitHub Pages)

### 7.1 Estructura de carpetas

Todos los dashboards HTML + sus 3 JS compartidos viven en una sola carpeta **`WEB/`**, todos
al mismo nivel (sin subcarpetas, rutas relativas simples entre ellos, sin `../`):

```
WEB/
  rendimiento.html
  instalacion.html
  inventario.html              (mock, no conectado a Supabase todavía)
  historial-neumatico.html     (mock, no conectado a Supabase todavía)
  INSPECCIONES POR FECHA.html
  Inspecciones por unidad.html
  supabase-demo.js
  supabase-config.public.js
  renova-ready.js
```

(Antes estaban sueltos en la raíz del repo + una subcarpeta `INSPECCIONES/` con rutas `../` —
se reorganizó todo a `WEB/` plano por pedido explícito del usuario, más simple de razonar.)

### 7.2 Workflow (`.github/workflows/web-preview.yml`)

Un solo job que:
1. Buildea la SPA React (`app/dist`, sirve la app móvil-web en la **raíz** de Pages).
2. Copia `WEB/*.html` y `WEB/*.js` a `app/dist/web/` (subruta, para no chocar con
   `index.html`/`assets/` de la SPA).
3. Sube todo como artifact de Pages.

URLs resultantes:
```
https://<user>.github.io/RENOVA-INSPECTOR/                          ← la app móvil-web (SPA)
https://<user>.github.io/RENOVA-INSPECTOR/web/rendimiento.html      ← dashboards de empresa
https://<user>.github.io/RENOVA-INSPECTOR/web/instalacion.html
https://<user>.github.io/RENOVA-INSPECTOR/web/INSPECCIONES%20POR%20FECHA.html
https://<user>.github.io/RENOVA-INSPECTOR/web/Inspecciones%20por%20unidad.html
```

Requisito único de configuración (ya hecho, una sola vez): GitHub → repo Settings → Pages →
Source = "GitHub Actions" (no "Deploy from a branch").

### 7.3 Bug real encontrado y resuelto: SPA colgada en "CARGANDO…" bajo GitHub Pages

No relacionado con RLS/login — es un bug de infraestructura de la SPA React bajo un `base` no-
raíz. `<jeep-sqlite>` (el componente que inicializa SQLite en el navegador vía WASM) tiene un
atributo `wasmPath` cuyo **default interno es `/assets`** (ruta absoluta desde la raíz del
dominio). Bajo GitHub Pages, con la SPA servida en `/RENOVA-INSPECTOR/`, esto pedía
`sql-wasm.wasm` en `https://user.github.io/assets/sql-wasm.wasm` (raíz del dominio, sin el
prefijo del repo) → GitHub Pages devuelve su 404 HTML ahí → el navegador recibe HTML donde
esperaba un binario WASM → `wasm streaming compile failed: unsupported MIME type text/html` →
la app se cuelga en "Cargando…" para siempre.

Fix en `app/src/db/sqlite.ts`, función `initWebStore()`:

```ts
const el = document.createElement('jeep-sqlite');
el.setAttribute('wasmPath', `${import.meta.env.BASE_URL}assets`);
document.body.appendChild(el);
```

`import.meta.env.BASE_URL` es la forma correcta de Vite de acceder al `VITE_BASE` configurado
en build (`/RENOVA-INSPECTOR/` en Pages, `/` en local) — **cualquier ruta absoluta hardcodeada
a assets en este proyecto debe pasar por `BASE_URL`, no asumir raíz del dominio**, porque el
sitio no vive en la raíz de `github.io`.

**Cómo se depuró:** simulando localmente la subruta exacta de Pages con
`python3 -m http.server` sirviendo `app/dist` copiado dentro de una carpeta con el mismo nombre
del repo (`pages-sim/RENOVA-INSPECTOR/`), en vez de confiar en pushear y esperar el deploy real
para cada iteración — mucho más rápido para iterar.

---

## 8. Archivos tocados — mapa de referencia rápida

| Archivo | Qué hace |
|---|---|
| `supabase/migrations/20260710090000_dashboard_public_rls.sql` | RLS + políticas + revoke grants de escritura (§2) |
| `supabase/migrations/20260710120000_preload_unidad_rpc.sql` | RPC `get_unidad_preload` para la app móvil sin login (§4) |
| `supabase/migrations/20260710130000_enable_realtime_inspections.sql` | Habilita Realtime en 2 tablas (§6.1) |
| `WEB/supabase-demo.js` | Cliente Supabase compartido: sesión, login modal, `fetchView`, `onDataChange` (§5, §6) |
| `WEB/renova-ready.js` | Resuelve el orden de carga módulo-vs-script-clásico (§5) |
| `WEB/supabase-config.public.js` | Config pública (url + anonKey) — segura de commitear (§5.1) |
| `WEB/*.html` (6 archivos) | Dashboards; los 4 que ya leen Supabase tienen login + (2 de ellos) Realtime |
| `app/src/sync/pushInspeccion.ts` | Escritura app→Supabase, hoy hardcodea `'MÓVIL BUS'` (§3.1) |
| `app/src/sync/readInspecciones.ts` | Lectura app←Supabase vía `get_unidad_preload`, mismo hardcode (§3.1, §4) |
| `app/src/sync/preloadUnidadFromSupabase.ts` | Consumidor de `readInspecciones.ts` en `UnidadScreen.tsx` |
| `app/src/db/sqlite.ts` | Fix `wasmPath` para GitHub Pages (§7.3) |
| `.github/workflows/web-preview.yml` | Deploy de la SPA + `WEB/` a GitHub Pages (§7.2) |

## 9. Lo que queda pendiente (fuera de alcance de este trabajo, a futuro)

- **Generalizar el hardcode `'MÓVIL BUS'`** en `pushInspeccion.ts`/`readInspecciones.ts` cuando
  se integre la segunda empresa real (§3.1).
- **Login de inspector en la app móvil** (`tasks_opencode/task_14_supabase_sync_fase1.md`,
  alcance mayor, en curso por separado) — cuando exista, evaluar si `get_unidad_preload` puede
  jubilarse a favor de lectura autenticada directa.
- **Conectar `inventario.html` y `historial-neumatico.html`** a Supabase (hoy 100% mock) — hay
  vistas ya preparadas con `security_invoker=on` esperando (`v_inventory_status`,
  `v_casing_history_summary`, `v_casing_inspections`), decisión explícita de dejarlas fuera en
  esta ronda.
- **Realtime en `rendimiento.html`/`instalacion.html`** — mismo patrón del §6, no implementado
  todavía por decisión de acotar el alcance primero.
- **Versioning/borrado de catálogo desde servidor** (`decisions/0004-catalog-sync.md`) — no
  relacionado con este trabajo, pendiente aparte.
