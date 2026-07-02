import { getDb, persistDb } from '../sqlite';
import { generateId, nowIso } from '../sqlite';
import type { InspeccionCabecera, InspeccionNeumatico } from '../schema';
import { calcularRtdMovi, calcularIdi, calcularEstadoRtd } from '../../core/calculations';

// Default umbrales - TODO: configurables por empresa (deuda documentada en specs/reglas_fijas_vs_configurables.md)
const DEFAULT_RTD_CAMBIO = 4;
const DEFAULT_RTD_PROXIMO = 7;

interface NeumaticoInput {
  cabecera_id: string;
  posicion: number;
  codigo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  condicion?: string | null;
  reencauche?: string | null;
  medida?: string | null;
  r1?: number | null;
  r2?: number | null;
  r3?: number | null;
  r4?: number | null;
  presion?: number | null;
  tapa_valvula?: string | null;
  anomalia?: string | null;
}

async function calcularDesecho(anomalia: string | null): Promise<number> {
  if (!anomalia) return 0;
  const db = await getDb();
  const result = await db.query('SELECT desecho FROM cat_anomalia WHERE nombre = ?', [anomalia]);
  return result.values?.[0]?.desecho ?? 0;
}

export const inspeccionRepo = {
  async crearCabecera(
    empresa_id: string,
    numero_unidad: string,
    fecha: string,
    km_odometro: number,
    foto_unidad?: string | null
  ): Promise<InspeccionCabecera> {
    const db = await getDb();
    const id = generateId();
    const now = nowIso();
    const cabecera: InspeccionCabecera = {
      id,
      empresa_id,
      numero_unidad,
      fecha,
      km_odometro,
      foto_unidad: foto_unidad ?? null,
      created_at: now,
      updated_at: now,
      sincronizado: 0,
    };
    await db.run(
      `INSERT INTO inspeccion_cabecera (id, empresa_id, numero_unidad, fecha, km_odometro, foto_unidad, created_at, updated_at, sincronizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, empresa_id, numero_unidad, fecha, km_odometro, foto_unidad ?? null, now, now, 0]
    );
    await persistDb();
    return cabecera;
  },


  async getCabecera(id: string): Promise<InspeccionCabecera | null> {
    const db = await getDb();
    const result = await db.query('SELECT * FROM inspeccion_cabecera WHERE id = ?', [id]);
    return (result.values?.[0] as InspeccionCabecera) ?? null;
  },

  async upsertNeumatico(input: NeumaticoInput, existingId?: string): Promise<InspeccionNeumatico> {
    const db = await getDb();
    const now = nowIso();
    const id = existingId ?? generateId();

    // RTD MOVI e IDI usando calcularRtdMovi/calcularIdi de calculations.ts
    // Nunca sustituir un canal faltante por 0 (regla MOVI = MIN de los medidos)
    const canales: number[] = [];
    if (input.r1 !== undefined && input.r1 !== null) canales.push(input.r1);
    if (input.r2 !== undefined && input.r2 !== null) canales.push(input.r2);
    if (input.r3 !== undefined && input.r3 !== null) canales.push(input.r3);
    if (input.r4 !== undefined && input.r4 !== null) canales.push(input.r4);

    let rtd_movi: number | null = null;
    let idi: number | null = null;
    let estado_rtd: string | null = null;

    if (canales.length >= 3 && canales.every(c => c >= 0)) {
      const [a, b, c, d] = canales;
      rtd_movi = calcularRtdMovi(a, b, c, canales.length >= 4 ? d : undefined);
      idi = calcularIdi(a, b, c, canales.length >= 4 ? d : undefined);
      estado_rtd = calcularEstadoRtd(rtd_movi, DEFAULT_RTD_CAMBIO, DEFAULT_RTD_PROXIMO);
    }

    const desecho = await calcularDesecho(input.anomalia ?? null);

    const neumatico: InspeccionNeumatico = {
      id,
      cabecera_id: input.cabecera_id,
      posicion: input.posicion,
      codigo: input.codigo ?? null,
      marca: input.marca ?? null,
      modelo: input.modelo ?? null,
      condicion: input.condicion ?? null,
      reencauche: input.reencauche ?? null,
      medida: input.medida ?? null,
      r1: input.r1 ?? null,
      r2: input.r2 ?? null,
      r3: input.r3 ?? null,
      r4: input.r4 ?? null,
      presion: input.presion ?? null,
      tapa_valvula: input.tapa_valvula ?? null,
      anomalia: input.anomalia ?? null,
      rtd_movi,
      idi,
      estado_rtd,
      desecho,
      updated_at: now,
    };

    await db.run(
      `INSERT INTO inspeccion_neumatico (id, cabecera_id, posicion, codigo, marca, modelo, condicion, reencauche, medida, r1, r2, r3, r4, presion, tapa_valvula, anomalia, rtd_movi, idi, estado_rtd, desecho, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         cabecera_id = excluded.cabecera_id,
         posicion = excluded.posicion,
         codigo = excluded.codigo,
         marca = excluded.marca,
         modelo = excluded.modelo,
         condicion = excluded.condicion,
         reencauche = excluded.reencauche,
         medida = excluded.medida,
         r1 = excluded.r1,
         r2 = excluded.r2,
         r3 = excluded.r3,
         r4 = excluded.r4,
         presion = excluded.presion,
         tapa_valvula = excluded.tapa_valvula,
         anomalia = excluded.anomalia,
         rtd_movi = excluded.rtd_movi,
         idi = excluded.idi,
         estado_rtd = excluded.estado_rtd,
         desecho = excluded.desecho,
         updated_at = excluded.updated_at`,
      [
        id, input.cabecera_id, input.posicion,
        input.codigo ?? null, input.marca ?? null, input.modelo ?? null,
        input.condicion ?? null, input.reencauche ?? null, input.medida ?? null,
        input.r1 ?? null, input.r2 ?? null, input.r3 ?? null, input.r4 ?? null,
        input.presion ?? null, input.tapa_valvula ?? null, input.anomalia ?? null,
        rtd_movi, idi, estado_rtd, desecho, now,
      ]
    );
    await persistDb();

    return neumatico;
  },

  async listNeumaticos(cabeceraId: string): Promise<InspeccionNeumatico[]> {
    const db = await getDb();
    const result = await db.query(
      'SELECT * FROM inspeccion_neumatico WHERE cabecera_id = ? ORDER BY posicion',
      [cabeceraId]
    );
    return result.values as InspeccionNeumatico[];
  },

  async getNeumaticoByPosicion(cabeceraId: string, posicion: number): Promise<InspeccionNeumatico | null> {
    const db = await getDb();
    const result = await db.query(
      'SELECT * FROM inspeccion_neumatico WHERE cabecera_id = ? AND posicion = ?',
      [cabeceraId, posicion]
    );
    return (result.values?.[0] as InspeccionNeumatico) ?? null;
  },

  async clonarNeumaticos(origenId: string, destinoId: string): Promise<void> {
    const db = await getDb();
    const result = await db.query(
      'SELECT * FROM inspeccion_neumatico WHERE cabecera_id = ? ORDER BY posicion',
      [origenId]
    );
    const neumaticos = (result.values ?? []) as InspeccionNeumatico[];
    const now = nowIso();
    for (const n of neumaticos) {
      await db.run(
        `INSERT OR IGNORE INTO inspeccion_neumatico
           (id, cabecera_id, posicion, codigo, marca, modelo, condicion, reencauche, medida,
            r1, r2, r3, r4, presion, tapa_valvula, anomalia, rtd_movi, idi, estado_rtd, desecho, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), destinoId, n.posicion,
          n.codigo, n.marca, n.modelo, n.condicion, n.reencauche, n.medida,
          n.r1, n.r2, n.r3, n.r4, n.presion, n.tapa_valvula, n.anomalia,
          n.rtd_movi, n.idi, n.estado_rtd, n.desecho, now,
        ]
      );
    }
    await persistDb();
  },
};
