# Fase: saneamiento de datos y rendimiento de Supabase

Estado: **PENDIENTE — no aplicar índices de rendimiento todavía**.

## Motivo

La producción conserva datos de prueba `QA-TEST` asociados a `QA-CN16` y
variantes de escritura en `brand_name`. Medir o indexar sobre ese conjunto puede
priorizar consultas y cardinalidades que no representan la operación real.

El objetivo de esta fase es primero dejar el dataset apto para medición y luego
decidir los índices basados en evidencia. No autoriza borrar ni modificar datos
productivos sin una decisión humana explícita.

## Alcance de saneamiento

1. Decidir el tratamiento de `QA-CN16`, sus 9 cascos `QA-TEST` y 14 mediciones
   de prueba: conservarlos como fixture aislado, moverlos a un entorno de prueba
   o eliminarlos con respaldo/auditoría aprobados.
2. Normalizar las futuras escrituras de `brand_name` con `upper(trim())` en la
   ruta/RPC de escritura correspondiente.
3. Preparar y aprobar un backfill auditable para las variantes históricas de
   marca. No crear un catálogo nuevo solo para ese fin.
4. Revalidar identidad de cascos sin código y cobertura de la línea base antes
   de tomar métricas de producción como representativas.

## Índice candidato posterior al saneamiento

La pantalla futura de servicios leerá ejecuciones de una empresa ordenadas por
fecha de captura. El candidato identificado es:

```sql
create index if not exists tire_movement_executions_company_captured_idx
  on public.tire_movement_executions (company_id, captured_at desc, sequence);
```

No se crea ahora. La definición pertenece al contrato de `v_tire_services`,
pero su aplicación queda diferida hasta completar esta fase y medir el acceso
real. Los índices vigentes por `(company_id, reconciliation_status, captured_at)`
y por `(order_id, sequence)` no cubren como prefijo ese recorrido por empresa y
fecha.

## Condiciones de entrada para indexar

- Decisión humana documentada sobre los datos `QA-TEST`.
- Backfill de marcas aprobado y verificado, o una excepción explícita que
  justifique medir sin él.
- Consultas reales de la pantalla y volumen esperado identificados.
- Línea base y datos de taller suficientemente representativos; no inferir
  rendimiento desde el estado actual de una muestra de prueba.

## Verificación obligatoria

1. Ejecutar `EXPLAIN (ANALYZE, BUFFERS)` antes y después sobre la consulta real,
   con RLS y el orden usados por la aplicación:

   ```sql
   select *
   from public.v_tire_services
   order by captured_at desc, sequence asc
   limit 2000;
   ```

2. Confirmar que el plan usa el índice nuevo cuando corresponda y que no degrada
   las escrituras de `tire_movement_executions` de forma inaceptable.
3. Ejecutar los advisors de rendimiento y seguridad de Supabase; separar
   hallazgos nuevos de los preexistentes.
4. Probar aislamiento entre dos empresas y confirmar que la vista conserva
   `security_invoker`, RLS y `SELECT` solo para `authenticated`.
5. Crear la migración con el CLI de Supabase, revisar idempotencia y tener listo
   el rollback `drop index if exists
   public.tire_movement_executions_company_captured_idx;` antes de solicitar
   aprobación para producción.

## Fuentes

- `knowledge/ai/10 - Roadmap deuda y riesgos.md` — deuda de datos canónica.
- `tasks_buscador_global/REVISION_FINAL.md` — conteos y origen de `QA-TEST`.
- `tasks_servicios/CONTRATOS_DATOS.md` §5 — consulta y candidato de índice.
- `tasks_servicios/task_04_aplicacion_remota_y_verificacion.md` §9 — plan de
  medición y aceptación remota.
