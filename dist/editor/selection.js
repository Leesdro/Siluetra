import { pathfinderHtml } from "../ux-tools.js";
import { layerStack, orderedObjects } from "../layers.js";
import { normalizeMirrorSelection } from "../mirror-service.js";
import { graphIds, cloneGraph, linkMirrorGraph } from "../object-graph.js";
import { refreshPanels, editPanelAnchor } from "../panels.js";
import {
  treeSelection,
  groupDescendants,
  pruneEmptyGroups,
  copyGroupMetadata,
  groupObjects,
  ungroupObjects,
  selectableTree,
} from "../selection-ui.js";
import { removeConstructions } from "../construction-system.js";
import { locked, isolationIds, ancestors } from "../model.js";
import { selectionBounds } from "../hit.js";
import { settings, rememberResource } from "../preferences.js";
import { uid, I, mul, translate, around, bounds, union } from "../core.js";
import { resource } from "../templates.js";
import { $ } from "./ui.js";

// selection: editor controller; geometry and document services remain authoritative.
export function createSelectionController(runtime, editor) {
  function selectId(id, add = false, individual = false) {
    if (runtime.panels.panelEdgeState) editor.cancelPanelEdges();
    if (runtime.services.preview.active) runtime.services.preview.finish();
    runtime.selection.selectedGroup = null;
    const o = editor.objects().find((o) => o.id === id);
    if (
      !o ||
      locked(runtime.document.project, runtime.document.view, o) ||
      (runtime.selection.isolation.length &&
        !isolationIds(
          runtime.document.project,
          runtime.document.view,
          runtime.selection.isolation.at(-1),
        ).has(o.id))
    )
      return;
    if (o.hidden && !o.source) {
      /* object tree may select hidden paths */
    }
    const chain = ancestors(runtime.document.project, runtime.document.view, o),
      isolateIndex = chain.findIndex(
        (g) => g.id === runtime.selection.editingGroup,
      ),
      scope = (isolateIndex >= 0 ? chain.slice(0, isolateIndex) : chain).at(
        -1,
      )?.id;
    const ids =
      scope &&
      !o.panelOf &&
      settings.selection === "group" &&
      !individual &&
      runtime.interaction.tool !== "node" &&
      !o.source &&
      !o.modifiers?.length
        ? groupDescendants(
            runtime.document.project,
            runtime.document.view,
            scope,
          ).filter((id) => {
            const x = editor.objects().find((o) => o.id === id);
            return (
              x && !locked(runtime.document.project, runtime.document.view, x)
            );
          })
        : [id];
    if (add)
      runtime.selection.selected = runtime.selection.selected.includes(id)
        ? runtime.selection.selected.filter((x) => !ids.includes(x))
        : [...new Set([...runtime.selection.selected, ...ids])];
    else runtime.selection.selected = ids;
    runtime.selection.nodeIndex = -1;
    runtime.selection.nodeIndices = [];
    runtime.selection.edgeIds = [];
    if (!add) {
      runtime.selection.rangeSelections = {};
      runtime.selection.constructionContexts = [];
    }
    runtime.selection.modifierContext = null;
    selectionUI();
  }

  function selectionUI() {
    if (!$("#pathfinder-popover").classList.contains("hidden")) {
      const body = $("#pathfinder-popover").querySelector(".floating-body");
      if (body) body.innerHTML = pathfinderHtml(editor.chosen());
    }
    if (
      runtime.selection.selected.length &&
      runtime.library.tab === "objects"
    ) {
      editor.library();
      runtime.services.layers.reveal();
    }
    editor.drawSelection();
    editor.properties();
    editor.contextBar();
    editor.renderConstructionPalette();
    if (runtime.library.tab === "objects") editor.library();
    $("#object-count").textContent =
      editor.objects().filter((o) => !o.hidden).length +
      " objetos · " +
      (runtime.selection.selected.length || "Sin") +
      " seleccionados";
  }

  function effectiveMatrix(o) {
    return o?.source
      ? editor.objects().find((s) => s.id === o.source)?.matrix || I()
      : o?.matrix || I();
  }

  function effectiveIds() {
    const ids = new Set(runtime.selection.selected);
    for (const o of editor.chosen()) if (o.source) ids.add(o.source);
    return [...ids].filter((id) => {
      const o = editor.objects().find((o) => o.id === id);
      return (
        o &&
        !o.source &&
        !locked(runtime.document.project, runtime.document.view, o) &&
        !(
          runtime.document.project.liveMirror &&
          o.instanceOf &&
          ids.has(o.instanceOf)
        )
      );
    });
  }

  function applyTransform(m, ids = effectiveIds(), initial = null) {
    for (const id of ids) {
      const o = editor.objects().find((o) => o.id === id);
      if (!o) continue;
      o.matrix = mul(m, initial?.get(id) || o.matrix);
      if (o.collapseBackup && !initial)
        o.collapseBackup = mul(m, o.collapseBackup);
      if (runtime.document.project.liveMirror && o.symmetry) {
        const b = bounds(o, editor.objects());
        o.matrix = mul(
          translate(
            (runtime.document.project.centerAxis ?? 350) - (b.x + b.w / 2),
            0,
          ),
          o.matrix,
        );
      }
    }
    for (const id of ids)
      editPanelAnchor(
        editor.objects(),
        editor.objects().find((o) => o.id === id),
      );
  }

  function removeSelected(confirmed = false) {
    if (runtime.selection.selectedGroup) {
      const id = runtime.selection.selectedGroup;
      editor.commit(() => {
        const ids = new Set(
            groupDescendants(
              runtime.document.project,
              runtime.document.view,
              id,
            ),
          ),
          groups = new Set([id]);
        let added = true;
        while (added) {
          added = false;
          for (const g of runtime.document.project.groups[
            runtime.document.view
          ])
            if (groups.has(g.parent) && !groups.has(g.id)) {
              groups.add(g.id);
              added = true;
            }
        }
        for (const o of editor.objects())
          if (ids.has(o.instanceOf) || ids.has(o.mirrorPeer)) ids.add(o.id);
        runtime.document.project.views[runtime.document.view] = editor
          .objects()
          .filter((o) => !ids.has(o.id));
        runtime.document.project.groups[runtime.document.view] =
          runtime.document.project.groups[runtime.document.view].filter(
            (g) => !groups.has(g.id),
          );
        runtime.selection.selected = [];
        runtime.selection.selectedGroup = null;
      }, "Eliminar carpeta y contenido");
      return;
    }
    if (editor.chosen().some((o) => o.semanticType === "panelBoundary")) {
      editor.commit(() => {
        const ids = graphIds(editor.objects(), runtime.selection.selected, {
          includeOwners: false,
        });
        runtime.document.project.views[runtime.document.view] = editor
          .objects()
          .filter((o) => !ids.includes(o.id));
        refreshPanels(editor.objects());
        runtime.selection.selected = [];
      }, "Eliminar división de panel");
      return;
    }
    const refs = editor.activeConstructionRefs();
    if (refs.length) {
      editor.commit(() => {
        removeConstructions(
          runtime.document.project,
          runtime.document.view,
          refs,
        );
        runtime.selection.selected = runtime.selection.selected.filter((id) =>
          editor.objects().some((o) => o.id === id),
        );
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
      }, "Eliminar construcción");
      return;
    }
    if (
      runtime.interaction.tool === "node" &&
      runtime.interaction.editMode === "edges" &&
      (runtime.selection.edgeIds.length ||
        Object.keys(runtime.selection.rangeSelections).length)
    ) {
      runtime.selection.edgeIds = [];
      runtime.selection.rangeSelections = {};
      editor.drawSelection();
      editor.status("Selección de bordes despejada");
      return;
    }
    const external = editor
      .objects()
      .filter(
        (o) =>
          o.source &&
          runtime.selection.selected.includes(o.source) &&
          !runtime.selection.selected.includes(o.id),
      );
    if (external.length && !confirmed) {
      editor.modal(
        "<h2>Eliminar geometría de origen</h2><p>También se eliminarán " +
          external.length +
          ' efectos vinculados. Podés deshacer la operación.</p><div class="dialog-actions"><button data-close>Cancelar</button><button class="primary" id="delete-source">Eliminar</button></div>',
        (e, d) => {
          if (e.target.id === "delete-source") {
            d.close();
            removeSelected(true);
          }
        },
      );
      return;
    }
    const ids = new Set(runtime.selection.selected);
    let added = true;
    while (added) {
      added = false;
      for (const o of editor.objects())
        if (
          (ids.has(o.source) ||
            ids.has(o.panelOf) ||
            ids.has(o.ownerId) ||
            ids.has(o.attachment?.source)) &&
          !ids.has(o.id)
        ) {
          ids.add(o.id);
          added = true;
        }
    }
    editor.commit(() => {
      runtime.document.project.views[runtime.document.view] = editor
        .objects()
        .filter((o) => !ids.has(o.id));
      pruneEmptyGroups(runtime.document.project, runtime.document.view);
      for (const o of editor.objects())
        if (o.clip && ids.has(o.clip)) delete o.clip;
      runtime.selection.selected = [];
      runtime.selection.nodeIndex = -1;
    });
  }

  function copySelection(dx = 12, dy = 12, linkedMirror = false) {
    const ids = linkedMirror
      ? normalizeMirrorSelection(editor.objects(), runtime.selection.selected)
      : runtime.selection.selected;
    const { originals, copies } = cloneGraph(editor.objects(), ids, dx, dy);
    copyGroupMetadata(
      runtime.document.project,
      runtime.document.view,
      originals,
      copies,
    );
    editor.insertObjects(copies);
    if (linkedMirror) {
      if (originals.some((o) => o.mirrorPeer || o.instanceOf)) {
        for (const c of copies) {
          delete c.symmetryExcluded;
          c.mirrorPolicy = "linked";
        }
      } else
        linkMirrorGraph(
          editor.objects(),
          originals,
          copies,
          runtime.document.project.centerAxis,
        );
    }
    runtime.selection.selected = copies
      .filter((o) => !o.hidden)
      .map((o) => o.id);
    return copies;
  }

  function duplicate(dx = 12, dy = 12) {
    let copies = [];
    editor.commit(
      () => (copies = copySelection(dx, dy)),
      "Duplicar construcción",
    );
    return copies.map((o) => o.id);
  }

  function mirror(dup = false) {
    if (!runtime.selection.selected.length) return;
    if (dup) {
      editor.commit(() => {
        const copies = copySelection(0, 0, runtime.document.project.liveMirror);
        if (!runtime.document.project.liveMirror)
          for (const o of copies)
            if (!o.source && !o.panelOf)
              o.matrix = mul(
                [-1, 0, 0, 1, 2 * runtime.document.project.centerAxis, 0],
                o.matrix,
              );
      }, "Duplicar y reflejar construcción");
    } else {
      const b =
        selectionBounds(editor.chosen(), editor.objects()) ||
        union(editor.chosen(), editor.objects());
      editor.commit(
        () => applyTransform(around(b.x + b.w / 2, b.y + b.h / 2, -1, 1)),
        "Reflejar selección",
      );
    }
  }

  function group() {
    if (!runtime.selection.selected.length) return;
    editor.commit(() => {
      const g = groupObjects(
        runtime.document.project,
        runtime.document.view,
        runtime.selection.selected,
        uid(),
      );
      if (g) {
        runtime.selection.selectedGroup = g.id;
        runtime.selection.selected = groupDescendants(
          runtime.document.project,
          runtime.document.view,
          g.id,
        );
        layerStack(runtime.document.project, runtime.document.view);
      }
    }, "Agrupar objetos");
  }

  function ungroup() {
    editor.commit(() => {
      if (runtime.selection.selectedGroup && !runtime.selection.selected.length)
        runtime.document.project.groups[runtime.document.view] =
          runtime.document.project.groups[runtime.document.view].filter(
            (g) => g.id !== runtime.selection.selectedGroup,
          );
      else
        ungroupObjects(
          runtime.document.project,
          runtime.document.view,
          runtime.selection.selected,
        );
      runtime.selection.selectedGroup = null;
    }, "Desagrupar objetos");
  }

  function addResource(key, p = { x: 350, y: 310 }) {
    rememberResource(key);
    if (editor.applyResourceModifier(key)) return;
    const list = resource(key);
    if (!list.length) return;
    const b = union(
      list.filter((o) => !o.hidden),
      list,
    );
    const m = translate(p.x - b.x - b.w / 2, p.y - b.y - b.h / 2);
    list.forEach((o) => {
      if (!o.source) o.matrix = mul(m, o.matrix);
    });
    editor.commit(() => {
      editor.insertObjects(list);
      runtime.selection.selected = list
        .filter((o) => !o.hidden)
        .map((o) => o.id);
      runtime.interaction.tool = "select";
      runtime.selection.constructionContexts = list
        .filter((o) => !o.hidden && o.modifiers?.length)
        .map((o) => ({ ownerId: o.id, modifierId: o.modifiers.at(-1).id }));
      runtime.selection.modifierContext =
        runtime.selection.constructionContexts[0]?.modifierId || null;
    });
    editor.renderConstructionPalette(true);
    editor.status("Recurso agregado");
  }

  function sourceFor(o) {
    return o?.source ? editor.objects().find((p) => p.id === o.source) : o;
  }

  function replaceWith(result) {
    const os = editor.chosen(),
      ids = new Set(os.map((o) => o.id));
    for (const o of editor.objects())
      if (o.source && ids.has(o.source)) ids.add(o.id);
    runtime.document.project.views[runtime.document.view] = editor
      .objects()
      .filter((o) => !ids.has(o.id));
    pruneEmptyGroups(runtime.document.project, runtime.document.view);
    for (const o of editor.objects())
      if (o.clip && ids.has(o.clip)) delete o.clip;
    if (result) {
      editor.insertObjects([result]);
      runtime.selection.selected = [result.id];
    } else runtime.selection.selected = [];
  }

  function mirrorObjects() {
    if (!runtime.selection.selected.length) return;
    editor.commit(() => {
      runtime.document.project.liveMirror = true;
      copySelection(0, 0, true);
    }, "Crear espejo vivo de construcción");
  }

  function selectTreeObject(id, e) {
    if (runtime.panels.panelEdgeState) editor.cancelPanelEdges();
    if (runtime.services.preview.active) runtime.services.preview.finish();
    runtime.selection.selectedGroup = null;
    const next = treeSelection({
      ids: selectableTree(runtime.document.project, runtime.document.view),
      current: runtime.selection.selected,
      anchor: runtime.selection.treeAnchor,
      id,
      shift: !!e.shiftKey,
      toggle: !!(e.ctrlKey || e.metaKey),
      allowed: (id) => {
        const o = editor.objects().find((o) => o.id === id);
        return (
          !!o && !locked(runtime.document.project, runtime.document.view, o)
        );
      },
    });
    runtime.selection.selected = next.selected;
    runtime.selection.treeAnchor = next.anchor;
    runtime.selection.nodeIndices = [];
    runtime.selection.edgeIds = [];
    runtime.selection.constructionContexts = [];
    runtime.selection.modifierContext = null;
    selectionUI();
  }

  function selectTreeGroup(id, e) {
    if (runtime.panels.panelEdgeState) editor.cancelPanelEdges();
    if (runtime.services.preview.active) runtime.services.preview.finish();
    const ids = groupDescendants(
      runtime.document.project,
      runtime.document.view,
      id,
    ).filter((id) => {
      const o = editor.objects().find((o) => o.id === id);
      return o && !locked(runtime.document.project, runtime.document.view, o);
    });
    runtime.selection.selectedGroup = id;
    runtime.selection.selected =
      e.ctrlKey || e.metaKey
        ? ids.every((id) => runtime.selection.selected.includes(id))
          ? runtime.selection.selected.filter((id) => !ids.includes(id))
          : [...new Set([...runtime.selection.selected, ...ids])]
        : ids;
    runtime.selection.treeAnchor = ids[0];
    runtime.selection.constructionContexts = [];
    runtime.selection.modifierContext = null;
    selectionUI();
  }

  function reorder(front) {
    editor.commit(
      () => {
        const order = layerStack(
            runtime.document.project,
            runtime.document.view,
          ),
          ids = runtime.selection.selected.filter((id) =>
            editor
              .objects()
              .some((o) => o.id === id && !o.source && !o.panelOf),
          ),
          other = order.filter((id) => !ids.includes(id));
        runtime.document.project.layerOrder[runtime.document.view] = front
          ? [...ids, ...other]
          : [...other, ...ids];
        runtime.document.project.views[runtime.document.view] = orderedObjects(
          runtime.document.project,
          runtime.document.view,
        );
      },
      front ? "Traer al frente" : "Enviar atrás",
    );
  }
  return {
    selectId,
    selectionUI,
    effectiveMatrix,
    effectiveIds,
    applyTransform,
    removeSelected,
    duplicate,
    mirror,
    group,
    ungroup,
    addResource,
    sourceFor,
    replaceWith,
    mirrorObjects,
    selectTreeObject,
    selectTreeGroup,
    reorder,
  };
}
