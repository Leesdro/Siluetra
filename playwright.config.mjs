import { defineConfig } from "@playwright/test";
import { prepareBrowser, browserLaunchOptions } from "./qa/browser.mjs";
const executablePath = await prepareBrowser();
export default defineConfig({
  testDir: "./qa/tests", workers: 2, fullyParallel: false, timeout: 120_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.012, threshold: 0.2, animations: "disabled" } },
  outputDir: "qa/results/playwright",
  reporter: [["list"], ["json", { outputFile: "qa/results/browser-report.json" }]],
  snapshotPathTemplate: "{testDir}/../baselines/{projectName}/{arg}{ext}",
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium", deviceScaleFactor: 1,
    locale: "en-US", timezoneId: "UTC", trace: "retain-on-failure", screenshot: "only-on-failure",
    launchOptions: browserLaunchOptions(executablePath) },
  projects: [[1366,768],[1440,900],[1920,1080],[1024,768]].flatMap(([width,height]) =>
    ["dark","light"].map(theme => ({ name: `${width}-${height}-${theme}`,
      use: { viewport: {width,height}, colorScheme: theme }, metadata: {theme} }))),
  webServer: { command: "node qa/server.mjs", url: "http://127.0.0.1:4173", reuseExistingServer: false, timeout: 15_000 }
});
