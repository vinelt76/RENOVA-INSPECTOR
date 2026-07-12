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
    // El default interno de <jeep-sqlite> es wasmPath="/assets" (absoluto
    // desde la raíz del dominio) — rompe bajo un base no-raíz (GitHub Pages:
    // /RENOVA-INSPECTOR/assets/), pide sql-wasm.wasm en la raíz, recibe el
    // 404 HTML de Pages y falla el wasm streaming compile ("unsupported
    // MIME type text/html"). BASE_URL ya incluye la barra final.
    el.setAttribute('wasmPath', `${import.meta.env.BASE_URL}assets`);
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
  if (currentVersion < 2) {
    // v2: el autosave insertaba una fila nueva por cada edición (UUID nuevo →
    // ON CONFLICT(id) jamás disparaba) → neumáticos duplicados por posición.
    // Dedupe (gana la última inserción) + UNIQUE para que no vuelva a pasar.
    await db.execute(`
      DELETE FROM inspeccion_neumatico WHERE rowid NOT IN (
        SELECT MAX(rowid) FROM inspeccion_neumatico GROUP BY cabecera_id, posicion
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_neumatico_cab_pos
        ON inspeccion_neumatico (cabecera_id, posicion);
    `);
    await db.execute(`DELETE FROM schema_version; INSERT INTO schema_version (version) VALUES (2);`);
  }
  if (currentVersion < 3) {
    // v3 (task_16): umbrales RTD configurables por empresa+medida (antes hardcodeados
    // 4/7/8 en inspeccionRepo.ts y pushInspeccion.ts — specs/reglas_negocio.md §2 exige
    // que vivan en tabla, "NUNCA hardcodear"). medida='*' = default de la empresa.
    // Snapshot en inspeccion_neumatico: registra CONTRA QUÉ umbral se evaluó estado_rtd,
    // para que el histórico sea reproducible aunque el umbral de la empresa cambie después.
    // umbral_presion queda creada pero INERTE: la referencia CALIENTE sigue sin definirse
    // (specs/reglas_negocio.md §3) — no se lee ni se escribe desde ningún flujo todavía.
    await db.execute(`
      CREATE TABLE umbral_rtd (
        empresa_id TEXT NOT NULL,
        medida TEXT NOT NULL,
        rtd_cambio REAL NOT NULL,
        rtd_proximo REAL NOT NULL,
        rtd_normal REAL NOT NULL,
        PRIMARY KEY (empresa_id, medida),
        FOREIGN KEY (empresa_id) REFERENCES empresa(id)
      );
      CREATE TABLE umbral_presion (
        empresa_id TEXT NOT NULL,
        medida TEXT NOT NULL,
        tipo_eje TEXT NOT NULL,
        presion_frio REAL,
        delta_alto_pct REAL,
        delta_bajo_pct REAL,
        PRIMARY KEY (empresa_id, medida, tipo_eje),
        FOREIGN KEY (empresa_id) REFERENCES empresa(id)
      );
      ALTER TABLE inspeccion_neumatico ADD COLUMN rtd_cambio_snap REAL;
      ALTER TABLE inspeccion_neumatico ADD COLUMN rtd_proximo_snap REAL;
      ALTER TABLE inspeccion_neumatico ADD COLUMN rtd_normal_snap REAL;
      ALTER TABLE inspeccion_neumatico ADD COLUMN isa_peso_snap REAL;
    `);
    // Siembra el default '*' (4/7/8, igual al comportamiento previo) para cada empresa
    // existente, y backfillea el snapshot de filas ya guardadas — evita NULLs en el
    // re-push de terminarInspeccion.ts.
    await db.execute(`
      INSERT INTO umbral_rtd (empresa_id, medida, rtd_cambio, rtd_proximo, rtd_normal)
        SELECT id, '*', 4, 7, 8 FROM empresa;
      UPDATE inspeccion_neumatico
        SET rtd_cambio_snap = 4, rtd_proximo_snap = 7, rtd_normal_snap = 8,
            isa_peso_snap = CASE WHEN desecho = 1 THEN 5 ELSE 1 END
        WHERE rtd_movi IS NOT NULL;
    `);
    await db.execute(`DELETE FROM schema_version; INSERT INTO schema_version (version) VALUES (3);`);
  }
  if (currentVersion < 4) {
    // v4 (task_17): sync_queue pasa de stub (nadie la leía/escribía) a cola real con
    // reintentos. UNIQUE(tabla, registro_id): un solo pendiente por cabecera — reencolar
    // (nuevo edit) resetea el estado de reintento en vez de acumular filas.
    // El DROP TABLE sync_queue de v1 sigue gateado a instalación fresca (currentVersion<1)
    // — NUNCA reintroducir un DROP fuera de ese bloque, borraría trabajo de campo pendiente.
    await db.execute(`
      ALTER TABLE sync_queue ADD COLUMN intentos INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sync_queue ADD COLUMN ultimo_error TEXT;
      ALTER TABLE sync_queue ADD COLUMN next_retry_at TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_tabla_registro
        ON sync_queue (tabla, registro_id);
    `);
    await db.execute(`DELETE FROM schema_version; INSERT INTO schema_version (version) VALUES (4);`);
  }
  // Plantilla para migraciones futuras:
  // if (currentVersion < 5) { /* ALTER TABLE / CREATE TABLE incremental */ ; await db.execute(`DELETE FROM schema_version; INSERT INTO schema_version (version) VALUES (5);`); }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function localDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
