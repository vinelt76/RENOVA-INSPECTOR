---
title: "Infraestructura, seguridad y despliegue"
updated: 2026-07-12
status: vigente
sources: [.github/workflows, app/capacitor.config.ts, app/.env.example, WEB/supabase-demo.js, supabase/migrations]
---

# Infraestructura, seguridad y despliegue

## Entornos

- Desarrollo web: Vite + SQLite web (`jeep-sqlite`/sql.js).
- Android: Capacitor + SQLite nativo.
- Backend: proyecto Supabase identificado en notas históricas como `fbxupwwgiebhlciqftpw`.
- Publicación web: GitHub Pages bajo `/RENOVA-INSPECTOR/`.
- APK: workflow `build-apk.yml`, Node 22, JDK 21, Android SDK 36, artifact debug por 14 días.

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
- Excepciones `anon` para la app móvil son deuda consciente y deben reducirse cuando exista login.

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

