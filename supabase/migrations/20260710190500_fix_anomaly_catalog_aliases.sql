-- Corrige el alias de unión (faltaba la tilde real "unión" que usa el Excel:
-- "Despegue de linea de unión de la banda de rodamiento") y agrega el alias
-- de "Desgaste irregular en banda de rodamiento" (variante con "rodamiento"
-- en vez de "rodado" que ya existe en el catálogo como entrada canónica).
update public.anomaly_catalog
set nombre = 'Despegue de linea de unión de la banda de rodamiento'
where nombre = 'Despegue de linea de union de la banda de rodamiento';

insert into public.anomaly_catalog (nombre, posible_causa, desecho, alias_de) values
('Desgaste irregular en banda de rodamiento', 'Mantenimiento Alineación', false, 'Desgaste irregular en banda de rodado');
