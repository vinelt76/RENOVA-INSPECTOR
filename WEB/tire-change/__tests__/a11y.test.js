import { describe, expect, it, vi } from "vitest";

import {
  createFocusTrap,
  focusableElements,
} from "../a11y.js";

function fixture() {
  const listeners = new Map();
  const documentObject = {
    activeElement: null,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    removeEventListener(type, callback) {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
  };
  const element = (name) => ({
    name,
    hidden: false,
    disabled: false,
    isConnected: true,
    getAttribute: () => null,
    closest: () => null,
    focus() {
      documentObject.activeElement = this;
    },
  });
  const first = element("first");
  const last = element("last");
  const trigger = element("trigger");
  const container = element("container");
  container.querySelectorAll = () => [first, last];
  container.querySelector = () => first;
  container.contains = (candidate) => [container, first, last].includes(candidate);
  return { container, documentObject, first, last, trigger, listeners };
}

function keyboardEvent(key, { shiftKey = false } = {}) {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

describe("a11y focus helpers", () => {
  it("filtra controles ocultos, deshabilitados o dentro de regiones inertes", () => {
    const available = {
      hidden: false,
      disabled: false,
      getAttribute: () => null,
      closest: () => null,
    };
    const hidden = { ...available, hidden: true };
    const disabled = { ...available, disabled: true };
    const inert = { ...available, closest: () => ({ inert: true }) };
    const container = { querySelectorAll: () => [available, hidden, disabled, inert] };

    expect(focusableElements(container)).toEqual([available]);
  });

  it("cicla Tab, maneja Escape y restaura el foco al disparador", () => {
    const { container, documentObject, first, last, trigger, listeners } = fixture();
    const onEscape = vi.fn();
    const trap = createFocusTrap({ container, documentObject, initialFocus: first, onEscape });

    trap.activate({ trigger });
    expect(documentObject.activeElement).toBe(first);

    documentObject.activeElement = last;
    const forward = keyboardEvent("Tab");
    listeners.get("keydown")(forward);
    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(documentObject.activeElement).toBe(first);

    const backward = keyboardEvent("Tab", { shiftKey: true });
    listeners.get("keydown")(backward);
    expect(documentObject.activeElement).toBe(last);

    const escape = keyboardEvent("Escape");
    listeners.get("keydown")(escape);
    expect(onEscape).toHaveBeenCalledOnce();
    expect(escape.stopPropagation).toHaveBeenCalledOnce();

    trap.deactivate();
    expect(documentObject.activeElement).toBe(trigger);
    expect(trap.active).toBe(false);
  });
});
