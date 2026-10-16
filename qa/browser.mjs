import { chromium } from "@playwright/test";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress } from "node:zlib";
import { execFileSync } from "node:child_process";
import path from "node:path";
const cache = path.resolve("qa/.browser");
async function prepareBrowser() {
  const executable = chromium.executablePath();
  if (!existsSync(executable)) throw Error("Install the pinned browser: npm run qa:install. Canonical visual QA uses qa/Dockerfile.");
  if (process.platform === "linux") {
    await mkdir(cache, { recursive: true });
    if (!existsSync(path.join(cache, "fonts/Open_Sans/OpenSans-Regular.ttf"))) {
      const archive = path.join(cache, "fonts.tar");
      await pipeline(createReadStream("node_modules/@sparticuz/chromium/bin/fonts.tar.br"), createBrotliDecompress(), createWriteStream(archive));
      execFileSync("tar", ["--no-same-owner", "-xf", archive, "-C", cache]);
    }
    // The packaged fonts.conf contains AWS paths. Use only these pinned fonts.
    const xml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    await writeFile(path.join(cache, "siluetra-fonts.conf"), `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig><dir>${xml(path.join(cache, "fonts"))}</dir>
<cachedir>${xml(path.join(cache, "font-cache"))}</cachedir>
<alias><family>sans-serif</family><prefer><family>Open Sans</family></prefer></alias>
</fontconfig>`);
  }
  return executable;
}
function browserLaunchOptions(executablePath) {
  // Use Playwright's supported Chromium launch defaults, not Lambda GPU flags.
  return { executablePath, ...(process.platform === "linux" ? {
    env: { ...process.env, FONTCONFIG_FILE: path.join(cache, "siluetra-fonts.conf"), FONTCONFIG_PATH: cache }
  } : {}) };
}
async function launchBrowser() {
  return chromium.launch({ headless: true, ...browserLaunchOptions(await prepareBrowser()) });
}
if (process.argv.includes("--install")) {
  if (!existsSync(chromium.executablePath())) execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "install", "chromium"], {stdio:"inherit"});
  console.log(await prepareBrowser());
}
export { cache, prepareBrowser, launchBrowser, browserLaunchOptions };
