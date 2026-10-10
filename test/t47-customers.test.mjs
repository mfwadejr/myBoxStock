// TEST / t47-customers — Customers: search finds every field (name, phone, email, notes, address, receipt number, tracking, credit note), clear button and "/" shortcut, sorting by header and by the phone list,
// quick filter chips, the one-place history (sales, shipments, returns and refunds) without any internal cost, and the phone and laptop layouts.
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
  await page.fill('#bn', 'Find Co'); await page.fill('#em', 'find@example.com'); await page.fill('#un', 'fiona'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const login = 'fiona@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
};
const DAY = 864e5;
// Four customers. Alice: shipped sale 5 days ago with tracking, part returned. Bob: pickup 60 days ago. Cara: never bought. Dan: immediate sale 3 days ago.
const seed = (page) => page.evaluate(async (DAY) => {
  const A = AccountApp, S = A.store, now = Date.now(), nid = () => Vault.newId();
  const addr = (city) => ({ street: '1 Main St', unit: '', city, state: 'TX', zip: '78701', country: '' });
  const cust = (name, phone, email, notes, address, age) => ({ type: 'customer', data: { name, phone, email, notes, createdAt: now - age * DAY, ...(address ? { address } : {}) } });
  const ids = await S.commit({ puts: [cust('Alice Adams', '555-0101', 'alice@example.com', 'church group', addr('Austin'), 100), cust('Bob Brown', '555-0202', 'bob@example.org', '', null, 50), cust('Cara Clark', '555-0303', 'cara@example.net', '', addr('Dallas'), 1), cust('Dan Dee', '555-0404', 'dan@example.io', '', null, 200)] });
  const [alice, bob, cara, dan] = ids;
  const item = (n, price = 10000) => ({ id: nid(), uid: 'U-' + n, make: 'Acme', model: 'X5', fields: [], inspection: null, listPrice: price, pct: 0, price, cost: 5000 });
  const sale = (no, cid, name, ageDays, items, extra = {}) => { const total = items.reduce((t, i) => t + i.price, 0); return { no, ts: now - ageDays * DAY, customerId: cid, customerName: name, customerEmail: '', items, subtotal: total, orderPct: 0, orderOff: 0, total, cost: items.length * 5000, payment: 'cash', paymentLabel: 'Cash', warranty: null, notes: '', ...extra }; };
  const ai = [item('A1'), item('A2')], bi = [item('B1', 5000)], di = [item('D1', 30000)];
  const ret = { id: nid(), no: 'R-20261001-AB123', ts: now - 2 * DAY, by: 'fiona', role: 'Administrator', reasonKey: '', reasonLabel: '', note: '', lines: [{ id: ai[0].id, label: 'Acme X5', price: 10000, refund: 10000, restock: 'available' }], fee: 0, shipRefund: 0, net: 10000, method: 'cash', methodLabel: 'Cash', retTracking: 'RET-9', retShipCost: 0, retShipPaidBy: '' };
  const delivery = { type: 'shipping', shipTo: { name: 'Alice Adams', ...addr('Austin') }, fee: 1000, cost: 4242, carrier: 'UPS', tracking: 'TRK-ALICE-123', note: '', status: 'toship', shippedAt: 0 };
  await S.commit({ puts: [
    { type: 'sale', data: sale('S-20261001-AAAA', alice, 'Alice Adams', 5, ai, { delivery, returns: [ret] }) },
    { type: 'sale', data: sale('S-20260801-BBBB', bob, 'Bob Brown', 60, bi, { delivery: { type: 'pickup', date: '', notes: 'at the cafe' } }) },
    { type: 'sale', data: sale('S-20261006-DDDD', dan, 'Dan Dee', 3, di) },
  ] });
  return { alice, bob, cara, dan };
}, DAY);
const goCustomers = async (page) => { await page.evaluate(() => { document.querySelectorAll('.scrim [data-cancel]').forEach(b => b.click()); location.hash = '#/customers'; AccountApp.route(); }); await page.waitForSelector('#q'); await page.waitForSelector('tbody tr, .empty'); };
const names = (page) => page.$$eval('tbody tr.click', trs => trs.map(t => t.querySelector('td').textContent.trim()));
const settle = (page) => page.waitForTimeout(500);
const search = async (page, text) => { await page.fill('#q', text); await settle(page); return names(page); };
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test('browser: Customers search, sort, chips and history', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await signUp(page, srv); await seed(page); await goCustomers(page);
    assert.deepEqual(await names(page), ['Alice Adams', 'Bob Brown', 'Cara Clark', 'Dan Dee'], 'starts sorted by name');
    assert.match(await page.textContent('#ccount'), /^4 customers$/); assert.equal(await page.locator('#qclear').count(), 0, 'no clear button while the box is empty');

    // ---- search finds each field ----
    assert.deepEqual(await search(page, 'alice'), ['Alice Adams'], 'name');
    assert.match(await page.textContent('#ccount'), /^1 result$/);
    assert.deepEqual(await search(page, '0202'), ['Bob Brown'], 'phone');
    assert.deepEqual(await search(page, 'example.net'), ['Cara Clark'], 'email');
    assert.deepEqual(await search(page, 'CHURCH'), ['Alice Adams'], 'notes, any capitals');
    assert.deepEqual(await search(page, 'dallas'), ['Cara Clark'], 'saved address');
    assert.deepEqual(await search(page, 'main st'), ['Alice Adams', 'Cara Clark'], 'street, two customers');
    assert.deepEqual(await search(page, 'S-20261006-DDDD'), ['Dan Dee'], 'receipt number');
    assert.deepEqual(await search(page, 's-20260801'), ['Bob Brown'], 'part of a receipt number');
    assert.deepEqual(await search(page, 'trk-alice-123'), ['Alice Adams'], 'tracking number');
    assert.deepEqual(await search(page, 'ups'), ['Alice Adams'], 'carrier');
    assert.deepEqual(await search(page, 'R-20261001-AB123'), ['Alice Adams'], 'credit note number');
    assert.deepEqual(await search(page, 'RET-9'), ['Alice Adams'], 'return tracking number');
    assert.deepEqual(await search(page, '42.42'), [], 'the reseller\'s own shipping cost is never searched'); assert.deepEqual(await search(page, '4242'), []);
    assert.match(await page.textContent('.empty'), /No customers match/); assert.match(await page.textContent('#ccount'), /^0 results$/);

    // ---- clear button, Escape and the "/" shortcut ----
    assert.equal(await page.locator('#qclear').count(), 1); await page.click('#qclear'); await settle(page);
    assert.equal(await page.inputValue('#q'), ''); assert.equal((await names(page)).length, 4); assert.equal(await page.evaluate(() => document.activeElement.id), 'q', 'focus returns to the search box');
    await search(page, 'bob'); await page.press('#q', 'Escape'); await settle(page); assert.equal(await page.inputValue('#q'), ''); assert.equal((await names(page)).length, 4);
    await page.click('h1'); assert.notEqual(await page.evaluate(() => document.activeElement.id), 'q'); await page.keyboard.press('/'); assert.equal(await page.evaluate(() => document.activeElement.id), 'q', '"/" focuses the search');
    await page.keyboard.type('x/y'); assert.equal(await page.inputValue('#q'), 'x/y', 'typing a slash in the box types a slash'); await page.click('#qclear'); await settle(page);

    // ---- sorting by the column titles (laptop) ----
    assert.equal(await page.locator('.th-sort').first().isVisible(), true); assert.equal(await page.locator('.select.sort-pick').isVisible(), false, 'the phone list is hidden on a laptop');
    const sortBy = async (k) => { await page.click(`.th-sort[data-sort="${k}"]`); await settle(page); return names(page); };
    assert.deepEqual(await sortBy('name'), ['Dan Dee', 'Cara Clark', 'Bob Brown', 'Alice Adams'], 'Name again reverses');
    assert.equal(await page.getAttribute('th:has([data-sort="name"])', 'aria-sort'), 'descending');
    assert.deepEqual(await sortBy('name'), ['Alice Adams', 'Bob Brown', 'Cara Clark', 'Dan Dee']);
    assert.deepEqual(await sortBy('spent'), ['Dan Dee', 'Alice Adams', 'Bob Brown', 'Cara Clark'], 'total spent, high to low (after refunds, shipping included)');
    assert.match(await page.textContent('tbody tr.click:nth-child(2)'), /\$110\.00/, 'Alice: 210.00 paid less 100.00 refunded');
    assert.deepEqual(await sortBy('spent'), ['Cara Clark', 'Bob Brown', 'Alice Adams', 'Dan Dee']);
    assert.deepEqual(await sortBy('last'), ['Dan Dee', 'Alice Adams', 'Bob Brown', 'Cara Clark'], 'last purchase, newest first');
    assert.deepEqual(await sortBy('last'), ['Bob Brown', 'Alice Adams', 'Dan Dee', 'Cara Clark'], 'oldest first; people who never bought stay at the end');
    assert.deepEqual(await sortBy('count'), ['Alice Adams', 'Bob Brown', 'Dan Dee', 'Cara Clark'], 'number of purchases, most first; ties by name');
    assert.deepEqual(await sortBy('count'), ['Cara Clark', 'Alice Adams', 'Bob Brown', 'Dan Dee']);
    assert.deepEqual(await sortBy('added'), ['Cara Clark', 'Bob Brown', 'Alice Adams', 'Dan Dee'], 'recently added first');
    assert.deepEqual(await sortBy('added'), ['Dan Dee', 'Alice Adams', 'Bob Brown', 'Cara Clark']);
    await sortBy('added'); // back to newest first, then leave the page and return: the choice is remembered while the app is open
    await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForSelector('.stat-grid'); await goCustomers(page);
    assert.deepEqual(await names(page), ['Cara Clark', 'Bob Brown', 'Alice Adams', 'Dan Dee'], 'sort remembered');

    // ---- the same sort through the list (what a phone uses) ----
    await page.evaluate(() => { const b = document.querySelector('#csort'); b.scrollIntoView(); });
    assert.equal(await page.evaluate(() => AccountApp.views.customers ? 1 : 0), 1);

    // ---- quick filter chips ----
    await page.click('#cclr').catch(() => {}); await page.click('[data-sort="name"]'); await settle(page);
    const chip = async (k) => { await page.click(`[data-chip="${k}"]`); await settle(page); return names(page); };
    assert.deepEqual(await chip('addr'), ['Alice Adams', 'Cara Clark'], 'Has an address'); assert.equal(await page.getAttribute('[data-chip="addr"]', 'aria-pressed'), 'true');
    assert.match(await page.textContent('#ccount'), /^2 results$/);
    assert.deepEqual(await chip('recent'), ['Alice Adams'], 'address and bought in the last 30 days');
    assert.deepEqual(await chip('none'), ['Cara Clark'], 'No purchases yet replaces the 30 day chip'); assert.equal(await page.getAttribute('[data-chip="recent"]', 'aria-pressed'), 'false');
    await chip('addr'); assert.equal(await page.getAttribute('[data-chip="addr"]', 'aria-pressed'), 'false', 'toggling a chip off');
    assert.deepEqual(await names(page), ['Cara Clark'], 'no purchases yet alone');
    await page.click('#cclr'); await settle(page); assert.equal((await names(page)).length, 4); assert.equal(await page.locator('#cclr').count(), 0);
    assert.deepEqual(await chip('recent'), ['Alice Adams', 'Dan Dee'], 'Bought in the last 30 days'); await search(page, 'dan'); assert.deepEqual(await names(page), ['Dan Dee'], 'chips combine with the search');
    await page.click('#cclr'); await settle(page);

    // ---- one-place history ----
    await page.click('tr.click:has-text("Alice Adams")'); await page.waitForSelector('.sheet .buy-row');
    const sheet = await page.textContent('.sheet'), html = await page.innerHTML('.sheet');
    assert.match(sheet, /\$110\.00 spent across 1 purchase/); assert.match(sheet, /after refunds/);
    assert.match(sheet, /S-20261001-AAAA/); assert.match(sheet, /\$210\.00/, 'what the customer paid, shipping included'); assert.match(sheet, /Shipping/); assert.match(sheet, /To ship/);
    assert.match(sheet, /UPS Tracking/); assert.match(sheet, /TRK-ALICE-123/); assert.match(sheet, /Partly returned/); assert.match(sheet, /Refund \$100\.00/); assert.match(sheet, /R-20261001-AB123/); assert.match(sheet, /return tracking RET-9/);
    assert.match(sheet, /Net \$110\.00/); assert.match(sheet, /Acme X5 · U-A1; Acme X5 · U-A2/, 'the items');
    assert.equal(await page.inputValue('#cas'), '1 Main St', 'saved address in the form'); assert.equal(await page.inputValue('#notes'), 'church group');
    assert.ok(!/42\.42|4242|your shipping cost/i.test(sheet + html), 'the history never shows the own shipping cost');
    assert.equal(await page.locator('.sheet [data-plabel]').count(), 1, 'a label button on the shipped sale');
    await page.click('.sheet [data-receipt]'); await page.waitForSelector('.receipt'); assert.match(await page.textContent('.receipt'), /S-20261001-AAAA/); await page.evaluate(() => document.querySelectorAll('.scrim [data-cancel]')[1]?.click());
    await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('.scrim [data-cancel]').forEach(b => b.click()));
    await page.click('tr.click:has-text("Bob Brown")'); await page.waitForSelector('.sheet .buy-row'); assert.match(await page.textContent('.sheet'), /Pickup/); assert.equal(await page.locator('.sheet [data-plabel]').count(), 0, 'no label button on a pickup'); await page.click('.sheet [data-cancel]');
    await page.click('tr.click:has-text("Cara Clark")'); await page.waitForSelector('.sheet'); assert.match(await page.textContent('.sheet'), /No purchases yet/); await page.click('.sheet [data-cancel]');

    // ---- phone layout ----
    await page.setViewportSize({ width: 375, height: 800 }); await goCustomers(page);
    assert.ok(await noScroll(page) <= 1, 'no sideways scroll at 375px'); assert.equal(await page.locator('thead').isVisible(), false, 'column titles are hidden on a phone');
    assert.equal(await page.locator('.select.sort-pick').isVisible(), true, 'the sort list shows on a phone');
    await page.click('#csort'); await page.click('.select-option[data-value="spent:desc"]'); await settle(page); assert.deepEqual((await names(page))[0], 'Dan Dee');
    await page.click('#csort'); await page.click('.select-option[data-value="name:asc"]'); await settle(page); assert.deepEqual(await names(page), ['Alice Adams', 'Bob Brown', 'Cara Clark', 'Dan Dee']);
    await page.fill('#q', 'trk'); await settle(page); assert.ok((await page.locator('#qclear').boundingBox()).width >= 40, 'the clear button is a full tap target'); assert.ok((await page.locator('[data-chip="addr"]').boundingBox()).height >= 40);
    assert.equal(await page.getAttribute('tr.click td:nth-child(4)', 'data-label'), 'Purchases', 'cards carry their labels'); await page.click('#qclear'); await settle(page);
    await page.click('tr.click:has-text("Alice Adams")'); await page.waitForSelector('.sheet .buy-row'); assert.ok(await noScroll(page) <= 1, 'the history sheet does not scroll sideways at 375px');
    assert.ok((await page.locator('.sheet [data-receipt]').first().boundingBox()).height >= 20);
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
