import { afterEach, describe, expect, it, vi } from "vitest";
import { loadServices, loadServicesProfile, SERVICE_COLUMNS, SERVICES_FETCH_LIMIT } from "../data.js";

describe("loadServices", () => {
  afterEach(() => {
    delete globalThis.RenovaSupabase;
  });

  it("lee la vista con select, order y limit exactos", async () => {
    const fetchView = vi.fn().mockResolvedValue([]);
    await loadServices({}, fetchView);
    expect(fetchView).toHaveBeenCalledWith("v_tire_services", {
      select: SERVICE_COLUMNS.join(","),
      order: "captured_at.desc,sequence.asc",
      limit: "2000",
    });
  });

  it("no envía company_id como filtro", async () => {
    const fetchView = vi.fn().mockResolvedValue([]);
    await loadServices({}, fetchView);
    expect(fetchView.mock.calls[0][1]).not.toHaveProperty("company_id");
  });

  it("usa una lista explícita y nunca select estrella", async () => {
    const fetchView = vi.fn().mockResolvedValue([]);
    await loadServices({}, fetchView);
    expect(fetchView.mock.calls[0][1].select).not.toBe("*");
    expect(fetchView.mock.calls[0][1].select).toContain("rotation_pairing");
  });

  it("marca truncado al llenar exactamente el límite", async () => {
    const result = await loadServices({ limit: 2 }, vi.fn().mockResolvedValue([{}, {}]));
    expect(result).toMatchObject({ limit: 2, truncated: true });
  });

  it("no marca truncado con menos filas", async () => {
    const result = await loadServices({ limit: 2 }, vi.fn().mockResolvedValue([{}]));
    expect(result).toMatchObject({ limit: 2, truncated: false });
  });

  it("normaliza las columnas numéricas", async () => {
    const result = await loadServices({}, vi.fn().mockResolvedValue([{
      sequence: "2", position_number: "7", rtd_min_mm: "4.80", pair_position_number: "7",
      entry_origin_position: "3",
    }]));
    expect(result.rows[0]).toMatchObject({
      sequence: 2, position_number: 7, rtd_min_mm: 4.8, pair_position_number: 7,
      entry_origin_position: 3,
    });
  });

  it("pide el origen derivado del neumático que entra", () => {
    expect(SERVICE_COLUMNS).toContain("entry_origin_position");
  });

  it("acepta el cliente global", async () => {
    globalThis.RenovaSupabase = { fetchView: vi.fn().mockResolvedValue([]) };
    await expect(loadServices()).resolves.toMatchObject({ rows: [], limit: SERVICES_FETCH_LIMIT, truncated: false });
  });

  it("lanza si no existe fetchView inyectable ni global", async () => {
    await expect(loadServices()).rejects.toThrow("RenovaSupabase.fetchView no está disponible");
  });
});

describe("loadServicesProfile", () => {
  it("no consulta si falta el usuario", async () => {
    const fetchView = vi.fn();
    await expect(loadServicesProfile(null, fetchView)).resolves.toBeNull();
    expect(fetchView).not.toHaveBeenCalled();
  });

  it("carga solo el perfil necesario para decidir acceso", async () => {
    const profile = { id: "u1", company_id: "c1", role: "fleet_manager", active: true };
    const fetchView = vi.fn().mockResolvedValue([profile]);
    await expect(loadServicesProfile("u1", fetchView)).resolves.toEqual(profile);
    expect(fetchView).toHaveBeenCalledWith("profiles", {
      select: "id,company_id,full_name,role,active",
      id: "eq.u1",
      limit: "1",
    });
  });
});
