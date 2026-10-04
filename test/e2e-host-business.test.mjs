// TEST / e2e-host-business — a real browser: Pipeline and Plans pages, account health in the list, support actions asking for a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: pipeline, plans, health and reasons in the Host Console', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    for (const [n, e, u] of [['Alpha Shop', 'a@example.com', 'alpha'], ['Beta Shop', 'b@example.com', 'bruno']]) await new Client(srv.base).req('POST', '/api/app/signup', { businessName: n, email: e, username: u, password: PW });
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    const shot = (n) => page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/${n}.png` : `/tmp/${n}.png` });

    await page.goto(srv.base + '/host/#/pipeline'); await page.waitForSelector('.stat-value');
    assert.match(await page.textContent('main'), /Sign-ups this week/); assert.match(await page.textContent('main'), /Alpha Shop/); await page.waitForTimeout(500); await shot('pipeline');

    await page.goto(srv.base + '/host/#/plans'); await page.waitForSelector('#add'); await page.click('#add');
    await page.fill('[data-k=name]', 'Starter'); await page.fill('[data-k=price]', '19'); await page.fill('[data-k=maxUsers]', '3'); await page.click('#save');
    await page.waitForFunction(() => /Plans saved/.test(document.body.textContent)); await page.waitForTimeout(500); await shot('plans');
    assert.equal(await page.inputValue('[data-k=price]'), '19.00');

    await page.goto(srv.base + '/host/#/accounts'); await page.waitForSelector('tr.click');
    assert.match(await page.textContent('#tbl'), /Not encrypted|2FA off/); await shot('accounts');
    await page.click('tr.click'); await page.waitForSelector('#sus'); await page.waitForTimeout(400); await shot('account-sheet');
    await page.click('#sus'); await page.waitForSelector('#rs');
    await page.fill('#rs', 'x'); await page.click('.scrim:last-child #go'); assert.equal(await page.locator('#rs').count(), 1, 'a one-letter reason does not pass');
    await page.fill('#rs', 'testing the reason box'); await page.click('.scrim:last-child #go');
    await page.waitForFunction(() => !document.querySelector('#rs')); await page.waitForTimeout(1200);
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
