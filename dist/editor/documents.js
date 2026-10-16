import { workerTask } from "../worker-task.js";
import { sanitizeSvg } from "../svg-safety.js";
import { editableSvg } from "../svg-import.js";
import { selectionExport } from "../selection-export.js";
import {
  documentSpec,
  documentPresets,
  convertUnits,
  configureDocument,
  rasterSize,
  pngResolution,
} from "../document.js";
import { graphIds } from "../object-graph.js";
import { templateCards, recentCards } from "../launcher.js";
import { uiIcon } from "../ui-icons.js";
import { settings } from "../preferences.js";
import { uid, clone, translate, migrateProject } from "../core.js";
import { newProject } from "../templates.js";
import { esc, exportSvg } from "../render.js";
import {
  saveProject,
  listProjects,
  loadProject,
  deleteProject,
} from "../storage.js";
import { $, field, selectField } from "./ui.js";

// documents: editor controller; geometry and document services remain authoritative.
export function createDocumentsController(runtime, editor) {
  async function renderRecents() {
    try {
      runtime.launcher.recentProjects = (await listProjects()).sort(
        (a, b) => b.updated - a.updated,
      );
      $("#recents").innerHTML = runtime.launcher.recentProjects.length
        ? recentCards(runtime.launcher.recentProjects)
        : `<div class="launcher-empty">${uiIcon("folder")}<strong>Todavía no hay proyectos</strong><span>Creá un documento o abrí un archivo .garment.json.</span><button class="secondary" data-launch-new>${uiIcon("plus")}Nuevo documento</button></div>`;
    } catch (e) {
      $("#recents").innerHTML =
        '<div class="empty-state">No se pudo acceder al guardado local. Podés abrir y exportar archivos de proyecto.</div>';
    }
  }

  function newDocumentFields() {
    return `<div class="document-setup"><h3>DOCUMENTO</h3><div class="fields">${selectField(
      "newPreset",
      "Formato",
      "square",
      [
        ["square", "1000 × 1000 px"],
        ["a4", "A4 vertical"],
        ["a4landscape", "A4 horizontal"],
        ["a3", "A3"],
        ["social", "1080 × 1080 px"],
        ["portrait", "1080 × 1350 px"],
        ["custom", "Personalizado"],
      ],
    )}${field("newWidth", "Ancho", runtime.launcher.newDocumentOptions.width)}${field("newHeight", "Alto", runtime.launcher.newDocumentOptions.height)}${selectField(
      "newUnit",
      "Unidad",
      runtime.launcher.newDocumentOptions.unit,
      [
        ["px", "Píxeles"],
        ["mm", "Milímetros"],
        ["cm", "Centímetros"],
        ["in", "Pulgadas"],
      ],
    )}${selectField("newPpi", "Resolución / ppp", runtime.launcher.newDocumentOptions.ppi, [72, 96, 150, 300, 600].map((v) => [v, v + " ppp"]).concat([["custom", "Personalizada"]]))}<div class="new-custom-ppi hidden">${field("newCustomPpi", "ppp personalizados", 300)}</div>${selectField(
      "newBackground",
      "Fondo",
      "white",
      [
        ["white", "Blanco"],
        ["transparent", "Transparente"],
        ["custom", "Personalizado"],
      ],
    )}<div class="new-background-color hidden">${field("newColor", "Color de hoja", "#ffffff", "color")}</div></div><div class="orientation"><button data-orientation="portrait">${uiIcon("rect")}Vertical</button><button data-orientation="landscape">${uiIcon("flipV")}Horizontal</button></div><small>Las medidas físicas usan 96 px/pulgada en el lienzo. Los ppp determinan el PNG, conservando los vectores.</small></div>`;
  }

  function newDocument() {
    runtime.launcher.newDocumentKind = "tee";
    runtime.launcher.newDocumentOptions = documentSpec();
    editor.modal(
      `<h2>Nuevo documento</h2><div class="new-document-layout"><div><h3>PLANTILLA</h3><div class="new-document-templates" id="new-template-cards">${templateCards(runtime.launcher.newDocumentKind)}</div></div>${newDocumentFields()}</div><div class="dialog-actions"><button data-close>Cancelar</button><button class="primary" id="create-document">Crear</button></div>`,
      (e, d) => {
        const template = e.target.closest("[data-new]");
        if (template) {
          runtime.launcher.newDocumentKind = template.dataset.new;
          $("#new-template-cards").innerHTML = templateCards(
            runtime.launcher.newDocumentKind,
          );
        }
        const orientation = e.target.closest("[data-orientation]");
        if (orientation) {
          const portrait = orientation.dataset.orientation === "portrait";
          if (
            runtime.launcher.newDocumentOptions.width >
              runtime.launcher.newDocumentOptions.height ===
            portrait
          )
            [
              runtime.launcher.newDocumentOptions.width,
              runtime.launcher.newDocumentOptions.height,
            ] = [
              runtime.launcher.newDocumentOptions.height,
              runtime.launcher.newDocumentOptions.width,
            ];
          syncNewDocumentFields();
        }
        if (e.target.closest("#create-document")) createDocument(d);
      },
    );
    $("#modal").onchange = (e) => {
      const k = e.target.dataset.prop,
        v = e.target.value;
      if (k === "newPreset" && documentPresets[v]) {
        const [width, height, unit] = documentPresets[v];
        Object.assign(runtime.launcher.newDocumentOptions, {
          width,
          height,
          unit,
        });
        syncNewDocumentFields();
      }
      if (k === "newUnit") {
        const from = runtime.launcher.newDocumentOptions.unit;
        runtime.launcher.newDocumentOptions.width = convertUnits(
          runtime.launcher.newDocumentOptions.width,
          from,
          v,
        );
        runtime.launcher.newDocumentOptions.height = convertUnits(
          runtime.launcher.newDocumentOptions.height,
          from,
          v,
        );
        runtime.launcher.newDocumentOptions.unit = v;
        syncNewDocumentFields();
      }
      if (k === "newWidth" || k === "newHeight")
        runtime.launcher.newDocumentOptions[
          k === "newWidth" ? "width" : "height"
        ] = +v;
      if (k === "newPpi")
        $(".new-custom-ppi")?.classList.toggle("hidden", v !== "custom");
      if (k === "newBackground")
        $(".new-background-color")?.classList.toggle("hidden", v !== "custom");
      if (k === "newPpi")
        runtime.launcher.newDocumentOptions.ppi =
          v === "custom"
            ? +(
                $("#modal").querySelector('[data-prop="newCustomPpi"]')
                  ?.value || 300
              )
            : +v;
      if (k === "newCustomPpi") runtime.launcher.newDocumentOptions.ppi = +v;
      if (k === "newBackground")
        runtime.launcher.newDocumentOptions.background = v;
      if (k === "newColor") runtime.launcher.newDocumentOptions.color = v;
    };
    $("#modal").oninput = (e) => {
      const k = e.target.dataset.prop,
        v = e.target.value;
      if (k === "newWidth" || k === "newHeight")
        runtime.launcher.newDocumentOptions[
          k === "newWidth" ? "width" : "height"
        ] = +v;
      if (k === "newCustomPpi") runtime.launcher.newDocumentOptions.ppi = +v;
    };
    $("#modal").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        createDocument($("#modal"));
      }
    };
    $("#new-template-cards").ondblclick = (e) => {
      const template = e.target.closest("[data-new]");
      if (template) {
        runtime.launcher.newDocumentKind = template.dataset.new;
        createDocument($("#modal"));
      }
    };
  }

  function syncNewDocumentFields() {
    for (const k of ["width", "height", "unit"]) {
      const el = $("#modal").querySelector(
        `[data-prop="new${k[0].toUpperCase() + k.slice(1)}"]`,
      );
      if (el)
        el.value =
          k === "unit"
            ? runtime.launcher.newDocumentOptions[k]
            : Math.round(runtime.launcher.newDocumentOptions[k] * 100000) /
              100000;
    }
  }

  function createDocument(
    dialog,
    options = runtime.launcher.newDocumentOptions,
  ) {
    try {
      const p = configureDocument(
        newProject(runtime.launcher.newDocumentKind),
        options,
      );
      p.liveMirror = settings.mirrorDefault;
      dialog.close();
      editor.open(p);
    } catch (e) {
      editor.toast(e.message);
    }
  }

  function closeProjectMenu() {
    $("#project-menu").classList.add("hidden");
    runtime.launcher.recentMenuId = null;
  }

  function showProjectMenu(id, e) {
    runtime.launcher.recentMenuId = id;
    const menu = $("#project-menu");
    menu.innerHTML = [
      ["open", "Abrir", "folder"],
      ["rename", "Renombrar", "edit"],
      ["duplicate", "Duplicar", "copy"],
      ["export", "Exportar proyecto", "export"],
      ["delete", "Eliminar", "trash"],
    ]
      .map(
        ([action, label, icon]) =>
          `<button role="menuitem" class="${action === "delete" ? "danger" : ""}" data-recent-action="${action}">${uiIcon(icon)}<span class="menu-label">${label}</span></button>`,
      )
      .join("");
    menu.classList.remove("hidden");
    const r = e.target.getBoundingClientRect?.() || {
      left: e.clientX,
      bottom: e.clientY,
    };
    menu.style.left =
      Math.max(8, Math.min(e.clientX ?? r.left, innerWidth - 238)) + "px";
    menu.style.top =
      Math.max(8, Math.min(e.clientY ?? r.bottom + 5, innerHeight - 185)) +
      "px";
    menu.querySelector(":is(button:not([disabled]),sp-button:not([disabled]),sp-action-button:not([disabled]),sp-menu-item:not([disabled]))")?.focus();
  }

  async function recentAction(action, id) {
    const p = await loadProject(id);
    if (!p) return;
    if (action === "open") {
      editor.open(p);
      return;
    }
    if (action === "export") {
      download(
        JSON.stringify(p, null, 2),
        p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".garment.json",
        "application/json",
      );
      return;
    }
    if (action === "duplicate") {
      p.id = uid();
      p.name += " — copia";
      p.updated = Date.now();
      await saveProject(p);
      await renderRecents();
      return;
    }
    const deleting = action === "delete";
    editor.modal(
      `<h2>${deleting ? "Eliminar proyecto local" : "Renombrar proyecto"}</h2>${deleting ? "<p>Se eliminará el guardado de este navegador. Conservá una copia exportada si la necesitás.</p>" : `<input id="rename-recent" value="${esc(p.name)}" aria-label="Nombre del proyecto">`}<div class="dialog-actions"><button data-close>Cancelar</button><button id="confirm-recent-action" class="${deleting ? "danger" : "primary"}">${deleting ? "Eliminar" : "Guardar"}</button></div>`,
      async (e, d) => {
        if (!e.target.closest("#confirm-recent-action")) return;
        if (deleting) await deleteProject(id);
        else {
          p.name = $("#rename-recent").value.trim() || p.name;
          p.updated = Date.now();
          await saveProject(p);
        }
        d.close();
        await renderRecents();
      },
    );
  }

  function download(data, name, mime) {
    const url = URL.createObjectURL(
        data instanceof Blob ? data : new Blob([data], { type: mime }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function slug() {
    return (runtime.document.project.name || "prenda").replace(
      /[^a-zA-Z0-9À-ÿ_-]+/g,
      "-",
    );
  }

  function exportDialog() {
    editor.modal(
      `<h2>Exportar documento</h2><div class="export-scope"><strong>Documento completo</strong><button data-ux-command="exportSelection" ${runtime.selection.selected.length ? "" : "disabled"}>Sólo selección</button></div><p>SVG conserva trazados. JSON conserva también nodos, vínculos y modificadores entre sesiones.</p><div class="fields">${selectField(
        "exportType",
        "Formato",
        "svg",
        [
          ["svg", "SVG — Vector"],
          ["png", "PNG — Imagen"],
          ["jpeg", "JPEG — Imagen"],
          ["webp", "WebP — Imagen"],
          ["json", "Proyecto .garment.json"],
        ],
      )}${selectField("exportView", "Vista", runtime.document.view, [
        ["front", "Frente"],
        ["back", "Espalda"],
        ["both", "Frente + espalda (dos archivos)"],
      ])}${selectField("exportBg", "Fondo", "document", [
        ["document", "Fondo del documento"],
        ["white", "Blanco"],
        ["transparent", "Transparente"],
      ])}${selectField(
        "exportScale",
        "Resolución PNG",
        settings.exportScale,
        [1, 2, 4].map((v) => [
          v,
          `${v}× · ${rasterSize(runtime.document.project, v).width} × ${rasterSize(runtime.document.project, v).height} px`,
        ]),
      )}</div><div class="dialog-actions"><button data-close>Cancelar</button><button id="do-export" class="primary">Descargar</button></div>`,
      async (e, d) => {
        if (e.target.id !== "do-export") return;
        const value = (k) => d.querySelector(`[data-prop="${k}"]`).value,
          type = value("exportType"),
          bg = value("exportBg"),
          v = value("exportView"),
          scale = Number(value("exportScale"));
        const button = e.target;
        button.disabled = true;
        d.dataset.busy = "true";
        try {
          if (type === "json") {
            download(
              JSON.stringify(runtime.document.project, null, 2),
              slug() + ".garment.json",
              "application/json",
            );
          } else
            for (const side of v === "both" ? ["front", "back"] : [v]) {
              const markup = exportSvg(runtime.document.project, side, bg),
                name = slug() + "-" + (side === "front" ? "frente" : "espalda");
              if (type === "svg")
                download(markup, name + ".svg", "image/svg+xml");
              else if (type === "png") await pngExport(markup, name, scale);
              else await rasterExport(markup, name, type, scale);
            }
          d.close();
          editor.toast("Exportación preparada");
        } catch (err) {
          editor.toast("No se pudo exportar: " + err.message);
        } finally {
          button.disabled = false;
          d.dataset.busy = "false";
        }
      },
    );
  }

  async function pngExport(svg, name, scale) {
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    try {
      const img = new Image();
      await new Promise((r, j) => {
        img.onload = r;
        img.onerror = () => j(Error("No se pudo renderizar el SVG"));
        img.src = url;
      });
      const c = document.createElement("canvas");
      const size = rasterSize(runtime.document.project, scale);
      if (size.width * size.height > 64000000)
        throw Error(
          "La exportación supera 64 megapíxeles. Elegí una escala menor.",
        );
      c.width = size.width;
      c.height = size.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      if (!blob) throw Error("La imagen está vacía");
      download(
        new Blob([pngResolution(await blob.arrayBuffer(), size.ppi)], {
          type: "image/png",
        }),
        name + ".png",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function importImage(file) {
    if (!file) return;
    const origin = runtime.document.project,
      originView = runtime.document.view;
    if (file.size > 20 * 1024 * 1024) {
      editor.toast("La imagen debe pesar menos de 20 MB");
      return;
    }
    try {
      let src;
      if (
        file.type === "image/svg+xml" ||
        file.name.toLowerCase().endsWith(".svg")
      ) {
        const text = sanitizeSvg(await file.text());
        if (
          runtime.document.project !== origin ||
          runtime.document.view !== originView
        )
          throw Error("El documento o la vista cambió durante la importación.");
        try {
          const paths = editableSvg(text);
          if (paths.some((o) => !o.hidden)) {
            editor.commit(() => {
              editor.insertObjects(paths);
              runtime.selection.selected = paths
                .filter((o) => !o.hidden)
                .map((o) => o.id);
            }, "Importar SVG editable");
            editor.toolSet("select");
            editor.toast(
              "SVG importado como " +
                paths.filter((o) => !o.hidden).length +
                " trazados editables",
            );
            return;
          }
        } catch (error) {
          editor.toast(error.message);
        }
        src =
          "data:image/svg+xml;base64," +
          btoa(unescape(encodeURIComponent(text)));
      } else {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
          throw Error("Formato no admitido");
        src = await new Promise((r, j) => {
          const reader = new FileReader();
          reader.onload = () => r(reader.result);
          reader.onerror = j;
          reader.readAsDataURL(file);
        });
      }
      const img = new Image();
      await new Promise((r, j) => {
        img.onload = r;
        img.onerror = () => j(Error("La imagen no se puede abrir"));
        img.src = src;
      });
      if (
        runtime.document.project !== origin ||
        runtime.document.view !== originView
      )
        throw Error("El documento o la vista cambió durante la importación.");
      const scale = Math.min(
          180 / img.naturalWidth,
          180 / img.naturalHeight,
          1,
        ),
        w = img.naturalWidth * scale,
        h = img.naturalHeight * scale;
      const o = {
        id: uid(),
        type: "image",
        name: file.name,
        src,
        w,
        h,
        matrix: translate(350 - w / 2, 300 - h / 2),
        opacity: 1,
      };
      o.width = settings.strokeWidth;
      editor.commit(() => {
        editor.insertObjects([o]);
        runtime.selection.selected = [o.id];
      });
      editor.toolSet("select");
      editor.toast(
        file.name.toLowerCase().endsWith(".svg")
          ? "SVG colocado como imagen · apariencia original conservada"
          : "Gráfico importado",
      );
    } catch (e) {
      editor.toast("No se pudo importar: " + e.message);
    }
  }

  function nativeImport(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      editor.toast("El proyecto debe pesar menos de 20 MB");
      return;
    }
    file
      .text()
      .then((text) => {
        const p = migrateProject(JSON.parse(text));
        p.id = uid();
        editor.open(p);
        editor.toast("Proyecto abierto");
      })
      .catch((e) => editor.toast(e.message));
  }

  function traceImageDialog() {
    const image = editor.one();
    if (image?.type !== "image") {
      editor.toast("Seleccioná una imagen para vectorizar");
      return;
    }
    editor.modal(
      '<h2>Vectorizar gráfico</h2><p>Blanco y negro. Crea contornos editables con huecos. Podés conservar la imagen original. Se procesa una copia de hasta 1024 px de lado.</p><div class="fields"><label class="field">Límite de oscuridad (0–255)<input id="trace-threshold" type="number" min="0" max="255" value="128"></label><label class="field">Ignorar manchas menores a (px)<input id="trace-noise" type="number" min="1" max="1000" value="4"></label><label class="field">Opacidad mínima (0–255)<input id="trace-alpha" type="number" min="0" max="255" value="128"></label><label class="field"><input id="trace-keep" type="checkbox" checked> Conservar imagen original</label></div><p class="ux-explanation">Un valor mayor incluye tonos más claros. Las manchas pequeñas se omiten; los huecos permanecen transparentes.</p><div class="dialog-actions"><button data-close>Cancelar</button><button id="trace-apply" class="primary">Crear vectores</button></div>',
      async (e, d) => {
        if (e.target.id !== "trace-apply") return;
        const button = e.target,
          threshold = Number($("#trace-threshold").value),
          noise = Number($("#trace-noise").value),
          alpha = Number($("#trace-alpha").value),
          keep = $("#trace-keep").checked;
        if (
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 255 ||
          !Number.isFinite(noise) ||
          noise < 1 ||
          noise > 1000 ||
          !Number.isFinite(alpha) ||
          alpha < 0 ||
          alpha > 255
        ) {
          editor.dialogError(
            "Oscuridad y opacidad: 0–255. Manchas: 1–1000 px.",
          );
          return;
        }
        button.disabled = true;
        d.dataset.busy = "true";
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(Error("No se pudo leer la imagen"));
            img.src = image.src;
          });
          const scale = Math.min(
              1,
              1024 / Math.max(img.naturalWidth, img.naturalHeight),
            ),
            w = Math.max(1, Math.round(img.naturalWidth * scale)),
            h = Math.max(1, Math.round(img.naturalHeight * scale)),
            canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(img, 0, 0, w, h);
          const rgba = context.getImageData(0, 0, w, h).data,
            worker = new Worker(new URL("../trace-worker.js", import.meta.url), {
              type: "module",
            });
          const result = await workerTask(
            worker,
            {
              image: clone(image),
              rgba,
              width: w,
              height: h,
              options: { threshold, noise, alpha },
            },
            [rgba.buffer],
          );
          if (!result.length)
            throw Error("No hay contornos oscuros con ese umbral.");
          if (!editor.objects().includes(image))
            throw Error("La imagen seleccionada cambió.");
          editor.commit(() => {
            editor.insertObjects(result);
            if (!keep) {
              const ids = graphIds(editor.objects(), [image.id]);
              runtime.document.project.views[runtime.document.view] = editor
                .objects()
                .filter((o) => !ids.includes(o.id));
            }
            runtime.selection.selected = result.map((o) => o.id);
          }, "Vectorizar gráfico");
          d.close();
          editor.toast(result.length + " contornos editables creados");
        } catch (err) {
          if ($("#modal").open) editor.dialogError(err.message);
          else editor.toast(err.message);
        } finally {
          button.disabled = false;
          d.dataset.busy = "false";
        }
      },
    );
  }

  function exportSelectionDialog() {
    if (!runtime.selection.selected.length) {
      editor.toast("Seleccioná una pieza o gráfico para exportar");
      return;
    }
    editor.modal(
      `<h2>Exportar selección</h2><div class="export-scope"><button data-ux-command="exportDocument">Documento completo</button><strong>Sólo selección</strong></div><div class="fields">${selectField(
        "selectionFormat",
        "Formato",
        "svg",
        [
          ["svg", "SVG vectorial"],
          ["png", "PNG"],
          ["jpeg", "JPEG"],
          ["webp", "WebP"],
        ],
      )}${selectField("selectionScale", "Escala", "1", [
        [1, "1×"],
        [2, "2×"],
        [4, "4×"],
      ])}${selectField("selectionBg", "Fondo", "transparent", [
        ["transparent", "Transparente"],
        ["white", "Blanco"],
      ])}</div><div class="dialog-actions"><button data-close>Cancelar</button><button id="selection-export-apply" class="primary">Descargar</button></div>`,
      async (e, d) => {
        if (e.target.id !== "selection-export-apply") return;
        const read = (k) => d.querySelector(`[data-prop="${k}"]`).value,
          format = read("selectionFormat");
        e.target.disabled = true;
        d.dataset.busy = "true";
        try {
          const result = selectionExport(
            runtime.document.project,
            runtime.document.view,
            runtime.selection.selected,
            format === "jpeg" ? "white" : read("selectionBg"),
          );
          if (format === "svg")
            download(result.markup, slug() + "-seleccion.svg", "image/svg+xml");
          else
            await rasterExport(
              result.markup,
              slug() + "-seleccion",
              format,
              Number(read("selectionScale")),
              result,
            );
          d.close();
        } catch (err) {
          if ($("#modal").open) editor.dialogError(err.message);
          else editor.toast(err.message);
        } finally {
          e.target.disabled = false;
          d.dataset.busy = "false";
        }
      },
    );
  }

  async function rasterExport(markup, name, format, scale, region) {
    const url = URL.createObjectURL(
      new Blob([markup], { type: "image/svg+xml" }),
    );
    try {
      const img = new Image();
      await new Promise((r, j) => {
        img.onload = r;
        img.onerror = () => j(Error("No se pudo renderizar el SVG"));
        img.src = url;
      });
      const size = region
        ? {
            width: Math.ceil(region.width * scale),
            height: Math.ceil(region.height * scale),
          }
        : rasterSize(runtime.document.project, scale);
      if (
        size.width * size.height > 64000000 ||
        Math.max(size.width, size.height) > 32768
      )
        throw Error(
          "Elegí una escala menor: la imagen supera el límite de exportación.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mime = "image/" + format,
        blob = await new Promise((r) => canvas.toBlob(r, mime, 0.92));
      if (!blob || blob.type !== mime)
        throw Error("Este navegador no admite " + format.toUpperCase());
      download(blob, name + "." + (format === "jpeg" ? "jpg" : format));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return {
    renderRecents,
    newDocument,
    createDocument,
    closeProjectMenu,
    showProjectMenu,
    recentAction,
    exportDialog,
    importImage,
    nativeImport,
    traceImageDialog,
    exportSelectionDialog,
  };
}
