import { screenToDocument } from "../precision.js";
import { paintState, paintCss } from "../paint-state.js";
import { toolbarHtml, rememberTool, toolCursor } from "../ux-tools.js";
import { planarRegions } from "../planar-regions.js";
import { nearestPathPoint } from "../vector-edit.js";
import { orderedObjects } from "../layers.js";
import { resolvePanelCut } from "../panel-cut.js";
import { resolveMirrorChanges } from "../mirror-service.js";
import { documentBackground } from "../document.js";
import { refreshPanels, panelBoundary } from "../panels.js";
import { uiIcon } from "../ui-icons.js";
import { toolInfo } from "../tool-learning.js";
import { resolveRef } from "../construction-system.js";
import { ensureEdges, edgeHighlight } from "../edges.js";
import { visible, locked, isolationIds } from "../model.js";
import { hitGeometry, selectionBounds, visibleBounds } from "../hit.js";
import { settings } from "../preferences.js";
import {
  clone,
  point,
  pathD,
  bounds,
  union,
  evaluatedPath,
  worldPath,
  warpPoint,
  handlePoint,
  localBox,
} from "../core.js";
import { garmentNames } from "../templates.js";
import { objectSvg, definitions } from "../render.js";
import { effectParts } from "../effects.js";
import { $, $$ } from "./ui.js";

