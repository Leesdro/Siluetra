import { toolCursor } from "../ux-tools.js";
import { interactions } from "../interaction-router.js";
import { LayerPanel } from "../layer-panel.js";
import { createFolder, flattenLayers, layerTree } from "../layers.js";
import { PreviewTransaction } from "../preview-transaction.js";
import { WorkspaceDockManager } from "../workspace.js";
import { assignFabric, fabricEligible } from "../fabric.js";
import { colorValue, fromRgb } from "../color.js";
import { brandMark } from "../launcher.js";
import { uiIcon } from "../ui-icons.js";
import { attachLearningCards } from "../tool-learning.js";
import { resolveRef } from "../construction-system.js";
import { reconcile, visible, locked, reparent } from "../model.js";
import { hitCandidates, constructionHits } from "../hit.js";
import { settings, updateSettings, favorite } from "../preferences.js";
import { newProject } from "../templates.js";
import { geometryMirror } from "../symmetry.js";
import { $, $$ } from "./ui.js";

// Bind in the original order; wrapped handlers and preview services depend on it.
export function bindEditorUI(runtime, editor) {
  bindDocumentAndCanvas(runtime, editor);
  bindContextControls(runtime, editor);
  bindInspectorAndHistory(runtime, editor);
  bindPanelControls(runtime, editor);
  bindPaletteAndWorkspace(runtime, editor);
  bindToolMenus(runtime, editor);
}

