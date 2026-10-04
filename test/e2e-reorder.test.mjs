// TEST / e2e-reorder — Settings lists (device details, test steps, warranty periods) can be reordered, and the order is saved and used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: reorder details, steps and warranty periods; order is saved', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Order Co'); await page.fill('#em', 'o@example.com'); await page.fill('#un', 'olga'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'olga@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('[data-k=fl]');
    const names = (k) => page.$$eval(`[data-k=${k}]`, els => els.map(e => e.value));
    const f0 = await names('fl'); assert.ok(f0.length >= 3);
    assert.equal(await page.locator('[data-k=mvf][data-d="-1"]').first().isDisabled(), true, 'first row cannot move up');
    await page.locator('[data-k=mvf][data-i="1"][data-d="-1"]').click();
    const f1 = await names('fl'); assert.deepEqual(f1.slice(0, 2), [f0[1], f0[0]], 'second detail moved above the first');
    const s0 = await names('sl'); assert.ok(s0.length >= 2);
    await page.locator(`[data-k=mvs][data-i="0"][data-d="1"]`).click();
    assert.deepEqual((await names('sl')).slice(0, 2), [s0[1], s0[0]]);
    await page.click('#save'); await page.waitForTimeout(800);
    await page.evaluate(() => { location.hash = '#/inventory'; }); await page.waitForSelector('#add'); await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForSelector('[data-k=fl]');
    assert.deepEqual((await names('fl')).slice(0, 2), [f0[1], f0[0]], 'order kept after saving and reloading');
    assert.deepEqual((await names('sl')).slice(0, 2), [s0[1], s0[0]]);
    await page.evaluate(() => { location.hash = '#/inventory'; }); await page.waitForSelector('#add'); await page.click('#add');
    const labels = await page.$$eval('.sheet .field > label', els => els.map(e => e.textContent)); assert.ok(labels.indexOf(f0[1]) < labels.indexOf(f0[0]), 'the Add device form follows the new order');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
