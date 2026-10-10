// TEST / t35-t41-live-ui — T36 the live Support list and quicker count, T41 the Overdue chip, in a real browser at phone and laptop width:
// a new ticket shows behind a "N new tickets, show" bar without moving the list, other changes swap in place keeping filters / search text / scroll / the ticket being read,
// the poll runs every 20 seconds, pauses while the tab is hidden and runs once when it returns, the menu count matches, Overdue filters the list, nothing scrolls sideways.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: live Support list, count and Overdue chip at ${w}px (${label})`, { skip, timeout: 240000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
    const ctx = await br.newContext({ viewport: { width: w, height: h } }), page = await ctx.newPage(), errors = [], summaries = [];
    page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|403|404|status of 4/.test(m.text())) errors.push(m.text()); });
    page.on('request', r => { if (r.url().endsWith('/api/host/support/summary')) summaries.push(Date.now()); });
    // The 20 second poll runs every 300 ms here so the test is quick; the delays asked for are recorded to prove the real value.
    await page.addInitScript(() => { const orig = window.setInterval; window.__ivs = []; window.setInterval = (f, ms, ...a) => { window.__ivs.push(ms); return orig(f, ms === 20000 ? 300 : ms, ...a); }; });
    try {
      const host = new Client(srv.base); await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await host.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      await host.req('PUT', '/api/host/support/settings', { perHour: 60, openCap: 100 });
      const rs = new Client(srv.base); await rs.req('POST', '/api/app/signup', { businessName: 'Live Co', email: 'live@example.com', username: 'liv', password: PW });
      const acc = (await host.req('GET', '/api/host/accounts')).data[0]; await rs.req('POST', '/api/app/login', { login: `liv@${acc.account_code}`, password: PW });
      const open = async (subject) => (await rs.req('POST', '/api/app/support/tickets', { category: 'Question', subject, message: 'A message for the live list.' })).data.ticket.number;
      const nums = []; for (let i = 1; i <= 24; i++) nums.push(await open(`Live ticket ${i}`));
      const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout = 5000');

      await page.goto(srv.base + '/host/'); await page.waitForSelector('input'); const ins = await page.$$('input'); await ins[0].fill('admin'); await ins[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
      assert.ok((await page.evaluate(() => window.__ivs)).includes(20000), 'the count is polled every 20 seconds (15 to 30 allowed)');
      await page.goto(srv.base + '/host/#/support'); await page.waitForSelector('#tbl tbody tr');
      const badge = () => page.evaluate(() => Number(document.querySelector('.side a[data-k=support] .nav-count')?.textContent || 0));
      const rowCount = () => page.locator('#tbl tbody tr').count();
      await page.waitForFunction(() => document.querySelector('.side a[data-k=support] .nav-count'));
      assert.equal(await badge(), 24, 'the menu count matches the tickets waiting on the Host');
      assert.ok(await overflow(page) <= 0, 'no sideways scroll');

      // ---- Overdue: zero state is neutral, then it follows the tickets
      const od = page.locator('#od'); assert.equal((await od.textContent()).trim(), '0 overdue'); assert.equal(await od.evaluate(e => e.classList.contains('red')), false, 'neutral at zero');
      assert.equal(await od.getAttribute('aria-pressed'), 'false');
      const old = Date.now() - 10 * 86400e3; db.prepare('UPDATE support_tickets SET created_at = ?, last_requester_at = ?, updated_at = ? WHERE number IN (?, ?)').run(old, old, old, nums[0], nums[1]);
      await page.waitForFunction(() => document.querySelector('#od')?.textContent.trim() === '2 overdue');   // arrives on its own, no reload
      assert.equal(await od.evaluate(e => e.classList.contains('red')), true, 'red when above zero');
      await page.waitForFunction(() => document.querySelectorAll('#tbl tbody tr .chip.red').length === 2);   // the rows follow the number a moment later
      assert.equal(await page.locator('#tbl tbody tr:has(.chip.red)').count(), 2, 'the list shows the same two with their Overdue chip');
      if (w <= 820) assert.ok((await od.boundingBox()).height >= 43.5, 'the chip button is a full tap target on phones');
      await od.click(); await page.waitForFunction(() => document.querySelectorAll('#tbl tbody tr').length === 2);
      assert.equal(await od.getAttribute('aria-pressed'), 'true'); assert.equal((await page.locator('#fs .select-label').textContent()).trim(), 'Overdue', 'the status filter shows Overdue');
      assert.equal(await page.locator('#tbl tbody tr:has-text("Overdue")').count(), 2);
      await od.click(); await page.waitForFunction(() => document.querySelectorAll('#tbl tbody tr').length === 24); assert.equal((await page.locator('#fs .select-label').textContent()).trim(), 'Active tickets');
      // a reply (by the Host, through the API) lowers it on the page
      await host.req('POST', `/api/host/support/tickets/${nums[0]}/reply`, { message: 'Sorry for the wait.' });
      await page.waitForFunction(() => document.querySelector('#od')?.textContent.trim() === '1 overdue'); assert.equal(await badge(), 23, 'and the menu count follows');

      // ---- filters, search text and scroll survive a live update; the update shows in place
      await page.fill('#q', 'Live ticket'); await page.waitForTimeout(900);   // the search runs after a short pause; let it finish
      await page.waitForFunction(() => document.querySelectorAll('#tbl tbody tr').length > 0); await page.evaluate(() => { window.__same = 'still here'; });
      await page.evaluate(() => window.scrollTo(0, 120)); const y0 = await page.evaluate(() => scrollY); assert.ok(y0 > 0, 'the page is scrolled');
      const before = await rowCount();
      await host.req('POST', `/api/host/support/tickets/${nums[5]}/reply`, { message: 'In place.', status: 'resolved' });
      await page.waitForFunction((n) => [...document.querySelectorAll('#tbl tbody tr')].some(r => r.textContent.includes(`T-${n}`) && r.textContent.includes('Resolved')) || !([...document.querySelectorAll('#tbl tbody tr')].some(r => r.textContent.includes(`T-${n}`))), nums[5]);
      assert.equal(await page.inputValue('#q'), 'Live ticket', 'the search text is kept'); assert.equal(await page.evaluate(() => window.__same), 'still here', 'the page was not reloaded');
      assert.ok(Math.abs((await page.evaluate(() => scrollY)) - y0) <= 2, 'the scroll position is kept'); assert.equal(await page.locator('#showlive').count(), 0, 'a change to an existing ticket needs no bar');
      assert.ok(await rowCount() <= before);

      // ---- a new ticket waits behind the bar and the list does not jump
      const rows = await rowCount(), firstText = await page.locator('#tbl tbody tr').first().textContent();
      const fresh = await open('Live ticket brand new');
      await page.waitForSelector('#showlive'); assert.match((await page.locator('#live').textContent()).trim(), /^1 new ticket\s*show$/);
      assert.equal(await rowCount(), rows, 'the list did not change'); assert.equal(await page.locator('#tbl tbody tr').first().textContent(), firstText, 'and did not jump');
      assert.ok(Math.abs((await page.evaluate(() => scrollY)) - y0) <= 2, 'scroll untouched by the bar');
      assert.equal(await page.inputValue('#q'), 'Live ticket');
      assert.equal(await page.locator('#live').getAttribute('aria-live'), 'polite', 'announced politely');
      await open('Live ticket again'); await page.waitForFunction(() => /^2 new tickets/.test(document.querySelector('#live').textContent.trim()), null, { timeout: 8000 });
      await page.click('#showlive'); await page.waitForFunction(() => !document.querySelector('#showlive'));
      assert.equal(await page.locator('#tbl tbody tr:has-text("Live ticket again")').count() > 0, true, 'the new tickets are in the list after Show');
      assert.equal(await page.locator('#tbl tbody tr:has-text("brand new")').count(), 1);
      const other = await open('Unrelated subject'); await page.waitForTimeout(900); assert.equal(await page.locator('#showlive').count(), 0, 'a ticket that does not match the search needs no bar'); void other;
      await page.fill('#q', ''); await page.waitForFunction(() => document.querySelectorAll('#tbl tbody tr').length > 24);
      assert.equal(await badge() > 23, true, 'the count includes them');
      assert.equal(await badge(), (await host.req('GET', '/api/host/support/summary')).data.awaitingHost, 'the menu count matches the summary');
      void fresh;

      // ---- the poll pauses while the tab is hidden and runs once when it returns
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(400); const mark = summaries.length; await page.waitForTimeout(1200);
      assert.equal(summaries.length, mark, 'no requests while hidden');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction((m) => true, mark); await page.waitForTimeout(150); assert.ok(summaries.length > mark, 'it runs when the tab returns');

      // ---- the ticket being read is not disturbed
      await page.goto(srv.base + `/host/#/support/${nums[2]}`); await page.waitForSelector('#rb'); await page.fill('#rb', 'A half-written reply');
      await open('While reading'); await page.waitForTimeout(1000);
      assert.equal(await page.inputValue('#rb'), 'A half-written reply', 'the draft stays'); assert.match(page.url(), new RegExp(`/support/${nums[2]}$`));
      assert.ok(await overflow(page) <= 0);
      assert.deepEqual(errors, []);
      db.close();
    } finally { await br.close(); srv.stop(); }
  });
}

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: the New-ticket notices settings and the Alerts line at ${w}px (${label})`, { skip, timeout: 120000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
    const page = await (await br.newContext({ viewport: { width: w, height: h } })).newPage(), errors = [];
    page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|403|404|status of 4/.test(m.text())) errors.push(m.text()); });
    try {
      const host = new Client(srv.base); await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await host.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      const rs = new Client(srv.base); await rs.req('POST', '/api/app/signup', { businessName: 'Notice Co', email: 'n@example.com', username: 'nora', password: PW });
      const acc = (await host.req('GET', '/api/host/accounts')).data[0]; await rs.req('POST', '/api/app/login', { login: `nora@${acc.account_code}`, password: PW });
      const t = (await rs.req('POST', '/api/app/support/tickets', { category: 'Problem', subject: 'Alert me', message: 'Please.' })).data.ticket.number;
      await page.goto(srv.base + '/host/'); await page.waitForSelector('input'); const ins = await page.$$('input'); await ins[0].fill('admin'); await ins[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');

      await page.goto(srv.base + '/host/#/alerts'); await page.waitForSelector('.log-line');
      const line = page.locator('.log-line', { hasText: 'Alert me' }); assert.match(await line.textContent(), new RegExp(`New ticket #${t} from Notice Co: Alert me \\(Normal priority\\)`)); assert.match(await line.locator('.chip').first().textContent(), /new ticket/);
      assert.equal(await line.locator(`a[href="#/support/${t}"]`).count(), 1, 'links to the ticket'); assert.ok(await overflow(page) <= 0);
      await page.click(`.log-line a[href="#/support/${t}"]`); await page.waitForSelector('#rb'); await page.goto(srv.base + '/host/#/alerts'); await page.waitForSelector('.empty, .log-line');
      assert.equal(await page.locator('.log-line', { hasText: 'Alert me' }).locator('[data-dismiss]').count(), 0, 'after opening the ticket the alert has moved to Recently cleared');

      await page.goto(srv.base + '/host/#/support/settings'); await page.waitForSelector('#savenote');
      assert.equal(await page.isChecked('#ni'), true); assert.equal(await page.isChecked('#ne'), false); assert.equal(await page.isDisabled('#ne'), true, 'email cannot be switched on before Email is set up'); assert.equal(await page.isDisabled('#rne'), true);
      assert.equal(await page.isChecked('#rni'), true); assert.equal(await page.isChecked('#nd'), false); assert.equal(await page.inputValue('#np'), '20');
      assert.equal((await page.locator('#nr .select-label').textContent()).trim(), 'All Host administrators'); assert.equal((await page.locator('#nt .select-label').textContent()).trim(), 'Every ticket');
      assert.equal(await page.isHidden('#nch'), true, 'the chosen list shows only when chosen');
      await page.click('#nr'); await page.click('#nr ~ .select-list [data-value=chosen]'); await page.waitForSelector('#nch', { state: 'visible' });
      assert.equal(await page.locator('#nch [data-ch]').count(), 1);
      await page.click('#savenote'); await page.waitForSelector('.toast.error, .toast', { timeout: 8000 });
      assert.match((await host.req('GET', '/api/host/support/settings')).data.settings.notifyRecipients, /all/, 'an empty chosen list is refused');
      await page.check('#nch [data-ch]', { force: true }).catch(async () => { await page.locator('#nch .switch').click(); });
      await page.click('#savenote'); await page.waitForFunction(() => true); await page.waitForTimeout(600);
      const saved = (await host.req('GET', '/api/host/support/settings')).data.settings; assert.equal(saved.notifyRecipients, 'chosen'); assert.equal(saved.notifyChosen.length, 1);
      assert.ok(await overflow(page) <= 0, 'no sideways scroll');
      if (w <= 820) { const small = await page.evaluate(() => [...document.querySelectorAll('#savenote, #nch .switch, .setting .switch')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 43.5; }).length); assert.equal(small, 0, 'taps are 44px'); }
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });
}
