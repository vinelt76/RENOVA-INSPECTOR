import { normalizeSearchText } from "./search.js";

/**
 * Un solo componente de filtro (F1), parametrizado por pantalla con `facets`
 * (CONTRATOS_DATOS.md §1.2). Combobox + listbox como el buscador global
 * (`WEB/buscador/finder-controller.js`): mismo patrón de teclado y ARIA, sin
 * copiarlo. Chips reutilizables con selección y remoción accesibles.
 * (`tires-filter-chip`: botón "Etiqueta: valor ×", `aria-label` de quitar).
 *
 * Contrato: CONTRATOS_DATOS.md §1 y task_03.
 */

let instanceCounter = 0;

function createElement(documentObject, tagName, className, text) {
  const element = documentObject.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function sanitizeChips(chips, facetByKey) {
  return (Array.isArray(chips) ? chips : []).filter((chip) => chip && facetByKey.has(chip.facet));
}

function chipLabel(facet, chip) {
  return chip.label || `${facet?.label ?? chip.facet}: ${chip.value}`;
}

export function createFilterBar({ mount, facets = [], rows = [], chips = [], onChange, onOpen } = {}) {
  if (!mount || typeof mount.replaceChildren !== "function") {
    throw new TypeError("createFilterBar requiere un `mount` (elemento contenedor).");
  }
  const documentObject = mount.ownerDocument ?? globalThis.document;
  const facetList = Array.isArray(facets) ? facets : [];
  const facetByKey = new Map(facetList.map((facet) => [facet.key, facet]));
  const instanceId = `filter-bar-${++instanceCounter}`;

  let currentRows = Array.isArray(rows) ? rows : [];
  let currentChips = sanitizeChips(chips, facetByKey);
  let suggestionGroups = []; // [{facet, values:[...]}]
  let flatSuggestions = [];  // [{facet, value}]
  let activeIndex = -1;
  let listboxOpen = false;

  const root = createElement(documentObject, "div", "filter-bar");
  const chipList = createElement(documentObject, "div", "filter-bar-chips");
  chipList.setAttribute("aria-label", "Filtros activos");

  const fieldWrap = createElement(documentObject, "div", "filter-bar-field");
  const input = createElement(documentObject, "input", "filter-bar-input");
  input.type = "text";
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", `${instanceId}-listbox`);
  input.setAttribute("aria-label", "Filtrar");
  input.placeholder = "Escribe para filtrar…";
  fieldWrap.append(input);

  const listbox = createElement(documentObject, "div", "filter-bar-listbox");
  listbox.id = `${instanceId}-listbox`;
  listbox.setAttribute("role", "listbox");
  listbox.setAttribute("aria-label", "Sugerencias de filtro");
  listbox.hidden = true;

  root.append(chipList, fieldWrap, listbox);
  mount.replaceChildren(root);

  function emitChange() {
    if (typeof onChange === "function") onChange([...currentChips]);
  }

  function renderChips() {
    chipList.replaceChildren();
    chipList.hidden = currentChips.length === 0;
    currentChips.forEach((chip, index) => {
      const facet = facetByKey.get(chip.facet);
      const label = chipLabel(facet, chip);
      const button = createElement(documentObject, "button", "filter-bar-chip");
      button.type = "button";
      const text = createElement(documentObject, "span", "filter-bar-chip-text", `${label} ×`);
      text.title = label; // valor completo aunque el chip trunque visualmente
      button.append(text);
      button.setAttribute("aria-label", `Quitar filtro ${label}`);
      button.addEventListener("click", () => removeChipAt(index));
      chipList.append(button);
    });
  }

  function computeSuggestionGroups(query) {
    const normalizedQuery = normalizeSearchText(query);
    const groups = [];
    for (const facet of facetList) {
      const values = typeof facet.values === "function" ? facet.values(currentRows) : [];
      const matches = normalizedQuery
        ? values.filter((value) => normalizeSearchText(value).includes(normalizedQuery))
        : values;
      if (matches.length) groups.push({ facet, values: matches });
    }
    return groups;
  }

  function renderListbox() {
    listbox.replaceChildren();
    if (!listboxOpen) {
      listbox.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      return;
    }
    listbox.hidden = false;
    input.setAttribute("aria-expanded", "true");

    if (!flatSuggestions.length) {
      const message = currentRows.length === 0
        ? "Sin datos cargados para sugerir."
        : "Sin coincidencias.";
      listbox.append(createElement(documentObject, "p", "filter-bar-empty", message));
      input.removeAttribute("aria-activedescendant");
      return;
    }

    let flatIndex = 0;
    for (const group of suggestionGroups) {
      const section = createElement(documentObject, "div", "filter-bar-group");
      section.append(createElement(documentObject, "p", "filter-bar-group-heading", group.facet.label));
      const list = createElement(documentObject, "div", "filter-bar-group-list");
      for (const value of group.values) {
        const optionIndex = flatIndex++;
        const option = createElement(documentObject, "button", "filter-bar-option", value);
        option.type = "button";
        option.id = `${instanceId}-option-${optionIndex}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(optionIndex === activeIndex));
        option.dataset.active = String(optionIndex === activeIndex);
        // mousedown antes que blur: conserva el foco en el input al elegir con mouse/touch.
        option.addEventListener("mousedown", (event) => event.preventDefault());
        option.addEventListener("click", () => selectSuggestion({ facet: group.facet, value }));
        list.append(option);
      }
      section.append(list);
      listbox.append(section);
    }
    if (activeIndex >= 0 && activeIndex < flatSuggestions.length) {
      input.setAttribute("aria-activedescendant", `${instanceId}-option-${activeIndex}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function openListbox() {
    listboxOpen = true;
    suggestionGroups = computeSuggestionGroups(input.value);
    flatSuggestions = suggestionGroups.flatMap((group) => group.values.map((value) => ({ facet: group.facet, value })));
    if (activeIndex < 0 || activeIndex >= flatSuggestions.length) {
      // Con texto escrito y coincidencias, resalta la primera: escribir "ize2w"
      // y tocar Enter filtra directo, sin necesitar una flecha antes. Con el
      // campo vacío (navegando la lista completa) no se resalta nada solo:
      // Enter sin haber elegido nada no crea un chip por accidente.
      activeIndex = input.value.trim() && flatSuggestions.length ? 0 : -1;
    }
    renderListbox();
  }

  function closeListbox() {
    listboxOpen = false;
    activeIndex = -1;
    renderListbox();
  }

  function setActiveIndex(nextIndex) {
    if (!flatSuggestions.length) {
      activeIndex = -1;
      return;
    }
    activeIndex = Math.max(0, Math.min(nextIndex, flatSuggestions.length - 1));
    renderListbox();
  }

  function selectSuggestion(item) {
    const chip = { facet: item.facet.key, value: item.value, label: `${item.facet.label}: ${item.value}` };
    currentChips = [...currentChips, chip];
    input.value = "";
    renderChips();
    emitChange();
    closeListbox();
    input.focus();
  }

  function removeChipAt(index) {
    currentChips = currentChips.filter((_, i) => i !== index);
    renderChips();
    emitChange();
  }

  function onInput() {
    activeIndex = -1;
    openListbox();
  }

  function onFocus() {
    onOpen?.();
    openListbox();
  }

  function onKeydown(event) {
    if (event.key === "Backspace" && !input.value && currentChips.length) {
      event.preventDefault();
      removeChipAt(currentChips.length - 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!listboxOpen) openListbox();
      setActiveIndex(activeIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!listboxOpen) openListbox();
      setActiveIndex(activeIndex - 1);
      return;
    }
    if (event.key === "Home" && listboxOpen) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && listboxOpen) {
      event.preventDefault();
      setActiveIndex(flatSuggestions.length - 1);
      return;
    }
    if (event.key === "Enter") {
      const item = flatSuggestions[activeIndex];
      if (item) {
        event.preventDefault();
        selectSuggestion(item);
      }
      return;
    }
    if (event.key === "Escape" && listboxOpen) {
      // Cierra el desplegable sin borrar chips (contrato task_03 §5).
      event.preventDefault();
      closeListbox();
    }
  }

  function onFocusOut(event) {
    const next = event.relatedTarget;
    if (next && root.contains(next)) return;
    closeListbox();
  }

  function onGlobalKeydown(event) {
    if (event.code !== "Space" || !event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    input.focus();
    openListbox();
  }

  input.addEventListener("input", onInput);
  input.addEventListener("focus", onFocus);
  input.addEventListener("keydown", onKeydown);
  root.addEventListener("focusout", onFocusOut);
  documentObject.addEventListener?.("keydown", onGlobalKeydown);

  renderChips();

  return {
    setRows(nextRows) {
      currentRows = Array.isArray(nextRows) ? nextRows : [];
      if (listboxOpen) openListbox();
    },
    getChips() {
      return [...currentChips];
    },
    // Setter de sincronización (restaurar desde URL/historial): no llama a
    // `onChange` — quien restaura el estado ya lo conoce. `onChange` es solo
    // para cambios que origina la persona usuaria (elegir/quitar un chip),
    // así task_05/task_06 pueden usarlo para escribir la URL sin bucle.
    setChips(nextChips) {
      currentChips = sanitizeChips(nextChips, facetByKey);
      renderChips();
    },
    destroy() {
      input.removeEventListener("input", onInput);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("keydown", onKeydown);
      root.removeEventListener("focusout", onFocusOut);
      documentObject.removeEventListener?.("keydown", onGlobalKeydown);
      mount.replaceChildren();
    },
  };
}
