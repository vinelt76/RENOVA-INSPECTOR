import { defineConfig } from "vitest/config";

// Andamiaje de pruebas del modo Movimientos (task_02).
// Entorno `node`: la lógica pura (data, batch-model, batch-store, rpc,
// diagram-projection) no toca el DOM. `localStorage` y el cliente Supabase se
// inyectan/mockean en cada test. Los módulos de UI (diagram-view, movements-ui,
// inventory-ui, summary-confirm, mode-toggle) NO se testean con vitest: se
// validan con el smoke test real de navegador (ver README y task_16).
export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.js"],
    clearMocks: true,
  },
});
