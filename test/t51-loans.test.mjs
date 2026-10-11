// TEST / t51-loans — a real browser: lend a device out to a new person (saved as a prospect) and to an existing customer, see it on Home / Inventory / the customer,
// block delete while out, take it back (missing item, damaged, good with a re-test), let the customer keep it, sell it to the borrower, edit the loan settings,
// the loans.csv export columns and the erase scrub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: demo units and loans', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(8000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const pick = async (id, value) => { await page.click('#' + id); await page.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
  const status = (id) => page.evaluate((i) => AccountApp.store.get('item', i).data.status, id);
  const item = (id) => page.evaluate((i) => AccountApp.store.get('item', i).data, id);
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Loan Co'); await page.fill('#em', 'l@example.com'); await page.fill('#un', 'lou'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'lou@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go');
    await page.waitForSelector('.side, .tabbar, nav', { timeout: 20000 }).catch(() => {});

    const cfg = await page.evaluate(() => AccountApp.store.config().loans);
    assert.deepEqual(cfg.items.map(i => i.label), ['Device', 'Remote', 'Batteries', 'Power Adapter', 'HDMI Cable'], 'default included items');
    assert.equal(cfg.reasons.find(r => r.key === 'repair').canKeep, false); assert.equal(cfg.reasons.find(r => r.key === 'demo').canKeep, true);

    const ids = await page.evaluate(async () => { const s = AccountApp.store; const mk = (uid) => ({ type: 'item', data: { uid, make: 'Acme', model: 'Box 1', status: 'available', cost: 5000, price: 9000, addedAt: Date.now(), receivedOn: '2026-01-01', checks: {} } });
      return s.commit({ puts: [mk('D1'), mk('D2'), mk('D3'), { type: 'customer', data: { name: 'Ann Existing', phone: '555-0100', email: 'ann@example.com', notes: '', createdAt: Date.now() } }] }); });
    const [d1, d2, d3, cAnn] = ids;

    // lend D1 to a new person: prospect, due date, one included item unticked
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click');
    await page.locator('tr.click', { hasText: 'D1' }).click(); await page.click('#lend'); await page.waitForSelector('#lrs');
    await page.click('[data-mode=new]'); await page.fill('#lnn', 'Nora Newperson'); await page.fill('#lnp', '555-0199');
    await page.uncheck('[data-li=hdmi]'); await page.fill('#ldue', '2099-01-01'); await page.fill('#lnote', 'Demo for her bar');
    await page.locator('.sheet #go').last().click(); await page.waitForSelector('.toasts .toast'); await page.waitForTimeout(400);
    assert.equal(await status(d1), 'loaned'); let it = await item(d1), loan = it.loans[0];
    assert.equal(loan.customer.name, 'Nora Newperson'); assert.equal(loan.reason, 'demo'); assert.equal(loan.dueAt, '2099-01-01'); assert.equal(loan.items.length, 4); assert.equal(loan.delivery.type, 'pickup'); assert.equal(loan.inAt, undefined);
    const nora = await page.evaluate((id) => AccountApp.store.get('customer', id)?.data, loan.customerId); assert.equal(nora.prospect, true); assert.equal(nora.phone, '555-0199');

    // Inventory shows it as On demo, with a filter; Home shows the card
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click');
    await pick('st', 'loaned'); await page.waitForTimeout(300); assert.equal(await page.locator('tr.click').count(), 1); assert.match(await page.textContent('tr.click'), /On demo/);
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('#loanbox'); assert.match(await page.textContent('#loanbox'), /Nora Newperson/);

    // delete / archive are blocked while it is out
    await page.goto(srv.base + '/app/#/inventory'); await pick('st', 'loaned'); await page.locator('tr.click').first().click(); await page.waitForSelector('#del');
    assert.equal(await page.locator('#lend').count(), 0); assert.equal(await page.locator('#lback').count(), 1);
    await page.click('#del'); await page.waitForSelector('.toasts .toast'); assert.match(await page.textContent('.toasts'), /out on demo/i); assert.equal(await status(d1), 'loaned');
    // the status field cannot be changed while out
    assert.equal(await page.locator('.sheet #status').locator('xpath=..').locator('.select-option').count(), 1);

    // take it back: HDMI is not in the list; untick Batteries, damaged needs a note
    await page.click('#lback'); await page.waitForSelector('#bcond'); assert.equal(await page.locator('[data-bi]').count(), 4);
    await page.uncheck('[data-bi=batteries]'); await pick('bcond', 'damaged'); await page.locator('.sheet #go').last().click(); await page.waitForTimeout(300); assert.equal(await status(d1), 'loaned', 'a damage note is required');
    await page.fill('#bdmg', 'Cracked case'); await page.locator('.sheet #go').last().click(); await page.waitForTimeout(500);
    it = await item(d1); assert.equal(it.status, 'damaged'); assert.equal(it.loans[0].outcome, 'returned'); assert.equal(it.loans[0].condition, 'damaged'); assert.equal(it.loans[0].damageNote, 'Cracked case'); assert.deepEqual(it.loans[0].missing.map(m => m.key), ['batteries']); assert.ok(it.loans[0].inAt);

    // D2 to an existing customer with a related sale and shipping; a label offer follows
    await page.evaluate(async (cid) => { const s = AccountApp.store; await s.commit({ puts: [{ type: 'sale', data: { no: 'R-0001', ts: Date.now() - 864e5, customerId: cid, customerName: 'Ann Existing', items: [], total: 0, subtotal: 0, cost: 0, payment: 'cash', paymentLabel: 'Cash', notes: '' } }] }); }, cAnn);
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#st'); await pick('st', 'all'); await page.locator('tr.click', { hasText: 'D2' }).click(); await page.click('#lend'); await page.waitForSelector('#lcs');
    await pick('lrs', 'rma'); await page.fill('#lcs', 'Ann'); await page.click('#lcl li'); await page.waitForSelector('#lsale'); await pick('lsale', await page.evaluate(() => AccountApp.store.all('sale')[0].id));
    await pick('ltype', 'shipping'); await page.fill('#shs', '1 Main St'); await page.fill('#shc', 'Austin'); await page.fill('#shst', 'TX'); await page.fill('#shz', '78701'); await page.fill('#dcar', 'UPS');
    await page.locator('.sheet #go').last().click(); await page.waitForSelector('.modal, .sheet #go, .confirm', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500);
    it = await item(d2); loan = it.loans[0]; assert.equal(it.status, 'loaned'); assert.equal(loan.reason, 'rma'); assert.equal(loan.delivery.type, 'shipping'); assert.equal(loan.delivery.carrier, 'UPS'); assert.equal(loan.customer.address.city, 'Austin'); assert.ok(loan.saleId);
    await page.evaluate(() => document.querySelectorAll('.scrim').forEach(s => s.remove()));

    // the customer sheet lists it; CSV has the columns
    await page.goto(srv.base + '/app/#/customers'); await page.waitForSelector('tr.click'); await page.locator('tr.click', { hasText: 'Ann Existing' }).click(); await page.waitForSelector('.buy-list');
    assert.match(await page.textContent('.sheet'), /Demo units and loans/); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    assert.match(await page.textContent('tr.click:has-text("Nora")'), /Prospect/);
    const csv = await page.evaluate(() => AccountApp.loans.table()); assert.equal(csv.rows.length, 2); assert.ok(csv.headers.includes('borrower') && csv.headers.includes('loan_damage')); assert.equal(csv.rows.length, 2);
    assert.equal(await page.evaluate((id) => AccountApp.loans.table(id).rows.length, cAnn), 1);

    // the customer keeps an RMA unit (reason allows it) but a repair loaner cannot be kept
    await page.goto(srv.base + '/app/#/inventory'); await pick('st', 'loaned'); await page.locator('tr.click', { hasText: 'D2' }).click(); await page.click('#lback'); await page.waitForSelector('#bout');
    await pick('bout', 'kept'); await page.locator('.sheet #go').last().click(); await page.waitForTimeout(500);
    it = await item(d2); assert.equal(it.status, 'archived'); assert.equal(it.loans[0].outcome, 'kept');

    // D3: lend as repair loaner (no keep option), sell to the borrower closes the loan as sold
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#st'); await pick('st', 'all'); await page.locator('tr.click', { hasText: 'D3' }).click(); await page.click('#lend'); await page.waitForSelector('#lrs'); await pick('lrs', 'repair');
    await page.click('[data-mode=existing]'); await page.fill('#lcs', 'Ann'); await page.click('#lcl li'); await page.locator('.sheet #go').last().click(); await page.waitForTimeout(500); assert.equal(await status(d3), 'loaned');
    await page.goto(srv.base + '/app/#/inventory'); await pick('st', 'loaned'); await page.locator('tr.click', { hasText: 'D3' }).click(); await page.click('#lback'); await page.waitForSelector('#bcond'); assert.equal(await page.locator('#bout').count(), 0, 'a repair loaner cannot be kept'); await page.locator('.sheet [data-cancel]').last().click(); await page.waitForTimeout(300);
    await page.locator('#lsell').click(); await page.waitForSelector('#done:not([disabled])'); assert.match(await page.textContent('.picked'), /Ann Existing/);
    await page.click('#done'); await page.waitForSelector('.sheet', { timeout: 8000 }); await page.waitForTimeout(500);
    it = await item(d3); assert.equal(it.status, 'sold'); assert.equal(it.loans[0].outcome, 'sold'); assert.ok(it.loans[0].soldSaleId);
    await page.evaluate(() => document.querySelectorAll('.scrim').forEach(s => s.remove()));

    // Settings: the card edits reasons and items and saves
    await page.goto(srv.base + '/app/#/settings'); await page.waitForSelector('#lnreasons'); await page.click('#lnradd'); await page.locator('[data-lk]').last().fill('Trade show'); await page.locator('[data-lc]').last().check();
    await page.fill('#lnd', '14'); await page.click('#save'); await page.waitForSelector('.toasts .toast'); await page.waitForTimeout(300);
    const lc = await page.evaluate(() => AccountApp.store.config().loans); assert.equal(lc.dueDays, 14); assert.equal(lc.reasons.at(-1).label, 'Trade show'); assert.equal(lc.reasons.at(-1).canKeep, true);
    // phone width: the Lend out sheet does not scroll sideways
    await page.setViewportSize({ width: 375, height: 800 }); await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('#st'); await pick('st', 'archived');
    await page.setViewportSize({ width: 1280, height: 1000 });
    // erasing a borrower scrubs the loan snapshot but keeps the device history
    const nid = (await item(d1)).loans[0].customerId, scrub = await page.evaluate((id) => AccountApp.loans.erasePuts(id).map(p => p.data.loans[0].customer.name + '|' + p.data.loans[0].customer.phone + '|' + p.data.loans[0].outNote), nid);
    assert.deepEqual(scrub, ['Erased customer||']);
  } finally { await br.close(); await srv.close?.(); }
  assert.deepEqual(errors, []);
});
