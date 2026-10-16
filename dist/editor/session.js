import { interactions } from "../interaction-router.js";
import { insertDocumentObjects, modifyDocument } from "../document-commands.js";
import { editPanelAnchor } from "../panels.js";
import {
  migrateModel,
  reconcile,
  materializeInstances,
  locked,
} from "../model.js";
import { settings } from "../preferences.js";
import { clone, History, validateProject, migrateProject } from "../core.js";
import { saveProject } from "../storage.js";
import { $ } from "./ui.js";

// session: editor controller; geometry and document services remain authoritative.
export function createSessionController(runtime, editor) {
  const objects = () =>
    runtime.document.project?.views[runtime.document.view] || [];
  const chosen = () =>
    objects().filter(
      (o) =>
        runtime.selection.selected.includes(o.id) &&
        !locked(runtime.document.project, runtime.document.view, o),
    );
  const one = () => (chosen().length === 1 ? chosen()[0] : null);
  function markDirty() {
    runtime.document.dirty = true;
    $("#save-state").textContent = "Guardando…";
    clearTimeout(runtime.document.saveTimer);
    if (settings.autosave)
      runtime.document.saveTimer = setTimeout(() => save(false), 650);
  }

  function insertObjects(records) {
    return insertDocumentObjects(
      runtime.document.project,
      runtime.document.view,
      records,
      { group: runtime.selection.editingGroup, command: editor.activeTool() },
    );
  }

  function syncChanges(before) {
    for (const o of chosen()) editPanelAnchor(objects(), o);
    if (before?.activeVariant !== runtime.document.project.activeVariant) {
      migrateModel(runtime.document.project);
      materializeInstances(runtime.document.project, runtime.document.view);
      return;
    }
    reconcile(runtime.document.project, before, runtime.document.view, {
      command: editor.activeTool(),
    });
  }

  function commit(fn, label) {
    if (!runtime.document.project) return;
    const beforeSelection = [...runtime.selection.selected];
    try {
      modifyDocument(
        runtime.document.project,
        runtime.document.view,
        () => fn?.(),
        {
          before: runtime.document.history.doc,
          resolve: syncChangesAdapter,
          command: label || editor.activeTool(),
        },
      );
    } catch (error) {
      runtime.selection.selected = beforeSelection;
      editor.render();
      throw error;
    }
    if (
      runtime.document.history.commit(
        runtime.document.project,
        label ||
          describeChange(
            runtime.document.history.doc,
            runtime.document.project,
          ),
      )
    )
      markDirty();
    editor.render();
  }

  function syncChangesAdapter(p, before) {
    syncChanges(before);
  }

  function finishMutation(label) {
    try {
      modifyDocument(
        runtime.document.project,
        runtime.document.view,
        () => {},
        {
          before: runtime.document.history.doc,
          resolve: syncChangesAdapter,
          command: label || editor.activeTool(),
        },
      );
      if (
        runtime.document.history.commit(
          runtime.document.project,
          label ||
            describeChange(
              runtime.document.history.doc,
              runtime.document.project,
            ),
        )
      )
        markDirty();
      editor.render();
    } catch (error) {
      runtime.selection.selected = runtime.selection.selected.filter((id) =>
        objects().some((o) => o.id === id),
      );
      runtime.selection.nodeIndices = [];
      runtime.selection.constructionContexts = [];
      runtime.selection.modifierContext = null;
      editor.render();
      throw error;
    }
  }

  function restoreHistoryProject(p, message) {
    if (!p) return;

    runtime.document.project = p;
    runtime.selection.selected = runtime.selection.selected.filter((id) =>
      objects().some((o) => o.id === id),
    );
    runtime.selection.nodeIndex = -1;
    runtime.selection.nodeIndices = [];
    runtime.selection.constructionContexts = [];
    runtime.selection.modifierContext = null;
    runtime.selection.rangeSelections = {};
    runtime.selection.edgeIds = [];
    markDirty();
    editor.render();
    editor.status(message);
  }

  function undo() {
    cancelDocumentOperation();
    restoreHistoryProject(runtime.document.history.undo(), "Cambio deshecho");
  }

  function redo() {
    cancelDocumentOperation();
    restoreHistoryProject(runtime.document.history.redo(), "Cambio rehecho");
  }

  async function save(explicit = true) {
    if (!runtime.document.project) return;
    clearTimeout(runtime.document.saveTimer);
    let copy;
    try {
      const source =
        runtime.interaction.drag || runtime.services.preview.active
          ? runtime.document.history.doc
          : runtime.document.project;
      validateProject(source);
      copy = clone(source);
    } catch (error) {
      $("#save-state").textContent = "No se guardó el estado inválido";
      editor.toast(error.message);
      return;
    }
    copy.updated = Date.now();
    runtime.document.saveChain = runtime.document.saveChain
      .catch(() => {})
      .then(() => saveProject(copy));
    try {
      await runtime.document.saveChain;
      if (
        runtime.document.project?.id === copy.id &&
        JSON.stringify({
          ...runtime.document.project,
          updated: copy.updated,
        }) === JSON.stringify(copy)
      ) {
        runtime.document.dirty = false;
        $("#save-state").textContent = "Guardado local";
      }
      if (explicit) editor.toast("Proyecto guardado en este navegador");
      localStorage.setItem("atelier-last-project", copy.id);
    } catch (e) {
      $("#save-state").textContent = "Error al guardar";
      editor.toast(
        "No se pudo guardar. Exportá el proyecto JSON como respaldo.",
      );
    }
  }

  async function showStart() {
    if (runtime.document.project && runtime.document.dirty) {
      await save(false);
      if (runtime.document.dirty) return;
    }
    editor.cancelAction();
    editor.closeVariants();
    editor.closeAppearance();
    $("#construction-palette").classList.add("hidden");
    $("#history-palette").classList.add("hidden");
    $("#editor").classList.add("hidden");
    $("#start").classList.remove("hidden");
    await editor.renderRecents();
  }

  function open(p) {
    const candidate = migrateModel(migrateProject(p));
    validateProject(candidate);
    interactions.cancel();
    editor.cancelPanelEdges();
    runtime.panels.panelPreview = null;
    runtime.interaction.drag = null;
    runtime.selection.selectedGroup = null;
    runtime.library.resourceSections.clear();
    runtime.services.layers.closed.clear();
    runtime.services.layers.search = "";
    runtime.selection.treeAnchor = null;
    runtime.document.project = candidate;
    runtime.document.history = new History(runtime.document.project);
    runtime.document.view = "front";
    runtime.selection.selected = [];
    runtime.interaction.pen = null;
    runtime.interaction.tool = "select";
    runtime.interaction.editMode = "nodes";
    runtime.selection.edgeIds = [];
    runtime.interaction.pendingFinish = null;
    runtime.selection.modifierContext = null;
    runtime.selection.constructionContexts = [];
    runtime.selection.rangeSelections = {};
    runtime.workspace.paletteKey = "";
    runtime.workspace.paletteClosedKey = null;
    runtime.interaction.eraserHover = null;
    $("#construction-palette").classList.add("hidden");
    runtime.interaction.pendingStack = null;
    runtime.selection.nodeIndex = -1;
    runtime.selection.nodeIndices = [];
    runtime.selection.editingGroup = null;
    runtime.selection.isolation = [];
    $("#start").classList.add("hidden");
    $("#editor").classList.remove("hidden");
    $("#project-name").value = runtime.document.project.name;
    runtime.canvas.zoomInitialized = false;
    const readyToFit = () => {
      if (runtime.document.project !== candidate || $("#editor").classList.contains("hidden")) return;
      runtime.services.workspace.resize?.();
      const rect = $("#canvas").getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) {
        requestAnimationFrame(readyToFit);
        return;
      }
      editor.fit();
      editor.render();
      if (runtime.services.workspace.layout.color.visible)
        editor.showColorPalette();
      if (runtime.services.workspace.layout.fabric.visible)
        editor.showFabricPalette();
      if (runtime.services.workspace.layout.history.visible)
        editor.renderHistory();
    };
    requestAnimationFrame(readyToFit);
    save(false);
  }

  function describeChange(before, after) {
    if (before.name !== after.name) return "Renombrar proyecto";
    if (before.activeVariant !== after.activeVariant) return "Cambiar variante";
    if (before.liveMirror !== after.liveMirror) return "Cambiar espejo vivo";
    const old = before.views[runtime.document.view] || [],
      next = after.views[runtime.document.view] || [],
      added = next.filter((o) => !old.some((p) => p.id === o.id)),
      removed = old.filter((o) => !next.some((p) => p.id === o.id));
    if (added.length) return "Agregar " + (added[0].name || "objetos");
    if (removed.length)
      return "Eliminar " + (removed[0].source ? "construcción" : "objetos");
    for (const o of next) {
      const p = old.find((p) => p.id === o.id);
      if (!p) continue;
      if (JSON.stringify(o.matrix) !== JSON.stringify(p.matrix))
        return "Transformar " + o.name;
      if (JSON.stringify(o.nodes) !== JSON.stringify(p.nodes))
        return "Editar geometría de " + o.name;
      if (JSON.stringify(o.modifiers) !== JSON.stringify(p.modifiers))
        return "Editar modificadores";
      if (JSON.stringify(o) !== JSON.stringify(p)) return "Editar " + o.name;
    }
    return "Editar documento";
  }

  function cancelDocumentOperation() {
    editor.cancelPanelEdges();
    runtime.panels.panelPreview = null;
    $("#panel-preview").classList.add("hidden");
    interactions.end("canvas");
    runtime.services.preview.cancel();
    if (runtime.interaction.drag?.before)
      runtime.document.project = clone(runtime.interaction.drag.before);
    runtime.interaction.drag = null;
    runtime.interaction.pen = null;
    $("#draft").innerHTML = "";
    $("#guides").innerHTML = "";
  }
  return {
    markDirty,
    insertObjects,
    commit,
    finishMutation,
    undo,
    redo,
    save,
    showStart,
    open,
    cancelDocumentOperation,
    objects,
    chosen,
    one,
  };
}
