---
title: "Índice RENOVA INSPECTOR"
updated: 2026-07-26
status: vigente
sources: [knowledge/human, repository and Supabase audit 2026-07-26]
---

# RENOVA INSPECTOR - Índice para entender el proyecto

> [!IMPORTANT]
> Esta es la entrada recomendada. La información fue revisada contra código, pruebas, migraciones y
> Supabase el **26 de julio de 2026**. No guarda contraseñas ni claves secretas.

## Aprender de cero, en orden

1. [[00 - EMPEZAR AQUI]]
2. [[01 - Que problema resuelve RENOVA]]
3. [[02 - El viaje de una inspeccion]]
4. [[03 - Telefono SQLite y Supabase]]
5. [[04 - La vida de un neumatico]]
6. [[05 - Tableros inventario y taller|05 - Tableros y taller]]
7. [[06 - Diccionario en criollo]]
8. [[07 - Que pasa cuando algo falla]]
9. [[08 - Estado actual y futuro]]
10. [[09 - Links para seguir aprendiendo]]
11. [[10 - Flujo de trabajo para no olvidarme]]
12. [[11 - Seguridad usuarios y empresas]]
13. [[12 - Deuda riesgos y decisiones pendientes]]
14. [[13 - Como se prueba y despliega RENOVA]]
15. [[14 - Mapa tecnico sencillo]]

## Para profundizar sin enlaces rotos

Las explicaciones técnicas versionadas están en `knowledge/ai`:

- `00 - LEER PRIMERO.md`: orden de lectura y jerarquía de fuentes.
- `03 - Arquitectura del sistema.md`: componentes y responsabilidades.
- `04 - Flujo de inspeccion y sincronizacion.md`: cola y payload.
- `05 - Datos y Supabase.md`: tablas, vistas y RPC.
- `06 - Reglas de negocio.md`: mapa de fórmulas.
- `07 - Web dashboards y taller.md`: pantallas y servicios.
- `08 - Infraestructura seguridad y despliegue.md`: permisos y publicación.
- `10 - Roadmap deuda y riesgos.md`: pendientes vigentes.
- `12 - Decisiones e historia.md`: ADR y decisiones superadas.
- `15 - Bitacora diaria.md`: cambios por fecha.

Las fuentes literales siguen estando en `specs/`, `decisions/`, código y migraciones.

## Advertencias que no deben perderse

- La app de inspección todavía usa tres RPC anónimas.
- Inventario sí existe; Comparativo y las acciones antiguas siguen retirados.
- La fórmula de desgaste ya fue acordada; costo/km proyectado sigue abierto.
- Los movimientos ejecutados aún necesitan reconciliación.
- Los builds locales pasan, pero los workflows automáticos de APK/web fueron retirados.
- 411 pruebas verdes no sustituyen una prueba completa de APK y campo.

## Información privada

Los accesos se mantienen fuera de estas guías. No repetir usuarios, contraseñas, tokens ni claves
secretas en documentación compartida.
