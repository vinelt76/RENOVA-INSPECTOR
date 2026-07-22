# RENOVA Movimientos

App Android/Capacitor para que los **operarios** ejecuten las órdenes emitidas por un
**supervisor de neumáticos**. Es una app distinta de RENOVA Inspector: el rol `inspector`
continúa alimentando inspecciones y no puede entrar a este flujo.

## Flujo v0.1

1. El supervisor crea una orden corta para una unidad: posiciones, salida/ingreso, razón e
   indicaciones.
2. Un operario de la misma empresa inicia sesión, toma la orden y captura el kilometraje que
   muestra la máquina una sola vez.
3. Completa cada renglón de salida/ingreso: código, posición, marca, medida, diseño, RTD mínimo,
   condición, diseño de reencauche cuando aplica y observaciones. Las salidas además conservan
   la razón humana: reparación, retén, reclamo, rotación, scrap, reencauche o balanceo.
4. El borrador queda versionado en el equipo. Al completar, la RPC valida usuario, rol,
   empresa, configuración de posiciones y que el odómetro no retroceda.

Los registros operativos nacen con `reconciliation_status=pending`. Esto permite empezar a
capturar desde ahora aunque una empresa todavía tenga la línea base en Excel. No se inventa una
instalación previa: luego se reconcilian los eventos con casco/ciclo/instalación.

## Configuración

Copiar `.env.example` a `.env.local` y completar la URL + **clave publicable** de Supabase.
Nunca colocar `service_role` ni una clave secreta en la app.

El campo `USUARIO` acepta correo o un nombre corto. Un nombre como `jrojas` se convierte de
forma determinista a `jrojas@operarios.renova.local`; la cuenta de Auth debe aprovisionarse con
ese correo interno y tener una fila `profiles` activa con `role='operator'` y su `company_id`.

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
