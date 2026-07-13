# Levantar los dashboards HTML en local — presentación

Los HTML de `WEB/` cargan Supabase con `<script type="module">`, así que **no
funcionan abriéndolos directo con doble clic** (`file://`) — el navegador
bloquea los módulos ES por CORS. Hay que servirlos por HTTP, aunque sea local.

## Opción A — Python (ya viene instalado, no requiere nada más)

```bash
cd "/home/facundo/Vídeos/RENOVA-INSPECTOR/WEB"
python3 -m http.server 8080
```

Abrir en el navegador: **http://localhost:8080/**

Para cortar el servidor: `Ctrl+C` en la terminal donde quedó corriendo.

## Opción B — Node / npx (si Python no está disponible)

```bash
cd "/home/facundo/Vídeos/RENOVA-INSPECTOR/WEB"
npx serve -l 8080
```

(la primera vez pide confirmar instalar el paquete `serve` — responder `y`)

## Dashboards disponibles en WEB/

| Archivo | URL local |
|---|---|
| `rendimiento.html` | http://localhost:8080/rendimiento.html |
| `instalacion.html` | http://localhost:8080/instalacion.html |
| `historial-neumatico.html` | http://localhost:8080/historial-neumatico.html |
| `importar.html` | http://localhost:8080/importar.html |
| `INSPECCIONES POR FECHA.html` | http://localhost:8080/INSPECCIONES%20POR%20FECHA.html |
| `Inspecciones por unidad.html` | http://localhost:8080/Inspecciones%20por%20unidad.html |

> Los nombres con espacios necesitan `%20` en la URL, o simplemente entrar por
> **http://localhost:8080/** y hacer clic en el archivo desde el listado que
> muestra el servidor.

## Notas

- Cada dashboard exige login contra Supabase (`RenovaSupabase.requireAuth()`).
  Usar las credenciales de prueba de cada empresa.
- Los datos vienen del proyecto Supabase real (`fbxupwwgiebhlciqftpw`), no de
  datos de prueba locales — lo que se vea en el dashboard es el estado actual
  de la base.
- Si el puerto 8080 está ocupado, cambiar el número en el comando (ej. `8081`)
  y ajustar la URL.
