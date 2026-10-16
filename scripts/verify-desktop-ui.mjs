import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const p = JSON.parse(readFileSync("dist/vendor/DESKTOP-UI-PROVENANCE.json")),
  bundle = readFileSync("dist/vendor/desktop-ui.js");
assert.equal(createHash("sha256").update(bundle).digest("hex"), p.sha256);
assert.equal(p.packages.find((x) => x.name === "dockview").version, "8.5.1");
assert.equal(
  p.packages.find((x) => x.name === "@spectrum-css/tokens").version,
  "16.0.2",
);
for (const x of p.packages.filter((x) =>
  x.name.startsWith("@spectrum-web-components/"),
))
  assert.equal(x.version, "1.12.4");
const text = bundle.toString();
assert.ok(!/(?:from|import\()\s*['"](?:@spectrum|dockview)/.test(text));
const source = readFileSync("ui/dependencies.js", "utf8");
for (const component of [
  "sp-button",
  "sp-action-button",
  "sp-action-menu",
  "sp-menu",
  "sp-menu-item",
  "sp-popover",
  "sp-tooltip",
  "sp-textfield",
  "sp-number-field",
  "sp-slider",
  "sp-checkbox",
  "sp-switch",
  "sp-picker",
  "sp-dialog",
  "sp-tabs",
  "sp-tab",
  "sp-action-group",
])
  assert.ok(source.includes(component + ".js"), component);
for (const f of [
  "DESKTOP-UI-LICENSES.txt",
  "SPECTRUM-LICENSE.txt",
  "SPECTRUM-NOTICE.txt",
  "GRAPHITE-UI-LICENSE.txt",
  "GRAPHITE-UI-NOTICE.txt",
  "desktop-ui.js.LEGAL.txt",
])
  assert.ok(existsSync("dist/vendor/" + f));
const html = readFileSync("dist/index.html", "utf8");
assert.ok(html.includes("desktop-entry.js"));
assert.ok(html.includes("sp-theme"));
assert.ok(html.includes("vendor/dockview.css"));
console.log(
  "PASS: Spectrum/Dockview local ESM, exact dependency versions/hash, Graphite attribution, production licenses, entry and theme assets.",
);
