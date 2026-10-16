import { toolFamilies, pathfinderHtml, unavailable } from "../ux-tools.js";
import { simplifyCurves } from "../curve-fit.js";
import { pathfinder } from "../pathfinder.js";
import { planarRegions } from "../planar-regions.js";
import { linearGradient, blendModes } from "../appearance.js";
import {
  cleanPath,
  compoundPaths,
  releaseCompound,
  shearMatrix,
} from "../vector-edit.js";
import { searchCommands } from "../vectorcraft-adapted.js";
import {
  convertConstruction,
  removeConstructions,
} from "../construction-system.js";
import { graphIds } from "../object-graph.js";
import { panelBoundary } from "../panels.js";
import { selectionIdentity } from "../selection-ui.js";
import { uiIcon } from "../ui-icons.js";
import { primaryTools, toolInfo } from "../tool-learning.js";
import { relinkStructure } from "../structure.js";
import { detachInstances } from "../model.js";
import { hitObject, selectionBounds } from "../hit.js";
import { smoothPath } from "../freehand.js";
import { stackPreset } from "../components.js";
import {
  uid,
  clone,
  I,
  point,
  mul,
  inverse,
  translate,
  around,
  bounds,
  union,
  evaluatedPath,
  worldPath,
} from "../core.js";
import { esc } from "../render.js";
import {
  effectParts,
  modifierParts,
  modifier,
  freezeParts,
  reversePath,
} from "../effects.js";
import {
  geometryMirror,
  syncNode,
  addSymmetricNode,
  deleteSymmetricNode,
  breakSymmetry,
  mirrorPoint,
} from "../symmetry.js";
import {
  booleanPaths,
  offsetEditable,
  outlineStroke,
  joinPaths,
  splitPath,
} from "../geometry.js";
import { $, learnKey, actionIcon, selectField } from "./ui.js";

