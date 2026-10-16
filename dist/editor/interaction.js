import { toolCursor } from "../ux-tools.js";
import {
  collectSnapTargets,
  snapPoint,
  snapTranslation,
} from "../smart-guides.js";
import { linearGradient } from "../appearance.js";
import {
  scissorsAt,
  nearestPathPoint,
  measurePoints,
  curvatureNodes,
} from "../vector-edit.js";
import { constrainAngle } from "../vectorcraft-adapted.js";
import { eraseConstruction, eraseVectorPartial } from "../eraser.js";
import { interactions } from "../interaction-router.js";
import { routeShortcut } from "../shortcut-router.js";
import { graphIds, cloneGraph } from "../object-graph.js";
import { editPanelAnchor } from "../panels.js";
import { copyGroupMetadata } from "../selection-ui.js";
import { nearestEdge } from "../edges.js";
import { visible, locked, isolationIds } from "../model.js";
import {
  cycleHit,
  selectionHits,
  constructionHits,
  marqueeHits,
  selectionBounds,
} from "../hit.js";
import { settings } from "../preferences.js";
import { pencilPath } from "../freehand.js";
import {
  uid,
  clone,
  I,
  point,
  inverse,
  translate,
  around,
  pathD,
  makePath,
  union,
  worldPath,
  warpPoint,
  handlePoint,
  localBox,
} from "../core.js";
import { addSymmetricNode } from "../symmetry.js";
import { $, $$ } from "./ui.js";

