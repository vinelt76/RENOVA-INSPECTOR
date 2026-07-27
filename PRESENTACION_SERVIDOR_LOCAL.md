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

---

## Mostrar los dashboards desde el iPad (sin que el técnico vea la laptop)

`localhost:8080` solo existe dentro de la laptop. Para que el iPad vea el
mismo servidor hay que exponerlo. La opción elegida es un **túnel de
Cloudflare**: la laptop crea una URL pública temporal que apunta a su
`localhost:8080`, y el iPad solo necesita internet (de donde sea: wifi del
lugar, hotspot del celular, datos propios) para entrar ahí. No depende de que
la laptop y el iPad estén en la misma red ni de si el hotspot aísla
dispositivos entre sí — por eso es más confiable que compartir el hotspot del
celular a ambos.

`cloudflared` ya está instalado en esta máquina (`/usr/local/bin/cloudflared`,
verificado el 2026-07-26). No hace falta cuenta de Cloudflare para esto.

### Pasos, el día de la presentación

**Terminal 1** — el servidor de siempre:

```bash
cd "/home/facundo/Vídeos/RENOVA-INSPECTOR/WEB"
python3 -m http.server 8080
```

**Terminal 2** — el túnel:

```bash
cloudflared tunnel --url http://localhost:8080
```

A los pocos segundos aparece un bloque con una URL parecida a:

```
https://import-staff-replica-caused.trycloudflare.com
```

**Esa URL cambia cada vez que corres el comando** — no es la misma de un
ensayo al otro. Cópiala de la terminal en el momento, no la guardes de
antemano.

### En el iPad

Abrir Safari y entrar directo a esa URL (o a
`https://<esa-url>/Inspecciones%20por%20unidad.html` para ir directo al panel
que se muestra en vivo en el slide 8). Login normal contra Supabase, como
siempre.

### Para cortar, al terminar

`Ctrl+C` en ambas terminales (primero el túnel, después el servidor). Sin
esto, el túnel sigue expuesto a internet aunque nadie lo esté usando.

### Si algo falla

- **"command not found: cloudflared"** → algo cambió en la máquina; volver a
  la Opción A/B de arriba y compartir el hotspot del celular a ambos
  dispositivos en su lugar (conectando el iPad a la IP LAN de la laptop, no a
  `localhost`).
- **El túnel tarda en responder o da error 502** → el servidor de la Terminal
  1 no está corriendo, o se cayó. Confirmar con `curl -I http://localhost:8080/`
  en la laptop antes de culpar al túnel.
- **Quieres probar que el túnel funciona antes de que llegue nadie** → desde
  cualquier otro dispositivo con internet (tu propio celular, por ejemplo),
  abre la URL y confirma que carga la pantalla de login.
