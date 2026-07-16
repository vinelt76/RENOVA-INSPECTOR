import { describe, expect, it, vi } from "vitest";

import {
  loadDiscardedInventory,
  loadInventoryScreenData,
  loadRetentionInventory,
} from "../data.js";

const RETENTION_COLUMNS = [
  "company_id",
  "life_cycle_id",
  "casing_id",
  "casing_code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "cycle_number",
  "retread_design",
  "otd_mm",
  "last_removed_at",
  "last_removal_reason",
  "last_rtd_mm",
  "days_in_inventory",
].join(",");

const DISCARDED_COLUMNS = [
  "casing_id",
  "current_life_cycle_id",
  "code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
  "cost",
  "inventory_status",
  "last_removal_reason",
  "last_unit_plate",
  "last_position_number",
  "last_removed_at",
  "last_removal_discard_cause",
  "discarded_at",
].join(",");

describe("loadRetentionInventory", () => {
  it("lee todas las filas montables sin filtrar por el motivo de retiro", async () => {
    const remoteRows = [
      {
        casing_code: "RET-01",
        cycle_number: "1",
        otd_mm: "17.5",
        last_rtd_mm: "11.25",
        days_in_inventory: "8",
        last_removal_reason: "rotation",
      },
      {
        casing_code: "NUEVO-01",
        cycle_number: 0,
        otd_mm: null,
        last_rtd_mm: null,
        days_in_inventory: null,
        last_removal_reason: null,
      },
    ];
    const fetchView = vi.fn().mockResolvedValue(remoteRows);

    const rows = await loadRetentionInventory(fetchView);

    expect(fetchView).toHaveBeenCalledWith("v_tire_inventory_available", {
      select: RETENTION_COLUMNS,
      order: "last_removed_at.desc.nullslast,casing_code.asc",
    });
    expect(fetchView.mock.calls[0][1]).not.toHaveProperty("last_removal_reason");
    expect(fetchView.mock.calls[0][1]).not.toHaveProperty("company_id");
    expect(rows).toEqual([
      { ...remoteRows[0], cycle_number: 1, otd_mm: 17.5, last_rtd_mm: 11.25, days_in_inventory: 8 },
      remoteRows[1],
    ]);
  });

  it("acepta un cliente con fetchView y propaga errores", async () => {
    const client = { fetchView: vi.fn().mockResolvedValue([]) };
    await expect(loadRetentionInventory(client)).resolves.toEqual([]);

    const error = new Error("sin red");
    await expect(loadRetentionInventory(vi.fn().mockRejectedValue(error))).rejects.toBe(error);
  });
});

describe("loadDiscardedInventory", () => {
  it("filtra descartados en servidor, pide columnas explícitas y normaliza numeric", async () => {
    const remoteRow = {
      casing_id: "10000000-0000-4000-8000-000000000001",
      code: "DESC-01",
      inventory_status: "discarded",
      cost: "950.50",
      last_position_number: "4",
      discarded_at: "2026-07-14T12:00:00Z",
    };
    const fetchView = vi.fn().mockResolvedValue([remoteRow]);

    await expect(loadDiscardedInventory(fetchView)).resolves.toEqual([
      { ...remoteRow, cost: 950.5, last_position_number: 4 },
    ]);
    expect(fetchView).toHaveBeenCalledWith("v_inventory_status", {
      select: DISCARDED_COLUMNS,
      inventory_status: "eq.discarded",
      order: "discarded_at.desc.nullslast,code.asc",
    });
    expect(fetchView.mock.calls[0][1]).not.toHaveProperty("company_id");
  });

  it("preserva NULL y colecciones vacías", async () => {
    const row = {
      cost: null,
      last_position_number: null,
      code: null,
      inventory_status: "discarded",
    };
    await expect(loadDiscardedInventory(vi.fn().mockResolvedValue([row]))).resolves.toEqual([row]);
    await expect(loadDiscardedInventory(vi.fn().mockResolvedValue([]))).resolves.toEqual([]);
  });

  it("rechaza defensivamente filas que no sean descartadas", async () => {
    await expect(loadDiscardedInventory(vi.fn().mockResolvedValue([
      { casing_id: "C1", inventory_status: "installed" },
    ]))).rejects.toThrow("fila no descartada");
  });
});

describe("loadInventoryScreenData", () => {
  it("inicia las dos lecturas en paralelo y devuelve el contrato de pantalla", async () => {
    const resolvers = [];
    const fetchView = vi.fn(
      (view) => new Promise((resolve) => resolvers.push({ view, resolve })),
    );

    const pending = loadInventoryScreenData(fetchView);
    expect(fetchView).toHaveBeenCalledTimes(2);

    resolvers.find(({ view }) => view === "v_tire_inventory_available").resolve([{ casing_id: "C1", casing_code: "R1" }]);
    resolvers.find(({ view }) => view === "v_inventory_status").resolve([{ casing_id: "C2", code: "D1", inventory_status: "discarded" }]);

    await expect(pending).resolves.toEqual({
      retention: [{ casing_id: "C1", casing_code: "R1" }],
      discarded: [{ casing_id: "C2", code: "D1", inventory_status: "discarded" }],
    });
  });

  it("rechaza un casco presente en las dos pestañas", async () => {
    const fetchView = vi.fn((view) => Promise.resolve(
      view === "v_tire_inventory_available"
        ? [{ casing_id: "C1", casing_code: "RET-1" }]
        : [{ casing_id: "C1", code: "DESC-1", inventory_status: "discarded" }],
    ));

    await expect(loadInventoryScreenData(fetchView)).rejects.toThrow(
      "aparece en Retén y Descartados",
    );
  });
});
