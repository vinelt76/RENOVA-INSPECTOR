import { getDb, persistDb, localDate } from '../sqlite';
import type { Unidad } from '../schema';
import type { InspeccionCabecera, InspeccionNeumatico } from '../schema';

export const unidadRepo = {
  async search(empresaId: string, query: string): Promise<Unidad[]> {
    const db = await getDb();
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const result = await db.query(
      `SELECT * FROM unidad 
       WHERE empresa_id = ? AND lower(numero) LIKE ?
       ORDER BY 
         CASE WHEN lower(numero) = ? THEN 0
              WHEN lower(numero) LIKE ? THEN 1
              ELSE 2 END,
         numero`,
      [empresaId, `${q}%`, q, `${q}%`]
    );
    return result.values as Unidad[];
  },

  async getByNumero(empresaId: string, numero: string): Promise<Unidad | null> {
    const db = await getDb();
    const result = await db.query(
      'SELECT * FROM unidad WHERE empresa_id = ? AND numero = ?',
      [empresaId, numero]
    );
    return (result.values?.[0] as Unidad) ?? null;
  },

  async getUltimaInspeccion(empresaId: string, numero: string): Promise<{ cabecera: InspeccionCabecera; neumaticos: InspeccionNeumatico[] } | null> {
    const db = await getDb();
    const cabeceraResult = await db.query(
      `SELECT * FROM inspeccion_cabecera 
       WHERE empresa_id = ? AND numero_unidad = ? 
       ORDER BY fecha DESC, created_at DESC LIMIT 1`,
      [empresaId, numero]
    );
    const cabecera = (cabeceraResult.values?.[0] as InspeccionCabecera) ?? null;
    if (!cabecera) return null;

    const neumaticosResult = await db.query(
      'SELECT * FROM inspeccion_neumatico WHERE cabecera_id = ? ORDER BY posicion',
      [cabecera.id]
    );
    return { cabecera, neumaticos: neumaticosResult.values as InspeccionNeumatico[] };
  },

  async hoy(empresaId: string): Promise<Unidad[]> {
    const db = await getDb();
    const hoy = localDate();
    const result = await db.query(
      `SELECT * FROM unidad WHERE empresa_id = ? AND ultima_fecha = ?
       ORDER BY numero`,
      [empresaId, hoy]
    );
    return result.values as Unidad[];
  },

  async upsert(unidad: Unidad): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO unidad (numero, empresa_id, tipo_vehiculo, configuracion, odometro_ultimo, ultima_fecha)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(numero, empresa_id) DO UPDATE SET
         tipo_vehiculo = excluded.tipo_vehiculo,
         configuracion = excluded.configuracion,
         odometro_ultimo = excluded.odometro_ultimo,
         ultima_fecha = excluded.ultima_fecha`,
      [unidad.numero, unidad.empresa_id, unidad.tipo_vehiculo, unidad.configuracion, unidad.odometro_ultimo, unidad.ultima_fecha]
    );
    await persistDb();
  },
};