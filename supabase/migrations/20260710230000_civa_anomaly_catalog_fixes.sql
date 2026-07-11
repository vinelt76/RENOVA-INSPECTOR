-- CIVA: 'Desgaste irregular en la banda de rodamiento' (con artículo 'la')
-- es la redacción real confirmada — reemplaza a la entrada sin 'la' que se
-- había agregado por error para MÓVIL BUS. Sigue como alias de 'Desgaste
-- irregular en banda de rodado'.
update public.anomaly_catalog
set nombre = 'Desgaste irregular en la banda de rodamiento'
where nombre = 'Desgaste irregular en banda de rodamiento'
  and alias_de = 'Desgaste irregular en banda de rodado';

-- 'Cuerdas expuestas' genérica (CIVA, sin ubicación especificada) — entrada
-- nueva, distinta de 'Cuerdas expuestas en banda de rodado'/'en flanco'.
insert into public.anomaly_catalog (nombre, posible_causa, desecho) values
('Cuerdas expuestas', 'Conducción-Ruta', false);
