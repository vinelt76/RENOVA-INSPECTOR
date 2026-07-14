import { describe, it, expect } from "vitest";

// Smoke del runner (task_02): sólo confirma que vitest corre en este scope.
// Los tests reales de lógica los agregan task_04..task_08, task_13 y task_15.
describe("tire-change · runner smoke", () => {
  it("vitest está configurado y corre", () => {
    expect(1 + 1).toBe(2);
  });
});
