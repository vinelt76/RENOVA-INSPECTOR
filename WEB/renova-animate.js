/* RENOVA — utilidades de animación compartidas (conteo numérico y barra de
   progreso), con soporte de prefers-reduced-motion. Script clásico (no
   module): expone window.RenovaAnimate. */
(function () {
  const REDUCED_MOTION = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function count(el, to, opts = {}) {
    if (!el) return;
    const { duration = 550, format = v => Math.round(v).toString() } = opts;
    if (REDUCED_MOTION) { el.textContent = format(to); return; }
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(to * eased);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = format(to);
    }
    requestAnimationFrame(tick);
  }

  // prop: "width" para barras normales, "flexBasis" para segmentos de un flex.
  function growFill(el, pct, prop = "width") {
    if (!el) return;
    if (REDUCED_MOTION) { el.style[prop] = pct + "%"; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style[prop] = pct + "%"; }));
  }

  window.RenovaAnimate = { count, growFill };
})();
