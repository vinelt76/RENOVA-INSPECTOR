const WHEEL_STATE_CLASSES = [
  "tc-configured",
  "tc-empty",
  "tc-occupied",
  "tc-selected",
  "tc-mismatch",
  "tc-conflict",
  "tc-origin",
  "tc-destination",
  "tc-swap",
];

function positionRowsByNumber(remoteState) {
  return new Map(
    remoteState.map((row) => [Number(row.position_number), row]),
  );
}

function positionDescription(position, row, visualState) {
  const identity = row?.casing_code || row?.last_inspection_tire_code;
  const parts = [`Posición ${position}`, visualState.label];
  if (identity && visualState.occupancy === "occupied") parts.push(identity);
  return parts.join(" · ");
}

function buildDockButton(documentObject, position, row, visualState) {
  const button = documentObject.createElement("button");
  button.type = "button";
  button.className = "tc-position";
  button.dataset.position = String(position);
  button.dataset.occupancy = visualState.occupancy;
  button.dataset.role = visualState.role;
  button.setAttribute("aria-pressed", String(visualState.flags.selected));
  button.setAttribute("aria-label", positionDescription(position, row, visualState));
  button.classList.toggle("is-selected", visualState.flags.selected);
  button.classList.toggle("is-empty", visualState.occupancy === "empty");
  button.classList.toggle("has-mismatch", visualState.flags.mismatch);
  button.classList.toggle("has-conflict", visualState.flags.conflict);

  const text = documentObject.createElement("span");
  text.className = "tc-position-copy";
  const identity = documentObject.createElement("span");
  identity.className = "tc-position-identity";
  identity.textContent = visualState.occupancy === "empty"
    ? "SIN NEUMÁTICO"
    : row?.casing_code || "CÓDIGO NO VISIBLE";
  const meta = documentObject.createElement("span");
  meta.className = "tc-position-meta";
  meta.textContent = `P${position} · ${visualState.label}`;
  text.append(identity, meta);

  button.append(text);
  return button;
}

function setWheelState(wheel, visualState, position, row) {
  for (const className of WHEEL_STATE_CLASSES) wheel.classList.remove(className);
  if (!visualState) return;

  wheel.classList.add("tc-configured", `tc-${visualState.occupancy}`);
  wheel.classList.toggle("tc-selected", visualState.flags.selected);
  wheel.classList.toggle("tc-mismatch", visualState.flags.mismatch);
  wheel.classList.toggle("tc-conflict", visualState.flags.conflict);
  wheel.classList.toggle("tc-origin", visualState.role === "origin");
  wheel.classList.toggle("tc-destination", visualState.role === "destination");
  wheel.classList.toggle("tc-swap", visualState.flags.swap);
  wheel.dataset.tcLabel = visualState.label;
  wheel.setAttribute("role", "button");
  wheel.tabIndex = 0;
  wheel.setAttribute("aria-pressed", String(visualState.flags.selected));
  wheel.setAttribute("aria-label", positionDescription(position, row, visualState));

  const tag = wheel.querySelector(".pos-3d-tag");
  if (tag) tag.textContent = `P${position} · ${visualState.label}`;
}

export function createDiagramView({
  dock,
  stage,
  documentObject = globalThis.document,
  onSelect = () => {},
} = {}) {
  if (!dock || !stage) throw new TypeError("diagram-view requiere dock y stage.");

  const wheels = [...stage.querySelectorAll(".wheel")];
  const originalWheels = new Map(
    wheels.map((wheel) => [
      wheel,
      {
        tag: wheel.querySelector(".pos-3d-tag")?.textContent ?? null,
        tcLabel: wheel.dataset.tcLabel,
        role: wheel.getAttribute("role"),
        tabindex: wheel.getAttribute("tabindex"),
        ariaLabel: wheel.getAttribute("aria-label"),
        ariaPressed: wheel.getAttribute("aria-pressed"),
      },
    ]),
  );
  let active = false;

  function restoreAttribute(element, name, value) {
    if (value == null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  function restoreWheel(wheel, original) {
    for (const className of WHEEL_STATE_CLASSES) wheel.classList.remove(className);
    if (original.tcLabel == null) delete wheel.dataset.tcLabel;
    else wheel.dataset.tcLabel = original.tcLabel;
    restoreAttribute(wheel, "role", original.role);
    restoreAttribute(wheel, "tabindex", original.tabindex);
    restoreAttribute(wheel, "aria-label", original.ariaLabel);
    restoreAttribute(wheel, "aria-pressed", original.ariaPressed);
    const tag = wheel.querySelector(".pos-3d-tag");
    if (tag && original.tag != null) tag.textContent = original.tag;
  }

  function focusDockPosition(position) {
    dock.querySelector(`.tc-position[data-position="${position}"]`)?.focus();
  }

  function onDockClick(event) {
    const button = event.target.closest(".tc-position");
    if (!button || !dock.contains(button)) return;
    const position = Number(button.dataset.position);
    onSelect(position);
    focusDockPosition(position);
  }

  function onDockKeydown(event) {
    if (!active || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }
    const current = event.target.closest(".tc-position");
    if (!current || !dock.contains(current)) return;
    const buttons = [...dock.querySelectorAll(".tc-position:not([disabled])")];
    const currentIndex = buttons.indexOf(current);
    if (currentIndex < 0 || !buttons.length) return;
    event.preventDefault();
    let nextIndex;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = buttons.length - 1;
    else {
      const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
    }
    buttons[nextIndex].focus();
  }

  function onWheelClick(event) {
    if (!active) return;
    const wheel = event.target.closest(".wheel");
    if (!wheel || !stage.contains(wheel) || !wheel.classList.contains("tc-configured")) return;

    // El listener histórico de Inspección vive en la rueda. Detener la
    // propagación en captura evita que cambie POSICIONES/selected en Movimientos.
    event.preventDefault();
    event.stopPropagation();
    onSelect(Number(wheel.dataset.pos));
  }

  function onWheelKeydown(event) {
    if (!active || !["Enter", " "].includes(event.key)) return;
    const wheel = event.target.closest(".wheel");
    if (!wheel || !stage.contains(wheel) || !wheel.classList.contains("tc-configured")) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(Number(wheel.dataset.pos));
  }

  dock.addEventListener("click", onDockClick);
  dock.addEventListener("keydown", onDockKeydown);
  stage.addEventListener("click", onWheelClick, true);
  stage.addEventListener("keydown", onWheelKeydown, true);

  return {
    setActive(nextActive) {
      active = Boolean(nextActive);
      if (active) return;

      dock.replaceChildren();
      for (const [wheel, original] of originalWheels) {
        restoreWheel(wheel, original);
      }
    },

    render(projection, remoteState = []) {
      if (!active) return;

      const rows = positionRowsByNumber(remoteState);
      const fragment = documentObject.createDocumentFragment();
      for (const [position, visualState] of projection) {
        fragment.append(
          buildDockButton(documentObject, position, rows.get(position), visualState),
        );
      }
      dock.replaceChildren(fragment);

      for (const wheel of wheels) {
        const position = Number(wheel.dataset.pos);
        const visualState = projection.get(position);
        if (visualState) setWheelState(wheel, visualState, position, rows.get(position));
        else restoreWheel(wheel, originalWheels.get(wheel));
      }
    },

    destroy() {
      this.setActive(false);
      dock.removeEventListener("click", onDockClick);
      dock.removeEventListener("keydown", onDockKeydown);
      stage.removeEventListener("click", onWheelClick, true);
      stage.removeEventListener("keydown", onWheelKeydown, true);
    },
  };
}
