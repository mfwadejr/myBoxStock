// TEST / t46-running-low — a real browser: Home's "Running low" card, one row per model, most urgent first, Out of stock apart from Low,
// opens Inventory on that model, hides at zero, shows the first few with Show all, can be hidden per person, replaces the old banner, works on a phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

const signUp = async (page, srv) => {
  await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
  await page.fill('#bn', 'Low Co'); await page.fill('#em', 'low@example.com'); await page.fill('#un', 'lola'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const login = 'lola@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
};
// models: [name, make, available, reorder level, also sold]
const stock = (page, models) => page.evaluate(async (models) => {
  const S = AccountApp.store, puts = [];
  for (const [name, make, n, reorder, sold = 0] of models) {
    puts.push({ type: 'model', data: { name, reorder } });
    for (let i = 0; i < n + sold; i++) puts.push({ type: 'item', data: { uid: `${name}-${i}`, serial: '', mac: '', make, model: name, cost: 1000, price: 2000, status: i < n ? 'available' : 'sold', addedAt: Date.now() } });
  }
  await S.commit({ puts });
}, models);
const home = async (page) => { await page.evaluate(() => { location.hash = '#/home'; AccountApp.route(); }); await page.waitForSelector('.stat-grid'); await page.waitForTimeout(150); };
const names = (page) => page.$$eval('.low-row .strong', els => els.map(e => e.textContent));

test('browser: Home Running low card', { skip, timeout: 200000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await signUp(page, srv);
    // nothing low: no card, no old banner
    await stock(page, [['Plenty', 'Acme', 6, 3]]); await home(page);
    assert.equal(await page.locator('#lowbox').count(), 0, 'hidden when nothing is low'); assert.equal(await page.locator('.low-row').count(), 0); assert.ok(!/Low stock/.test(await page.textContent('.main')), 'the old banner is gone');

    // seven models: out of stock first, then the lowest share of the reorder level; reorder level 0 never shows; sold devices do not count
    await stock(page, [['Alpha', 'Acme', 3, 3], ['Bravo', 'Roku', 1, 5], ['Charlie', '', 2, 4], ['Delta', 'Acme', 0, 2, 4], ['Echo', 'Acme', 4, 5], ['Foxtrot', 'Acme', 0, 1, 2], ['Golf', 'Acme', 1, 0]]);
    await home(page);
    const all5 = await names(page); assert.equal(all5.length, 5, 'the first five rows');
    assert.deepEqual(all5.slice(0, 2).sort(), ['Acme Delta', 'Acme Foxtrot'], 'out of stock models come first'); assert.deepEqual(all5.slice(2), ['Roku Bravo', 'Charlie', 'Acme Echo'], 'then by how little is left compared with the reorder level');
    assert.equal(await page.locator('.low-row .chip.red').count(), 2); assert.equal((await page.locator('.low-row .chip.red').first().textContent()).trim(), 'Out of stock'); assert.equal(await page.locator('.low-row .chip.amber').count(), 3); assert.equal((await page.locator('.low-row .chip.amber').first().textContent()).trim(), 'Low');
    assert.match(await page.textContent('.low-row:nth-child(3)'), /1 left · reorder at 5/);
    assert.equal(await page.locator('.low-row .meter i.bad').count(), 2); assert.equal(await page.locator('.low-row .meter i.warn').count(), 3);
    assert.equal(await page.locator('.low-row .meter i').nth(2).evaluate(e => e.style.getPropertyValue('--pct')), '20', 'the bar shows 1 of 5');
    assert.equal(await page.locator('#lowall').textContent(), 'Show all (6)', 'Alpha is at its level (3 of 3); Plenty and Golf are not low');
    await page.click('#lowall'); assert.equal((await names(page)).length, 6); assert.equal((await names(page))[5], 'Acme Alpha'); assert.equal(await page.textContent('#lowall'), 'Show fewer'); await page.click('#lowall'); assert.equal((await names(page)).length, 5);
    assert.equal(await page.locator('.banner:has-text("Low stock")').count(), 0);

    // a row opens Inventory on that model only
    await page.click('.low-row:has-text("Roku Bravo")'); await page.waitForSelector('#md'); await page.waitForSelector('tr.click');
    assert.match(page.url(), /#\/inventory/); assert.equal(await page.locator('#md .select-label').textContent(), 'Bravo'); assert.equal(await page.locator('tr.click').count(), 1);
    assert.match(await page.textContent('tr.click'), /Bravo-0/);

    // hide for this person only, and bring it back
    await home(page); await page.click('#lowhide'); assert.equal(await page.locator('#lowbox').count(), 0); assert.match(await page.textContent('#lowcard'), /Running low card is hidden/);
    assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('mbs.lowcard.'))), 'the choice is kept in this browser, per person');
    await home(page); assert.equal(await page.locator('#lowbox').count(), 0, 'still hidden when Home is opened again'); await page.click('#lowshow'); assert.equal(await page.locator('#lowbox').count(), 1);

    // stocking up removes a model; with nothing low the card disappears
    await page.evaluate(async () => { const S = AccountApp.store; await S.commit({ puts: S.all('model').map(m => ({ type: 'model', id: m.id, data: { ...m.data, reorder: 0 } })) }); });
    await home(page); assert.equal(await page.locator('#lowcard').textContent(), '', 'nothing low: no card, and no "hidden" line either');

    // phone width
    await page.evaluate(async () => { const S = AccountApp.store; await S.commit({ puts: S.all('model').filter(m => ['Delta', 'Bravo'].includes(m.data.name)).map(m => ({ type: 'model', id: m.id, data: { ...m.data, reorder: 5 } })) }); });
    await page.setViewportSize({ width: 375, height: 800 }); await home(page);
    assert.equal(await page.locator('.low-row').count(), 2); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'no sideways scroll at 375px');
    const box = await page.locator('.low-row').first().boundingBox(); assert.ok(box.height >= 44 && box.width <= 375, 'a row is easy to tap');
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