function bindDocumentAndCanvas(runtime, editor) {
  editor.renderToolbar();
  $$("[data-icon]").forEach(
    (el) =>
      (el.innerHTML =
        uiIcon(el.dataset.icon) +
        (el.dataset.label ? `<span>${el.dataset.label}</span>` : "")),
  );
  if (!globalThis.SiluetraDesktopDependencies) attachLearningCards(document, $("#tool-learning-card"));
  $$("[data-brand-mark]").forEach((el) => (el.innerHTML = brandMark()));
  $("#templates").onclick = (e) => {
    const b = e.target.closest("[data-new]");
    if (b) {
      const p = newProject(b.dataset.new);
      p.liveMirror = settings.mirrorDefault;
      editor.open(p);
    }
  };
  $("#recents").onclick = (e) => {
    const menu = e.target.closest("[data-project-menu]"),
      openButton = e.target.closest("[data-open]");
    if (menu) {
      editor.showProjectMenu(menu.dataset.projectMenu, e);
      return;
    }
    if (openButton) {
      editor.recentAction("open", openButton.dataset.open);
      return;
    }
    if (e.target.closest("[data-launch-new]")) editor.newDocument();
  };
  $("#recents").oncontextmenu = (e) => {
    const row = e.target.closest("[data-recent-id]");
    if (row) {
      e.preventDefault();
      editor.showProjectMenu(row.dataset.recentId, e);
    }
  };
  $("#project-menu").onclick = (e) => {
    const b = e.target.closest("[data-recent-action]");
    if (b) {
      const id = runtime.launcher.recentMenuId;
      editor.closeProjectMenu();
      editor.recentAction(b.dataset.recentAction, id);
    }
  };
  $("#project-menu").onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      editor.closeProjectMenu();
    }
    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const buttons = [
          ...$("#project-menu").querySelectorAll(
            ":is(button:not([disabled]),sp-button:not([disabled]),sp-action-button:not([disabled]),sp-menu-item:not([disabled]))",
          ),
        ],
        i = buttons.indexOf(document.activeElement);
      buttons[
        (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
      ]?.focus();
    }
  };
  document.addEventListener("pointerdown", (e) => {
    if (
      !e.target.closest("#project-menu") &&
      !e.target.closest("[data-project-menu]")
    )
      editor.closeProjectMenu();
  });
  $("#new-document").onclick = $("#new-document-nav").onclick =
    editor.newDocument;
  $("#open-native-nav").onclick = () => $("#project-input").click();
  $("#recent-grid").onclick = () => {
    $("#recents").classList.remove("list-view");
    $("#recent-grid").classList.add("active");
    $("#recent-list").classList.remove("active");
  };
  $("#recent-list").onclick = () => {
    $("#recents").classList.add("list-view");
    $("#recent-list").classList.add("active");
    $("#recent-grid").classList.remove("active");
  };
  $("#home").onclick = editor.showStart;
  $("#open-native").onclick = () => $("#project-input").click();
  $("#project-input").onchange = (e) => {
    editor.nativeImport(e.target.files[0]);
    e.target.value = "";
  };
  $("#project-name").onchange = (e) =>
    editor.commit(
      () => (runtime.document.project.name = e.target.value || "Sin título"),
    );
  $$("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        if (runtime.document.view === b.dataset.view) return;
        editor.cancelAction();
        runtime.document.view = b.dataset.view;
        runtime.selection.selected = [];
        runtime.selection.nodeIndex = -1;
        runtime.selection.nodeIndices = [];
        runtime.selection.editingGroup = null;
        runtime.selection.isolation = [];
        editor.render();
      }),
  );
  $$("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        runtime.library.tab = b.dataset.tab;
        editor.library();
      }),
  );
  $("#tools").onclick = (e) => {
    const color = e.target.closest("[data-color-open]");
    if (color) editor.showColorPalette(color.dataset.colorOpen);
    const b = e.target.closest("[data-tool]");
    if (b) editor.toolSet(b.dataset.tool);
    if (e.target.closest("#mirror-tool")) editor.mirror(true);
    if (e.target.closest("#command-tool")) editor.commandPalette();
  };
  $("#library-content").onclick = (e) => {
    const find = (key) => e.target.closest(`[data-${key}]`),
      favoriteButton = find("favorite");
    if (favoriteButton) {
      favorite(favoriteButton.dataset.favorite);
      editor.library();
      return;
    }
    const categoryLock = find("category-lock"),
      categoryHide = find("category-hide");
    if (categoryLock || categoryHide) {
      const cat = (categoryLock || categoryHide).dataset[
          categoryLock ? "categoryLock" : "categoryHide"
        ],
        key = categoryLock ? "locked" : "hidden";
      editor.commit(() => {
        runtime.document.project.categoryState[cat] ??= {};
        runtime.document.project.categoryState[cat][key] =
          !runtime.document.project.categoryState[cat][key];
        runtime.selection.selected = runtime.selection.selected.filter((id) => {
          const o = editor.objects().find((o) => o.id === id);
          return (
            visible(runtime.document.project, runtime.document.view, o) &&
            !locked(runtime.document.project, runtime.document.view, o)
          );
        });
      });
      return;
    }
    const groupLock = find("group-lock"),
      groupHide = find("group-hide");
    if (groupLock || groupHide) {
      e.preventDefault();
      const g = runtime.document.project.groups[runtime.document.view].find(
          (g) =>
            g.id ===
            (groupLock || groupHide).dataset[
              groupLock ? "groupLock" : "groupHide"
            ],
        ),
        key = groupLock ? "locked" : "hidden";
      editor.commit(() => (g[key] = !g[key]));
      return;
    }
    const r = find("resource"),
      replace = find("replace"),
      h = find("hide"),
      l = find("lock"),
      row = find("object");
    if (r) {
      if (
        ["stitch", "double"].includes(r.dataset.resource) &&
        editor.one()?.type === "path"
      )
        editor.construction("stitch", r.dataset.resource === "double" ? 2 : 1);
      else editor.addResource(r.dataset.resource);
    }
    if (replace) {
      editor.save(false);
      const p = newProject(replace.dataset.replace);
      p.liveMirror = settings.mirrorDefault;
      editor.open(p);
    }
    if (h || l) {
      const o = editor
          .objects()
          .find((o) => o.id === (h || l).dataset[h ? "hide" : "lock"]),
        key = h ? "hidden" : "locked";
      editor.commit(() => {
        o[key] = !o[key];
        if (o[key])
          runtime.selection.selected = runtime.selection.selected.filter(
            (id) => id !== o.id,
          );
      });
    } else if (row) editor.selectTreeObject(row.dataset.object, e);
    else {
      const group = e.target.closest("[data-group]");
      if (
        group &&
        !e.target.closest(":is(button,sp-button,sp-action-button,sp-menu-item)")
      ) {
        e.preventDefault();
        editor.selectTreeGroup(group.dataset.group, e);
      }
    }
  };
  $("#library-content").ondblclick = (e) => {
    const n = e.target.closest("[data-name]");
    if (n) {
      editor.renameObject(n.dataset.name);
      return;
    }
    const group = e.target.closest("[data-group]");
    if (group) {
      editor.selectTreeGroup(group.dataset.group, {});
      editor.action("isolate");
    }
  };
  $("#library-content").oninput = (e) => {
    if (e.target.id === "resource-search") {
      runtime.library.resourceSearch = e.target.value;
      const pos = e.target.selectionStart;
      editor.library();
      const input = $("#resource-search");
      input.focus();
      input.setSelectionRange?.(pos, pos);
    }
  };
  $("#library-content").addEventListener(
    "toggle",
    (e) => {
      const cat = e.target.dataset.resourceSection;
      if (cat) {
        if (e.target.open) runtime.library.resourceSections.add(cat);
        else runtime.library.resourceSections.delete(cat);
      }
    },
    true,
  );
  $("#library-content").oncontextmenu = (e) => {
    const row = e.target.closest("[data-object]");
    if (row) editor.context(e, row.dataset.object);
    else {
      const group = e.target.closest("[data-group]");
      if (group) {
        e.preventDefault();
        editor.selectTreeGroup(group.dataset.group, {});
        const id = runtime.selection.selected[0];
        if (id) editor.context(e, id);
      }
    }
  };
  $("#library-content").ondragstart = (e) => {
    const r = e.target.closest("[data-resource]"),
      o = e.target.closest("[data-object]"),
      g = e.target.closest("[data-group]");
    if (r) {
      e.dataTransfer.setData(
        "application/atelier-resource",
        r.dataset.resource,
      );
      e.dataTransfer.setDragImage?.(r, Math.min(r.offsetWidth / 2, 50), 25);
    } else if (o || g)
      e.dataTransfer.setData(
        "application/atelier-object",
        (o || g).dataset[o ? "object" : "group"],
      );
    e.dataTransfer.effectAllowed = "copyMove";
  };
  $("#library-content").ondragover = (e) => e.preventDefault();
  $("#library-content").ondrop = (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("application/atelier-object"),
      target = e.target.closest("[data-object]"),
      group = e.target.closest("[data-group]"),
      cat = e.target.closest("[data-category]");
    if (!id) return;
    editor.commit(() => {
      if (target && target.dataset.object !== id) {
        const list = editor.objects(),
          i = list.findIndex((o) => o.id === id),
          dest = list.find((o) => o.id === target.dataset.object);
        if (i >= 0) {
          reparent(
            runtime.document.project,
            runtime.document.view,
            id,
            dest.group,
          );
          const [o] = list.splice(i, 1),
            j = list.findIndex((o) => o.id === dest.id);
          list.splice(j + 1, 0, o);
          o.category = dest.category;
        }
      } else if (group)
        reparent(
          runtime.document.project,
          runtime.document.view,
          id,
          group.dataset.group,
        );
      else if (cat) {
        reparent(runtime.document.project, runtime.document.view, id, null);
        const o =
          editor.objects().find((o) => o.id === id) ||
          runtime.document.project.groups[runtime.document.view].find(
            (g) => g.id === id,
          );
        if (o) o.category = cat.dataset.category;
      }
    });
  };
  $("#canvas").addEventListener("dragover", (e) => {
    e.preventDefault();
    $("#canvas-wrap").classList.add("canvas-drop-target");
  });
  $("#canvas").addEventListener("dragleave", () =>
    $("#canvas-wrap").classList.remove("canvas-drop-target"),
  );
  $("#canvas").addEventListener("drop", (e) => {
    e.preventDefault();
    $("#canvas-wrap").classList.remove("canvas-drop-target");
    const r = e.dataTransfer.getData("application/atelier-resource");
    if (r) editor.addResource(r, editor.world(e));
    else if (e.dataTransfer.files[0])
      editor.importImage(e.dataTransfer.files[0]);
  });
  $("#properties").onchange = (e) => {
    if (e.target.dataset.mod) {
      editor.setModifier(
        e.target.dataset.mod,
        e.target.dataset.param,
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.type === "number"
            ? Number(e.target.value)
            : e.target.value,
      );
      return;
    }
    const k = e.target.dataset.prop;
    if (k)
      editor.setProperty(
        k,
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
        e.target.checked,
      );
  };
  $("#properties").onclick = (e) => {
    const b = e.target.closest("[data-action]");
    if (b) editor.action(b.dataset.action);
  };
  $("#context").onclick = (e) => {
    const b = e.target.closest("[data-action]");
    if (b) {
      editor.closeContext();
      editor.action(b.dataset.action);
    }
  };
  $("#canvas").addEventListener("contextmenu", (e) =>
    editor.context(
      e,
      hitCandidates(
        runtime.document.project,
        runtime.document.view,
        editor.world(e),
        runtime.canvas.camera.z,
        runtime.selection.isolation.at(-1),
      )[0],
    ),
  );
  $("#canvas").addEventListener("pointerdown", editor.pointerDown);
  $("#canvas").addEventListener("pointermove", editor.pointerMove);
  $("#canvas").addEventListener("pointerup", editor.pointerUp);
  $("#canvas").addEventListener("pointercancel", () => {
    editor.cancelAction();
    editor.render();
  });
  $("#canvas").addEventListener("dblclick", (e) => {
    if (e.target.closest("[data-node]")) return;
    const construction = constructionHits(
      runtime.document.project,
      runtime.document.view,
      editor.world(e),
      runtime.canvas.camera.z,
      runtime.selection.isolation.at(-1),
    )[0];
    if (runtime.interaction.tool !== "node" && construction) {
      editor.selectId(construction.ownerId, false, true);
      runtime.selection.constructionContexts = construction.modifierId
        ? [
            {
              ownerId: construction.ownerId,
              modifierId: construction.modifierId,
            },
          ]
        : [];
      runtime.selection.modifierContext = construction.modifierId;
      editor.renderConstructionPalette(true);
      editor.drawSelection();
      return;
    }
    if (runtime.interaction.tool === "node") {
      editor.addNodeAt(e);
      return;
    }
    const id = hitCandidates(
        runtime.document.project,
        runtime.document.view,
        editor.world(e),
        runtime.canvas.camera.z,
        runtime.selection.isolation.at(-1),
      )[0],
      o = editor.objects().find((o) => o.id === id);
    if (!o) return;
    const scope =
      o.group && runtime.selection.isolation.at(-1) !== o.group
        ? o.group
        : o.source || o.id;
    if (runtime.selection.isolation.at(-1) !== scope)
      runtime.selection.isolation.push(scope);
    runtime.selection.editingGroup = o.group || null;
    editor.selectId(o.source || o.id, false, true);
    if (scope !== o.group) editor.toolSet("node");
    editor.render();
    editor.toast("Aislado · Escape para salir");
  });
  $("#canvas").addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.shiftKey && !e.ctrlKey) {
        runtime.canvas.camera.x -= e.deltaY;
        editor.cameraRender();
      } else
        editor.zoom(Math.exp(-e.deltaY * 0.0015), {
          x: e.clientX,
          y: e.clientY,
        });
    },
    { passive: false },
  );
  $("#undo").onclick = editor.undo;
  $("#redo").onclick = editor.redo;
  $("#save").onclick = () => editor.save();
  $("#export").onclick = editor.exportDialog;
  $("#help").onclick = editor.help;
  $("#image-input").onchange = (e) => {
    editor.importImage(e.target.files[0]);
    e.target.value = "";
  };
  $("#live-mirror").onclick = () =>
    editor.commit(() => {
      runtime.document.project.liveMirror =
        !runtime.document.project.liveMirror;
      if (runtime.document.project.liveMirror)
        for (const o of editor
          .objects()
          .filter((o) => o.role === "body" && !o.symmetry))
          geometryMirror(o, runtime.document.project.centerAxis ?? 350);
    });
  $("#axis-toggle").onclick = () =>
    editor.commit(
      () =>
        (runtime.document.project.showAxis =
          !runtime.document.project.showAxis),
    );
  $("#snap").onclick = () => {
    runtime.canvas.snap = !runtime.canvas.snap;
    $("#snap").classList.toggle("active", runtime.canvas.snap);
  };
  $("#grid-toggle").onclick = () => {
    runtime.canvas.grid = !runtime.canvas.grid;
    $("#grid-toggle").classList.toggle("active", runtime.canvas.grid);
    $("#gridrect").style.display = runtime.canvas.grid ? "" : "none";
  };
  $("#zoom-out").onclick = () => editor.zoom(1 / 1.2);
  $("#zoom-in").onclick = () => editor.zoom(1.2);
  $("#zoom").onclick = () => {
    const input = $("#zoom-edit");
    input.value = Math.round(runtime.canvas.camera.z * 100);
    $("#zoom").classList.add("hidden");
    input.classList.remove("hidden");
    input.focus();
    input.select();
  };
  $("#fit").onclick = editor.fit;
  document.addEventListener("keydown", editor.keyboard);
  document.addEventListener("keyup", (e) => {
    if (e.key === "Control" || e.key === "Meta")
      runtime.interaction.temporarySelect = false;
    if (e.key === " ") {
      runtime.interaction.space = false;
      $("#canvas").style.cursor =
        toolCursor[editor.activeTool()] || "crosshair";
    }
  });
  window.addEventListener("blur", () => {
    runtime.interaction.space = false;
    runtime.interaction.temporarySelect = false;
    interactions.cancel();
    if (runtime.interaction.drag) {
      editor.cancelAction();
      editor.render();
    }
    $("#tool-feedback").innerHTML = "";
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#context")) editor.closeContext();
  });
  window.addEventListener("beforeunload", (e) => {
    if (runtime.document.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && runtime.document.project && runtime.document.dirty)
      editor.save(false);
  });
  new ResizeObserver(() => {
    if (runtime.document.project && runtime.canvas.zoomInitialized) {
      editor.cameraRender();
      editor.drawSelection();
    }
  }).observe($("#canvas-wrap"));
  editor.renderRecents();
  $("#variants-popover").onclick = (e) => {
    if (e.target.closest("[data-close-variants]")) {
      editor.closeVariants();
      return;
    }
    const sw = e.target.closest("[data-switch-variant]"),
      op = e.target.closest("[data-variant-op]");
    if (sw) {
      editor.changeVariant("switch", sw.dataset.switchVariant);
      editor.closeVariants();
      return;
    }
    if (
      e.target.closest("[data-new-variant]") ||
      e.target.closest("[data-duplicate-current]")
    ) {
      editor.changeVariant("duplicate", editor.nextVariantName());
      return;
    }
    if (e.target.closest("[data-commit-variant-name]")) {
      editor.commitVariantName();
      return;
    }
    if (op) {
      const name = op.dataset.variantName;
      if (op.dataset.variantOp === "rename") {
        runtime.workspace.variantRename = name;
        editor.renderVariantPopover();
        $("#variant-inline-name").focus();
        $("#variant-inline-name").select();
      } else
        editor.changeVariant(
          op.dataset.variantOp,
          op.dataset.variantOp === "duplicate"
            ? editor.nextVariantName()
            : null,
          name,
        );
    }
  };
  $("#variants-popover").onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      editor.closeVariants();
      $("#variant-button").focus();
    }
    if (e.key === "Enter" && runtime.workspace.variantRename) {
      e.preventDefault();
      editor.commitVariantName();
    }
  };
  document.addEventListener("pointerdown", (e) => {
    if (
      !e.target.closest("#variants-popover") &&
      !e.target.closest("#variant-button")
    )
      editor.closeVariants();
  });
}

