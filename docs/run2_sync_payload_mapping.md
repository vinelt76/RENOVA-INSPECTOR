# Run 2 — Payload de sync: app → Supabase

Mapeo EXACTO de lo que el teléfono debe insertar en Supabase, campo por campo, a partir de las
tablas locales `inspeccion_cabecera` / `inspeccion_neumatico` (SQLite). Fuente: Run 1
(`run1_data_flow_audit.md`) + código real (`app/src/db/repos/inspeccionRepo.ts`).

## Orden de resolución del push (drainer del `sync_queue`)

```
1. company_id  = SELECT id FROM companies WHERE legacy_code = <empresa_id local>   (falla → error a la cola)
2. unit_id     = upsert units ON CONFLICT (company_id, plate)                       (crea la unidad si no existe)
3. inspections           ← upsert por id (id del DISPOSITIVO, LWW por updated_at)
4. inspection_measurements ← upsert por id (ídem), SIEMPRE después de su cabecera
```

Regla task_14: cabeceras antes que neumáticos; borrar de `sync_queue` solo tras confirmación.

## 1. Cabecera — local `inspeccion_cabecera` → `inspections`

| Campo local (SQLite) | Columna Supabase | Transformación |
|---|---|---|
| `id` (UUID v4 dispositivo) | `id` | tal cual — el servidor NO genera id |
| `empresa_id` (slug: `movil`) | `company_id` | resolver vía `companies.legacy_code` |
| `numero_unidad` (+`empresa_id`) | `unit_id` | resolver/crear vía `(company_id, plate)` |
| `fecha` (`YYYY-MM-DD`) | `inspected_on` | tal cual (date local del dispositivo, Perú UTC−5) |
| `km_odometro` | `odometer_km` | tal cual (integer) |
| `foto_unidad` (dataURL base64) | `unit_photo_url` | fase demo: NO enviar (NULL). Run 3: subir a Storage y guardar el path |
| `created_at` | `device_created_at` | tal cual |
| `updated_at` | `updated_at` | tal cual — clave del last-write-wins |
| `sincronizado` | — | no viaja (estado local de la cola) |
| — | `inspector_id` | NULL hasta que haya auth |

## 2. Medición — local `inspeccion_neumatico` → `inspection_measurements`

| Campo local | Columna Supabase | Transformación |
|---|---|---|
| `id` (UUID dispositivo) | `id` | tal cual |
| `cabecera_id` | `inspection_id` | tal cual (es el mismo UUID de la cabecera) |
| — | `company_id` | mismo `company_id` resuelto para la cabecera |
| `posicion` | `position_number` | tal cual |
| `codigo` | `tire_code` | tal cual ('No visible'/'Sin código' viajan como texto) |
| `marca` / `modelo` / `medida` | `brand_name` / `model_name` / `size_name` | tal cual (texto; FK a catálogo = Run 3) |
| `condicion` | `condition` | tal cual ('N','R1',…) |
| `reencauche` | `retread_design` | tal cual |
| `r1` / `r2` / `r3` / `r4` | `rtd_a_mm` / `rtd_b_mm` / `rtd_c_mm` / `rtd_d_mm` | tal cual (numeric; NULL si no medido) |
| `presion` | `pressure_psi` | tal cual (NULL = sin medir) |
| `tapa_valvula` | `valve_cap` | tal cual |
| `anomalia` | `anomaly` | tal cual (NULL = sin anomalía) |
| `rtd_movi` | `rtd_movi_mm` | tal cual — calculado en el dispositivo, el server NO recalcula (fase 1) |
| `idi` | `idi_mm` | tal cual |
| `estado_rtd` | `rtd_state` | tal cual (los literales del enum coinciden: 'Normal', 'Próximo a Reencauche', 'Para Reencauche') |
| `desecho` (0/1) | `is_discard` | `desecho === 1` |
| `updated_at` | `device_updated_at` + `updated_at` | tal cual |
| — | `life_cycle_id` | **NO lo manda la app.** NULL en demo; en Run 3 lo resuelve el servidor contra la instalación activa de (unit, position) |
| — | `temperature_mode`, `pressure_state`, `anomaly_photo_url` | NULL — la app aún no los captura |

## 3. Payload REST (PostgREST) — lo que ejecutará el drainer

```http
POST {SUPABASE_URL}/rest/v1/inspections
apikey: {ANON_KEY}            ← demo sin RLS; producción: JWT del inspector
Authorization: Bearer {KEY}
Content-Type: application/json
Prefer: resolution=merge-duplicates      ← upsert por PK (id del dispositivo)

{
  "id": "99999999-9999-4999-8999-999999999999",
  "company_id": "11111111-1111-4111-8111-111111111111",
  "unit_id": "33333333-3333-4333-8333-333333333333",
  "inspected_on": "2026-07-09",
  "odometer_km": 160000,
  "device_created_at": "2026-07-09T14:02:11.000Z",
  "updated_at": "2026-07-09T14:22:31.000Z"
}
```

```http
POST {SUPABASE_URL}/rest/v1/inspection_measurements
Prefer: resolution=merge-duplicates

[
  {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
    "company_id": "11111111-1111-4111-8111-111111111111",
    "inspection_id": "99999999-9999-4999-8999-999999999999",
    "position_number": 1,
    "tire_code": "CAS-001", "brand_name": "Michelin", "size_name": "295/80R22.5",
    "condition": "N",
    "rtd_a_mm": 11.5, "rtd_b_mm": 11.2, "rtd_c_mm": 11.0, "rtd_d_mm": null,
    "pressure_psi": 105,
    "rtd_movi_mm": 11.0, "idi_mm": 0.5, "rtd_state": "Normal", "is_discard": false,
    "device_updated_at": "2026-07-09T14:22:31.000Z"
  }
  /* … posiciones 2–8 igual … */
]
```

Notas:
- El array completo de mediciones puede ir en UN solo POST (PostgREST hace bulk upsert).
- `resolution=merge-duplicates` reproduce el `ON CONFLICT (id) DO UPDATE` — reintentos del
  drainer son idempotentes.
- El conflicto `UNIQUE(inspection_id, position_number)` solo saltaría si dos dispositivos crean
  ids distintos para la misma posición — en fase 1 no ocurre (una cabecera pertenece a un
  dispositivo). Documentado como caso Run 3 (multi-dispositivo).

## 4. Fallback manual para la demo (sin app conectada)

Idéntico contenido, por SQL: `supabase/demo_inspection_example.sql` (pegar en el SQL Editor).
También sirve `curl`:

```bash
curl -X POST "$SUPABASE_URL/rest/v1/inspections" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates" \
  -d @cabecera.json
```

## 5. Qué cambia en la app (Run 3 — NO en esta demo)

1. `inspeccionRepo` encola en `sync_queue` tras cada escritura (ya previsto en task_14 paso 4).
2. `app/src/sync/client.ts` — cliente supabase-js solo si hay env vars (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`); sin ellas la app es 100% local, **el fallback local/mock no se toca**.
3. `app/src/sync/drain.ts` — al evento `online`: resolver company/unit, POST cabeceras, POST mediciones, marcar `enviado=1`.
4. Ningún cambio de UI ni de fórmulas locales.