// commands: editor controller; geometry and document services remain authoritative.
export function createCommandsController(runtime, editor) {
  const extraTools = [
    ["knife", "Cortar panel a mano alzada", ""],
    ["shapeBuilder", "Constructor de regiones", ""],
    ["curvature", "Curvatura", "U"],
    ["scissors", "Tijeras de trazado", "K"],
    ["lineCut", "Cortar panel con línea", ""],
    ["measure", "Medir", "M"],
    ["gradient", "Degradado en lienzo", ""],
  ];
  function action(name) {
    if (uxAction(name)) return;
    if (professionalAction(name)) return;
    if (name === "revealLayers") {
      runtime.library.tab = "objects";
      editor.library();
      runtime.services.layers.reveal();
      return;
    }
    if (name === "fabric") {
      editor.showFabricPalette();
      return;
    }
    if (name === "removeFabric") {
      editor.setFabric("none");
      return;
    }
    if (name.startsWith("convert:")) {
      const [_, type, rows] = name.split(":");
      editor.commit(() => {
        runtime.selection.selected = convertConstruction(
          runtime.document.project,
          runtime.document.view,
          runtime.selection.selected,
          type,
          rows ? { rows: +rows } : {},
        );
        runtime.selection.constructionContexts = [];
        runtime.selection.modifierContext = null;
      }, "Convertir trazado en construcción");
      editor.renderConstructionPalette(true);
      return;
    }
    if (name === "color") {
      editor.showColorPalette("fill");
      return;
    }
    if (["selectBoundary", "boundaryStitch", "selectParent"].includes(name)) {
      const region = editor.one(),
        target =
          name === "selectParent"
            ? editor.objects().find((o) => o.id === region?.panelOf)
            : region && panelBoundary(editor.objects(), region);
      if (target) {
        editor.selectId(target.id, false, true);
        if (name === "boundaryStitch") editor.construction("stitch", 2);
        else if (name === "selectBoundary") editor.toolSet("node");
      }
      return;
    }
    if (name === "clearEdges") {
      runtime.selection.edgeIds = [];
      runtime.selection.rangeSelections = {};
      editor.drawSelection();
      editor.contextBar();
      return;
    }
    if (name === "connectedEdges") {
      for (const o of editor.chosen().filter((o) => o.nodes)) {
        const ids = o.nodes
          .slice(0, o.nodes.length - (o.closed ? 0 : 1))
          .map((n) => n.edgeId);
        runtime.selection.rangeSelections[o.id] = ids;
        if (editor.one()) runtime.selection.edgeIds = ids;
      }
      editor.drawSelection();
      editor.contextBar();
      return;
    }
    if (["penNew", "penFinish", "penClose"].includes(name)) {
      if (name === "penClose" && runtime.interaction.pen)
        runtime.interaction.pen.closed = true;
      editor.finishPen();
      return;
    }
    if (name === "removeSelectedConstruction") {
      const refs = editor.activeConstructionRefs();
      if (refs.length)
        editor.commit(() => {
          removeConstructions(
            runtime.document.project,
            runtime.document.view,
            refs,
          );
          runtime.selection.constructionContexts = [];
          runtime.selection.modifierContext = null;
        }, "Quitar construcción");
      return;
    }
    if (["lockSelection", "hideSelection"].includes(name)) {
      const key = name === "lockSelection" ? "locked" : "hidden";
      editor.commit(
        () => {
          const id =
              runtime.selection.selectedGroup ||
              selectionIdentity(
                editor.chosen(),
                runtime.document.project.groups[runtime.document.view],
              )?.groupId,
            g = runtime.document.project.groups[runtime.document.view].find(
              (g) => g.id === id,
            );
          if (g) g[key] = !g[key];
          else editor.chosen().forEach((o) => (o[key] = !o[key]));
        },
        name === "lockSelection" ? "Cambiar bloqueo" : "Cambiar visibilidad",
      );
      return;
    }
    if (v3Action(name)) return;
    if (advancedAction(name)) return;
    switch (name) {
      case "stitch":
        editor.construction("stitch");
        break;
      case "double":
        editor.construction("stitch", 2);
        break;
      case "parallel":
        editor.construction("parallel");
        break;
      case "zipper":
        editor.construction("zipper");
        break;
      case "panel":
        v3Action("createPanel");
        break;
      case "duplicate":
        editor.duplicate();
        break;
      case "mirror":
        editor.mirror();
        break;
      case "dupMirror":
        editor.mirror(true);
        break;
      case "delete":
        editor.removeSelected();
        break;
      case "front":
        editor.reorder(true);
        break;
      case "back":
        editor.reorder(false);
        break;
      case "group":
        editor.group();
        break;
      case "ungroup":
        editor.ungroup();
        break;
      case "selectBody": {
        const body = editor.objects().find((o) => o.role === "body");
        if (body) editor.selectId(body.id, false, true);
        break;
      }
      case "selectSource": {
        const o = editor.one();
        if (o?.source) {
          editor.selectId(o.source, false, true);
          editor.toolSet("node");
        }
        break;
      }
      case "clip": {
        const o = editor
            .chosen()
            .find((o) => ["image", "text"].includes(o.type)),
          body =
            editor.chosen().find((o) => o.semanticType === "region") ||
            editor.objects().find((o) => o.role === "body" && o.closed);
        if (!body) {
          editor.toast("Esta vista no tiene un cuerpo cerrado para recortar");
          break;
        }
        if (o) editor.commit(() => (o.clip = o.clip ? null : body.id));
        break;
      }
      case "saveAs": {
        const p = clone(runtime.document.project);
        p.id = uid();
        p.name += " — copia";
        editor.open(p);
        editor.save();
        break;
      }
      case "curve":
      case "corner": {
        const o = editor.one();
        if (o?.type !== "path" || runtime.selection.nodeIndex < 0) {
          editor.toast("Seleccioná primero un nodo");
          break;
        }
        editor.commit(() => {
          const n = o.nodes[runtime.selection.nodeIndex];
          if (name === "corner") {
            delete n.in;
            delete n.out;
            n.kind = "corner";
          } else {
            const a =
                o.nodes[
                  (runtime.selection.nodeIndex - 1 + o.nodes.length) %
                    o.nodes.length
                ],
              b = o.nodes[(runtime.selection.nodeIndex + 1) % o.nodes.length],
              dx = (b.x - a.x) / 6,
              dy = (b.y - a.y) / 6;
            n.in = { x: n.x - dx, y: n.y - dy };
            n.out = { x: n.x + dx, y: n.y + dy };
            n.kind = "symmetric";
          }
        });
        break;
      }
      case "addNode": {
        const o = editor.one();
        if (o?.type === "path")
          editor.commit(() => {
            const idx =
              runtime.selection.nodeIndex >= 0
                ? runtime.selection.nodeIndex
                : 0;
            runtime.selection.nodeIndex =
              addSymmetricNode(
                o,
                Math.min(idx, o.nodes.length - (o.closed ? 1 : 2)),
                0.5,
                runtime.document.project.liveMirror,
              ) ?? runtime.selection.nodeIndex;
            runtime.selection.nodeIndices = [runtime.selection.nodeIndex];
          });
        break;
      }
      case "deleteNode": {
        const o = editor.one();
        if (o?.type === "path" && runtime.selection.nodeIndex >= 0) {
          if (o.nodes.length <= 2) {
            editor.toast("Un trazado necesita al menos dos nodos");
            break;
          }
          editor.commit(() => {
            if (
              !deleteSymmetricNode(
                o,
                runtime.selection.nodeIndex,
                runtime.document.project.liveMirror,
              )
            )
              editor.toast(
                "La forma necesita al menos " + (o.closed ? 3 : 2) + " nodos",
              );
            runtime.selection.nodeIndex = -1;
            runtime.selection.nodeIndices = [];
          });
        }
        break;
      }
    }
  }

  function context(e, id) {
    e.preventDefault();
    if (!id) return;
    const o = editor.objects().find((o) => o.id === id);
    if (!o) return;
    if (!runtime.selection.selected.includes(id))
      editor.selectId(id, false, true);
    runtime.selection.constructionContexts = [];
    runtime.selection.modifierContext = null;
    const c = $("#context"),
      button = (id, label) =>
        `<button data-action="${id}" ${toolInfo[learnKey(id)] ? `data-learn="${learnKey(id)}"` : ""}>${actionIcon(id)}<span class="menu-label">${label}</span><kbd>${{ group: "Ctrl G", ungroup: "Ctrl Shift G", duplicate: "Ctrl D", delete: "Del", editNodes: "A" }[id] || ""}</kbd></button>`,
      section = (label, items) =>
        `<details><summary>${label}</summary>${items.map(([a, b]) => button(a, b)).join("")}</details>`;
    let html =
      button("group", "Agrupar") +
      button("ungroup", "Desagrupar") +
      button("lockSelection", "Bloquear / desbloquear") +
      button("hideSelection", "Ocultar / mostrar") +
      "<hr>" +
      button("isolate", "Aislar pieza · Escape para salir") +
      button("smooth", "Suavizar trazado…") +
      button("stack", "Agregar caída / Stack") +
      button("createPanel", "Crear regiones de panel") +
      button("presets", "Presets de estilo…") +
      button(
        "editNodes",
        o.source ? "Editar trazado de origen" : "Editar nodos",
      );
    if (o.type === "path") {
      html += section("Agregar construcción", [
        ["stitch", "Costura simple"],
        ["double", "Costura doble"],
        ["parallel", "Paralela vinculada"],
        ["finish", "Terminación…"],
        ["panel", "Línea de panel"],
      ]);
      html += section(
        "Convertir en…",
        o.closed
          ? [
              ["rib", "Rib procedural"],
              ["elasticBand", "Banda elástica"],
              ["pocket", "Bolsillo con costura"],
              ["patch", "Parche"],
              ["graphicArea", "Área de gráfico"],
            ]
          : [
              ["convert:stitch", "Costura"],
              ["convert:stitch:2", "Costura doble"],
              ["convert:zipper", "Cierre"],
              ["convert:cord", "Cordón"],
              ["convert:piping", "Vivo"],
              ["convert:binding", "Bies"],
              ["convert:elastic", "Elástico"],
            ],
      );
      html += section("Geometría", [
        ["bend", "Curvar"],
        ["offset", "Offset editable…"],
        ["outline", "Contornear línea"],
        [
          o.closed ? "openPath" : "closePath",
          o.closed ? "Abrir trazado" : "Cerrar trazado",
        ],
        ["split", "Dividir en nodo"],
        ["mirrorGeom", "Espejo de geometría"],
      ]);
    }
    if (o.source) html += button("reverse", "Invertir dirección");
    if (o.source || o.modifiers?.length)
      html += button("freeze", "Convertir a vectores estáticos");
    if (runtime.selection.selected.length > 1)
      html += section("Combinar", [
        ["boolean:union", "Unión"],
        ["boolean:subtract", "Resta"],
        ["boolean:intersect", "Intersección"],
        ["boolean:difference", "Diferencia"],
        ["boolean:join", "Unir trazados"],
      ]);
    html += section("Simetría", [
      ["mirrorObjects", "Crear espejo vivo de objetos"],
      ["dupMirror", "Duplicar + reflejar"],
      ["mirror", "Reflejar X"],
      ["flipV", "Reflejar Y"],
      ["breakSymmetry", "Romper simetría"],
    ]);
    html +=
      "<hr>" +
      button("duplicate", "Duplicar") +
      button("front", "Adelante") +
      button("back", "Atrás") +
      button("delete", "Eliminar");
    if (runtime.selection.selected.length > 1) {
      const panel = editor
        .chosen()
        .some((o) => o.type === "path" && !o.closed && !o.source);
      html =
        button("group", "Agrupar") +
        button("ungroup", "Desagrupar") +
        button("lockSelection", "Bloquear / desbloquear") +
        button("hideSelection", "Ocultar / mostrar") +
        button("color", "Relleno") +
        (editor.chosen().some((o) => ["image", "text"].includes(o.type)) &&
        editor.chosen().some((o) => o.semanticType === "region")
          ? button("clip", "Recortar al panel")
          : "") +
        (panel ? button("createPanel", "Crear paneles") : "") +
        section("Construcción", [
          ["stitch", "Costura"],
          ["double", "Doble costura"],
        ]) +
        section("Simetría", [
          ["mirrorObjects", "Crear espejo vivo"],
          ["dupMirror", "Duplicar + reflejar"],
          ["breakSymmetry", "Romper simetría"],
        ]) +
        button("duplicate", "Duplicar") +
        button("delete", "Eliminar");
    }
    html += `<details><summary>Trazado · Pathfinder</summary>${pathfinderHtml(editor.chosen())}</details>`;
    c.innerHTML =
      button("commandPalette", "Todas las acciones…") +
      button("exportSelection", "Exportar selección…") +
      button("revealLayers", "Mostrar en Capas") +
      html;
    c.classList.remove("hidden");
    c.style.left = Math.max(5, Math.min(e.clientX, innerWidth - 230)) + "px";
    const top = Math.max(
      5,
      Math.min(e.clientY, innerHeight - c.offsetHeight - 15),
    );
    c.style.top = top + "px";
    c.style.maxHeight = innerHeight - top - 10 + "px";
  }

  function closeContext() {
    $("#context").classList.add("hidden");
  }

  function alignment(mode) {
    const os = editor.chosen();
    if (os.length < 2) return;
    editor.commit(() => {
      const box = union(os, editor.objects()),
        bs = os.map((o) => ({ o, b: bounds(o, editor.objects()) }));
      if (mode === "dx" || mode === "dy") {
        const horizontal = mode === "dx",
          pos = horizontal ? "x" : "y",
          size = horizontal ? "w" : "h",
          sorted = bs.sort((a, b) => a.b[pos] - b.b[pos]);
        const start = sorted[0].b[pos],
          end = sorted.at(-1).b[pos] + sorted.at(-1).b[size],
          total = sorted.reduce((n, v) => n + v.b[size], 0),
          gap =
            sorted.length > 1 ? (end - start - total) / (sorted.length - 1) : 0;
        let cursor = start;
        for (const { o, b } of sorted) {
          const id = editor.sourceFor(o).id,
            source = editor.objects().find((o) => o.id === id);
          source.matrix = mul(
            translate(
              horizontal ? cursor - b.x : 0,
              horizontal ? 0 : cursor - b.y,
            ),
            source.matrix,
          );
          cursor += b[size] + gap;
        }
        return;
      }
      for (const { o, b } of bs) {
        let dx = 0,
          dy = 0;
        if (mode === "left") dx = box.x - b.x;
        if (mode === "cx") dx = box.x + box.w / 2 - b.x - b.w / 2;
        if (mode === "right") dx = box.x + box.w - b.x - b.w;
        if (mode === "top") dy = box.y - b.y;
        if (mode === "cy") dy = box.y + box.h / 2 - b.y - b.h / 2;
        if (mode === "bottom") dy = box.y + box.h - b.y - b.h;
        const source = editor.sourceFor(o);
        source.matrix = mul(translate(dx, dy), source.matrix);
      }
    });
  }

  function freeze() {
    const o = editor.one();
    if (!o) return;
    editor.commit(() => {
      const g = uid();
      if (o.source) {
        const source = editor.sourceFor(o),
          parts = freezeParts(effectParts(o, source), o.name);
        parts.forEach((p) => {
          p.group = g;
          p.symmetryExcluded = true;
        });
        runtime.document.project.views[runtime.document.view] = editor
          .objects()
          .filter((p) => p.id !== o.id);
        editor.insertObjects(parts);
        runtime.selection.selected = parts.map((p) => p.id);
      } else if (o.type === "path" && o.modifiers?.length) {
        const parts = freezeParts(modifierParts(o), o.name),
          base = worldPath(o);
        detachInstances(runtime.document.project, runtime.document.view, [
          o.id,
        ]);
        breakSymmetry(editor.objects(), [o.id]);
        Object.assign(o, {
          nodes: base.nodes,
          subpaths: base.subpaths,
          matrix: I(),
          modifiers: [],
          group: g,
        });
        delete o.component;
        parts.forEach((p) => {
          p.group = g;
          p.symmetryExcluded = true;
        });
        editor.insertObjects(parts);
        runtime.selection.selected = [o.id, ...parts.map((p) => p.id)];
      }
    });
    editor.toast(
      "Convertido a trazados estáticos · Ctrl Z restaura los modificadores",
    );
  }

  function advancedAction(name) {
    const o = editor.one();
    if (name === "centerGarment") {
      const b =
        selectionBounds(editor.chosen(), editor.objects()) ||
        union(editor.chosen(), editor.objects());
      if (b)
        editor.commit(() =>
          editor.applyTransform(
            translate(
              (runtime.document.project.centerAxis ?? 350) - b.x - b.w / 2,
              0,
            ),
          ),
        );
      return true;
    }
    if (name === "guide") {
      editor.modal(
        '<h2>Guía de alineación</h2><p>Se guarda en la vista actual y funciona con el imán.</p><div class="fields"><div class="field"><label>Dirección</label><select id="guide-direction"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></div><div class="field"><label>Posición</label><input id="guide-position" type="number" step="0.1" value="350"></div></div><div class="dialog-actions"><button data-action="clearGuides" id="clear-guides">Quitar guías</button><button data-close>Cancelar</button><button id="create-guide" class="primary">Agregar</button></div>',
        (e, d) => {
          if (e.target.id === "create-guide") {
            const position = Number($("#guide-position").value);
            if (!Number.isFinite(position)) return;
            editor.commit(() => {
              runtime.document.project.guides ??= { front: [], back: [] };
              runtime.document.project.guides[runtime.document.view].push({
                id: uid(),
                direction: $("#guide-direction").value,
                position,
              });
            });
            d.close();
          }
          if (e.target.id === "clear-guides") {
            editor.commit(() => {
              runtime.document.project.guides ??= { front: [], back: [] };
              runtime.document.project.guides[runtime.document.view] = [];
            });
            d.close();
          }
        },
      );
      return true;
    }
    if (name.startsWith("modRemove:")) {
      const id = name.split(":")[1];
      if (o)
        editor.commit(
          () =>
            removeConstructions(
              runtime.document.project,
              runtime.document.view,
              [{ ownerId: o.id, modifierId: id }],
            ),
          "Eliminar modificador",
        );
      return true;
    }
    if (name.startsWith("mod")) {
      const [cmd, id] = name.split(":");
      if (!o?.modifiers) return true;
      editor.commit(() => {
        const i = o.modifiers.findIndex((m) => m.id === id);
        if (i < 0) return;
        if (cmd === "modRemove") o.modifiers.splice(i, 1);
        else {
          const j = i + (cmd === "modUp" ? -1 : 1);
          if (
            j >= 0 &&
            j < o.modifiers.length &&
            o.modifiers[j].type !== "bend"
          )
            [o.modifiers[i], o.modifiers[j]] = [o.modifiers[j], o.modifiers[i]];
        }
      });
      return true;
    }
    if (name.startsWith("selectEffect:")) {
      editor.selectId(name.split(":")[1], false, true);
      editor.toolSet("select");
      return true;
    }
    if (name.startsWith("align:")) {
      alignment(name.split(":")[1]);
      return true;
    }
    if (name.startsWith("boolean:")) {
      try {
        if (editor.chosen().some((o) => o.gradient))
          throw Error(
            "Convertí una copia con relleno sólido antes de combinar degradados.",
          );
        if (
          editor
            .chosen()
            .some(
              (o) =>
                o.panelOf ||
                o.surfaceBoundaryIds ||
                o.panelCuts?.length ||
                o.construction,
            )
        )
          throw Error(
            "Conservá los paneles y construcciones vinculados. Convertí una copia en trazado independiente para combinarla.",
          );
        const operation = name.split(":")[1],
          result =
            operation === "join"
              ? joinPaths(editor.chosen())
              : booleanPaths(editor.chosen(), operation);
        editor.commit(() => editor.replaceWith(result));
      } catch (e) {
        editor.toast(e.message);
      }
      return true;
    }
    if (name === "liveToggle") {
      $("#live-mirror").click();
      return true;
    }
    if (name === "mirrorObjects") {
      editor.mirrorObjects();
      return true;
    }
    if (name === "mirrorGeom") {
      const base = editor.sourceFor(o);
      if (base?.type !== "path") return true;
      editor.commit(() => {
        geometryMirror(base, runtime.document.project.centerAxis ?? 350);
        if (!Object.keys(base.symmetry.pairs).length) {
          const reverse = clone(base.nodes)
            .reverse()
            .map((n) => {
              const q = point(
                inverse(base.matrix),
                mirrorPoint(
                  point(base.matrix, n),
                  runtime.document.project.centerAxis ?? 350,
                ),
              );
              q.nid = uid();
              if (n.out)
                q.in = point(
                  inverse(base.matrix),
                  mirrorPoint(
                    point(base.matrix, n.out),
                    runtime.document.project.centerAxis ?? 350,
                  ),
                );
              if (n.in)
                q.out = point(
                  inverse(base.matrix),
                  mirrorPoint(
                    point(base.matrix, n.in),
                    runtime.document.project.centerAxis ?? 350,
                  ),
                );
              return q;
            });
          base.nodes.push(...reverse);
          base.closed = true;
          geometryMirror(base, runtime.document.project.centerAxis ?? 350);
        }
        for (let i = 0; i < base.nodes.length; i++)
          if (
            point(base.matrix, base.nodes[i]).x <
            runtime.document.project.centerAxis
          )
            syncNode(base, i);
        runtime.document.project.liveMirror = true;
        runtime.selection.selected = [base.id];
      });
      return true;
    }
    if (name === "breakSymmetry") {
      editor.commit(() => {
        const ids = graphIds(editor.objects(), runtime.selection.selected, {
          includeOwners: false,
        });
        detachInstances(runtime.document.project, runtime.document.view, ids);
        breakSymmetry(editor.objects(), ids);
      });
      return true;
    }
    if (name === "flipV") {
      const b =
        selectionBounds(editor.chosen(), editor.objects()) ||
        union(editor.chosen(), editor.objects());
      if (b)
        editor.commit(() =>
          editor.applyTransform(around(b.x + b.w / 2, b.y + b.h / 2, 1, -1)),
        );
      return true;
    }
    if (name === "bend" || name === "rib") {
      editor.addModifier(name);
      return true;
    }
    if (
      [
        "cord",
        "piping",
        "binding",
        "elastic",
        "buttons",
        "eyelets",
        "trim",
        "raw",
      ].includes(name)
    ) {
      editor.construction(name);
      return true;
    }
    if (name === "addModifierV2") {
      editor.modal(
        '<h2>Agregar modificador</h2><p>La geometría permanece editable. Curvar se evalúa antes de las terminaciones.</p><div class="prop-buttons">' +
          [
            ["bend", "Curvar"],
            ["rib", "Rib"],
            ["stitch", "Costura"],
            ["double", "Costura doble"],
            ["elastic", "Elástico"],
            ["piping", "Vivo"],
            ["binding", "Bies"],
          ]
            .map(([id, n]) => `<button data-add-mod="${id}">${n}</button>`)
            .join("") +
          '</div><div class="dialog-actions"><button data-close>Cerrar</button></div>',
        (e, d) => {
          const b = e.target.closest("[data-add-mod]");
          if (b) {
            editor.addModifier(
              b.dataset.addMod === "double" ? "stitch" : b.dataset.addMod,
              b.dataset.addMod === "double" ? { rows: 2 } : {},
            );
            d.close();
          }
        },
      );
      return true;
    }
    if (name === "finish") {
      editor.modal(
        '<h2>Agregar terminación</h2><p>Presets de construcción vinculados al borde elegido.</p><div class="prop-buttons">' +
          [
            ["simple", "Dobladillo simple"],
            ["double", "Dobladillo doble"],
            ["doubleStitch", "Dobladillo con doble pespunte"],
            ["raw", "Borde crudo"],
            ["rib", "Borde rib"],
            ["piping", "Vivo / bies"],
          ]
            .map(([id, n]) => `<button data-finish="${id}">${n}</button>`)
            .join("") +
          '</div><div class="dialog-actions"><button data-close>Cerrar</button></div>',
        (e, d) => {
          const b = e.target.closest("[data-finish]");
          if (b) {
            editor.finishPreset(b.dataset.finish);
            d.close();
          }
        },
      );
      return true;
    }
    if (name === "offset") {
      editor.modal(
        '<h2>Offset editable</h2><p>Distancia positiva o negativa. El resultado será un trazado independiente.</p><input id="offset-distance" type="number" step="0.1" value="6"><div class="dialog-actions"><button data-close>Cancelar</button><button id="offset-apply" class="primary">Crear trazado</button></div>',
        (e, d) => {
          if (e.target.id === "offset-apply") {
            const source = editor.sourceFor(editor.one());
            try {
              const result = offsetEditable(
                source,
                Number($("#offset-distance").value),
              );
              if (result)
                editor.commit(() => {
                  editor.insertObjects([result]);
                  runtime.selection.selected = [result.id];
                });
              d.close();
            } catch (err) {
              if ($("#modal").open) editor.dialogError(err.message);
              else editor.toast(err.message);
            }
          }
        },
      );
      return true;
    }
    if (name === "outline") {
      try {
        const result = outlineStroke(editor.sourceFor(o));
        if (result) editor.commit(() => editor.replaceWith(result));
      } catch (e) {
        editor.toast(e.message);
      }
      return true;
    }
    if (name === "freeze") {
      freeze();
      return true;
    }
    if (name === "reverse") {
      const base = editor.sourceFor(o);
      if (base?.nodes)
        editor.commit(() => {
          reversePath(base);
          if (base.symmetry)
            geometryMirror(base, runtime.document.project.centerAxis ?? 350);
        });
      return true;
    }
    if (name === "editNodes") {
      const base = editor.sourceFor(o);
      if (base?.type === "path") {
        editor.selectId(base.id, false, true);
        editor.toolSet("node");
      }
      return true;
    }
    if (
      ["closePath", "openPath", "split", "joinNodes", "breakHandles"].includes(
        name,
      )
    ) {
      if (o?.type !== "path") return true;
      editor.commit(() => {
        if (name === "closePath") {
          o.closed = true;
          if (
            o.nodes.length > 2 &&
            Math.hypot(
              o.nodes[0].x - o.nodes.at(-1).x,
              o.nodes[0].y - o.nodes.at(-1).y,
            ) < 0.01
          ) {
            o.nodes[0].in = o.nodes.at(-1).in;
            o.nodes.pop();
          }
          if (o.symmetry)
            geometryMirror(o, runtime.document.project.centerAxis ?? 350);
        }
        if (name === "openPath") {
          breakSymmetry(editor.objects(), [o.id]);
          o.closed = false;
        }
        if (name === "split") {
          breakSymmetry(editor.objects(), [o.id]);
          const result = splitPath(o, runtime.selection.nodeIndex);
          if (result?.length) {
            editor.insertObjects(result);
            runtime.selection.selected = [o.id, ...result.map((o) => o.id)];
            runtime.interaction.tool = "select";
          }
          runtime.selection.nodeIndices = [];
          runtime.selection.nodeIndex = -1;
        }
        if (name === "breakHandles")
          for (const i of runtime.selection.nodeIndices) {
            o.nodes[i].kind = "corner";
          }
        if (name === "joinNodes") {
          if (runtime.selection.nodeIndices.length < 2) {
            editor.toast("Seleccioná dos nodos con Shift + clic");
            return;
          }
          const indices = [...runtime.selection.nodeIndices].sort(
              (a, b) => a - b,
            ),
            a = o.nodes[indices[0]],
            b = o.nodes[indices.at(-1)];
          if (
            !o.closed &&
            indices[0] === 0 &&
            indices.at(-1) === o.nodes.length - 1
          ) {
            a.x = (a.x + b.x) / 2;
            a.y = (a.y + b.y) / 2;
            a.in = b.in;
            o.nodes.pop();
            o.closed = true;
          } else {
            a.x = (a.x + b.x) / 2;
            a.y = (a.y + b.y) / 2;
            a.out = b.out;
            o.nodes.splice(indices.at(-1), 1);
          }
          if (o.symmetry)
            geometryMirror(o, runtime.document.project.centerAxis ?? 350);
          runtime.selection.nodeIndices = [];
          runtime.selection.nodeIndex = -1;
        }
      });
      return true;
    }
    if (["pocket", "patch", "graphicArea", "elasticBand"].includes(name)) {
      if (o?.type !== "path" || !o.closed) return true;
      editor.commit(() => {
        o.role = {
          pocket: "pocket",
          patch: "patch",
          graphicArea: "graphicArea",
          elasticBand: "elasticBand",
        }[name];
        o.name = {
          pocket: "Bolsillo",
          patch: "Parche",
          graphicArea: "Área de gráfico",
          elasticBand: "Banda elástica",
        }[name];
        if (name === "pocket") {
          o.modifiers ??= [];
          o.modifiers.push(modifier("stitch", { offset: 4 }));
        }
        if (name === "elasticBand") {
          o.modifiers ??= [];
          o.modifiers.push(
            modifier("rib", { spacing: 9, direction: "horizontal" }),
          );
        }
      });
      return true;
    }
    return false;
  }

  function v3Action(name) {
    const o = editor.one();
    if (name === "editConstruction") {
      if (!editor.activeConstructionRefs().length && o?.modifiers?.length) {
        runtime.selection.modifierContext = o.modifiers.at(-1).id;
        runtime.selection.constructionContexts = [
          { ownerId: o.id, modifierId: runtime.selection.modifierContext },
        ];
      }
      runtime.workspace.paletteClosedKey = null;
      editor.renderConstructionPalette(true);
      return true;
    }
    if (name.startsWith("selectModifier:")) {
      runtime.selection.modifierContext = name.split(":")[1];
      runtime.selection.constructionContexts = [
        { ownerId: o.id, modifierId: runtime.selection.modifierContext },
      ];
      runtime.workspace.paletteClosedKey = null;
      editor.renderConstructionPalette(true);
      editor.drawSelection();
      return true;
    }
    if (name === "history") {
      editor.toggleHistory();
      return true;
    }
    if (name === "moveHint") {
      editor.toast(
        "Arrastrá el control de movimiento · o Ctrl + arrastrar dentro de Nodos",
      );
      return true;
    }
    if (name === "modifierFocus") {
      runtime.selection.modifierContext = o?.modifiers?.[0]?.id;
      runtime.selection.constructionContexts = runtime.selection.modifierContext
        ? [{ ownerId: o.id, modifierId: runtime.selection.modifierContext }]
        : [];
      editor.renderConstructionPalette(true);
      return true;
    }
    if (name === "dimensions") {
      editor.dimensionDialog();
      return true;
    }
    if (name === "editEdges") {
      if (editor.one()?.source)
        editor.selectId(editor.one().source, false, true);
      editor.toolSet("edge");
      runtime.selection.edgeIds = [];
      editor.contextBar();
      editor.drawSelection();
      return true;
    }
    if (name === "editAnchors") {
      editor.toolSet("node");
      runtime.interaction.editMode = "nodes";
      editor.contextBar();
      return true;
    }
    if (name.startsWith("nodeType:")) {
      editor.setProperty("nodeKind", name.split(":")[1]);
      return true;
    }
    if (name === "hem") {
      editor.finishPreset("simple");
      return true;
    }
    if (name === "relink") {
      const id = editor.one()?.id;
      if (id)
        editor.commit(() =>
          relinkStructure(runtime.document.project, runtime.document.view, id),
        );
      return true;
    }
    if (name === "settings") {
      editor.settingsDialog();
      return true;
    }
    if (name === "presets") {
      editor.presetsDialog();
      return true;
    }
    if (name === "variants") {
      editor.variantDialog();
      return true;
    }
    if (name === "exitIsolation") {
      runtime.selection.isolation.pop();
      runtime.selection.editingGroup =
        runtime.selection.isolation.at(-1) || null;
      editor.toolSet("select");
      editor.render();
      return true;
    }
    if (name === "isolate") {
      const scope =
        selectionIdentity(
          editor.chosen(),
          runtime.document.project.groups[runtime.document.view],
        )?.groupId ||
        o?.group ||
        o?.source ||
        o?.id;
      if (scope) {
        runtime.selection.isolation.push(scope);
        runtime.selection.editingGroup = runtime.document.project.groups[
          runtime.document.view
        ].some((g) => g.id === scope)
          ? scope
          : null;
        editor.render();
      }
      return true;
    }
    if (name === "detachComponent") {
      if (o?.component)
        editor.commit(() => {
          const p = evaluatedPath(o);
          o.nodes = clone(p.nodes);
          delete o.component;
        });
      return true;
    }
    if (name === "editNodes" && o?.component) {
      editor.commit(() => {
        o.nodes = clone(evaluatedPath(o).nodes);
        delete o.component;
      });
      editor.toolSet("node");
      return true;
    }
    if (name === "smooth") {
      if (editor.sourceFor(o)?.type !== "path") return true;
      editor.modal(
        '<h2>Suavizar trazado</h2><p>Ajusta los tiradores conservando nodos, extremos y contornos. Ctrl Z restaura la forma original.</p><label>Suavizado <input id="smooth-amount" type="range" min="0" max="100" value="55"></label><div class="dialog-actions"><button data-close>Cancelar</button><button class="primary" id="smooth-apply">Aplicar</button></div>',
        (e, d) => {
          if (e.target.id === "smooth-apply") {
            editor.commit(() =>
              smoothPath(
                editor.sourceFor(editor.one()),
                Number($("#smooth-amount").value),
              ),
            );
            d.close();
          }
        },
      );
      return true;
    }
    if (name === "stack") {
      editor.modal(
        '<h2>Caída de tela · Stack</h2><p>Contorno e interiores vectoriales vinculados a la zona del ruedo.</p><div class="prop-buttons">' +
          [
            ["stackSlight", "Suave"],
            ["stackMedium", "Medio"],
            ["stackHeavy", "Fuerte"],
          ]
            .map(([id, n]) => `<button data-stack="${id}">${n}</button>`)
            .join("") +
          '</div><div class="dialog-actions"><button data-close>Cerrar</button></div>',
        (e, d) => {
          const b = e.target.closest("[data-stack]");
          if (b) {
            editor.addModifier("fabricFall", stackPreset(b.dataset.stack));
            d.close();
          }
        },
      );
      return true;
    }
    if (["pleat", "quilt", "distress", "fabricFall"].includes(name)) {
      editor.addModifier(name);
      return true;
    }
    if (name === "createPanel") {
      editor.panelMethodChooser();
      return true;
    }
    if (name === "selectPanelEdges") {
      editor.beginPanelEdges();
      return true;
    }
    if (name === "selectPanelArea") {
      editor.beginPanelEdges(null, "area");
      return true;
    }
    if (name === "addModifier") {
      editor.modal(
        '<h2>Agregar modificador</h2><p>Los resultados siguen la geometría de origen.</p><div class="prop-buttons">' +
          [
            ["bend", "Curvar"],
            ["rib", "Rib"],
            ["stitch", "Costura"],
            ["elastic", "Elástico"],
            ["piping", "Vivo"],
            ["binding", "Bies"],
            ["fabricFall", "Caída / Stack"],
            ["pleat", "Pliegues"],
            ["quilt", "Quilt"],
            ["raw", "Borde crudo"],
            ["distress", "Desgaste"],
          ]
            .map(([id, n]) => `<button data-add-mod="${id}">${n}</button>`)
            .join("") +
          '</div><div class="dialog-actions"><button data-close>Cerrar</button></div>',
        (e, d) => {
          const b = e.target.closest("[data-add-mod]");
          if (b) {
            editor.addModifier(b.dataset.addMod);
            d.close();
          }
        },
      );
      return true;
    }
    return false;
  }

  function commandItems() {
    return [
      ...primaryTools.map((id) => ({
        id: "tool:" + id,
        label: toolInfo[id].name,
        shortcut: toolInfo[id].shortcut,
      })),
      ...extraTools.map(([id, label, shortcut]) => ({
        id: "tool:" + id,
        label,
        shortcut,
      })),
      ...[
        ["simplify", "Simplificar trazado…"],
        ["cleanPath", "Limpiar puntos redundantes"],
        ["smooth", "Suavizar tiradores…"],
        ["compound", "Crear trazado compuesto"],
        ["releaseCompound", "Separar contornos"],
        ["shear", "Inclinar selección…"],
        ["gradientFill", "Aplicar degradado"],
        ["removeGradient", "Quitar degradado"],
        ["appearance", "Apariencia de línea y fusión…"],
        ["clipSelection", "Recortar gráfico con forma seleccionada"],
        ["removeClip", "Quitar recorte"],
        ["exportSelection", "Exportar selección…"],
        ["createPanel", "Crear panel"],
        ["selectPanelEdges", "Crear panel: seleccionar bordes"],
        ["regionsFromLines", "Crear regiones desde trazados"],
        ["pathfinder:divide", "Dividir formas en regiones"],
        ["pathfinder:trim", "Recortar partes superpuestas"],
        ["pathfinder:merge", "Fusionar partes del mismo color"],
        ["pathfinder:crop", "Recortar con la forma frontal"],
        ["pathfinder:minusBack", "Restar fondo"],
        ["boolean:union", "Unir formas"],
        ["boolean:subtract", "Restar frente"],
        ["boolean:intersect", "Intersecar formas"],
        ["boolean:difference", "Excluir formas"],
        ["boolean:join", "Unir trazados abiertos"],
        ["offset", "Desplazar trazado…"],
        ["outline", "Contornear línea"],
        ["revealLayers", "Mostrar selección en Capas"],
        ["group", "Agrupar selección"],
        ["ungroup", "Desagrupar selección"],
        ["breakSymmetry", "Romper simetría"],
        ["mirrorObjects", "Espejo vivo"],
        ["fabric", "Textura de tela"],
        ["traceImage", "Vectorizar imagen en blanco y negro…"],
      ].map(([id, label]) => ({ id, label, shortcut: "" })),
    ];
  }

  function commandPalette() {
    editor.modal(
      '<h2>Herramientas y acciones</h2><input id="command-query" type="search" placeholder="Buscar herramienta o acción…" aria-label="Buscar acciones" autocomplete="off"><div id="command-results" class="command-results"></div>',
      (e, d) => {
        const b = e.target.closest("[data-command]");
        if (b) {
          d.close();
          runCommand(b.dataset.command);
        }
      },
    );
    const draw = () => {
      const items = searchCommands(commandItems(), $("#command-query").value);
      $("#command-results").innerHTML =
        items
          .map(
            (item) =>
              `<button data-command="${esc(item.id)}" ${unavailable(item.id, editor.chosen()) ? "disabled" : ""} title="${esc(unavailable(item.id, editor.chosen()) || item.label)}">${uiIcon(item.id.startsWith("tool:") ? item.id.slice(5) : "path")}<span>${esc(item.label)}</span><kbd>${esc(item.shortcut)}</kbd></button>`,
          )
          .join("") || "<p>No hay acciones que coincidan.</p>";
    };
    draw();
    $("#command-query").oninput = draw;
    $("#command-query").onkeydown = (e) => {
      if (e.key === "Enter") {
        const item = searchCommands(commandItems(), e.target.value).find(
          (item) => !unavailable(item.id, editor.chosen()),
        );
        if (item) {
          e.preventDefault();
          $("#modal").close();
          runCommand(item.id);
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        $("#command-results").querySelector(":is(button:not([disabled]),sp-button:not([disabled]),sp-action-button:not([disabled]),sp-menu-item:not([disabled]))")?.focus();
      }
    };
    $("#command-results").onkeydown = (e) => {
      if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
      e.preventDefault();
      const buttons = [
          ...$("#command-results").querySelectorAll(":is(button:not([disabled]),sp-button:not([disabled]),sp-action-button:not([disabled]),sp-menu-item:not([disabled]))"),
        ],
        i = buttons.indexOf(e.target);
      buttons[
        (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
      ]?.focus();
    };
    $("#command-query").focus();
  }

  function runCommand(id) {
    const why = unavailable(id, editor.chosen());
    if (why) {
      editor.status(why);
      editor.toast(why);
      return false;
    }
    if (id.startsWith("tool:")) editor.toolSet(id.slice(5));
    else action(id);
    return true;
  }

  function editableStandalone(o) {
    return (
      o?.type === "path" &&
      !o.source &&
      !o.panelOf &&
      !o.construction &&
      !o.component &&
      !o.modifiers?.length &&
      !o.garmentSurface &&
      !o.surfaceBoundaryIds &&
      !o.structureKey &&
      o.category !== "structure"
    );
  }

  function professionalAction(name) {
    if (name === "simplify") {
      const o = editor.one();
      if (!editableStandalone(o)) {
        editor.toast("Seleccioná un trazado independiente para simplificar");
        return true;
      }
      editor.modal(
        '<h2>Simplificar trazado</h2><p>Reduce nodos conservando esquinas y contornos. La tolerancia se mide en las coordenadas del trazado.</p><label class="field">Tolerancia<input id="simplify-tolerance" type="number" min="0.01" max="10" step=".1" value=".5"></label><div class="dialog-actions"><button data-close>Cancelar</button><button id="simplify-apply" class="primary">Aplicar</button></div>',
        (e, d) => {
          if (e.target.id === "simplify-apply") {
            try {
              editor.commit(
                () =>
                  simplifyCurves(
                    editor.one(),
                    Number($("#simplify-tolerance").value),
                  ),
                "Simplificar trazado",
              );
              d.close();
            } catch (err) {
              if ($("#modal").open) editor.dialogError(err.message);
              else editor.toast(err.message);
            }
          }
        },
      );
      return true;
    }

    if (name.startsWith("pathfinder:")) {
      const os = editor.chosen();
      try {
        if (os.some((o) => o.gradient))
          throw Error(
            "Estas operaciones requieren rellenos sólidos; conservá una copia del degradado.",
          );
        if (os.some((o) => !editableStandalone(o)))
          throw Error(
            "Estas operaciones requieren formas independientes. Conservá las construcciones y paneles vinculados.",
          );
        const results = pathfinder(os, name.split(":")[1]);
        editor.commit(
          () => {
            const ids = graphIds(editor.objects(), runtime.selection.selected);
            runtime.document.project.views[runtime.document.view] = editor
              .objects()
              .filter((o) => !ids.includes(o.id));
            editor.insertObjects(results);
            runtime.selection.selected = results.map((o) => o.id);
          },
          "Operación vectorial: " + name.split(":")[1],
        );
      } catch (e) {
        editor.toast(e.message);
      }
      return true;
    }

    if (name === "commandPalette") {
      commandPalette();
      return true;
    }
    if (name === "exportSelection") {
      if ($("#modal").open) $("#modal").close();
      editor.exportSelectionDialog();
      return true;
    }
    if (name === "regionsFromLines") {
      buildRegions();
      return true;
    }
    if (name === "traceImage") {
      editor.traceImageDialog();
      return true;
    }
    if (name === "appearance") {
      if (!runtime.selection.selected.length) {
        editor.toast("Seleccioná una pieza o gráfico");
        return true;
      }
      const o = editor.one() || editor.chosen()[0];
      editor.modal(
        `<h2>Apariencia</h2><div class="fields">${selectField(
          "appearanceCap",
          "Extremo de línea",
          o.lineCap || "round",
          [
            ["butt", "Recto"],
            ["round", "Redondo"],
            ["square", "Cuadrado"],
          ],
        )}${selectField(
          "appearanceJoin",
          "Unión de línea",
          o.lineJoin || "round",
          [
            ["miter", "Ángulo"],
            ["round", "Redonda"],
            ["bevel", "Bisel"],
          ],
        )}${selectField(
          "appearanceBlend",
          "Fusión",
          o.blendMode || "normal",
          blendModes.map((v) => [
            v,
            {
              normal: "Normal",
              multiply: "Multiplicar",
              screen: "Trama",
              overlay: "Superponer",
              darken: "Oscurecer",
              lighten: "Aclarar",
            }[v],
          ]),
        )}</div><div class="dialog-actions"><button data-close>Cancelar</button><button id="appearance-apply" class="primary">Aplicar</button></div>`,
        (e, d) => {
          if (e.target.id === "appearance-apply") {
            const read = (k) => d.querySelector(`[data-prop="${k}"]`).value;
            editor.commit(
              () =>
                editor
                  .chosen()
                  .forEach((o) =>
                    Object.assign(o, {
                      lineCap: read("appearanceCap"),
                      lineJoin: read("appearanceJoin"),
                      blendMode: read("appearanceBlend"),
                    }),
                  ),
              "Editar apariencia",
            );
            d.close();
          }
        },
      );
      return true;
    }
    if (name === "shear") {
      if (!runtime.selection.selected.length) return true;
      editor.modal(
        '<h2>Inclinar selección</h2><label class="field">Ángulo<input id="shear-angle" type="number" min="-84" max="84" value="15"></label><div class="dialog-actions"><button data-close>Cancelar</button><button id="shear-apply" class="primary">Aplicar</button></div>',
        (e, d) => {
          if (e.target.id === "shear-apply") {
            try {
              const b =
                selectionBounds(editor.chosen(), editor.objects()) ||
                union(editor.chosen());
              const m = shearMatrix(
                Number($("#shear-angle").value),
                b.x + b.w / 2,
                b.y + b.h / 2,
              );
              editor.commit(
                () => editor.applyTransform(m),
                "Inclinar selección",
              );
              d.close();
            } catch (err) {
              if ($("#modal").open) editor.dialogError(err.message);
              else editor.toast(err.message);
            }
          }
        },
      );
      return true;
    }
    if (["gradientFill", "removeGradient"].includes(name)) {
      if (!runtime.selection.selected.length) return true;
      editor.commit(
        () =>
          editor
            .chosen()
            .filter((o) => o.type === "path")
            .forEach((o) => {
              if (name === "removeGradient") delete o.gradient;
              else
                linearGradient(
                  o,
                  o.fill?.match(/^#[\da-f]{6}$/i) ? o.fill : "#ffffff",
                );
            }),
        "Editar degradado",
      );
      if (name === "gradientFill") editor.toolSet("gradient");
      return true;
    }
    if (name === "clipSelection") {
      const closed = editor
          .chosen()
          .filter((o) => o.type === "path" && o.closed),
        graphics = editor
          .chosen()
          .filter(
            (o) =>
              ["image", "text"].includes(o.type) || o.category === "graphic",
          );
      if (closed.length !== 1 || !graphics.some((o) => o !== closed[0])) {
        editor.toast(
          "Seleccioná un contorno cerrado y el gráfico que querés recortar",
        );
        return true;
      }
      editor.commit(
        () =>
          graphics
            .filter((o) => o !== closed[0])
            .forEach((o) => (o.clip = closed[0].id)),
        "Recortar gráfico",
      );
      return true;
    }
    if (name === "removeClip") {
      editor.commit(
        () => editor.chosen().forEach((o) => delete o.clip),
        "Quitar recorte",
      );
      return true;
    }
    if (["cleanPath", "compound", "releaseCompound"].includes(name)) {
      try {
        const os = editor.chosen();
        if (os.some((o) => !editableStandalone(o))) {
          editor.toast(
            "Usá estas operaciones sobre trazados independientes; las construcciones conservan sus vínculos",
          );
          return true;
        }
        if (name === "compound") {
          const result = compoundPaths(os);
          editor.commit(
            () => editor.replaceWith(result),
            "Crear trazado compuesto",
          );
        } else
          editor.commit(
            () => {
              for (const o of os) {
                if (name === "cleanPath") cleanPath(o);
                else editor.insertObjects(releaseCompound(o));
              }
            },
            name === "cleanPath" ? "Limpiar trazado" : "Separar contornos",
          );
      } catch (e) {
        editor.toast(e.message);
      }
      return true;
    }
    return false;
  }

  function buildRegions() {
    try {
      const targets = editor.chosen().filter((o) => o.type === "path");
      if (!targets.length) {
        editor.toast("Seleccioná los trazados que encierran las regiones");
        return;
      }
      const regions = planarRegions(targets);
      if (!regions.length) {
        editor.toast(
          "Los trazados no encierran una región. Conectá o cruzá sus extremos.",
        );
        return;
      }
      editor.commit(() => {
        editor.insertObjects(regions);
        runtime.selection.selected = regions.map((o) => o.id);
      }, "Crear regiones de prenda");
      editor.toast(
        regions.length + " regiones creadas · construcciones conservadas",
      );
    } catch (err) {
      if ($("#modal").open) editor.dialogError(err.message);
      else editor.toast(err.message);
    }
  }

  function shapeBuilderFace(p) {
    if (!runtime.interaction.shapeBuilderState) return null;
    const os = editor
      .objects()
      .filter((o) => runtime.interaction.shapeBuilderState.ids.includes(o.id));
    if (
      JSON.stringify(os) !== runtime.interaction.shapeBuilderState.signature
    ) {
      runtime.interaction.shapeBuilderState.signature = JSON.stringify(os);
      try {
        runtime.interaction.shapeBuilderState.faces = planarRegions(os);
      } catch (error) {
        runtime.interaction.shapeBuilderState.faces = [];
        editor.status(error.message);
      }
    }
    for (const face of runtime.interaction.shapeBuilderState.faces)
      face.regionKey ??=
        "region:" +
        runtime.interaction.shapeBuilderState.ids.slice().sort().join(":") +
        ":" +
        JSON.stringify(face.nodes.map((n) => [n.x, n.y, n.in, n.out]));
    return (
      runtime.interaction.shapeBuilderState.faces.find((f) =>
        hitObject(
          { ...f, fill: "#ffffff", stroke: "none", width: 0 },
          [],
          p,
          0,
        ),
      ) || null
    );
  }

  function uxAction(name) {
    if (name === "pathfinderPanel") {
      openPathfinder();
      return true;
    }
    if (name === "importGraphic") {
      if ($("#modal").open) $("#modal").close();
      editor.toolSet("image");
      return true;
    }
    if (name === "exportDocument") {
      if ($("#modal").open) $("#modal").close();
      editor.exportDialog();
      return true;
    }
    if (name === "helpTools") {
      if ($("#modal").open) $("#modal").close();
      helpTools();
      return true;
    }
    if (name === "cancelDraft") {
      editor.cancelAction();
      editor.render();
      return true;
    }
    if (name === "reverseGradient") {
      editor.commit(
        () =>
          editor
            .chosen()
            .filter((o) => o.gradient)
            .forEach((o) => {
              const g = o.gradient;
              g.stops = g.stops
                .map((s) => ({ ...s, offset: 1 - s.offset }))
                .reverse();
            }),
        "Invertir degradado",
      );
      return true;
    }
    return false;
  }

  function openPathfinder() {
    runtime.workspace.pathfinderOpen = true;
    const host = $("#pathfinder-popover");
    host.innerHTML = `<header class="floating-header"><strong>${uiIcon("divide")}Pathfinder</strong><button data-close-pathfinder aria-label="Cerrar Pathfinder">${uiIcon("close")}</button></header><div class="floating-body">${pathfinderHtml(editor.chosen())}</div>`;
    host.classList.remove("hidden");
    host.querySelector(":is(button:not([disabled]),sp-button:not([disabled]),sp-action-button:not([disabled]),sp-menu-item:not([disabled]))")?.focus();
  }

  function helpTools() {
    editor.modal(
      `<h2>Herramientas de Siluetra</h2><p>Las flechas junto a cada icono abren su familia. Se recuerda la última herramienta elegida. Trazado reúne las operaciones vectoriales; Prenda conserva las construcciones vinculadas.</p><div class="tool-guide">${toolFamilies.map((f) => `<h3>${f.label}</h3>${f.tools.map((id) => `<button data-command="tool:${id}">${uiIcon(id)}<strong>${toolInfo[id].name}</strong><kbd>${toolInfo[id].shortcut}</kbd><span>${toolInfo[id].description}</span></button>`).join("")}`).join("")}</div>`,
      (e, d) => {
        const b = e.target.closest("[data-command]");
        if (b) {
          d.close();
          runCommand(b.dataset.command);
        }
      },
    );
  }

  function dispatchUx(e) {
    const b = e.target.closest("[data-ux-command]");
    if (!b || b.disabled) return;
    const menus = b.closest?.("details");
    if (menus) menus.open = false;
    const id = b.dataset.uxCommand;
    runCommand(id);
    if (
      !$("#pathfinder-popover").classList.contains("hidden") &&
      id !== "pathfinderPanel"
    )
      openPathfinder();
  }
  return {
    action,
    context,
    closeContext,
    alignment,
    freeze,
    commandItems,
    commandPalette,
    runCommand,
    editableStandalone,
    professionalAction,
    buildRegions,
    shapeBuilderFace,
    openPathfinder,
    helpTools,
    dispatchUx,
  };
}
