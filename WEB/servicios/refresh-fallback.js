export const SERVICES_REFRESH_INTERVAL_MS = 10_000;

// Realtime sigue siendo la vía inmediata cuando la tabla está publicada.
// Este fallback cubre la configuración actual: refresca al volver a la pestaña
// y, mientras está visible, consulta periódicamente la misma vista protegida
// por RLS. Nunca escribe ni amplía permisos.
export function createServicesRefreshFallback({
  refresh,
  windowRef = globalThis,
  documentRef = globalThis.document,
  intervalMs = SERVICES_REFRESH_INTERVAL_MS,
} = {}) {
  if (typeof refresh !== "function") {
    throw new TypeError("refresh debe ser una función");
  }

  let stopped = false;
  let refreshing = false;

  const run = () => {
    if (stopped || refreshing || documentRef?.visibilityState === "hidden") return;
    refreshing = true;
    Promise.resolve()
      .then(refresh)
      .catch(() => {})
      .finally(() => { refreshing = false; });
  };

  const onFocus = () => run();
  const onVisibilityChange = () => {
    if (documentRef?.visibilityState === "visible") run();
  };

  windowRef?.addEventListener?.("focus", onFocus);
  documentRef?.addEventListener?.("visibilitychange", onVisibilityChange);
  const timerId = windowRef?.setInterval?.(run, intervalMs);

  return () => {
    if (stopped) return;
    stopped = true;
    windowRef?.removeEventListener?.("focus", onFocus);
    documentRef?.removeEventListener?.("visibilitychange", onVisibilityChange);
    if (timerId != null) windowRef?.clearInterval?.(timerId);
  };
}
