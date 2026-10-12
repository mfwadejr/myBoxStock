// TEST / t58-plan-limits-ui — a real browser: the Limits list on the Plans page, a plan's own numbers, the account sheet's plan block, and the Get set up card.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const pickPlan = async (page) => { await page.click('#pr'); await page.locator('#pr').locator('xpath=..').locator('.select-option', { hasText: 'Starter' }).click(); };

test('browser: add a limit, set a plan number, give an account the plan', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Alpha Shop', email: 'a@example.com', username: 'alpha', password: PW });
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    assert.match(await page.textContent('#setup'), /Get set up/, 'a new site shows the checklist');

    await page.goto(srv.base + '/host/#/plans'); await page.waitForSelector('#addlim');
    assert.equal(await page.locator('.limit-row').count(), 3);
    await page.click('#addlim'); await page.fill('#ln3', 'Models'); await page.click('[data-lup="3"]');
    assert.equal(await page.inputValue('#ln2'), 'Models', 'moved up one place');
    await page.click('#add'); await page.fill('#pn0', 'Starter'); await page.fill('#pp0', '19'); await page.fill('[data-pl="lim-devices"]', '300');
    await page.click('#save'); await page.waitForFunction(() => /Plans and limits saved/.test(document.body.textContent));
    assert.equal(await page.inputValue('[data-pl="lim-devices"]'), '300');

    await page.goto(srv.base + '/host/#/accounts'); await page.waitForSelector('tr.click'); await page.click('tr.click'); await page.waitForSelector('#lim');
    await page.click('#lim'); await page.waitForSelector('#pr');
    await pickPlan(page);
    await page.fill('.sheet #rs', 'testing the sheet'); await page.click('.sheet #go');
    await page.waitForFunction(() => /Saved/.test(document.body.textContent));
    await page.waitForSelector('#lim');   // saving returns to the account sheet
    const txt = await page.locator('.sheet').last().textContent(); assert.match(txt, /Starter/); assert.match(txt, /0 of 300/);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
