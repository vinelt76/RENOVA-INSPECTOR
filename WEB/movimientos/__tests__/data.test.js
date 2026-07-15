import { describe, expect, it, vi } from "vitest";

import {
  loadAvailableInventory,
  loadUnitPositionState,
  resolveUnitId,
} from "../data.js";

const UNIT_ID = "10000000-0000-4000-8000-000000000001";
const INSPECTION_ID = "20000000-0000-4000-8000-000000000002";

const POSITION_COLUMNS = [
  "company_id",
  "unit_id",
  "plate",
  "config_id",
  "position_number",
  "side",
  "axle_number",
  "axle_type",
  "is_ground",
  "installation_id",
  "life_cycle_id",
  "casing_id",
  "casing_code",
  "brand_name",
  "model_name",
  "size_name",
  "condition",
  "retread_design",
  "cycle_number",
  "installed_at",
  "odometer_at_install",
  "rtd_at_install_mm",
  "is_empty",
  "last_inspected_on",
  "last_rtd_movi_mm",
  "last_pressure_psi",
  "last_inspection_tire_code",
  "code_mismatch",
  "installation_origin",
  "baseline_pending",
  "last_measurement_id",
  "last_brand_name",
  "last_model_name",
  "last_size_name",
  "last_condition",
  "last_retread_design",
  "last_odometer_km",
].join(",");

