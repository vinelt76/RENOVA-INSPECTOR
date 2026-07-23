import { describe, expect, it } from "vitest";

import {
  addOrderItem,
  addRotation,
  addServiceFromInventory,
  createOrderDraft,
  createOrderId,
  groupDraftByPosition,
  orderRpcPayload,
  removeOrderPosition,
  setExitWithoutEntry,
  SUPERVISOR_ORDER_ROLES,
  validateOrderDraft,
} from "../supervisor-order-model.js";
import { inventoryOptionsForService } from "../supervisor-orders-ui.js";

const POSITIONS = [1, 2, 3, 4, 5, 6];
const INVENTORY = [
  {
    life_cycle_id: "10000000-0000-4000-8000-000000000001",
    casing_code: "CAS-INVENTARIO-1",
    brand_name: "Michelin",
    model_name: "X Multi",
    size_name: "295/80R22.5",
    condition: "R1",
    last_rtd_mm: 14.5,
  },
  {
    life_cycle_id: "10000000-0000-4000-8000-000000000002",
    casing_code: "CAS-INVENTARIO-2",
    brand_name: "Goodyear",
    model_name: "KMAX",
    size_name: "275/80R22.5",
    condition: "N",
    last_rtd_mm: null,
  },
];

describe("orden del supervisor", () => {
  it("usa randomUUID cuando el navegador lo expone", () => {
    const expected = "40000000-0000-4000-8000-000000000001";
    expect(createOrderId({ randomUUID: () => expected })).toBe(expected);
  });

  it("genera un UUID v4 con getRandomValues en navegadores sin randomUUID", () => {
    const cryptoApi = {
      getRandomValues(bytes) {
        bytes.fill(0);
        return bytes;
      },
    };
    const orderId = createOrderId(cryptoApi);

    expect(orderId).toBe("00000000-0000-4000-8000-000000000000");
    expect(orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("falla claramente si Web Crypto no existe", () => {
    expect(() => createOrderId(null)).toThrow("generación aleatoria compatible");
  });

  it("acepta el rol web histórico sin habilitar al operario", () => {
    expect(SUPERVISOR_ORDER_ROLES).toContain("fleet_manager");
    expect(SUPERVISOR_ORDER_ROLES).toContain("tire_supervisor");
    expect(SUPERVISOR_ORDER_ROLES).not.toContain("operator");
  });

  it("solo envía indicaciones operativas, sin datos técnicos del neumático", () => {
    const result = addOrderItem(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      { direction: "exit", position: 2, reason: "claim", notes: "Neumático nuevo" },
      POSITIONS,
    );

    expect(result.ok).toBe(true);
    expect(orderRpcPayload(result.draft)).toEqual([{
      direction: "exit",
      position: 2,
      reason: "claim",
      notes: "Neumático nuevo",
    }]);
    expect(orderRpcPayload(result.draft)[0]).not.toHaveProperty("casing_code");
    expect(orderRpcPayload(result.draft)[0]).not.toHaveProperty("odometer_km");
  });

  it("la rotación atiende las dos posiciones, con cada ingreso pegado a su salida", () => {
    const result = addRotation(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      3,
      5,
      "intercambiar gemelos",
      POSITIONS,
    );

    expect(result.ok).toBe(true);
    // El orden es contractual: `v_tire_services` parea el ingreso con la salida de
    // `sequence - 1`. Agrupar de otra forma rompe el pareo sin fallar.
    expect(result.draft.items).toEqual([
      { direction: "exit", position: 3, reason: "rotation", notes: "intercambiar gemelos" },
      {
        direction: "entry",
        position: 3,
        origin_type: "vehicle",
        origin_position: 5,
        notes: "Rotar desde P5 · intercambiar gemelos",
      },
      { direction: "exit", position: 5, reason: "rotation", notes: "intercambiar gemelos" },
      {
        direction: "entry",
        position: 5,
        origin_type: "vehicle",
        origin_position: 3,
        notes: "Rotar desde P3 · intercambiar gemelos",
      },
    ]);
  });

  it("agrega cualquier servicio no rotación junto con la llanta elegida del inventario", () => {
    const result = addServiceFromInventory(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      {
        position: 2,
        reason: "retention",
        inventoryItem: INVENTORY[0],
        notes: "Cambiar antes de salir",
      },
      POSITIONS,
    );

    expect(result.ok).toBe(true);
    expect(orderRpcPayload(result.draft)).toEqual([
      {
        direction: "exit",
        position: 2,
        reason: "retention",
        notes: "Cambiar antes de salir",
      },
      {
        direction: "entry",
        position: 2,
        life_cycle_id: INVENTORY[0].life_cycle_id,
        origin_type: "inventory",
        casing_code: "CAS-INVENTARIO-1",
        brand_name: "Michelin",
        model_name: "X Multi",
        size_name: "295/80R22.5",
        condition: "R1",
        last_rtd_mm: 14.5,
        notes: "Desde inventario · Cambiar antes de salir",
      },
    ]);
    expect(validateOrderDraft(result.draft, POSITIONS)).toEqual([]);
  });

  it("no deja elegir la misma llanta de inventario para dos posiciones", () => {
    const first = addServiceFromInventory(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      { position: 1, reason: "repair", inventoryItem: INVENTORY[0] },
      POSITIONS,
    );
    const duplicate = addServiceFromInventory(
      first.draft,
      { position: 2, reason: "claim", inventoryItem: INVENTORY[0] },
      POSITIONS,
    );

    expect(duplicate).toMatchObject({
      ok: false,
      errors: ["Ese neumático ya entra en otra posición del borrador."],
    });
  });

  it("filtra el inventario y deshabilita la llanta ya elegida", () => {
    const draft = addServiceFromInventory(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      { position: 1, reason: "repair", inventoryItem: INVENTORY[0] },
      POSITIONS,
    ).draft;

    expect(inventoryOptionsForService(INVENTORY, draft, "michelin 295")).toEqual([
      { item: INVENTORY[0], disabled: true },
    ]);
    expect(inventoryOptionsForService(INVENTORY, draft, "goodyear")).toEqual([
      { item: INVENTORY[1], disabled: false },
    ]);
  });

  it("una rotación deja las dos posiciones ocupadas y ningún casco sin salida", () => {
    const result = addRotation(createOrderDraft({ scheduledFor: "2026-07-20" }), 3, 5, "", POSITIONS);
    const groups = groupDraftByPosition(result.draft);

    expect(groups.map((group) => group.position)).toEqual([3, 5]);
    for (const group of groups) {
      expect(group.exit).toBeTruthy();
      expect(group.entry).toBeTruthy();
    }
    expect(validateOrderDraft(result.draft, POSITIONS)).toEqual([]);
  });

  it("no deja emitir una salida que dejaría la posición vacía por descuido", () => {
    const draft = createOrderDraft({
      scheduledFor: "2026-07-20",
      items: [{ direction: "exit", position: 1, reason: "retention" }],
    });

    expect(validateOrderDraft(draft, POSITIONS)).toEqual([
      "P1: falta el ingreso. Indica qué neumático entra, o marca la posición como sin reemplazo.",
    ]);
  });

  it("permite armar el borrador con una salida suelta: la completitud es puerta de emisión", () => {
    const result = addOrderItem(
      createOrderDraft({ scheduledFor: "2026-07-20" }),
      { direction: "exit", position: 1, reason: "retention" },
      POSITIONS,
    );

    expect(result.ok).toBe(true);
    expect(validateOrderDraft(result.draft, POSITIONS, { requireCompleteness: false })).toEqual([]);
  });

  it("acepta la posición sin reemplazo cuando el supervisor la declara", () => {
    const draft = setExitWithoutEntry(
      createOrderDraft({
        scheduledFor: "2026-07-20",
        items: [{ direction: "exit", position: 1, reason: "retention" }],
      }),
      1,
    );

    expect(validateOrderDraft(draft, POSITIONS)).toEqual([]);
    expect(orderRpcPayload(draft)).toEqual([
      { direction: "exit", position: 1, reason: "retention", without_entry: true },
    ]);
  });

  it("volver a pedir reemplazo revierte la declaración", () => {
    const draft = setExitWithoutEntry(
      setExitWithoutEntry(
        createOrderDraft({
          scheduledFor: "2026-07-20",
          items: [{ direction: "exit", position: 1, reason: "retention" }],
        }),
        1,
      ),
      1,
      false,
    );

    expect(validateOrderDraft(draft, POSITIONS)).toHaveLength(1);
    expect(orderRpcPayload(draft)[0]).not.toHaveProperty("without_entry");
  });

  it("un ingreso suelto es una instalación legítima y no exige salida", () => {
    const draft = createOrderDraft({
      scheduledFor: "2026-07-20",
      items: [{ direction: "entry", position: 4 }],
    });

    expect(validateOrderDraft(draft, POSITIONS)).toEqual([]);
  });

  it("quitar una posición retira sus dos mitades, no media rotación", () => {
    const rotation = addRotation(createOrderDraft({ scheduledFor: "2026-07-20" }), 3, 5, "", POSITIONS);
    const draft = removeOrderPosition(rotation.draft, 3);

    expect(groupDraftByPosition(draft).map((group) => group.position)).toEqual([5]);
    expect(draft.items).toHaveLength(2);
  });

  it("rechaza duplicados, salidas sin razón y posiciones no configuradas", () => {
    const draft = createOrderDraft({
      scheduledFor: "2026-07-20",
      items: [
        { direction: "exit", position: 1, reason: "repair" },
        { direction: "exit", position: 1, reason: "discard" },
        { direction: "entry", position: 8 },
      ],
    });

    expect(validateOrderDraft(draft, POSITIONS)).toEqual(expect.arrayContaining([
      "P1: la salida está repetida.",
      "Indicación 3: posición inválida.",
    ]));
  });
});
