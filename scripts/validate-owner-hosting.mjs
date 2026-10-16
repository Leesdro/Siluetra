import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const m=JSON.parse(readFileSync('.openai/hosting.json'));
assert.equal(m.static.directory,'dist');
assert.ok(process.env.SILUETRA_HOSTING_PROJECT_ID,'Set SILUETRA_HOSTING_PROJECT_ID');
assert.equal(m.project_id,process.env.SILUETRA_HOSTING_PROJECT_ID);
