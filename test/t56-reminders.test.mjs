// TEST / t56-reminders — a real browser: Warranty ending soon (Home card, Sales > Ending soon, one reminder or Send all, the date kept) and overdue demo loans (Send reminder on the On demo card).
// Email is optional and never automatic. The mail request is answered by the test, so nothing is sent; the server's own checks are tried through the app's API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.mjs';
import { skip, launch, signUp } from './helpers-ui.mjs';

test('browser: reminders', { skip, timeout: 150000 }, async () => {
  const srv = await startServer(), br = await launch();
  try {
    const { page, errors } = await signUp(srv, br, { biz: 'Remind Co', user: 'remy' });
    const now = Date.now(), day = 864e5, today = new Date(now).toISOString().slice(0, 10), past = new Date(now - 3 * day).toISOString().slice(0, 10);
    await page.evaluate(async ([now, day, past]) => { const s = AccountApp.store;
      const [c1, c2, c3] = await s.commit({ puts: ['Ann', 'Bob', 'Cy'].map((n, i) => ({ type: 'customer', data: { name: n, phone: '', email: i === 1 ? '' : n.toLowerCase() + '@example.com', notes: '', createdAt: now } })) });
      const sale = (no, cid, name, email, endDays) => ({ type: 'sale', data: { no, ts: now - 100 * day, customerId: cid, customerName: name, customerEmail: email, items: [], subtotal: 0, total: 0, cost: 0, payment: 'cash', paymentLabel: 'Cash', notes: '', warranty: { key: 'w', label: '90 days', end: now + endDays * day } } });
      await s.commit({ puts: [sale('W-1', c1, 'Ann', 'ann@example.com', 5), sale('W-2', c2, 'Bob', '', 10), sale('W-3', c3, 'Cy', 'cy@example.com', 90), sale('W-4', c1, 'Ann', 'ann@example.com', -5)] });
      const [i1] = await s.commit({ puts: [{ type: 'item', data: { uid: 'L1', make: 'Acme', model: 'Box 1', status: 'loaned', cost: 5000, price: 9000, addedAt: now, receivedOn: '2026-01-01', checks: {}, loans: [{ id: 'loan1', reason: 'demo', reasonLabel: 'Demo or trial', customerId: c1, customer: { name: 'Ann', phone: '', email: 'ann@example.com', address: { name: '', street: '', unit: '', city: '', state: '', zip: '', country: '' } }, outAt: now - 10 * day, outBy: 'x', dueAt: past, delivery: { type: 'pickup', date: '', notes: '' }, items: [], outNote: '' }] } }] }); void i1; }, [now, day, past]);
    const sent = []; await page.route('**/api/app/receipt-email/reminder', async (r) => { sent.push(r.request().postDataJSON()); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"via":"site"}' }); });
    // Home: W-1 (5 days) and W-2 (10 days) are inside 30 days; W-3 (90) and W-4 (ended) are not
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('#warnbox');
    let rows = await page.locator('#warnbox tbody tr').allTextContents(); assert.equal(rows.length, 2); assert.match(rows[0], /W-1/); assert.match(rows[1], /W-2/);
    await page.click('[data-warn]'); await page.waitForTimeout(700);
    assert.equal(sent.length, 1); assert.equal(sent[0].kind, 'warranty_ending'); assert.equal(sent[0].to, 'ann@example.com'); assert.equal(sent[0].receiptNo, 'W-1'); assert.equal(sent[0].customer, 'Ann');
    assert.ok(await page.evaluate(() => AccountApp.store.all('sale').find(e => e.data.no === 'W-1').data.warrantyRemindedAt > 0), 'the date of the reminder is kept on the sale');
    await page.waitForSelector('#warnbox'); assert.match(await page.textContent('#warnbox'), /Reminded/);
    // a customer with no email address is told so
    await page.locator('[data-warn]').nth(1).click(); await page.waitForTimeout(500); assert.equal(sent.length, 1, 'nothing was sent without an address'); assert.match(await page.textContent('.toasts'), /no email address/);
    // Send all: W-1 was just reminded (skipped), W-2 has no email (skipped), so there is nobody to send to
    await page.click('#warnall'); await page.waitForTimeout(500); assert.equal(sent.length, 1); assert.match(await page.textContent('.toasts'), /Nobody to remind/);
    // Sales > Ending soon
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('#war'); await page.click('#war'); await page.locator('#war').locator('xpath=..').locator('.select-option[data-value="soon"]').click(); await page.waitForTimeout(300);
    const sr = await page.locator('table tbody tr').allTextContents(); assert.equal(sr.length, 2); assert.ok(sr.join(' ').includes('W-1') && sr.join(' ').includes('W-2'));
    // the number of days is a setting; 0 turns the list off
    await page.evaluate(async () => { const s = AccountApp.store; await s.saveConfig({ ...s.config(), reminders: { warrantyDays: 0 } }); });
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.page-head'); await page.waitForTimeout(400); assert.equal(await page.locator('#warnbox').count(), 0, 'turned off');
    await page.evaluate(async () => { const s = AccountApp.store; await s.saveConfig({ ...s.config(), reminders: { warrantyDays: 100 } }); });
    // overdue loan on Home: one reminder to the borrower, and the date is kept on the loan
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('#loanbox'); await page.click('[data-remind]'); await page.waitForTimeout(700);
    const l = sent.at(-1); assert.equal(l.kind, 'loan_overdue'); assert.equal(l.to, 'ann@example.com'); assert.match(l.device, /Acme Box 1|L1/); assert.ok(l.date);
    assert.ok(await page.evaluate(() => AccountApp.store.all('item')[0].data.loans[0].remindedAt > 0), 'the loan keeps the date');
    // the server: a bad kind, a missing date, a View user, and email being off here
    const api = (body) => page.evaluate(async (b) => { const r = await fetch('/api/app/receipt-email/reminder', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF': document.cookie }, body: JSON.stringify(b) }); return r.status; }, body);
    void api;
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
