export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable=true]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isAvailable(element) {
  return Boolean(
    element &&
    !element.hidden &&
    !element.disabled &&
    element.getAttribute?.("aria-hidden") !== "true" &&
    !element.closest?.("[hidden], [inert]"),
  );
}

export function focusableElements(container) {
  if (typeof container?.querySelectorAll !== "function") return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isAvailable);
}

export function focusFirst(container, fallback = container) {
  const target = focusableElements(container)[0] ?? fallback;
  target?.focus?.();
  return target ?? null;
}

function resolveTarget(target, container) {
  const resolved = typeof target === "function" ? target() : target;
  if (typeof resolved === "string") return container.querySelector(resolved);
  return resolved;
}

/**
 * Trap reutilizable para overlays y cajones que se comportan como diálogo.
 * Calcula los controles en cada Tab para soportar contenido renderizado luego
 * de activar el trap.
 */
export function createFocusTrap({
  container,
  documentObject = globalThis.document,
  initialFocus,
  onEscape = () => {},
} = {}) {
  if (!container || !documentObject) {
    throw new TypeError("createFocusTrap requiere container y documentObject.");
  }

  let active = false;
  let restoreTarget = null;

  function moveInside() {
    const preferred = resolveTarget(initialFocus, container);
    if (isAvailable(preferred)) {
      preferred.focus?.();
      return preferred;
    }
    return focusFirst(container);
  }

  function onKeydown(event) {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onEscape(event);
      return;
    }
    if (event.key !== "Tab") return;

    const controls = focusableElements(container);
    if (!controls.length) {
      event.preventDefault();
      container.focus?.();
      return;
    }

    const first = controls[0];
    const last = controls.at(-1);
    const current = documentObject.activeElement;
    if (event.shiftKey && (current === first || !container.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !container.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  }

  function onFocusIn(event) {
    if (active && !container.contains(event.target)) moveInside();
  }

  function activate({ trigger = documentObject.activeElement, focus = true } = {}) {
    if (active) return;
    active = true;
    restoreTarget = trigger ?? null;
    documentObject.addEventListener("keydown", onKeydown, true);
    documentObject.addEventListener("focusin", onFocusIn, true);
    if (focus) moveInside();
  }

  function deactivate({ restore = true } = {}) {
    if (!active) return;
    active = false;
    documentObject.removeEventListener("keydown", onKeydown, true);
    documentObject.removeEventListener("focusin", onFocusIn, true);
    const target = restoreTarget;
    restoreTarget = null;
    if (restore && target?.isConnected !== false) target?.focus?.();
  }

  return {
    activate,
    deactivate,
    destroy() {
      deactivate({ restore: false });
    },
    get active() {
      return active;
    },
  };
}
