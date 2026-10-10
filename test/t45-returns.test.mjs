// TEST / t45-returns — a real browser: returns and refunds on sales (full and partial, restock choices, restocking fee, shipped sales, roles, limit, credit note without costs,
// totals net of refunds, CSV columns, void unchanged, backup and restore round trip) plus the server log note.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, fillLogin, allLogText } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

const signUp = async (page, srv) => {
  await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
  await page.fill('#bn', 'Return Co'); await page.fill('#em', 'ret@example.com'); await page.fill('#un', 'rita'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const login = 'rita@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
  return login;
};
const addUser = async (br, page, srv, login, name, role) => {
  await page.goto(srv.base + '/app/#/team'); await page.waitForSelector('#add'); await page.click('#add'); await page.fill('#u', name); await page.click('.sheet #r'); await page.click(`.sheet .select-option[data-value=${role}]`); await page.fill('#p', 'Temp-pass-12345'); await page.click('.sheet #go'); await page.waitForTimeout(800);
  const o = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); await o.goto(srv.base + '/app/'); await fillLogin(o, name + '@' + login.split('@')[1]); await o.fill('#p', 'Temp-pass-12345'); await o.click('button.block');
  await o.waitForSelector('#a'); await o.fill('#a', 'Temp-pass-12345'); await o.fill('#b', 'Brand-new-pass-678'); await o.click('button.block'); await o.waitForSelector('.side');
  return o;
};
// Two devices at 100.00 (cost 50.00) sold on one receipt, built the way Quick sale builds it.
const makeSale = (page, tag, extra = {}) => page.evaluate(async ({ tag, extra }) => {
  const A = AccountApp, S = A.store, C = A.commerce, now = Date.now();
  const ids = await S.commit({ puts: [1, 2].map(n => ({ type: 'item', data: { uid: `${tag}-${n}`, serial: '', mac: '', make: 'Acme', model: 'X5', cost: 5000, price: 10000, status: 'available', addedAt: now } })) });
  const saleId = Vault.newId(), items = ids.map((id, n) => ({ id, uid: `${tag}-${n + 1}`, make: 'Acme', model: 'X5', fields: [], inspection: null, listPrice: 10000, pct: 0, price: 10000, cost: 5000 }));
  const sale = { no: C.newReceiptNo(now), ts: now, customerId: null, customerName: 'Buyer One', customerEmail: 'buyer@example.com', items, subtotal: 20000, orderPct: 0, orderOff: 0, total: 20000, cost: 10000, payment: 'cash', paymentLabel: 'Cash', warranty: C.warrantySnapshot('d30', now), notes: '', ...extra };
  await S.commit({ puts: [{ type: 'sale', id: saleId, data: sale }, ...ids.map(id => ({ type: 'item', id, data: { ...S.get('item', id).data, status: 'sold', soldAt: now, saleId } }))] });
  return { saleId, ids, no: sale.no };
}, { tag, extra });
const openSale = async (page, no) => { await page.evaluate(() => { document.querySelectorAll('.scrim [data-cancel]').forEach(b => b.click()); location.hash = '#/sales'; AccountApp.route(); }); await page.waitForSelector('tr.click'); await page.fill('#q', no); await page.waitForFunction((n) => document.querySelectorAll('tr.click').length === 1 && document.querySelector('tr.click').textContent.includes(n), no); await page.click('tr.click'); await page.waitForSelector('.receipt'); };
const closeAll = (page) => page.evaluate(() => document.querySelectorAll('.scrim [data-cancel]').forEach(b => b.click()));
const sheetText = (page) => page.textContent('.sheet');
const itemStatus = (page, id) => page.evaluate((i) => AccountApp.store.get('item', i).data.status + '|' + (AccountApp.store.get('item', i).data.saleId || ''), id);

