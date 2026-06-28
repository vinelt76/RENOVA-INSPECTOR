import { getDb, persistDb } from '../sqlite';
import type { CatMarca, CatModelo, CatMedida, CatReencauche, CatAnomalia, CatValvula, CatConfiguracion, CatCondicion } from '../schema';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export const catalogoRepo = {
  async marcas(): Promise<CatMarca[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_marca ORDER BY nombre');
    return result.values as CatMarca[];
  },

  async modelos(marcaId: string): Promise<CatModelo[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_modelo WHERE marca_id = ? ORDER BY nombre', [marcaId]);
    return result.values as CatModelo[];
  },

  async medidas(): Promise<CatMedida[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_medida ORDER BY nombre');
    return result.values as CatMedida[];
  },

  async anomalias(): Promise<CatAnomalia[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_anomalia ORDER BY nombre');
    return result.values as CatAnomalia[];
  },

  async valvulas(): Promise<CatValvula[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_valvula ORDER BY nombre');
    return result.values as CatValvula[];
  },

  async configuracionMvp(): Promise<CatConfiguracion[]> {
    const db = await getDb();
    const result = await db.query(
      `SELECT * FROM cat_configuracion WHERE mvp = 1 GROUP BY tipo_vehiculo, notacion ORDER BY notacion`
    );
    return result.values as CatConfiguracion[];
  },

  async configuracion(tipoVehiculo: string, notacion: string): Promise<CatConfiguracion[]> {
    const db = await getDb();
    const result = await db.query(
      `SELECT * FROM cat_configuracion 
       WHERE tipo_vehiculo = ? AND notacion = ? AND mvp = 1
       ORDER BY posicion`,
      [tipoVehiculo, notacion]
    );
    return result.values as CatConfiguracion[];
  },

  async configuracionAll(tipoVehiculo: string, notacion: string): Promise<CatConfiguracion[]> {
    const db = await getDb();
    const result = await db.query(
      `SELECT * FROM cat_configuracion 
       WHERE tipo_vehiculo = ? AND notacion = ?
       ORDER BY posicion`,
      [tipoVehiculo, notacion]
    );
    return result.values as CatConfiguracion[];
  },

  async condiciones(): Promise<CatCondicion[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_condicion ORDER BY codigo');
    return result.values as CatCondicion[];
  },

  async reencauches(): Promise<CatReencauche[]> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_reencauche ORDER BY nombre');
    return result.values as CatReencauche[];
  },

  async getAnomaliaByNombre(nombre: string): Promise<CatAnomalia | null> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM cat_anomalia WHERE nombre = ?', [nombre]);
    return (result.values?.[0] as CatAnomalia) ?? null;
  },

  async addMarca(nombre: string): Promise<string> {
    const db = await getDb();
    const id = slugify(nombre);
    await db.run(`INSERT OR IGNORE INTO cat_marca (id, nombre) VALUES (?, ?)`, [id, nombre]);
    await persistDb();
    return id;
  },

  async addModelo(marcaId: string, nombre: string): Promise<string> {
    const db = await getDb();
    const marcaRes = await db.query(`SELECT nombre FROM cat_marca WHERE id = ?`, [marcaId]);
    const marcaNombre = (marcaRes.values?.[0]?.nombre as string) ?? marcaId;
    const id = slugify(`${marcaNombre}_${nombre}`);
    await db.run(`INSERT OR IGNORE INTO cat_modelo (id, marca_id, nombre) VALUES (?, ?, ?)`, [id, marcaId, nombre]);
    await persistDb();
    return id;
  },

  async addMedida(nombre: string): Promise<string> {
    const db = await getDb();
    const id = slugify(nombre);
    await db.run(`INSERT OR IGNORE INTO cat_medida (id, nombre) VALUES (?, ?)`, [id, nombre]);
    await persistDb();
    return id;
  },

  async addReencauche(nombre: string): Promise<string> {
    const db = await getDb();
    const id = slugify(nombre);
    await db.run(`INSERT OR IGNORE INTO cat_reencauche (id, nombre) VALUES (?, ?)`, [id, nombre]);
    await persistDb();
    return id;
  },
};