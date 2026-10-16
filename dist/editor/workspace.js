import { uiIcon } from "../ui-icons.js";
import { variant } from "../model.js";
import { settings, updateSettings, stylePresets } from "../preferences.js";
import { uid, translate, around, bounds } from "../core.js";
import { esc } from "../render.js";
import { $, $$ } from "./ui.js";

// workspace: editor controller; geometry and document services remain authoritative.
export function createWorkspaceController(runtime, editor) {
  function toast(s) {
    $("#toast").textContent = s;
    $("#toast").classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $("#toast").classList.remove("show"), 3300);
  }

  function status(s) {
    $("#status").textContent = s;
  }

  function modal(html, handler) {
    if (runtime.document.project) {
      editor.cancelDocumentOperation();
      editor.render();
    }
    const d = $("#modal"),
      title = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] || "Siluetra",
      footer = (
        html.match(/<div class="dialog-actions">([\s\S]*?)<\/div>/)?.[1] || ""
      )
        .replace(
          /<button[^>]*data-close[^>]*>\s*(?:Cerrar|Close|Entendido)\s*<\/button>/gi,
          "",
        )
        .trim();
    const body = html
      .replace(/<h2[^>]*>[\s\S]*?<\/h2>/, "")
      .replace(/<div class="dialog-actions">[\s\S]*?<\/div>/, "");
    d.onchange = null;
    d.oninput = null;
    d.onkeydown = null;
    d.dataset.busy = "false";
    d.innerHTML = `<header class="modal-header"><h2>${title}</h2><button class="modal-close" data-close title="Cerrar · Escape" aria-label="Cerrar ventana">${uiIcon("close")}</button></header><div class="modal-content"><p id="modal-error" class="dialog-error hidden" role="alert"></p>${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}`;
    const priorFocus = document.activeElement;
    d.onclose = () =>
      priorFocus?.isConnected ? priorFocus.focus() : $("#canvas").focus();
    d.showModal();
    d.onkeydown = (e) => {
      if (
        e.key === "Enter" &&
        e.target.tagName !== "TEXTAREA" &&
        !["BUTTON","SP-BUTTON","SP-ACTION-BUTTON"].includes(e.target.tagName) &&
        d.dataset.busy !== "true"
      ) {
        const primary = d.querySelector(
          ".modal-footer .primary:not([disabled])",
        );
        if (primary) {
          e.preventDefault();
          primary.click();
        }
      }
    };
    d.onclick = (e) => {
      if (e.target.closest("[data-close]") && d.dataset.busy !== "true") {
        d.close();
        return;
      }
      if (e.target === d && d.dataset.busy !== "true") {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        ) {
          d.close();
          return;
        }
      }
      if (handler) return handler(e, d);
    };
    d.oncancel = (e) => {
      if (d.dataset.busy === "true") e.preventDefault();
    };
  }

  function showText(p) {
    modal(
      '<h2>Agregar texto</h2><p>Texto vectorial para etiquetas y gráficos.</p><input id="new-text" value="DROSEL" aria-label="Texto"><div class="dialog-actions"><button data-close>Cancelar</button><button class="primary" id="add-text">Agregar</button></div>',
      (e, d) => {
        if (e.target.id === "add-text") {
          const text = $("#new-text").value;
          if (!text) return;
          const o = {
            id: uid(),
            type: "text",
            name: "Texto",
            text,
            fontSize: 28,
            w: text.length * 28 * 0.62,
            h: 36,
            matrix: translate(p.x, p.y),
            fill: "#252a29",
            stroke: "none",
            width: 0,
            opacity: 1,
          };
          o.width = settings.strokeWidth;
          editor.commit(() => {
            editor.insertObjects([o]);
            runtime.selection.selected = [o.id];
          });
          editor.toolSet("select");
          d.close();
        }
      },
    );
  }

  function help() {
    modal(
      `<h2>Diseñá con menos pasos</h2><button data-ux-command="helpTools">Guía de herramientas</button><p>El lienzo usa unidades de ilustración, no medidas de moldería.</p><table>${[
        ["Seleccionar / nodos", "V / A"],
        ["Pluma / línea", "P / L"],
        ["Rectángulo / elipse / texto", "R / O / T"],
        ["Editar puntos de una pieza", "Doble clic"],
        ["Agregar punto al segmento", "Doble clic en modo nodos"],
        ["Deshacer / rehacer", "Ctrl Z / Ctrl Shift Z"],
        ["Copiar / pegar / cortar", "Ctrl C / V / X"],
        ["Duplicar / seleccionar todo", "Ctrl D / A"],
        ["Agrupar / desagrupar", "Ctrl G / Ctrl Shift G"],
        ["Guardar", "Ctrl S"],
        ["Mover lienzo", "Espacio + arrastrar"],
        ["Zoom / ajustar", "Rueda / Ctrl 0"],
        ["Proporción / eje / ángulo", "Shift + arrastrar"],
        ["Terminar pluma", "Enter / clic en primer nodo"],
        ["Espejo vivo / eje", "Botones bajo el lienzo"],
        ["Duplicar al arrastrar", "Alt + arrastrar"],
        ["Curvar pieza", "Modificador + tirador"],
        ["Salir de nodos / grupo", "Escape"],
      ]
        .map(
          ([a, b]) =>
            `<tr><td>${a}</td><td>${b.replaceAll("Ctrl", "Ctrl / ⌘")}</td></tr>`,
        )
        .join(
          "",
        )}</table><p>Clic derecho en una línea para agregar costuras o un cierre. Guardado automático local; descargá JSON para hacer una copia.</p><div class="dialog-actions"><button data-close class="primary">Entendido</button></div>`,
    );
  }

  function settingsDialog() {
    const check = (k, n) =>
        `<label class="setting-check"><input data-setting="${k}" type="checkbox" ${settings[k] ? "checked" : ""}>${n}</label>`,
      number = (k, n, min, max) =>
        `<div class="field"><label>${n}</label><input data-setting="${k}" type="number" min="${min}" max="${max}" step=".1" value="${settings[k]}"></div>`,
      choose = (k, n, options) =>
        `<div class="field"><label>${n}</label><select data-setting="${k}">${options.map(([v, n]) => `<option value="${v}" ${settings[k] === v ? "selected" : ""}>${n}</option>`).join("")}</select></div>`,
      color = (k, n) =>
        `<div class="field"><label>${n}</label><input type="color" data-setting="${k}" value="${settings[k]}"></div>`;
    modal(
      settingsLayout(
        `<h2>Ajustes de Siluetra</h2><p>Preferencias persistentes para este navegador.</p><details open><summary>General</summary><div class="fields">${
          choose("units", "Unidades", [
            ["px", "Píxeles"],
            ["mm", "Milímetros (96 dpi)"],
          ]) +
          choose("exportScale", "Escala PNG", [
            [1, "1×"],
            [2, "2×"],
            [4, "4×"],
          ])
        }</div>${check("autosave", "Guardado automático")}</details><details open><summary>Editor</summary><div class="fields">${
          number("nodeSize", "Tamaño de nodo (px)", 4, 16) +
          number("strokeWidth", "Grosor inicial", 0.1, 12) +
          number("smoothing", "Suavizado lápiz", 0, 100) +
          choose("selection", "Selección inicial", [
            ["group", "Grupo"],
            ["individual", "Pieza"],
          ])
        }</div>${check("handles", "Mostrar tiradores Bézier") + check("mirrorDefault", "Espejo vivo en proyectos nuevos")}</details><details open><summary>Apariencia</summary><div class="fields">${
          choose("theme", "Tema", [
            ["light", "Claro"],
            ["dark", "Oscuro"],
            ["system", "Sistema"],
          ]) +
          color("canvas", "Mesa de trabajo") +
          color("artboard", "Hoja") +
          color("gridColor", "Grilla")
        }</div></details><details><summary>Snapping</summary>${check("snapCenter", "Eje central") + check("snapNodes", "Nodos y trazados") + check("snapIntersections", "Intersecciones de curvas") + check("snapBounds", "Bordes") + check("snapGuides", "Guías") + check("snapObjects", "Otras piezas")}<div class="fields">${number("snapThreshold", "Tolerancia (px)", 1, 20)}</div></details><details><summary>Presets</summary><p>${stylePresets.length} estilos guardados. Seleccioná un efecto y usá Estilo para guardar o aplicar sus parámetros.</p></details><details><summary>Atajos</summary><p>V Selección · A Nodos · B Bordes · E Borrador · N Lápiz · P Pluma · L Línea · R Rectángulo · O Elipse · T Texto<br>Alt clic: recorrer superpuestos · Alt arrastrar: duplicar<br>Espacio: mover mesa · Escape: salir del aislamiento<br>Ctrl Z / Ctrl Shift Z: deshacer / rehacer · Ctrl S: guardar</p></details><div class="dialog-actions"><button data-close>Cerrar</button></div>`,
      ),
      (e) => {
        const b = e.target.closest("[data-settings-page]");
        if (b) {
          $$("[data-settings-page]").forEach((el) =>
            el.classList.toggle(
              "active",
              el.dataset.settingsPage === b.dataset.settingsPage,
            ),
          );
          $$("[data-settings-panel]").forEach((el) =>
            el.classList.toggle(
              "hidden",
              el.dataset.settingsPanel !== b.dataset.settingsPage,
            ),
          );
        }
      },
    );
    $("#modal").onchange = (e) => {
      const k = e.target.dataset.setting;
      if (!k) return;
      let v =
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.type === "number"
            ? Number(e.target.value)
            : e.target.value;
      if (e.target.type === "number") {
        const min = Number(e.target.min),
          max = Number(e.target.max);
        v = Math.min(max, Math.max(min, v));
      }
      if (k === "exportScale") v = Number(v);
      updateSettings({ [k]: v });
      editor.applyAppearance();
      if (runtime.document.project) editor.render();
    };
  }

  function variantDialog() {
    const pop = $("#variants-popover");
    if (!pop.classList.contains("hidden")) {
      closeVariants();
      return;
    }
    runtime.workspace.variantRename = null;
    renderVariantPopover();
    pop.classList.remove("hidden");
    const r = $("#variant-button").getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 290)) + "px";
    pop.style.top = Math.min(r.bottom + 6, innerHeight - 230) + "px";
    $("#variant-button").setAttribute("aria-expanded", "true");
  }

  function closeVariants() {
    $("#variants-popover").classList.add("hidden");
    $("#variant-button").setAttribute("aria-expanded", "false");
    runtime.workspace.variantRename = null;
  }

  function variantNames() {
    return [
      ...new Set([
        runtime.document.project.activeVariant,
        ...runtime.document.project.variants.map((v) => v.name),
      ]),
    ];
  }

  function nextVariantName() {
    let n = 2;
    while (variantNames().includes("V" + n)) n++;
    return "V" + n;
  }

  function renderVariantPopover() {
    const names = variantNames(),
      button = (op, name, label) =>
        `<button data-variant-op="${op}" data-variant-name="${esc(name)}" title="${label}">${uiIcon(label === "Duplicar" ? "copy" : label === "Renombrar" ? "edit" : "trash")}</button>`;
    $("#variants-popover").innerHTML =
      `<div class="popover-title">Variantes <button data-close-variants title="Cerrar · Escape">${uiIcon("close")}</button></div><div class="variant-list">${names.map((name) => `<div class="variant-row ${name === runtime.document.project.activeVariant ? "current" : ""}">${runtime.workspace.variantRename === name ? `<input id="variant-inline-name" data-rename-from="${esc(name)}" value="${esc(name)}" aria-label="Nombre de variante"><button data-commit-variant-name title="Guardar nombre">${uiIcon("check")}</button>` : `<button class="variant-name" data-switch-variant="${esc(name)}"><span><i class="state-dot"></i></span>${esc(name)}${name === runtime.document.project.activeVariant ? "<small>Actual</small>" : ""}</button><div class="variant-actions">${button("duplicate", name, "Duplicar") + button("rename", name, "Renombrar") + (names.length > 1 ? button("delete", name, "Eliminar") : "")}</div>`}</div>`).join("")}</div><div class="variant-footer"><button data-new-variant>+ Nueva variante</button><button data-duplicate-current>Duplicar actual</button></div>`;
  }

  function changeVariant(
    operation,
    name,
    sourceName = runtime.document.project.activeVariant,
  ) {
    editor.commit(() => {
      if (sourceName !== runtime.document.project.activeVariant)
        variant(runtime.document.project, "switch", sourceName);
      variant(runtime.document.project, operation, name);
    });
    runtime.selection.selected = [];
    runtime.selection.edgeIds = [];
    runtime.selection.rangeSelections = {};
    runtime.selection.constructionContexts = [];
    runtime.selection.modifierContext = null;
    runtime.interaction.pendingStack = null;
    runtime.selection.isolation = [];
    renderVariantPopover();
    editor.render();
  }

  function commitVariantName() {
    const input = $("#variant-inline-name"),
      name = input.value.trim(),
      from = input.dataset.renameFrom;
    if (!name) return;
    if (name !== from && variantNames().includes(name)) {
      toast("Ya existe una variante con ese nombre");
      return;
    }
    runtime.workspace.variantRename = null;
    changeVariant("rename", name, from);
  }

  function dimensionDialog() {
    const links = runtime.document.project.garment.links.filter((l) =>
      editor.objects().some((o) => o.id === l[runtime.document.view]),
    );
    modal(
      "<h2>Dimensiones compartidas</h2><p>Proporciones de ilustración. Los cambios se aplican a ambas vistas conservando sus detalles.</p>" +
        links
          .map((l) => {
            const o = editor
                .objects()
                .find((o) => o.id === l[runtime.document.view]),
              b = bounds(o);
            return `<details open><summary>${esc(l.key)}</summary><div class="fields"><div class="field"><label>Ancho (${settings.units})</label><input data-dimension="${o.id}" data-axis="w" type="number" min="1" value="${(b.w * (settings.units === "mm" ? 25.4 / 96 : 1)).toFixed(1)}"></div><div class="field"><label>Largo (${settings.units})</label><input data-dimension="${o.id}" data-axis="h" type="number" min="1" value="${(b.h * (settings.units === "mm" ? 25.4 / 96 : 1)).toFixed(1)}"></div></div></details>`;
          })
          .join("") +
        '<div class="dialog-actions"><button data-close>Cerrar</button></div>',
      () => {},
    );
    $("#modal").onchange = (e) => {
      const id = e.target.dataset.dimension;
      if (!id) return;
      const o = editor.objects().find((o) => o.id === id),
        key = e.target.dataset.axis,
        value =
          Number(e.target.value) * (settings.units === "mm" ? 96 / 25.4 : 1);
      if (!o || !Number.isFinite(value) || value <= 0) return;
      editor.commit(() => {
        runtime.document.project.applyTo = "both";
        const b = bounds(o),
          m = around(
            b.x + b.w / 2,
            b.y,
            key === "w" ? value / (b.w || 1) : 1,
            key === "h" ? value / (b.h || 1) : 1,
          );
        editor.applyTransform(m, [id]);
      });
    };
  }

  function closeAppearance() {
    $("#appearance-popover").classList.add("hidden");
    $("#quick-theme").setAttribute("aria-expanded", "false");
  }

  function renderHistory() {
    if (!runtime.document.history) return;
    $("#undo").title =
      "Deshacer" +
      (runtime.document.history.pastLabels.length
        ? ": " + runtime.document.history.pastLabels.at(-1)
        : "") +
      " · Ctrl Z";
    $("#redo").title =
      "Rehacer" +
      (runtime.document.history.futureLabels.length
        ? ": " + runtime.document.history.futureLabels.at(-1)
        : "") +
      " · Ctrl Shift Z";
    $("#history-palette").innerHTML =
      `<header class="floating-header" data-floating-handle><strong>${uiIcon("history")}Historial</strong><button data-close-history title="Cerrar historial" aria-label="Cerrar historial">${uiIcon("close")}</button></header><div class="history-list">${runtime.document.history.entries.map((e) => `<button data-history-index="${e.index}" class="${e.current ? "current" : ""}" aria-current="${e.current ? "step" : "false"}"><span><i class="state-dot"></i></span>${esc(e.label)}${e.current ? "<small>Actual</small>" : ""}</button>`).join("")}</div>`;
  }

  function toggleHistory() {
    const host = $("#history-palette");
    renderHistory();
    host.classList.toggle("hidden");
    $("#history-button").setAttribute(
      "aria-expanded",
      String(!host.classList.contains("hidden")),
    );
  }

  function settingsLayout(html) {
    const sections = [
      ...html.matchAll(
        /<details[^>]*><summary>(.*?)<\/summary>([\s\S]*?)<\/details>/g,
      ),
    ];
    return (
      '<h2>Ajustes de Siluetra</h2><div class="settings-layout"><nav aria-label="Secciones de ajustes">' +
      sections
        .map(
          (m, i) =>
            `<button data-settings-page="${i}" class="${i === 0 ? "active" : ""}">${m[1]}</button>`,
        )
        .join("") +
      '</nav><div class="settings-pages">' +
      sections
        .map(
          (m, i) =>
            `<section data-settings-panel="${i}" class="${i === 0 ? "" : "hidden"}"><h3>${m[1]}</h3>${m[2]}</section>`,
        )
        .join("") +
      "</div></div>"
    );
  }

  function finishZoom(commit = true) {
    const input = $("#zoom-edit");
    if (input.classList.contains("hidden")) return;
    const value = Number(input.value);
    if (commit && Number.isFinite(value) && value > 0)
      editor.zoom(
        Math.max(8, Math.min(1200, value)) / 100 / runtime.canvas.camera.z,
      );
    input.classList.add("hidden");
    $("#zoom").classList.remove("hidden");
  }

  function dialogError(message) {
    const el = $("#modal-error");
    el.textContent = message;
    el.classList.remove("hidden");
  }
  return {
    toast,
    status,
    modal,
    showText,
    help,
    settingsDialog,
    variantDialog,
    closeVariants,
    nextVariantName,
    renderVariantPopover,
    changeVariant,
    commitVariantName,
    dimensionDialog,
    closeAppearance,
    renderHistory,
    toggleHistory,
    finishZoom,
    dialogError,
  };
}
