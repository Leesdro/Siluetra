import { uiIcon, actionIcons } from "../ui-icons.js";
import { settings } from "../preferences.js";
import { esc } from "../render.js";
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export const learnKey = (action) =>
  ({
    editNodes: "node",
    editAnchors: "node",
    editEdges: "edge",
    createPanel: "panel",
    dupMirror: "copyMirror",
    mirrorObjects: "liveMirror",
    fabricFall: "stack",
    finish: "hem",
  })[action] || action;
export const actionIcon = (action) =>
  uiIcon(
    actionIcons[action] ||
      { moveHint: "move", editAnchors: "node", editEdges: "edge" }[action] ||
      "path",
  );
export const field = (key, label, value, type = "number", full = false) => {
  const unit =
    type === "number" && ["x", "y", "w", "h", "centerAxis"].includes(key)
      ? settings.units
      : key === "rotation"
        ? "°"
        : key === "opacity"
          ? "%"
          : "";
  if (unit === "mm") value = (value * 25.4) / 96;
  const input = `<input data-prop="${key}" aria-label="${label}${unit ? " " + unit : ""}" type="${type}" value="${type === "number" ? Math.round((value || 0) * 10) / 10 : esc(value)}" ${type === "number" ? 'step="0.1"' : ""}>`;
  return `<div class="field ${full ? "full" : ""}"><label>${label.replace(/ [°%]$/, "")}</label>${unit ? `<div class="field-value">${input}<span class="field-unit">${unit}</span></div>` : input}</div>`;
};
export const selectField = (key, label, value, choices) =>
  `<div class="field full"><label>${label}</label><select data-prop="${key}">${choices.map(([v, n]) => `<option value="${v}" ${String(v) === String(value) ? "selected" : ""}>${n}</option>`).join("")}</select></div>`;
