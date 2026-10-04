// TEST / e2e-discounts — a real browser: add by quantity, select all shown, % off a device and the whole order, receipt, Standard-user cap.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: bulk add, discounts, receipt, Standard-user limit', { skip, timeout: 150000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Reseller Co'); await page.fill('#em', 'r@example.com'); await page.fill('#un', 'rita'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await page.fill('#l', login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');

    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#imp');
    const csv = path.join(os.tmpdir(), `d-${Date.now()}.csv`); fs.writeFileSync(csv, 'uid,model,cost,price\n' + [1, 2, 3, 4, 5, 6].map(i => `D-${i},X5,50,100`).join('\n'));
    await page.setInputFiles('#file', csv); await page.waitForSelector('#go'); await page.click('#go'); await page.waitForSelector('tr.click'); fs.rmSync(csv, { force: true });

    await page.goto(srv.base + '/app/#/sell'); await page.waitForSelector('#bulk'); await page.click('#bulk'); await page.fill('.sheet #n', '9'); await page.click('.sheet #ok');
    assert.equal(await page.locator('.cart-line').count(), 0, 'asking for more than are available adds nothing');
    await page.fill('.sheet #n', '3'); await page.click('.sheet #ok'); await page.waitForSelector('.cart-line'); assert.equal(await page.locator('.cart-line').count(), 3);
    await page.click('#browse'); await page.waitForSelector('.stock-row'); await page.check('#all'); await page.click('.sheet #ok'); assert.equal(await page.locator('.cart-line').count(), 6, 'select all shown adds the rest');
    for (let i = 5; i >= 3; i--) await page.locator('[data-rm]').nth(i).click();
    assert.match(await page.textContent('#tot'), /300\.00/);
    await page.locator('[data-pct]').first().fill('10'); assert.match(await page.textContent('#tot'), /290\.00/);
    await page.fill('#op', '5'); assert.match(await page.textContent('#tot'), /275\.50/); assert.match(await page.textContent('#save'), /24\.50/);
    await page.click('#done'); await page.waitForSelector('.receipt'); const rc = await page.textContent('.receipt');
    assert.match(rc, /10% off/); assert.match(rc, /Order discount 5%/); assert.match(rc, /275\.50/); await page.click('[data-cancel]');
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click'); assert.match(await page.textContent('tr.click'), /275\.50/);
    const bar = await page.locator('#q').boundingBox(), dt = await page.locator('#from').boundingBox(), wr = await page.locator('#war').boundingBox(); assert.ok(Math.abs(bar.y - dt.y) < 8 && Math.abs(dt.y - wr.y) < 8, 'search, dates and warranty share one row');
    await page.click('[data-period=today]'); assert.equal(await page.locator('tr.click').count(), 1); await page.click('#war'); await page.click('.select-option[data-value=expired]'); assert.equal(await page.locator('tr.click').count(), 0); await page.click('#clr'); assert.equal(await page.locator('tr.click').count(), 1);

    // a Standard user is held to the limit (10% by default)
    await page.goto(srv.base + '/app/#/team'); await page.waitForSelector('#add'); await page.click('#add'); await page.fill('#u', 'stan'); await page.click('.sheet #r'); await page.click('.sheet .select-option[data-value=Standard]'); await page.fill('#p', 'Temp-pass-12345'); await page.click('.sheet #go'); await page.waitForTimeout(800);
    const o = await (await br.newContext()).newPage(); await o.goto(srv.base + '/app/'); await o.fill('#l', 'stan@' + login.split('@')[1]); await o.fill('#p', 'Temp-pass-12345'); await o.click('button.block');
    await o.waitForSelector('#a'); await o.fill('#a', 'Temp-pass-12345'); await o.fill('#b', 'Brand-new-pass-678'); await o.click('button.block'); await o.waitForSelector('.side');
    await o.goto(srv.base + '/app/#/sell'); await o.waitForSelector('#scan'); await o.fill('#scan', 'D-4'); await o.press('#scan', 'Enter'); await o.locator('[data-pct]').first().fill('25'); await o.click('#done'); await o.waitForTimeout(600);
    assert.equal(await o.locator('.receipt').count(), 0, 'sale over the limit is refused'); assert.match(await o.textContent('.toasts'), /more than the 10%/);
    await o.locator('[data-pct]').first().fill('10'); await o.click('#done'); await o.waitForSelector('.receipt');
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