const INVENTORY_COLUMNS = [
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

describe("resolveUnitId", () => {
  it("prefiere la placa y resuelve la unidad sin consultar la inspección", async () => {
    const client = {
      fetchView: vi.fn().mockResolvedValue([{ unit_id: UNIT_ID, plate: "ABC-123" }]),
    };

    await expect(
      resolveUnitId({ inspectionId: INSPECTION_ID, plate: "ABC-123" }, client),
    ).resolves.toBe(UNIT_ID);
    expect(client.fetchView).toHaveBeenCalledOnce();
    expect(client.fetchView).toHaveBeenCalledWith("v_unit_position_state", {
      select: "unit_id,plate",
      plate: "eq.ABC-123",
      order: "position_number.asc",
      limit: "1",
    });
    expect(client.fetchView.mock.calls[0][1]).not.toHaveProperty("company_id");
  });

  it("obtiene la placa desde inspection_id cuando no viene en la navegación", async () => {
    const fetchView = vi
      .fn()
      .mockResolvedValueOnce([{ plate: "XYZ-789" }])
      .mockResolvedValueOnce([{ unit_id: UNIT_ID, plate: "XYZ-789" }]);

    await expect(resolveUnitId({ inspectionId: INSPECTION_ID }, fetchView)).resolves.toBe(
      UNIT_ID,
    );
    expect(fetchView.mock.calls).toEqual([
      [
        "v_inspection_dashboard_rows",
        { select: "plate", inspection_id: `eq.${INSPECTION_ID}`, limit: "1" },
      ],
      [
        "v_unit_position_state",
        {
          select: "unit_id,plate",
          plate: "eq.XYZ-789",
          order: "position_number.asc",
          limit: "1",
        },
      ],
    ]);
  });

  it("devuelve null cuando no hay navegación resoluble o las vistas no exponen filas", async () => {
    await expect(resolveUnitId({})).resolves.toBeNull();

    const inspectionNotFound = vi.fn().mockResolvedValue([]);
    await expect(
      resolveUnitId({ inspectionId: INSPECTION_ID }, inspectionNotFound),
    ).resolves.toBeNull();
    expect(inspectionNotFound).toHaveBeenCalledOnce();

    const unitNotAuthorized = vi.fn().mockResolvedValue([]);
    await expect(resolveUnitId({ plate: "NO-VISIBLE" }, unitNotAuthorized)).resolves.toBeNull();
  });
});

describe("loadUnitPositionState", () => {
  it.each([6, 8])("conserva las %i posiciones configuradas sin inventar ni recortar", async (count) => {
    const remoteRows = Array.from({ length: count }, (_, index) => ({
      position_number: index + 1,
      is_empty: false,
      rtd_at_install_mm: "18.5",
      last_rtd_movi_mm: "12.25",
      last_pressure_psi: "100",
      last_odometer_km: "123456",
    }));
    const fetchView = vi.fn().mockResolvedValue(remoteRows);

    const rows = await loadUnitPositionState(UNIT_ID, fetchView);

    expect(rows).toHaveLength(count);
    expect(rows.map(({ position_number }) => position_number)).toEqual(
      Array.from({ length: count }, (_, index) => index + 1),
    );
    expect(rows[0]).toMatchObject({
      rtd_at_install_mm: 18.5,
      last_rtd_movi_mm: 12.25,
      last_pressure_psi: 100,
      last_odometer_km: 123456,
    });
    expect(fetchView).toHaveBeenCalledWith("v_unit_position_state", {
      select: POSITION_COLUMNS,
      unit_id: `eq.${UNIT_ID}`,
      order: "position_number.asc",
    });
    expect(fetchView.mock.calls[0][1]).not.toHaveProperty("company_id");
  });

  it("conserva una posición vacía y sus NULL válidos", async () => {
    const emptyPosition = {
      position_number: 4,
      is_empty: true,
      installation_id: null,
      life_cycle_id: null,
      casing_code: null,
      rtd_at_install_mm: null,
      last_rtd_movi_mm: null,
      last_pressure_psi: null,
      last_inspection_tire_code: "LEGACY-04",
      code_mismatch: false,
    };
    const fetchView = vi.fn().mockResolvedValue([emptyPosition]);

    await expect(loadUnitPositionState(UNIT_ID, fetchView)).resolves.toEqual([emptyPosition]);
  });

  it("conserva las nueve columnas de línea base y normaliza su odómetro", async () => {
    const baselinePosition = {
      position_number: 2,
      is_empty: true,
      installation_origin: null,
      baseline_pending: true,
      last_measurement_id: "30000000-0000-4000-8000-000000000003",
      last_brand_name: "MICHELIN",
      last_model_name: "X MULTI Z",
      last_size_name: "295/80R22.5",
      last_condition: "R1",
      last_retread_design: "XZA",
      last_odometer_km: "98765",
    };

    const rows = await loadUnitPositionState(
      UNIT_ID,
      vi.fn().mockResolvedValue([baselinePosition]),
    );

    expect(rows).toEqual([{ ...baselinePosition, last_odometer_km: 98765 }]);
  });

  it("devuelve [] para una unidad inexistente, no autorizada o sin posiciones", async () => {
    await expect(loadUnitPositionState(UNIT_ID, vi.fn().mockResolvedValue([]))).resolves.toEqual(
      [],
    );
  });

  it("propaga errores de lectura para que la UI pueda degradar", async () => {
    const networkError = new Error("network down");
    await expect(
      loadUnitPositionState(UNIT_ID, vi.fn().mockRejectedValue(networkError)),
    ).rejects.toBe(networkError);
  });
});

describe("loadAvailableInventory", () => {
  it("solicita el orden canónico, normaliza numeric y conserva NULL de ciclos nuevos", async () => {
    const fetchView = vi.fn().mockResolvedValue([
      {
        life_cycle_id: "30000000-0000-4000-8000-000000000003",
        casing_code: "CAS-02",
        otd_mm: "20.75",
        last_removed_at: "2026-07-10",
        last_removal_reason: "retention",
        last_rtd_mm: "13.5",
        days_in_inventory: 3,
      },
      {
        life_cycle_id: "40000000-0000-4000-8000-000000000004",
        casing_code: null,
        otd_mm: null,
        last_removed_at: null,
        last_removal_reason: null,
        last_rtd_mm: null,
        days_in_inventory: null,
      },
    ]);

    const rows = await loadAvailableInventory(fetchView);

    expect(rows[0]).toMatchObject({ otd_mm: 20.75, last_rtd_mm: 13.5 });
    expect(rows[1]).toMatchObject({
      casing_code: null,
      otd_mm: null,
      last_removed_at: null,
      last_removal_reason: null,
      last_rtd_mm: null,
      days_in_inventory: null,
    });
    expect(fetchView).toHaveBeenCalledWith("v_tire_inventory_available", {
      select: INVENTORY_COLUMNS,
      order: "last_removed_at.desc.nullslast,casing_code.asc",
    });
    expect(fetchView.mock.calls[0][1]).not.toHaveProperty("company_id");
  });

  it("devuelve [] cuando no hay inventario disponible", async () => {
    await expect(loadAvailableInventory(vi.fn().mockResolvedValue([]))).resolves.toEqual([]);
  });
});
