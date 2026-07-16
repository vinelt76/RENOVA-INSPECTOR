# task_02 — Migración/vista de lectura

## 1. Propietario y estado

**CLAUDE. N/A.**

## 2. Evaluación

La fase fue autorizada como pantalla sobre lógica ya habilitada. Crear o reemplazar una vista
ampliaría el alcance a esquema, seguridad, despliegue y rollback sin necesidad demostrada por una
consulta actual. Por ello no se crea migración.

## 3. Dependencias

Evaluada después de `task_01`. No bloquea `task_04` mientras se cumpla `CONTRATOS_DATOS.md`.

## 4. Archivos permitidos

Ninguno. Está prohibido crear archivos bajo `supabase/migrations/`, `supabase/tests/` o modificar
DDL existente como parte de esta fase.

## 5. Condición que justificaría otra fase

Una prueba autenticada demuestra alguno de estos hechos:

- `v_inventory_status` no existe o no es accesible al rol previsto;
- no permite identificar descartados de forma no ambigua;
- filtra mal por empresa o expone a `anon`;
- las columnas obligatorias contradicen `CONTRATOS_DATOS.md`;
- la vista no respeta RLS por ser definer/insegura.

Ese hallazgo bloquea la pantalla y genera un nuevo plan de esquema. No cambia esta tarea a “en
curso” ni se escribe SQL improvisado.

## 6. Criterio de aceptación

Fila 02 de `STATE.md` en N/A con la justificación anterior. Cero diff en `supabase/`.

## 7. Pruebas, rollback y handoff

No aplican. El revisor final confirma con `git diff --name-only` que esta fase no tocó Supabase.
