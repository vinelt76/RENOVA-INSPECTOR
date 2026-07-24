---
title: "Flujo de trabajo para no olvidarme"
updated: 2026-07-23
status: vigente
sources: [scripts/sync-project-docs.mjs, scripts/knowledge-day.mjs, CLAUDE.md, knowledge/ai/14]
---

# Flujo de trabajo para no olvidarme

## La idea corta

El programa cambia primero. Después se actualizan las explicaciones en `knowledge/`. Al final se copian a Obsidian.

**Obsidian es la copia cómoda para leer. La fuente que se conserva con el proyecto está en `knowledge/`.**

## Al empezar una sesión

Desde la carpeta principal del proyecto:

```bash
npm run docs:status
```

Esto compara el proyecto con la última vez que se mandaron las notas a Obsidian.

- **PEQUEÑOS:** se pueden acumular hasta terminar la sesión.
- **IMPORTANTES:** cambió una zona delicada como sync, base, reglas, dependencias o Supabase.
- **ENORMES:** cambiaron muchos archivos, varias zonas delicadas o una cantidad grande de contenido.

## Mientras se trabaja

No hace falta sincronizar por cada color, texto o arreglo pequeño. Conviene actualizar las notas cuando cambia alguna de estas cosas:

- cómo viaja o se guarda un dato;
- estructura de la base;
- reglas o fórmulas;
- pantallas o pasos importantes;
- permisos/usuarios/empresas;
- arquitectura, dependencias o despliegue;
- qué está terminado y qué falta.

## Saber qué se hizo cada día

Además de las explicaciones por tema, existe una bitácora ordenada por fecha. Para crear o
actualizar la entrada de hoy:

```bash
npm run docs:day
```

La nota queda en `knowledge/ai/bitacora/AÑO/AAAA-MM-DD.md`. Allí se escribe qué cambió, por qué,
qué archivos se tocaron, cómo se probó y en qué commit quedó. El comando también busca los commits
de esa fecha; si todavía no se hizo commit, lo deja claramente como pendiente.

Para reconstruir un problema más adelante:

1. Abrir la fecha aproximada en la bitácora.
2. Leer la razón y los riesgos anotados.
3. Usar el hash con `git show HASH`.
4. Comparar los archivos actuales con ese commit antes de revertir o corregir.

## Al terminar una sesión importante

1. Actualizar las notas correspondientes dentro de `knowledge/ai` y `knowledge/human`.
2. Dejar escrito qué funcionaba antes si explica una decisión importante. No hace falta guardar copias completas de todo.
3. Validar:

```bash
npm run docs:check
```

4. Mirar qué se va a copiar:

```bash
npm run docs:sync -- --dry-run
```

5. Sincronizar:

```bash
npm run docs:sync
```

6. Confirmar que quedó al día:

```bash
npm run docs:status
```

Debe responder que la documentación está al día.

## Cuándo hacerlo sí o sí

- Después de un cambio grande.
- Antes de pasar el proyecto a otra IA.
- Antes de una demo o entrega.
- Cuando `docs:status` diga IMPORTANTES o ENORMES.
- Aunque no haya grandes cambios, una revisión semanal evita que se acumule demasiado.

## Qué conserva y qué reemplaza

`docs:sync` reemplaza en Obsidian las notas que administra. No toca contraseñas, `.obsidian/`, comandos personales ni otras notas manuales. Las versiones anteriores de las notas se recuperan desde Git si fueron guardadas en un commit; las decisiones importantes también deben quedar resumidas en la nota de historia.

## Regla simple para recordar

> Si el cambio haría que otra persona explique mal cómo funciona RENOVA, hay que actualizar la documentación antes de sincronizar.
