import { describe, expect, it, vi } from "vitest";

import {
  applyPendingBatch,
  applyPendingBaselineBatch,
  classifyBatchError,
  confirmBaselineMount,
  confirmTireChangeBatch,
  escapeBatchErrorMessage,
  isRetryableNetworkError,
} from "../rpc.js";

const BATCH_ID = "9d0515b6-98d6-4b14-8b09-aadee10f816b";
const UNIT_ID = "0ccc3098-d4c5-4a1f-b2cf-09b384c0d500";

function pendingBatch() {
  const movement = Object.freeze({
    seq: 1,
    op: "mount",
    position: 3,
    life_cycle_id: "aef720a6-f634-478f-898c-ac8dab652f46",
    rtd_mm: 16.8,
    notes: null,
  });
  return Object.freeze({
    batch_version: 1,
    batch_id: BATCH_ID,
    unit_id: UNIT_ID,
    performed_at: "2026-07-13",
    odometer: 210000,
    notes: null,
    movements: Object.freeze([movement]),
  });
}

function pendingBaselineBatch() {
  return Object.freeze({
    batch_version: 1,
    batch_id: BATCH_ID,
    unit_id: UNIT_ID,
    performed_at: "2026-07-14",
    odometer: 210000,
    mounts: Object.freeze([Object.freeze({
      seq: 1,
      position: 3,
      source_measurement_id: "30000000-0000-4000-8000-000000000003",
      casing_code: "CAS-003",
      condition: "N",
    })]),
  });
}

function supabaseError(code, message, extra = {}) {
  return { code, message, details: null, hint: null, ...extra };
}

function mockClient(...responses) {
  return {
    rpc: vi.fn().mockImplementation(() => {
      const response = responses.shift();
      if (response instanceof Error) return Promise.reject(response);
      if (response?.throw) return Promise.reject(response.throw);
      return Promise.resolve(response);
    }),
  };
}

