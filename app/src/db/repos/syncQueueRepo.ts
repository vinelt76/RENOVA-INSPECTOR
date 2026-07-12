import { getDb, persistDb, generateId, nowIso } from '../sqlite';
import type { SyncQueue } from '../schema';

export const syncQueueRepo = {
  // Un pendiente por (tabla, registro_id) — reencolar (nuevo edit) resetea el
  // estado de reintento, no acumula filas (UNIQUE en migración v4).
  async enqueue(tabla: string, registroId: string, op = 'upsert'): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO sync_queue (id, tabla, registro_id, op, created_at, enviado, intentos, ultimo_error, next_retry_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, NULL, NULL)
       ON CONFLICT(tabla, registro_id) DO UPDATE SET
         op = excluded.op,
         created_at = excluded.created_at,
         enviado = 0,
         intentos = 0,
         ultimo_error = NULL,
         next_retry_at = NULL`,
      [generateId(), tabla, registroId, op, nowIso()]
    );
    await persistDb();
  },

  async pendientes(): Promise<SyncQueue[]> {
    const db = await getDb();
    const now = nowIso();
    const result = await db.query(
      `SELECT * FROM sync_queue
       WHERE enviado = 0 AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at`,
      [now]
    );
    return (result.values ?? []) as SyncQueue[];
  },

  async getByRegistro(tabla: string, registroId: string): Promise<SyncQueue | null> {
    const db = await getDb();
    const result = await db.query(
      'SELECT * FROM sync_queue WHERE tabla = ? AND registro_id = ?',
      [tabla, registroId]
    );
    return (result.values?.[0] as SyncQueue) ?? null;
  },

  // createdAt: valor leído por el llamador ANTES de intentar el push. Si mientras el
  // push estaba en vuelo llegó una edición nueva, `enqueue` ya reescribió created_at
  // (mismo id, fila "rearmada" a pendiente) — el WHERE no matchea y el UPDATE no toca
  // nada, dejando la fila pendiente para que la edición nueva se envíe de verdad.
  // Sin este guard, un push exitoso con datos viejos marcaría enviado=1 sobre una
  // edición más nueva que nunca se llegó a mandar (race: task_17 code review 2026-07-11).
  async marcarEnviado(id: string, createdAt: string): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE sync_queue SET enviado = 1, ultimo_error = NULL WHERE id = ? AND created_at = ? AND enviado = 0',
      [id, createdAt]
    );
    await persistDb();
  },

  async marcarError(id: string, createdAt: string, intentos: number, error: string, nextRetryAt: string): Promise<void> {
    const db = await getDb();
    await db.run(
      'UPDATE sync_queue SET intentos = ?, ultimo_error = ?, next_retry_at = ? WHERE id = ? AND created_at = ? AND enviado = 0',
      [intentos, error, nextRetryAt, id, createdAt]
    );
    await persistDb();
  },
};
