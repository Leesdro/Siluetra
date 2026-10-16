import {
  selectionActions,
  actionButton,
  menusHtml,
  unavailable,
} from "../ux-tools.js";
import { blendModes } from "../appearance.js";
import { shearMatrix } from "../vector-edit.js";
import { fabrics } from "../fabric.js";
import { toolContexts, garmentOverflow } from "../tool-context.js";
import { selectionIdentity, commandLabels } from "../selection-ui.js";
import { uiIcon, actionIcons } from "../ui-icons.js";
import { toolInfo } from "../tool-learning.js";
import { structureState } from "../structure.js";
import { categories } from "../model.js";
import { selectionBounds } from "../hit.js";
import { settings, favorites, recentResources } from "../preferences.js";
import { translate, around, union } from "../core.js";
import { garmentNames, resources, resource } from "../templates.js";
import { esc, objectSvg, definitions, exportSvg } from "../render.js";
import { effectNames } from "../effects.js";
import {
  advancedGeometry,
  alignmentControls,
  vectorControls,
} from "../controls.js";
import { $, $$, learnKey, actionIcon, field, selectField } from "./ui.js";

// inspector: editor controller; geometry and document services remain authoritative.
export function createInspectorController(runtime, editor) {
  const componentFields = {
    pocket: [
      ["width", "Ancho"],
      ["height", "Alto"],
      ["radius", "Radio"],
      ["flapHeight", "Alto solapa"],
      ["gussetDepth", "Profundidad fuelle"],
      ["zipPosition", "Posición abertura"],
      ["openingAngle", "Ángulo abertura"],
    ],
    hood: [
      ["width", "Ancho"],
      ["height", "Alto"],
      ["depth", "Profundidad"],
      ["opening", "Abertura (0–1)"],
      ["overlap", "Cruce cuello"],
      ["panels", "Paneles"],
      ["layers", "Capas"],
    ],
  };
  function resourcePreview(key) {
    const os = resource(key);
    const b = union(
      os.filter((o) => !o.hidden),
      os,
    );
    if (!b) return "";
    const pad = Math.max(8, b.w * 0.08, b.h * 0.08);
    return `<svg viewBox="${b.x - pad} ${b.y - pad} ${Math.max(b.w, 10) + pad * 2} ${Math.max(b.h, 10) + pad * 2}">${definitions(os)}${os
      .filter((o) => !o.hidden)
      .map((o) => objectSvg(o, os))
      .join("")}</svg>`;
  }

  function library() {
    const separate = !!document.body;
    const layerHost = $("#library-content");
    const host = separate ? $("#resources-content") : layerHost;
    $$("[data-tab]").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === runtime.library.tab),
    );
    if (separate || runtime.library.tab === "resources") {
      const signature = JSON.stringify([
        runtime.library.tab,
        runtime.library.resourceSearch,
        favorites,
        recentResources,
      ]);
      if (host.dataset.signature !== signature) {
        host.dataset.signature = signature;
        const labels = {
          construction: "Construcción",
          collars: "Cuellos",
          pockets: "Bolsillos",
          hardware: "Herrajes",
          cords: "Cordones",
          hoods: "Capuchas",
          fabric: "Tela / Streetwear",
          details: "Detalles",
        };
        const matching = (r) =>
          r[3] !== "legacy" &&
          (!runtime.library.resourceSearch ||
            (r[2] + " " + r[1] + " " + (labels[r[0]] || r[0]))
              .toLowerCase()
              .includes(runtime.library.resourceSearch.toLowerCase()));
        const cards = (list) =>
          '<div class="resource-grid">' +
          list
            .filter(matching)
            .map(
              ([, key, name]) =>
                `<div class="resource-card"><button class="resource" draggable="true" data-resource="${key}" title="${esc(name)} · clic o arrastrar">${resourcePreview(key)}<span>${esc(name)}</span></button><span class="resource-kind">${key.startsWith("graphic") ? "Gráfico" : "Componente editable"}</span><button class="resource-star ${favorites.includes(key) ? "active" : ""}" data-favorite="${key}" title="${favorites.includes(key) ? "Quitar de favoritos" : "Guardar en favoritos"}">${uiIcon("star")}</button></div>`,
            )
            .join("") +
          "</div>";
        host.innerHTML =
          `<p class="resource-use-hint">Clic para agregar · arrastrá para ubicar</p><div class="resource-search-wrap">${uiIcon("search")}<input id="resource-search" type="search" placeholder="Buscar recursos…" aria-label="Buscar recursos" value="${esc(runtime.library.resourceSearch)}"></div>` +
          (favorites.length
            ? `<details data-resource-section="favorites" ${runtime.library.resourceSections.has("favorites") ? "open" : ""}><summary>Favoritos</summary>` +
              cards(resources.filter((r) => favorites.includes(r[1]))) +
              "</details>"
            : "") +
          (recentResources.length && !runtime.library.resourceSearch
            ? `<details data-resource-section="recent" ${runtime.library.resourceSections.has("recent") ? "open" : ""}><summary>Recientes</summary>` +
              cards(
                recentResources
                  .map((k) => resources.find((r) => r[1] === k))
                  .filter(Boolean),
              ) +
              "</details>"
            : "") +
          Object.entries(labels)
            .filter(([cat]) =>
              resources.some((r) => r[0] === cat && matching(r)),
            )
            .map(
              ([cat, name]) =>
                `<details data-resource-section="${cat}" ${runtime.library.resourceSections.has(cat) || runtime.library.resourceSearch ? "open" : ""}><summary>${name}</summary>${cards(resources.filter((r) => r[0] === cat))}</details>`,
            )
            .join("");
        if (!resources.some(matching))
          host.innerHTML +=
            '<p class="resource-empty">No hay recursos coincidentes. Probá otro nombre o categoría.</p>';
        host.dataset.rendered = "resources";
      }
    }
    if (separate || runtime.library.tab !== "resources") {
      const host = layerHost;
      const y =
        host.querySelector(".layer-tree")?.scrollTop ??
        runtime.services.layers.scroll.objects;
      host.dataset.signature = "";
      host.innerHTML = runtime.services.layers.html();
      host.dataset.rendered = "objects";
      const tree = host.querySelector(".layer-tree");
      if (tree) tree.scrollTop = y;
    }
  }

  function inspectorAction(name, label = commandLabels[name] || name) {
    const key = learnKey(name),
      tips = {
        clip: "Recortá el gráfico usando la silueta del cuerpo.",
        outline:
          "Convertí el grosor de la línea en geometría vectorial editable.",
        offset: "Creá un trazado paralelo a una distancia definida.",
        removeSelectedConstruction:
          "Quitá la construcción conservando su geometría de base.",
        presets: "Guardá o aplicá un estilo de construcción.",
      };
    return `<button data-action="${name}" ${toolInfo[key] ? `data-learn="${key}"` : `data-tooltip="${tips[name] || label}"`}>${actionIcon(name)}<span>${label}</span></button>`;
  }

  function inspectorSection(key, label, body, open = true) {
    const expanded = runtime.workspace.sectionFold.get(key) ?? open;
    return `<details class="inspector-section" data-section="${key}" ${expanded ? "open" : ""}><summary>${label}</summary><div class="inspector-section-body">${body}</div></details>`;
  }

  function properties() {
    editor.renderAppearancePane?.();
    editor.syncPaintUI();
    const el = $("#properties"),
      os = editor.chosen(),
      o = editor.one();
    if (runtime.selection.selectedGroup && !os.length) {
      const g = runtime.document.project.groups[runtime.document.view].find(
        (g) => g.id === runtime.selection.selectedGroup,
      );
      if (g) {
        el.innerHTML = `<div class="selection-header">${uiIcon("folder")}<div><small>CARPETA</small><strong>${esc(g.name)}</strong><span>Carpeta vacía</span></div></div><div class="fields">${field("folderName", "Nombre", g.name, "text", true)}</div><div class="prop-buttons">${inspectorAction("lockSelection", "Bloquear") + inspectorAction("hideSelection", "Ocultar") + inspectorAction("delete", "Eliminar")}</div>`;
        return;
      }
    }
    if (!os.length) {
      el.innerHTML = `<div class="selection-header">${uiIcon("garment")}<div><small>DOCUMENTO</small><strong>${esc(runtime.document.project.name)}</strong><span>${esc(garmentNames[runtime.document.project.kind])} · ${Math.round(runtime.document.project.document.width * 100) / 100} × ${Math.round(runtime.document.project.document.height * 100) / 100} ${runtime.document.project.document.unit} · ${runtime.document.project.document.ppi} ppp</span></div></div><div class="document-inspector-preview">${exportSvg(runtime.document.project, runtime.document.view)}</div><div class="document-summary">Frente + espalda · ${structureState(runtime.document.project) === "linked" ? "Vinculada" : "Estructura independiente"}</div><div class="inspector-quick">${inspectorAction("dimensions", "Dimensiones") + inspectorAction("selectBody", "Seleccionar cuerpo")}</div>${inspectorSection("Documento", "Documento", `<div class="fields">${field("docName", "Nombre", runtime.document.project.name, "text", true) + field("centerAxis", "Eje central", runtime.document.project.centerAxis ?? 350)}</div><div class="prop-buttons">${inspectorAction("guide", "Agregar guía") + inspectorAction("saveAs", "Duplicar proyecto")}</div>`, false)}`;
      return;
    }
    const identity = runtime.selection.selectedGroup
        ? {
            ...selectionIdentity(
              os,
              runtime.document.project.groups[runtime.document.view],
            ),
            label: "Carpeta",
            icon: "folder",
            name:
              runtime.document.project.groups[runtime.document.view].find(
                (g) => g.id === runtime.selection.selectedGroup,
              )?.name || "Carpeta",
            category: "detail",
            actions: ["isolate", "duplicate", "dupMirror", "ungroup"],
          }
        : selectionIdentity(
            os,
            runtime.document.project.groups[runtime.document.view],
          ),
      b = selectionBounds(os, editor.objects()) || union(os, editor.objects());
    let html = `<div class="selection-header">${uiIcon(identity.icon)}<div><small>${identity.label.toUpperCase()}</small><strong>${esc(identity.name)}</strong><span>${o?.panelOf ? esc(editor.objects().find((p) => p.id === o.panelOf)?.name) + " · " : ""}${categories[identity.category] || "Objetos"}</span></div></div><div class="inspector-quick" aria-label="Acciones rápidas">${
      identity.actions
        .slice(0, 4)
        .map((a) => inspectorAction(a))
        .join("") + inspectorAction("revealLayers", "Mostrar en Capas")
    }${os.some((o) => ["image", "text"].includes(o.type)) && os.some((o) => o.semanticType === "region") ? inspectorAction("clip", "Recortar al panel") : ""}</div>`;
    const linked = os.some((x) => x.instanceOf || x.mirrorPeer || x.symmetry);
    html += inspectorSection(
      "Simetría",
      "SIMETRÍA",
      `<div class="construction-summary"><span>${linked ? "Vinculada" : os.every((x) => x.mirrorPolicy === "centered") ? "Centrada" : "Independiente"}${linked && !runtime.document.project.liveMirror ? " · pausada" : ""}</span></div>${linked ? `<div class="prop-buttons">${inspectorAction("breakSymmetry", "Break Symmetry")}</div>` : ""}`,
    );
    if (o?.semanticType !== "region")
      html += inspectorSection(
        "Transformación",
        "Transformación",
        `<div class="fields">${o ? field("name", "Nombre", o.name, "text", true) : ""}${field("x", "X", b.x) + field("y", "Y", b.y) + field("w", "Ancho", b.w) + field("h", "Alto", b.h) + field("rotation", "Rotación", o ? (Math.atan2(editor.effectiveMatrix(o)[1], editor.effectiveMatrix(o)[0]) * 180) / Math.PI : 0) + field("shearDelta", "Inclinar (°)", 0)}${o ? `<div class="field"><label title="Conservá la relación entre ancho y alto"><input type="checkbox" data-prop="aspectLock" ${o.aspectLock ? "checked" : ""}> Proporciones</label></div>` : ""}</div>`,
      );
    let appearance = '<div class="fields">';
    if (!o || ["path", "text"].includes(o.type))
      appearance +=
        `<div class="field"><label>Relleno</label><button class="appearance-swatch" data-action="color" style="--swatch:${os.every((r) => r.fill === os[0].fill) ? os[0].fill : "transparent"}">${os.every((r) => r.fill === os[0].fill) ? esc(os[0].fill || "none") : "Mixto"}</button></div>` +
        `<div class="field"><label>Sin relleno</label><input type="checkbox" aria-label="Sin relleno" data-prop="noFill" ${o?.fill === "none" ? "checked" : ""}></div>`;
    if (o?.type !== "image" && o?.semanticType !== "region")
      appearance +=
        field("stroke", "Línea", o?.stroke || "#292e2c", "color") +
        field("width", "Grosor", o?.width ?? 1.5);
    appearance += field("opacity", "Opacidad", (o?.opacity ?? 1) * 100);
    if (o?.type === "image")
      appearance += `<div class="field full"><input type="range" aria-label="Opacidad" data-live-prop="opacity" min="0" max="100" value="${(o.opacity ?? 1) * 100}"></div>`;
    appearance += selectField(
      "blendMode",
      "Fusión",
      o?.blendMode || "normal",
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
    );
    if (o?.type === "path")
      appearance +=
        selectField("lineCap", "Extremos", o.lineCap || "round", [
          ["butt", "Rectos"],
          ["round", "Redondos"],
          ["square", "Cuadrados"],
        ]) +
        selectField("lineJoin", "Uniones", o.lineJoin || "round", [
          ["miter", "Ángulo"],
          ["round", "Redondas"],
          ["bevel", "Bisel"],
        ]);
    appearance +=
      '</div><div class="prop-buttons">' +
      (o?.type === "path"
        ? actionButton("gradientFill", "Degradado", os, "gradient") +
          actionButton("removeGradient", "Quitar degradado", os, "fill")
        : "") +
      "</div>";
    html += inspectorSection("Apariencia", "Apariencia", appearance);
    if (o?.fabricTexture)
      html += inspectorSection(
        "Tela",
        "Tela",
        `<div class="construction-summary">${uiIcon("fabric")}<span>${fabrics[o.fabricTexture.type]?.name} · ${o.fabricTexture.intensity}%</span></div><div class="prop-buttons">${inspectorAction("fabric", "Editar textura") + inspectorAction("removeFabric", "Quitar textura")}</div>`,
      );
    if (o) {
      let props = `<div class="fields">${selectField("category", "Categoría", o.category, Object.entries(categories))}${
        o.category === "structure"
          ? selectField(
              "applyTo",
              "Cambios en",
              runtime.document.project.applyTo,
              [
                ["both", "Ambas vistas"],
                ["this", "Esta vista"],
              ],
            )
          : ""
      }</div>`;
      if (o.component) props += componentProperties(o);
      if (o.type === "text")
        props += `<div class="fields">${field("text", "Texto", o.text, "text", true) + field("fontSize", "Tamaño", o.fontSize)}</div>`;
      if (o.source || o.construction)
        props += `<div class="construction-summary">${uiIcon(actionIcons[o.type] || "stitch")}<span>${effectNames[o.construction?.type || o.type] || "Construcción"}${o.rows === 2 ? " doble" : ""}</span></div><div class="prop-buttons">${inspectorAction("editConstruction", "Editar parámetros") + inspectorAction("selectSource", "Editar base")}</div>`;
      if (o.category === "structure")
        props += `<div class="prop-buttons">${inspectorAction("relink", "Volver a vincular")}</div>`;
      html += inspectorSection(
        "Propiedades de la pieza",
        "Propiedades de la pieza",
        props,
      );
      const modifiers = o.modifiers || [],
        dependents = editor.objects().filter((p) => p.source === o.id);
      if (modifiers.length || dependents.length) {
        const rows =
          modifiers
            .map(
              (m) =>
                `<div class="modifier-summary ${runtime.selection.modifierContext === m.id ? "active" : ""}"><button data-action="selectModifier:${m.id}" title="Abrir parámetros de ${effectNames[m.type] || m.type}">${uiIcon(actionIcons[m.type] || "path")}<span><strong>${effectNames[m.type] || m.type}${m.rows === 2 ? " doble" : ""}</strong><small>${m.enabled === false ? "Desactivado" : m.direction || m.position || "Editable"}${m.spacing !== undefined ? " · " + m.spacing + " px" : ""}</small></span></button><button data-action="modRemove:${m.id}" class="icon-button" title="Quitar modificador" aria-label="Quitar ${effectNames[m.type] || m.type}">${uiIcon("close")}</button></div>`,
            )
            .join("") +
          dependents
            .map(
              (e) =>
                `<div class="modifier-summary"><button data-action="selectEffect:${e.id}" title="Editar construcción vinculada">${uiIcon(actionIcons[e.type] || "stitch")}<span><strong>${esc(e.name)}</strong><small>${effectNames[e.type] || "Vinculada"}</small></span></button></div>`,
            )
            .join("");
        html += inspectorSection(
          "Modificadores",
          "Modificadores",
          rows +
            `<div class="prop-buttons">${inspectorAction("addModifier", "Agregar modificador")}</div>`,
        );
      }
    }
    if (o?.semanticType !== "region")
      html += inspectorSection(
        "Organizar",
        "Organizar",
        `<div class="prop-buttons">${["duplicate", "dupMirror", "front", "back", "group", "ungroup", "lockSelection", "hideSelection", "delete"].map((a) => inspectorAction(a)).join("")}</div>` +
          (!o ? alignmentControls() : ""),
        false,
      );
    const advanced =
      (o
        ? advancedGeometry(
            o,
            editor.activeTool(),
            runtime.selection.nodeIndices,
          )
        : vectorControls()) +
      `<div class="prop-buttons">${inspectorAction("offset", "Desplazar trazado") + inspectorAction("outline", "Contornear línea") + inspectorAction("freeze", "Convertir a vectores") + inspectorAction("breakSymmetry", "Romper simetría")}</div>`;
    if (o?.semanticType !== "region")
      html += inspectorSection(
        "Avanzado",
        "Avanzado · operaciones vectoriales",
        advanced,
        false,
      );
    if (o?.type === "path")
      html += inspectorSection(
        "Trazado",
        "Trazado",
        `<div class="construction-summary">${o.nodes.length + (o.subpaths || []).reduce((n, p) => n + p.nodes.length, 0)} nodos · ${o.closed ? "Cerrado" : "Abierto"}${o.subpaths?.length ? " · Compuesto" : ""}</div><div class="prop-buttons">${[
          ["smooth", "Suavizar", "smooth"],
          ["simplify", "Simplificar", "simplify"],
          ["cleanPath", "Limpiar", "clean"],
          ["pathfinderPanel", "Pathfinder", "divide"],
        ]
          .map(([a, l, i]) => actionButton(a, l, os, i))
          .join("")}</div>`,
        false,
      );
    if (o?.type === "image")
      html += inspectorSection(
        "Gráfico",
        "Gráfico",
        `<p class="ux-explanation">${o.src?.startsWith("data:image/svg") ? "SVG conservado como imagen; sus elementos no son editables." : "Imagen colocada. Vectorizar crea una copia editable en blanco y negro."} ${o.clip ? "Recortada a una forma." : "Sin recorte."}</p><div class="prop-buttons">${actionButton("traceImage", "Vectorizar B/N", os, "trace") + actionButton("clip", "Recortar a prenda", os, "crop") + actionButton("removeClip", "Quitar recorte", os, "releaseCompound")}</div>`,
      );
    if (o?.panelEdgeInvalid)
      html +=
        '<p class="dialog-error" role="status">Los bordes cambiaron. Conservamos el último panel válido; revisá sus líneas.</p>';
    el.innerHTML = html;
    decorateActionHints();
  }

  function decorateActionHints() {
    const descriptions = {
      offset: "Creá un trazado paralelo a la distancia elegida.",
      outline:
        "Convertí el grosor de la línea en geometría vectorial editable.",
      freeze: "Convertí el resultado procedural en trazados estáticos.",
      breakSymmetry: "Separá esta pieza de su relación de espejo.",
      breakHandles: "Separá los tiradores para ajustar cada lado de la curva.",
    };
    for (const b of $$("#properties [data-action]")) {
      const a = b.dataset.action,
        why = unavailable(a, editor.chosen());
      if (why) {
        b.disabled = true;
        b.title = why;
        b.setAttribute("aria-label", (b.textContent.trim() || a) + " · " + why);
      }
      if (!b.dataset.learn)
        b.dataset.tooltip =
          descriptions[a] || b.getAttribute("title") || b.textContent.trim();
    }
  }

  function setProperty(key, value, checkbox = false) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      editor.toast("Ingresá un número válido.");
      properties();
      return;
    }
    if (key === "shearDelta") {
      try {
        const b =
          selectionBounds(editor.chosen(), editor.objects()) ||
          union(editor.chosen());
        if (!b) return;
        const m = shearMatrix(Number(value), b.x + b.w / 2, b.y + b.h / 2);
        editor.commit(() => editor.applyTransform(m), "Inclinar selección");
      } catch (error) {
        editor.toast(error.message);
        properties();
      }
      return;
    }
    if (
      runtime.selection.selectedGroup &&
      ["name", "folderName"].includes(key)
    ) {
      editor.commit(() => {
        const g = runtime.document.project.groups[runtime.document.view].find(
          (g) => g.id === runtime.selection.selectedGroup,
        );
        if (g) g.name = value;
      }, "Renombrar carpeta");
      return;
    }
    if (
      (key === "blendMode" && !blendModes.includes(value)) ||
      (key === "lineCap" && !["butt", "round", "square"].includes(value)) ||
      (key === "lineJoin" && !["miter", "round", "bevel"].includes(value))
    )
      return;
    if (key === "fill") {
      editor.applyColor(value, runtime.selection.selected, "fill");
      return;
    }
    if (key === "noFill") {
      editor.applyColor(
        checkbox ? "none" : "#ffffff",
        runtime.selection.selected,
        "fill",
      );
      return;
    }
    if (
      editor.activeConstructionRefs().length &&
      [
        "offset",
        "spacing",
        "length",
        "rows",
        "position",
        "rowGap",
        "stitchType",
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
        "pathLength",
      ].includes(key)
    ) {
      editor.setConstructionProperty(key, value);
      return;
    }
    if (key === "aspectLock") {
      editor.commit(() =>
        editor.chosen().forEach((o) => (o.aspectLock = checkbox)),
      );
      return;
    }
    if (
      settings.units === "mm" &&
      ["x", "y", "w", "h", "centerAxis"].includes(key)
    )
      value = (Number(value) * 96) / 25.4;
    if (key === "centerAxis") {
      editor.specialProperty(key, value);
      return;
    }
    if (key === "docName") {
      editor.commit(() => (runtime.document.project.name = value));
      return;
    }
    const o = editor.one();
    if (!editor.chosen().length) return;
    if (v3Property(key, value, checkbox)) return;
    if (editor.specialProperty(key, value)) return;
    const number = typeof value === "number" ? value : Number(value),
      b =
        selectionBounds(editor.chosen(), editor.objects()) ||
        union(editor.chosen(), editor.objects());
    if (["x", "y", "w", "h", "rotation"].includes(key)) {
      if (!Number.isFinite(number)) return;
      let m;
      if (key === "x") m = translate(number - b.x, 0);
      if (key === "y") m = translate(0, number - b.y);
      if (key === "w" || key === "h") {
        if (number < 0 || number > 10000) {
          editor.toast("Ingresá un tamaño entre 0 y 10000");
          properties();
          return;
        }
        m = around(
          b.x,
          b.y,
          key === "w"
            ? number / (b.w || 1)
            : o?.aspectLock && key === "h"
              ? number / (b.h || 1)
              : 1,
          key === "h"
            ? number / (b.h || 1)
            : o?.aspectLock && key === "w"
              ? number / (b.w || 1)
              : 1,
        );
      }
      if (key === "rotation") {
        const prev = o
          ? (Math.atan2(
              editor.effectiveMatrix(o)[1],
              editor.effectiveMatrix(o)[0],
            ) *
              180) /
            Math.PI
          : 0;
        m = around(
          b.x + b.w / 2,
          b.y + b.h / 2,
          1,
          1,
          ((number - prev) * Math.PI) / 180,
        );
      }
      editor.commit(() => editor.applyTransform(m));
      return;
    }
    editor.commit(() => {
      for (const o of editor.chosen()) {
        if (key === "noFill") o.fill = checkbox ? "none" : "#ffffff";
        else if (key === "opacity")
          o.opacity = Math.min(1, Math.max(0, number / 100));
        else if (
          [
            "width",
            "spacing",
            "length",
            "teeth",
            "zipWidth",
            "fontSize",
          ].includes(key)
        ) {
          o[key] = Math.max(0, number);
          if (key === "fontSize") {
            const lines = String(o.text).split(/\r?\n/);
            o.h = o.fontSize * 1.3 * lines.length;
            o.w = Math.max(...lines.map((l) => l.length)) * o.fontSize * 0.62;
          }
        } else if (key === "slider")
          o.slider = Math.min(1, Math.max(0, number));
        else if (key === "offset" || key === "rows") o[key] = number;
        else o[key] = value;
        if (key === "text") {
          const lines = String(value).split(/\r?\n/);
          o.w =
            Math.max(...lines.map((l) => l.length)) * (o.fontSize ?? 28) * 0.62;
          o.h = lines.length * (o.fontSize ?? 28) * 1.3;
        }
      }
    });
  }

  function contextBar() {
    if (runtime.panels.panelEdgeState) {
      $("#context-bar").innerHTML =
        `<span class="context-breadcrumb">Crear panel · ${runtime.panels.panelEdgeState.mode === "area" ? "Elegir área" : "Seleccionar bordes"}</span><span class="context-tool-hint">${esc(editor.panelEdgeInstruction())}</span>`;
      return;
    }
    const mode = editor.activeTool(),
      o = editor.one(),
      button = (action, label) =>
        `<button class="ghost" data-action="${action}" ${toolInfo[learnKey(action)] ? `data-learn="${learnKey(action)}"` : `data-tooltip="${label}"`} ${(!runtime.selection.selected.length && ["node", "edge", "select"].includes(mode)) || (["penFinish", "penClose"].includes(action) && (!runtime.interaction.pen || runtime.interaction.pen.nodes.length < (action === "penClose" ? 3 : 2))) ? "disabled" : ""}>${actionIcon(action)}<span>${label}</span></button>`,
      group = (label, content, secondary = false) =>
        `<div class="tool-group ${secondary ? "secondary-group" : ""}"><span class="tool-group-label">${label}</span><div>${content}</div></div>`;
    let html = `<span class="context-breadcrumb">${toolInfo[mode]?.name || "Documento"}${o ? " · " + esc(o.name) : ""}</span>`;
    const definition = toolContexts[mode] || [];
    for (const g of definition) {
      const content =
        g.control === "smoothing"
          ? `<label>Suavizado <input id="pencil-smoothing" type="range" min="0" max="100" value="${settings.smoothing}" title="Suavizado del lápiz"><span>${settings.smoothing}%</span></label>`
          : g.hint
            ? `<span class="context-tool-hint">${g.hint}</span>`
            : g.items
                .map(([action, label]) =>
                  button(
                    action === "togglePath"
                      ? o?.closed
                        ? "openPath"
                        : "closePath"
                      : action,
                    action === "togglePath"
                      ? o?.closed
                        ? "Abrir"
                        : "Cerrar"
                      : label,
                  ),
                )
                .join("");
      html += group(g.label, content, g.secondary);
    }
    if (mode === "gradient" && o?.gradient)
      html += group(
        "Degradado",
        `<input type="color" data-gradient-stop="0" aria-label="Color inicial" value="${o.gradient.stops[0].color}"><input type="color" data-gradient-stop="1" aria-label="Color final" value="${o.gradient.stops.at(-1).color}">`,
      );
    if (mode === "select" && !runtime.selection.selected.length)
      html = group("Documento", button("dimensions", "Dimensiones"));
    if (
      mode === "select" &&
      editor.chosen().some((o) => o.type === "path" && !o.closed && !o.source)
    )
      html += group("Paneles", button("createPanel", "Crear paneles"));
    if (mode === "fill" || mode === "eyedropper")
      html += group("Color", button("color", "Abrir paleta"));
    const overflow = ["node", "edge", "select"].includes(mode)
      ? [
          ...(mode === "node"
            ? toolContexts.node
                .filter((g) => g.secondary)
                .flatMap((g) => g.items)
            : mode === "edge"
              ? toolContexts.edge
                  .filter((g) => g.secondary)
                  .flatMap((g) => g.items)
              : toolContexts.select
                  .filter((g) => g.secondary)
                  .flatMap((g) => g.items)),
          ...(mode === "node"
            ? [
                ["bend", "Curvar"],
                ["offset", "Desplazar trazado"],
                ["outline", "Contornear línea"],
                ["breakSymmetry", "Romper simetría"],
                ["freeze", "Convertir a vectores"],
              ]
            : garmentOverflow),
        ]
      : [];
    if (overflow.length && runtime.selection.selected.length)
      html += `<details class="toolbar-overflow"><summary title="Más acciones">${uiIcon("more")}</summary><div class="toolbar-menu">${overflow.map(([a, l]) => button(a, l)).join("")}</div></details>`;
    if (runtime.selection.isolation.length)
      html += button("exitIsolation", "Salir · Esc");
    if (mode === "eraser")
      html = group(
        "Borrador",
        `<label>Modo <select data-eraser-mode aria-label="Modo del borrador"><option value="construction" ${runtime.interaction.eraserMode === "construction" ? "selected" : ""}>Construcción</option><option value="vector" ${runtime.interaction.eraserMode === "vector" ? "selected" : ""}>Trazado</option></select></label><label>Radio <input type="number" data-eraser-radius min="2" max="60" value="${runtime.interaction.eraserRadius}" aria-label="Radio del borrador"></label><span class="context-tool-hint">${runtime.interaction.eraserMode === "construction" ? "Clic: quitar construcción · base intacta" : "Arrastrar: borrar parte del trazado · estructura protegida"}</span>`,
      );
    if (mode === "select")
      html = `<span class="context-breadcrumb">${o ? esc(o.name) : editor.chosen().length ? editor.chosen().length + " seleccionados" : "Documento"}</span><div class="selection-taskbar">${selectionActions(
        editor.chosen(),
      )
        .map(([id, l, i]) => actionButton(id, l, editor.chosen(), i))
        .join("")}</div>`;
    if (mode === "measure")
      html += `<output id="measure-value" class="measure-value">Arrastrá para medir</output>`;
    if (["pen", "curvature"].includes(mode))
      html += actionButton("cancelDraft", "Cancelar · Esc", [], "close");
    if (mode === "shapeBuilder")
      html += `<span class="context-tool-hint">${runtime.interaction.shapeBuilderState?.ids.length || 0} trazados · ${runtime.interaction.shapeBuilderState?.faces.length || 0} regiones disponibles</span>`;
    if (mode === "gradient")
      html +=
        actionButton(
          "gradientFill",
          "Crear degradado",
          editor.chosen(),
          "gradient",
        ) +
        actionButton(
          "reverseGradient",
          "Invertir colores",
          editor.chosen(),
          "flipV",
        );
    $("#context-bar").innerHTML = html;
    $("#ux-menus").innerHTML = menusHtml(editor.chosen());
    const state = structureState(runtime.document.project);
    $("#structure-state").innerHTML =
      uiIcon(
        runtime.document.project.applyTo === "this" || state === "unlinked"
          ? "unlink"
          : "link",
      ) +
      "<span>" +
      (runtime.document.project.applyTo === "this"
        ? "Sólo esta vista"
        : state === "unlinked"
          ? "Desvinculada"
          : state === "none"
            ? "Sin vínculos"
            : "Vinculada") +
      "</span>";
    $("#structure-state").dataset.state = state;
    $("#structure-state").title =
      state === "unlinked"
        ? "Hay cambios de esta vista. Usá Volver a vincular en la pieza."
        : state === "none"
          ? "Este proyecto no tiene correspondencias estructurales"
          : "Ambas vistas consumen la estructura compartida";
    $("#variant-button").innerHTML =
      "<span>" +
      esc(runtime.document.project.activeVariant || "V1") +
      "</span>" +
      uiIcon("chevronDown");
  }

  function componentProperties(o) {
    const c = o.component;
    if (!c) return "";
    const fields = (componentFields[c.kind] || [])
      .map(([key, label]) => field("component:" + key, label, c[key]))
      .join("");
    const style =
      c.kind === "pocket"
        ? selectField("component:style", "Tipo", c.style, [
            ["patch", "Parche"],
            ["jean", "Jean"],
            ["back", "Trasero"],
            ["cargo", "Cargo"],
            ["zip", "Cierre"],
            ["diagonalZip", "Cierre diagonal"],
            ["welt", "Ojal"],
            ["side", "Lateral"],
            ["hidden", "Oculto"],
            ["utility", "Utilitario"],
          ]) +
          `<div class="field"><label>Solapa</label><input type="checkbox" data-prop="component:flap" ${c.flap ? "checked" : ""}></div>`
        : "";
    return (
      `<div class="fields component-fields">${fields}${style}</div>` +
      inspectorAction("detachComponent", "Editar libremente")
    );
  }

  function v3Property(key, value, checkbox) {
    if (key === "category") {
      editor.commit(() => editor.chosen().forEach((o) => (o.category = value)));
      return true;
    }
    if (key === "applyTo") {
      editor.commit(() => (runtime.document.project.applyTo = value));
      return true;
    }
    if (key.startsWith("component:")) {
      const o = editor.one(),
        k = key.slice(10);
      if (!o?.component) return true;
      editor.commit(() => {
        o.component[k] = k === "flap" ? checkbox : value;
        if (k === "width" || k === "height")
          o.component[k] = Math.max(5, Number(value));
        if (k === "stitchOffset")
          for (const m of o.modifiers || [])
            if (m.type === "stitch") m.offset = Number(value);
      });
      return true;
    }
    return false;
  }

  function renameObject(id) {
    const o =
      editor.objects().find((o) => o.id === id) ||
      runtime.document.project.groups[runtime.document.view].find(
        (g) => g.id === id,
      );
    if (!o) return;
    editor.modal(
      '<h2>Renombrar pieza</h2><input id="rename-object" value="' +
        esc(o.name) +
        '"><div class="dialog-actions"><button data-close>Cancelar</button><button class="primary" id="do-rename">Guardar</button></div>',
      (e, d) => {
        if (e.target.id === "do-rename") {
          editor.commit(
            () => (o.name = $("#rename-object").value.trim() || o.name),
          );
          d.close();
        }
      },
    );
  }
  return { library, properties, setProperty, contextBar, renameObject };
}
