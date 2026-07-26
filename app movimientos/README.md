# RENOVA Movimientos

App Android/Capacitor para que los **operarios** ejecuten las órdenes emitidas por un
**supervisor de neumáticos**. Es una app distinta de RENOVA Inspector: el rol `inspector`
continúa alimentando inspecciones y no puede entrar a este flujo.

## Flujo v0.1

1. El supervisor crea una orden corta para una unidad: posiciones, salida/ingreso, razón e
   indicaciones.
2. Un operario de la misma empresa inicia sesión, toma la orden y captura el kilometraje que
   muestra la máquina una sola vez.
3. Completa una tarjeta por **servicio/posición atendida**. Cada tarjeta contiene dos grupos:
   **Neumático que sale** (datos + razón) y **Neumático que entra** (datos + origen). En una
   rotación el origen dice la posición de la misma unidad; desde retén/inventario se muestra y
   precarga la llanta elegida por el supervisor.
4. El borrador queda versionado en el equipo. Al completar, la RPC valida usuario, rol,
   empresa, configuración de posiciones y que el odómetro no retroceda.

La presentación agrupada no cambia el contrato técnico: cada grupo sigue enviando una ejecución
`exit` o `entry`. Por eso una rotación entre dos posiciones se ve como **2 servicios**, aunque la
RPC reciba 4 ejecuciones ordenadas.

Los registros operativos nacen con `reconciliation_status=pending`. Esto permite empezar a
capturar desde ahora aunque una empresa todavía tenga la línea base en Excel. No se inventa una
instalación previa: luego se reconcilian los eventos con casco/ciclo/instalación.

## Configuración

Copiar `.env.example` a `.env.local` y completar la URL + **clave publicable** de Supabase.
Nunca colocar `service_role` ni una clave secreta en la app.

El campo `USUARIO` acepta correo o un nombre corto. Un nombre como `jrojas` se convierte de
forma determinista a `jrojas@operarios.renova.local`; la cuenta de Auth debe aprovisionarse con
ese correo interno y tener una fila `profiles` activa con `role='operator'` y su `company_id`.
Si Auth usa otro dominio interno, configurarlo en `VITE_SUPABASE_LOGIN_EMAIL_DOMAINS` (lista
separada por comas). La app prueba los dominios en orden antes de dar el login por inválido.

## Desarrollo y Android

```bash
npm install
npm test
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

La migración de backend está en
`supabase/migrations/20260720012248_operator_movement_orders.sql`.
