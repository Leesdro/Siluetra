import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('public cycle validator works without Git and rejects new domain/editor cycles', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'siluetra-cycles-'));
  try {
    for (const dir of ['dist', '.agents/skills']) cpSync(dir, path.join(root, dir), { recursive: true });
    mkdirSync(path.join(root, 'qa'));
    for (const file of ['validate-modules.mjs', 'import-cycles.json']) cpSync(`qa/${file}`, path.join(root, 'qa', file));
    const run = () => spawnSync(process.execPath, ['qa/validate-modules.mjs'], { cwd: root, encoding: 'utf8' });
    assert.equal(run().status, 0, 'fresh copy with no .git');
    for (const dir of ['dist', 'dist/editor']) {
      const a = path.join(root, dir, 'qa-cycle-a.js'), b = path.join(root, dir, 'qa-cycle-b.js');
      writeFileSync(a, ["import", "'./qa-cycle-b.js';"].join(" "));
      writeFileSync(b, ["import", "'./qa-cycle-a.js';"].join(" "));
      assert.notEqual(run().status, 0, `must reject ${dir} cycle`);
      rmSync(a); rmSync(b);
    }
    writeFileSync(path.join(root, 'qa/import-cycles.json'), '[]');
    assert.notEqual(run().status, 0, 'must not silently ignore existing cycles');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
