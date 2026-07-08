# RUN 6 — Guion de demo (jueves)

## Preparación (5 min antes)

1. Verificar que existen (NO están en git): `supabase-config.local.js` (raíz) y
   `app/.env.local` — ambos con URL + clave anon del proyecto `fbxupwwgiebhlciqftpw`.
2. `cd app && npm run dev` (o el APK con el mismo `.env` compilado).
3. Abrir en pestañas: `rendimiento.html`, `inspecciones-demo.html`, `vista-flota.html`
   (basta abrirlas como archivo o con `python3 -m http.server` en la raíz).
4. Confirmar el badge verde **"DATOS: SUPABASE · CIVA"** en cada pestaña.

## Demo — parte 1: los dashboards leen datos REALES

1. **rendimiento.html** — elegir unidad 2145.
   - Mostrar Tracción: Km/mm 5,619 · Km proyectado 67,430 · $0.0014/km —
     **los mismos números del Excel real** (tener el PDF a mano para comparar).
   - Abrir el panel **"Datos fuente · instalación e inspección"**: código de casco
     25324, instalado 19/08/2025 @ 176,752 km, RTD 16 mm → última inspección
     14/01/2026 @ 244,182 km, RTD 4/4/4. Mensaje: *"cada métrica tiene su
     evidencia; nada es una caja negra"*.
   - Señalar "sin dato" en presión/inspector: *"no inventamos datos que el Excel
     no tiene"*.
2. **inspecciones-demo.html** — las 10 inspecciones históricas de CIVA, por
   posición, con estado RTD semáforo. Señalar una posición N/V (gris, cursiva).
3. **vista-flota.html** — elegir la fecha más reciente; semáforo por unidad.

## Demo — parte 2: la app alimenta Supabase en vivo

4. En la app: elegir empresa → unidad (una placa nueva, ej. "999") → odómetro.
5. Cargar RTD/presión de todas las posiciones. Mostrar el tick amarillo
   **GUARDADO** (SQLite local — funciona sin internet).
6. Al completar la última posición: aparece **"ENVIANDO A SUPABASE…"** →
   **"☁ SINCRONIZADO"** (automático, con reintento si se corrige algo).
7. Recargar `inspecciones-demo.html` → **la inspección recién capturada aparece
   primero** (placa 999, fecha de hoy, con estados calculados por el servidor).
8. (Opcional) Modo avión → capturar otra → mostrar que la app sigue funcionando
   local y el dashboard cae a "DATOS: DEMO LOCAL (MOCK)" si se le corta la red.

## Qué decir sobre lo que queda

- **Mock/fallback:** los dashboards conservan datos de demostración como red de
  seguridad sin conexión; inventario e historial siguen 100% mock.
- **Pendiente post-jueves:** RLS + auth (hoy demo privada), cola de sync
  persistente en la app (hoy reintenta solo con la pantalla abierta), fotos,
  pull de catálogo, fórmula oficial de % desgaste (Excel vs dashboard), retén/
  descarte/reinstalación (a propósito NO conectados).
