// TEST / t49-measure-script — a light check that tools/measure-speed.mjs builds Demo3 into a temp folder, starts the server, and returns a result for one measurement (the laptop sign-in).
// It does not time anything against a limit and never changes the app; the real measurements are run by hand (see docs/speed-measurements-v0.25.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : (process.env.DB_CLIENT || 'sqlite') !== 'sqlite' ? 'SQLite-only' : false;

test('measure-speed builds Demo3 and returns a sign-in measurement on the laptop profile', { skip, timeout: 240000 }, async () => {
  const { run } = await import('../tools/measure-speed.mjs');
  const out = await run({ set: 'demo3', profiles: ['laptop'], steps: ['signin'], log: () => {} });
  assert.equal(out.set, 'demo3'); assert.equal(out.built.accounts, 3); assert.ok(out.account.devices > 0 && out.account.customers > 0 && out.account.sales > 0);
  assert.ok(!('password' in out.account), 'the demo password is never put in the result');
  const r = out.results.laptop; assert.ok(r.signin.toUsableHomeMs > 0); assert.ok(r.signin.recordsDownload.bytes > 0);
  assert.equal(r.loaded.devices, out.account.devices, 'every device was downloaded and decrypted'); assert.equal(r.loaded.unreadable, 0); assert.ok(r.heap.usedMB > 0);
});
