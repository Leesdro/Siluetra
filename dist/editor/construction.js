import { uiIcon, actionIcons } from "../ui-icons.js";
import {
  addConstructions,
  addModifiers,
  constructionRefs,
  resolveRef,
  canonicalRefs,
  updateConstructions,
  operationTargets,
  stackTargets,
} from "../construction-system.js";
import { paletteControls } from "../palette-controls.js";
import { selectedRangeIds } from "../edges.js";
import { detachInstances } from "../model.js";
import { stackPreset } from "../components.js";
import { clone, mul, around, samples, bounds, worldPath } from "../core.js";
import { esc } from "../render.js";
import { effectNames, resizePathLength, pathLength } from "../effects.js";
import { geometryMirror } from "../symmetry.js";
import { $ } from "./ui.js";

// construction: editor controller; geometry and document services remain authoritative.
export function createConstructionController(runtime, editor) {
  function construction(type, rows = 1) {
    const targets = operationTargets(
      runtime.document.project,
      runtime.document.view,
      runtime.selection.selected,
      currentRanges(),
    );
    if (!targets.length) {
      editor.toast("Seleccioná uno o más trazados compatibles");
      return;
    }
    const skipped = editor
      .chosen()
      .filter((o) => editor.sourceFor(o)?.type !== "path").length;
    editor.commit(
      () => {
        runtime.selection.selected = addConstructions(
          runtime.document.project,
          runtime.document.view,
          runtime.selection.selected,
          type,
          { rows, offset: type === "zipper" ? 0 : 5 },
          currentRanges(),
        );
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
      },
      "Agregar " +
        (rows === 2 ? "costura doble" : effectNames[type]) +
        (targets.length > 1 ? " a " + targets.length + " trazados" : ""),
    );
    renderConstructionPalette(true);
    if (skipped)
      editor.toast("Aplicado a " + targets.length + " trazados compatibles");
  }

  function setModifier(id, key, value) {
    const refs = activeConstructionRefs();
    if (refs.some((r) => r.modifierId === id)) {
      setConstructionProperty(key, value);
      return;
    }
    const o = editor.one(),
      m = o?.modifiers?.find((m) => m.id === id);
    if (!m) return;
    editor.commit(() => {
      if (key === "amount")
        value = Math.max(-100, Math.min(100, Number(value)));
      if (["spacing", "thickness", "inset", "density"].includes(key))
        value = Math.max(0, Number(value));
      m[key] = value;
    });
  }

  function specialProperty(key, value) {
    const o = editor.one(),
      number = Number(value),
      source = o?.source ? editor.objects().find((s) => s.id === o.source) : o;
    if (key === "centerAxis") {
      if (!Number.isFinite(number)) return true;
      editor.commit(() => {
        runtime.document.project.centerAxis = number;
        for (const path of editor.objects().filter((o) => o.symmetry))
          geometryMirror(path, number);
      });
      return true;
    }
    if ((key === "w" || key === "h") && source) {
      const box = bounds(source, editor.objects());
      if (
        number === 0 ||
        (number > 0 &&
          (key === "w" ? box.w : box.h) < 0.00001 &&
          source.collapseBackup)
      ) {
        editor.commit(() => {
          if (number === 0) {
            source.collapseBackup ??= clone(source.matrix);
            const factor = key === "w" ? box.w : box.h;
            if (factor > 0)
              source.matrix = mul(
                around(box.x, box.y, key === "w" ? 0 : 1, key === "h" ? 0 : 1),
                source.matrix,
              );
          } else {
            source.matrix = clone(source.collapseBackup);
            const restored = bounds(source, editor.objects());
            source.matrix = mul(
              around(
                restored.x,
                restored.y,
                key === "w" ? number / (restored.w || 1) : 1,
                key === "h" ? number / (restored.h || 1) : 1,
              ),
              source.matrix,
            );
            delete source.collapseBackup;
          }
        });
        return true;
      }
    }
    if (
      [
        "pathLength",
        "sliderPercent",
        "openAmount",
        "teethSpacing",
        "teethWidth",
        "tapeWidth",
        "cordWidth",
        "effectWidth",
        "itemSize",
        "count",
        "zipType",
        "cordStyle",
        "endType",
        "tapeColor",
        "stitchType",
        "rowGap",
        "nodeKind",
        "contour",
      ].includes(key) ||
      (key === "w" && o?.type === "zipper" && bounds(source).w < 1)
    ) {
      editor.commit(() => {
        if (key === "pathLength") {
          resizePathLength(source, Math.max(0, Math.min(10000, number)));
          return;
        }
        if (key === "sliderPercent") {
          o.slider = Math.max(0, Math.min(100, number)) / 100;
          return;
        }
        if (key === "openAmount") {
          o.openAmount = Math.max(0, Math.min(100, number));
          return;
        }
        if (key === "w") {
          o.zipWidth = Math.max(0, number);
          return;
        }
        if (key === "zipType") {
          o.zipType = value;
          const jeans = value === "jeans",
            invisible = value === "invisible";
          o.zipWidth = invisible ? 4 : jeans ? 6 : 9;
          o.tapeWidth = invisible ? 2 : 3;
          o.teethWidth = invisible ? 1.5 : jeans ? 3 : 4.5;
          return;
        }
        if (key === "cordStyle") {
          o.cordStyle = value;
          o.cordWidth =
            value === "wide"
              ? 8
              : ["flat", "braided", "elastic"].includes(value)
                ? 5
                : 2;
          return;
        }
        if (key === "stitchType") {
          o.stitchType = value;
          if (value === "long") o.length = 7;
          return;
        }
        if (key === "contour") {
          const i = Number(value) - 1;
          if (i < 0 || !o.subpaths?.[i]) return;
          const old = { nodes: o.nodes, closed: o.closed };
          o.nodes = o.subpaths[i].nodes;
          o.closed = o.subpaths[i].closed;
          o.subpaths[i] = old;
          delete o.symmetry;
          runtime.selection.nodeIndex = -1;
          runtime.selection.nodeIndices = [];
          return;
        }
        if (key === "nodeKind") {
          for (const index of runtime.selection.nodeIndices) {
            const n = o.nodes[index];
            if (!n) continue;
            n.kind = value;
            if (value !== "corner") {
              const a = o.nodes[(index + o.nodes.length - 1) % o.nodes.length],
                b = o.nodes[(index + 1) % o.nodes.length],
                out = n.out || {
                  x: n.x + (b.x - a.x) / 6,
                  y: n.y + (b.y - a.y) / 6,
                },
                dx = out.x - n.x,
                dy = out.y - n.y,
                len = Math.hypot(dx, dy) || 1,
                other = n.in ? Math.hypot(n.in.x - n.x, n.in.y - n.y) : len,
                ratio = value === "symmetric" ? 1 : other / len;
              n.out = out;
              n.in = { x: n.x - dx * ratio, y: n.y - dy * ratio };
            }
          }
          return;
        }
        if (
          [
            "teethSpacing",
            "teethWidth",
            "tapeWidth",
            "cordWidth",
            "effectWidth",
            "itemSize",
            "rowGap",
          ].includes(key)
        )
          o[key] = Math.max(0, number);
        else if (key === "count")
          o.count = Math.max(1, Math.min(200, Math.round(number)));
        else o[key] = value;
      });
      return true;
    }
    return false;
  }

  function addModifier(type, extra = {}) {
    const targets = operationTargets(
      runtime.document.project,
      runtime.document.view,
      runtime.selection.selected,
      currentRanges(),
    );
    if (!targets.length) {
      editor.toast("Seleccioná formas o trazados compatibles");
      return;
    }
    if (type === "fabricFall" && !extra.edgeIds?.length) {
      prepareStack(extra);
      return;
    }
    const skipped = editor
      .chosen()
      .some((o) => editor.sourceFor(o)?.type !== "path");
    editor.commit(() => {
      runtime.selection.constructionContexts = addModifiers(
        runtime.document.project,
        runtime.document.view,
        runtime.selection.selected,
        type,
        extra,
        currentRanges(),
      );
      runtime.selection.selected = runtime.selection.constructionContexts.map(
        (r) => r.ownerId,
      );
      runtime.selection.modifierContext =
        runtime.selection.constructionContexts[0]?.modifierId || null;
    }, "Agregar " + effectNames[type]);
    renderConstructionPalette(true);
    if (!runtime.selection.constructionContexts.length)
      editor.toast("La selección no tiene bordes compatibles");
    else if (skipped)
      editor.toast(
        "Aplicado a " +
          runtime.selection.constructionContexts.length +
          " trazados compatibles",
      );
  }

  function finishPreset(name) {
    const targets = operationTargets(
      runtime.document.project,
      runtime.document.view,
      runtime.selection.selected,
      currentRanges(),
    );
    if (!targets.length) return;
    if (targets.length > 1) {
      if (targets.every((t) => t.edgeIds.length || !t.o.closed)) {
        applyFinish(name, targets[0].o, targets[0].edgeIds);
        return;
      }
      const ranges = Object.fromEntries(
        targets.map((t) => [
          t.o.id,
          t.edgeIds.length
            ? t.edgeIds
            : t.o.semanticEdges?.hem || t.o.semanticEdges?.cuff || [],
        ]),
      );
      if (Object.values(ranges).every((ids) => ids.length)) {
        runtime.selection.rangeSelections = ranges;
        runtime.selection.selected = targets.map((t) => t.o.id);
        runtime.interaction.tool = "node";
        runtime.interaction.editMode = "edges";
        runtime.selection.edgeIds = [];
        editor.render();
        $("#edge-confirm").innerHTML =
          '<span>Terminación · bordes seleccionados</span><button id="apply-edge-finish" class="primary">Aplicar</button><button id="cancel-edge-finish">Cancelar</button>';
        $("#edge-confirm").classList.remove("hidden");
        $("#apply-edge-finish").onclick = () => {
          applyFinish(name, targets[0].o, ranges[targets[0].o.id]);
          $("#edge-confirm").classList.add("hidden");
        };
        $("#cancel-edge-finish").onclick = () => {
          runtime.selection.rangeSelections = {};
          $("#edge-confirm").classList.add("hidden");
          editor.drawSelection();
        };
        return;
      }
      editor.toast("Elegí los bordes compatibles para esta terminación");
      return;
    }
    const o = targets[0].o;
    if (!runtime.selection.edgeIds.length && o.closed) {
      const semantic = selectedRangeIds(o, "hem").length
        ? selectedRangeIds(o, "hem")
        : selectedRangeIds(o, "cuff");
      editor.selectId(o.id, false, true);
      runtime.selection.constructionContexts = [];
      runtime.selection.modifierContext = null;
      runtime.interaction.tool = "node";
      runtime.interaction.editMode = "edges";
      if (semantic.length) {
        runtime.selection.edgeIds = semantic;
        runtime.interaction.pendingFinish = null;
        editor.render();
        finishPreview(name);
        return;
      }
      runtime.interaction.pendingFinish = name;
      editor.render();
      editor.toast("Elegí el borde para la terminación · Escape cancela");
      return;
    }
    applyFinish(name, o, runtime.selection.edgeIds);
  }

  function applyFinish(name, o, ids) {
    const recipes = {
        simple: [
          ["parallel", { offset: 6, thickness: 1 }],
          ["stitch", { offset: 8 }],
        ],
        double: [
          ["parallel", { offset: 5 }],
          ["parallel", { offset: 10 }],
        ],
        doubleStitch: [
          ["parallel", { offset: 10, thickness: 1 }],
          ["stitch", { rows: 2, offset: 5, rowGap: 3 }],
        ],
        raw: [["raw", { offset: 0 }]],
        rib: [["rib", { effectWidth: 12, inset: 0 }]],
        piping: [["piping", { effectWidth: 4, offset: 0, stroke: "#444b49" }]],
      },
      scope = editor.chosen().length > 1 ? runtime.selection.selected : [o.id],
      ranges = { ...currentRanges(), [o.id]: ids };
    editor.commit(() => {
      runtime.selection.constructionContexts = [];
      for (const [type, params] of recipes[name] || [])
        runtime.selection.constructionContexts.push(
          ...addModifiers(
            runtime.document.project,
            runtime.document.view,
            scope,
            type,
            params,
            ranges,
          ),
        );
      runtime.selection.selected = [
        ...new Set(
          runtime.selection.constructionContexts.map((r) => r.ownerId),
        ),
      ];
      const last = runtime.selection.constructionContexts.at(-1),
        lastType = last && resolveRef(editor.objects(), last).value?.type;
      runtime.selection.constructionContexts =
        runtime.selection.constructionContexts.filter(
          (r) => resolveRef(editor.objects(), r).value?.type === lastType,
        );
      runtime.selection.modifierContext = last?.modifierId;
      runtime.interaction.tool = "select";
      runtime.selection.edgeIds = [];
      runtime.selection.rangeSelections = {};
    }, "Agregar terminación " + name);
  }

  function finishPreview(name) {
    $("#edge-confirm").innerHTML =
      `<span>Borde de ${runtime.selection.edgeIds.length > 1 ? "ruedos" : "ruedo"} seleccionado</span><button id="apply-edge-finish" class="primary">Aplicar</button><button id="cancel-edge-finish">Cancelar</button>`;
    $("#edge-confirm").classList.remove("hidden");
    $("#apply-edge-finish").onclick = () => {
      const o = editor.one();
      if (o) applyFinish(name, o, runtime.selection.edgeIds);
      $("#edge-confirm").classList.add("hidden");
    };
    $("#cancel-edge-finish").onclick = () => {
      $("#edge-confirm").classList.add("hidden");
      runtime.selection.edgeIds = [];
      runtime.interaction.pendingFinish = null;
      editor.drawSelection();
    };
  }

  function applyResourceModifier(key) {
    if (
      !operationTargets(
        runtime.document.project,
        runtime.document.view,
        runtime.selection.selected,
        currentRanges(),
      ).length
    )
      return false;
    if (key.startsWith("stack")) {
      addModifier("fabricFall", stackPreset(key));
      return true;
    }
    if (key.startsWith("pleat")) {
      addModifier("pleat", { pleatType: key === "pleatBox" ? "box" : "knife" });
      return true;
    }
    if (key.startsWith("quilt")) {
      addModifier("quilt", {
        pattern: key === "quiltDiamond" ? "diamond" : "horizontal",
      });
      return true;
    }
    if (key === "distressSmart") {
      addModifier("distress");
      return true;
    }
    return false;
  }

  function currentRanges() {
    const ranges = clone(runtime.selection.rangeSelections);
    if (editor.one()?.type === "path" && runtime.selection.edgeIds.length)
      ranges[editor.one().id] = clone(runtime.selection.edgeIds);
    return ranges;
  }

  function activeConstructionRefs() {
    if (!runtime.document.project) return [];
    return constructionRefs(
      editor.objects(),
      runtime.selection.selected,
      runtime.selection.constructionContexts,
    );
  }

  function renderConstructionPalette(force = false) {
    const host = $("#construction-palette"),
      refs = activeConstructionRefs(),
      resolved = refs
        .map((ref) => ({ ...resolveRef(editor.objects(), ref), ref }))
        .filter((r) => r.value),
      key = refs
        .map((r) => r.ownerId + ":" + (r.modifierId || ""))
        .sort()
        .join("|");
    if (!resolved.length) {
      host.classList.add("hidden");
      host.innerHTML = "";
      runtime.workspace.paletteKey = "";
      return;
    }
    if (!force && host.classList.contains("hidden")) return;
    if (key !== runtime.workspace.paletteKey) {
      runtime.workspace.paletteClosedKey = null;
      runtime.workspace.paletteKey = key;
    }
    if (force) runtime.workspace.paletteClosedKey = null;
    if (runtime.workspace.paletteClosedKey === key) {
      host.classList.add("hidden");
      return;
    }
    const types = [...new Set(resolved.map((r) => r.value.type))],
      label =
        types.length === 1
          ? effectNames[types[0]] || types[0]
          : "Construcciones";
    host.innerHTML = `<header class="floating-header" data-floating-handle><div><strong>${uiIcon(actionIcons[types[0]] || "stitch")}${label}${resolved[0].value.rows === 2 ? " doble" : ""}</strong><small>${resolved.length > 1 ? resolved.length + " seleccionadas" : esc(resolved[0].owner.name)}</small></div><button data-close-palette title="Cerrar paleta" aria-label="Cerrar paleta">${uiIcon("close")}</button></header><div class="floating-body"><div class="selection-chip">${resolved.some((r) => r.ref.modifierId) ? "Modificador" : "Construcción vinculada"} · ${resolved.some((r) => r.value.edgeIds?.length) ? "Bordes" : "Trazado"}</div>${paletteControls(resolved.map((r) => ({ ...r.value, _pathLength: pathLength(samples(worldPath(r.owner.source ? editor.objects().find((o) => o.id === r.owner.source) : r.owner), 48)) })))}<div class="palette-actions"><button data-palette-source>Editar base</button><button data-palette-delete>Eliminar construcción</button></div></div>`;
    host.classList.remove("hidden");
    if (!host.style.left) {
      host.style.left = Math.max(280, innerWidth - 590) + "px";
      host.style.top = "150px";
    }
    host.style.maxHeight =
      Math.max(100, innerHeight - parseFloat(host.style.top) - 12) + "px";
  }

  function setConstructionProperty(key, value, live = false) {
    const refs = activeConstructionRefs();
    if (!refs.length) return;
    const numeric = new Set([
      "offset",
      "spacing",
      "length",
      "rows",
      "rowGap",
      "width",
      "thickness",
      "inset",
      "density",
      "angle",
      "effectWidth",
      "intensity",
      "irregularity",
      "randomness",
      "foldCount",
      "seed",
      "pleatWidth",
      "depth",
      "count",
      "itemSize",
      "zipWidth",
      "tapeWidth",
      "teeth",
      "teethSpacing",
      "teethWidth",
      "sliderPercent",
      "openAmount",
      "cordWidth",
      "amount",
      "pathLength",
    ]);
    if (numeric.has(key)) {
      value = Number(value);
      if (!Number.isFinite(value)) return;
      if (key === "amount") value = Math.max(-100, Math.min(100, value));
      else if (["irregularity", "randomness"].includes(key))
        value = Math.max(0, Math.min(1, value));
      else if (["rows", "foldCount", "count"].includes(key))
        value = Math.max(
          key === "foldCount" ? 0 : 1,
          Math.min(key === "count" ? 200 : 12, Math.round(value)),
        );
      else if (key === "offset") value = Math.abs(value);
      else if (key !== "angle") value = Math.max(0, Math.min(10000, value));
    }
    if (
      key === "position" &&
      !["inside", "outside", "centered"].includes(value)
    )
      return;
    (live
      ? runtime.services.preview.update.bind(runtime.services.preview)
      : editor.commit)(
      () => {
        if (!runtime.document.project.liveMirror)
          for (const r of refs)
            detachInstances(runtime.document.project, runtime.document.view, [
              r.ownerId,
            ]);
        if (key === "pathLength") {
          const ids = new Set();
          for (const r of canonicalRefs(
            runtime.document.project,
            runtime.document.view,
            refs,
          )) {
            const { owner } = resolveRef(editor.objects(), r),
              base = editor.sourceFor(owner);
            if (base && !ids.has(base.id)) {
              ids.add(base.id);
              resizePathLength(base, value);
            }
          }
          return;
        }
        if (key === "sliderPercent") {
          key = "slider";
          value = Math.min(100, value) / 100;
        }
        if (key === "openAmount") value = Math.min(100, value);
        if (key === "width") {
          for (const ref of canonicalRefs(
            runtime.document.project,
            runtime.document.view,
            refs,
          )) {
            const { value: target } = resolveRef(editor.objects(), ref);
            updateConstructions(
              runtime.document.project,
              runtime.document.view,
              [ref],
              ref.modifierId ? "thickness" : "width",
              value,
            );
          }
        } else {
          updateConstructions(
            runtime.document.project,
            runtime.document.view,
            refs,
            key,
            value,
          );
          if (key === "zipType")
            for (const ref of canonicalRefs(
              runtime.document.project,
              runtime.document.view,
              refs,
            )) {
              const { value: target } = resolveRef(editor.objects(), ref);
              Object.assign(
                target,
                value === "invisible"
                  ? { zipWidth: 4, tapeWidth: 2, teethWidth: 1.5 }
                  : value === "jeans"
                    ? { zipWidth: 6, tapeWidth: 3, teethWidth: 3 }
                    : { zipWidth: 9, tapeWidth: 3, teethWidth: 4.5 },
              );
            }
          if (key === "cordStyle")
            updateConstructions(
              runtime.document.project,
              runtime.document.view,
              refs,
              "cordWidth",
              value === "wide" ? 8 : value === "round" ? 2 : 5,
            );
          if (key === "stitchType" && value === "long")
            updateConstructions(
              runtime.document.project,
              runtime.document.view,
              refs,
              "length",
              7,
            );
        }
      },
      "Editar " +
        (effectNames[resolveRef(editor.objects(), refs[0]).value?.type] ||
          "construcción") +
        " · " +
        key,
    );
  }

  function prepareStack(params) {
    const ranges = currentRanges(),
      targets = stackTargets(
        runtime.document.project,
        runtime.document.view,
        runtime.selection.selected,
        ranges,
      );
    if (!targets.length) {
      runtime.interaction.pendingStack = params;
      editor.toolSet("node");
      runtime.interaction.editMode = "edges";
      editor.toast("Elegí un borde de ruedo o puño para Stack");
      return;
    }
    const selection = targets.map((t) => t.o.id),
      targetRanges = Object.fromEntries(
        targets.map((t) => [t.o.id, t.edgeIds]),
      );
    if (Object.values(ranges).some((ids) => ids.length)) {
      applyStack(params, selection, targetRanges);
      return;
    }
    runtime.selection.selected = selection;
    runtime.selection.rangeSelections = targetRanges;
    runtime.selection.edgeIds = targets.length === 1 ? targets[0].edgeIds : [];
    runtime.selection.constructionContexts = [];
    runtime.selection.modifierContext = null;
    runtime.interaction.tool = "node";
    runtime.interaction.editMode = "edges";
    editor.render();
    $("#edge-confirm").innerHTML =
      `<span>Stack · ${targets.reduce((n, t) => n + t.edgeIds.length, 0)} bordes de ruedo / puño</span><button id="apply-edge-stack" class="primary">Aplicar</button><button id="cancel-edge-stack">Cancelar</button>`;
    $("#edge-confirm").classList.remove("hidden");
    $("#apply-edge-stack").onclick = () =>
      applyStack(params, selection, targetRanges);
    $("#cancel-edge-stack").onclick = () => {
      runtime.interaction.pendingStack = null;
      runtime.selection.rangeSelections = {};
      runtime.selection.edgeIds = [];
      $("#edge-confirm").classList.add("hidden");
      editor.drawSelection();
    };
  }

  function applyStack(params, selection, ranges) {
    editor.commit(() => {
      runtime.selection.constructionContexts = addModifiers(
        runtime.document.project,
        runtime.document.view,
        selection,
        "fabricFall",
        params,
        ranges,
      );
      runtime.selection.selected = runtime.selection.constructionContexts.map(
        (r) => r.ownerId,
      );
      runtime.selection.modifierContext =
        runtime.selection.constructionContexts[0]?.modifierId;
      runtime.interaction.tool = "select";
      runtime.selection.rangeSelections = {};
      runtime.selection.edgeIds = [];
      runtime.interaction.pendingStack = null;
      $("#edge-confirm").classList.add("hidden");
    }, "Agregar Stack en ruedos / puños");
    renderConstructionPalette(true);
  }
  return {
    construction,
    setModifier,
    specialProperty,
    addModifier,
    finishPreset,
    applyFinish,
    applyResourceModifier,
    activeConstructionRefs,
    renderConstructionPalette,
    setConstructionProperty,
    prepareStack,
    applyStack,
  };
}