// interaction: editor controller; geometry and document services remain authoritative.
export function createInteractionController(runtime, editor) {
  function snapDelta(dx, dy, b, ids, shift) {
    if (!runtime.canvas.snap)
      return snapTranslation(dx, dy, b, { xs: [], ys: [] }, 0, shift);
    const targets = runtime.interaction.drag
      ? (runtime.interaction.drag.snapTargets ??= collectSnapTargets(
          runtime.document.project,
          runtime.document.view,
          ids,
          settings,
        ))
      : collectSnapTargets(
          runtime.document.project,
          runtime.document.view,
          ids,
          settings,
        );
    return snapTranslation(
      dx,
      dy,
      b,
      targets,
      settings.snapThreshold / runtime.canvas.camera.z,
      shift,
    );
  }

  function pointerDown(e) {
    if (
      runtime.panels.panelEdgeState &&
      e.button === 0 &&
      !runtime.interaction.space &&
      interactions.allows("canvas", e.pointerId)
    ) {
      editor.panelEdgesPointer(editor.world(e), true);
      $("#canvas").focus({ preventScroll: true });
      return;
    }
    if (
      runtime.document.project &&
      interactions.allows("canvas", e.pointerId) &&
      e.button === 0 &&
      !runtime.interaction.space &&
      !runtime.panels.panelPreview &&
      professionalPointerDown(e)
    )
      return;
    if (!interactions.allows("canvas", e.pointerId) || e.button === 2) return;
    if (e.button === 1 || runtime.interaction.space) {
      e.preventDefault();
      runtime.interaction.drag = {
        kind: "pan",
        x: e.clientX,
        y: e.clientY,
        cam: { ...runtime.canvas.camera },
      };
      interactions.begin("canvas", "CANVAS_PAN", e.pointerId, cancelAction);
      $("#canvas").setPointerCapture(e.pointerId);
      return;
    }
    if (runtime.panels.panelPreview?.choosing) {
      const base = editor.choosePanelSurface(editor.world(e));
      if (base) editor.beginPanelPreview(base.id);
      return;
    }
    if (runtime.interaction.tool === "fabric") {
      const o = editor.colorTarget(editor.world(e));
      if (o) {
        editor.selectId(o.id, false, true);
        editor.showFabricPalette();
      }
      return;
    }
    if (e.button === 2) return;
    if (
      runtime.interaction.tool === "eraser" &&
      runtime.interaction.eraserMode === "vector"
    ) {
      const p = editor.world(e);
      runtime.interaction.drag = {
        kind: "eraseVector",
        points: [p],
        before: clone(runtime.document.project),
      };
      interactions.begin("canvas", "TOOL_DRAW", e.pointerId, cancelAction);
      e.preventDefault();
      $("#canvas").setPointerCapture(e.pointerId);
      return;
    }
    if (runtime.interaction.tool === "eraser") {
      const p = editor.world(e);
      $("#draft").innerHTML =
        `<circle cx="${p.x}" cy="${p.y}" r="${runtime.interaction.eraserRadius / runtime.canvas.camera.z}" fill="#d5575720" stroke="#c74848" stroke-width="${1 / runtime.canvas.camera.z}"/>`;
      if (runtime.interaction.eraserMode === "vector") return;
      const ref = constructionHits(
        runtime.document.project,
        runtime.document.view,
        p,
        runtime.canvas.camera.z,
        runtime.selection.isolation.at(-1),
      )[0];
      if (ref)
        editor.commit(() => {
          eraseConstruction(
            runtime.document.project,
            runtime.document.view,
            ref,
          );
          runtime.interaction.eraserHover = null;
          runtime.selection.constructionContexts = [];
          runtime.selection.modifierContext = null;
        }, "Borrar construcción");
      return;
    }
    editor.closeContext();
    $("#canvas").focus({ preventScroll: true });
    const p = editor.world(e);
    if (
      runtime.interaction.tool === "fill" ||
      runtime.interaction.tool === "eyedropper"
    ) {
      const target = editor.colorTarget(p, runtime.interaction.tool === "fill");
      if (target) {
        if (runtime.interaction.tool === "eyedropper") {
          editor.setActiveColor(
            runtime.document.project.colors.target === "stroke"
              ? target.stroke
              : target.fill && target.fill !== "none"
                ? target.fill
                : target.stroke,
          );
          editor.showColorPalette();
        } else {
          editor.applyColor(
            runtime.document.project.colors[
              runtime.document.project.colors.target
            ],
            [target.id],
          );
          runtime.selection.selected = [target.id];
          editor.selectionUI();
        }
      }
      return;
    }
    if (
      runtime.interaction.tool === "node" &&
      runtime.interaction.editMode === "edges" &&
      !runtime.interaction.temporarySelect &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.target.closest("[data-handle]") &&
      !e.target.closest("[data-node]")
    ) {
      const allowed = isolationIds(
          runtime.document.project,
          runtime.document.view,
          runtime.selection.isolation.at(-1),
        ),
        candidates = editor
          .objects()
          .filter(
            (o) =>
              o.type === "path" &&
              visible(runtime.document.project, runtime.document.view, o) &&
              !locked(runtime.document.project, runtime.document.view, o) &&
              (!allowed || allowed.has(o.id)),
          )
          .map((o) => ({
            o,
            edge: nearestEdge(o, p, 7 / runtime.canvas.camera.z),
          }))
          .filter((t) => t.edge)
          .sort((a, b) => a.edge.distance - b.edge.distance),
        target = candidates[0];
      if (target) {
        const { o, edge } = target;
        if (!e.shiftKey && !e.altKey) {
          runtime.selection.rangeSelections = {};
          runtime.selection.selected = [o.id];
        }
        if (e.shiftKey && !runtime.selection.selected.includes(o.id))
          runtime.selection.selected.push(o.id);
        let ids = runtime.selection.rangeSelections[o.id] || [];
        ids = e.altKey
          ? ids.filter((id) => id !== edge.edgeId)
          : [...new Set([...ids, edge.edgeId])];
        runtime.selection.rangeSelections[o.id] = ids;
        runtime.selection.edgeIds =
          runtime.selection.selected.length === 1 ? ids : [];
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
        if (runtime.interaction.pendingStack) {
          const params = runtime.interaction.pendingStack;
          runtime.interaction.pendingStack = null;
          editor.prepareStack(params);
        } else if (runtime.interaction.pendingFinish && ids.length) {
          editor.finishPreset(runtime.interaction.pendingFinish);
          runtime.interaction.pendingFinish = null;
        }
        editor.drawSelection();
        editor.properties();
        editor.contextBar();
        editor.renderConstructionPalette();
        return;
      }
    }
    const h = e.target.closest("[data-handle]"),
      n = e.target.closest("[data-node]"),
      bendTarget = e.target.closest("[data-bend]");
    if (bendTarget && editor.one()) {
      const o = editor.one(),
        m = o.modifiers.find((m) => m.id === bendTarget.dataset.bend);
      runtime.interaction.drag = {
        kind: "bend",
        id: o.id,
        modId: m.id,
        start: point(inverse(o.matrix), p),
        amount: m.amount,
        before: clone(runtime.document.project),
      };
    } else if (h && runtime.selection.selected.length) {
      const b =
          selectionBounds(editor.chosen(), editor.objects()) ||
          union(editor.chosen(), editor.objects()),
        ids = editor.effectiveIds(),
        matrices = new Map(
          ids.map((id) => [
            id,
            clone(editor.objects().find((o) => o.id === id).matrix),
          ]),
        );
      runtime.interaction.drag = {
        kind:
          h.dataset.handle === "move"
            ? "move"
            : h.dataset.handle === "rotate"
              ? "rotate"
              : "scale",
        key: h.dataset.handle,
        start: p,
        b,
        ids,
        matrices,
        before: clone(runtime.document.project),
      };
    } else if (
      n &&
      editor.one()?.type === "path" &&
      !runtime.interaction.temporarySelect &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      const o = editor.one();
      runtime.selection.nodeIndex = +n.dataset.node;
      if (e.shiftKey) {
        runtime.selection.nodeIndices = runtime.selection.nodeIndices.includes(
          runtime.selection.nodeIndex,
        )
          ? runtime.selection.nodeIndices.filter(
              (i) => i !== runtime.selection.nodeIndex,
            )
          : [...runtime.selection.nodeIndices, runtime.selection.nodeIndex];
      } else if (
        !runtime.selection.nodeIndices.includes(runtime.selection.nodeIndex)
      )
        runtime.selection.nodeIndices = [runtime.selection.nodeIndex];
      runtime.interaction.drag = {
        kind: "node",
        id: o.id,
        index: runtime.selection.nodeIndex,
        side: n.dataset.side,
        start: n.dataset.side
          ? handlePoint(
              o,
              o.nodes[runtime.selection.nodeIndex],
              point(inverse(o.matrix), p),
              true,
            )
          : warpPoint(o, point(inverse(o.matrix), p), true),
        node: clone(o.nodes[runtime.selection.nodeIndex]),
        nodes: clone(o.nodes),
        before: clone(runtime.document.project),
      };
      editor.drawSelection();
      editor.properties();
    } else if (
      runtime.interaction.tool === "node" &&
      editor.one()?.type === "path" &&
      !runtime.interaction.temporarySelect &&
      !e.ctrlKey &&
      !e.metaKey &&
      nearestEdge(editor.one(), p, 7 / runtime.canvas.camera.z)
    ) {
      const o = editor.one(),
        edge = nearestEdge(o, p, 7 / runtime.canvas.camera.z);
      if (runtime.interaction.editMode === "edges") {
        if (e.altKey)
          runtime.selection.edgeIds = runtime.selection.edgeIds.filter(
            (id) => id !== edge.edgeId,
          );
        else if (e.shiftKey)
          runtime.selection.edgeIds = [
            ...new Set([...runtime.selection.edgeIds, edge.edgeId]),
          ];
        else runtime.selection.edgeIds = [edge.edgeId];
        if (
          runtime.interaction.pendingFinish &&
          runtime.selection.edgeIds.length
        ) {
          editor.finishPreset(runtime.interaction.pendingFinish);
          runtime.interaction.pendingFinish = null;
        }
        editor.drawSelection();
        editor.properties();
        editor.contextBar();
        return;
      }
      const a = o.nodes[edge.index],
        b = o.nodes[(edge.index + 1) % o.nodes.length];
      runtime.interaction.drag = {
        kind: "segment",
        id: o.id,
        index: edge.index,
        start: point(inverse(o.matrix), p),
        a: clone(a),
        b: clone(b),
        t: Math.max(0.15, Math.min(0.85, edge.t)),
        before: clone(runtime.document.project),
      };
    } else if (
      runtime.interaction.tool === "pen" ||
      runtime.interaction.tool === "curvature"
    ) {
      Object.assign(p, editor.snapPanelPoint(p));
      if (!runtime.interaction.pen)
        runtime.interaction.pen = {
          nodes: [],
          closed: false,
          targetBaseId: editor.chosen().find((o) => o.closed && !o.panelOf)?.id,
        };
      if (
        runtime.interaction.pen.nodes.length > 2 &&
        Math.hypot(
          runtime.interaction.pen.nodes[0].x - p.x,
          runtime.interaction.pen.nodes[0].y - p.y,
        ) <
          9 / runtime.canvas.camera.z
      ) {
        runtime.interaction.pen.closed = true;
        finishPen();
        return;
      }
      runtime.interaction.pen.mode = runtime.interaction.tool;
      runtime.interaction.pen.nodes.push({
        x: p.x,
        y: p.y,
        corner: runtime.interaction.tool === "curvature" && e.altKey,
      });
      runtime.interaction.drag = {
        kind:
          runtime.interaction.tool === "curvature"
            ? "curvaturePoint"
            : "penHandle",
        index: runtime.interaction.pen.nodes.length - 1,
        start: p,
      };
      drawDraft();
    } else if (
      runtime.interaction.tool === "pencil" ||
      runtime.interaction.tool === "knife"
    ) {
      Object.assign(p, editor.snapPanelPoint(p));
      runtime.interaction.drag = {
        kind: "pencil",
        cut: runtime.interaction.tool === "knife",
        start: p,
        points: [p],
        targetBaseId: editor.chosen().find((o) => o.closed && !o.panelOf)?.id,
        before: clone(runtime.document.project),
      };
    } else if (["line", "rect", "ellipse"].includes(runtime.interaction.tool)) {
      if (runtime.interaction.tool === "line")
        Object.assign(p, editor.snapPanelPoint(p));
      runtime.interaction.drag = {
        kind: "draw",
        start: p,
        tool: runtime.interaction.tool,
        p,
        targetBaseId:
          runtime.interaction.tool === "line"
            ? editor.chosen().find((o) => o.closed && !o.panelOf)?.id
            : null,
      };
    } else if (runtime.interaction.tool === "text") {
      editor.showText(p);
      return;
    } else {
      const details = selectionHits(
          runtime.document.project,
          runtime.document.view,
          p,
          runtime.canvas.camera.z,
          runtime.selection.isolation.at(-1),
        ),
        hits = details.map((h) => h.ownerId),
        id = cycleHit(hits, runtime.selection.selected[0], e.altKey),
        o = editor.objects().find((o) => o.id === id);
      if (o) {
        if (
          runtime.interaction.tool === "node" &&
          !runtime.interaction.temporarySelect &&
          !e.ctrlKey &&
          !e.metaKey
        )
          editor.selectId(o.source || id, false, true);
        else if (
          !runtime.selection.selected.includes(id) ||
          e.shiftKey ||
          e.altKey ||
          (runtime.interaction.tool === "select" && (e.ctrlKey || e.metaKey))
        )
          editor.selectId(
            id,
            e.shiftKey ||
              (runtime.interaction.tool === "select" &&
                (e.ctrlKey || e.metaKey)),
            e.altKey || e.ctrlKey || e.metaKey || !!o.panelOf,
          );
        runtime.selection.modifierContext =
          details.find((h) => h.ownerId === id)?.modifierId || null;
        if (runtime.selection.modifierContext) {
          if (!e.shiftKey) runtime.selection.constructionContexts = [];
          runtime.selection.constructionContexts.push({
            ownerId: id,
            modifierId: runtime.selection.modifierContext,
            constructionContexts: runtime.selection.constructionContexts,
            rangeSelections: runtime.selection.rangeSelections,
            paletteClosedKey: runtime.workspace.paletteClosedKey,
            snap: runtime.canvas.snap,
          });
        } else if (!e.shiftKey) runtime.selection.constructionContexts = [];
        editor.properties();
        editor.contextBar();
        editor.renderConstructionPalette();
        editor.drawSelection();
        if (
          (!runtime.selection.modifierContext ||
            runtime.interaction.temporarySelect ||
            e.ctrlKey ||
            e.metaKey) &&
          runtime.selection.selected.length &&
          (runtime.interaction.tool === "select" ||
            (runtime.interaction.tool === "node" &&
              (runtime.interaction.temporarySelect || e.ctrlKey || e.metaKey)))
        ) {
          const ids = editor.effectiveIds();
          runtime.interaction.drag = {
            kind: e.altKey ? "altPending" : "move",
            start: p,
            b:
              selectionBounds(editor.chosen(), editor.objects()) ||
              union(editor.chosen(), editor.objects()),
            ids,
            matrices: new Map(
              ids.map((id) => [
                id,
                clone(editor.objects().find((o) => o.id === id).matrix),
              ]),
            ),
            before: clone(runtime.document.project),
          };
        }
      } else {
        if (!e.shiftKey && !e.altKey) {
          runtime.selection.selected = [];
          runtime.selection.nodeIndex = -1;
          runtime.selection.nodeIndices = [];
          editor.selectionUI();
        }
        if (runtime.interaction.tool === "select") {
          runtime.interaction.drag = {
            kind: "marquee",
            start: p,
            p,
            base: [...runtime.selection.selected],
            mode: e.altKey ? "subtract" : e.shiftKey ? "add" : "replace",
          };
        }
      }
    }
    if (runtime.interaction.drag) {
      interactions.begin(
        "canvas",
        runtime.interaction.drag.kind === "node"
          ? "NODE_DRAG"
          : runtime.interaction.drag.kind === "pan"
            ? "CANVAS_PAN"
            : runtime.interaction.drag.kind === "draw"
              ? "TOOL_DRAW"
              : "OBJECT_DRAG",
        e.pointerId,
        cancelAction,
      );
      e.preventDefault();
      $("#canvas").setPointerCapture(e.pointerId);
    }
  }

  function pointerMove(e) {
    if (
      runtime.panels.panelEdgeState &&
      !runtime.interaction.drag &&
      interactions.allows("canvas", e.pointerId)
    ) {
      editor.panelEdgesPointer(editor.world(e), false);
      return;
    }
    if (!interactions.allows("canvas", e.pointerId)) return;
    if (!runtime.interaction.drag) editor.canvasFeedback(e);
    else
      $("#canvas").style.cursor =
        runtime.interaction.drag.kind === "move"
          ? "grabbing"
          : runtime.interaction.drag.kind === "pan"
            ? "grabbing"
            : runtime.interaction.drag.kind === "rotate"
              ? "crosshair"
              : runtime.interaction.drag.kind === "scale"
                ? runtime.interaction.drag.key === "ne" ||
                  runtime.interaction.drag.key === "sw"
                  ? "nesw-resize"
                  : "nwse-resize"
                : toolCursor[editor.activeTool()] || "crosshair";
    if (
      !runtime.interaction.drag &&
      runtime.interaction.tool === "shapeBuilder"
    ) {
      const face = editor.shapeBuilderFace(editor.world(e));
      editor.status(
        face
          ? e.altKey
            ? "Alt · Quitar región creada"
            : "Clic · Crear o pintar región"
          : "No hay una región cerrada en este punto.",
      );
      $("#draft").innerHTML = face
        ? `<path d="${pathD(face)}" fill="${e.altKey ? "#c74848" : "#56a287"}" fill-rule="evenodd" opacity=".35" stroke="#357e62"/>`
        : "";
      return;
    }
    if (runtime.panels.panelPreview?.choosing) {
      const base = editor.choosePanelSurface(editor.world(e));
      $("#draft").innerHTML = base
        ? `<path d="${pathD(worldPath(base))}" fill="#56a287" opacity=".3" stroke="#357e62"/>`
        : "";
      return;
    }
    if (!runtime.interaction.drag) {
      if (
        runtime.interaction.tool === "fill" ||
        runtime.interaction.tool === "eyedropper"
      ) {
        const target = editor.colorTarget(
          editor.world(e),
          runtime.interaction.tool === "fill",
        );
        if (runtime.appearance.colorHover !== target?.id) {
          runtime.appearance.colorHover = target?.id || null;
          editor.drawSelection();
        }
        return;
      }
      if (runtime.interaction.tool === "eraser") {
        const p = editor.world(e);
        $("#draft").innerHTML =
          `<circle cx="${p.x}" cy="${p.y}" r="${runtime.interaction.eraserRadius / runtime.canvas.camera.z}" fill="#d5575720" stroke="#c74848" stroke-width="${1 / runtime.canvas.camera.z}"/>`;
        if (runtime.interaction.eraserMode === "vector") return;
        const ref =
          constructionHits(
            runtime.document.project,
            runtime.document.view,
            p,
            (runtime.canvas.camera.z * 4) / runtime.interaction.eraserRadius,
            runtime.selection.isolation.at(-1),
          )[0] || null;
        if (
          JSON.stringify(ref) !==
          JSON.stringify(runtime.interaction.eraserHover)
        ) {
          runtime.interaction.eraserHover = ref;
          editor.drawSelection();
        }
        return;
      }
      if (
        runtime.interaction.tool === "node" &&
        runtime.interaction.editMode === "edges" &&
        editor.one()?.type === "path"
      ) {
        const edge = nearestEdge(
          editor.one(),
          editor.world(e),
          7 / runtime.canvas.camera.z,
        );
        if (edge?.edgeId !== runtime.selection.hoverEdge) {
          runtime.selection.hoverEdge = edge?.edgeId || null;
          editor.drawSelection();
        }
      }
      if (runtime.interaction.pen) drawDraft(editor.world(e));
      return;
    }
    const p = editor.world(e),
      d = runtime.interaction.drag;
    if (professionalPointerMove(e, p, d)) return;
    if (d.kind === "eraseVector") {
      d.points.push(p);
      $("#draft").innerHTML =
        `<circle cx="${p.x}" cy="${p.y}" r="${runtime.interaction.eraserRadius / runtime.canvas.camera.z}" fill="#d5575720" stroke="#c74848"/>`;
      return;
    }
    if (
      d.kind === "altPending" &&
      Math.hypot(p.x - d.start.x, p.y - d.start.y) * runtime.canvas.camera.z > 4
    ) {
      const { originals, copies } = cloneGraph(
        editor.objects(),
        runtime.selection.selected,
        0,
        0,
      );
      copyGroupMetadata(
        runtime.document.project,
        runtime.document.view,
        originals,
        copies,
      );
      editor.insertObjects(copies);
      runtime.selection.selected = copies
        .filter((o) => !o.hidden)
        .map((o) => o.id);
      d.ids = editor.effectiveIds();
      d.matrices = new Map(
        d.ids.map((id) => [
          id,
          clone(editor.objects().find((o) => o.id === id).matrix),
        ]),
      );
      d.kind = "move";
    }
    if (d.kind === "pencil") {
      Object.assign(p, editor.snapPanelPoint(p));
      const last = d.points.at(-1);
      if (Math.hypot(p.x - last.x, p.y - last.y) * runtime.canvas.camera.z > 1)
        d.points.push(p);
      const o = pencilPath(d.points, settings.smoothing, settings.strokeWidth);
      $("#draft").innerHTML =
        `<path d="${pathD(o)}" fill="none" stroke="#357e62" stroke-width="${settings.strokeWidth}"/>`;
      editor.draftPanelOverlay(o);
      return;
    }
    if (d.kind === "pan") {
      runtime.canvas.camera.x = d.cam.x + e.clientX - d.x;
      runtime.canvas.camera.y = d.cam.y + e.clientY - d.y;
      editor.cameraRender();
      return;
    }
    if (d.kind === "move") {
      const delta = snapDelta(
        p.x - d.start.x,
        p.y - d.start.y,
        d.b,
        d.ids,
        e.shiftKey,
      );
      editor.applyTransform(translate(delta.dx, delta.dy), d.ids, d.matrices);
      $("#guides").innerHTML = delta.lines
        .map((l) =>
          l.x !== undefined
            ? `<path class="guide" d="M ${l.x} -500 L ${l.x} 1200"/>`
            : `<path class="guide" d="M -500 ${l.y} L 1200 ${l.y}"/>`,
        )
        .join("");
      editor.drawNow();
    }
    if (d.kind === "scale") {
      const b = d.b,
        key = d.key,
        ox = key.includes("w") ? b.x + b.w : b.x,
        oy = key.includes("n") ? b.y + b.h : b.y;
      const hx = key.includes("w") ? b.x : b.x + b.w,
        hy = key.includes("n") ? b.y : b.y + b.h;
      let sx = Math.abs(hx - ox) < 0.001 ? 1 : (p.x - ox) / (hx - ox),
        sy = Math.abs(hy - oy) < 0.001 ? 1 : (p.y - oy) / (hy - oy);
      if (e.shiftKey) {
        const a = Math.abs(sx) > Math.abs(sy) ? sx : sy;
        sx = a;
        sy = a;
      }
      sx = Math.abs(sx) < 0.01 ? 0.01 : sx;
      sy = Math.abs(sy) < 0.01 ? 0.01 : sy;
      editor.applyTransform(around(ox, oy, sx, sy), d.ids, d.matrices);
      editor.drawNow();
    }
    if (d.kind === "rotate") {
      const cx = d.b.x + d.b.w / 2,
        cy = d.b.y + d.b.h / 2;
      let a =
        Math.atan2(p.y - cy, p.x - cx) -
        Math.atan2(d.start.y - cy, d.start.x - cx);
      if (e.shiftKey) a = (Math.round(a / (Math.PI / 12)) * Math.PI) / 12;
      editor.applyTransform(around(cx, cy, 1, 1, a), d.ids, d.matrices);
      editor.drawNow();
    }
    if (d.kind === "segment") {
      const o = editor.objects().find((o) => o.id === d.id),
        q = point(inverse(o.matrix), p),
        dx = (q.x - d.start.x) / (3 * d.t * (1 - d.t)),
        dy = (q.y - d.start.y) / (3 * d.t * (1 - d.t)),
        a = o.nodes[d.index],
        b = o.nodes[(d.index + 1) % o.nodes.length],
        ca = d.a.out || {
          x: d.a.x + (d.b.x - d.a.x) / 3,
          y: d.a.y + (d.b.y - d.a.y) / 3,
        },
        cb = d.b.in || {
          x: d.b.x - (d.b.x - d.a.x) / 3,
          y: d.b.y - (d.b.y - d.a.y) / 3,
        };
      a.out = { x: ca.x + dx, y: ca.y + dy };
      b.in = { x: cb.x + dx, y: cb.y + dy };
      editor.drawNow();
    }
    if (d.kind === "node") {
      const o = editor.objects().find((o) => o.id === d.id);
      if (
        !d.side &&
        o.semanticType === "panelBoundary" &&
        (d.index === 0 || d.index === o.nodes.length - 1)
      )
        Object.assign(p, editor.snapPanelPoint(p, o));
      const q = d.side
          ? handlePoint(o, o.nodes[d.index], point(inverse(o.matrix), p), true)
          : warpPoint(
              o,
              point(inverse(o.matrix), snapNodePosition(p, d.id)),
              true,
            ),
        n = o.nodes[d.index],
        dx = q.x - d.start.x,
        dy = q.y - d.start.y;
      if (d.side) {
        n[d.side] = { x: d.node[d.side].x + dx, y: d.node[d.side].y + dy };
        if (e.shiftKey || n.kind === "symmetric" || n.kind === "smooth") {
          const other = d.side === "in" ? "out" : "in",
            oldLength = d.node[other]
              ? Math.hypot(d.node[other].x - n.x, d.node[other].y - n.y)
              : Math.hypot(n[d.side].x - n.x, n[d.side].y - n.y),
            dx = n[d.side].x - n.x,
            dy = n[d.side].y - n.y,
            len = Math.hypot(dx, dy) || 1,
            ratio = n.kind === "smooth" && !e.shiftKey ? oldLength / len : 1;
          n[other] = { x: n.x - dx * ratio, y: n.y - dy * ratio };
        }
      } else {
        n.x = d.node.x + dx;
        n.y = d.node.y + dy;
        for (const k of ["in", "out"])
          if (d.node[k]) n[k] = { x: d.node[k].x + dx, y: d.node[k].y + dy };
      }
      if (!d.side)
        for (const i of runtime.selection.nodeIndices.filter(
          (i) => i !== d.index,
        )) {
          const base = d.nodes[i],
            target = o.nodes[i];
          target.x = base.x + dx;
          target.y = base.y + dy;
          for (const k of ["in", "out"])
            if (base[k]) target[k] = { x: base[k].x + dx, y: base[k].y + dy };
        }
      if (o.semanticType === "panelBoundary")
        editPanelAnchor(editor.objects(), o);
      editor.drawNow();
    }
    if (d.kind === "bend") {
      const o = editor.objects().find((o) => o.id === d.id),
        q = point(inverse(o.matrix), p),
        m = o.modifiers.find((m) => m.id === d.modId);
      m.amount = Math.max(-100, Math.min(100, d.amount + q.y - d.start.y));
      editor.drawNow();
    }
    if (d.kind === "penHandle") {
      const n = runtime.interaction.pen.nodes[d.index];
      if (
        Math.hypot(p.x - d.start.x, p.y - d.start.y) >
        2 / runtime.canvas.camera.z
      ) {
        n.out = { x: p.x, y: p.y };
        n.in = { x: 2 * n.x - p.x, y: 2 * n.y - p.y };
      }
      drawDraft();
    }
    if (d.kind === "draw" || d.kind === "marquee") {
      if (d.tool === "line") Object.assign(p, editor.snapPanelPoint(p));
      d.p = p;
      let x = Math.min(p.x, d.start.x),
        y = Math.min(p.y, d.start.y),
        w = Math.abs(p.x - d.start.x),
        h = Math.abs(p.y - d.start.y);
      if (e.shiftKey && d.kind === "draw" && d.tool !== "line") {
        w = h = Math.max(w, h);
        x = p.x < d.start.x ? d.start.x - w : d.start.x;
        y = p.y < d.start.y ? d.start.y - h : d.start.y;
        d.p = {
          x: p.x < d.start.x ? x : x + w,
          y: p.y < d.start.y ? y : y + h,
        };
      }
      $("#draft").innerHTML =
        d.kind === "marquee"
          ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#357e6210" stroke="#357e62" stroke-width="${1 / runtime.canvas.camera.z}"/>`
          : d.tool === "line"
            ? `<path d="M ${d.start.x} ${d.start.y} L ${p.x} ${p.y}" stroke="#357e62" stroke-width="1.5"/>`
            : d.tool === "rect"
              ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff88" stroke="#357e62"/>`
              : `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#ffffff88" stroke="#357e62"/>`;
      if (d.tool === "line")
        editor.draftPanelOverlay(
          makePath(
            "Borrador",
            `M ${d.start.x} ${d.start.y} L ${d.p.x} ${d.p.y}`,
          ),
        );
    }
  }

  function pointerUp(e) {
    if (!interactions.allows("canvas", e.pointerId)) return;
    interactions.end("canvas");
    if (!runtime.interaction.drag) return;
    const d = runtime.interaction.drag;
    runtime.interaction.drag = null;
    $("#guides").innerHTML = "";
    $("#draft").innerHTML = "";
    if (professionalPointerUp(e, d)) return;
    if (d.kind === "eraseVector") {
      d.points.push(editor.world(e));
      editor.commit(() => {
        eraseVectorPartial(
          runtime.document.project,
          runtime.document.view,
          d.points,
          runtime.interaction.eraserRadius / runtime.canvas.camera.z,
          {
            eligible: (o) =>
              visible(runtime.document.project, runtime.document.view, o) &&
              !locked(runtime.document.project, runtime.document.view, o) &&
              (!runtime.selection.isolation.length ||
                isolationIds(
                  runtime.document.project,
                  runtime.document.view,
                  runtime.selection.isolation.at(-1),
                ).has(o.id)),
          },
        );
        runtime.selection.selected = runtime.selection.selected.filter((id) =>
          editor.objects().some((o) => o.id === id),
        );
      }, "Borrar parte del trazado");
    } else if (
      d.kind === "move" ||
      d.kind === "scale" ||
      d.kind === "rotate" ||
      d.kind === "node" ||
      d.kind === "segment" ||
      d.kind === "bend"
    ) {
      editor.finishMutation(
        {
          move: "Mover selección",
          scale: "Escalar selección",
          rotate: "Rotar selección",
          node: "Mover nodo / tirador",
          segment: "Editar curva de borde",
          bend: "Curvar pieza",
        }[d.kind],
      );
    } else if (d.kind === "pencil") {
      if (d.points.length >= 2) {
        const o = pencilPath(
          d.points,
          settings.smoothing,
          settings.strokeWidth,
        );
        editor.commit(() => {
          editor.insertObjects([o]);
          runtime.selection.selected = [o.id];
        });
      }
      editor.toolSet("select");
      editor.previewCreatedCut(d.targetBaseId);
    } else if (d.kind === "marquee") {
      const rect = {
          x: Math.min(d.start.x, d.p.x),
          y: Math.min(d.start.y, d.p.y),
          w: Math.abs(d.start.x - d.p.x),
          h: Math.abs(d.start.y - d.p.y),
        },
        ids =
          rect.w + rect.h > 2 / runtime.canvas.camera.z
            ? marqueeHits(
                runtime.document.project,
                runtime.document.view,
                rect,
                runtime.selection.isolation.at(-1),
              )
            : [];
      runtime.selection.selected =
        d.mode === "subtract"
          ? d.base.filter((id) => !ids.includes(id))
          : d.mode === "add"
            ? [...new Set([...d.base, ...ids])]
            : ids;
      runtime.selection.constructionContexts = [];
      runtime.selection.modifierContext = null;
      editor.render();
    } else if (d.kind === "draw") {
      let a = d.start,
        b = d.p || editor.world(e);
      if (e.shiftKey && d.tool === "line") {
        const angle = Math.atan2(b.y - a.y, b.x - a.x),
          len = Math.hypot(b.x - a.x, b.y - a.y),
          snapAngle = (Math.round(angle / (Math.PI / 4)) * Math.PI) / 4;
        b = {
          x: a.x + Math.cos(snapAngle) * len,
          y: a.y + Math.sin(snapAngle) * len,
        };
      }
      const x = Math.min(a.x, b.x),
        y = Math.min(a.y, b.y),
        w = Math.abs(a.x - b.x),
        h = Math.abs(a.y - b.y);
      if (w + h < 3) return;
      let path =
        d.tool === "line"
          ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
          : d.tool === "rect"
            ? `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
            : `M ${x} ${y + h / 2} C ${x} ${y + h * 0.2239} ${x + w * 0.2239} ${y} ${x + w / 2} ${y} C ${x + w * 0.7761} ${y} ${x + w} ${y + h * 0.2239} ${x + w} ${y + h / 2} C ${x + w} ${y + h * 0.7761} ${x + w * 0.7761} ${y + h} ${x + w / 2} ${y + h} C ${x + w * 0.2239} ${y + h} ${x} ${y + h * 0.7761} ${x} ${y + h / 2} Z`;
      const o = makePath(
        d.tool === "line"
          ? "Línea de panel"
          : d.tool === "rect"
            ? "Rectángulo"
            : "Elipse",
        path,
        d.tool === "line" ? "none" : "#fff",
      );
      o.width = settings.strokeWidth;
      editor.commit(() => {
        editor.insertObjects([o]);
        runtime.selection.selected = [o.id];
      });
      editor.toolSet("select");
      editor.previewCreatedCut(d.targetBaseId);
    } else if (d.kind === "penHandle") drawDraft();
    if ($("#canvas").hasPointerCapture(e.pointerId))
      $("#canvas").releasePointerCapture(e.pointerId);
  }

  function drawDraft(cursor) {
    if (!runtime.interaction.pen) return;
    if (runtime.interaction.pen.mode === "curvature")
      runtime.interaction.pen.nodes = curvatureNodes(
        runtime.interaction.pen.nodes,
        runtime.interaction.pen.closed,
      );
    const o = {
      nodes: runtime.interaction.pen.nodes,
      closed: runtime.interaction.pen.closed,
    };
    let s = `<path d="${pathD(o)}" stroke="#357e62" stroke-width="1.5" fill="none"/>`;
    runtime.interaction.pen.nodes.forEach((n) => {
      s += `<circle cx="${n.x}" cy="${n.y}" r="${3 / runtime.canvas.camera.z}" fill="white" stroke="#357e62" stroke-width="${1 / runtime.canvas.camera.z}"/>`;
      if (n.out && n.in)
        s += `<path d="M ${n.in.x} ${n.in.y} L ${n.out.x} ${n.out.y}" stroke="#81a88b" stroke-width="${1 / runtime.canvas.camera.z}"/>`;
    });
    if (cursor && runtime.interaction.pen.nodes.length)
      s += `<path d="M ${runtime.interaction.pen.nodes.at(-1).x} ${runtime.interaction.pen.nodes.at(-1).y} L ${cursor.x} ${cursor.y}" stroke="#81a88b" stroke-dasharray="4 4" fill="none"/>`;
    $("#draft").innerHTML = s;
    if (runtime.interaction.pen.nodes.length >= 2)
      editor.draftPanelOverlay({ ...o, matrix: I(), type: "path" });
  }

  function finishPen() {
    if (!runtime.interaction.pen) return;
    const targetBaseId = runtime.interaction.pen.targetBaseId;
    if (runtime.interaction.pen.nodes.length >= 2) {
      const o = {
        id: uid(),
        type: "path",
        name:
          runtime.interaction.pen.mode === "curvature"
            ? "Trazado curvatura"
            : "Trazado Bézier",
        nodes:
          runtime.interaction.pen.mode === "curvature"
            ? curvatureNodes(
                runtime.interaction.pen.nodes,
                runtime.interaction.pen.closed,
              )
            : clone(runtime.interaction.pen.nodes),
        closed: runtime.interaction.pen.closed,
        matrix: I(),
        fill: runtime.interaction.pen.closed ? "#fff" : "none",
        stroke: "#252a29",
        width: settings.strokeWidth,
        opacity: 1,
      };
      editor.commit(() => {
        editor.insertObjects([o]);
        runtime.selection.selected = [o.id];
      });
    }
    runtime.interaction.pen = null;
    $("#draft").innerHTML = "";
    editor.previewCreatedCut(targetBaseId);
  }

  function cancelAction() {
    editor.cancelPanelEdges();
    interactions.end("canvas");
    runtime.panels.panelPreview = null;
    $("#panel-preview").classList.add("hidden");
    runtime.services.workspace.show("color", false);
    runtime.appearance.colorHover = null;
    if (runtime.interaction.drag?.before) {
      runtime.document.project = runtime.interaction.drag.before;
      editor.render();
    }
    runtime.interaction.drag = null;
    runtime.interaction.pen = null;
    $("#draft").innerHTML = "";
    $("#guides").innerHTML = "";
    editor.closeContext();
  }

  function addNodeAt(e) {
    const o = editor.one();
    if (runtime.interaction.tool !== "node" || o?.type !== "path") return;
    const p = warpPoint(o, point(inverse(o.matrix), editor.world(e)), true),
      local = { ...o, matrix: I(), modifiers: [], component: undefined },
      hit = nearestPathPoint(local, p);
    if (
      !hit ||
      hit.subpath ||
      Math.hypot(o.matrix[0], o.matrix[1]) * hit.distance >
        7 / runtime.canvas.camera.z
    )
      return;
    editor.commit(() => {
      runtime.selection.nodeIndex = addSymmetricNode(
        o,
        hit.index,
        hit.t,
        runtime.document.project.liveMirror,
      );
      runtime.selection.nodeIndices = [runtime.selection.nodeIndex];
    }, "Agregar nodo");
  }

  function legacyKeyboard(e) {
    if ($("#editor").classList.contains("hidden") || $("#modal").open) return;
    if (
      e.key === "Escape" &&
      !$("#appearance-popover").classList.contains("hidden")
    ) {
      e.preventDefault();
      editor.closeAppearance();
      $("#quick-theme").focus();
      return;
    }
    const inField =
      /INPUT|TEXTAREA|SELECT|SP-TEXTFIELD|SP-NUMBER-FIELD|SP-PICKER/.test(
        e.target.tagName,
      ) || e.target.isContentEditable;
    if (inField) return;
    const cmd = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    if (key === "control" || key === "meta") {
      runtime.interaction.temporarySelect = true;
      return;
    }
    if (cmd) {
      if (key === "k") {
        e.preventDefault();
        editor.commandPalette();
        return;
      }
      if (key === "i" && e.shiftKey) {
        e.preventDefault();
        editor.toolSet("image");
        return;
      }
      const handled = [
        "z",
        "y",
        "s",
        "a",
        "c",
        "v",
        "x",
        "d",
        "g",
        "+",
        "=",
        "-",
        "0",
      ];
      if (!handled.includes(key)) return;
      e.preventDefault();
      if (key === "z") e.shiftKey ? editor.redo() : editor.undo();
      if (key === "y") editor.redo();
      if (key === "s") editor.save();
      if (key === "a") {
        runtime.selection.selected = editor
          .objects()
          .filter((o) => !o.locked && !o.hidden)
          .map((o) => o.id);
        editor.render();
      }
      if (key === "c" || key === "x") {
        const ids = graphIds(editor.objects(), runtime.selection.selected);
        runtime.selection.clipboard = clone(
          editor.objects().filter((o) => ids.includes(o.id)),
        );
        runtime.selection.clipboardGroups = clone(
          runtime.document.project.groups[runtime.document.view],
        );
        if (key === "x") editor.removeSelected();
      }
      if (key === "v" && runtime.selection.clipboard.length) {
        editor.commit(() => {
          const { originals, copies } = cloneGraph(
            runtime.selection.clipboard,
            runtime.selection.clipboard.map((o) => o.id),
            15,
            15,
          );
          const gs = runtime.document.project.groups[runtime.document.view];
          runtime.document.project.groups[runtime.document.view] = clone(
            runtime.selection.clipboardGroups,
          );
          copyGroupMetadata(
            runtime.document.project,
            runtime.document.view,
            originals,
            copies,
          );
          const added = runtime.document.project.groups[
            runtime.document.view
          ].filter(
            (g) =>
              !runtime.selection.clipboardGroups.some((o) => o.id === g.id),
          );
          runtime.document.project.groups[runtime.document.view] = [
            ...gs,
            ...added,
          ];
          editor.insertObjects(copies);
          runtime.selection.selected = copies
            .filter((o) => !o.hidden)
            .map((o) => o.id);
        }, "Pegar construcción");
      }
      if (key === "d") editor.duplicate();
      if (key === "g") e.shiftKey ? editor.ungroup() : editor.group();
      if (key === "+" || key === "=") editor.zoom(1.2);
      if (key === "-") editor.zoom(1 / 1.2);
      if (key === "0") editor.fit();
      return;
    }
    if (key === " ") {
      if (e.target?.tagName !== "SVG" && !e.target?.closest?.("#canvas"))
        return;
      e.preventDefault();
      runtime.interaction.space = true;
      $("#canvas").style.cursor = "grab";
      return;
    }
    if (key === "escape") {
      e.preventDefault();
      if (runtime.panels.panelPreview) {
        runtime.panels.panelPreview = null;
        $("#panel-preview").classList.add("hidden");
        $("#draft").innerHTML = "";
        return;
      }
      if (!$("#color-palette").classList.contains("hidden")) {
        runtime.services.workspace.show("color", false);
        return;
      }
      cancelAction();
      if (!$("#history-palette").classList.contains("hidden")) {
        $("#history-palette").classList.add("hidden");
        $("#history-button").setAttribute("aria-expanded", "false");
        return;
      }
      if (!$("#variants-popover").classList.contains("hidden")) {
        $("#variants-popover").classList.add("hidden");
        return;
      }
      if (editor.activeConstructionRefs().length) {
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
        runtime.selection.selected = editor
          .chosen()
          .map((o) => o.source || o.id);
        runtime.workspace.paletteClosedKey = null;
      } else if (
        runtime.interaction.pendingFinish ||
        runtime.interaction.pendingStack ||
        !$("#edge-confirm").classList.contains("hidden")
      ) {
        runtime.interaction.pendingFinish = null;
        runtime.interaction.pendingStack = null;
        runtime.selection.edgeIds = [];
        runtime.selection.rangeSelections = {};
        $("#edge-confirm").classList.add("hidden");
        editor.toolSet("select");
      } else if (
        runtime.interaction.tool === "node" &&
        (runtime.interaction.editMode === "edges" ||
          runtime.selection.nodeIndices.length)
      ) {
        runtime.interaction.editMode = "nodes";
        runtime.selection.edgeIds = [];
        runtime.selection.nodeIndices = [];
        editor.toolSet("select");
      } else if (
        runtime.selection.isolation.length &&
        runtime.selection.selected.length
      ) {
        runtime.selection.selected = [];
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
      } else if (runtime.selection.isolation.length) {
        runtime.selection.isolation.pop();
        runtime.selection.editingGroup =
          runtime.selection.isolation.at(-1) || null;
        runtime.selection.selected = [];
        editor.toolSet("select");
      } else if (runtime.interaction.tool === "node") {
        editor.toolSet("select");
        runtime.selection.nodeIndices = [];
      } else if (runtime.selection.editingGroup) {
        runtime.selection.editingGroup = null;
        runtime.selection.selected = [];
      } else {
        runtime.selection.selected = [];
        runtime.selection.nodeIndex = -1;
        runtime.selection.nodeIndices = [];
      }
      editor.render();
      return;
    }
    if (key === "enter" && runtime.interaction.pen) {
      e.preventDefault();
      finishPen();
      return;
    }
    if (key === "delete" || key === "backspace") {
      e.preventDefault();
      if (runtime.interaction.pen) {
        runtime.interaction.pen.nodes.pop();
        drawDraft();
        return;
      }
      if (
        runtime.interaction.tool === "node" &&
        runtime.selection.nodeIndex >= 0
      )
        editor.action("deleteNode");
      else editor.removeSelected();
      return;
    }
    const mapping = {
      u: "curvature",
      m: "measure",
      k: "scissors",
      f: "fill",
      i: "eyedropper",
      v: "select",
      e: "eraser",
      a: "node",
      b: "edge",
      n: "pencil",
      p: "pen",
      l: "line",
      r: "rect",
      o: "ellipse",
      t: "text",
    };
    if (mapping[key]) {
      e.preventDefault();
      editor.toolSet(mapping[key]);
      return;
    }
    if (
      ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key) &&
      runtime.selection.selected.length
    ) {
      e.preventDefault();
      const n = e.shiftKey ? 10 : 1,
        dx = key === "arrowleft" ? -n : key === "arrowright" ? n : 0,
        dy = key === "arrowup" ? -n : key === "arrowdown" ? n : 0;
      if (
        runtime.interaction.tool === "node" &&
        runtime.selection.nodeIndices.length &&
        editor.one()?.type === "path"
      ) {
        const o = editor.one();
        editor.commit(() => {
          const delta = point(inverse(o.matrix), { x: dx, y: dy }),
            zero = point(inverse(o.matrix), { x: 0, y: 0 });
          for (const i of runtime.selection.nodeIndices) {
            const node = o.nodes[i];
            for (const p of [node, node.in, node.out].filter(Boolean)) {
              p.x += delta.x - zero.x;
              p.y += delta.y - zero.y;
            }
          }
        });
      } else editor.commit(() => editor.applyTransform(translate(dx, dy)));
    }
  }

  function snapNodePosition(p, id) {
    if (!runtime.canvas.snap) return p;
    const targets = runtime.interaction.drag
        ? (runtime.interaction.drag.snapTargets ??= collectSnapTargets(
            runtime.document.project,
            runtime.document.view,
            [id],
            settings,
          ))
        : collectSnapTargets(
            runtime.document.project,
            runtime.document.view,
            [id],
            settings,
          ),
      q = snapPoint(
        p,
        targets,
        settings.snapThreshold / runtime.canvas.camera.z,
      );
    $("#guides").innerHTML =
      q.lines
        .map((l) =>
          l.x !== undefined
            ? `<path class="guide" d="M ${l.x} -100 L ${l.x} 1200"/>`
            : `<path class="guide" d="M -100 ${l.y} L 1200 ${l.y}"/>`,
        )
        .join("") +
      (q.label
        ? `<circle cx="${q.x}" cy="${q.y}" r="${3 / runtime.canvas.camera.z}" fill="white" stroke="#357e62" stroke-width="${1 / runtime.canvas.camera.z}"/><text x="${q.x + 8 / runtime.canvas.camera.z}" y="${q.y - 8 / runtime.canvas.camera.z}" font-size="${11 / runtime.canvas.camera.z}" fill="#357e62">${q.label}</text>`
        : "");
    return { x: q.x, y: q.y };
  }

  function keyboard(e) {
    if (e.defaultPrevented) return false;
    if (
      e.target?.closest?.(
        "sp-menu,sp-action-menu,sp-picker,sp-tabs,.dv-tabs-and-actions-container",
      ) &&
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "Enter",
        " ",
      ].includes(e.key)
    )
      return false;
    if ($("#modal").open) return false;
    if (
      runtime.panels.panelEdgeState &&
      !/INPUT|TEXTAREA|SELECT|SP-TEXTFIELD|SP-NUMBER-FIELD|SP-PICKER/.test(
        e.target?.tagName,
      ) &&
      !e.target?.isContentEditable
    ) {
      if (e.key === "Escape") {
        e.preventDefault();
        editor.cancelPanelEdges();
        editor.render();
        return true;
      }
      if (
        e.key === "Enter" &&
        ![
          "BUTTON",
          "SUMMARY",
          "SP-BUTTON",
          "SP-ACTION-BUTTON",
          "SP-MENU-ITEM",
        ].includes(e.target?.tagName)
      ) {
        e.preventDefault();
        editor.confirmEdgePanel();
        return true;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        editor.clearPanelEdges();
        return true;
      }
    }
    if (
      e.key === "Escape" &&
      (runtime.workspace.pathfinderOpen ||
        $$(".tool-flyout[open],.ux-menu[open]").length)
    ) {
      for (const detail of $$(".tool-flyout[open],.ux-menu[open]"))
        detail.open = false;
      $("#pathfinder-popover").classList.add("hidden");
      runtime.workspace.pathfinderOpen = false;
      $("#canvas").focus();
      e.preventDefault();
      return true;
    }
    if (
      [
        "BUTTON",
        "SUMMARY",
        "SP-BUTTON",
        "SP-ACTION-BUTTON",
        "SP-MENU-ITEM",
      ].includes(e.target?.tagName) &&
      [" ", "Enter"].includes(e.key)
    )
      return false;
    return routeShortcut(e, {
      modal: $("#modal").open,
      operation: !!runtime.interaction.drag || runtime.services.preview.active,
      undo: editor.undo,
      redo: editor.redo,
      cancel: () => {
        if (interactions.cancel()) return true;
        if (runtime.services.preview.active) {
          const label = runtime.services.preview.label;
          runtime.services.preview.cancel();
          if (label?.includes("textura")) editor.showFabricPalette();
          else if (label?.includes("construcción"))
            editor.renderConstructionPalette(true);
          else editor.showColorPalette();
          return true;
        }
        if (
          runtime.selection.selectedGroup &&
          !runtime.selection.selected.length
        ) {
          runtime.selection.selectedGroup = null;
          return true;
        }
        if (!$("#fabric-palette").classList.contains("hidden")) {
          $("#fabric-palette").classList.add("hidden");
          return true;
        }
        return false;
      },
      documentKey: legacyKeyboard,
    });
  }

  function setEraserMode(mode) {
    runtime.interaction.eraserMode =
      mode === "vector" ? "vector" : "construction";
    runtime.interaction.eraserHover = null;
    editor.contextBar();
    editor.updateHint();
    editor.drawSelection();
  }

  function claimToolDrag(e, d) {
    runtime.interaction.drag = d;
    interactions.begin("canvas", "TOOL_DRAW", e.pointerId, cancelAction);
    $("#canvas").focus({ preventScroll: true });
    $("#canvas").setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function professionalPointerDown(e) {
    const p = editor.world(e);
    if (runtime.interaction.tool === "shapeBuilder") {
      const face = editor.shapeBuilderFace(p);
      if (face)
        editor.commit(
          () => {
            const existing = editor
              .objects()
              .find((o) => o.regionKey === face.regionKey);
            if (e.altKey) {
              if (existing)
                runtime.document.project.views[runtime.document.view] = editor
                  .objects()
                  .filter((o) => o !== existing);
            } else if (existing)
              existing.fill = runtime.document.project.colors.fill;
            else {
              const result = clone(face);
              result.id = uid();
              result.fill = runtime.document.project.colors.fill || "#ffffff";
              editor.insertObjects([result]);
            }
          },
          e.altKey ? "Quitar región construida" : "Construir región de prenda",
        );
      return true;
    }
    if (runtime.interaction.tool === "scissors") {
      const targets = (
          runtime.selection.selected.length ? editor.chosen() : editor.objects()
        ).filter(
          (o) =>
            editor.editableStandalone(o) &&
            !o.closed &&
            !o.symmetry &&
            visible(runtime.document.project, runtime.document.view, o) &&
            !locked(runtime.document.project, runtime.document.view, o) &&
            (!runtime.selection.isolation.length ||
              isolationIds(
                runtime.document.project,
                runtime.document.view,
                runtime.selection.isolation.at(-1),
              ).has(o.id)),
        ),
        hits = targets
          .map((o) => ({ o, hit: nearestPathPoint(o, p) }))
          .filter((x) => x.hit?.distance <= 6 / runtime.canvas.camera.z)
          .sort((a, b) => a.hit.distance - b.hit.distance);
      if (hits.length)
        try {
          editor.commit(() => {
            const part = scissorsAt(hits[0].o, p, 6 / runtime.canvas.camera.z);
            if (part) {
              editor.insertObjects([part]);
              runtime.selection.selected = [hits[0].o.id, part.id];
            }
          }, "Cortar trazado con tijeras");
        } catch (err) {
          if ($("#modal").open) editor.dialogError(err.message);
          else editor.toast(err.message);
        }
      else
        editor.status(
          "Tijeras: elegí un trazado abierto independiente. Para una prenda usá Corte de panel.",
        );
      return true;
    }
    if (runtime.interaction.tool === "measure") {
      claimToolDrag(e, {
        kind: "measure",
        start: snapNodePosition(p, null),
        p,
      });
      return true;
    }
    if (runtime.interaction.tool === "gradient") {
      const end = e.target.closest("[data-gradient-end]");
      if (end && editor.one()?.gradient) {
        claimToolDrag(e, {
          kind: "gradientEndpoint",
          id: editor.one().id,
          end: Number(end.dataset.gradientEnd),
          before: clone(runtime.document.project),
        });
        return true;
      }
      const target =
        editor.chosen().find((o) => o.type === "path") ||
        editor.colorTarget(p, true);
      if (!target || target.type !== "path") {
        editor.toast("Seleccioná una forma para editar su degradado");
        return true;
      }
      runtime.selection.selected = [target.id];
      claimToolDrag(e, {
        kind: "gradient",
        id: target.id,
        start: p,
        p,
        before: clone(runtime.document.project),
      });
      return true;
    }
    if (runtime.interaction.tool === "lineCut") {
      claimToolDrag(e, {
        kind: "lineCut",
        start: editor.snapPanelPoint(p),
        p,
        targetBaseId: editor.chosen().find((o) => o.closed && !o.panelOf)?.id,
      });
      return true;
    }
    if (runtime.interaction.tool === "curvature" && runtime.interaction.pen) {
      const index = runtime.interaction.pen.nodes.findIndex(
        (q) => Math.hypot(q.x - p.x, q.y - p.y) < 7 / runtime.canvas.camera.z,
      );
      if (index >= 0 && e.altKey) {
        runtime.interaction.pen.nodes[index].corner =
          !runtime.interaction.pen.nodes[index].corner;
        drawDraft();
        return true;
      }
    }
    return false;
  }

  function professionalPointerMove(e, p, d) {
    if (d.kind === "gradientEndpoint") {
      const o = editor.objects().find((o) => o.id === d.id),
        b = localBox(o),
        v = point(inverse(o.matrix), p),
        g = o.gradient;
      g[d.end ? "x2" : "x1"] = (v.x - b.x) / (b.w || 1);
      g[d.end ? "y2" : "y1"] = (v.y - b.y) / (b.h || 1);
      d.moved = true;
      editor.drawNow();
      return true;
    }
    if (d.kind === "curvaturePoint") {
      runtime.interaction.pen.nodes[d.index].x = p.x;
      runtime.interaction.pen.nodes[d.index].y = p.y;
      drawDraft();
      return true;
    }
    if (d.kind === "measure" || d.kind === "lineCut") {
      d.p = e.shiftKey ? constrainAngle(d.start, p) : snapNodePosition(p, null);
      $("#draft").innerHTML =
        `<path d="M ${d.start.x} ${d.start.y} L ${d.p.x} ${d.p.y}" fill="none" stroke="#357e62" stroke-width="${1.5 / runtime.canvas.camera.z}"/>`;
      if (d.kind === "measure") showMeasurement(d.start, d.p);
      return true;
    }
    if (d.kind === "gradient") {
      d.p = e.shiftKey ? constrainAngle(d.start, p) : p;
      const o = editor.objects().find((o) => o.id === d.id),
        b = localBox(o),
        a = point(inverse(o.matrix), d.start),
        q = point(inverse(o.matrix), d.p);
      o.gradient ??= linearGradient(o);
      Object.assign(o.gradient, {
        x1: (a.x - b.x) / (b.w || 1),
        y1: (a.y - b.y) / (b.h || 1),
        x2: (q.x - b.x) / (b.w || 1),
        y2: (q.y - b.y) / (b.h || 1),
      });
      editor.drawNow();
      $("#draft").innerHTML =
        `<path d="M ${d.start.x} ${d.start.y} L ${d.p.x} ${d.p.y}" stroke="#357e62" stroke-width="${1 / runtime.canvas.camera.z}"/><circle cx="${d.start.x}" cy="${d.start.y}" r="${4 / runtime.canvas.camera.z}" fill="white" stroke="#357e62"/><circle cx="${d.p.x}" cy="${d.p.y}" r="${4 / runtime.canvas.camera.z}" fill="#357e62"/>`;
      return true;
    }
    return false;
  }

  function showMeasurement(a, b) {
    const m = measurePoints(a, b),
      unit = settings.units === "mm" ? "mm" : "px",
      factor = unit === "mm" ? 25.4 / 96 : 1;
    const text = `Distancia ${(m.distance * factor).toFixed(2)} ${unit} · ${m.angle.toFixed(1)}° · ΔX ${(m.dx * factor).toFixed(1)} · ΔY ${(m.dy * factor).toFixed(1)}`;
    editor.status(text);
    $("#measure-value").textContent = text;
  }

  function professionalPointerUp(e, d) {
    if (
      ![
        "measure",
        "gradient",
        "gradientEndpoint",
        "lineCut",
        "curvaturePoint",
      ].includes(d.kind)
    )
      return false;
    if ($("#canvas").hasPointerCapture(e.pointerId))
      $("#canvas").releasePointerCapture(e.pointerId);
    if (d.kind === "measure") {
      const p = d.p || editor.world(e);
      showMeasurement(d.start, p);
      $("#draft").innerHTML =
        `<path d="M ${d.start.x} ${d.start.y} L ${p.x} ${p.y}" stroke="#357e62" stroke-width="${1.5 / runtime.canvas.camera.z}"/>`;
    }
    if (d.kind === "gradientEndpoint" && d.moved)
      editor.finishMutation("Mover extremo de degradado");
    if (d.kind === "gradient") {
      if (
        !d.p ||
        Math.hypot(d.p.x - d.start.x, d.p.y - d.start.y) *
          runtime.canvas.camera.z <
          3
      ) {
        runtime.document.project = d.before;
        editor.render();
      } else editor.finishMutation("Editar degradado");
    }
    if (
      d.kind === "lineCut" &&
      Math.hypot(d.p.x - d.start.x, d.p.y - d.start.y) *
        runtime.canvas.camera.z >=
        3
    ) {
      const o = makePath(
        "Corte de panel",
        `M ${d.start.x} ${d.start.y} L ${d.p.x} ${d.p.y}`,
      );
      editor.commit(() => {
        editor.insertObjects([o]);
        runtime.selection.selected = [o.id];
      }, "Dibujar corte de panel");
      editor.beginPanelPreview(d.targetBaseId);
    }
    if (d.kind === "curvaturePoint") drawDraft();
    return true;
  }
  return {
    pointerDown,
    pointerMove,
    pointerUp,
    finishPen,
    cancelAction,
    addNodeAt,
    keyboard,
    setEraserMode,
  };
}
