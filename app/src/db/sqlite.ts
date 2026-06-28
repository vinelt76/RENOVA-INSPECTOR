// sql-wasm.wasm EN public/assets/ DEBE SER sql.js 1.12.0 (NO 1.14.1 de node_modules).
// jeep-sqlite 2.8.0 trae glue pre-1.13; el wasm 1.14.1 da LinkError: 'I' is not a Function.
// Si actualizás jeep-sqlite, verificá la compatibilidad del wasm ANTES de reemplazar.
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { runSeed } from './seed';

let sqliteConnection: SQLiteConnection | null = null;
let db: SQLiteDBConnection | null = null;

// Memoiza la inicialización: bajo StrictMode (doble mount en dev) y con varios
// callers concurrentes (AppContext + pantallas), todos comparten una sola init.
let dbPromise: Promise<SQLiteDBConnection> | null = null;

export function getDb(): Promise<SQLiteDBConnection> {
  if (db) return Promise.resolve(db);
  if (!dbPromise) dbPromise = initDb();
  return dbPromise;
}

async function initDb(): Promise<SQLiteDBConnection> {
  sqliteConnection = new SQLiteConnection(CapacitorSQLite);

  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    await initWebStore();
  }

  const ret = await sqliteConnection.checkConnectionsConsistency();
  const isConn = (await sqliteConnection.isConnection('renova.db', false)).result;

  const conn = ret.result && isConn
    ? await sqliteConnection.retrieveConnection('renova.db', false)
    : await sqliteConnection.createConnection('renova.db', false, 'no-encryption', 1, false);

  await conn.open();
  db = conn;
  return conn;
}

// Setup correcto de @capacitor-community/sqlite en web: requiere el elemento
// <jeep-sqlite> en el DOM y luego initWebStore() sobre la conexión.
async function initWebStore(): Promise<void> {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);
  if (!document.querySelector('jeep-sqlite')) {
    const el = document.createElement('jeep-sqlite');
    document.body.appendChild(el);
  }
  await customElements.whenDefined('jeep-sqlite');
  await sqliteConnection!.initWebStore();
}

export async function closeDb(): Promise<void> {
  dbPromise = null;
  if (db) {
    await db.close();
    db = null;
  }
  if (sqliteConnection) {
    await sqliteConnection.closeAllConnections();
    sqliteConnection = null;
  }
}

export async function runMigrations(db: SQLiteDBConnection): Promise<void> {
  // Bootstrap: crear schema_version si la DB es completamente nueva
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);`);
  const vRes = await db.query(`SELECT version FROM schema_version LIMIT 1`);
  const currentVersion = (vRes.values?.[0]?.version as number) ?? 0;

  if (currentVersion < 1) {
    // v1: reset limpio — elimina tablas pre-v1 del dev/IndexedDB y recrea con schema v1.
    // Los datos son demo; se re-siembran con seed-once.
    await db.execute(`
      DROP TABLE IF EXISTS inspeccion_neumatico;
      DROP TABLE IF EXISTS inspeccion_cabecera;
      DROP TABLE IF EXISTS sync_queue;
      DROP TABLE IF EXISTS unidad;
      DROP TABLE IF EXISTS empresa;
      DROP TABLE IF EXISTS cat_marca;
      DROP TABLE IF EXISTS cat_modelo;
      DROP TABLE IF EXISTS cat_medida;
      DROP TABLE IF EXISTS cat_anomalia;
      DROP TABLE IF EXISTS cat_valvula;
      DROP TABLE IF EXISTS cat_configuracion;
      DROP TABLE IF EXISTS cat_condicion;
      DROP TABLE IF EXISTS cat_reencauche;
      DROP TABLE IF EXISTS app_meta;
    `);
    await db.execute(`
      CREATE TABLE app_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE empresa (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        flota TEXT
      );
      CREATE TABLE unidad (
        numero TEXT NOT NULL,
        empresa_id TEXT NOT NULL,
        tipo_vehiculo TEXT NOT NULL,
        configuracion TEXT NOT NULL,
        odometro_ultimo INTEGER,
        ultima_fecha TEXT,
        PRIMARY KEY (numero, empresa_id),
        FOREIGN KEY (empresa_id) REFERENCES empresa(id)
      );
      CREATE TABLE inspeccion_cabecera (
        id TEXT PRIMARY KEY,
        empresa_id TEXT NOT NULL,
        numero_unidad TEXT NOT NULL,
        fecha TEXT NOT NULL,
        km_odometro INTEGER NOT NULL,
        foto_unidad TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sincronizado INTEGER DEFAULT 0,
        FOREIGN KEY (empresa_id) REFERENCES empresa(id),
        FOREIGN KEY (numero_unidad, empresa_id) REFERENCES unidad(numero, empresa_id)
      );
      CREATE TABLE inspeccion_neumatico (
        id TEXT PRIMARY KEY,
        cabecera_id TEXT NOT NULL,
        posicion INTEGER NOT NULL,
        codigo TEXT,
        marca TEXT,
        modelo TEXT,
        condicion TEXT,
        reencauche TEXT,
        medida TEXT,
        r1 REAL,
        r2 REAL,
        r3 REAL,
        r4 REAL,
        presion REAL,
        tapa_valvula TEXT,
        anomalia TEXT,
        rtd_movi REAL,
        idi REAL,
        estado_rtd TEXT,
        desecho INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (cabecera_id) REFERENCES inspeccion_cabecera(id)
      );
      CREATE TABLE cat_marca (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE
      );
      CREATE TABLE cat_modelo (
        id TEXT PRIMARY KEY,
        marca_id TEXT NOT NULL,
        nombre TEXT NOT NULL,
        FOREIGN KEY (marca_id) REFERENCES cat_marca(id)
      );
      CREATE TABLE cat_medida (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE
      );
      CREATE TABLE cat_reencauche (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE
      );
      CREATE TABLE cat_anomalia (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE,
        posible_causa TEXT,
        desecho INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE cat_valvula (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE
      );
      CREATE TABLE cat_configuracion (
        tipo_vehiculo TEXT NOT NULL,
        notacion TEXT NOT NULL,
        posicion INTEGER NOT NULL,
        tipo_eje TEXT NOT NULL,
        lado TEXT,
        piso INTEGER NOT NULL DEFAULT 1,
        mvp INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (tipo_vehiculo, notacion, posicion)
      );
      CREATE TABLE cat_condicion (
        codigo TEXT PRIMARY KEY,
        nombre TEXT NOT NULL
      );
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        tabla TEXT NOT NULL,
        registro_id TEXT NOT NULL,
        op TEXT NOT NULL,
        created_at TEXT NOT NULL,
        enviado INTEGER DEFAULT 0
      );
    `);
    await db.execute(`DELETE FROM schema_version; INSERT INTO schema_version (version) VALUES (1);`);
  }
  // Plantilla para migraciones futuras:
  // if (currentVersion < 2) { /* ALTER TABLE / CREATE TABLE incremental */ ; await db.execute(`DELETE FROM schema_version; INSERT INTO schema_version (version) VALUES (2);`); }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

let initAppPromise: Promise<void> | null = null;

export function initApp(): Promise<void> {
  if (!initAppPromise) {
    initAppPromise = (async () => {
      const db = await getDb();
      await runMigrations(db);
      await runSeed();
    })();
  }
  return initAppPromise;
}

export async function persistDb(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web' || !sqliteConnection) return;
  try {
    await sqliteConnection.saveToStore('renova');
  } catch (e) {
    console.warn('persistDb saveToStore failed:', e);
  }
}
