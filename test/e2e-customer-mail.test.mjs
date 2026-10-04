// TEST / e2e-customer-mail — a reseller changes the wording and logo of customer emails, with a live preview, and it is saved.
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

test('browser: customer email wording and logo, live preview, saved with the account', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const png = path.join(os.tmpdir(), `logo-${Date.now()}.png`); fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Shiny Co'); await page.fill('#em', 's@example.com'); await page.fill('#un', 'shay'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'shay@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForSelector('#cs');
    assert.equal(await page.locator('#creset').isDisabled(), true, 'nothing to reset yet');
    await page.waitForFunction(() => document.querySelector('#cfr')?.src.includes('/preview/'));
    const frame = () => page.frames().find(f => f.url().includes('/receipt-email/preview/'));
    await page.waitForFunction(() => true); assert.match(await frame().locator('body').innerText(), /Shiny Co/, 'the preview shows the business name, not the site name');
    await page.fill('#ct', 'Thank you for shopping'); await page.waitForFunction(() => !document.querySelector('#creset').disabled);
    await page.waitForFunction(() => document.querySelector('#csub').textContent.length > 0);
    await page.waitForTimeout(700); assert.match(await frame().locator('body').innerText(), /Thank you for shopping/, 'the preview follows what is typed');
    await page.setInputFiles('#clfile', png); await page.waitForSelector('img.brand-logo');
    await page.waitForTimeout(700); assert.equal(await frame().locator('img').count(), 1, 'the logo shows in the preview');
    await page.fill('#cb', 'No details'); await page.waitForTimeout(700); assert.match(await page.textContent('#cprob'), /message/, 'a missing {{message}} is explained');
    await page.fill('#cb', 'Thanks!\n\n{{message}}');
    await page.click('#save'); await page.waitForTimeout(1000);
    const saved = await page.evaluate(() => { const m = AccountApp.store.config().mail; return { title: m.wording.receipt?.title, logo: m.logo.slice(0, 22) }; });
    assert.deepEqual(saved, { title: 'Thank you for shopping', logo: 'data:image/png;base64,' });
    // a big logo plus mail server details must still fit in the saved account settings (was: "That record is too large to save")
    await page.evaluate(async () => { const S = AccountApp.store, c = S.config(); c.mail.logo = 'data:image/png;base64,' + 'A'.repeat(95000); c.mail.pass = 'api-key-123'; await S.saveConfig(c); });
    await page.click('#creset'); assert.equal(await page.inputValue('#ct'), 'Your receipt', 'back to the default wording');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); fs.rmSync(png, { force: true }); }
});
