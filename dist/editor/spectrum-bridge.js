import { activeClassNames } from "./graphite-ui.js";
export const BUTTON_SELECTOR =
  ":is(button,sp-button,sp-action-button,sp-menu-item)";
export const FIELD_SELECTOR =
  ":is(input,sp-textfield,sp-number-field,sp-slider,sp-checkbox,sp-switch)";
export function spectrumControlTag(node) {
  if (node.tagName === "BUTTON")
    return node.closest(".context,.ux-menu,.workspace-menu,.tool-flyout-menu")
      ? "sp-menu-item"
      : node.classList.contains("primary")
        ? "sp-button"
        : "sp-action-button";
  if (node.tagName === "SELECT") return "sp-picker";
  if (
    node.tagName !== "INPUT" ||
    ["file", "color", "hidden"].includes(node.type)
  )
    return null;
  return (
    {
      number: "sp-number-field",
      range: "sp-slider",
      checkbox: node.hasAttribute("data-setting") ? "sp-switch" : "sp-checkbox",
      radio: null,
    }[node.type] ||
    (["text", "search", "email", "password", "url", "tel"].includes(node.type)
      ? "sp-textfield"
      : null)
  );
}
export function setSpectrumTheme(theme, dark) {
  if (!theme) return;
  theme.setAttribute("color", dark ? "dark" : "light");
  theme.classList.remove("spectrum--dark", "spectrum--light");
  theme.classList.add(dark ? "spectrum--dark" : "spectrum--light");
}
export function replaceControl(node) {
  const tag =
    node.tagName === "BUTTON" && node.closest(".view-tabs")
      ? "sp-tab"
      : spectrumControlTag(node);
  if (!tag) return node;
  const next = document.createElement(tag);
  for (const attr of node.attributes) next.setAttribute(attr.name, attr.value);
  next.setAttribute("size", "s");
  next.dataset.spectrumControl = "";
  if (!next.hasAttribute?.("aria-label"))
    next.setAttribute("aria-label", node.getAttribute("placeholder") ||
      (node.tagName === "BUTTON" ? node.textContent?.trim() || node.getAttribute("title") : node.parentElement?.querySelector("label")?.textContent) ||
      node.textContent?.trim() || node.parentElement?.textContent?.trim().slice(0, 80) || "Control");
  next.className =
    node.className +
    " " +
    activeClassNames({
      selected: node.classList.contains("active"),
      emphasized: node.classList.contains("primary"),
    });
  if (tag === "sp-button") {
    next.setAttribute("variant", "accent");
    next.setAttribute("treatment", "fill");
  }
  if (tag === "sp-action-button") next.setAttribute("quiet", "");
  if ((tag === "sp-action-button" || tag === "sp-button") && !next.hasAttribute("title") && node.closest(".selection-header,.prop-buttons,.desktop-appearance"))
    next.setAttribute("title", next.getAttribute("aria-label"));
  if (node.tagName === "SELECT") {
    const value = node.value;
    for (const option of node.options) {
      const item = document.createElement("sp-menu-item");
      item.value = option.value;
      item.textContent = option.textContent;
      item.disabled = option.disabled;
      next.appendChild(item);
    }
    next.value = value;
    next.setAttribute(
      "label",
      node.getAttribute("aria-label") ||
        node.parentElement?.querySelector("label")?.textContent ||
        "Elegir",
    );
  } else if (node.tagName === "INPUT") {
    next.type = node.type;
    next.value =
      node.type === "number" || node.type === "range"
        ? Number(node.value)
        : node.value;
    next.checked = node.checked;
    for (const p of ["min", "max", "step"])
      if (node.hasAttribute(p)) next[p] = Number(node[p]);
    if (tag === "sp-slider")
      next.setAttribute(
        "label",
        node.getAttribute("aria-label") ||
          node.parentElement?.querySelector("label")?.textContent ||
          "Valor",
      );
    if (tag === "sp-slider" && node.parentElement?.tagName === "LABEL")
      for (const child of [...node.parentElement.childNodes])
        if (child.nodeType === 3) child.remove();
  } else {
    while (node.firstChild) next.appendChild(node.firstChild);
    if (node.classList.contains("template")) {
      const content = document.createElement("span");
      content.className = "template-content";
      while (next.firstChild) content.appendChild(next.firstChild);
      next.appendChild(content);
    }
    const icon = next.querySelector(".ui-icon");
    if (icon) icon.setAttribute("slot", "icon");
  }
  next.disabled = node.disabled;
  if (tag === "sp-slider")
    next.addEventListener("input", (event) => {
      const source = event.composedPath()[0];
      // Spectrum's native input bubbles before its host value is synchronized.
      // Legacy delegated handlers must see the current value, including the final step.
      if (source !== next && source.tagName === "INPUT" && Number.isFinite(Number(source.value)))
        next.value = Number(source.value);
    }, { capture: true });
  for (const prop of [
    "onclick",
    "onchange",
    "oninput",
    "onkeydown",
    "onblur",
    "onfocus",
    "onpointerdown",
    "onpointercancel",
  ])
    if (node[prop]) next[prop] = node[prop];
  // Existing color/rename/export handlers may close over the original control.
  // Forward properties to the Spectrum host so these closures keep live values.
  for (const key of ["value", "checked", "disabled"]) {
    try {
      Object.defineProperty(node, key, {
        configurable: true,
        get: () => next[key],
        set: (value) => {
          next[key] = value;
        },
      });
    } catch {}
  }
  for (const key of ["focus", "select", "setSelectionRange"])
    if (typeof next[key] === "function")
      node[key] = (...args) => next[key](...args);
  node.replaceWith(next);
  return next;
}
function replaceMenu(details, editor) {
  const menu = document.createElement("sp-action-menu");
  menu.className = details.className;
  menu.setAttribute("size", "s");
  menu.setAttribute("quiet", "");
  const summary = details.querySelector("summary");
  if(details.classList.contains('tool-flyout')){const icon=summary?.querySelector('svg')?.cloneNode(true);if(icon){icon.setAttribute('slot','icon');menu.appendChild(icon);}menu.setAttribute('aria-label',summary?.getAttribute('aria-label')||'Más herramientas');}
  if(!details.classList.contains('tool-flyout')){const label=document.createElement('span');label.setAttribute('slot','label-only');label.textContent=summary?.textContent.trim()||'Ventana';menu.appendChild(label);}
  menu.setAttribute(
    "label",
    summary?.textContent.trim() ||
      summary?.getAttribute("aria-label") ||
      "Herramientas",
  );
  for (const button of details.querySelectorAll("button")) {
    const item = document.createElement("sp-menu-item");
    for (const attr of button.attributes)
      item.setAttribute(attr.name, attr.value);
    item.value =
      button.dataset.uxCommand ||
      button.dataset.tool ||
      button.dataset.workspaceShow ||
      button.textContent;
    item.disabled = button.disabled;
    while (button.firstChild) item.appendChild(button.firstChild);
    const icon = item.querySelector(".ui-icon");
    if (icon) icon.setAttribute("slot", "icon");
    menu.appendChild(item);
  }
  menu.addEventListener("click", (e) => e.stopPropagation());
  menu.addEventListener("change", (e) => {
    const item =
      menu.selectedItem ||
      menu.selectedItems?.[0] ||
      menu.querySelector("[selected]") ||
      [...menu.querySelectorAll("sp-menu-item")].find(
        (item) => item.value === menu.value,
      );
    if (!item) return;
    if (item.dataset.tool) editor.toolSet(item.dataset.tool);
    else if (
      item.dataset.editorCommand &&
      typeof editor[item.dataset.editorCommand] === "function"
    )
      editor[item.dataset.editorCommand]();
    else if (item.dataset.uxCommand) editor.runCommand(item.dataset.uxCommand);
    else if (item.hasAttribute("data-workspace-reset"))
      editor.workspace.reset();
    else if (item.dataset.workspaceShow) {
      const id = item.dataset.workspaceShow;
      if (id === "color") editor.showColorPalette();
      else if (id === "fabric") editor.showFabricPalette();
      else if (id === "history") editor.renderHistory();
      else if (id === "construction") editor.renderConstructionPalette(true);
      editor.workspace.show(id);
    } else if (item.hasAttribute("data-toolbar-side")) {
      const tools = document.querySelector("#tools");
      tools.style.order = tools.style.order === "5" ? "0" : "5";
      try {
        localStorage.setItem("siluetra-toolbar-side", tools.style.order);
      } catch {}
    }
  });
  details.replaceWith(menu);
}
export function installSpectrumBridge(editor) {
  if (!globalThis.document?.body || !globalThis.MutationObserver)
    return { dispose() {} };
  const root = document.querySelector("#siluetra-theme");
  let queued = false;
  const upgrade = () => {
    queued = false;
    for (const old of root.querySelectorAll(
      "div.app-action-group,div.view-tabs",
    )) {
      const group = document.createElement(
        old.classList.contains("view-tabs") ? "sp-tabs" : "sp-action-group",
      );
      group.className = old.className;
      group.setAttribute("size", "s");
      while (old.firstChild) group.appendChild(old.firstChild);
      old.replaceWith(group);
    }
    for (const tabs of root.querySelectorAll("sp-tabs.view-tabs")) {
      for (const button of tabs.querySelectorAll("button")) {
        const tab = replaceControl(button);
        tab.value = tab.dataset.view;
      }
      const active = tabs.querySelector("[data-view].active");
      if (active) tabs.selected = active.dataset.view;
    }
    for (const el of root.querySelectorAll("sp-action-button[aria-pressed]"))
      el.selected = el.getAttribute("aria-pressed") === "true";
    for (const detail of root.querySelectorAll(
      "details.ux-menu,details.workspace-menu,details.tool-flyout",
    ))
      replaceMenu(detail, editor);
    for (const node of root.querySelectorAll("button,input,select")) {
      if (
        node.closest(".dv-tabs-and-actions-container,.dv-resize-container") ||
        node.closest("[data-spectrum-skip]")
      )
        continue;
      replaceControl(node);
    }
    for (const host of root.querySelectorAll("#context,#project-menu"))
      if (host.children.length && !host.querySelector(":scope > sp-menu")) {
        const menu = document.createElement("sp-menu");
        while (host.firstChild) menu.appendChild(host.firstChild);
        host.appendChild(menu);
      }
    const dialog = root.querySelector("#modal");
    if (dialog.children.length && !dialog.querySelector(":scope > sp-dialog")) {
      const body = document.createElement("sp-dialog");
      body.setAttribute("size", "m");
      body.setAttribute("no-divider", "");
      dialog.querySelector(".modal-header")?.setAttribute("slot", "heading");
      dialog.querySelector(".modal-footer")?.setAttribute("slot", "button");
      while (dialog.firstChild) body.appendChild(dialog.firstChild);
      dialog.appendChild(body);
    }
    for (const button of root.querySelectorAll(
      "sp-action-button[title],sp-button[title]",
    ))
      {
        let tip = button.querySelector(":scope > sp-tooltip");
        if (!tip) {
          tip = document.createElement("sp-tooltip");
          tip.setAttribute("self-managed", "");
          tip.triggerElement = button;
          tip.setAttribute("placement", button.closest("#tools") ? "right" : "bottom");
          button.appendChild(tip);
        }
        if (tip.textContent !== button.title) tip.textContent = button.title;
        button.removeAttribute("title");
      }
  };
  const observer = new MutationObserver((records) => {
    if (
      records.every(
        (r) =>
          r.type === "attributes" &&
          r.attributeName === "class" &&
          !r.target.hasAttribute("data-view"),
      )
    )
      return;
    if (!queued) {
      queued = true;
      queueMicrotask(upgrade);
    }
  });
  upgrade();
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-pressed", "class"],
  });
  return {
    dispose() {
      observer.disconnect();
    },
  };
}
