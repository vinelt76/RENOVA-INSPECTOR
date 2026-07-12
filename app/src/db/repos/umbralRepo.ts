import { getDb, persistDb } from '../sqlite';
import type { UmbralRtd } from '../schema';

// Defaults históricos (pre-task_16, cuando eran constantes de código). Solo se usan
// si no hay NINGUNA fila para la empresa (ni siquiera el '*' sembrado en la migración
// v3) — p.ej. una empresa creada después de la migración sin pull de servidor todavía.
const FALLBACK_RTD_CAMBIO = 4;
const FALLBACK_RTD_PROXIMO = 7;
const FALLBACK_RTD_NORMAL = 8;

export const umbralRepo = {
  async getRtd(empresaId: string, medida?: string | null): Promise<UmbralRtd> {
    const db = await getDb();
    if (medida) {
      const exacto = await db.query(
        'SELECT * FROM umbral_rtd WHERE empresa_id = ? AND medida = ?',
        [empresaId, medida]
      );
      if (exacto.values?.[0]) return exacto.values[0] as UmbralRtd;
    }
    const wildcard = await db.query(
      "SELECT * FROM umbral_rtd WHERE empresa_id = ? AND medida = '*'",
      [empresaId]
    );
    if (wildcard.values?.[0]) return wildcard.values[0] as UmbralRtd;

    return {
      empresa_id: empresaId,
      medida: medida ?? '*',
      rtd_cambio: FALLBACK_RTD_CAMBIO,
      rtd_proximo: FALLBACK_RTD_PROXIMO,
      rtd_normal: FALLBACK_RTD_NORMAL,
    };
  },

  async upsertRtd(
    empresaId: string,
    medida: string,
    rtdCambio: number,
    rtdProximo: number,
    rtdNormal: number
  ): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO umbral_rtd (empresa_id, medida, rtd_cambio, rtd_proximo, rtd_normal)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(empresa_id, medida) DO UPDATE SET
         rtd_cambio = excluded.rtd_cambio,
         rtd_proximo = excluded.rtd_proximo,
         rtd_normal = excluded.rtd_normal`,
      [empresaId, medida, rtdCambio, rtdProximo, rtdNormal]
    );
    await persistDb();
  },
};
