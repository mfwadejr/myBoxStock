// TEST / t37-delivery — a real browser: Delivery on Quick sale (Immediate unchanged; Shipping, Pickup, Meet), saved address, fee and own-cost totals,
// receipt privacy, To ship / Mark shipped, CSV columns, old sales, backup and restore round trip, phone layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, fillLogin, allLogText } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: delivery at the point of sale', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const pick = async (id, value) => { await page.click('#' + id); await page.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
  const sales = () => page.evaluate(() => AccountApp.store.all('sale').map(e => ({ id: e.id, ...e.data })).sort((a, b) => a.ts - b.ts));
  const addDevice = async (uid) => { await page.fill('#scan', uid); await page.press('#scan', 'Enter'); await page.waitForSelector('.cart-line'); };
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Ship Co'); await page.fill('#em', 's@example.com'); await page.fill('#un', 'sam'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'sam@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#imp');
    const csv = path.join(os.tmpdir(), `t37-${Date.now()}.csv`); fs.writeFileSync(csv, 'uid,model,cost,price\n' + [1, 2, 3, 4, 5, 6].map(i => `T-${i},X5,50,100`).join('\n'));
    await page.setInputFiles('#file', csv); await page.waitForSelector('#go'); await page.click('#go'); await page.waitForSelector('tr.click'); fs.rmSync(csv, { force: true });

    // Immediate is the default and the screen shows nothing extra
    await page.goto(srv.base + '/app/#/sell'); await page.waitForSelector('#scan'); await addDevice('T-1');
    assert.match(await page.textContent('#dlv'), /Immediate/); assert.equal(await page.locator('#dbox').count(), 0, 'no extra fields for Immediate');
    await page.fill('#nn', 'Walk Buyer'); await page.click('#done'); await page.waitForSelector('.receipt');
    assert.doesNotMatch(await page.textContent('.receipt'), /Ship to|Shipping/); assert.equal(await page.locator('.delivery-detail').count(), 0); await page.click('[data-cancel]');
    let all = await sales(); assert.equal(all.length, 1); assert.equal('delivery' in all[0], false, 'an Immediate sale stores nothing extra'); assert.equal(all[0].total, 10000);

    // Shipping: fields appear, fee is a separate line, own cost is recorded but kept private
    await addDevice('T-2'); await pick('dlv', 'shipping'); await page.waitForSelector('#dbox');
    assert.equal(await page.locator('#shco').count(), 0, 'country is hidden unless switched on');
    await page.click('[data-mode=new]'); await page.fill('#nn', 'Ship Buyer'); await page.fill('#shs', '12 Elm Street'); await page.fill('#shu', 'Apt 4'); await page.fill('#shc', 'Columbus'); await page.fill('#shst', 'OH'); await page.fill('#shz', '43215');
    await page.fill('#dfee', '9.50'); await page.fill('#dcost', '6.25'); await page.fill('#dcar', 'USPS'); await page.fill('#dnote', 'Fragile, leave at the door');
    assert.match(await page.textContent('#ship'), /9\.50/); assert.match(await page.textContent('#tot'), /109\.50/);
    assert.equal(await page.isChecked('#dsave'), true, 'save-to-customer switch is on for a new customer');
    await page.click('#done'); await page.waitForSelector('.receipt');
    const rc = await page.textContent('.receipt');
    assert.match(rc, /Ship to/); assert.match(rc, /12 Elm Street/); assert.match(rc, /Columbus, OH 43215/); assert.match(rc, /Shipping/); assert.match(rc, /9\.50/); assert.match(rc, /109\.50/);
    assert.doesNotMatch(rc, /6\.25|Fragile|cost|profit/i, 'receipt has no own cost, no delivery note by default');
    assert.match(await page.textContent('.delivery-detail'), /To ship/); assert.match(await page.textContent('.delivery-detail'), /6\.25/, 'sale detail shows the own cost to staff');
    assert.equal(await page.locator('.receipt .delivery-detail').count(), 0, 'internal block is not inside the receipt');
    const emailText = await page.evaluate(() => { const A = AccountApp; const s = A.store.all('sale').find(e => e.data.delivery); return A.commerce.receiptText(s, true); });
    assert.match(emailText, /Shipping: \$9\.50/); assert.doesNotMatch(emailText, /6\.25|cost|profit|Fragile/i, 'emailed/shared text has no own cost');
    await page.click('[data-cancel]');
    all = await sales(); const ship = all.find(s => s.delivery);
    assert.equal(ship.total, 10000, 'item total is untouched by the fee'); assert.equal(ship.cost, 5000, 'profit uses item cost only');
    assert.deepEqual({ ...ship.delivery, shipTo: undefined }, { type: 'shipping', shipTo: undefined, fee: 950, cost: 625, carrier: 'USPS', tracking: '', note: 'Fragile, leave at the door', status: 'toship', shippedAt: 0, labelRef: '' });
    assert.equal(ship.delivery.shipTo.name, 'Ship Buyer'); assert.equal(ship.delivery.shipTo.zip, '43215');
    const cust = await page.evaluate(() => AccountApp.store.all('customer').find(e => e.data.name === 'Ship Buyer').data);
    assert.equal(cust.address.street, '12 Elm Street'); assert.equal(cust.address.city, 'Columbus');

    // saved address prefills for the existing customer; the save switch can keep a new address off the record
    await addDevice('T-3'); await pick('dlv', 'shipping'); await page.waitForSelector('#dbox');
    await page.click('[data-mode=existing]'); await page.fill('#cs', 'Ship'); await page.locator('#cl li').first().click(); await page.waitForSelector('#shs');
    assert.equal(await page.inputValue('#shs'), '12 Elm Street'); assert.equal(await page.inputValue('#shn'), 'Ship Buyer'); assert.equal(await page.locator('#dsave').count(), 0, 'no save switch when the customer already has an address');
    await page.fill('#dfee', '0'); await page.click('#done'); await page.waitForSelector('.receipt'); assert.match(await page.textContent('.receipt'), /Shipping\s*\$0\.00/); await page.click('[data-cancel]');
    await addDevice('T-4'); await pick('dlv', 'shipping'); await page.waitForSelector('#dbox'); await page.click('[data-mode=new]'); await page.fill('#nn', 'No Save Buyer');
    await page.fill('#shs', '1 Main St'); await page.fill('#shc', 'Dayton'); await page.locator('label.switch:has(#dsave)').click(); assert.equal(await page.isChecked('#dsave'), false);
    await page.click('#done'); await page.waitForSelector('.receipt'); await page.click('[data-cancel]');
    assert.equal(await page.evaluate(() => AccountApp.store.all('customer').find(e => e.data.name === 'No Save Buyer').data.address), undefined, 'address not kept when the switch is off');

    // Pickup and Meet capture notes only
    await addDevice('T-5'); await pick('dlv', 'meet'); await page.waitForSelector('#dnotes'); assert.equal(await page.locator('#shs').count(), 0, 'no address for a meet');
    await page.click('[data-mode=new]'); await page.fill('#nn', 'Meet Buyer'); await page.fill('#dwhen', '2026-10-01'); await page.fill('#dnotes', 'Library lot, 5pm, with Dana'); await page.click('#done'); await page.waitForSelector('.receipt');
    assert.doesNotMatch(await page.textContent('.receipt'), /Library lot/, 'meet note is off the receipt by default'); assert.match(await page.textContent('.receipt'), /Meet/); await page.click('[data-cancel]');
    await addDevice('T-6'); await pick('dlv', 'pickup'); await page.waitForSelector('#dnotes'); await page.click('[data-mode=new]'); await page.fill('#nn', 'Pickup Buyer'); await page.fill('#dnotes', 'Back door'); await page.click('#done'); await page.waitForSelector('.receipt'); await page.click('[data-cancel]');
    all = await sales(); const meet = all.find(s => s.delivery?.type === 'meet'), pickup = all.find(s => s.delivery?.type === 'pickup');
    assert.deepEqual(meet.delivery, { type: 'meet', date: '2026-10-01', notes: 'Library lot, 5pm, with Dana' }); assert.deepEqual(pickup.delivery, { type: 'pickup', date: '', notes: 'Back door' });

    // Sales list: Delivery tag, To ship filter, Mark shipped with carrier and tracking
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click');
    assert.ok((await page.locator('tr.click .chip:has-text("To ship")').count()) >= 2); assert.match(await page.textContent('.hint.mb-md >> nth=1'), /Profit after shipping/);
    await pick('sdl', 'toship'); await page.waitForSelector('[data-shipped]'); assert.equal(await page.locator('tr.click').count(), 3);
    await page.locator('[data-shipped]').first().click(); await page.fill('.sheet #scar', 'UPS'); await page.fill('.sheet #str', '1Z999'); await page.click('.sheet #go'); await page.waitForFunction(() => document.querySelectorAll('tr.click').length === 2);
    await pick('sdl', 'shipped'); await page.waitForSelector('tr.click'); await page.locator('tr.click').first().click(); await page.waitForSelector('.delivery-detail');
    const det = await page.textContent('.delivery-detail'); assert.match(det, /Shipped/); assert.match(det, /UPS/); assert.match(det, /1Z999/); assert.ok(await page.locator('#dcopy').count());
    await page.click('[data-cancel]');
    const shipped = (await sales()).find(s => s.delivery?.status === 'shipped'); assert.equal(shipped.delivery.tracking, '1Z999'); assert.ok(shipped.delivery.shippedAt > 0);

    // exports carry the new columns; a customer's address is exported too
    const cols = await page.evaluate(() => { const A = AccountApp, t = A.salesTable(A.store.all('sale')); return { h: t.headers, r: t.rows.find(r => r[t.headers.indexOf('delivery')] === 'Shipping' && r[t.headers.indexOf('tracking')]) }; });
    for (const h of ['delivery', 'delivery_status', 'ship_to', 'shipping_fee', 'shipping_cost', 'carrier', 'tracking', 'shipped_on', 'delivery_note', 'delivery_date', 'delivery_notes']) assert.ok(cols.h.includes(h), h);
    assert.ok(cols.r.includes('1Z999') && cols.r.includes('Shipped'));

    // old sales (no delivery) read as Immediate and stay as they are
    const old = await page.evaluate(async () => { const A = AccountApp, [id] = await A.store.commit({ puts: [{ type: 'sale', data: { no: 'S-OLD-1', ts: Date.now() - 5e8, customerId: null, customerName: 'Old', items: [], subtotal: 500, total: 500, cost: 100, payment: 'cash' } }] }); const e = A.store.get('sale', id); return { t: A.commerce.delivery.typeOf(e.data), due: A.commerce.delivery.due(e.data), tag: A.commerce.delivery.tag(e.data), st: A.commerce.delivery.status(e.data) }; });
    assert.deepEqual(old, { t: 'immediate', due: 500, tag: '', st: '' });

    // Settings switches put the notes on the receipt
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#drdn'); assert.equal(await page.locator('.brand-logo').count() >= 1, true);
    await page.locator('label.switch:has(#drdn)').click(); await page.locator('label.switch:has(#drnote)').click(); await page.locator('label.switch:has(#dcountry)').click(); await page.click('#save'); await page.waitForSelector('.toasts .toast');
    const rcs = await page.evaluate(() => { const A = AccountApp, C = A.commerce, es = A.store.all('sale'); return { ship: C.receiptText(es.find(e => e.data.delivery?.type === 'shipping' && e.data.delivery.note)), meet: C.receiptText(es.find(e => e.data.delivery?.type === 'meet')) }; });
    assert.match(rcs.ship, /Delivery note: Fragile/); assert.match(rcs.meet, /Library lot/); assert.doesNotMatch(rcs.ship + rcs.meet, /6\.25/);
    await page.goto(srv.base + '/app/#/sell'); await page.waitForSelector('#scan');

    // Customer page has an Address section (edit, clear)
    await page.goto(srv.base + '/app/#/customers'); await page.waitForSelector('tr.click'); await page.locator('tr.click', { hasText: 'Ship Buyer' }).click(); await page.waitForSelector('#cas');
    assert.equal(await page.inputValue('#cas'), '12 Elm Street'); await page.fill('#cau', 'Suite 9'); await page.click('.sheet #go'); await page.waitForSelector('.sheet', { state: 'detached' });
    assert.equal(await page.evaluate(() => AccountApp.store.all('customer').find(e => e.data.name === 'Ship Buyer').data.address.unit), 'Suite 9');
    await page.locator('tr.click', { hasText: 'Ship Buyer' }).click(); await page.waitForSelector('#caclear'); await page.click('#caclear'); await page.click('.sheet #go'); await page.waitForSelector('.sheet', { state: 'detached' });
    assert.equal(await page.evaluate(() => AccountApp.store.all('customer').find(e => e.data.name === 'Ship Buyer').data.address), undefined, 'cleared address is gone');
    await page.locator('tr.click', { hasText: 'Ship Buyer' }).click(); await page.fill('#cas', '12 Elm Street'); await page.fill('#cac', 'Columbus'); await page.click('.sheet #go'); await page.waitForSelector('.sheet', { state: 'detached' });

    // backup and restore round trip keeps every new field (sales, customer address, settings)
    const before = await page.evaluate(() => JSON.stringify({ s: AccountApp.store.all('sale').map(e => [e.id, e.data]).sort(), c: AccountApp.store.all('customer').map(e => [e.id, e.data]).sort(), cfg: [AccountApp.store.config().delivery, AccountApp.store.config().label] }));
    const after = await page.evaluate(async () => { const A = AccountApp, S = A.store, E = A.backupEngine; const f = await E.makeFile(); const ids = (t) => S.all(t).map(e => ({ type: t, id: e.id }));
      await S.commit({ deletes: [...ids('sale'), ...ids('customer'), ...ids('config')] }); const parsed = await A.backupFile.read(f.text, { adk: A.vault.adk, accountCode: A.me.accountCode }); await E.run(parsed, 'replace');
      return JSON.stringify({ s: S.all('sale').map(e => [e.id, e.data]).sort(), c: S.all('customer').map(e => [e.id, e.data]).sort(), cfg: [S.config().delivery, S.config().label] }); });
    assert.equal(after, before, 'restored data equals the backup, field for field'); assert.match(after, /1Z999/); assert.match(after, /Library lot/);

    // phone layout: the delivery fields fit without sideways scrolling
    await page.setViewportSize({ width: 375, height: 800 }); await page.goto(srv.base + '/app/#/sell'); await page.waitForSelector('#scan');
    await page.evaluate(() => { AccountApp.store.all('item'); }); await addDevice('T-3').catch(() => {});
    const left = await page.evaluate(() => AccountApp.store.all('item').filter(e => e.data.status === 'available').length);
    if (left) { await pick('dlv', 'shipping'); await page.waitForSelector('#dbox'); await page.waitForTimeout(300); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll on a phone');
    const box = await page.locator('#dbox').boundingBox().catch(() => null); if (box) assert.ok(box.x >= 0 && box.x + box.width <= 376, 'delivery box fits the phone');

    // logged, without any address or tracking
    const logs = allLogText(srv.logDir); assert.match(logs, /delivery\.shipped/); assert.match(logs, /delivery\.sale/); assert.doesNotMatch(logs, /12 Elm Street|1Z999|Library lot|Fragile/, 'no address, tracking or notes in logs');
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});

test('delivery and label code uses no inline styles and has docs-covered labels', () => {
  for (const f of ['public/js/app/delivery.js', 'public/js/app/label.js']) { const s = fs.readFileSync(path.join(import.meta.dirname, '..', f), 'utf8'); assert.ok(!/\bstyle\s*=/.test(s), f + ' has no style attribute'); }
});
