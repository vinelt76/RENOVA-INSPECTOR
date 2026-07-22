import { describe, expect, it } from "vitest";

import {
  distinctInspectionDateValues,
  distinctInspectionExactDateValues,
  distinctInspectionMonthValues,
  formatInspectionDate,
  formatInspectionMonth,
  matchInspectionDateFacet,
  matchInspectionMonthFacet,
} from "../inspection-date-facets.js";

const rows = [
  { lastInspectionOn: "2026-05-20" },
  { lastInspectionOn: "2026-05-15" },
  { lastInspectionOn: "2026-04-30" },
  { lastInspectionOn: "2025-05-10" },
  { lastInspectionOn: null },
];

describe("inspection date facets", () => {
  it("orders exact dates first and months afterward, newest first", () => {
    expect(distinctInspectionDateValues(rows)).toEqual([
      "20 mayo 2026",
      "15 mayo 2026",
      "30 abril 2026",
      "10 mayo 2025",
      "mayo 2026",
      "abril 2026",
      "mayo 2025",
    ]);
  });

  it("matches an exact date, an ISO date, or its month", () => {
    expect(matchInspectionDateFacet(rows[0], "20 mayo 2026")).toBe(true);
    expect(matchInspectionDateFacet(rows[0], "2026-05-20")).toBe(true);
    expect(matchInspectionDateFacet(rows[0], "mayo 2026")).toBe(true);
    expect(matchInspectionDateFacet(rows[0], "abril 2026")).toBe(false);
  });

  it("offers and matches only month values when a screen needs that scope", () => {
    expect(distinctInspectionExactDateValues(rows)).toEqual([
      "20 mayo 2026", "15 mayo 2026", "30 abril 2026", "10 mayo 2025",
    ]);
    expect(distinctInspectionMonthValues(rows)).toEqual(["mayo 2026", "abril 2026", "mayo 2025"]);
    expect(matchInspectionMonthFacet(rows[0], "mayo 2026")).toBe(true);
    expect(matchInspectionMonthFacet(rows[0], "20 mayo 2026")).toBe(false);
  });

  it("formats invalid values as null", () => {
    expect(formatInspectionDate("2026-13-01")).toBeNull();
    expect(formatInspectionMonth("2026-00")).toBeNull();
  });
});
