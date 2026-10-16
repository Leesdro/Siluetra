import { uiIcon } from "./ui-icons.js";
import { panelShare, MIN_PANEL_SIZE } from "./editor/graphite-ui.js";
export const defaultLayout = {
  library: { dock: "left", width: 260, visible: true },
  inspector: { dock: "right", width: 280, visible: true },
  history: { dock: "float", x: 380, y: 140, width: 280, visible: false },
  color: { dock: "float", x: 440, y: 150, width: 280, visible: false },
  construction: { dock: "float", x: 720, y: 150, width: 300, visible: false },
  fabric: { dock: "float", x: 460, y: 180, width: 300, visible: false },
};
// Kept for conservative migration of pre-Dockview floating rectangles.
export function safePanelRect(s, w, h) {
  const width = Math.max(230, Math.min(520, w - 16, s.width || 280)),
    y = Math.max(56, Math.min(h - 152, s.y ?? 100)),
    height = Math.max(140, Math.min(h - y - 12, s.height || 560));
  return {
    ...s,
    width,
    height,
    x: Math.max(8, Math.min(w - width - 8, s.x ?? 100)),
    y,
  };
}
export const WORKSPACE_KEY = "siluetra-dockview-v2";
const labels = {
  canvas: "Documento",
  library: "Capas",
  resources: "Recursos",
  inspector: "Inspector",
  appearance: "Apariencia",
  history: "Historial",
  construction: "Construcción",
  fabric: "Textura de tela",
};
export function readWorkspacePreferences(storage) {
  let legacy = {},
    saved = null;
  try {
    legacy = JSON.parse(storage?.getItem("siluetra-workspace-v1") || "{}");
  } catch {}
  try {
    saved = JSON.parse(storage?.getItem(WORKSPACE_KEY) || "null");
    if (saved?.version !== 2) saved = null;
  } catch {}
  return { legacy, saved };
}
export class WorkspaceDockManager {
  constructor(
    root,
    panels,
    {
      createDockview = globalThis.SiluetraDesktopDependencies?.createDockview,
      storage = globalThis.localStorage,
      observe = globalThis.MutationObserver,
    } = {},
  ) {
    this.root = root;
    this.panels = panels;
    this.storage = storage;
    this.subscriptions = [];
    this.observers = [];
    this.restoring = false;
    const { legacy, saved } = readWorkspacePreferences(storage);
    this.layout = Object.fromEntries(
      Object.entries(defaultLayout).map(([id, s]) => [
        id,
        { ...s, ...legacy[id] },
      ]),
    );
    for (const id of ["resources", "appearance"])
      this.layout[id] = { visible: true };
    // Command tests have no HTMLElement surface. There is no alternate browser docking implementation.
    if (!root?.appendChild) return;
    if (!createDockview) throw Error("Dockview no está disponible.");
    this.parking = document.createElement("div");
    this.parking.hidden = true;
    root.appendChild(this.parking);
    this.host = document.createElement("div");
    this.host.id = "desktop-dockview";
    root.appendChild(this.host);
    this.api = createDockview(this.host, {
      createComponent: ({ name }) => {
        const element = document.createElement("div");
        element.className = "desktop-pane";
        const host = this.panels[name];
        if (!host) throw Error("Panel desconocido: " + name);
        element.appendChild(host);
        host.classList.remove("hidden");
        host.style.cssText = "";
        return {
          element,
          init() {},
          dispose: () => this.parking.appendChild(host),
        };
      },
      theme: { name: "siluetra", className: "dockview-theme-siluetra", gap: 1 },
      defaultRenderer: "always",
      createRightHeaderActionComponent: (group) => {
        const element = document.createElement("sp-action-button");
        element.setAttribute("quiet", "");
        element.setAttribute("size", "s");
        element.setAttribute("aria-label", "Maximizar o restaurar panel");
        element.title = "Maximizar / restaurar";
        element.innerHTML = uiIcon("fit");
        element.onclick = () => {
          if (this.api.hasMaximizedGroup()) this.api.exitMaximizedGroup();
          else if (group.activePanel) this.api.maximizeGroup(group.activePanel);
        };
        return {
          element,
          init() {},
          dispose() {
            element.onclick = null;
          },
        };
      },
      disableFloatingGroups: false,
      floatingGroupBounds: "boundedWithinViewport",
    });
    this.restoring = true;
    try {
      if (saved?.dockview) {
        const { width, height } = saved.dockview.grid || {};
        if (width > 0 && height > 0) this.api.layout(width, height);
        this.api.fromJSON(saved.dockview);
        if (!this.api.getPanel("canvas")) throw Error("Missing document pane");
        for (const p of this.api.panels)
          if (!labels[p.id]) throw Error("Unknown saved pane");
      } else this.defaults(legacy);
    } catch {
      this.api.clear();
      this.defaults(legacy);
    }
    this.restoring = false;
    this.subscriptions.push(
      this.api.onDidLayoutChange(() => this.save()),
      this.api.onDidRemovePanel((p) => {
        if (this.layout[p.id]) this.layout[p.id].visible = false;
        this.panels[p.id]?.classList.add("hidden");
        if (p.id === "canvas" && !this.restoring)
          queueMicrotask(() => this.show("canvas"));
        this.save();
      }),
    );
    for (const [id, host] of Object.entries(panels)) {
      if (id === "canvas" || id === "color") continue;
      const sync = () => {
        const shown = !host.classList.contains("hidden");
        if (shown !== !!this.api.getPanel(id)) this.show(id, shown);
      };
      if (observe) {
        const o = new observe(sync);
        o.observe(host, { attributes: true, attributeFilter: ["class"] });
        this.observers.push(o);
      }
    }
    this.resize = () => {
      const r = this.host.getBoundingClientRect();
      if (r.width && r.height) this.api.layout(r.width, r.height);
    };
    if (globalThis.ResizeObserver) {
      this.ro = new ResizeObserver(this.resize);
      this.ro.observe(this.host);
    }
    this.resize();
    this.save();
  }
  defaults(legacy = {}) {
    const canvas = this.api.addPanel({
      id: "canvas",
      component: "canvas",
      title: labels.canvas,
      minimumWidth: 260,
      minimumHeight: 160,
    });
    const width = Math.max(
      240,
      Math.min(330, (globalThis.innerWidth || 1366) * panelShare(false, true)),
    );
    const inspector = this.api.addPanel({
      id: "inspector",
      component: "inspector",
      title: labels.inspector,
      position: { referencePanel: canvas, direction: "right" },
      minimumWidth: MIN_PANEL_SIZE,
      initialWidth: legacy.inspector?.width || width,
    });
    this.api.addPanel({
      id: "appearance",
      component: "appearance",
      title: labels.appearance,
      position: { referencePanel: inspector, direction: "within" },
    });
    const layers = this.api.addPanel({
      id: "library",
      component: "library",
      title: labels.library,
      position: { referencePanel: legacy.library?.dock === "left" ? canvas : inspector, direction: legacy.library?.dock === "left" ? "left" : "below" },
      minimumWidth: MIN_PANEL_SIZE,
      initialHeight: 280,
    });
    this.api.addPanel({
      id: "resources",
      component: "resources",
      title: labels.resources,
      position: { referencePanel: layers, direction: "within" },
    });
    inspector.api.setActive();
    layers.api.setActive();
    for (const id of ["history", "construction", "fabric"])
      if (legacy[id]?.visible) this.show(id);
    for (const [id, s] of Object.entries(legacy)) {
      const panel = this.api.getPanel(id);
      if (!panel || id === "color") continue;
      if (s.visible === false) {
        this.show(id, false);
        if (id === "library") this.show("resources", false);
        continue;
      }
      if (s.dock === "float") {
        const rect = safePanelRect(
          s,
          globalThis.innerWidth || 1366,
          globalThis.innerHeight || 768,
        );
        this.api.addFloatingGroup(panel.group || panel, {
          x: rect.x,
          y: Math.max(0, rect.y - 76),
          width: rect.width,
          height: rect.height,
        });
      }
    }
  }
  show(id, visible = true) {
    if (!this.panels[id]) return;
    if (this.layout[id]) this.layout[id].visible = visible;
    const host = this.panels[id];
    if (id === "color") {
      host.classList.toggle("hidden", !visible);
      return;
    }
    if (!this.api) {
      host.classList.toggle("hidden", !visible);
      return;
    }
    let panel = this.api.getPanel(id);
    if (visible) {
      host.classList.remove("hidden");
      if (!panel)
        panel = this.api.addPanel({
          id,
          component: id,
          title: labels[id],
          position: {
            referencePanel:
              this.api.getPanel("inspector") || this.api.getPanel("canvas"),
            direction: "within",
          },
          minimumWidth: MIN_PANEL_SIZE,
        });
      panel.api.setActive();
    } else if (panel) {
      this.api.removePanel(panel);
      host.classList.add("hidden");
    }
    this.save();
  }
  reset() {
    if (!this.api) return;
    this.restoring = true;
    this.api.clear();
    this.layout = structuredClone(defaultLayout);
    this.layout.resources = { visible: true };
    this.layout.appearance = { visible: true };
    this.defaults();
    this.restoring = false;
    this.save();
  }
  save() {
    if (this.restoring) return;
    if (this.api) document.querySelector("#history-button")?.setAttribute("aria-expanded", String(!!this.api.getPanel("history")));
    // The launcher hides the shell. Never overwrite persisted proportions with a zero-size layout.
    if (this.host && !this.host.getBoundingClientRect().width) return;
    for (const id of Object.keys(this.layout))
      if (id !== "color" && this.api)
        this.layout[id].visible = !!this.api.getPanel(id);
    try {
      if (this.api)
        this.storage?.setItem(
          WORKSPACE_KEY,
          JSON.stringify({ version: 2, dockview: this.api.toJSON() }),
        );
    } catch {}
  }
  dispose() {
    this.ro?.disconnect();
    for (const o of this.observers) o.disconnect();
    for (const s of this.subscriptions) s.dispose();
    this.api?.dispose();
    this.host?.remove();
    this.parking?.remove();
  }
}
