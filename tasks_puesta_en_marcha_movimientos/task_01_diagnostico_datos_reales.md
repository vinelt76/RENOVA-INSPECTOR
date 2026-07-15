# task_01 — Diagnóstico de datos reales y calidad de la evidencia

**1. Propietario**: CLAUDE.

**2. Objetivo y resultado observable**
Versionar las consultas que sostienen `AUDIT.md §4` para (a) confirmar la calidad de la evidencia
con la que se va a precargar el primer montaje y (b) tener el indicador permanente de avance de la
puesta en marcha (cuántas posiciones siguen sin línea base). Resultado observable:
`supabase/diagnostics/baseline_profile.sql` existe, corre completo contra el remoto en modo lectura
y reproduce las cifras de `AUDIT.md §4`.

**3. Dependencias y tareas que bloquea**
Depende de: nada. Bloquea: `task_03`.

**4. Archivos**
- Permitidos (exclusivos): `supabase/diagnostics/baseline_profile.sql` (**archivo nuevo**; la
  carpeta `supabase/diagnostics/` no existe — crearla es parte de la tarea).
- Prohibidos: cualquier `supabase/migrations/**`, `supabase/tests/**`, `WEB/**`, `app/**`, y toda
  escritura remota.

**5. Contratos**
Solo lee objetos **verificados**: `companies`, `units`, `inspections`, `inspection_measurements`,
`tire_positions`, `tire_casings`, `tire_life_cycles`, `tire_installations`
(`20260706120000_demo_vertical_slice.sql`). Ningún contrato propuesto participa: la Q5 anticipa la
lógica de `baseline_pending` (`PLAN.md §3.2`) pero la calcula sola, sin depender de la vista nueva.

**6. Pasos**
1. Crear `supabase/diagnostics/` con un encabezado que diga, en la primera línea, que el archivo es
   **solo lectura** y que ninguna consulta escribe.
2. Escribir 5 consultas, cada una con un comentario de qué responde:
   - **Q1** volumen (`AUDIT.md §4.1`).
   - **Q2** cobertura por empresa (`§4.2`).
   - **Q3** calidad de identidad de la última inspección (`§4.3`).
   - **Q4** conflictos de código: multi-unidad, cruce de empresas, empate de fecha, duplicado
     intra-unidad.
   - **Q5** matriz de calidad de la evidencia por posición (`§4.4`), con el mismo orden de
     evaluación que `PLAN.md §3.2`. **`task_03` deriva `baseline_pending` de esta lógica**, así que
     esta consulta es la referencia.
3. Agregar **Q6, el indicador de avance** (es lo que hace útil al archivo después de la puesta en
   marcha):
   ```sql
   select c.name as empresa,
          count(*) filter (where ti.id is not null and ti.origin = 'workshop') as taller,
          count(*) filter (where ti.id is not null and ti.origin = 'baseline')  as linea_base,
          count(*) filter (where ti.id is null
                       and nullif(btrim(im_last.tire_code),'') is not null)     as pendientes,
          count(*) filter (where ti.id is null
                       and nullif(btrim(im_last.tire_code),'') is null)         as vacias_sin_evidencia
     from …
   ```
   Dejarla comentada con una nota: **solo corre después de `task_06`** (la columna `origin` todavía
   no existe). Documentarlo, no ocultarlo.
4. Ejecutar Q1–Q5 contra `fbxupwwgiebhlciqftpw` (MCP `execute_sql`).
5. Anotar el resultado fechado como comentario al pie de cada consulta.
6. Comparar con `AUDIT.md §4`. Si algún número cambió, decirlo en el handoff con la explicación
   (p. ej. inspecciones nuevas sincronizadas después del 2026-07-14).

**7. Invariantes**
- **Cero escrituras.** Ni `DO`, ni funciones, ni tablas temporales. Solo `SELECT` / `WITH`.
- No exponer `service_role`, claves ni credenciales.
- Q4/Q5 evalúan el duplicado de código **dentro de la empresa**: la unicidad es `(company_id, code)`
  (`20260706120000:176-177`). Un código repetido entre empresas **no** es conflicto (`AUDIT.md` B6).
- No inventar cifras: si el remoto no responde, la tarea se detiene y lo reporta.

**8. Casos de error, ambigüedad y concurrencia**
- Remoto inaccesible → detenerse y reportar; **nunca** completar con estimaciones.
- Consulta lenta → adjuntar `explain` como comentario, no cambiar la semántica.
- Q6 antes de `task_06` → falla por columna inexistente. Por eso va comentada con la nota.
- Concurrencia: irrelevante (solo lectura, sin locks).

**9. Criterios de aceptación**
- Q1–Q5 corren sin error y devuelven filas.
- Q5 suma exactamente el universo de posiciones configuradas de las unidades con inspección (2 144
  al 2026-07-14).
- Q2 y Q3 reproducen `AUDIT.md §4.2` y `§4.3`, o el delta está explicado.
- `git diff` toca **un solo** archivo nuevo.

**10. Comandos y verificación**
```bash
# Revisión de forma: ninguna sentencia de escritura.
grep -inE '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b' \
  supabase/diagnostics/baseline_profile.sql   # debe devolver 0 líneas
```
Ejecución vía MCP Supabase `execute_sql` sobre `fbxupwwgiebhlciqftpw`, consulta por consulta.

**11. Rollback / limpieza**
No aplica: la tarea no escribe datos ni cambia rutas públicas. Revertir = borrar el archivo.

**12. Handoff a `STATE.md`**
Fila `task_01` → `Resultado`: ruta del archivo, fecha de la corrida, y las cifras que `task_03`
necesita para justificar `baseline_pending`: cuántas posiciones quedan pendientes de línea base,
cuántas sin evidencia, cuántas ya de taller. Si difieren de `AUDIT.md §4.4`, anotar el delta y el
motivo. `Revisión`: salida del `grep` (0 líneas) y confirmación de que las 5 consultas corrieron.
