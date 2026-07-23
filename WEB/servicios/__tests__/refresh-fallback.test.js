import { describe, expect, it, vi } from "vitest";
import {
  createServicesRefreshFallback,
  SERVICES_REFRESH_INTERVAL_MS,
} from "../refresh-fallback.js";

function targets(visibilityState = "visible") {
  const windowRef = new EventTarget();
  const documentRef = new EventTarget();
  documentRef.visibilityState = visibilityState;
  let tick = null;
  windowRef.setInterval = vi.fn((callback) => {
    tick = callback;
    return 7;
  });
  windowRef.clearInterval = vi.fn();
  return { windowRef, documentRef, tick: () => tick?.() };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("createServicesRefreshFallback", () => {
  it("refresca al volver a la ventana y programa el sondeo visible", async () => {
    const env = targets();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const stop = createServicesRefreshFallback({ refresh, ...env });

    expect(env.windowRef.setInterval).toHaveBeenCalledWith(expect.any(Function), SERVICES_REFRESH_INTERVAL_MS);
    env.windowRef.dispatchEvent(new Event("focus"));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);

    stop();
  });

  it("no consulta mientras la pestaña está oculta y refresca al hacerse visible", async () => {
    const env = targets("hidden");
    const refresh = vi.fn().mockResolvedValue(undefined);
    const stop = createServicesRefreshFallback({ refresh, ...env });

    env.tick();
    await flush();
    expect(refresh).not.toHaveBeenCalled();

    env.documentRef.visibilityState = "visible";
    env.documentRef.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);

    stop();
  });

  it("cancela temporizador y listeners al salir de la pantalla", async () => {
    const env = targets();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const stop = createServicesRefreshFallback({ refresh, ...env });

    stop();
    stop();
    env.windowRef.dispatchEvent(new Event("focus"));
    await flush();

    expect(refresh).not.toHaveBeenCalled();
    expect(env.windowRef.clearInterval).toHaveBeenCalledOnce();
    expect(env.windowRef.clearInterval).toHaveBeenCalledWith(7);
  });
});
