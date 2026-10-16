import { defineConfig } from "@playwright/test";
import packed from "@sparticuz/chromium";
import { prepareBrowser, cache } from "./qa/browser.mjs";
import path from "node:path";
const executablePath = await prepareBrowser();
var stdin_default = defineConfig({ testDir: "./qa/tests", workers: 2, fullyParallel: false, timeout: 6e4, expect: { timeout: 8e3, toHaveScreenshot: { maxDiffPixelRatio: 0.012, threshold: 0.2, animations: "disabled" } }, outputDir: "qa/results/playwright", reporter: [["list"], ["json", { outputFile: "qa/results/browser-report.json" }], ["html", { outputFolder: "qa/results/html", open: "never" }]], snapshotPathTemplate: "{testDir}/../baselines/{projectName}/{arg}{ext}", use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium", deviceScaleFactor: 1, trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions: { executablePath, args: packed.args.filter((x) => !["disable-web-security", "allow-running-insecure-content", "single-process", "hide-scrollbars"].some((v) => x.includes(v))), env: { ...process.env, FONTCONFIG_PATH: path.join(cache, "fonts"), LD_LIBRARY_PATH: [cache, path.join(cache, "lib"), process.env.LD_LIBRARY_PATH || ""].join(":") } } }, projects: [[1366, 768], [1440, 900], [1920, 1080], [1024, 768]].flatMap(([width, height]) => ["dark", "light"].map((theme) => ({ name: `${width}-${height}-${theme}`, use: { viewport: { width, height }, colorScheme: theme }, metadata: { theme } }))), webServer: { command: "node qa/server.mjs", url: "http://127.0.0.1:4173", reuseExistingServer: false, timeout: 15e3 } });
export {
  stdin_default as default
};