function bindContextControls(runtime, editor) {
  $("#settings").onclick = editor.settingsDialog;
  $("#variant-button").onclick = editor.variantDialog;
  $("#structure-state").onclick = () => {
    if (runtime.document.project)
      editor.commit(
        () =>
          (runtime.document.project.applyTo =
            runtime.document.project.applyTo === "both" ? "this" : "both"),
      );
  };
  $("#context-bar").onclick = (e) => {
    const b = e.target.closest("[data-action]");
    if (b) editor.action(b.dataset.action);
  };
  $("#context-bar").onchange = (e) => {
    if (e.target.dataset.prop)
      editor.setProperty(e.target.dataset.prop, Number(e.target.value));
    if (e.target.id === "pencil-smoothing") {
      updateSettings({ smoothing: Number(e.target.value) });
      editor.contextBar();
    }
  };
  editor.applyAppearance();
  globalThis
    .matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener?.("change", editor.applyAppearance);
}

function bindInspectorAndHistory(runtime, editor) {
  $("#properties").addEventListener(
    "toggle",
    (e) => {
      if (e.target.dataset.section)
        runtime.workspace.sectionFold.set(
          e.target.dataset.section,
          e.target.open,
        );
    },
    true,
  );
  $("#properties").oninput = (e) => {
    const key = e.target.dataset.liveProp;
    if (!key) return;
    runtime.appearance.appearanceGesture = true;
    const value = Number(e.target.value);
    for (const o of editor.chosen())
      if (key === "opacity") o.opacity = Math.max(0, Math.min(1, value / 100));
    editor.drawNow();
  };
  const previousPropertyChange = $("#properties").onchange;
  $("#properties").onchange = (e) => {
    if (e.target.dataset.liveProp) {
      if (runtime.appearance.appearanceGesture) {
        runtime.appearance.appearanceGesture = false;
        editor.finishMutation();
      }
      return;
    }
    previousPropertyChange(e);
  };
  $("#quick-theme").onclick = () => {
    const pop = $("#appearance-popover");
    if (!pop.classList.contains("hidden")) {
      editor.closeAppearance();
      return;
    }
    pop.innerHTML =
      '<div class="popover-title">Apariencia</div>' +
      [
        ["light", "Claro", "sun"],
        ["dark", "Oscuro", "moon"],
        ["system", "Sistema", "system"],
      ]
        .map(
          ([value, label, icon]) =>
            `<button role="menuitemradio" data-theme-choice="${value}" aria-checked="${settings.theme === value}">${uiIcon(icon)}<span>${label}</span>${settings.theme === value ? uiIcon("check") : ""}</button>`,
        )
        .join("");
    const r = $("#quick-theme").getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 196)) + "px";
    pop.style.top = r.bottom + 6 + "px";
    pop.classList.remove("hidden");
    $("#quick-theme").setAttribute("aria-expanded", "true");
    pop
      .querySelector(
        ":is(button:not([disabled]),sp-button:not([disabled]),sp-action-button:not([disabled]),sp-menu-item:not([disabled]))",
      )
      ?.focus();
  };
  $("#appearance-popover").onclick = (e) => {
    const b = e.target.closest("[data-theme-choice]");
    if (!b) return;
    updateSettings({ theme: b.dataset.themeChoice });
    editor.applyAppearance();
    editor.closeAppearance();
    $("#quick-theme").focus();
  };
  $("#appearance-popover").onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      editor.closeAppearance();
      $("#quick-theme").focus();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const buttons = [
          ...$("#appearance-popover").querySelectorAll(
            ":is(button:not([disabled]),sp-button:not([disabled]),sp-action-button:not([disabled]),sp-menu-item:not([disabled]))",
          ),
        ],
        i = buttons.indexOf(document.activeElement);
      buttons[
        (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
      ]?.focus();
    }
  };
  document.addEventListener("pointerdown", (e) => {
    if (
      !e.target.closest("#appearance-popover") &&
      !e.target.closest("#quick-theme")
    )
      editor.closeAppearance();
  });
  editor.closeVariants();
  $("#edge-confirm").classList.add("hidden");
  $("#construction-palette").onclick = (e) => {
    if (e.target.closest("[data-close-palette]")) {
      runtime.workspace.paletteClosedKey = runtime.workspace.paletteKey;
      $("#construction-palette").classList.add("hidden");
      return;
    }
    if (e.target.closest("[data-palette-delete]")) {
      editor.removeSelected();
      return;
    }
    if (e.target.closest("[data-palette-source]")) {
      const ref = editor.activeConstructionRefs()[0],
        { owner } = resolveRef(editor.objects(), ref);
      if (owner) {
        editor.selectId(owner.source || owner.id, false, true);
        editor.toolSet("node");
        editor.renderConstructionPalette();
      }
    }
  };
  $("#history-button").onclick = editor.toggleHistory;
  $("#history-palette").onclick = (e) => {
    if (e.target.closest("[data-close-history]")) {
      $("#history-palette").classList.add("hidden");
      $("#history-button").setAttribute("aria-expanded", "false");
      return;
    }
    const b = e.target.closest("[data-history-index]");
    if (b) {
      editor.cancelAction();
      const p = runtime.document.history.restore(
        Number(b.dataset.historyIndex),
      );
      if (p) {
        runtime.document.project = p;
        runtime.selection.selected = runtime.selection.selected.filter((id) =>
          editor.objects().some((o) => o.id === id),
        );
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
        runtime.selection.edgeIds = [];
        runtime.selection.rangeSelections = {};
        runtime.selection.nodeIndex = -1;
        runtime.selection.nodeIndices = [];
        editor.markDirty();
        editor.render();
      }
    }
  };
  $("#zoom-edit").onblur = () => editor.finishZoom();
  $("#zoom-edit").onkeydown = (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      editor.finishZoom(e.key === "Enter");
      $("#zoom").focus();
    }
  };
  editor.closeAppearance();
  editor.closeProjectMenu();
}

