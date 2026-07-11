import { supabase } from './supabaseClient';
import { getDb, persistDb } from '../db/sqlite';
import { slugify } from '../db/slugify';

// Pull de empresas desde Supabase (public.companies) al arrancar la app.
//
// Modelo: el inspector de RENOVA visita VARIAS empresas y elige cuál inspecciona.
// La lista viene del servidor cuando hay red; el seed local es el fallback
// offline-first. La app móvil lee como `anon` (sin login) gracias a la policy
// `select_companies_anon` (migración 20260710240000).
//
// Fusión POR NOMBRE, no por id: los ids locales son slugs cortos ('movil',
// 'civa') que ya son FK de `unidad` e `inspeccion_cabecera` y clave del
// `empresaId` guardado en localStorage. Los ids de Supabase son UUID. Si
// insertáramos por el UUID tendríamos la misma empresa duplicada. Por eso:
//   - empresa que YA existe local (match por nombre, case-insensitive) → no se
//     toca su id: sus FKs y la selección guardada siguen válidas.
//   - empresa NUEVA del servidor → se inserta con id = slug(nombre).
// Nunca borra empresas locales: aditivo, igual que el pull de catálogo (fase 1).
// El push resuelve la empresa por `company_name`, así que el id local es
// irrelevante para el sync — puede seguir siendo el slug.

interface CompanyRow {
  id: string;
  name: string;
}

export async function pullEmpresas(): Promise<{ ok: boolean; added: number; error?: string }> {
  if (!supabase) return { ok: false, added: 0, error: 'Supabase no configurado' };

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (error) return { ok: false, added: 0, error: error.message };

    const remote = (data ?? []) as CompanyRow[];
    if (!remote.length) return { ok: true, added: 0 };

    const db = await getDb();
    const existing = (await db.query('SELECT id, nombre FROM empresa')).values as
      | Array<{ id: string; nombre: string }>
      | undefined;
    const existingByName = new Map(
      (existing ?? []).map(e => [e.nombre.trim().toLowerCase(), e]),
    );

    const batch: Array<{ statement: string; values: unknown[] }> = [];
    let added = 0;
    for (const c of remote) {
      const name = c.name.trim();
      if (existingByName.has(name.toLowerCase())) continue; // ya existe local → conservar id/FKs
      const id = slugify(name);
      batch.push({
        statement: `INSERT OR IGNORE INTO empresa (id, nombre, flota) VALUES (?, ?, ?)`,
        values: [id, name, null],
      });
      added++;
    }

    if (batch.length) {
      await db.executeSet(batch, true);
      await persistDb();
    }
    return { ok: true, added };
  } catch (e) {
    return { ok: false, added: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