test('browser: returns and refunds', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    const login = await signUp(page, srv);

    // ---- a partial return: one of two devices, back to Available, whole price refunded ----
    const a = await makeSale(page, 'RA');
    await openSale(page, a.no);
    assert.equal(await page.locator('#ret').count(), 1, 'Administrator sees Return or refund'); assert.equal(await page.locator('#void').count(), 1);
    await page.click('#ret'); await page.waitForSelector('.ret-line');
    assert.equal(await page.locator('#rgo').isDisabled(), true, 'nothing ticked yet'); assert.equal(await page.inputValue('#rfee'), '', 'restocking fee defaults to none');
    await page.check(`[data-pick="${a.ids[0]}"]`); assert.match(await page.textContent('#rtot'), /100\.00/); assert.equal(await page.inputValue(`[data-amt="${a.ids[0]}"]`), '100.00');
    await page.fill(`[data-amt="${a.ids[0]}"]`, '150'); await page.click('#rgo'); assert.match(await page.textContent('.toasts'), /more than it sold for/); await page.fill(`[data-amt="${a.ids[0]}"]`, '100');
    assert.equal(await page.locator('#rship').count(), 0, 'no shipping boxes on a sale that was not shipped');
    await page.click('#rgo'); await page.waitForSelector('#cn');
    const note = await page.textContent('#cn'); assert.match(note, /Credit note R-\d{8}-[A-Z0-9]{5}/); assert.match(note, /100\.00/); assert.match(note, /Total refunded/); assert.match(note, /Refunded by\s*Cash/);
    assert.ok(!/cost|profit|50\.00|Acme X5 cost/i.test(note), 'the credit note never shows costs or profit');
    const noteHtml = await page.innerHTML('#cn'); assert.ok(!/cost|profit/i.test(noteHtml.replace(/class="[^"]*"/g, '')), 'no cost or profit in the credit note markup');
    await page.click('#cn ~ .actions [data-cancel]');
    assert.equal(await itemStatus(page, a.ids[0]), 'available|', 'back to Available, no longer tied to the sale'); assert.match(await itemStatus(page, a.ids[1]), /^sold\|/);
    let net = await page.evaluate((id) => AccountApp.returns.net(AccountApp.store.get('sale', id).data), a.saleId);
    assert.deepEqual(net, { refunds: 10000, fees: 0, revenue: 10000, cost: 5000, profit: 5000, devices: 1, shipLoss: 0, shipFee: 0, shipCost: 0 }, 'revenue and profit after the refund');
    await page.evaluate(() => { location.hash = '#/sales'; }); await page.waitForSelector('tr.click'); await page.fill('#q', a.no); await page.waitForTimeout(400);
    assert.match(await page.textContent('tr.click'), /Partly returned/);
    const stats = await page.textContent('.stat-grid'); assert.match(stats, /Refunds/); assert.match(stats, /\$100\.00/); assert.match(stats, /after refunds/);
    assert.equal(await page.locator('.stat-grid.five').count(), 1);

    // the sale sheet: a Credit note button, and Void is gone (a sale with returns cannot be voided)
    await page.click('tr.click'); await page.waitForSelector('.receipt'); assert.equal(await page.locator('#void').count(), 0); assert.equal(await page.locator('[data-cn]').count(), 1); assert.match(await page.textContent('.receipt'), /Part of this sale was returned/);
    // second return of the other device: Damaged, part refund with a restocking fee, so net 80.00
    await page.click('#ret'); await page.waitForSelector('.ret-line'); assert.equal(await page.locator('.ret-line').count(), 1, 'a returned device cannot be returned twice');
    await page.check(`[data-pick="${a.ids[1]}"]`); await page.fill(`[data-amt="${a.ids[1]}"]`, '90'); await page.fill('#rfee', '10'); assert.match(await page.textContent('#rtot'), /80\.00/);
    await page.click(`#rs_${a.ids[1]}`); await page.click(`.select-option[data-value=damaged]`); await page.click('#rgo'); await page.waitForSelector('#cn');
    assert.match(await page.textContent('#cn'), /Restocking fee/); assert.match(await page.textContent('#cn'), /80\.00/); await page.click('#cn ~ .actions [data-cancel]');
    assert.equal(await itemStatus(page, a.ids[1]), 'damaged|');
    net = await page.evaluate((id) => AccountApp.returns.net(AccountApp.store.get('sale', id).data), a.saleId);
    assert.deepEqual(net, { refunds: 18000, fees: 1000, revenue: 2000, cost: 5000, profit: -3000, devices: 0, shipLoss: 0, shipFee: 0, shipCost: 0 }, 'a damaged device keeps its cost');
    assert.equal(await page.evaluate((id) => AccountApp.returns.state(AccountApp.store.get('sale', id).data), a.saleId), 'full');
    await page.evaluate(() => { location.hash = '#/sales'; }); await page.waitForSelector('tr.click'); await page.fill('#q', a.no); await page.waitForTimeout(400);
    assert.match(await page.textContent('tr.click'), /Returned/); assert.match(await page.textContent('tr.click'), /Returned/, 'warranty chip says Returned');
    assert.equal(await page.evaluate(() => AccountApp.commerce.warrantyLines({ ...AccountApp.store.all('sale')[0].data }).length > 0), true);
    await page.click('tr.click'); await page.waitForSelector('.receipt'); assert.equal(await page.locator('#ret').count(), 0, 'nothing left to return'); await page.click('[data-cancel]');

    // ---- CSV columns, the returns table and the history card ----
    const csv = await page.evaluate((id) => { const A = AccountApp, e = A.store.get('sale', id), t = A.salesTable([e]), r = A.returns.table([e]); return { h: t.headers, row: t.rows[0], rh: r.headers, rr: r.rows }; }, a.saleId);
    const col = (h) => csv.row[csv.h.indexOf(h)]; assert.deepEqual(csv.h.slice(csv.h.indexOf('return_status'), csv.h.indexOf('return_status') + 4), ['return_status', 'refund', 'net_total', 'net_profit']); assert.deepEqual(['return_status', 'refund', 'net_total', 'net_profit'].map(col), ['Returned', '180.00', '20.00', '-30.00']);
    assert.equal(csv.rr.length, 2); assert.equal(csv.rh[0], 'credit_note'); assert.ok(csv.rr.every(r => /^R-/.test(r[0])));
    await page.evaluate(() => { location.hash = '#/activity'; }); await page.waitForSelector('#rethist tr.click'); assert.equal(await page.locator('#rethist tr.click').count(), 2); assert.match(await page.textContent('#rethist'), /rita/);

    // ---- void is unchanged for a sale without returns ----
    const v = await makeSale(page, 'RV'); await openSale(page, v.no); await page.click('#void'); await page.click('#ok'); await page.waitForTimeout(600);
    assert.equal(await itemStatus(page, v.ids[0]), 'available|'); assert.equal(await page.evaluate((id) => !!AccountApp.store.get('sale', id).data.voided, v.saleId), true);
    await page.evaluate(() => { location.hash = '#/sales'; }); await page.waitForSelector('tr.click'); await page.fill('#q', v.no); await page.waitForTimeout(400); await page.click('tr.click'); await page.waitForSelector('.receipt'); assert.equal(await page.locator('#ret').count(), 0, 'a voided sale cannot be returned'); await page.click('[data-cancel]');

    // ---- Settings: restocking fee default, refund limit, Standard switch, reasons ----
    await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForSelector('#rtfm');
    assert.equal(await page.isChecked('#rtstd'), true, 'Standard users can process returns by default'); assert.equal(await page.inputValue('#rtlim'), '', 'no limit by default');
    await page.click('#rtfm'); await page.click('.select-option[data-value=pct]'); await page.fill('#rtfv', '10'); await page.fill('#rtlim', '50');
    await page.click('#rtadd'); await page.locator('[data-rk]').last().fill('Customer was unhappy'); await page.click('#save'); await page.waitForFunction(() => /Settings saved/.test(document.querySelector('.toasts')?.textContent || ''));
    const saved = await page.evaluate(() => AccountApp.store.config().returns); assert.deepEqual({ ...saved, reasons: saved.reasons.length }, { reasons: 6, standardCan: true, limit: 5000, fee: { mode: 'pct', value: 10 } });
    const b = await makeSale(page, 'RB', { delivery: { type: 'shipping', shipTo: { name: 'Buyer One', street: '1 Main St', unit: '', city: 'Austin', state: 'TX', zip: '78701', country: '' }, fee: 1500, cost: 0, carrier: '', tracking: '', note: '', status: 'toship', shippedAt: 0 } });
    await openSale(page, b.no); await page.click('#ret'); await page.waitForSelector('.ret-line');
    await page.check(`[data-pick="${b.ids[0]}"]`); assert.equal(await page.inputValue('#rfee'), '10.00', 'default restocking fee 10% pre-filled'); assert.match(await page.textContent('#rtot'), /90\.00/);
    // shipped sale: return tracking, who paid, shipping fee refunded or kept
    assert.equal(await page.inputValue('#rship'), '', 'the shipping fee is kept unless refunded'); await page.fill('#rfee', ''); // the fee can be removed for this one return
    await page.check(`[data-pick="${b.ids[1]}"]`); assert.equal(await page.inputValue('#rship'), '15.00', 'every device returned: the shipping fee is offered back'); assert.match(await page.textContent('#rtot'), /215\.00/);
    await page.fill('#rship', '0'); await page.fill('#rtrk', 'RT123456'); await page.fill('#rscost', '8.50'); await page.click('#rspay'); await page.click('.select-option[data-value=reseller]');
    await page.click('#rgo'); await page.waitForSelector('#cn'); const bn = await page.textContent('#cn'); assert.ok(!/RT123456|8\.50|Return shipping/.test(bn), 'return tracking and return postage are internal');
    await page.click('#cn ~ .actions [data-cancel]');
    const rb = await page.evaluate((id) => AccountApp.store.get('sale', id).data.returns[0], b.saleId); assert.equal(rb.retTracking, 'RT123456'); assert.equal(rb.retShipCost, 850); assert.equal(rb.retShipPaidBy, 'reseller'); assert.equal(rb.net, 20000); assert.equal(rb.shipRefund, 0); assert.equal(rb.fee, 0);
    net = await page.evaluate((id) => AccountApp.returns.net(AccountApp.store.get('sale', id).data), b.saleId); assert.equal(net.shipLoss, 850); assert.equal(net.profit, 1500 - 850, 'the kept shipping fee is revenue; return postage paid by the reseller reduces profit');

    // ---- Standard user: over the limit asks an Administrator; switch off hides the button; View never ----
    const c = await makeSale(page, 'RC');
    const std = await addUser(br, page, srv, login, 'stan', 'Standard');
    await openSale(std, c.no); assert.equal(await std.locator('#ret').count(), 1, 'Standard user can process returns');
    await std.click('#ret'); await std.waitForSelector('.ret-line'); await std.check(`[data-pick="${c.ids[0]}"]`); await std.fill('#rfee', '');
    assert.equal(await std.isVisible('#rlim'), true); assert.match(await std.textContent('#rlim'), /above \$50\.00 need an Administrator/); assert.equal(await std.textContent('#rgo'), 'Ask an Administrator');
    await std.fill(`[data-amt="${c.ids[0]}"]`, '40'); assert.equal(await std.isVisible('#rlim'), false); assert.equal(await std.textContent('#rgo'), 'Process return');
    await std.fill(`[data-amt="${c.ids[0]}"]`, '100'); await std.fill('#rnote', 'Customer wants all of it back'); await std.click('#rgo'); await std.waitForTimeout(800);
    assert.equal(await std.evaluate((id) => AccountApp.store.get('sale', id).data.returns?.length || 0, c.saleId), 0, 'asking does not process anything');
    assert.equal(await std.evaluate((id) => !!AccountApp.store.get('sale', id).data.returnAsk, c.saleId), true);
    await page.evaluate(() => AccountApp.store.load()); await openSale(page, c.no); assert.match(await sheetText(page), /Return requested by stan/); await page.click('[data-cancel]');
    await std.evaluate(() => AccountApp.store.load());
    // an Administrator switches the Standard switch off
    await page.evaluate(async () => { await AccountApp.store.saveConfig({ ...AccountApp.store.config(), returns: { ...AccountApp.store.config().returns, standardCan: false } }); });
    await std.evaluate(() => AccountApp.store.load()); await openSale(std, c.no); assert.equal(await std.locator('#ret').count(), 0, 'switch off: Standard users cannot process returns'); await std.click('[data-cancel]');
    // an Administrator processes the request: the request tag goes away
    await page.evaluate(() => AccountApp.store.load()); await openSale(page, c.no); await page.click('#ret'); await page.waitForSelector('.ret-line'); await page.check(`[data-pick="${c.ids[0]}"]`); await page.click('#rgo'); await page.waitForSelector('#cn'); await page.click('#cn ~ .actions [data-cancel]');
    assert.equal(await page.evaluate((id) => !!AccountApp.store.get('sale', id).data.returnAsk, c.saleId), false, 'processing clears the request');
    const view = await addUser(br, page, srv, login, 'vera', 'View'); await view.evaluate(() => AccountApp.store.load());
    await openSale(view, c.no); assert.equal(await view.locator('#ret').count(), 0, 'View users never see Return or refund'); assert.equal(await view.locator('[data-cn]').count(), 1, 'but can open the credit note'); await view.click('[data-cn]'); await view.waitForSelector('#cn'); assert.ok(!/cost|profit/i.test(await view.textContent('#cn')));
    const denied = await view.evaluate(() => AccountApp.api('POST', '/account/return-note', { event: 'processed', devices: 1, cents: 100 }).then(() => 'ok', e => e.status)); assert.equal(denied, 403, 'the server refuses the log note from a View user');
    const bad = await page.evaluate(() => AccountApp.api('POST', '/account/return-note', { event: 'nonsense' }).then(() => 'ok', e => e.status)); assert.equal(bad, 400);

    // ---- logged: who, what, how much; no names or contents ----
    await page.waitForTimeout(500); const log = allLogText(srv.logDir);
    assert.match(log, /sale\.return_processed/); assert.match(log, /sale\.return_requested/); assert.match(log, /rita@[a-z0-9-]+ \(Administrator\) processed a return: 1 device, refund 100\.00/); assert.match(log, /stan@[a-z0-9-]+ \(Standard\) asked an Administrator/);
    for (const s of ['Buyer One', 'buyer@example.com', 'RT123456', 'Customer wants all of it back']) assert.ok(!log.includes(s), `the log never holds "${s}"`);

    // ---- backup and restore round trip keeps returns, tags and the new settings ----
    const before = await page.evaluate(() => ({ sales: AccountApp.store.all('sale').map(e => [e.data.no, JSON.stringify(e.data.returns || [])]).sort(), cfg: JSON.stringify(AccountApp.store.config().returns) }));
    const text = await page.evaluate(async () => (await AccountApp.backupEngine.makeFile()).text);
    assert.ok(!text.includes('RT123456') && !text.includes('Customer was unhappy'), 'the backup file is encrypted');
    await page.evaluate(async () => { const S = AccountApp.store; await S.commit({ puts: [...S.all('sale').map(e => { const { returns, ...rest } = e.data; return { type: 'sale', id: e.id, data: rest }; }), { type: 'config', id: S.CONFIG_ID, data: { ...S.config(), returns: S.defaults().returns } }] }); });
    assert.equal(await page.evaluate(() => AccountApp.store.all('sale').every(e => !e.data.returns)), true);
    await page.evaluate(async (t) => { const A = AccountApp, E = A.backupEngine, parsed = await A.backupFile.read(t, { adk: A.vault.adk, accountCode: A.me.accountCode }); await E.run(parsed, 'replace'); }, text);
    const after = await page.evaluate(() => ({ sales: AccountApp.store.all('sale').map(e => [e.data.no, JSON.stringify(e.data.returns || [])]).sort(), cfg: JSON.stringify(AccountApp.store.config().returns) }));
    assert.deepEqual(after, before, 'returns, return settings and tags survive backup and restore');
    const states = await page.evaluate(() => AccountApp.store.all('item').map(e => e.data.status)); assert.ok(states.includes('damaged'));

    // ---- phone layout: the sheet and Settings card do not scroll sideways ----
    await page.setViewportSize({ width: 375, height: 800 });
    await openSale(page, b.no); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'receipt with returns: no sideways scroll at 375px'); await closeAll(page);
    const d = await makeSale(page, 'RD'); await openSale(page, d.no); await page.click('#ret'); await page.waitForSelector('.ret-line'); await page.check(`[data-pick="${d.ids[0]}"]`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'return sheet: no sideways scroll at 375px'); assert.ok((await page.locator('#rgo').boundingBox()).height >= 40);
    await closeAll(page); await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForSelector('#rtfm'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'Settings: no sideways scroll at 375px');
    assert.deepEqual(errors, [], 'no script errors in the page');
  } finally { await br.close(); srv.stop(); }
});