function bindPanelControls(runtime, editor) {
  $("#panel-preview").onclick = (e) => {
    if (e.target.closest("[data-select-panel-edges]")) {
      editor.beginPanelEdges(runtime.panels.panelPreview?.baseId);
      return;
    }
    if (runtime.panels.panelEdgeState) {
      if (e.target.closest("[data-create-edge-panel]"))
        editor.confirmEdgePanel();
      if (e.target.closest("[data-clear-panel-edges]"))
        editor.clearPanelEdges();
      if (e.target.closest("[data-cancel-panels]")) {
        editor.cancelPanelEdges();
        editor.render();
      }
      return;
    }
    if (e.target.closest("[data-extend-panels]"))
      editor.beginPanelPreview(runtime.panels.panelPreview.baseId, {
        extend: true,
      });
    if (e.target.closest("[data-confirm-panels]")) editor.confirmPanels();
    if (e.target.closest("[data-cancel-panels]")) {
      runtime.panels.panelPreview = null;
      $("#panel-preview").classList.add("hidden");
      $("#draft").innerHTML = "";
    }
  };
  $("#panel-preview").onchange = (e) => {
    if (
      runtime.panels.panelEdgeState &&
      e.target.matches?.("[data-auto-panel-outline]")
    ) {
      runtime.panels.panelEdgeState.selection.autoComplete = e.target.checked;
      runtime.panels.panelEdgeState.selection.evaluate();
      editor.renderPanelEdges();
      return;
    }
    if (e.target.id === "panel-target")
      editor.beginPanelPreview(e.target.value);
  };
  $("#color-palette").onclick = (e) => {
    const b = e.target.closest("[data-color]"),
      target = e.target.closest("[data-color-target]");
    if (b) editor.setActiveColor(b.dataset.color);
    if (target) editor.showColorPalette(target.dataset.colorTarget);
    if (e.target.closest("[data-color-close]"))
      runtime.services.workspace.show("color", false);
    if (e.target.closest("[data-apply-color]"))
      editor.applyColor(
        runtime.document.project.colors[runtime.document.project.colors.target],
      );
    if (e.target.closest("[data-add-swatch]")) {
      editor.commit(() => {
        const v =
          runtime.document.project.colors[
            runtime.document.project.colors.target
          ];
        if (
          v !== "none" &&
          !runtime.document.project.colors.swatches.includes(v)
        )
          runtime.document.project.colors.swatches.push(v);
      }, "Agregar muestra de color");
      editor.showColorPalette();
    }
  };
  runtime.services.preview = new PreviewTransaction({
    get: () => runtime.document.project,
    set: (p) => {
      runtime.document.project = p;
    },
    resolve: (p, b) => reconcile(p, b, runtime.document.view),
    draw: () => {
      $("#art").innerHTML = editor.renderArt(editor.objects());
      editor.drawSelection();
      editor.updateArtboard();
      editor.syncPaintUI();
    },
    commit: (label) => editor.finishMutation(label),
  });
}

