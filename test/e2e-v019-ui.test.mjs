// TEST / e2e-v019-ui — Firewall rows line up and use plain wording; date and time boxes in forms share one width.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: Firewall rows are aligned and worded plainly', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    await page.goto(srv.base + '/host/#/firewall'); await page.waitForSelector('#hadd');
    await page.fill('#hcidr', '203.0.113.0/24'); await page.click('#hadd'); await page.waitForSelector('[data-rm]');
    await page.click('[data-k=allow]'); await page.fill('#cidr', '198.51.100.7'); await page.click('#add'); await page.waitForFunction(() => document.querySelectorAll('[data-rm]').length >= 2);
    assert.match(await page.textContent('main'), /Site-wide blocking and rate-limit exceptions/);
    assert.match(await page.textContent('main'), /Applies to the whole site, not just the Host Console/);
    assert.equal((await page.locator('#kind button').allTextContents()).join('|'), 'Block this address|Skip rate limits');
    assert.match(await page.textContent('main'), /skips limits/);
    const off = await page.evaluate(() => [...document.querySelectorAll('[data-rm]')].map(b => { const tr = b.closest('tr'), sw = tr.querySelector('.switch').getBoundingClientRect(), bt = b.getBoundingClientRect(), ad = tr.querySelector('.tab-num').getBoundingClientRect(); const c = (r) => r.top + r.height / 2; return Math.max(Math.abs(c(sw) - c(bt)), Math.abs(c(ad) - c(bt))); }));
    assert.ok(off.length >= 2 && off.every(o => o < 3), 'switch, address and Remove are on one line: ' + off);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: date and time boxes in forms are one width', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Width Co'); await page.fill('#em', 'w@example.com'); await page.fill('#un', 'walt'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'walt@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.evaluate(() => { location.hash = '#/inventory'; }); await page.waitForSelector('#add'); await page.click('#add'); await page.waitForSelector('#recv');
    const w = await page.evaluate(() => ['#recv', '#tdate'].map(s => document.querySelector(s) ? Math.round(document.querySelector(s).getBoundingClientRect().width) : -1));
    assert.ok(w[0] > 0 && w[0] === w[1], 'Date received and Tested on are the same width: ' + w);
    assert.match(await page.textContent('.sheet'), /tested on a different day/);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: Documentation opens on the contents menu with the first topic, never a grid of boxes', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    await page.click('.side a[data-k=docs]'); await page.waitForSelector('.doc-toc');
    assert.equal(await page.locator('.main .grid').count(), 0, 'no grid of topic boxes'); assert.equal(await page.locator('#dq').count(), 1, 'search box is on the landing page');
    assert.equal(await page.textContent('.doc h1'), 'Getting started', 'the first topic is already open'); assert.equal(await page.textContent('.doc-toc a.active'), 'Getting started');
    const x = await page.evaluate(() => [document.querySelector('.doc-toc').getBoundingClientRect(), document.querySelector('#dq').getBoundingClientRect()].map(r => Math.round(r.left)));
    assert.ok(x[0] < x[1], 'the contents sit to the left of the search box and article');
    await page.fill('#dq', 'firewall'); await page.waitForSelector('#dres .doc-hit');
    assert.ok((await page.evaluate(() => document.querySelector('.doc-toc').getBoundingClientRect().top)) < 400, 'results do not push the menu down');
    await page.click('.doc-toc a:nth-child(3)'); await page.waitForFunction(() => document.querySelector('.doc-toc a.active')?.textContent !== 'Getting started');
    assert.equal(await page.locator('.main .grid').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
