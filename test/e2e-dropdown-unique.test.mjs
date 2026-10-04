// TEST / e2e-dropdown-unique — "must be unique" / "look up" set on a dropdown detail (Condition) is ignored: two devices can share a condition and can be edited.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: a dropdown marked unique does not block adding or editing devices', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Uniq Co'); await page.fill('#em', 'u@example.com'); await page.fill('#un', 'ula'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'ula@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    // simulate an account whose Condition was ticked "Must be unique" and "Look up in sale"
    await page.evaluate(async () => { const S = AccountApp.store, c = S.config(); c.fields = c.fields.map(f => f.key === 'cond' ? { ...f, unique: true, lookup: true } : f); await S.saveConfig(c); });
    const add = async (uid) => { await page.evaluate(() => { location.hash = '#/inventory'; }); await page.waitForSelector('#add'); await page.click('#add'); await page.fill('#f_uid', uid); 
      if (await page.locator('#make_new').isVisible()) { await page.fill('#make_new', 'Acme'); await page.fill('#model_new', 'Box'); }
      else for (const [id, v] of [['make', 'Acme'], ['model', 'Box']]) { await page.click('#' + id); await page.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${v}"]`).click(); }
      await page.click('#go'); await page.waitForSelector('tr.click'); };
    await add('U-1'); await add('U-2');
    assert.equal(await page.locator('tbody tr.click').count(), 2, 'two devices with the same condition');
    await page.locator('tbody tr.click').first().click(); await page.waitForSelector('#f_uid'); await page.fill('#notes', 'edited'); await page.click('.sheet #go');
    await page.waitForFunction(() => !document.querySelector('.scrim'));
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