function bindPaletteAndWorkspace(runtime, editor) {
  $("#fabric-palette").classList.add("hidden");
  runtime.services.layers = new LayerPanel($("#library-content"), {
    state: () => ({
      p: runtime.document.project,
      view: runtime.document.view,
      selected: runtime.selection.selected,
    }),
    commit: editor.commit,
    editConstruction: (id) => {
      editor.selectId(id, false, true);
      editor.renderConstructionPalette(true);
    },
    groupSelected: (id) => runtime.selection.selectedGroup === id,
    effectSelected: (r) =>
      r.kind === "modifier"
        ? runtime.selection.modifierContext === r.id
        : false,
    rename: (id, name) =>
      editor.commit(() => {
        const o =
          editor.objects().find((o) => o.id === id) ||
          runtime.document.project.groups[runtime.document.view].find(
            (g) => g.id === id,
          );
        if (o) o.name = name;
      }, "Renombrar capa"),
    selectEffect: (id) => {
      const rows = flattenLayers(
          layerTree(runtime.document.project, runtime.document.view),
        ),
        r = rows.find((r) => r.id === id);
      if (!r) return;
      if (r.kind === "fabric") {
        editor.selectId(r.parent, false, true);
        editor.showFabricPalette();
      } else {
        runtime.selection.selected = [r.parent];
        runtime.selection.modifierContext = r.id;
        runtime.selection.constructionContexts = [
          { ownerId: r.parent, modifierId: r.id },
        ];
        editor.selectionUI();
        editor.renderConstructionPalette(true);
      }
    },
    toggleEffect: (id, lock) => {
      const r = flattenLayers(
        layerTree(runtime.document.project, runtime.document.view),
      ).find((r) => r.id === id);
      if (!r) return;
      editor.commit(
        () => {
          const key = lock ? "locked" : "enabled";
          r.value[key] = lock ? !r.value.locked : r.value.enabled === false;
        },
        lock ? "Cambiar bloqueo del efecto" : "Cambiar visibilidad del efecto",
      );
    },
    removeEffect: (id) => {
      const r = flattenLayers(
        layerTree(runtime.document.project, runtime.document.view),
      ).find((r) => r.id === id);
      if (!r) return;
      editor.commit(() => {
        const o = editor.objects().find((o) => o.id === r.parent);
        if (r.kind === "fabric") delete o.fabricTexture;
        else o.modifiers = o.modifiers.filter((m) => m.id !== id);
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
      }, "Quitar efecto");
    },
    action: (a) => {
      if (a === "add") {
        runtime.library.tab = "resources";
        editor.library();
      }
      if (a === "folder") {
        let folder;
        editor.commit(() => {
          folder = createFolder(
            runtime.document.project,
            runtime.document.view,
          );
          runtime.selection.selected = [];
          runtime.selection.selectedGroup = folder.id;
        }, "Crear carpeta");
        runtime.library.tab = "objects";
        editor.library();
        const row = $("#library-content").querySelector(
          `[data-name="${folder.id}"]`,
        );
        if (row)
          row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      }
      if (a === "fx") editor.action("addModifier");
      if (a === "delete") {
        if (
          runtime.selection.selectedGroup &&
          !runtime.selection.selected.length
        ) {
          editor.commit(() => {
            runtime.document.project.groups[runtime.document.view] =
              runtime.document.project.groups[runtime.document.view].filter(
                (g) => g.id !== runtime.selection.selectedGroup,
              );
            runtime.selection.selectedGroup = null;
          }, "Eliminar carpeta");
        } else editor.removeSelected();
      }
    },
  });
  if (document.body) {
    const source = $("#library-content"),
      target = $("#resources-content");
    for (const key of [
      "onclick",
      "ondblclick",
      "oninput",
      "oncontextmenu",
      "ondragstart",
      "ondragover",
      "ondrop",
    ])
      target[key] = source[key];
    target.addEventListener(
      "toggle",
      (e) => {
        const cat = e.target.dataset.resourceSection;
        if (cat) {
          if (e.target.open) runtime.library.resourceSections.add(cat);
          else runtime.library.resourceSections.delete(cat);
        }
      },
      true,
    );
  }
  runtime.services.layers.bind();
  for (const b of $$("[data-tab]"))
    b.onclick = () => {
      runtime.services.layers.scroll[runtime.library.tab] = (
        runtime.library.tab === "objects"
          ? $("#library-content").querySelector(".layer-tree") ||
            $("#library-content")
          : $("#library-content")
      ).scrollTop;
      runtime.library.tab =
        b.dataset.tab === "resources" ? "resources" : "objects";
      editor.library();
      (runtime.library.tab === "objects"
        ? $("#library-content").querySelector(".layer-tree") ||
          $("#library-content")
        : $("#library-content")
      ).scrollTop = runtime.services.layers.scroll[runtime.library.tab] || 0;
    };
  runtime.services.workspace = new WorkspaceDockManager($(".workspace"), {
    library: $("#library-panel"),
    ...(document.body
      ? {
          canvas: $("#canvas-wrap"),
          resources: $("#resources-panel"),
          appearance: $("#appearance-panel"),
        }
      : {}),
    inspector: $("#inspector-panel"),
    history: $("#history-palette"),
    color: $("#color-palette"),
    construction: $("#construction-palette"),
    fabric: $("#fabric-palette"),
  });
  for (const b of $$("[data-workspace-show]"))
    b.onclick = () => {
      const id = b.dataset.workspaceShow;
      if (id === "color") editor.showColorPalette();
      if (id === "fabric") editor.showFabricPalette();
      if (id === "history") editor.renderHistory();
      if (id === "construction") {
        editor.renderConstructionPalette(true);
        if ($("#construction-palette").classList.contains("hidden")) {
          editor.toast("Seleccioná una construcción para editar.");
          return;
        }
      }
      runtime.services.workspace.show(id);
    };
  $("[data-workspace-reset]")?.addEventListener("click", () => {
    runtime.services.workspace.reset();
    $("#tools").style.order = "0";
    localStorage.setItem("siluetra-toolbar-side", "0");
  });
  $("[data-toolbar-side]")?.addEventListener("click", () => {
    const side = $("#tools").style.order === "5" ? "0" : "5";
    $("#tools").style.order = side;
    localStorage.setItem("siluetra-toolbar-side", side);
  });
  try {
    $("#tools").style.order =
      localStorage.getItem("siluetra-toolbar-side") || "0";
  } catch {}
  $("#fabric-palette").onclick = (e) => {
    const b = e.target.closest("[data-fabric-type]");
    if (b) {
      if (runtime.services.preview.active) runtime.services.preview.cancel();
      editor.setFabric(b.dataset.fabricType);
    }
    if (e.target.closest("[data-fabric-close]")) {
      runtime.services.preview.cancel();
      $("#fabric-palette").classList.add("hidden");
    }
  };
  $("#fabric-palette").onpointerdown = (e) => {
    if (e.target.dataset?.fabricParam && e.target.type === "range")
      runtime.services.preview.begin("Editar textura de tela");
  };
  $("#fabric-palette").oninput = (e) => {
    const key = e.target.dataset?.fabricParam;
    if (!key) return;
    const o = editor.chosen().find(fabricEligible);
    if (!o?.fabricTexture) return;
    const value = ["colorMode", "customColor"].includes(key)
      ? e.target.value
      : +e.target.value;
    if (!runtime.services.preview.active)
      runtime.services.preview.begin("Editar textura de tela");
    runtime.services.preview.update(() =>
      assignFabric(
        runtime.document.project,
        runtime.document.view,
        runtime.selection.selected,
        o.fabricTexture.type,
        { scope: runtime.appearance.fabricScope, [key]: value },
      ),
    );
    const out = e.target.parentElement?.querySelector("output");
    if (out) out.value = value + (key === "intensity" ? "%" : "");
  };
  $("#fabric-palette").onchange = (e) => {
    if (e.target.dataset?.fabricParam) {
      runtime.services.preview.finish();
      editor.showFabricPalette();
    }
    if (e.target.hasAttribute?.("data-fabric-scope"))
      runtime.appearance.fabricScope = e.target.value;
  };
  $("#fabric-palette").onpointercancel = () => {
    runtime.services.preview.cancel();
    editor.showFabricPalette();
  };
  $("#color-palette").oninput = (e) => {
    const t = e.target;
    let value;
    if (t.hasAttribute?.("data-color-hex")) value = colorValue(t.value);
    if (t.hasAttribute?.("data-color-rgb")) {
      const channels = [
        ...$("#color-palette").querySelectorAll("[data-color-rgb]"),
      ].map((e) => +e.value);
      if (channels.every((v) => Number.isFinite(v) && v >= 0 && v <= 255))
        value = fromRgb(...channels);
    }
    if (t.hasAttribute?.("data-color-opacity")) {
      if (!runtime.services.preview.active)
        runtime.services.preview.begin("Cambiar opacidad");
      runtime.services.preview.update(() => {
        runtime.document.project.colors.opacity = Math.max(
          0,
          Math.min(1, +t.value / 100),
        );
        editor.mutateColor(
          runtime.document.project.colors[
            runtime.document.project.colors.target
          ],
        );
      });
      return;
    }
    if (value) {
      if (!runtime.services.preview.active)
        runtime.services.preview.begin("Cambiar relleno");
      runtime.services.preview.update(() => editor.mutateColor(value));
    }
  };
  $("#color-palette").onchange = (e) => {
    if (runtime.services.preview.active) {
      runtime.services.preview.finish();
      editor.showColorPalette();
      return;
    }
    if (e.target.hasAttribute?.("data-color-view"))
      runtime.document.project.colors.applyTo = e.target.value;
  };
  $("#construction-palette").onpointerdown = (e) => {
    if (e.target.dataset?.constructionParam && e.target.type === "range")
      runtime.services.preview.begin("Editar construcción");
  };
  $("#construction-palette").oninput = (e) => {
    if (e.target.dataset?.constructionParam && e.target.type === "range") {
      if (!runtime.services.preview.active)
        runtime.services.preview.begin("Editar construcción");
      editor.setConstructionProperty(
        e.target.dataset?.constructionParam,
        e.target.value,
        true,
      );
    }
  };
  $("#construction-palette").onpointercancel = () => {
    runtime.services.preview.cancel();
    editor.renderConstructionPalette(true);
  };
  $("#color-palette").onpointercancel = () => {
    runtime.services.preview.cancel();
    editor.showColorPalette();
  };
  $("#construction-palette").onchange = (e) => {
    if (runtime.services.preview.active) {
      runtime.services.preview.finish();
      return;
    }
    const key = e.target.dataset?.constructionParam;
    if (key)
      editor.setConstructionProperty(
        key,
        e.target.type === "checkbox" ? e.target.checked : e.target.value,
      );
  };
}

