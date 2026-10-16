import { build } from "esbuild";
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
mkdirSync("dist/vendor", { recursive: true });
const result = await build({
  entryPoints: ["ui/dependencies.js"],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "linked",
  outfile: "dist/vendor/desktop-ui.js",
  metafile: true,
});
copyFileSync(
  "node_modules/dockview/dist/styles/dockview.css",
  "dist/vendor/dockview.css",
);
copyFileSync(
  "node_modules/@spectrum-css/tokens/dist/css/index.css",
  "dist/vendor/spectrum-tokens.css",
);
const packages = new Map();
for (const file of Object.keys(result.metafile.inputs)) {
  const match = file.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  if (!match) continue;
  const name = match[1],
    p = JSON.parse(readFileSync("node_modules/" + name + "/package.json"));
  packages.set(name, { name, version: p.version, license: p.license });
}
for (const name of ["@spectrum-css/tokens", "dockview"]) {
  const p = JSON.parse(readFileSync("node_modules/" + name + "/package.json"));
  packages.set(name, { name, version: p.version, license: p.license });
}
let notices = "Siluetra Desktop UI — redistributed runtime dependencies\n\n";
for (const p of packages.values()) {
  const root = "node_modules/" + p.name;
  const license = [
    "LICENSE",
    "LICENSE.txt",
    "LICENSE.md",
    "LICENCE.md",
    "license",
    "license.txt",
  ].find((f) => existsSync(root + "/" + f));
  if (
    !license &&
    !p.name.startsWith("@spectrum-web-components/") &&
    !p.name.startsWith("@spectrum-css/")
  )
    throw Error("Missing license: " + p.name);
  notices +=
    p.name +
    " " +
    p.version +
    " (" +
    p.license +
    ")\n" +
    readFileSync(
      license ? root + "/" + license : "dist/vendor/SPECTRUM-LICENSE.txt",
      "utf8",
    ) +
    "\n\n";
}
writeFileSync("dist/vendor/DESKTOP-UI-LICENSES.txt", notices);
const data = readFileSync("dist/vendor/desktop-ui.js");
writeFileSync(
  "dist/vendor/DESKTOP-UI-PROVENANCE.json",
  JSON.stringify(
    {
      builder: "esbuild 0.28.2",
      packages: [...packages.values()],
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Built local Spectrum + Dockview ESM:",
  data.length,
  "bytes;",
  packages.size,
  "runtime packages.",
);
