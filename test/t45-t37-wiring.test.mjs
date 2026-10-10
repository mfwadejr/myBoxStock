// TEST / t45-t37-wiring — returns and refunds (T45) agree with delivery and shipping (T37): a return of a shipped sale shows the return-tracking boxes and the shipping-fee refund,
// revenue includes the shipping fee (net of any fee refunded), profit subtracts the reseller's own shipping cost, Sales, Home and Customers show the same net figures,
// and the credit note never shows the own cost.
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
  await page.fill('#bn', 'Wire Co'); await page.fill('#em', 'wire@example.com'); await page.fill('#un', 'wanda'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const login = 'wanda@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
};
// Two devices at 100.00 (cost 50.00 each). Shipped sale: fee 15.00 charged, own cost 7.77 (internal). Items 200.00, so the customer paid 215.00.
const makeSale = (page, tag, { shipped = true, customerId = null } = {}) => page.evaluate(async ({ tag, shipped, customerId }) => {
  const A = AccountApp, S = A.store, C = A.commerce, now = Date.now();
  const ids = await S.commit({ puts: [1, 2].map(n => ({ type: 'item', data: { uid: `${tag}-${n}`, serial: '', mac: '', make: 'Acme', model: 'X5', cost: 5000, price: 10000, status: 'available', addedAt: now } })) });
  const saleId = Vault.newId(), items = ids.map((id, n) => ({ id, uid: `${tag}-${n + 1}`, make: 'Acme', model: 'X5', fields: [], inspection: null, listPrice: 10000, pct: 0, price: 10000, cost: 5000 }));
  const delivery = shipped ? { type: 'shipping', shipTo: { name: 'Wire Buyer', street: '1 Main St', unit: '', city: 'Austin', state: 'TX', zip: '78701', country: '' }, fee: 1500, cost: 777, carrier: 'UPS', tracking: '1Z-WIRE-9', note: '', status: 'toship', shippedAt: 0 } : null;
  const sale = { no: C.newReceiptNo(now), ts: now, customerId, customerName: 'Wire Buyer', customerEmail: 'wire@example.com', items, subtotal: 20000, orderPct: 0, orderOff: 0, total: 20000, cost: 10000, payment: 'cash', paymentLabel: 'Cash', warranty: C.warrantySnapshot('d30', now), notes: '', ...(delivery ? { delivery } : {}) };
  await S.commit({ puts: [{ type: 'sale', id: saleId, data: sale }, ...ids.map(id => ({ type: 'item', id, data: { ...S.get('item', id).data, status: 'sold', soldAt: now, saleId } }))] });
  return { saleId, ids, no: sale.no };
}, { tag, shipped, customerId });
const go = (page, hash, sel) => page.evaluate((h) => { document.querySelectorAll('.scrim [data-cancel]').forEach(b => b.click()); if (location.hash === h) AccountApp.route(); else location.hash = h; }, hash).then(() => page.waitForSelector(sel)).then(() => page.waitForTimeout(300));
const values = (page) => page.locator('.stat-value').allTextContents();
const openSale = async (page, no) => { await go(page, '#/sales', 'tr.click'); await page.fill('#q', no); await page.waitForFunction((n) => document.querySelectorAll('tr.click').length === 1 && document.querySelector('tr.click').textContent.includes(n), no); await page.waitForTimeout(400); await page.click('tr.click'); await page.waitForSelector('.receipt'); };