function bindToolMenus(runtime, editor) {
  $("#context-bar").addEventListener("change", (e) => {
    if (e.target.hasAttribute?.("data-eraser-mode"))
      editor.setEraserMode(e.target.value);
    if (e.target.hasAttribute?.("data-eraser-radius"))
      runtime.interaction.eraserRadius = Math.max(
        2,
        Math.min(60, Number(e.target.value) || 10),
      );
  });
  $("#context-bar").addEventListener("change", (e) => {
    if (e.target.dataset.gradientStop !== undefined && editor.one()?.gradient) {
      const i = Number(e.target.dataset.gradientStop);
      editor.commit(
        () =>
          (editor.one().gradient.stops[
            i ? editor.one().gradient.stops.length - 1 : 0
          ].color = e.target.value),
        "Color del degradado",
      );
    }
  });
  $("#ux-menus").onclick = editor.dispatchUx;
  $("#modal").addEventListener("click", editor.dispatchUx);
  $("#pathfinder-popover").onclick = (e) => {
    if (e.target.closest("[data-close-pathfinder]")) {
      $("#pathfinder-popover").classList.add("hidden");
      runtime.workspace.pathfinderOpen = false;
      $("#canvas").focus();
    } else editor.dispatchUx(e);
  };
  for (const selector of ["#context-bar", "#properties", "#context"])
    $(selector).addEventListener("click", editor.dispatchUx);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      for (const detail of $$(".tool-flyout[open],.ux-menu[open]"))
        detail.open = false;
      $("#pathfinder-popover").classList.add("hidden");
      runtime.workspace.pathfinderOpen = false;
    }
  });
  document.addEventListener("pointerdown", (e) => {
    for (const detail of $$(".tool-flyout[open],.ux-menu[open]"))
      if (!detail.contains(e.target)) detail.open = false;
    if (
      !e.target.closest(
        '#pathfinder-popover,[data-ux-command="pathfinderPanel"]',
      )
    ) {
      $("#pathfinder-popover").classList.add("hidden");
      runtime.workspace.pathfinderOpen = false;
    }
  });
  $("#canvas").addEventListener("pointerleave", () => {
    if (!runtime.interaction.drag) {
      $("#tool-feedback").innerHTML = "";
      if (runtime.interaction.tool === "eraser") $("#draft").innerHTML = "";
    }
  });
  $("#canvas").addEventListener("lostpointercapture", () => {
    if (runtime.interaction.drag) {
      editor.cancelAction();
      editor.render();
    }
  });
  $("#tools").addEventListener("click", (e) => {
    const summary = e.target.closest(".tool-flyout>summary");
    if (!summary) return;
    const family = summary.closest(".tool-family"),
      menu = family?.querySelector(".tool-flyout-menu");
    if (!menu) return;
    const rect = summary.getBoundingClientRect(),
      height = menu.getBoundingClientRect().height || 200;
    menu.style.left =
      Math.max(8, Math.min(innerWidth - 253, rect.right + 8)) + "px";
    menu.style.top =
      Math.max(56, Math.min(innerHeight - height - 40, rect.top - 8)) + "px";
  });
}
