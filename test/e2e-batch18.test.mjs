// TEST / e2e-batch18 — tested-before-sale, Sales status filter, back-dated time, receipt layout, announcement banner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: awaiting-test items, Sales status filter, time sold, receipt layout, announcement banner', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    const host = new Client(srv.base);
    await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
    await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Batch Co'); await page.fill('#em', 'b@example.com'); await page.fill('#un', 'bea'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'bea@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    assert.equal(await page.locator('#ab').count(), 0, 'no banner before the Host posts one');
    await page.evaluate(async () => { const S = AccountApp.store; await S.commit({ puts: [1, 2].map(i => ({ type: 'item', data: { uid: 'Q-' + i, make: 'A', model: 'B', status: 'available', cost: 100, price: 340, addedAt: Date.now() } })) }); const c = S.config(); await S.saveConfig({ ...c, tests: { enabled: true, requireBeforeSale: true } }); });
    // an untested item is "Awaiting test" and cannot be sold
    const st = await page.evaluate(() => { const C = AccountApp.commerce, d = AccountApp.store.all('item')[0].data; return { eff: C.effStatus(d), avail: C.isAvail(d) }; });
    assert.deepEqual(st, { eff: 'testing', avail: false });
    await page.evaluate(() => { location.hash = '#/sell'; }); await page.waitForSelector('#scan');
    await page.fill('#scan', 'Q-1'); await page.press('#scan', 'Enter');
    await page.waitForTimeout(400); assert.equal(await page.locator('.cart-line').count(), 0, 'cannot be added while awaiting test');
    await page.evaluate(async () => { const S = AccountApp.store, C = AccountApp.commerce; const e = S.all('item')[0]; await S.commit({ puts: [{ id: e.id, type: 'item', data: { ...e.data, checks: Object.fromEntries(C.steps().map(s => [s.key, true])) } }] }); });
    await page.fill('#scan', 'Q-1'); await page.press('#scan', 'Enter'); await page.waitForSelector('.cart-line');
    // back-dated sale keeps the time chosen
    await page.fill('#nn', 'Pat Buyer'); await page.fill('#sd', '2026-09-15'); await page.fill('#stm', '14:35'); await page.click('#done'); await page.waitForSelector('.receipt');
    const when = await page.evaluate(() => { const d = new Date(AccountApp.store.all('sale')[0].data.ts); return d.getHours() + ':' + d.getMinutes(); });
    assert.equal(when, '14:35');
    const over = await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth; }); assert.ok(over, 'the receipt sheet never scrolls sideways');
    await page.click('[data-cancel]');
    // Sales status filter
    await page.evaluate(() => { location.hash = '#/sales'; }); await page.waitForSelector('#sst'); await page.waitForSelector('tr.click');
    await page.evaluate(async () => { const S = AccountApp.store, e = S.all('sale')[0]; await S.commit({ puts: [{ id: e.id, type: 'sale', data: { ...e.data, voided: true } }] }); });
    await page.evaluate(() => { location.hash = '#/home'; }); await page.evaluate(() => { location.hash = '#/sales'; }); await page.waitForSelector('#sst'); await page.waitForSelector('tr.click');
    await page.click('#sst'); await page.click('.select-option[data-value=void]'); await page.waitForTimeout(300); assert.equal(await page.locator('tr.click').count(), 1, 'Void shows the voided sale');
    await page.click('#sst'); await page.click('.select-option[data-value=sold]'); await page.waitForTimeout(300);
    assert.equal(await page.locator('tr.click').count(), 0, 'Void sales are hidden by the Sold filter');
    // announcement banner (the page refreshes it every 2 minutes; pull it now)
    const pull = () => page.evaluate(async () => { AccountApp.announcement = (await AccountApp.api('GET', '/announcement')).announcement; AccountApp.route(); });
    await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Maintenance Saturday', level: 'info', until: '' });
    await pull(); await page.waitForSelector('#ab'); assert.match(await page.textContent('#ab'), /Maintenance Saturday/);
    await page.click('#abx'); assert.equal(await page.locator('#ab').count(), 0);
    await pull(); await page.waitForTimeout(400); assert.equal(await page.locator('#ab').count(), 0, 'stays closed');
    await host.req('PUT', '/api/host/settings/announcement', { enabled: true, text: 'Changed message', level: 'important', until: '' });
    await pull(); await page.waitForSelector('#ab'); assert.match(await page.textContent('#ab'), /Changed message/);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
