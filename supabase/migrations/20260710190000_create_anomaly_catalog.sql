-- Catálogo de anomalías de neumático (hoy solo vivía en
-- app/src/db/seed_data/catalogo_patron.json, sembrado local en la app móvil).
-- Se sube a Supabase para que los dashboards web puedan determinar
-- automáticamente si una anomalía es grave (desecho) sin depender solo del
-- check manual is_discard.
--
-- alias_de: permite mapear variantes de texto real del Excel a la entrada
-- canónica del catálogo sin duplicar la fila (ver 'Despegue de linea de
-- unión de la banda de rodamiento' -> alias de 'Separacion de la union de
-- la banda de rodamiento').
create table public.anomaly_catalog (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  posible_causa text,
  desecho boolean not null default false,
  alias_de text references public.anomaly_catalog(nombre),
  created_at timestamptz not null default now()
);

comment on table public.anomaly_catalog is
  'Catálogo de anomalías de neumático (specs/catalogo_patron.md). desecho=true son las anomalías graves que ameritan color crítico en los dashboards, aunque no se haya marcado is_discard manualmente. Fuente: app/src/db/seed_data/catalogo_patron.json.';

alter table public.anomaly_catalog enable row level security;
create policy "select_authenticated" on public.anomaly_catalog
  for select to authenticated
  using (true);
grant select on public.anomaly_catalog to authenticated;

insert into public.anomaly_catalog (nombre, posible_causa, desecho) values
('Avería pasante en banda de rodado', 'Servicio', false),
('Carcasa fatigada', 'Neumático', true),
('Corte profundo en banda de rodado', 'Conducción-Ruta', false),
('Corte profundo en banda de rodado/contacto con chasis', 'Conducción-Mecánico', false),
('Corte profundo en flanco externo', 'Conducción-Ruta', false),
('Corte profundo en flanco interno', 'Conducción-Ruta', false),
('Corte profundo en hombro externo', 'Conducción-Ruta', false),
('Corte profundo en hombro interno', 'Conducción-Ruta', false),
('Corte superficial en banda de rodado', 'Conducción-Ruta', false),
('Corte superficial en flanco externo', 'Conducción-Ruta', false),
('Corte superficial en flanco interno', 'Conducción-Ruta', false),
('Corte superficial en hombro externo', 'Conducción-Ruta', false),
('Corte superficial en hombro interno', 'Conducción-Ruta', false),
('Cuerdas expuestas en banda de rodado', 'Conducción-Ruta', false),
('Daño en el flanco por rozamiento con el chasis', 'Conducción-Mecánico', false),
('Desgarro de banda de rodado e pliegues expuestas', 'Conducción-Ruta', false),
('Desgarro en banda de rodado', 'Conducción-Ruta', false),
('Desgarro en flanco cuerdas expuestas externo', 'Conducción-Ruta', true),
('Desgarro en flanco cuerdas expuestas interno', 'Conducción-Ruta', true),
('Desgarro en flanco externo', 'Conducción-Ruta', false),
('Desgarro en flanco interno', 'Conducción-Ruta', false),
('Desgarro en hombro externo', 'Conducción-Ruta', false),
('Desgarro en hombro interno', 'Conducción-Ruta', false),
('Desgaste circunferencial en banda de rodado/contacto con chasis', 'Conducción-Mecánico', false),
('Desgaste en hombro externo', 'Mantenimiento Alineación', false),
('Desgaste en hombro interno', 'Mantenimiento Alineación', false),
('Desgaste en hombro(s)', 'Mantenimiento Alineación', false),
('Desgaste excesivo en banda de rodamiento', 'Mantenimiento Alineación', false),
('Desgaste excesivo en hombro externo', 'Mantenimiento Alineación', false),
('Desgaste excesivo por pegada de zapata', 'Chofer-Mantenimiento', false),
('Desgaste irregular en banda de rodado', 'Mantenimiento Alineación', false),
('Desgaste puntual en banda de rodamiento', 'Conducción-Mantenimiento', false),
('Despegue de hombro(s)', 'Proveedor', false),
('Desprendimiento de banda de rodado', 'Proveedor', false),
('Diseño de tracción', 'Supervisor-Operario', false),
('Exceso de rodado', 'Conducción-Operario', true),
('Incrustación de objeto en banda de rodado', 'Ruta-Conducción', false),
('Mal emparejamiento por medida', 'Supervisor-Operario', false),
('Mal emparejamiento por rtd', 'Supervisor-Operario', false),
('Normal', 'Normal', false),
('Picaduras en banda de rodado', 'Neumático', false),
('Pitón recto', 'Supervisor-Operario', false),
('Rotura de cuerda(s) radial(es) externo', 'Conducción-Ruta', true),
('Rotura de cuerda(s) radial(es) interno', 'Conducción-Ruta', true),
('Se Cambio Válvula', 'Supervisor-Operario', false),
('Sentido de giro invertido', 'Operario', false),
('Separación de paquete de cinturones con la cuerdas radiales', 'Neumático-Ruta', true),
('Separación estructural', 'Neumático-Ruta', true),
('Separación por filtración en banda de rodamiento', 'Neumático-Ruta', true),
('Separación por filtración en pestaña', 'Neumático-Ruta', true),
('Telas expuestas en flanco', 'Conducción-Ruta', false),
('Válvula averiada', 'Supervisor-Operario', false),
('Zipper en flanco', 'Neumático', true),
('Exceso de frenado', 'Conducción-Operario', true),
('Cuerdas expuestas en flanco', 'Conducción-Ruta', false),
('Desprendimiento de banda de rodado externo', 'Proveedor', false),
('Neumatico sin Aro', 'Supervisor-Operario', false),
('Corte profundo en flanco', 'Conducción-Ruta', true),
('Desgaste irregular en hombros', 'Proveedor', false),
('Desgaste irregular en hombro interno', 'Proveedor', false),
('Desgaste irregular en hombro externo', 'Proveedor', false),
('Desprendimiento de la union de banda de rodamiento en desgaste final', 'Proveedor', false),
('Separacion de la union de la banda de rodamiento', 'Proveedor', false),
('Despegue en la línea de unión del reencauchado', 'Proveedor', false),
('Objeto punzocortante en flanco', 'Neumático-Ruta', false),
('Corte en banda de rodamiento', 'Conducción-Ruta', false),
('Corte en hombro externo', 'Conducción-Ruta', false),
('Perforacion en banda de rodamiento', 'Servicio', false);

-- Alias de textos reales del Excel que no coinciden exacto con el catálogo
-- pero corresponden a la misma anomalía (confirmado 2026-07-10).
insert into public.anomaly_catalog (nombre, posible_causa, desecho, alias_de) values
('Despegue de linea de unión de la banda de rodamiento', 'Proveedor', false, 'Separacion de la union de la banda de rodamiento'),
('Desgaste irregular en banda de rodamiento', 'Mantenimiento Alineación', false, 'Desgaste irregular en banda de rodado');
