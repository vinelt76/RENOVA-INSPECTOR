-- Inspección demo (lo que haría el teléfono / fallback manual)
insert into inspections (id, company_id, unit_id, inspected_on, odometer_km, device_created_at)
values ('99999999-9999-4999-8999-999999999999',
        '11111111-1111-4111-8111-111111111111',
        '33333333-3333-4333-8333-333333333333',
        current_date, 160000, now())
on conflict (id) do update
  set odometer_km = excluded.odometer_km, updated_at = now();

insert into inspection_measurements
  (id, company_id, inspection_id, position_number,
   tire_code, brand_name, size_name, condition,
   rtd_a_mm, rtd_b_mm, rtd_c_mm, rtd_d_mm, pressure_psi,
   rtd_movi_mm, idi_mm, rtd_state, is_discard, device_updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',1,'CAS-001','Michelin','295/80R22.5','N',11.5,11.2,11.0,null,105,11.0,0.5,'Normal',false,now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',2,'CAS-002','Michelin','295/80R22.5','N',11.8,11.4,11.2,null,104,11.2,0.6,'Normal',false,now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',3,'CAS-003','Michelin','295/80R22.5','R1',9.9,9.7,9.5,9.6,108,9.5,0.4,'Normal',false,now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',4,'CAS-004','Bridgestone','295/80R22.5','N',14.6,14.3,14.1,14.2,110,14.1,0.5,'Normal',false,now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',5,'CAS-005','Bridgestone','295/80R22.5','N',14.8,14.5,14.4,14.3,111,14.3,0.5,'Normal',false,now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',6,'CAS-006','Goodyear','295/80R22.5','N',13.9,13.6,13.4,13.5,109,13.4,0.5,'Normal',false,now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000007','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',7,'CAS-007','Continental','295/80R22.5','N',6.8,6.5,6.9,6.6,98,6.5,0.4,'Próximo a Reencauche',false,now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000008','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',8,'CAS-008','Continental','295/80R22.5','N',3.8,3.6,3.9,3.7,96,3.6,0.3,'Para Reencauche',false,now())
on conflict (id) do update
  set rtd_a_mm = excluded.rtd_a_mm, rtd_b_mm = excluded.rtd_b_mm,
      rtd_c_mm = excluded.rtd_c_mm, rtd_d_mm = excluded.rtd_d_mm,
      pressure_psi = excluded.pressure_psi, rtd_movi_mm = excluded.rtd_movi_mm,
      idi_mm = excluded.idi_mm, rtd_state = excluded.rtd_state,
      updated_at = now();
