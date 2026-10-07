// TEST / e2e-payment-methods — the reseller edits the Paid by list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: the Paid by list is editable in Settings and used at Quick sale', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Pay Co'); await page.fill('#em', 'p@example.com'); await page.fill('#un', 'pam'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'pam@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForSelector('#addp');
    assert.equal(await page.locator('[data-k=pl]').count(), 4, 'the four standard methods are listed');
    await page.click('#addp'); await page.keyboard.type('Venmo');
    await page.locator('[data-k=pl]').first().fill('Cash on pickup');
    await page.click('[data-k=pa][data-i="3"]');
    await page.click('#save'); await page.waitForSelector('.toast');
    const saved = await page.evaluate(() => AccountApp.store.config().payments);
    assert.deepEqual(saved.methods.map(m => m.label), ['Cash on pickup', 'Card', 'Bank transfer', 'Other', 'Venmo']);
    assert.equal(saved.methods[3].archived, true);
    const opts = await page.evaluate(() => AccountApp.commerce.paymentOptions().map(o => o[1]));
    assert.deepEqual(opts, ['Cash on pickup', 'Card', 'Bank transfer', 'Venmo'], 'Quick sale offers active methods only');
    assert.equal(await page.evaluate(() => AccountApp.commerce.paymentOf({ payment: 'cash' })), 'Cash on pickup');
    assert.equal(await page.evaluate(() => AccountApp.commerce.paymentOf({ payment: 'cash', paymentLabel: 'Cash' })), 'Cash', 'a past sale keeps its name');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
