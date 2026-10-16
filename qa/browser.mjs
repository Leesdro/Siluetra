import { chromium } from "@playwright/test";
import packed from "@sparticuz/chromium";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, chmod } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress } from "node:zlib";
import { execFileSync } from "node:child_process";
import path from "node:path";
const cache = path.resolve("qa/.browser");
async function prepareBrowser() {
  if(process.platform !== 'linux') {
    if(!existsSync(chromium.executablePath())) throw Error('Install native Chromium with the local Playwright CLI');
    return chromium.executablePath();
  }
  await mkdir(cache, { recursive: true });
  const bin = path.resolve("node_modules/@sparticuz/chromium/bin");
  const executable = path.join(cache, "chromium");
  if (!existsSync(executable)) {
    await pipeline(createReadStream(path.join(bin, "chromium.br")), createBrotliDecompress(), createWriteStream(executable));
    await chmod(executable, 448);
  }
  for (const name of ["fonts", "swiftshader", "al2023"]) {
    const mark = path.join(cache, name + ".tar");
    if (!existsSync(mark)) {
      await pipeline(createReadStream(path.join(bin, name + ".tar.br")), createBrotliDecompress(), createWriteStream(mark));
      execFileSync("tar", ["--no-same-owner", "-xf", mark, "-C", cache]);
    }
  }
  return executable;
}
async function launchBrowser() {
  const executable = await prepareBrowser();
  return chromium.launch({ headless: true, executablePath: executable, args: packed.args.filter((x) => !x.includes("disable-web-security") && !x.includes("allow-running-insecure-content") && !x.includes("hide-scrollbars") && !x.includes("single-process")), env: { ...process.env, FONTCONFIG_PATH: path.join(cache, "fonts"), LD_LIBRARY_PATH: [cache, path.join(cache, "lib"), process.env.LD_LIBRARY_PATH || ""].join(":") } });
}
if (process.argv.includes("--install")) console.log(await prepareBrowser());
export {
  cache,
  launchBrowser,
  prepareBrowser
};
