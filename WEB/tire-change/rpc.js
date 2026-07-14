/**
 * RPC adapter and retry policy for sealed tire-change batches.
 *
 * The client and side effects are injected so this module stays independent
 * from the DOM and localStorage. UUID generation intentionally does not belong
 * here: every call receives an already sealed, idempotent payload.
 */

const RPC_NAME = "confirm_tire_change_batch";
const DOMAIN_ERROR_CLASSES = new Set([
  "stale_state",
  "unavailable_cycle",
  "occupied_position",
  "forbidden",
  "invalid_batch",
]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETDOWN",
  "ENETUNREACH",
  "ETIMEDOUT",
  "NETWORK_ERROR",
]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 503, 504]);

/**
 * Invoke the batch RPC exactly once.
 *
 * @param {object} pBatch An already sealed payload v1.
 * @param {object} [options]
 * @param {object} [options.client] Supabase client; defaults to the shared browser client.
 * @param {object} [options.logger] Logger with an `error` method.
 * @returns {Promise<object>} RPC data.
 */
export async function confirmTireChangeBatch(
  pBatch,
  { client = resolveSharedClient(), logger = console } = {},
) {
  if (!client || typeof client.rpc !== "function") {
    throw new TypeError("Se requiere un cliente Supabase con método rpc().");
  }

  let response;
  try {
    response = await client.rpc(RPC_NAME, { p_batch: pBatch });
  } catch (error) {
    logRpcError(logger, error);
    throw error;
  }

  const { data, error } = response ?? {};
  if (error) {
    logRpcError(logger, error);
    throw error;
  }

  return data;
}

/**
 * Map Postgres/PostgREST errors to the UI contract.
 */
export function classifyBatchError(error) {
  const message = typeof error?.message === "string" ? error.message : "";

  if (error?.code === "40001" || message.startsWith("[estado_desactualizado]")) {
    return "stale_state";
  }
  if (message.startsWith("[no_disponible]")) return "unavailable_cycle";
  if (error?.code === "23505" || message.startsWith("[posicion_ocupada]")) {
    return "occupied_position";
  }
  if (error?.code === "42501" || message.startsWith("[sin_permiso]")) {
    return "forbidden";
  }
  if (message.startsWith("[lote_invalido]")) return "invalid_batch";
  return "unknown";
}

/**
 * Apply a pending sealed batch with one bounded network retry by default.
 *
 * Supabase 2.102.0+ first performs its own transient retries. If it still
 * surfaces a network/timeout error, this function may invoke the RPC once more
 * with the exact same payload object. Domain errors are never retried.
 */
export async function applyPendingBatch(
  pendingBatch,
  {
    client = resolveSharedClient(),
    logger = console,
    onReload = async () => {},
    onClearSealed = async () => {},
    onDiscardDraft = async () => {},
    maxNetworkRetries = 1,
  } = {},
) {
  if (!pendingBatch || typeof pendingBatch !== "object") {
    throw new TypeError("Se requiere un payload sellado pendiente.");
  }
  if (!Number.isInteger(maxNetworkRetries) || maxNetworkRetries < 0) {
    throw new TypeError("maxNetworkRetries debe ser un entero no negativo.");
  }

  const originalBatchId = pendingBatch.batch_id;
  const originalPayload = stableStringify(pendingBatch);
  let networkRetries = 0;

  for (;;) {
    assertPendingBatchUnchanged(pendingBatch, originalBatchId, originalPayload);

    let result;
    try {
      result = await confirmTireChangeBatch(pendingBatch, { client, logger });
    } catch (error) {
      const classification = classifyBatchError(error);

      if (classification === "stale_state") {
        await onClearSealed(originalBatchId);
        await onDiscardDraft({ unitId: pendingBatch.unit_id, error });
        await onReload({
          reason: "stale_state",
          unitId: pendingBatch.unit_id,
          error,
        });
        return null;
      }

      if (DOMAIN_ERROR_CLASSES.has(classification)) {
        await onClearSealed(originalBatchId);
        throw error;
      }

      if (isRetryableNetworkError(error) && networkRetries < maxNetworkRetries) {
        networkRetries += 1;
        continue;
      }

      // An unclassified non-network failure may still be a domain validation
      // error (for example, performed_at before installed_at). Its sealed
      // payload must be discarded so the user can correct and reseal it.
      if (!isRetryableNetworkError(error)) {
        await onClearSealed(originalBatchId);
      }
      throw error;
    }

    // Post-success side effects intentionally live outside the RPC catch. A
    // storage or reload failure must not trigger another database invocation.
    assertPendingBatchUnchanged(pendingBatch, originalBatchId, originalPayload);
    await onClearSealed(originalBatchId);
    await onReload({
      reason: "success",
      unitId: result?.unit_id ?? pendingBatch.unit_id,
      result,
    });
    return result;
  }
}

/**
 * Escape an error message before a UI inserts it into HTML.
 * Prefer assigning textContent in consumers; this helper exists for templates.
 */
export function escapeBatchErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  return message.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

export function isRetryableNetworkError(error) {
  if (!error) return false;
  if (DOMAIN_ERROR_CLASSES.has(classifyBatchError(error))) return false;

  const status = Number(error.status ?? error.statusCode);
  if (RETRYABLE_HTTP_STATUSES.has(status)) return true;

  const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
  if (RETRYABLE_NETWORK_CODES.has(code)) return true;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  return /failed to fetch|network(?: request)? (?:error|failed)|networkerror|timed? ?out|timeout|connection (?:reset|refused)/.test(
    message,
  );
}

function resolveSharedClient() {
  return globalThis.RenovaSupabase?.supabase ?? null;
}

function logRpcError(logger, error) {
  if (logger && typeof logger.error === "function") {
    // Log the complete Supabase error, never the payload/session/token.
    logger.error(RPC_NAME, error);
  }
}

function assertPendingBatchUnchanged(pendingBatch, batchId, serialized) {
  if (pendingBatch.batch_id !== batchId || stableStringify(pendingBatch) !== serialized) {
    throw new Error("El payload sellado cambió durante el reintento.");
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
