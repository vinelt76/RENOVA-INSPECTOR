import { getDb } from '../sqlite';
import type { Empresa } from '../schema';

export const empresaRepo = {
  async listAll(): Promise<Empresa[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM empresa ORDER BY nombre');
    return result.values as Empresa[];
  },

  async getById(id: string): Promise<Empresa | null> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM empresa WHERE id = ?', [id]);
    return (result.values?.[0] as Empresa) ?? null;
  },
};