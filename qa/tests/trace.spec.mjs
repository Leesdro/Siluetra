import { test, expect } from '@playwright/test';
const snapshot = page => page.evaluate(async () => {
  const s = (await import('/app.js')).editorState();
  return { project: s.project, past: s.history.past.length };
});
test('Vectorizar actual worker, cancel, commit and undo @smoke', async ({page, context}) => {
  await context.route('**/*', r => ['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
  const failures = [];
  page.on('response', r => { if(r.status() >= 400) failures.push(r.url()); });
  await page.goto('/');
  await page.locator('#new-document').click();
  await page.locator('[data-new="blank"]').click();
  await page.locator('#create-document').click();
  await page.locator('#image-input').setInputFiles('tests/fixtures/trace-square.png');
  await expect(page.locator('#properties')).toContainText('Vectorizar');
  const before = await snapshot(page);
  async function dialog() {
    await page.keyboard.press('Control+k');
    await page.locator('#command-query').locator('input').fill('Vectorizar');
    await page.locator('[data-command="traceImage"]').click();
    await expect(page.locator('#trace-apply')).toBeVisible();
  }
  await dialog();
  await page.locator('#modal [data-close]').filter({visible:true}).last().click();
  expect(await snapshot(page)).toEqual(before);
  await dialog();
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/trace-worker.js');
  await page.locator('#trace-apply').click();
  expect((await response).status()).toBe(200);
  await expect(page.locator('#modal')).not.toHaveAttribute('open');
  const after = await snapshot(page);
  expect(after.project.views.front.length).toBeGreaterThan(before.project.views.front.length);
  expect(after.past).toBe(before.past + 1);
  await page.locator('#undo').click();
  const undone = await snapshot(page);
  expect(undone.project.views).toEqual(before.project.views);
  await page.locator('#redo').click();
  expect((await snapshot(page)).project.views).toEqual(after.project.views);
  expect(failures).toEqual([]);
});

