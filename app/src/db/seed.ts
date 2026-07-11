import { getDb, persistDb } from './sqlite';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { buildSeedRows } from './seed_rows';

// Incrementar para forzar re-siembra (cuando cambian los datos del seed).
const SEED_VERSION = 6;

async function getSeedVersion(db: SQLiteDBConnection): Promise<number> {
  const res = await db.query(`SELECT value FROM app_meta WHERE key = 'seed_version'`);
  return parseInt((res.values?.[0]?.value as string) ?? '0');
}

export async function runSeed(): Promise<void> {
  const db = await getDb();

  const stored = await getSeedVersion(db);
  if (stored >= SEED_VERSION) return;

  const rows = buildSeedRows();

  // executeSet agrupa todas las filas en una transacción atómica.
  // El segundo argumento (true) activa la transacción automática del plugin.
  const batch: Array<{ statement: string; values: unknown[] }> = [];

  for (const v of rows.catValvulas) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_valvula (id, nombre) VALUES (?, ?)`, values: [v.id, v.nombre] });
  }
  for (const a of rows.catAnomalias) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_anomalia (id, nombre, posible_causa, desecho) VALUES (?, ?, ?, ?)`, values: [a.id, a.nombre, a.posible_causa, a.desecho] });
  }
  for (const c of rows.catConfiguraciones) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_configuracion (tipo_vehiculo, notacion, posicion, tipo_eje, lado, piso, mvp) VALUES (?, ?, ?, ?, ?, ?, ?)`, values: [c.tipo_vehiculo, c.notacion, c.posicion, c.tipo_eje, c.lado, c.piso, c.mvp] });
  }
  // Limpiar condiciones eliminadas del catálogo
  batch.push({ statement: `DELETE FROM cat_condicion WHERE codigo = 'R'`, values: [] });
  for (const c of rows.catCondiciones) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_condicion (codigo, nombre) VALUES (?, ?)`, values: [c.codigo, c.nombre] });
  }
  for (const m of rows.catMarcas) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_marca (id, nombre) VALUES (?, ?)`, values: [m.id, m.nombre] });
  }
  for (const m of rows.catModelos) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_modelo (id, marca_id, nombre) VALUES (?, ?, ?)`, values: [m.id, m.marca_id, m.nombre] });
  }
  for (const m of rows.catMedidas) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_medida (id, nombre) VALUES (?, ?)`, values: [m.id, m.nombre] });
  }
  for (const r of rows.catReencauches) {
    batch.push({ statement: `INSERT OR IGNORE INTO cat_reencauche (id, nombre) VALUES (?, ?)`, values: [r.id, r.nombre] });
  }
  for (const e of rows.empresas) {
    batch.push({ statement: `INSERT OR IGNORE INTO empresa (id, nombre, flota) VALUES (?, ?, ?)`, values: [e.id, e.nombre, e.flota] });
  }
  batch.push({ statement: `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, values: ['seed_version', String(SEED_VERSION)] });

  await db.executeSet(batch, true);
  await persistDb();
}
