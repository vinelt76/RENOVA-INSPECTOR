# RUN 6 — Verificación end-to-end (Fase 9)

## Camino app → Supabase (probado por REST con clave anon, igual que la app)

`POST /rest/v1/rpc/save_inspection` con el payload exacto que arma
`pushInspeccion.ts` (placa nueva TEST-E2E / TEST-DEMO, ítem con código N/V,
ítem con presión NULL, condición "NUEVO"):

| Check | Resultado |
|---|---|
| RPC responde con anon key (grants correctos) | ✓ `{inspection_id, unit_id, plate, measurements}` |
| `inspections.id` = UUID local del dispositivo | ✓ |
| Unidad nueva creada `pending_validation`, config 2-4-2 | ✓ |
| N/V → `tire_code NULL` (no se guarda "N/V") | ✓ |
| "NUEVO" → condition 'N' | ✓ |
| `rtd_movi` faltante → server calcula MIN(9,9,9) = 9 | ✓ |
| `rtd_state` server-side por umbrales: 7.5 → Normal; 5 → Próximo a Reencauche | ✓ |
| presión NULL → `pressure_state = 'Sin Medir'`; anomalía conservada | ✓ |
| **Idempotencia**: 2º push mismo `local_id`/fecha → misma inspección, odómetro actualizado, sin filas duplicadas | ✓ |
| Aparece en `v_inspection_dashboard_rows` vía REST anon | ✓ |
| **Limpieza**: datos de prueba borrados; estado final = 10 inspecciones / 28 mediciones (igual que antes) | ✓ |

## Camino Supabase → HTML (headless Chrome real)

Ver detalle en `run6_supabase_to_html_test_results.md`:
rendimiento / inspecciones-demo / vista-flota con datos reales CIVA, 0 errores de
consola, y fallback a mock verificado bloqueando la red.

## App

| Check | Resultado |
|---|---|
| `npm run build` (tsc + vite) | ✓ |
| `npm test` (data layer / calculations) | ✓ 23/23 |
| Sin Supabase configurado → 100% local, sin cambios | ✓ (por diseño: `supabase === null` → `skipped`) |
| Fallo de red durante push → no crashea | ✓ (`pushInspeccionToSupabase` nunca lanza; UI muestra "⚠ ERROR DE ENVÍO") |

## No probado end-to-end físico

- Captura desde el APK en un teléfono real → pendiente para el ensayo previo a la
  demo (el camino completo quedó probado por REST con el mismo payload y la misma
  clave anon que usará la app; falta solo el ensayo con el dispositivo).
