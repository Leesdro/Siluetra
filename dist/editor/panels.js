import {
  discoverVisualRegions,
  VisualRegionSelection,
  visualRegionAt,
} from "../visual-regions.js";
import {
  visualPanelContexts,
  materializeVisualOwner,
} from "../visual-panel-context.js";
import { selectedPanelOwner } from "../panel-owner.js";
import { edgePanelTolerance, selectablePanelEdge } from "../edge-panels.js";
import { toolCursor } from "../ux-tools.js";
import {
  resolveGarmentSurfaces,
  materializeSurface,
} from "../garment-surfaces.js";
import {
  resolvePanelCut,
  nearestBoundary,
  panelSnapTolerance,
} from "../panel-cut.js";
import {
  previewPanels,
  createPanels,
  createPanelFromEdges,
} from "../panels.js";
import { visible, locked, isolationIds } from "../model.js";
import { hitCandidates, hitObject } from "../hit.js";
import { pathD, worldPath } from "../core.js";
import { esc } from "../render.js";
import { $ } from "./ui.js";

// panels: editor controller; geometry and document services remain authoritative.
export function createPanelsController(runtime, editor) {
  function panelEdgeInstruction() {
    return runtime.panels.panelEdgeState?.phase === "RESOLVE_OWNER"
      ? "Elegí la pieza donde querés crear el panel."
      : runtime.panels.panelEdgeState?.phase === "SELECT_AREA"
        ? "Pasá el cursor por un área y hacé clic"
        : runtime.panels.panelEdgeState?.phase === "ERROR"
          ? "No encontramos un área cerrada acá · Esc cancela"
          : runtime.panels.panelEdgeState?.phase === "CHOOSE_REGION"
            ? "Elegí la región del panel · Esc cancela"
            : runtime.panels.panelEdgeState?.phase === "READY_TO_CREATE"
              ? "Enter crea el panel · Esc cancela"
              : "Seleccioná los bordes que forman el panel.";
  }

  function panelSurfaces(source = null) {
    return resolveGarmentSurfaces(editor.objects(), {
      exclude: source ? [source.id] : [],
      eligible: (o) =>
        visible(runtime.document.project, runtime.document.view, o) &&
        !locked(runtime.document.project, runtime.document.view, o),
    });
  }

  function panelTargets(source = null) {
    const surfaces = panelSurfaces(source).surfaces,
      explicit =
        source?.panelOf &&
        editor.objects().find((o) => o.id === source.panelOf),
      selectedSurfaces = surfaces.filter((s) =>
        s.boundaryIds.some((id) => runtime.selection.selected.includes(id)),
      );
    return explicit
      ? [explicit]
      : (selectedSurfaces.length ? selectedSurfaces : surfaces).map(
          (s) => s.path,
        );
  }

  function panelBase(id, line) {
    return (
      editor.objects().find((o) => o.id === id) ||
      panelTargets(line).find((o) => o.id === id)
    );
  }

  function choosePanelSurface(p) {
    const source = editor
        .objects()
        .find((o) => o.id === runtime.panels.panelPreview?.lineId),
      candidates = panelTargets(source);
    return candidates
      .slice()
      .reverse()
      .find((o) =>
        hitObject({ ...o, fill: "#fff" }, [...editor.objects(), o], p, 0),
      );
  }

  function snapPanelPoint(p, source = null) {
    let best = null;
    for (const base of panelTargets(source)) {
      const hit = nearestBoundary(base, p);
      if (
        hit?.distance <= panelSnapTolerance(runtime.canvas.camera.z) &&
        (!best || hit.distance < best.distance)
      )
        best = hit;
    }
    $("#guides").innerHTML = best
      ? `<circle class="panel-attachment" cx="${best.point.x}" cy="${best.point.y}" r="${3 / runtime.canvas.camera.z}" fill="#357e62" stroke="white" stroke-width="${1 / runtime.canvas.camera.z}" pointer-events="none"/>`
      : "";
    return best?.point || p;
  }

  function panelEndpointMarkers(result) {
    return result.diagnostics.endpoints
      .map(
        (e) =>
          `<circle class="panel-attachment" cx="${e.point.x}" cy="${e.point.y}" r="${3 / runtime.canvas.camera.z}" fill="${e.attached ? "#357e62" : "#d18b35"}" stroke="white" stroke-width="${1 / runtime.canvas.camera.z}" pointer-events="none"/>`,
      )
      .join("");
  }

  function draftPanelOverlay(source) {
    const base = panelTargets(source)[0];
    if (!base || source.nodes.length < 2) return;
    const result = resolvePanelCut(
      base,
      source,
      panelSnapTolerance(runtime.canvas.camera.z),
    );
    if (result.valid)
      $("#draft").innerHTML =
        result.regions
          .map(
            (r, i) =>
              `<path d="${pathD(worldPath(r))}" fill="${i % 2 ? "#5686ba" : "#56a287"}" opacity=".24" stroke="none"/>`,
          )
          .join("") + $("#draft").innerHTML;
    $("#draft").innerHTML += panelEndpointMarkers(result);
  }

  function previewCreatedCut(targetId) {
    if (!targetId) return;
    const source = editor.one(),
      base = editor.objects().find((o) => o.id === targetId);
    if (
      source &&
      base &&
      resolvePanelCut(base, source, panelSnapTolerance(runtime.canvas.camera.z))
        .valid
    )
      beginPanelPreview(targetId);
  }

  function panelMethodChooser() {
    editor.modal(
      '<h2>Crear panel</h2><div class="prop-buttons"><button class="primary" data-panel-method="area">Elegir área</button><button data-panel-method="edges">Seleccionar bordes</button><button data-panel-method="draw">Dibujar división</button></div><p>Usá las líneas que ya rodean el área que querés colorear.</p>',
      (e, d) => {
        const b = e.target.closest("[data-panel-method]");
        if (!b) return;
        d.close();
        if (b.dataset.panelMethod === "area") beginPanelEdges(null, "area");
        else if (b.dataset.panelMethod === "edges") beginPanelEdges();
        else if (
          editor
            .chosen()
            .some((o) => o.type === "path" && !o.closed && !o.source)
        )
          beginPanelPreview();
        else editor.toolSet("lineCut");
      },
    );
  }

  function edgePanelGeometry() {
    const allowed = isolationIds(
      runtime.document.project,
      runtime.document.view,
      runtime.selection.isolation.at(-1),
    );
    return editor
      .objects()
      .filter(
        (o) =>
          selectablePanelEdge(o) &&
          visible(runtime.document.project, runtime.document.view, o) &&
          !locked(runtime.document.project, runtime.document.view, o) &&
          (!allowed || allowed.has(o.id)),
      );
  }

  function edgePanelSurfaces() {
    return visualPanelContexts(
      edgePanelGeometry().filter(
        (o) => !o.visualPanelOwner && !o.surfaceBoundaryIds,
      ),
      editor.objects(),
      runtime.selection.selected,
      edgePanelTolerance(runtime.canvas.camera.z),
    );
  }

  function panelEdgePathsForSurface(surface) {
    return edgePanelGeometry().filter(
      (o) =>
        surface.boundaryIds.includes(o.id) &&
        !o.visualPanelOwner &&
        !o.surfaceBoundaryIds,
    );
  }

  function edgePanelSignature() {
    return JSON.stringify(
      edgePanelGeometry().map((o) => [
        o.id,
        o.nodes,
        o.subpaths,
        o.closed,
        o.matrix,
        o.liveCorners,
        o.panelOf,
        o.ownerId,
        o.attachment,
        o.group,
        o.surfaceInvalid,
      ]),
    );
  }

  function beginPanelEdges(targetId = null, mode = "edges") {
    if (!runtime.document.project) return;
    const previousTool =
      runtime.panels.panelEdgeState?.previousTool || runtime.interaction.tool;
    editor.cancelDocumentOperation();
    runtime.interaction.tool = "panelEdges";
    const surfaces = edgePanelSurfaces(),
      picked = selectedPanelOwner(
        surfaces,
        editor.objects(),
        runtime.selection.selected,
      ),
      surface =
        surfaces.find((s) => s.id === targetId) ||
        picked ||
        (surfaces.length === 1 ? surfaces[0] : null);
    runtime.panels.panelEdgeState = {
      previousTool,
      view: runtime.document.view,
      projectId: runtime.document.project.id,
      surfaces,
      surface,
      mode,
      phase: "RESOLVE_OWNER",
      selection: null,
      signature: "",
    };
    runtime.panels.panelPreview = null;
    if (surface) activatePanelEdgeSurface(surface);
    else renderPanelEdges();
    editor.updateToolUI();
    editor.drawSelection();
    editor.contextBar();
    editor.updateHint();
    $("#canvas").focus({ preventScroll: true });
  }

  function activatePanelEdgeSurface(surface) {
    const state = runtime.panels.panelEdgeState;
    if (!state) return;
    try {
      const paths = panelEdgePathsForSurface(surface);
      state.surface = surface;
      state.signature = edgePanelSignature();
      const topology = discoverVisualRegions(paths, {
        tolerance: edgePanelTolerance(runtime.canvas.camera.z),
        zoom: runtime.canvas.camera.z,
      });
      state.diagnostics = topology.diagnostics;
      state.metrics = topology.metrics;
      if (!topology.candidates.length) {
        state.selection = null;
        state.phase = "ERROR";
        state.error = paths.length
          ? "No encontramos un área cerrada acá. Esta zona todavía tiene una abertura. Conectá los extremos cercanos."
          : "No encontramos líneas de la prenda para formar un panel.";
      } else {
        state.phase = state.mode === "area" ? "SELECT_AREA" : "SELECT_EDGES";
        state.selection = new VisualRegionSelection(topology, {
          mode: state.mode,
        });
        state.error = null;
      }
    } catch (error) {
      state.selection = null;
      state.phase = "ERROR";
      state.error = error.message;
      state.diagnostics = [
        { code: error.code || "NODING_FAILED", message: error.message },
      ];
    }
    renderPanelEdges();
  }

  function resizePanelEdgeTolerance() {
    const state = runtime.panels.panelEdgeState,
      old = state?.selection;
    if (
      !old ||
      old.topology.tolerance === edgePanelTolerance(runtime.canvas.camera.z)
    )
      return;
    const refs = old.topology.fragments
        .filter((f) => old.selected.includes(f.id))
        .map((f) => f.refs[0]),
      chosenKey = old.choice?.key,
      autoComplete = old.autoComplete;
    activatePanelEdgeSurface(state.surface);
    const next = state.selection;
    if (!next) return;
    next.selected = refs
      .map(
        (r) =>
          next.topology.fragments.find((f) =>
            f.refs.some(
              (v) =>
                v.source === r.source &&
                v.subpath === r.subpath &&
                v.edgeId === r.edgeId &&
                v.t0 <= (r.t0 + r.t1) / 2 &&
                v.t1 >= (r.t0 + r.t1) / 2,
            ),
          )?.id,
      )
      .filter(Boolean);
    next.autoComplete = autoComplete;
    next.evaluate();
    if (chosenKey)
      next.choice = next.candidates.find((c) => c.key === chosenKey) || null;
    renderPanelEdges();
  }

  function refreshPanelEdgeOperation() {
    const state = runtime.panels.panelEdgeState;
    if (!state) return;
    if (
      runtime.document.project.id !== state.projectId ||
      runtime.document.view !== state.view
    ) {
      cancelPanelEdges();
      return;
    }
    const signature = edgePanelSignature();
    if (signature === state.signature) {
      renderPanelEdges();
      return;
    }
    const surfaces = edgePanelSurfaces(),
      surface =
        surfaces.find((s) => s.id === state.surface?.id) ||
        surfaces.find((s) =>
          s.boundaryIds.includes(state.surface?.owner?.id),
        ) ||
        (surfaces.length === 1 ? surfaces[0] : null);
    state.surfaces = surfaces;
    // Do not retain stale selected spans after editing or hiding their sources.
    if (surface) activatePanelEdgeSurface(surface);
    else {
      state.surface = null;
      state.selection = null;
      state.error = null;
      state.phase = "RESOLVE_OWNER";
      state.signature = signature;
      renderPanelEdges();
    }
  }

  function renderPanelEdges(hoverCandidate = null, hoverSurface = null) {
    const state = runtime.panels.panelEdgeState;
    if (!state) return;
    const selection = state.selection;
    $("#panel-preview").classList.remove("hidden");
    state.phase = selection
      ? selection.choice
        ? "READY_TO_CREATE"
        : state.mode === "area"
          ? "SELECT_AREA"
          : selection.candidates.length > 1
            ? "CHOOSE_REGION"
            : "SELECT_EDGES"
      : state.error || !state.surfaces.length
        ? "ERROR"
        : "RESOLVE_OWNER";
    $("#canvas").style.cursor = selection
      ? state.mode === "area"
        ? hoverCandidate || selection.choice
          ? "pointer"
          : "default"
        : state.phase === "CHOOSE_REGION"
          ? "pointer"
          : "crosshair"
      : hoverSurface
        ? "pointer"
        : "default";
    editor.updateHint();
    editor.contextBar();
    if (!selection) {
      $("#panel-preview").innerHTML =
        `<span role="status">${esc(state.error || (!state.surfaces.length ? "No encontramos líneas de la prenda para formar un panel." : "Elegí la pieza donde querés crear el panel."))}</span><button data-cancel-panels>Cancelar · Esc</button>`;
      $("#draft").innerHTML = hoverSurface
        ? `<path class="panel-edge-region" d="${pathD(worldPath(hoverSurface.path))}"/>`
        : "";
      return;
    }
    const candidate = hoverCandidate || selection.choice;
    let markup = `<path class="panel-edge-owner" d="${pathD(worldPath(state.surface.path))}"/>`;
    markup += candidate
      ? `<path class="panel-edge-region" d="${pathD(candidate.path)}"/>`
      : "";
    if (!candidate && selection.candidates.length > 1)
      markup += selection.candidates
        .map((c) => `<path class="panel-edge-option" d="${pathD(c.path)}"/>`)
        .join("");
    if (candidate)
      markup += candidate.perimeter
        .filter((f) => !f.selected)
        .map(
          (f) =>
            `<path class="panel-edge-auto" d="${pathD({ nodes: f.nodes, closed: false })}"/>`,
        )
        .join("");
    markup += selection.topology.fragments
      .filter((f) => selection.selected.includes(f.id))
      .map(
        (f) =>
          `<path class="edge-selected ${selection.candidates.length ? "" : "panel-edge-conflict"}" d="${pathD(f.path)}"/>`,
      )
      .join("");
    if (selection.hover && !selection.selected.includes(selection.hover.id))
      markup += `<path class="edge-hover" d="${pathD(selection.hover.path)}"/>`;
    $("#draft").innerHTML = markup;
    $("#panel-preview").innerHTML =
      `<span role="status">${esc(selection.message)}</span>${state.mode === "edges" ? `<label class="panel-outline-toggle"><input type="checkbox" data-auto-panel-outline ${selection.autoComplete ? "checked" : ""}> Completar con contorno</label>` : ""}<button data-clear-panel-edges ${selection.selected.length || selection.choice ? "" : "disabled"}>${state.mode === "area" ? "Elegir otra área" : "Limpiar"}</button><button data-cancel-panels>Cancelar · Esc</button><button class="primary" data-create-edge-panel ${selection.choice ? "" : "disabled"}>Crear panel</button>`;
  }

  function panelEdgesPointer(p, click) {
    const state = runtime.panels.panelEdgeState;
    if (!state) return;
    if (state.phase === "ERROR") return;
    if (state.phase === "RESOLVE_OWNER") {
      const hits = hitCandidates(
          runtime.document.project,
          runtime.document.view,
          p,
          runtime.canvas.camera.z,
          runtime.selection.isolation.at(-1),
        ),
        surface =
          hits
            .map((id) =>
              selectedPanelOwner(state.surfaces, editor.objects(), [id]),
            )
            .find(Boolean) ||
          state.surfaces
            .slice()
            .reverse()
            .find((s) =>
              hitObject(
                { ...s.path, fill: "#fff", stroke: "#000", width: 1 },
                [],
                p,
                7 / runtime.canvas.camera.z,
              ),
            );
      if (click && surface) activatePanelEdgeSurface(surface);
      else renderPanelEdges(null, surface);
      return;
    }
    const selection = state.selection;
    if (state.mode === "area") {
      const candidate = visualRegionAt(selection.candidates, p);
      if (click) selection.choice = candidate;
      renderPanelEdges(candidate);
      return;
    }
    const fragment = selection.move(p, 7 / runtime.canvas.camera.z);
    if (click) {
      if (fragment) {
        try {
          selection.toggle(fragment);
        } catch {
          selection.candidates = [];
          selection.choice = null;
          editor.toast("Elegí menos bordes o una zona más pequeña.");
        }
      } else if (selection.candidates.length > 1) selection.choose(p);
      renderPanelEdges();
    } else
      renderPanelEdges(
        !fragment && selection.candidates.length > 1
          ? visualRegionAt(selection.candidates, p)
          : null,
      );
  }

  function clearPanelEdges() {
    runtime.panels.panelEdgeState?.selection?.clear();
    renderPanelEdges();
  }

  function cancelPanelEdges(restoreTool = true) {
    if (!runtime.panels.panelEdgeState) return;
    const previous = runtime.panels.panelEdgeState.previousTool;
    runtime.panels.panelEdgeState = null;
    if (restoreTool && runtime.interaction.tool === "panelEdges")
      runtime.interaction.tool =
        previous === "panelEdges" ? "select" : previous;
    $("#canvas").style.cursor = toolCursor[editor.activeTool()] || "default";
    $("#panel-preview").classList.add("hidden");
    $("#draft").innerHTML = "";
    $("#selection").innerHTML = "";
  }

  function confirmEdgePanel() {
    if (!runtime.panels.panelEdgeState) return;
    refreshPanelEdgeOperation();
    const state = runtime.panels.panelEdgeState,
      candidate = state?.selection?.choice;
    if (!candidate) return;
    try {
      editor.commit(() => {
        const surface = state.surface,
          base = materializeVisualOwner(editor.objects(), surface, candidate),
          region = createPanelFromEdges(
            runtime.document.project,
            runtime.document.view,
            base,
            candidate,
          );
        runtime.selection.selected = [region.id];
      }, "Crear panel desde bordes");
      cancelPanelEdges(false);
      runtime.interaction.tool = "select";
      runtime.selection.edgeIds = [];
      runtime.selection.rangeSelections = {};
      editor.render();
    } catch (error) {
      state.diagnostics = [
        { code: error.code || "PANEL_COMMIT_FAILED", message: error.message },
      ];
      editor.toast("No pudimos crear este panel. Probá otra área.");
      refreshPanelEdgeOperation();
    }
  }

  function beginPanelPreview(targetId = null, options = {}) {
    if (runtime.panels.panelEdgeState) cancelPanelEdges();
    const line = editor
      .chosen()
      .find((o) => o.type === "path" && !o.closed && !o.source);
    if (!line) {
      editor.toast("Seleccioná una línea abierta para conectar al contorno.");
      return;
    }
    const candidates = panelTargets(line),
      valid = candidates.filter(
        (o) =>
          resolvePanelCut(
            o,
            line,
            panelSnapTolerance(runtime.canvas.camera.z),
            options,
          ).valid,
      ),
      explicit = targetId || line.panelOf;
    if (
      !explicit &&
      (valid.length > 1 || (!valid.length && candidates.length !== 1))
    ) {
      runtime.panels.panelPreview = {
        lineId: line.id,
        choosing: true,
        valid: false,
      };
      const diagnostic = panelSurfaces(line).diagnostics[0];
      $("#panel-preview").innerHTML =
        `<span>${candidates.length ? "Elegí una superficie: pasá el cursor y hacé clic." : esc(diagnostic?.message || "No hay un contorno cerrado. Conectá sus extremos.")}</span><button data-cancel-panels>Cancelar · Esc</button>`;
      $("#panel-preview").classList.remove("hidden");
      $("#draft").innerHTML = (diagnostic?.endpoints || [])
        .map(
          (p) =>
            `<circle cx="${p.x}" cy="${p.y}" r="${4 / runtime.canvas.camera.z}" fill="#d18b35"/>`,
        )
        .join("");
      return;
    }
    const base =
      candidates.find((o) => o.id === explicit) || valid[0] || candidates[0];
    if (!base) return;
    const result = resolvePanelCut(
      base,
      line,
      panelSnapTolerance(runtime.canvas.camera.z),
      options,
    );
    runtime.panels.panelPreview = {
      baseId: base.id,
      lineId: line.id,
      valid: result.valid,
      options,
    };
    const combinedRegions = result.valid
      ? previewPanels(base, line, editor.objects(), {
          ...options,
          snapTolerance: panelSnapTolerance(runtime.canvas.camera.z),
        })
      : [];
    $("#draft").innerHTML =
      (result.valid
        ? combinedRegions
            .map(
              (r, i) =>
                `<path d="${pathD(worldPath(r))}" fill="${i % 2 ? "#5686ba" : "#56a287"}" opacity=".24" stroke="none"/>`,
            )
            .join("")
        : "") +
      `<path d="${pathD(worldPath(result.snappedPath))}" fill="none" stroke="#357e62" stroke-width="${2 / runtime.canvas.camera.z}"/>` +
      panelEndpointMarkers(result);
    const canExtend =
      !result.valid &&
      resolvePanelCut(base, line, panelSnapTolerance(runtime.canvas.camera.z), {
        extend: true,
      }).valid;
    $("#panel-preview").innerHTML =
      `<span>${result.valid ? "Dividir " + esc(base.name) + " · " + combinedRegions.length + " paneles" : esc(result.diagnostics.message)}</span>${candidates.length > 1 ? `<select id="panel-target" aria-label="Pieza a dividir">${candidates.map((o) => `<option value="${o.id}" ${o.id === base.id ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select>` : ""}${canExtend ? "<button data-extend-panels>Extender al contorno</button>" : ""}${!result.valid ? "<button data-select-panel-edges>Seleccionar bordes</button>" : ""}<button data-cancel-panels>Cancelar · Esc</button><button class="primary" data-confirm-panels ${result.valid ? "" : "disabled"}>Crear paneles</button>`;
    $("#panel-preview").classList.remove("hidden");
  }

  function confirmPanels() {
    if (!runtime.panels.panelPreview?.valid) return;
    const { baseId, lineId, options } = runtime.panels.panelPreview;
    editor.commit(() => {
      const line = editor.objects().find((o) => o.id === lineId),
        candidate = panelBase(baseId, line),
        surface = panelSurfaces(line).surfaces.find((s) => s.id === baseId),
        base = surface
          ? materializeSurface(editor.objects(), surface)
          : candidate;
      runtime.selection.selected = createPanels(editor.objects(), base, line, {
        ...options,
        snapTolerance: panelSnapTolerance(runtime.canvas.camera.z),
      }).map((o) => o.id);
    }, "Crear paneles");
    runtime.panels.panelPreview = null;
    $("#panel-preview").classList.add("hidden");
    $("#draft").innerHTML = "";
  }
  return {
    panelEdgeInstruction,
    panelTargets,
    choosePanelSurface,
    snapPanelPoint,
    panelEndpointMarkers,
    draftPanelOverlay,
    previewCreatedCut,
    panelMethodChooser,
    beginPanelEdges,
    resizePanelEdgeTolerance,
    refreshPanelEdgeOperation,
    renderPanelEdges,
    panelEdgesPointer,
    clearPanelEdges,
    cancelPanelEdges,
    confirmEdgePanel,
    beginPanelPreview,
    confirmPanels,
  };
}