describe("confirmTireChangeBatch", () => {
  it("calls confirm_tire_change_batch once and returns data", async () => {
    const batch = pendingBatch();
    const data = { applied: true, batch_id: BATCH_ID, unit_id: UNIT_ID };
    const client = mockClient({ data, error: null });

    await expect(confirmTireChangeBatch(batch, { client })).resolves.toBe(data);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("confirm_tire_change_batch", {
      p_batch: batch,
    });
  });

  it("logs the complete returned error and throws the same object", async () => {
    const error = supabaseError("42501", "[sin_permiso] Rol no autorizado.", {
      hint: "Usá un rol de taller",
    });
    const client = mockClient({ data: null, error });
    const logger = { error: vi.fn() };

    await expect(confirmTireChangeBatch(pendingBatch(), { client, logger })).rejects.toBe(error);
    expect(logger.error).toHaveBeenCalledWith("confirm_tire_change_batch", error);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("logs a thrown network error and preserves its identity", async () => {
    const error = new TypeError("Failed to fetch");
    const client = mockClient(error);
    const logger = { error: vi.fn() };

    await expect(confirmTireChangeBatch(pendingBatch(), { client, logger })).rejects.toBe(error);
    expect(logger.error).toHaveBeenCalledWith("confirm_tire_change_batch", error);
  });
});

describe("confirmBaselineMount", () => {
  it("calls confirm_baseline_mount once and returns data", async () => {
    const batch = pendingBaselineBatch();
    const data = { applied: true, batch_id: BATCH_ID, unit_id: UNIT_ID };
    const client = mockClient({ data, error: null });

    await expect(confirmBaselineMount(batch, { client })).resolves.toBe(data);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("confirm_baseline_mount", { p_batch: batch });
  });
});

describe("classifyBatchError", () => {
  it.each([
    [supabaseError("40001", "estado cambió"), "stale_state"],
    [supabaseError("22023", "[estado_desactualizado] La posición cambió."), "stale_state"],
    [supabaseError("22023", "[no_disponible] El ciclo no está disponible."), "unavailable_cycle"],
    [supabaseError("23505", "duplicate key"), "occupied_position"],
    [supabaseError("22023", "[posicion_ocupada] P3 ya está ocupada."), "occupied_position"],
    [supabaseError("23505", "[codigo_en_uso] CAS-3 ya existe."), "duplicate_code"],
    [supabaseError("22023", "[linea_base_pendiente] P3 requiere línea base."), "baseline_pending"],
    [supabaseError("22023", "[evidencia_invalida] La medición no corresponde."), "invalid_evidence"],
    [supabaseError("42501", "permission denied"), "forbidden"],
    [supabaseError("22023", "[sin_permiso] Rol no autorizado."), "forbidden"],
    [supabaseError("22023", "[lote_invalido] Versión incorrecta."), "invalid_batch"],
  ])("classifies %# as %s", (error, expected) => {
    expect(classifyBatchError(error)).toBe(expected);
  });

  it("classifies an unprefixed installed-at date error as unknown", () => {
    const error = supabaseError(
      "P0001",
      "La fecha de retiro (2026-01-01) no puede ser anterior a la de instalación.",
    );
    expect(classifyBatchError(error)).toBe("unknown");
  });

  it.each([null, new Error("boom"), supabaseError("22023", "sin prefijo")])(
    "classifies an unrecognized error as unknown",
    (error) => {
      expect(classifyBatchError(error)).toBe("unknown");
    },
  );
});

describe("applyPendingBatch", () => {
  it("clears the sealed batch and reloads after success", async () => {
    const batch = pendingBatch();
    const data = { applied: true, batch_id: BATCH_ID, unit_id: UNIT_ID };
    const client = mockClient({ data, error: null });
    const onClearSealed = vi.fn();
    const onReload = vi.fn();

    await expect(
      applyPendingBatch(batch, { client, onClearSealed, onReload }),
    ).resolves.toBe(data);
    expect(onClearSealed).toHaveBeenCalledWith(BATCH_ID);
    expect(onReload).toHaveBeenCalledWith({
      reason: "success",
      unitId: UNIT_ID,
      result: data,
    });
  });

  it("does not repeat the RPC when a post-success reload fails", async () => {
    const data = { applied: true, batch_id: BATCH_ID, unit_id: UNIT_ID };
    const client = mockClient({ data, error: null });
    const reloadError = new Error("No se pudieron recargar las vistas");

    await expect(
      applyPendingBatch(pendingBatch(), {
        client,
        onReload: vi.fn().mockRejectedValue(reloadError),
      }),
    ).rejects.toBe(reloadError);
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure with the exact same immutable payload", async () => {
    const batch = pendingBatch();
    const networkError = new TypeError("Failed to fetch");
    const data = {
      applied: true,
      already_applied: true,
      batch_id: BATCH_ID,
      unit_id: UNIT_ID,
    };
    const client = mockClient(networkError, { data, error: null });

    await expect(
      applyPendingBatch(batch, { client, logger: { error: vi.fn() } }),
    ).resolves.toBe(data);
    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(client.rpc.mock.calls[0][1].p_batch).toBe(batch);
    expect(client.rpc.mock.calls[1][1].p_batch).toBe(batch);
    expect(client.rpc.mock.calls[1][1].p_batch.batch_id).toBe(BATCH_ID);
    expect(client.rpc.mock.calls[1][1].p_batch).toEqual(client.rpc.mock.calls[0][1].p_batch);
  });

  it("bounds network retry and keeps the sealed payload for a later attempt", async () => {
    const first = Object.assign(new Error("network error"), { code: "NETWORK_ERROR" });
    const second = Object.assign(new Error("request timed out"), { code: "ETIMEDOUT" });
    const client = mockClient(first, second);
    const onClearSealed = vi.fn();
    const onReload = vi.fn();

    await expect(
      applyPendingBatch(pendingBatch(), {
        client,
        logger: { error: vi.fn() },
        onClearSealed,
        onReload,
      }),
    ).rejects.toBe(second);
    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(onClearSealed).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });

  it("does not retry domain errors", async () => {
    const error = supabaseError("22023", "[no_disponible] Ciclo descartado.");
    const client = mockClient({ data: null, error });
    const onClearSealed = vi.fn();

    await expect(
      applyPendingBatch(pendingBatch(), {
        client,
        logger: { error: vi.fn() },
        onClearSealed,
      }),
    ).rejects.toBe(error);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(onClearSealed).toHaveBeenCalledWith(BATCH_ID);
  });

  it("clears stale state, discards the draft and reloads without retry", async () => {
    const error = supabaseError("40001", "[estado_desactualizado] P1 cambió.");
    const client = mockClient({ data: null, error });
    const onClearSealed = vi.fn();
    const onDiscardDraft = vi.fn();
    const onReload = vi.fn();

    await expect(
      applyPendingBatch(pendingBatch(), {
        client,
        logger: { error: vi.fn() },
        onClearSealed,
        onDiscardDraft,
        onReload,
      }),
    ).resolves.toBeNull();
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(onClearSealed).toHaveBeenCalledWith(BATCH_ID);
    expect(onDiscardDraft).toHaveBeenCalledWith({ unitId: UNIT_ID, error });
    expect(onReload).toHaveBeenCalledWith({
      reason: "stale_state",
      unitId: UNIT_ID,
      error,
    });
  });

  it("does not blindly retry an unknown domain/date error", async () => {
    const error = supabaseError(
      "P0001",
      "La fecha de retiro no puede ser anterior a la instalación.",
    );
    const client = mockClient({ data: null, error });
    const onClearSealed = vi.fn();

    await expect(
      applyPendingBatch(pendingBatch(), {
        client,
        logger: { error: vi.fn() },
        onClearSealed,
      }),
    ).rejects.toBe(error);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(onClearSealed).toHaveBeenCalledWith(BATCH_ID);
  });
});

describe("applyPendingBaselineBatch", () => {
  it.each([
    ["[linea_base_pendiente] La posición requiere primer montaje.", "baseline_pending"],
    ["[evidencia_invalida] La medición no pertenece a la posición.", "invalid_evidence"],
  ])("does not retry %s", async (message, classification) => {
    const error = supabaseError("22023", message);
    const client = mockClient({ data: null, error });
    const onClearSealed = vi.fn();

    expect(classifyBatchError(error)).toBe(classification);
    await expect(applyPendingBaselineBatch(pendingBaselineBatch(), {
      client,
      logger: { error: vi.fn() },
      onClearSealed,
    })).rejects.toBe(error);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(onClearSealed).toHaveBeenCalledWith(BATCH_ID);
  });

  it("retries one network error with the identical baseline payload", async () => {
    const batch = pendingBaselineBatch();
    const client = mockClient(
      new TypeError("Failed to fetch"),
      { data: { applied: true, unit_id: UNIT_ID }, error: null },
    );

    await expect(applyPendingBaselineBatch(batch, {
      client,
      logger: { error: vi.fn() },
    })).resolves.toMatchObject({ applied: true });
    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(client.rpc.mock.calls[0][1].p_batch).toBe(batch);
    expect(client.rpc.mock.calls[1][1].p_batch).toBe(batch);
    expect(client.rpc.mock.calls[0][0]).toBe("confirm_baseline_mount");
    expect(client.rpc.mock.calls[1][0]).toBe("confirm_baseline_mount");
  });
});

describe("network detection and safe messages", () => {
  it.each([
    [new TypeError("Failed to fetch"), true],
    [Object.assign(new Error("socket"), { code: "ETIMEDOUT" }), true],
    [Object.assign(new Error("gateway"), { status: 504 }), true],
    [supabaseError("23505", "duplicate", { status: 409 }), false],
    [supabaseError("22023", "[lote_invalido] inválido"), false],
  ])("detects retryable network errors", (error, expected) => {
    expect(isRetryableNetworkError(error)).toBe(expected);
  });

  it("escapes the message for HTML templates", () => {
    const error = new Error('<img src=x onerror="alert(1)"> & it\'s bad');
    expect(escapeBatchErrorMessage(error)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; it&#39;s bad",
    );
  });
});