// canvas: editor controller; geometry and document services remain authoritative.
export function createCanvasController(runtime, editor) {
  function renderToolbar() {
    $("#tools").innerHTML = toolbarHtml(runtime.canvas.toolMemory);
    syncPaintUI();
  }

  function activeTool() {
    return runtime.interaction.tool === "node" &&
      runtime.interaction.editMode === "edges"
      ? "edge"
      : runtime.interaction.tool;
  }

  function updateToolUI() {
    rememberTool(
      runtime.canvas.toolMemory,
      activeTool(),
      globalThis.localStorage,
    );
    renderToolbar();
    $$("[data-tool]").forEach((b) => {
      const active = b.dataset.tool === activeTool();
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  function cameraRender() {
    $("#camera").setAttribute(
      "transform",
      `translate(${runtime.canvas.camera.x} ${runtime.canvas.camera.y}) scale(${runtime.canvas.camera.z})`,
    );
    $("#zoom").textContent = Math.round(runtime.canvas.camera.z * 100) + "%";
  }

  function fit() {
    const r = $("#canvas").getBoundingClientRect();
    const d = runtime.document.project.document;
    runtime.canvas.camera.z = Math.min(
      (r.width - 70) / d.widthPx,
      (r.height - 65) / d.heightPx,
    );
    runtime.canvas.camera.z = Math.max(0.12, runtime.canvas.camera.z);
    runtime.canvas.camera.x =
      (r.width -
        runtime.document.project.document.widthPx * runtime.canvas.camera.z) /
      2;
    runtime.canvas.camera.y =
      (r.height -
        runtime.document.project.document.heightPx * runtime.canvas.camera.z) /
      2;
    cameraRender();
    runtime.canvas.zoomInitialized = true;
    drawSelection();
    editor.resizePanelEdgeTolerance();
  }

  function zoom(factor, client) {
    const r = $("#canvas").getBoundingClientRect(),
      p = client
        ? { x: client.x - r.left, y: client.y - r.top }
        : { x: r.width / 2, y: r.height / 2 },
      z = Math.max(0.08, Math.min(12, runtime.canvas.camera.z * factor));
    runtime.canvas.camera.x =
      p.x - ((p.x - runtime.canvas.camera.x) * z) / runtime.canvas.camera.z;
    runtime.canvas.camera.y =
      p.y - ((p.y - runtime.canvas.camera.y) * z) / runtime.canvas.camera.z;
    runtime.canvas.camera.z = z;
    cameraRender();
    drawSelection();
    editor.resizePanelEdgeTolerance();
  }

  function world(e) {
    return screenToDocument(
      { x: e.clientX, y: e.clientY },
      runtime.canvas.camera,
      $("#canvas").getBoundingClientRect(),
    );
  }

  function toolSet(t) {
    if (runtime.panels.panelEdgeState) editor.cancelPanelEdges(false);
    if (runtime.panels.panelPreview) {
      runtime.panels.panelPreview = null;
      $("#panel-preview").classList.add("hidden");
      $("#draft").innerHTML = "";
    }
    $("#tool-feedback").innerHTML = "";
    if (t !== "shapeBuilder") runtime.interaction.shapeBuilderState = null;
    if (t === "shapeBuilder") {
      try {
        const ids = editor
          .chosen()
          .filter((o) => o.type === "path")
          .map((o) => o.id);
        if (!ids.length) {
          editor.toast("Seleccioná los trazados para construir regiones");
          return;
        }
        runtime.interaction.shapeBuilderState = {
          ids,
          faces: planarRegions(
            editor.chosen().filter((o) => ids.includes(o.id)),
          ),
          signature: JSON.stringify(
            editor.chosen().filter((o) => ids.includes(o.id)),
          ),
        };
      } catch (error) {
        editor.toast(error.message);
        return;
      }
    }
    if (runtime.interaction.drag) {
      editor.cancelAction();
    }
    if (runtime.services.preview.active) runtime.services.preview.finish();
    if (t === "fabric") {
      runtime.interaction.tool = "fabric";
      updateToolUI();
      editor.showFabricPalette();
      editor.contextBar();
      return;
    }
    const edge = t === "edge";
    if (edge) t = "node";
    if (t === "image") {
      $("#image-input").click();
      return;
    }
    if (t === "fill") runtime.document.project.colors.target = "fill";
    if (runtime.interaction.pen) editor.finishPen();
    if (t === "node" && editor.one()?.source)
      editor.selectId(editor.one().source, false, true);
    if (t === "node" && editor.one()?.semanticType === "region") {
      const boundary = panelBoundary(editor.objects(), editor.one());
      if (boundary) editor.selectId(boundary.id, false, true);
    }
    if (t === "node" && editor.one()?.component) {
      editor.commit(() => {
        editor.one().nodes = clone(evaluatedPath(editor.one()).nodes);
        delete editor.one().component;
        ensureEdges(editor.one());
      });
    }
    runtime.interaction.tool = t;
    if (t === "node") runtime.interaction.editMode = edge ? "edges" : "nodes";
    if (t !== "node") {
      runtime.interaction.editMode = "nodes";
      runtime.selection.edgeIds = [];
      runtime.interaction.pendingFinish = null;
    }
    runtime.selection.modifierContext = null;
    runtime.selection.constructionContexts = [];
    runtime.interaction.eraserHover = null;
    runtime.selection.nodeIndex = -1;
    runtime.selection.nodeIndices = [];
    updateToolUI();
    $("#canvas").style.cursor = toolCursor[activeTool()] || "crosshair";
    drawSelection();
    editor.properties();
    editor.contextBar();
    updateHint();
    editor.renderConstructionPalette();
    if (t === "fill" || t === "eyedropper") editor.showColorPalette();
    else $("#color-palette").classList.add("hidden");
    $("#canvas").focus({ preventScroll: true });
  }

  function updateHint() {
    if (runtime.panels.panelEdgeState) {
      $("#hint").textContent = editor.panelEdgeInstruction();
      return;
    }
    const hints = {
      fill: "F · Aplicar relleno a piezas y paneles cerrados",
      eyedropper: "I · Tomar color vectorial · después F para aplicar",
      select: "V · Seleccionar  /  Espacio · Mover lienzo",
      node:
        runtime.interaction.editMode === "edges"
          ? "Elegí bordes · Shift suma / Alt quita · Escape sube un nivel"
          : "A · Nodos / Ctrl arrastrar: mover pieza / Doble clic: añadir nodo",
      pencil: "N · Dibujá a mano alzada / Suavizado en la barra superior",
      pen: "Clic + arrastrar · Curva  /  Enter · Terminar  /  Esc · Cancelar",
      line: "Arrastrá para dibujar una línea",
      rect: "R · Arrastrá para dibujar / Medidas en el inspector",
      ellipse: "O · Arrastrá para dibujar / Medidas en el inspector",
      text: "Clic en el lienzo para agregar texto",
      eraser:
        runtime.interaction.eraserMode === "vector"
          ? "E · Arrastrar: borrar partes de segmentos vectoriales · estructura protegida"
          : "E · Clic: borrar construcción · geometría de base intacta",
    };
    const o = editor.one(),
      base =
        o?.semanticType === "panelBoundary" &&
        editor.objects().find((x) => x.id === o.panelOf),
      state =
        base && runtime.interaction.tool === "node"
          ? resolvePanelCut(base, o)
          : null;
    $("#hint").textContent =
      state && !state.valid
        ? state.diagnostics.message
        : hints[runtime.interaction.tool] ||
          toolInfo[runtime.interaction.tool]?.description ||
          "";
  }

  function render() {
    if (!runtime.document.project) return;
    updateArtboard();
    const os = editor.objects();
    axisRender();
    $("#art").innerHTML = renderArt(os);
    $("#project-name").value = runtime.document.project.name;
    $("#canvas-title").textContent =
      (garmentNames[runtime.document.project.kind] || "DISEÑO").toUpperCase() +
      " / " +
      (runtime.document.view === "front" ? "FRENTE" : "ESPALDA");
    $$("[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === runtime.document.view),
    );
    updateToolUI();
    $("#undo").disabled = !runtime.document.history.past.length;
    $("#redo").disabled = !runtime.document.history.future.length;
    $("#gridrect").style.display = runtime.canvas.grid ? "" : "none";
    $("#object-count").textContent =
      os.filter((o) => !o.hidden).length +
      " objetos · " +
      (runtime.selection.selected.length || "Sin") +
      " seleccionados";
    drawSelection();
    editor.library();
    editor.properties();
    editor.contextBar();
    updateHint();
    editor.renderConstructionPalette();
    editor.renderHistory();
    if (runtime.panels.panelEdgeState) editor.refreshPanelEdgeOperation();
  }

  function drawSelection() {
    if (runtime.panels.panelEdgeState) {
      $("#selection").innerHTML = "";
      return;
    }
    const os = editor.chosen(),
      all = editor.objects(),
      z = runtime.canvas.camera.z;
    let content = "";
    axisRender();
    if (
      os.length &&
      runtime.interaction.tool === "node" &&
      editor.one()?.type === "path"
    ) {
      const o = editor.one(),
        m = o.matrix;
      content = `<path d="${pathD(evaluatedPath(o))}" transform="matrix(${m.join(" ")})" fill="none" stroke="#357e62" stroke-width="1.2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      o.nodes.forEach((n, i) => {
        const p = point(m, warpPoint(o, n));
        for (const side of ["in", "out"])
          if (n[side] && settings.handles) {
            const h = point(m, handlePoint(o, n, n[side]));
            content += `<path d="M ${p.x} ${p.y} L ${h.x} ${h.y}" stroke="#79a88b" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/><circle class="handle-hit" data-node="${i}" data-side="${side}" cx="${h.x}" cy="${h.y}" r="${7 / z}" fill="transparent" stroke="none"/><circle class="bez ${runtime.interaction.drag?.kind === "node" && runtime.interaction.drag.index === i && runtime.interaction.drag.side === side ? "active" : ""}" data-node="${i}" data-side="${side}" cx="${h.x}" cy="${h.y}" r="${(settings.nodeSize * 0.46) / z}"/>`;
          }
        content += `<circle class="anchor-hit" data-node="${i}" cx="${p.x}" cy="${p.y}" r="${7 / z}" fill="transparent" stroke="none"/><rect class="node ${runtime.selection.nodeIndices.includes(i) ? "active" : ""}" data-node="${i}" x="${p.x - settings.nodeSize / 2 / z}" y="${p.y - settings.nodeSize / 2 / z}" width="${settings.nodeSize / z}" height="${settings.nodeSize / z}"/>`;
      });
    } else if (os.length) {
      const b = selectionBounds(os, all) || union(os, all);
      content = `<rect class="selbox" x="${b.x}" y="${b.y}" width="${Math.max(b.w, 0.1)}" height="${Math.max(b.h, 0.1)}"/>`;
      for (const [key, x, y] of [
        ["nw", b.x, b.y],
        ["ne", b.x + b.w, b.y],
        ["sw", b.x, b.y + b.h],
        ["se", b.x + b.w, b.y + b.h],
      ])
        content += `<rect class="handle" data-handle="${key}" x="${x - 4 / z}" y="${y - 4 / z}" width="${8 / z}" height="${8 / z}"/>`;
      const cx = b.x + b.w / 2,
        cy = b.y - 22 / z;
      content += `<path d="M ${cx} ${b.y} L ${cx} ${cy}" stroke="#357e62" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/><circle class="handle rotate-handle" data-handle="rotate" cx="${cx}" cy="${cy}" r="${4 / z}"/>`;
    }
    const bend = editor
      .one()
      ?.modifiers?.find((m) => m.type === "bend" && m.enabled !== false);
    if (bend && editor.one()?.type === "path") {
      const o = editor.one(),
        b = localBox(o),
        p = point(
          o.matrix,
          warpPoint(o, { x: b.x + b.w / 2, y: b.y + b.h / 2 }),
        );
      content += `<circle class="bend-handle" data-bend="${bend.id}" cx="${p.x}" cy="${p.y}" r="${5 / runtime.canvas.camera.z}"/><text x="${p.x + 9 / runtime.canvas.camera.z}" y="${p.y - 8 / runtime.canvas.camera.z}" font-size="${9 / runtime.canvas.camera.z}" fill="#27634b" pointer-events="none">Curvar</text>`;
    }
    if (editor.one()?.type === "path" && runtime.interaction.tool === "node") {
      const o = editor.one(),
        b = bounds(o),
        cx = b.x + b.w / 2,
        cy = b.y - 22 / z;
      content += `<g class="object-move-control" data-handle="move"><circle cx="${cx}" cy="${cy}" r="${7 / z}"/><path d="M ${cx - 4 / z} ${cy} L ${cx + 4 / z} ${cy} M ${cx} ${cy - 4 / z} L ${cx} ${cy + 4 / z}" pointer-events="none"/><title>Mover pieza completa · Ctrl arrastrar</title></g>`;
      if (runtime.selection.edgeIds.length)
        content += `<path class="edge-selected" d="${edgeHighlight(o, runtime.selection.edgeIds)}"/>`;
      if (
        runtime.selection.hoverEdge &&
        runtime.interaction.editMode === "edges" &&
        !runtime.selection.edgeIds.includes(runtime.selection.hoverEdge)
      )
        content += `<path class="edge-hover" d="${edgeHighlight(o, [runtime.selection.hoverEdge])}"/>`;
    }
    for (const ref of runtime.interaction.eraserHover
      ? [runtime.interaction.eraserHover]
      : editor.activeConstructionRefs()) {
      const { owner, value } = resolveRef(all, ref);
      if (!value) continue;
      const parts = ref.modifierId
        ? hitGeometry(owner, all).filter(
            (p) => p.ownerModifier === ref.modifierId && p.d,
          )
        : effectParts(
            value,
            owner.construction ? owner : all.find((s) => s.id === owner.source),
          );
      content += parts
        .map(
          (p) =>
            `<path class="construction-highlight ${runtime.interaction.eraserHover ? "erase-highlight" : ""}" d="${p.d}"/>`,
        )
        .join("");
    }
    for (const [id, ids] of Object.entries(runtime.selection.rangeSelections)) {
      const o = all.find((o) => o.id === id);
      if (o && o !== editor.one())
        content += `<path class="edge-selected" d="${edgeHighlight(o, ids)}"/>`;
    }
    if (runtime.appearance.colorHover) {
      const o = all.find((o) => o.id === runtime.appearance.colorHover);
      if (o?.nodes)
        content += `<path d="${pathD(worldPath(o))}" class="fill-hover"/>`;
    }
    if (runtime.document.project.liveMirror) {
      const peers = new Set(
        os
          .map((o) => o.instanceOf || o.mirrorPeer)
          .filter((id) => id && !runtime.selection.selected.includes(id)),
      );
      for (const id of peers) {
        const o = all.find((o) => o.id === id);
        if (!o || o.hidden) continue;
        const b = visibleBounds(o, all);
        content += `<rect class="mirror-selection" x="${b.x}" y="${b.y}" width="${Math.max(b.w, 0.1)}" height="${Math.max(b.h, 0.1)}" fill="none" stroke="#629682" opacity=".65" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      }
    }
    if (
      editor.one()?.semanticType === "panelBoundary" &&
      runtime.interaction.tool === "node"
    ) {
      const base = all.find((x) => x.id === editor.one().panelOf);
      if (base)
        content += editor.panelEndpointMarkers(
          resolvePanelCut(base, editor.one()),
        );
    }
    if (runtime.interaction.tool === "gradient" && editor.one()?.gradient) {
      const o = editor.one(),
        g = o.gradient,
        b = localBox(o),
        a = point(o.matrix, { x: b.x + g.x1 * b.w, y: b.y + g.y1 * b.h }),
        q = point(o.matrix, { x: b.x + g.x2 * b.w, y: b.y + g.y2 * b.h });
      content +=
        `<path d="M ${a.x} ${a.y} L ${q.x} ${q.y}" class="gradient-axis"/>` +
        [a, q]
          .map(
            (v, i) =>
              `<circle data-gradient-end="${i}" cx="${v.x}" cy="${v.y}" r="${7 / z}" class="gradient-end"/><circle cx="${v.x}" cy="${v.y}" r="${3 / z}" fill="${g.stops[i ? g.stops.length - 1 : 0].color}" pointer-events="none"/>`,
          )
          .join("");
    }
    $("#selection").innerHTML = content;
  }

  function axisRender() {
    if (!runtime.document.project) return;
    const axis = runtime.document.project.centerAxis ?? 350;
    $("#axis").innerHTML = runtime.document.project.showAxis
      ? `<path class="axis-line" d="M ${axis} -100 L ${axis} ${runtime.document.project.document.heightPx + 100}"/>`
      : "";
    $("#axis").innerHTML += (
      runtime.document.project.guides?.[runtime.document.view] || []
    )
      .map(
        (g) =>
          `<path class="user-guide" d="${g.direction === "vertical" ? "M " + g.position + " -100 L " + g.position + " " + (runtime.document.project.document.heightPx + 100) : "M -100 " + g.position + " L " + (runtime.document.project.document.widthPx + 100) + " " + g.position}"/>`,
      )
      .join("");
    $("#axis-toggle").classList.toggle(
      "active",
      !!runtime.document.project.showAxis,
    );
    $("#live-mirror").classList.toggle(
      "active",
      !!runtime.document.project.liveMirror,
    );
    $("#live-mirror").innerHTML =
      uiIcon("liveMirror") +
      "<span>Espejo " +
      (runtime.document.project.liveMirror ? "ON" : "OFF") +
      "</span>";
  }

  function drawNow() {
    syncPaintUI();
    resolveMirrorChanges(
      runtime.document.project,
      runtime.document.history.doc,
      runtime.document.view,
      { command: activeTool() },
    );
    refreshPanels(editor.objects());
    const os = editor.objects();
    $("#art").innerHTML = renderArt(os);
    drawSelection();
  }

  function renderArt(os) {
    const allowed = isolationIds(
      runtime.document.project,
      runtime.document.view,
      runtime.selection.isolation.at(-1),
    );
    return (
      definitions(os) +
      orderedObjects(runtime.document.project, runtime.document.view)
        .filter((o) =>
          visible(runtime.document.project, runtime.document.view, o),
        )
        .map(
          (o) =>
            `<g opacity="${allowed && !allowed.has(o.id) ? 0.14 : 1}">${objectSvg(o, os, false)}</g>`,
        )
        .join("")
    );
  }

  function updateArtboard() {
    const d = runtime.document.project.document;
    for (const key of ["fill", "stroke"]) {
      $("#active-" + key).style.background =
        runtime.document.project.colors[key] === "none"
          ? "linear-gradient(135deg,white 43%,#c84040 44%,#c84040 56%,white 57%)"
          : runtime.document.project.colors[key];
      $("#active-" + key).title =
        (key === "fill" ? "Relleno" : "Línea") +
        " · " +
        runtime.document.project.colors[key];
    }
    for (const el of [$(".artboard"), $("#gridrect")]) {
      el?.setAttribute("width", d.widthPx);
      el?.setAttribute("height", d.heightPx);
    }
    $(".artboard")?.setAttribute(
      "fill",
      documentBackground(runtime.document.project),
    );
    $("#canvas-dimensions").textContent =
      `${Math.round(d.width * 100) / 100} × ${Math.round(d.height * 100) / 100} ${d.unit}`;
  }

  function canvasFeedback(e) {
    const p = world(e),
      z = runtime.canvas.camera.z,
      mode = activeTool(),
      host = $("#tool-feedback");
    let html = "",
      cursor = runtime.interaction.space
        ? "grab"
        : toolCursor[mode] || "crosshair";
    const handle = e.target.closest("[data-handle]");
    if (handle)
      cursor =
        handle.dataset.handle === "rotate"
          ? "crosshair"
          : handle.dataset.handle === "move"
            ? "move"
            : handle.dataset.handle === "ne" || handle.dataset.handle === "sw"
              ? "nesw-resize"
              : "nwse-resize";
    const node = e.target.closest("[data-node]");
    if (node && editor.one()?.type === "path") {
      const o = editor.one(),
        n = o.nodes[Number(node.dataset.node)],
        v = node.dataset.side ? n?.[node.dataset.side] : n;
      if (v) {
        const q = point(o.matrix, v);
        html = `<circle cx="${q.x}" cy="${q.y}" r="${8 / z}" class="hover-anchor"/>`;
        cursor = "move";
      }
    }
    if (
      (mode === "scissors" ||
        (mode === "node" && runtime.interaction.editMode === "nodes")) &&
      !node
    ) {
      const os =
        mode === "node"
          ? [editor.one()].filter(Boolean)
          : (runtime.selection.selected.length
              ? editor.chosen()
              : editor.objects()
            ).filter(
              (o) =>
                o.type === "path" &&
                visible(runtime.document.project, runtime.document.view, o) &&
                !locked(runtime.document.project, runtime.document.view, o),
            );
      const hits = os
        .map((o) => ({ o, h: nearestPathPoint(o, p) }))
        .filter((x) => x.h?.distance < 8 / z)
        .sort((a, b) => a.h.distance - b.h.distance);
      const hit = hits[0];
      if (hit) {
        const valid =
            mode === "node" ||
            (editor.editableStandalone(hit.o) &&
              !hit.o.closed &&
              !hit.o.symmetry),
          q = hit.h.point;
        html = `<circle cx="${q.x}" cy="${q.y}" r="${5 / z}" fill="white" stroke="${valid ? "#357e62" : "#c74848"}" stroke-width="${1.5 / z}"/><text x="${q.x + 10 / z}" y="${q.y - 10 / z}" font-size="${12 / z}" fill="${valid ? "#27634b" : "#c74848"}">${valid ? (mode === "scissors" ? "Cortar aquí" : "Doble clic: añadir nodo") : "Prenda protegida · usá Corte de panel"}</text>`;
        if (!valid) cursor = "not-allowed";
      }
    }
    if (mode === "eraser" && runtime.interaction.eraserMode === "vector") {
      const hit = (
        runtime.selection.selected.length ? editor.chosen() : editor.objects()
      ).find(
        (o) =>
          o.type === "path" &&
          nearestPathPoint(o, p)?.distance <
            (runtime.interaction.eraserRadius + 5) / z,
      );
      if (hit && !editor.editableStandalone(hit)) {
        cursor = "not-allowed";
        editor.status(
          "Geometría de prenda protegida · usá el modo Construcción o Corte de panel.",
        );
      }
    }

    host.innerHTML = html;
    $("#canvas").style.cursor = cursor;
  }

  function syncPaintUI() {
    if (!runtime.document.project) return;
    for (const target of ["fill", "stroke"]) {
      const state = paintState(
          editor.chosen(),
          target,
          runtime.document.project.colors,
        ),
        el = $("#active-" + target);
      el.style.background = paintCss(state);
      el.style.setProperty?.("--swatch", paintCss(state));
      el.dataset.paintState = state.kind;
      el.title =
        (target === "fill" ? "Relleno" : "Línea") + " · " + state.label;
      el.setAttribute("aria-label", el.title);
    }
  }
  return {
    renderToolbar,
    activeTool,
    updateToolUI,
    cameraRender,
    fit,
    zoom,
    world,
    toolSet,
    updateHint,
    render,
    drawSelection,
    drawNow,
    renderArt,
    updateArtboard,
    canvasFeedback,
    syncPaintUI,
  };
}
