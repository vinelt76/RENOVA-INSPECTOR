---
title: "Cómo se prueba y despliega RENOVA"
updated: 2026-07-26
status: vigente
sources: [scripts/verify-all.mjs, package.json, app/package.json, app movimientos/package.json, HOSTING_PRIVADO.md, repository audit 2026-07-26]
---

# Cómo se prueba y despliega RENOVA

## La verificación integral

Desde la raíz del proyecto:

```bash
npm run verify
```

Este comando no se limita a decir “pasó”. Cuenta las pruebas de cada zona para detectar si una suite
desapareció sin avisar.

Al 26 de julio ejecutó 411 pruebas:

- app de inspección: 47;
- app de movimientos: 5;
- Movimientos web: 186;
- componentes web compartidos: 50;
- Servicios: 38;
- Rendimiento: 51;
- Buscador: 19;
- Inventario: 15.

También ejecutó:

- lint de la app;
- validación de las notas;
- build de la app del inspector;
- build de la app del operario.

Todo quedó verde en esa revisión.

## Qué no prueban esas 411 pruebas

Las suites automáticas no reemplazan:

- instalar el APK en un teléfono;
- comprobar SQLite nativo;
- sacar y subir una foto real;
- cortar internet durante un envío;
- trabajar bajo sol, con teclado y scroll reales;
- confirmar aislamiento visual entre dos empresas;
- comparar la unidad física con la historia guardada.

## Smoke mínimo de una pantalla

1. Abrirla mediante HTTP, no con doble clic `file://`.
2. Iniciar sesión con una cuenta de prueba controlada.
3. Ver datos reales o un estado vacío explicado.
4. Ejecutar el flujo permitido.
5. Recargar y confirmar persistencia.
6. Revisar que la consola no tenga errores.
7. Si escribe en Supabase, confirmar la respuesta o fila real.
8. Si toca permisos, repetir con otra empresa y sin sesión.

## Probar los dashboards localmente

```bash
cd WEB
python3 -m http.server 8080
```

Después abrir `http://localhost:8080/`.

## Preparar un bundle privado

```bash
npm run deploy:bundle
```

Genera `deploy-static/`, que puede subirse manualmente a un hosting privado.

## Estado real de publicación

Los workflows de GitHub que generaban APK y preview web fueron eliminados del commit actual. Por
eso:

- “compila” no significa “está publicado”;
- “existe `deploy-static/`” no significa que una URL esté activa;
- “Capacitor está configurado” no significa que el APK se instaló y probó.

Antes de una demo hay que registrar la URL exacta, fecha del bundle, commit y dispositivo probado.

## Cuándo decir que algo está verificado

- **Implementado:** existe código o migración.
- **Probado automáticamente:** una suite cubre el contrato.
- **Probado contra Supabase:** se verificó la respuesta remota y sus permisos.
- **Probado en navegador:** se recorrió la interfaz real.
- **Probado en campo:** se usó el APK y el proceso con personas/datos controlados.
- **Listo para operar:** negocio y responsables aceptaron criterios y evidencia.

Seguir con [[14 - Mapa tecnico sencillo]].
