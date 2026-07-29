---
title: "Infraestructura, seguridad y despliegue"
updated: 2026-07-29
status: vigente
sources: [.github/workflows, app/capacitor.config.ts, app/.env.example, WEB/supabase-demo.js, supabase/migrations, docs/superpowers/plans/2026-07-29-migracion-supabase-sao-paulo.md]
---

# Infraestructura, seguridad y despliegue

## Entornos

- Desarrollo web: Vite + SQLite web (`jeep-sqlite`/sql.js).
- Android: Capacitor + SQLite nativo.
- Backend: proyecto Supabase `fbxupwwgiebhlciqftpw`, región **`us-east-1` (Virginia)**. Decisión
  confirmada el 2026-07-29 con medición, no heredada por inercia: ver «Región del backend».
- Publicación web: GitHub Pages bajo `/RENOVA-INSPECTOR/`.
- APK: workflow `build-apk.yml`, Node 22, JDK 21, Android SDK 36, artifact debug por 14 días.

## Región del backend

`us-east-1` es la elección correcta para la flota peruana, no un accidente. Se evaluó migrar a
`sa-east-1` (São Paulo) para bajar latencia y **se descartó el 2026-07-29 tras medir**. Desde una
conexión real en Lima, tramo edge→origen→primer byte, 14 muestras intercaladas:

| Región | mín | mediana | p90 |
|---|---:|---:|---:|
| `us-east-1` Virginia | 17 ms | **28 ms** | 59 ms |
| `sa-east-1` São Paulo | 42 ms | **86 ms** | 220 ms |

Virginia gana en todos los percentiles. La cercanía geográfica no manda: manda el enrutamiento, y
desde Perú la ruta hacia `us-east-1` está mejor provista.

Además, el beneficio sería marginal aun si la latencia mejorara: la app es offline-first, la captura
escribe en SQLite local y la cola de sync no bloquea al inspector, así que la latencia de la base no
está en el camino crítico de campo. Solo la sienten el sync en segundo plano, los dashboards y el
login.

Dos cosas a tener presentes si el tema se reabre:

- **La API está detrás de Cloudflare.** TCP y TLS terminan en el edge de Lima (6–8 ms) para
  cualquier proyecto, así que comparar `time_connect` entre regiones no mide nada. Hay que aislar el
  tramo edge→origen (`time_starttransfer` menos `time_appconnect`).
- **Supabase no permite cambiar la región de un proyecto.** Hay que crear otro y migrar datos, Auth,
  Storage, claves, URLs y configuración. El plan detallado de ese trabajo, con sus riesgos, quedó en
  `docs/superpowers/plans/2026-07-29-migracion-supabase-sao-paulo.md` (no ejecutado).

Detalle completo y hallazgos colaterales en [[2026-07-29]].

## Propiedad del proyecto

La propiedad del proyecto Supabase fue transferida. Durante la evaluación de 2026-07-29 un perfil del
CLI devolvió `403 LegacyDbConfigLoginRoleStatusError`, consistente con ese cambio. Antes de cualquier
operación administrativa —CLI, rotación de claves, billing, backups, restores— verificar que la
cuenta en uso tenga rol Owner/Admin efectivo en la organización actual.

## Configuración

- App: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` según `app/.env.example`.
- Web: `WEB/supabase-config.public.js` y override local ignorado.
- `anon`/publishable es pública por diseño, pero solo es segura junto con RLS/grants correctos.
- `service_role` o secret keys nunca pertenecen al navegador, APK, Git o estas notas.
- Usuarios y contraseñas se consultan en la nota privada existente del vault humano; no se duplican.

## Modelo de seguridad

- Dashboards llaman `requireAuth()`.
- `profiles.company_id` define el tenant del usuario.
- Políticas `select_own_company` restringen filas.
- Vistas expuestas deben ejecutar como invocador.
- RPCs de taller revocan `PUBLIC`/`anon` y conceden a `authenticated`, además de validar perfil/rol.
- Desde 2026-07-25, las 19 vistas de dashboard conceden solo `SELECT` a `authenticated`; `anon`
  quedó sin acceso (antes arrastraban `INSERT/UPDATE/DELETE/TRUNCATE` de un `GRANT ALL` histórico).

> [!CAUTION]
> **Los datos de flota son legibles SIN sesión.** No es teoría: verificado en producción el
> 2026-07-25 (14 filas reales de MÓVIL BUS 2145 como `anon`). Las tres RPC que usa la app móvil
> —`get_unidad_preload`, `get_umbrales_rtd`, `save_inspection`— son `SECURITY DEFINER` y **no pasan
> por RLS**, y la clave publicable está commiteada y se publica en el bundle estático.
> `requireAuth()` cierra la puerta de la UI, no la de la API.
> **No afirmar en ninguna demo ni documento que los datos exigen autenticación.**
> Riesgo asumido para el piloto, con camino de salida, en `decisions/0010-exposicion-anon-de-la-app-de-inspeccion.md`.

## Despliegue y verificación

```bash
cd app
npm ci
npm run lint
npm test
npm run build
npx cap sync android
```

Para UI/persistencia se exige smoke test de navegador con consola limpia, datos visibles y recarga persistente. Para Supabase se debe aplicar/verificar migración, permisos, RLS y respuesta real del RPC/vista. Para Android, confirmar el artifact o instalar el APK en dispositivo.

## Referencias oficiales

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database](https://supabase.com/docs/guides/database/overview)
- [Capacitor](https://capacitorjs.com/docs)
- [Vite](https://vite.dev/guide/)
- [Obsidian: enlaces internos](https://obsidian.md/help/links)

