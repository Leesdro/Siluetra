import { test, expect } from "@playwright/test";
import { visualHoodie } from "../../tests/fixtures/visual-hoodie.js";
const state = (page) => page.evaluate(async () => {
  const m = await import("/app.js");
  return m.editorState();
});
const field = (page, selector) => page.locator(selector).locator("input");
async function menu(page, name) {
  const m = page.locator(`sp-action-menu[label="${name}"]`).first();
  await m.click();
  return m;
}
async function createHoodie(page) {
  await page.goto("/");
  await page.locator("#new-document").click();
  await expect(page.locator("#modal")).toHaveAttribute("open", "");
  await shot(page, "new-document");
  await page.locator('[data-new="hoodie"]').click();
  await page.locator("#create-document").click();
  await expect(page.locator("#editor")).toBeVisible();
  await expect(page.locator("#save-state")).toHaveText("Guardado local");
  await expect(page.locator("#properties")).toContainText("Hoodie");
  await expect(page.locator("#zoom")).not.toHaveText("12%");
  await page.mouse.move(80, 80);
}
async function tool(page, id) {
  const direct = page.locator(`#tools>.tool-family>sp-action-button[data-tool="${id}"]`);
  if (await direct.count()) await direct.click();
  else {
    const family = page.locator("#tools .tool-family").filter({ has: page.locator(`sp-menu-item[data-tool="${id}"]`) });
    await family.locator("sp-action-menu").click();
    await family.locator(`sp-menu-item[data-tool="${id}"]`).click();
  }
  await expect.poll(async () => (await state(page)).tool).toBe(id === "edge" ? "node" : id);
}
async function shot(page, name) {
  await page.mouse.move(80, 80);
  await expect(page.locator("#toast")).not.toHaveClass(/show/);
  await page.evaluate(() => document.fonts.ready);
  // Capture once after the UI is ready. Compare bytes softly so a raster diff
  // cannot abort later functional assertions or consume their retry budget.
  const actual = await page.screenshot({ animations: "disabled", caret: "hide", scale: "css", timeout: 30_000 });
  expect.soft(actual, `VISUAL: ${name}`).toMatchSnapshot(name + ".png", { maxDiffPixelRatio: 0.012, threshold: 0.2 });
}
test.beforeEach(async ({ context, page }, info) => {
  await context.route("**/*", (r) => ["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
  await context.addInitScript((theme) => localStorage.setItem("atelier-settings-v3", JSON.stringify({ theme, mirrorDefault: false })), info.project.metadata.theme);
});
test("shell, real menus/layers/Inspector, view and resize @smoke @visual", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await createHoodie(page);
  await shot(page, "default-editor");
  await expect(page.locator("#ux-menus")).toContainText("Archivo");
  await expect(page.locator("#ux-menus")).toContainText("Prenda");
  await menu(page, "Archivo");
  await expect(page.locator('sp-menu-item[data-ux-command="exportDocument"]').last()).toBeVisible();
  await shot(page, "menu-open");
  await page.keyboard.press("Escape");
  const bodyRow = page.locator("#library-content [data-object]").filter({ has: page.locator(".name", { hasText: /^Cuerpo$/ }) });
  await bodyRow.locator(".name").click();
  await expect(page.locator("#properties")).toContainText("Cuerpo");
  await expect.poll(async () => (await state(page)).selected.length).toBeGreaterThan(0);
  await shot(page, "inspector-layers");
  const widthInput = field(page, '#properties sp-number-field[data-prop="w"]');
  const previous = await widthInput.inputValue();
  await widthInput.fill(String(Number(previous) + 10));
  await widthInput.press("Enter");
  await widthInput.press("Tab");
  await expect.poll(async () => (await state(page)).history.past.length).toBeGreaterThan(0);
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  await page.locator('[data-view="back"]').click();
  await expect.poll(async () => (await state(page)).view).toBe("back");
  await page.locator('[data-view="front"]').click();
  const canvas = await page.locator("#canvas").boundingBox();
  const sash = page.locator("#desktop-dockview .dv-sash.dv-enabled").filter({ visible: true }).first();
  await expect(sash).toBeVisible();
  {
    const b = await sash.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 4);
    await page.mouse.down();
    await page.mouse.move(b.x - 35, b.y + b.height / 4, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await page.locator("#canvas").boundingBox()).width).not.toBe(canvas.width);
  }
  await page.locator(".dv-tab").filter({ hasText: /^Recursos$/ }).click();
  await expect(page.locator("#resources-content")).toBeVisible();
  await page.locator('#resources-content details[data-resource-section="pockets"]>summary').click();
  await shot(page, "resources");
  await page.locator('[data-resource="pocket-cargoFlap"]').click();
  await expect.poll(async () => (await state(page)).selected.length).toBeGreaterThan(0);
  await page.locator("#zoom-in").click();
  await page.locator("#zoom-out").click();
  await page.locator("#fit").click();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
test("drawing, nodes, color, panels, history, native save and export @browser", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createHoodie(page);
  await tool(page, "pen");
  let c = await page.locator("#canvas").boundingBox();
  for (const [x, y] of [[c.x + 250, c.y + 250], [c.x + 290, c.y + 210], [c.x + 350, c.y + 270]]) await page.mouse.click(x, y);
  await page.keyboard.press("Enter");
  await tool(page, "select");
  let s = await state(page);
  expect(s.project.views.front.some((o) => o.name.includes("B\xE9zier"))).toBeTruthy();
  const transform = await page.locator('#selection [data-handle="se"]').boundingBox();
  await page.mouse.move(transform.x + transform.width / 2, transform.y + transform.height / 2);
  await page.mouse.down();
  await page.mouse.move(transform.x + 14, transform.y + 8, { steps: 6 });
  await page.mouse.up();
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  await tool(page, "node");
  const node = page.locator("#selection [data-node]").first();
  const b = await node.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 12, b.y + 6, { steps: 6 });
  await page.mouse.up();
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  await tool(page, "select");
  await page.locator("#active-fill").click();
  await expect(page.locator("#color-palette")).toBeVisible();
  await page.locator("sp-slider[data-color-hue]").getByRole("slider").press("ArrowRight");
  await field(page, "sp-textfield[data-color-hex]").fill("#7896b0");
  await field(page, "sp-textfield[data-color-hex]").press("Tab");
  await page.locator('[data-color-target="stroke"]').click();
  await field(page, "sp-textfield[data-color-hex]").fill("#263548");
  await field(page, "sp-textfield[data-color-hex]").press("Tab");
  const colorBox = await page.locator("#color-palette").boundingBox();
  expect(colorBox.y + colorBox.height).toBeLessThan(info.project.use.viewport.height - 20);
  await shot(page, "color-popover");
  await page.locator("[data-color-close]").click();
  await expect(page.locator("#color-palette")).toBeHidden();
  await page.keyboard.press("Escape");
  await menu(page, "Prenda");
  await page.locator('sp-menu-item[data-ux-command="createPanel"]').last().click();
  await expect(page.locator("#modal")).toBeVisible();
  await shot(page, "panel-dialog");
  await page.locator('[data-panel-method="edges"]').click();
  await expect.poll(async () => (await state(page)).panelEdgeState !== null).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await state(page)).panelEdgeState).toBe(null);
  const fixture = visualHoodie();
  await page.locator("#project-input").setInputFiles({ name: "qa-hoodie.garment.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture.p)) });
  await expect(page.locator("#save-state")).toHaveText("Guardado local");
  await page.locator("#library-content .name").filter({ hasText: /^Torso$/ }).click();
  await menu(page, "Prenda");
  await page.locator('sp-menu-item[data-ux-command="selectPanelEdges"]').last().click();
  s = await state(page);
  expect(s.panelEdgeState.phase).toBe("SELECT_EDGES");
  c = await page.locator("#canvas").boundingBox();
  for (const q of [{ x: 573.875, y: 419.75 }, { x: 466.5, y: 419 }]) {
    s = await state(page);
    const x = c.x + s.camera.x + q.x * s.camera.z, y = c.y + s.camera.y + q.y * s.camera.z;
    await page.mouse.move(x, y);
    await expect.poll(async () => (await state(page)).panelEdgeState.selection.hover !== null).toBeTruthy();
    await page.mouse.click(x, y);
  }
  await expect(page.locator("[data-create-edge-panel]")).toBeEnabled();
  await expect(page.locator("[data-create-edge-panel]")).toHaveAttribute("aria-label", "Crear panel");
  await shot(page, "edge-panel-preview");
  await page.locator("[data-create-edge-panel]").click();
  await page.locator("#undo").click();
  await page.locator("#project-input").setInputFiles({ name: "qa-hoodie-area.garment.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture.p)) });
  await menu(page, "Prenda");
  await page.locator('sp-menu-item[data-ux-command="createPanel"]').last().click();
  await page.locator('[data-panel-method="area"]').click();
  s = await state(page);
  expect(s.panelEdgeState.phase).toBe("SELECT_AREA");
  c = await page.locator("#canvas").boundingBox();
  const point = { x: c.x + s.camera.x + fixture.inside.x * s.camera.z, y: c.y + s.camera.y + fixture.inside.y * s.camera.z };
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("[data-create-edge-panel]")).toBeEnabled();
  await expect(page.locator("[data-create-edge-panel]")).toHaveAttribute("aria-label", "Crear panel");
  await page.locator("[data-create-edge-panel]").click();
  await expect.poll(async () => (await state(page)).panelEdgeState).toBe(null);
  await shot(page, "panel-created");
  await page.locator("#undo").click();
  await page.locator("#redo").click();
  await page.locator("#save").click();
  await expect(page.locator("#save-state")).toHaveText("Guardado local");
  await page.locator("#export").click();
  await page.locator('sp-picker[data-prop="exportType"]').click();
  await page.locator('sp-menu-item[value="json"]').last().click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#do-export").click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toContain(".garment.json");
  const exportedFile = `qa/results/${info.project.name}/exported.garment.json`;
  await download.saveAs(exportedFile);
  await page.locator("#home").click();
  await expect(page.locator("#start")).toBeVisible();
  await page.locator("#project-input").setInputFiles(exportedFile);
  await expect(page.locator("#editor")).toBeVisible();
  expect((await state(page)).project.views.front.some((o) => o.semanticType === "region")).toBeTruthy();
  expect(errors).toEqual([]);
});
const layout = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("siluetra-dockview-v2")).dockview);
async function drag(page, from, to) {
  const b = await from.boundingBox();
  await page.mouse.move(b.x + Math.min(25, b.width / 2), b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 30, b.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.move(to.x + 1, to.y, { steps: 2 });
  await page.mouse.up();
}
async function chooseTheme(page, value) {
  const choice = page.locator(`[data-theme-choice="${value}"]`);
  const label = choice.getByText(value === "dark" ? "Oscuro" : "Claro", {exact:true});
  await expect(choice).toBeVisible();
  await expect(label).toBeVisible();
  const buttonBox = await choice.boundingBox(), textBox = await label.boundingBox();
  // The slotted text has pointer-events:none; target its real coordinates on
  // the host button, away from the padded center's coincident resize sash.
  await choice.click({position: {
    x: textBox.x - buttonBox.x + textBox.width * 0.8,
    y: textBox.y - buttonBox.y + textBox.height / 2
  }});
}
async function reset(page) {
  await menu(page, "Ventana");
  await page.locator("sp-menu-item[data-workspace-reset]").last().click();
  await expect(page.locator(".dv-tab")).toHaveCount(5);
}
test("docking, persistence, reset, appearance, tooltip and cursor states @smoke @visual", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createHoodie(page);
  await page.locator('[data-tab-panel-id="appearance"]').click();
  await expect(page.locator("#appearance-content")).toBeVisible();
  await shot(page, "appearance");
  await page.locator('[data-tab-panel-id="inspector"]').click();
  const group = page.locator(".dv-groupview").filter({ has: page.locator('[data-tab-panel-id="inspector"]') });
  await group.locator('sp-action-button[aria-label="Maximizar o restaurar panel"]').click();
  await expect(page.locator("#canvas")).toBeHidden();
  await group.locator('sp-action-button[aria-label="Maximizar o restaurar panel"]').click();
  await expect(page.locator("#canvas")).toBeVisible();
  await page.locator('[data-tab-panel-id="resources"]').click();
  await page.locator('[data-tab-panel-id="resources"] .dv-default-tab-action').click();
  await expect(page.locator('[data-tab-panel-id="resources"]')).toHaveCount(0);
  await menu(page, "Ventana");
  await page.locator('sp-menu-item[data-workspace-show="resources"]').last().click();
  await expect(page.locator("#resources-content")).toBeVisible();
  const canvas = await page.locator("#canvas").boundingBox();
  await drag(page, page.locator('[data-tab-panel-id="resources"]'), { x: canvas.x + canvas.width - 15, y: canvas.y + canvas.height / 2 });
  await expect.poll(async () => Object.keys((await layout(page)).panels).length).toBe(5);
  await expect(page.locator(".dv-groupview")).toHaveCount(4);
  await shot(page, "docked-split");
  const saved = await layout(page);
  await page.reload();
  await expect(page.locator("#new-document")).toBeVisible();
  expect(await layout(page)).toEqual(saved);
  await page.locator("#new-document").click();
  await page.locator('[data-new="hoodie"]').click();
  await page.locator("#create-document").click();
  await expect(page.locator("#canvas")).toBeVisible();
  await page.keyboard.down("Shift");
  await drag(page, page.locator('[data-tab-panel-id="resources"]'), { x: 320, y: 220 });
  await page.keyboard.up("Shift");
  await expect(page.locator(".dv-resize-container")).toBeVisible();
  await shot(page, "floating-panel");
  await reset(page);
  await shot(page, "workspace-reset");
  await page.locator('#library-content .name').filter({hasText:/^Cuerpo$/}).click();
  await page.locator('[data-tab-panel-id="appearance"]').click();
  await page.locator('sp-slider[data-live-prop="opacity"]').getByRole('slider').press('ArrowLeft');
  await expect.poll(async()=>{const s=await state(page);return s.project.views.front.find(o=>o.id===s.selected[0]).opacity;}).toBe(.99);
  await page.locator("#undo").click();
  await page.locator('[data-tab-panel-id="inspector"]').click();
  await page.locator("#history-button").click();
  await expect(page.locator('[data-tab-panel-id="history"]')).toBeVisible();
  await page.locator('[data-tab-panel-id="history"] .dv-default-tab-action').click();
  await expect(page.locator("#history-button")).toHaveAttribute("aria-expanded", "false");
  for (const id of ["select", "node", "edge", "pen", "pencil", "fill", "gradient", "fabric", "text", "measure"]) {
    await tool(page, id);
    const c2 = await page.locator("#canvas").boundingBox();
    await page.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2);
    const cursor = await page.locator("#canvas").evaluate((e) => getComputedStyle(e).cursor);
    if (cursor.startsWith("url(")) {
      const svg = decodeURIComponent(cursor.match(/data:image\/svg\+xml,([^"]+)/)[1]);
      expect(svg).toContain('width="24"');
      expect(svg).toContain('height="24"');
      expect(cursor).toContain("4 20,");
    } else expect(cursor.length).toBeLessThan(40);
    await page.keyboard.press("Escape");
  }
  await tool(page, "select");
  const c = await page.locator("#canvas").boundingBox();
  await page.mouse.move(c.x + 100, c.y + 100);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(c.x + 110, c.y + 110, { steps: 4 });
  await expect(page.locator("#canvas")).toHaveCSS("cursor", "grabbing");
  await page.mouse.up();
  await page.keyboard.up("Space");
  await page.locator("#history-button").hover();
  await expect(page.locator("#history-button sp-tooltip")).toHaveAttribute("open", "");
  expect(await page.locator(".tool-learning-card:visible").count()).toBe(0);
  await page.mouse.move(80, 80);
  await page.locator("#quick-theme").click();
  await chooseTheme(page, info.project.metadata.theme === "dark" ? "light" : "dark");
  await expect(page.locator("#siluetra-theme")).toHaveAttribute("color", info.project.metadata.theme === "dark" ? "light" : "dark");
  await page.locator("#quick-theme").click();
  await chooseTheme(page, info.project.metadata.theme);
  await expect(page.locator("#siluetra-theme")).toHaveAttribute("color", info.project.metadata.theme);
  await menu(page, "Archivo");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.locator('sp-menu-item[data-ux-command="exportDocument"]').last()).toBeHidden();
  expect(errors).toEqual([]);
});