test('browser: returns and delivery agree on one net figure', { skip, timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await signUp(page, srv);
    const cid = await page.evaluate(async () => (await AccountApp.store.commit({ puts: [{ type: 'customer', data: { name: 'Wire Buyer', phone: '', email: 'wire@example.com', notes: '', createdAt: Date.now() } }] }))[0]);
    const a = await makeSale(page, 'WA', { customerId: cid });

    // ---- before any return: revenue is what the customer paid (215.00); profit takes off item cost and the own shipping cost ----
    const n0 = await page.evaluate((id) => AccountApp.returns.net(AccountApp.store.get('sale', id).data), a.saleId);
    assert.deepEqual(n0, { refunds: 0, fees: 0, revenue: 21500, cost: 10000, profit: 21500 - 10000 - 777, devices: 2, shipLoss: 0, shipFee: 1500, shipCost: 777 });
    await go(page, '#/sales', 'tr.click'); await page.fill('#q', a.no); await page.waitForTimeout(400);
    assert.deepEqual((await values(page)).slice(0, 3), ['1', '$215.00', '$107.23'], 'Sales: revenue includes the shipping fee, profit is after shipping cost');
    assert.match(await page.textContent('tr.click'), /\$215\.00/, 'the Total column is what the customer paid');
    await go(page, '#/home', '.stat-grid'); assert.deepEqual((await values(page)).slice(2, 4), ['$215.00', '$107.23'], 'Home agrees with Sales');
    await go(page, '#/customers', 'tr.click'); assert.match(await page.textContent('tr.click'), /\$215\.00/, 'Customers agrees');

    // ---- a return of a shipped sale: tracking boxes, shipping fee refunded offer ----
    await openSale(page, a.no); await page.click('#ret'); await page.waitForSelector('.ret-line');
    assert.equal(await page.locator('#rship').count(), 1, 'shipping fee box is there for a shipped sale'); assert.equal(await page.locator('#rtrk').count(), 1, 'return tracking box'); assert.equal(await page.locator('#rscost').count(), 1); assert.equal(await page.locator('#rspay').count(), 1);
    assert.match(await page.textContent('.field:has(#rship) label'), /customer paid \$15\.00/, 'the label names the fee the customer paid');
    await page.check(`[data-pick="${a.ids[0]}"]`); assert.equal(await page.inputValue('#rship'), '', 'one of two devices: the shipping fee is kept');
    await page.check(`[data-pick="${a.ids[1]}"]`); assert.equal(await page.inputValue('#rship'), '15.00', 'every device back: the fee is offered back'); assert.match(await page.textContent('#rtot'), /215\.00/);
    await page.uncheck(`[data-pick="${a.ids[1]}"]`); assert.equal(await page.inputValue('#rship'), '');
    await page.click('#rgo'); await page.waitForSelector('#cn');
    const note = await page.textContent('#cn'), noteHtml = await page.innerHTML('#cn');
    assert.ok(!/7\.77|777|your shipping cost|1Z-WIRE/i.test(note + noteHtml), 'the credit note never shows the own shipping cost (or the tracking)');
    assert.ok(!/cost|profit/i.test(noteHtml.replace(/class="[^"]*"/g, '')), 'no cost or profit in the credit note markup');
    const text = await page.evaluate((id) => { const s = AccountApp.store.get('sale', id); return AccountApp.returns.noteText(s, s.data.returns[0]); }, a.saleId);
    assert.ok(!/7\.77|cost|profit/i.test(text), 'the emailed credit note text never shows the own cost');
    await page.click('#cn ~ .actions [data-cancel]');

    // ---- after the part return (100.00 refunded, fee kept): the same net figure everywhere ----
    const n1 = await page.evaluate((id) => AccountApp.returns.net(AccountApp.store.get('sale', id).data), a.saleId);
    assert.equal(n1.revenue, 11500); assert.equal(n1.profit, 11500 - 5000 - 777); assert.equal(n1.refunds, 10000);
    await go(page, '#/sales', 'tr.click'); await page.fill('#q', a.no); await page.waitForTimeout(400);
    assert.deepEqual((await values(page)).slice(0, 3), ['1', '$115.00', '$57.23'], 'Sales after the refund');
    await go(page, '#/home', '.stat-grid'); assert.deepEqual((await values(page)).slice(2, 4), ['$115.00', '$57.23'], 'Home after the refund');
    await go(page, '#/customers', 'tr.click'); assert.match(await page.textContent('tr.click'), /\$115\.00/, 'Customers after the refund');
    const csv = await page.evaluate((id) => { const A = AccountApp, t = A.salesTable([A.store.get('sale', id)]); return Object.fromEntries(t.headers.map((h, i) => [h, t.rows[0][i]])); }, a.saleId);
    assert.equal(csv.total, '215.00'); assert.equal(csv.profit, '107.23'); assert.equal(csv.net_total, '115.00'); assert.equal(csv.net_profit, '57.23'); assert.equal(csv.shipping_cost, '7.77', 'the sales CSV is for the reseller, so it keeps the own cost');

    // ---- the whole sale returned and the shipping fee refunded: revenue is zero, the own cost stays a loss ----
    await openSale(page, a.no); await page.click('#ret'); await page.waitForSelector('.ret-line'); await page.check(`[data-pick="${a.ids[1]}"]`);
    assert.equal(await page.inputValue('#rship'), '15.00', 'the last device back offers the fee'); await page.click('#rgo'); await page.waitForSelector('#cn');
    assert.match(await page.textContent('#cn'), /Shipping refunded/); assert.ok(!/7\.77/.test(await page.textContent('#cn'))); await page.click('#cn ~ .actions [data-cancel]');
    const n2 = await page.evaluate((id) => AccountApp.returns.net(AccountApp.store.get('sale', id).data), a.saleId);
    assert.equal(n2.revenue, 0); assert.equal(n2.profit, -777); assert.equal(n2.refunds, 21500);

    // ---- a sale that was not shipped: no shipping boxes, nothing changes ----
    const b = await makeSale(page, 'WB', { shipped: false });
    const nb = await page.evaluate((id) => AccountApp.returns.net(AccountApp.store.get('sale', id).data), b.saleId); assert.equal(nb.revenue, 20000); assert.equal(nb.profit, 10000); assert.equal(nb.shipFee, 0);
    await openSale(page, b.no); await page.click('#ret'); await page.waitForSelector('.ret-line'); assert.equal(await page.locator('#rship').count(), 0); assert.equal(await page.locator('#rtrk').count(), 0);
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
