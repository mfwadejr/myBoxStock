// TEST / e2e-sale-date — Quick sale has a Date sold (backdating), receipts follow it, and the customer sheet lists purchases tidily.
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

test('browser: date sold on Quick sale, tidy customer purchases', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Date Co'); await page.fill('#em', 'd@example.com'); await page.fill('#un', 'dee'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'dee@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.evaluate(async () => { const S = AccountApp.store; await S.commit({ puts: [1, 2].map(i => ({ type: 'item', data: { uid: 'T-' + i, make: 'A', model: 'B', status: 'available', cost: 100, price: 340, addedAt: Date.now(), receivedOn: '2026-01-01' } })) }); });
    await page.evaluate(() => { location.hash = '#/sell'; }); await page.waitForSelector('#scan');
    await page.fill('#scan', 'T-1'); await page.press('#scan', 'Enter'); await page.waitForSelector('.cart-line');
    assert.equal(await page.locator('[data-mode=walk]').count(), 0, 'there is no Walk-in');
    assert.equal(await page.locator('[data-mode=new]').count(), 1); await page.fill('#nn', 'Karen Badders'); await page.fill('#np', '301-514-0873');
    const nb = await page.locator('#nn').boundingBox(), pb = await page.locator('#np').boundingBox(), eb = await page.locator('#ne').boundingBox();
    assert.ok(Math.abs(nb.width - pb.width) < 2 && Math.abs(nb.width - eb.width) < 2 && pb.y < eb.y && nb.y < pb.y, 'name, phone and email are the same width, stacked');
    await page.fill('#sd', '2026-09-15'); await page.click('#done'); await page.waitForSelector('.receipt');
    assert.match(await page.textContent('.receipt'), /S-20260915-[A-Z0-9]{5}\b/, 'the receipt number follows the date sold and has 5 random characters');
    const uniq = await page.evaluate(() => { const C = AccountApp.commerce, S = AccountApp.store, real = crypto.getRandomValues.bind(crypto), taken = S.all('sale')[0].data.no.split('-')[2]; let calls = 0; crypto.getRandomValues = (a) => { calls++; if (calls === 1) { const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; a.set([...taken].map(ch => idx.indexOf(ch))); return a; } return real(a); }; const no = C.newReceiptNo(AccountApp.store.all('sale')[0].data.ts); crypto.getRandomValues = real; return { no, first: S.all('sale')[0].data.no, calls, n: S.all('sale').length }; });
    assert.notEqual(uniq.no, uniq.first, 'a number already used is never handed out again'); assert.ok(uniq.calls >= 2, 'it drew again after the clash ' + JSON.stringify(uniq));
    const sale = await page.evaluate(() => { const s = AccountApp.store.all('sale')[0].data; return { day: AccountApp.commerce.dateStr(s.ts), ws: AccountApp.commerce.dateStr(s.warranty.start) }; });
    assert.equal(sale.day, '2026-09-15'); await page.click('[data-cancel]');
    await page.evaluate(() => { location.hash = '#/customers'; }); await page.waitForSelector('tr.click'); await page.click('tr.click'); await page.waitForSelector('.buy-row');
    const box = await page.locator('.buy-row').first().boundingBox(), sheet = await page.locator('.sheet').boundingBox();
    assert.ok(box.height < 120 && box.x + box.width <= sheet.x + sheet.width, 'a purchase fits on a short row inside the sheet');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
