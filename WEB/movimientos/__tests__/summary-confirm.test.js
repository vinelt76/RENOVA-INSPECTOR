import { describe, expect, it } from "vitest";

import {
  defaultSummaryHeader,
  installationDateWarning,
  summaryRows,
  validateSummaryHeader,
} from "../summary-confirm.js";

describe("summary-confirm helpers", () => {
  it("ordena un payload sellado por seq sin perder el índice editable", () => {
    const movements = [
      { seq: 3, op: "mount", position: 2 },
      { seq: 1, op: "discard", position: 1 },
      { seq: 2, op: "swap", position_a: 3, position_b: 4 },
    ];

    expect(summaryRows({ movements })).toEqual([
      { movement: movements[1], index: 1, seq: 1 },
      { movement: movements[2], index: 2, seq: 2 },
      { movement: movements[0], index: 0, seq: 3 },
    ]);
  });

  it("usa el orden del borrador cuando todavía no existe seq", () => {
    const movements = [
      { op: "send_to_retention", position: 1 },
      { op: "mount", position: 1 },
    ];

    expect(summaryRows({ movements }).map(({ index, seq }) => ({ index, seq }))).toEqual([
      { index: 0, seq: 1 },
      { index: 1, seq: 2 },
    ]);
  });

  it("exige fecha real y odómetro entero no negativo", () => {
    expect(validateSummaryHeader({
      performedAt: "2026-07-14",
      odometer: "120045",
      notes: "Turno tarde",
    })).toEqual({
      valid: true,
      errors: [],
      value: {
        performedAt: "2026-07-14",
        odometer: 120045,
        notes: "Turno tarde",
      },
    });

    for (const odometer of ["", "12.5", "-1", "no-numérico"]) {
      expect(validateSummaryHeader({
        performedAt: "2026-07-14",
        odometer,
      }).valid).toBe(false);
    }
    expect(validateSummaryHeader({
      performedAt: "2026-02-30",
      odometer: "1",
    }).valid).toBe(false);
  });

  it("calcula hoy con la fecha local inyectada", () => {
    expect(defaultSummaryHeader(new Date(2026, 6, 14, 23, 30))).toEqual({
      performedAt: "2026-07-14",
      odometer: "",
      notes: "",
    });
  });

  it("advierte sin bloquear cuando una retirada antecede a installed_at", () => {
    const remoteState = [
      { position_number: 1, installed_at: "2026-07-12T10:00:00Z" },
      { position_number: 2, installed_at: "2026-07-09" },
      { position_number: 3, installed_at: "2026-07-13" },
    ];
    const draft = {
      movements: [
        { op: "discard", position: 1 },
        { op: "swap", position_a: 2, position_b: 3 },
        { op: "mount", position: 4 },
      ],
    };

    expect(installationDateWarning("2026-07-10", remoteState, draft)).toBe(
      "Revisa la fecha: es anterior a la instalación visible de P1, P3.",
    );
    expect(installationDateWarning("2026-07-13", remoteState, draft)).toBeNull();
  });
});
