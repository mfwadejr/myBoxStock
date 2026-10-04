// TEST / e2e-signup-link — the marketing site's Sign up link opens the Create account tab; Log in opens Sign in.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;

test('browser: /app/#/signup opens Create account; /app/ opens Sign in', { skip, timeout: 60000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage();
  try {
    await page.goto(srv.base + '/app/#/signup'); await page.waitForSelector('[data-mode].on');
    assert.equal((await page.textContent('[data-mode].on')).trim(), 'Create account'); assert.ok(await page.isVisible('#bn'), 'the sign-up form is showing');
    await page.goto(srv.base + '/app/'); await page.evaluate(() => { location.hash = ''; location.reload(); }); await page.waitForSelector('[data-mode].on');
    assert.equal((await page.textContent('[data-mode].on')).trim(), 'Sign in');
  } finally { await br.close(); srv.stop(); }
});
