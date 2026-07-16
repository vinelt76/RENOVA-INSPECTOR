-- RENOVA — El descarte web debe registrar la anomalía crítica concreta, no una
-- categoría genérica. Se agregan al enum existente para mantener compatibilidad
-- con historial y clientes anteriores mientras la UI nueva deja de ofrecerlos.

alter type public.discard_cause add value if not exists 'Carcasa fatigada';
alter type public.discard_cause add value if not exists 'Desgarro en flanco cuerdas expuestas externo';
alter type public.discard_cause add value if not exists 'Desgarro en flanco cuerdas expuestas interno';
alter type public.discard_cause add value if not exists 'Exceso de rodado';
alter type public.discard_cause add value if not exists 'Rotura de cuerda(s) radial(es) externo';
alter type public.discard_cause add value if not exists 'Rotura de cuerda(s) radial(es) interno';
alter type public.discard_cause add value if not exists 'Separación de paquete de cinturones con la cuerdas radiales';
alter type public.discard_cause add value if not exists 'Separación estructural';
alter type public.discard_cause add value if not exists 'Separación por filtración en banda de rodamiento';
alter type public.discard_cause add value if not exists 'Separación por filtración en pestaña';
alter type public.discard_cause add value if not exists 'Zipper en flanco';
alter type public.discard_cause add value if not exists 'Exceso de frenado';
alter type public.discard_cause add value if not exists 'Corte profundo en flanco';

comment on type public.discard_cause is
  'Causas persistidas para descarte. La UI web vigente debe usar anomalías críticas (catalogadas con desecho=true), aunque se conservan valores genéricos históricos por compatibilidad.';
