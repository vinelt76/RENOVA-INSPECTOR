import { describe, expect, it, vi } from "vitest";

import {
  applyPendingBaselineBatch,
  classifyBatchError,
  confirmBaselineMount,
} from "../rpc.js";

const BATCH_ID = "9d0515b6-98d6-4b14-8b09-aadee10f816b";
const UNIT_ID = "0ccc3098-d4c5-4a1f-b2cf-09b384c0d500";

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

function domainError(message, code = "22023") {
  return { code, message, details: null, hint: null };
}

function mockClient(...responses) {
  return {
    rpc: vi.fn().mockImplementation(() => Promise.resolve(responses.shift())),
  };
}

describe("baseline RPC contract", () => {
  it("envía el lote sellado sin transformarlo", async () => {
    const batch = pendingBaselineBatch();
    const client = mockClient({ data: { applied: true }, error: null });

    await expect(confirmBaselineMount(batch, { client })).resolves.toEqual({ applied: true });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("confirm_baseline_mount", {
      p_batch: batch,
    });
  });

  it.each([
    ["[linea_base_pendiente] La posición requiere primer montaje.", "baseline_pending"],
    ["[evidencia_invalida] La medición no corresponde a la posición.", "invalid_evidence"],
    ["[codigo_en_uso] El casco ya existe.", "duplicate_code"],
  ])("clasifica %s como %s", (message, expected) => {
    expect(classifyBatchError(domainError(message))).toBe(expected);
  });

  it("limpia y recarga, sin reintentar, cuando el estado queda obsoleto", async () => {
    const error = domainError("[estado_desactualizado] La posición cambió.", "40001");
    const client = mockClient({ data: null, error });
    const onClearSealed = vi.fn();
    const onDiscardDraft = vi.fn();
    const onReload = vi.fn();

    await expect(applyPendingBaselineBatch(pendingBaselineBatch(), {
      client,
      logger: { error: vi.fn() },
      onClearSealed,
      onDiscardDraft,
      onReload,
    })).resolves.toBeNull();

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(onClearSealed).toHaveBeenCalledWith(BATCH_ID);
    expect(onDiscardDraft).toHaveBeenCalledWith({ unitId: UNIT_ID, error });
    expect(onReload).toHaveBeenCalledWith({
      reason: "stale_state",
      unitId: UNIT_ID,
      error,
    });
  });
});
