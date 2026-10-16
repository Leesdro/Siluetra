import { paintState, paintCss } from "../paint-state.js";
import { orderedObjects } from "../layers.js";
import {
  fabricSwatch,
  fabrics,
  assignFabric,
  fabricEligible,
} from "../fabric.js";
import {
  colorValue,
  rememberColor,
  colorPalette,
  bindColorPicker,
} from "../color.js";
import { uiIcon } from "../ui-icons.js";
import { resolveRef, canonicalRefs } from "../construction-system.js";
import { visible, locked } from "../model.js";
import { hitObject, paintOrder } from "../hit.js";
import {
  settings,
  stylePresets,
  saveStyle,
  applyStyle,
} from "../preferences.js";
import { linked } from "../core.js";
import { esc } from "../render.js";
import { effectTypes, modifier } from "../effects.js";
import { $ } from "./ui.js";

// appearance: editor controller; geometry and document services remain authoritative.
export function createAppearanceController(runtime, editor) {
  function applyAppearance() {
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.documentElement?.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
    document.documentElement?.style.setProperty(
      "--canvas-custom",
      settings.canvas,
    );
    $("#canvas-wrap").style.background =
      settings.canvas === "#e9ece5" ? "var(--surface-canvas)" : settings.canvas;
    $("#quick-theme").title = "Apariencia";
    $("#quick-theme").innerHTML = uiIcon(
      settings.theme === "system" ? "system" : dark ? "moon" : "sun",
    );
    if (runtime.document.project) editor.updateArtboard();
    else $(".artboard")?.setAttribute("fill", settings.artboard);
    $("#grid")
      ?.querySelector("circle")
      ?.setAttribute("fill", settings.gridColor);
  }

  function presetsDialog() {
    const o = editor.one(),
      active = editor.activeConstructionRefs(),
      target = active.length
        ? resolveRef(editor.objects(), active[0]).value
        : o?.source
          ? o
          : o?.modifiers?.at(-1) || o;
    const compatible = stylePresets.filter(
      (p) => p.values.type === target?.type || o?.type === "path",
    );
    editor.modal(
      `<h2>Presets de estilo</h2><p>Guarda parámetros, sin geometría. Aplicar un estilo nunca modifica el preset guardado.</p><input id="preset-name" placeholder="Mi costura denim"><div class="prop-buttons"><button id="preset-save" ${!target ? "disabled" : ""}>Guardar estilo actual</button></div><div class="preset-list">${compatible.map((p) => `<div><span>${esc(p.name)}</span><button data-preset="${p.id}">Aplicar</button><button data-overwrite="${p.id}" title="Reemplazar este preset con los parámetros actuales">Sobrescribir</button></div>`).join("") || "<p>Sin presets compatibles todavía.</p>"}</div><details><summary>Estilos incluidos</summary><div class="prop-buttons"><button data-builtin="denim">Denim doble</button><button data-builtin="fine">Pespunte fino</button><button data-builtin="heavy">Puntada larga</button></div></details><div class="dialog-actions"><button data-close>Cerrar</button></div>`,
      (e, d) => {
        if (e.target.id === "preset-save" && target) {
          const name = $("#preset-name").value.trim();
          if (!name) {
            editor.toast("Ingresá un nombre para el estilo");
            return;
          }
          saveStyle(name, target);
          d.close();
          editor.toast("Estilo guardado");
        }
        const b = e.target.closest("[data-preset]"),
          overwrite = e.target.closest("[data-overwrite]"),
          builtin = e.target.closest("[data-builtin]");
        if (b && target) {
          const p = stylePresets.find((p) => p.id === b.dataset.preset);
          editor.commit(() => {
            if (o?.type === "path" && target.type !== p.values.type) {
              if (effectTypes.includes(p.values.type)) {
                const effect = linked(o, p.values.type);
                applyStyle(effect, p);
                editor.insertObjects([effect]);
                runtime.selection.selected = [effect.id];
              } else {
                o.modifiers ??= [];
                const m = modifier(p.values.type);
                applyStyle(m, p);
                o.modifiers.push(m);
              }
            } else if (active.length)
              for (const ref of canonicalRefs(
                runtime.document.project,
                runtime.document.view,
                active,
              ))
                applyStyle(resolveRef(editor.objects(), ref).value, p);
            else applyStyle(target, p);
          });
          d.close();
        }
        if (overwrite && target) {
          const p = stylePresets.find(
            (p) => p.id === overwrite.dataset.overwrite,
          );
          saveStyle(p.name, target, p.id);
          d.close();
          editor.toast("Preset actualizado");
        }
        if (builtin && target) {
          const style = builtin.dataset.builtin;
          editor.commit(() => {
            if (["stitch", "rib", "zipper", "cord"].includes(target.type)) {
              if (target.type === "stitch")
                Object.assign(
                  target,
                  style === "denim"
                    ? {
                        rows: 2,
                        offset: 5,
                        spacing: 3,
                        length: 4,
                        width: 1,
                        thickness: 1,
                      }
                    : style === "fine"
                      ? {
                          rows: 1,
                          offset: 3,
                          spacing: 2,
                          length: 2,
                          width: 0.6,
                          thickness: 0.6,
                        }
                      : {
                          rows: 1,
                          offset: 6,
                          spacing: 3,
                          length: 8,
                          width: 1.2,
                          thickness: 1.2,
                        },
                );
              else if (target.type === "rib")
                Object.assign(target, {
                  spacing: style === "fine" ? 3 : style === "heavy" ? 9 : 5,
                });
            }
          });
          d.close();
        }
      },
    );
  }

  function colorTarget(p, closed = true) {
    return paintOrder(
      orderedObjects(runtime.document.project, runtime.document.view),
    )
      .reverse()
      .find(
        (o) =>
          visible(runtime.document.project, runtime.document.view, o) &&
          !locked(runtime.document.project, runtime.document.view, o) &&
          o.type === "path" &&
          (!closed || o.closed) &&
          hitObject(
            { ...o, fill: o.closed ? "#fff" : o.fill },
            editor.objects(),
            p,
            closed ? 0 : 5 / runtime.canvas.camera.z,
          ),
      );
  }

  function mutateColor(
    value,
    ids = runtime.selection.selected,
    target = runtime.document.project.colors.target,
  ) {
    const v = colorValue(value);
    if (!v) return;
    runtime.document.project.colors[target] = v;
    for (const o of editor
      .objects()
      .filter(
        (o) =>
          ids.includes(o.id) &&
          (target === "stroke" ||
            (o.type === "path" && o.closed) ||
            o.type === "text"),
      )) {
      o[target] = v;
      if (target === "fill") delete o.gradient;
      if (target === "fill")
        o.opacity = runtime.document.project.colors.opacity;
      if (o.regionIds?.length && target === "fill")
        for (const r of editor
          .objects()
          .filter((r) => o.regionIds.includes(r.id))) {
          r.fill = v;
          delete r.gradient;
        }
      if (runtime.document.project.colors.applyTo === "both") {
        const side = runtime.document.view === "front" ? "back" : "front",
          link = runtime.document.project.garment.links.find(
            (l) => l[runtime.document.view] === o.id,
          ),
          peer = runtime.document.project.views[side].find(
            (p) => p.id === link?.[side],
          );
        if (peer) {
          peer[target] = v;
          if (target === "fill") delete peer.gradient;
        }
      }
    }
  }

  function setActiveColor(value) {
    if (!colorValue(value)) {
      editor.toast("Ingresá un color HEX válido.");
      return;
    }
    editor.commit(
      () => {
        mutateColor(value);
        rememberColor(runtime.document.project.colors, value);
      },
      runtime.document.project.colors.target === "fill"
        ? "Cambiar relleno"
        : "Cambiar línea",
    );
    showColorPalette();
  }

  function applyColor(
    value,
    ids = runtime.selection.selected,
    target = runtime.document.project.colors.target,
  ) {
    if (!colorValue(value)) return;
    editor.commit(
      () => {
        mutateColor(value, ids, target);
        rememberColor(runtime.document.project.colors, value);
      },
      target === "fill" ? "Aplicar relleno vectorial" : "Cambiar línea",
    );
  }

  function showColorPalette(target = null) {
    if (!runtime.document.project) return;
    runtime.services.workspace.layout.color.visible = true;
    runtime.services.workspace.save();
    if (target) {
      runtime.document.project.colors.target = target;
      const os = editor
        .chosen()
        .filter(
          (o) =>
            (o.type === "path" && (target === "stroke" || o.closed)) ||
            o.type === "text",
        );
    }
    const host = $("#color-palette");
    const state = paintState(
        editor.chosen(),
        runtime.document.project.colors.target,
        runtime.document.project.colors,
      ),
      display = {
        ...runtime.document.project.colors,
        [runtime.document.project.colors.target]:
          state.kind === "solid"
            ? state.value
            : state.kind === "none"
              ? "none"
              : runtime.document.project.colors[
                  runtime.document.project.colors.target
                ],
      };
    host.innerHTML =
      colorPalette(display) +
      `<div class="paint-status">${state.kind === "mixed" ? "Valores mixtos: elegir color unifica la selección" : state.kind === "gradient" ? "Degradado: sus paradas se editan en Apariencia" : state.label}</div>`;
    host.classList.remove("hidden");
    bindColorPicker(
      host,
      display[runtime.document.project.colors.target],
      setActiveColor,
      {
        begin: () =>
          runtime.services.preview.begin(
            runtime.document.project.colors.target === "fill"
              ? "Cambiar relleno"
              : "Cambiar línea",
          ),
        update: (v) => runtime.services.preview.update(() => mutateColor(v)),
        commit: () => {
          runtime.services.preview.finish();
          showColorPalette();
        },
        cancel: () => {
          runtime.services.preview.cancel();
          showColorPalette();
        },
      },
    );
  }

  function fabricPalette() {
    const o = editor.chosen().find(fabricEligible),
      t = o?.fabricTexture;
    return `<header class="floating-header"><strong>${uiIcon("fabric")}Textura de tela</strong><button data-fabric-close aria-label="Cerrar textura">${uiIcon("close")}</button></header><div class="floating-body">${!o ? "<p>Seleccioná una pieza o región cerrada.</p>" : ""}<div class="fabric-tiles"><button data-fabric-type="none" class="${!t ? "active" : ""}"><span class="fabric-swatch fabric-none"></span>Ninguna</button>${Object.entries(
      fabrics,
    )
      .map(
        ([key, f]) =>
          `<button data-fabric-type="${key}" class="${t?.type === key ? "active" : ""}"><span class="fabric-swatch fabric-${key}">${fabricSwatch(key)}</span>${f.name}</button>`,
      )
      .join("")}</div>${
      t
        ? `<div class="fields">${[["intensity", "Intensidad", 0, 100, 1], ["scale", "Escala", 0.2, 4, 0.05], ["angle", "Ángulo", -180, 180, 1], ...(fabrics[t.type]?.density ? [["density", "Densidad", 0.3, 3, 0.1]] : [])].map(([key, label, min, max, step]) => `<label class="field full">${label}<input type="range" data-fabric-param="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${t[key]}"><output>${t[key]}${key === "intensity" ? "%" : ""}</output></label>`).join("")}<label class="field full">Tono<select data-fabric-param="colorMode">${[
            ["automatic", "Automático"],
            ["light", "Claro"],
            ["dark", "Oscuro"],
            ["custom", "Personalizado"],
          ]
            .map(
              ([v, n]) =>
                `<option value="${v}" ${t.colorMode === v ? "selected" : ""}>${n}</option>`,
            )
            .join(
              "",
            )}</select></label>${t.colorMode === "custom" ? `<label class="field full">Color<input type="color" data-fabric-param="customColor" value="${t.customColor}"></label>` : ""}</div>`
        : ""
    }<label class="field full">Aplicar a<select data-fabric-scope><option value="this" ${runtime.appearance.fabricScope === "this" ? "selected" : ""}>Esta vista</option><option value="both" ${runtime.appearance.fabricScope === "both" ? "selected" : ""}>Ambas vistas vinculadas</option></select></label></div>`;
  }

  function showFabricPalette() {
    runtime.services.workspace.layout.fabric.visible = true;
    runtime.services.workspace.save();
    $("#fabric-palette").innerHTML = fabricPalette();
    $("#fabric-palette").classList.remove("hidden");
  }

  function setFabric(type, params = {}) {
    editor.commit(
      () =>
        assignFabric(
          runtime.document.project,
          runtime.document.view,
          runtime.selection.selected,
          type,
          { scope: runtime.appearance.fabricScope, ...params },
        ),
      type === "none" ? "Quitar textura" : "Aplicar textura de tela",
    );
    showFabricPalette();
  }
  function renderAppearancePane() {
    if (!document.body || !runtime.document.project) return;
    const fill = paintCss(
        paintState(editor.chosen(), "fill", runtime.document.project.colors),
      ),
      stroke = paintCss(
        paintState(editor.chosen(), "stroke", runtime.document.project.colors),
      );
    const o = editor.one(),
      colors = runtime.document.project.colors,
      host = $("#appearance-content");
    host.innerHTML = `<section class="desktop-appearance"><h3>Apariencia</h3><div class="appearance-swatches"><button data-appearance-color="fill"><span class="paint-chip" style="background:${fill}"></span>Relleno</button><button data-appearance-color="stroke"><span class="paint-chip" style="background:${stroke}"></span>Línea</button></div><label class="field full">Opacidad<input type="range" min="0" max="100" step="1" data-live-prop="opacity" value="${Math.round((o?.opacity ?? 1) * 100)}" aria-label="Opacidad" ${o ? "" : "disabled"}></label><label class="field full">Fusión<select data-appearance-blend ${o ? "" : "disabled"}>${["normal", "multiply", "screen", "overlay", "darken", "lighten"].map((v) => `<option value="${v}" ${o?.blendMode === v ? "selected" : ""}>${{ normal: "Normal", multiply: "Multiplicar", screen: "Trama", overlay: "Superponer", darken: "Oscurecer", lighten: "Aclarar" }[v]}</option>`).join("")}</select></label><button data-appearance-fabric>Textura de tela</button></section>`;
    host.onclick = (e) => {
      const b = e.target.closest("[data-appearance-color]");
      if (b) showColorPalette(b.dataset.appearanceColor);
      if (e.target.closest("[data-appearance-fabric]")) showFabricPalette();
    };
    host.oninput = (e) => {
      if (e.target.dataset.liveProp === "opacity") {
        if (!runtime.services.preview.active)
          runtime.services.preview.begin("Cambiar opacidad");
        runtime.services.preview.update(() =>
          editor
            .chosen()
            .forEach(
              (o) =>
                (o.opacity = Math.max(
                  0,
                  Math.min(1, Number(e.target.value) / 100),
                )),
            ),
        );
      }
    };
    host.onchange = (e) => {
      if (e.target.dataset.liveProp === "opacity")
        runtime.services.preview.finish();
      if (e.target.hasAttribute("data-appearance-blend"))
        editor.setProperty("blendMode", e.target.value);
    };
    host.onpointercancel = () => {
      runtime.services.preview.cancel();
      renderAppearancePane();
    };
  }
  return {
    renderAppearancePane,
    applyAppearance,
    presetsDialog,
    colorTarget,
    mutateColor,
    setActiveColor,
    applyColor,
    showColorPalette,
    showFabricPalette,
    setFabric,
  };
}
