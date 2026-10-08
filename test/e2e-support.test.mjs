// TEST / e2e-support — Support in a real browser at phone and laptop width: the reseller opens and follows a ticket (account menu, badge, screenshot, diagnostics),
// the Host works it (list, filters, header, requester panel, replies, internal note, canned reply, account tabs, settings, Overview), nothing scrolls sideways and taps are 44px.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, Client, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', SHOTS = process.env.SHOT_DIR || '';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// every visible control is at least 44px tall on a phone
const smallTaps = (page) => page.evaluate(() => [...document.querySelectorAll('.main .btn, .main .select-btn, .main input:not([type=file]):not([type=checkbox]), .main textarea, .main .seg button, .main tr.click, .menu-item, .sheet .btn, .sheet input, .sheet textarea')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(e => `${e.tagName}.${e.className}#${e.id}:${Math.round(e.getBoundingClientRect().height)}`));

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: Support, reseller and Host, at ${w}px (${label})`, { skip, timeout: 280000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
    const rctx = await br.newContext({ viewport: { width: w, height: h } }), hctx = await br.newContext({ viewport: { width: w, height: h } }), rp = await rctx.newPage(), hp = await hctx.newPage(), errors = [];
    for (const p of [rp, hp]) { p.setDefaultTimeout(30000); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/401|403|404|status of 4/.test(m.text())) errors.push(m.text()); }); }
    const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `support-${name}-${w}.png`), fullPage: true }); };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-shot-')), png = path.join(tmp, 'screen.png'); fs.writeFileSync(png, PNG);
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });

      // ---- the reseller signs up and signs in (first sign-in sets up encryption)
      await rp.goto(srv.base + '/app/'); await rp.click('[data-mode=signup]');
      await rp.fill('#bn', 'Support Co'); await rp.fill('#em', 's@example.com'); await rp.fill('#un', 'sandy'); await rp.fill('#pw', PW); await rp.check('#tc'); await rp.click('button.block');
      await rp.waitForSelector('#go'); const login = 'sandy@' + (await rp.textContent('.codeblock')).trim(); await rp.click('#go');
      await fillLogin(rp, login); await rp.fill('#p', PW); await rp.click('button.block');
      await rp.waitForSelector('.recovery-key'); await rp.check('#ok'); await rp.click('#go'); await rp.waitForSelector('.menu-btn');

      // ---- Support is in the account menu
      await rp.click('.menu-btn'); await rp.waitForSelector('.menu-pop'); await rp.waitForTimeout(350);
      assert.deepEqual(await rp.locator('.menu-item').allTextContents(), ['Support', 'Sign out']); if (w <= 640) assert.deepEqual(await smallTaps(rp), []);
      await rp.click('.menu-item >> text=Support'); await rp.waitForSelector('h1:has-text("Support")');
      assert.match(await rp.textContent('.banner.blue'), /Don’t paste customer details, passwords or your recovery key/); assert.match(await rp.textContent('.empty'), /No tickets yet/);
      assert.ok(await overflow(rp) <= 0, 'list fits'); await shot(rp, 'reseller-empty');

      // ---- a new ticket: category, subject, message, a screenshot, diagnostics
      await rp.click('text=New ticket >> nth=0'); await rp.waitForSelector('#ts');
      assert.match(await rp.textContent('.main'), /Tickets can be read by the myBoxStock team\. Don’t paste customer details, passwords or your recovery key\. Closed tickets are kept until the owner of this site removes them\./);
      await rp.click('#tc'); assert.deepEqual(await rp.locator('.select.open .select-option').allTextContents(), ['Question', 'Problem', 'Billing', 'Backup and restore', 'Account']); await rp.click('.select.open .select-option >> text=Problem');
      await rp.fill('#ts', 'The scanner will not focus'); await rp.fill('#tm', 'It stays blurry on my phone.\nLine two <b>not bold</b>.');
      await rp.click('[data-add]'); await rp.setInputFiles('[data-file]', png); await rp.waitForSelector('#pk .attached .chip'); assert.match(await rp.textContent('#pk'), /screen\.png/);
      await rp.setInputFiles('[data-file]', { name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') }); await rp.waitForSelector('.toast.err'); assert.match(await rp.textContent('.toast.err'), /PNG or JPG/);
      await rp.click('[data-dg]'); await rp.waitForSelector('[data-dgtext]:not(:empty)'); const dg = await rp.textContent('[data-dgtext]'); assert.match(dg, /myBoxStock diagnostics/); assert.doesNotMatch(dg, /Support Co/, 'no business name'); assert.equal(await rp.textContent('[data-dg]'), 'Remove diagnostics');
      assert.ok(await overflow(rp) <= 0, 'form fits'); if (w <= 640) assert.deepEqual(await smallTaps(rp), []); await shot(rp, 'reseller-form');
      await rp.click('#go'); await rp.waitForSelector('h1:has-text("T-1001")');
      assert.match(await rp.textContent('.thread'), /The scanner|It stays blurry/); assert.equal(await rp.locator('.thread .msg-body b').count(), 0, 'text is escaped');
      assert.equal(await rp.locator('.thread img.shot').count(), 1); assert.equal(await rp.locator('.thread details summary').textContent(), 'Diagnostics attached');
      assert.ok(await rp.evaluate(() => document.querySelector('img.shot').complete && document.querySelector('img.shot').naturalWidth === 1), 'the screenshot loads from the server');
      assert.match(await rp.textContent('.card'), /Open/); assert.ok(await overflow(rp) <= 0, 'ticket fits'); if (w <= 640) assert.deepEqual(await smallTaps(rp), []); await shot(rp, 'reseller-ticket');

      // ---- the Host signs in and works the ticket
      await hp.goto(srv.base + '/host/'); await hp.waitForSelector('input'); const ins = await hp.$$('input'); await ins[0].fill('admin'); await ins[1].fill(PW); await hp.keyboard.press('Enter'); await hp.waitForSelector('.main');
      await hp.goto(srv.base + '/host/#/overview'); await hp.waitForSelector('.card:has-text("Support")');
      assert.match(await hp.textContent('.main'), /1 open/); assert.match(await hp.textContent('.main'), /1 waiting on Host/); assert.match(await hp.textContent('.main'), /0 overdue/); assert.match(await hp.textContent('.main'), /1 unassigned/);
      assert.ok(await overflow(hp) <= 0, 'overview fits'); await shot(hp, 'host-overview');
      await hp.goto(srv.base + '/host/#/support'); await hp.waitForSelector('#tbl tr.click'); assert.equal(await hp.locator('#tbl tr.click').count(), 1);
      const row = await hp.textContent('#tbl tr.click'); assert.match(row, /T-1001/); assert.match(row, /The scanner will not focus/); assert.match(row, /Support Co/); assert.match(row, /Open/); assert.match(row, /Normal/); assert.match(row, /Unassigned/);
      assert.ok(await overflow(hp) <= 0, 'list fits'); if (w <= 640) assert.deepEqual(await smallTaps(hp), []); await shot(hp, 'host-list');
      // filters: status, priority, category, assignee, search
      await hp.click('#fs'); await hp.click('.select.open .select-option >> text=Resolved'); await hp.waitForSelector('#tbl .empty'); await hp.click('#fs'); await hp.click('.select.open .select-option >> text=All tickets'); await hp.waitForSelector('#tbl tr.click');
      await hp.click('#fp'); await hp.click('.select.open .select-option >> text=Urgent'); await hp.waitForSelector('#tbl .empty'); await hp.click('#fp'); await hp.click('.select.open .select-option >> text=Any priority'); await hp.waitForSelector('#tbl tr.click');
      await hp.fill('#q', 'nothing like this'); await hp.waitForSelector('#tbl .empty'); await hp.fill('#q', 'blurry'); await hp.waitForSelector('#tbl tr.click');
      await hp.click('#tbl tr.click'); await hp.waitForSelector('h1:has-text("T-1001")');
      const panel = await hp.textContent('.support-col:last-child'); assert.match(panel, /Support Co/); assert.match(panel, /sandy/); assert.match(panel, /Administrator/); assert.match(panel, /s@example\.com/); assert.match(panel, /Trial/); assert.match(panel, /Chrome|Browser/); assert.match(panel, /App version/); assert.match(panel, /None\. This is their first ticket\./);
      const head = await hp.textContent('.card >> nth=0'); for (const t of ['T-1001', 'Open', 'Normal', 'Problem', 'Created', 'Last activity', 'Time waiting', 'Assigned to']) assert.ok(head.includes(t), `header shows ${t}`);
      assert.equal(await hp.locator('.thread img.shot').count(), 1); assert.ok(await overflow(hp) <= 0, 'ticket fits'); if (w <= 640) assert.deepEqual(await smallTaps(hp), []); await shot(hp, 'host-ticket');
      // priority and assignment save on change
      await hp.click('#pr'); await hp.click('.select.open .select-option >> text=High'); await hp.waitForSelector('.toast:has-text("Saved")'); await hp.waitForSelector('.chip:has-text("High")');
      await hp.click('#as'); await hp.click('.select.open .select-option >> text=admin'); await hp.waitForSelector('.toast:has-text("Saved")'); await hp.waitForSelector('.thread .msg.system:has-text("Assigned to admin")');
      // an internal note
      await hp.click('#mode [data-m=note]'); assert.equal(await hp.isHidden('#cn'), true, 'no canned replies for notes'); await hp.fill('#rb', 'HOST-ONLY: trial customer, check the camera permission.'); await hp.click('#send'); await hp.waitForSelector('.msg.note:has-text("HOST-ONLY")');
      assert.match(await hp.textContent('.msg.note'), /hidden from the reseller/);
      // a reply from a canned reply, with the standard Email sentence because Email is not set up
      assert.match(await hp.textContent('#rh'), /Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway\./);
      await hp.click('#cr'); await hp.click('.select.open .select-option >> text=Looking into it'); assert.match(await hp.inputValue('#rb'), /We are looking into this/); await hp.fill('#rb', 'We are looking into this. Please check Settings, Camera, for this site.');
      await hp.click('#send'); await hp.waitForSelector('.msg.team:has-text("Please check Settings")'); await hp.waitForSelector('.toast:has-text("Emails and alerts only work after the Email section")');
      assert.match(await hp.textContent('.card >> nth=0'), /Waiting on reseller/); await shot(hp, 'host-ticket-replied');

      // ---- back to the reseller: a red number on the menu, the reply, no internal note
      await rp.goto(srv.base + '/app/#/support'); await rp.waitForSelector('tr.click'); await rp.waitForSelector('.menu-btn .chip.red');
      assert.equal((await rp.textContent('.menu-btn .chip.red')).trim(), '1'); assert.match(await rp.textContent('tr.click'), /New reply/); assert.match(await rp.textContent('tr.click'), /Waiting on you/);
      assert.ok(await overflow(rp) <= 0); await shot(rp, 'reseller-list-badge');
      await rp.click('.menu-btn'); await rp.waitForSelector('.menu-pop'); assert.equal((await rp.textContent('.menu-item >> text=Support')).trim(), 'Support1'); await rp.keyboard.press('Escape');
      await rp.click('tr.click'); await rp.waitForSelector('.msg.team'); const thread = await rp.textContent('.thread');
      assert.match(thread, /Please check Settings/); assert.match(thread, /myBoxStock support/); assert.doesNotMatch(thread, /HOST-ONLY/); assert.doesNotMatch(await rp.textContent('body'), /HOST-ONLY|Assigned to|High/);
      await rp.waitForFunction(() => !document.querySelector('.menu-btn .chip.red')); await shot(rp, 'reseller-reply');
      await rp.fill('#rm', 'Thanks, that fixed it!'); await rp.click('#go'); await rp.waitForSelector('.msg >> text=Thanks, that fixed it!'); assert.ok(await overflow(rp) <= 0);

      // ---- Host: the account has a Tickets tab and a Host notes tab; then settings
      await hp.goto(srv.base + '/host/#/accounts'); await hp.waitForSelector('#tbl tr.click'); await hp.click('#tbl tr.click'); await hp.waitForSelector('#atabs');
      assert.deepEqual(await hp.locator('#atabs button').allTextContents(), ['Account', 'Tickets (1)', 'Host notes']);
      await hp.click('#atabs [data-p=tickets]'); assert.match(await hp.textContent('[data-pane=tickets]'), /T-1001/); assert.equal(await hp.isHidden('[data-pane=account]'), true);
      await hp.click('#atabs [data-p=notes]'); await hp.fill('#hn', 'Prefers phone calls.'); await hp.click('#hns'); await hp.waitForSelector('.toast:has-text("Notes saved")');
      assert.ok(await overflow(hp) <= 0); if (w <= 640) assert.deepEqual(await smallTaps(hp), []); await shot(hp, 'host-account-notes');
      await hp.keyboard.press('Escape'); await hp.goto(srv.base + '/host/#/support'); await hp.waitForSelector('#tbl tr.click'); await hp.click('#tbl tr.click'); await hp.waitForSelector('h1:has-text("T-1001")');
      assert.match(await hp.textContent('.support-col:last-child'), /Prefers phone calls\./); assert.match(await hp.textContent('.card >> nth=0'), /Open|Waiting/);
      await hp.click('a:has-text("Open the account")'); await hp.waitForSelector('#atabs'); await hp.keyboard.press('Escape');

      await hp.goto(srv.base + '/host/#/support/settings'); await hp.waitForSelector('#save');
      assert.match(await hp.textContent('.banner:has-text("Email is not set up")'), /Emails and alerts only work after the Email section is set up/); assert.equal(await hp.inputValue('#rd'), '2'); assert.equal(await hp.inputValue('#ac'), '7');
      await hp.fill('#cats', 'Question\nProblem\nHardware'); await hp.click('#addc'); await hp.fill('#cn3', 'Thanks'); await hp.fill('#cb3', 'Thank you for your patience.'); await hp.fill('#mf', '2'); await hp.click('#save'); await hp.waitForSelector('.toast:has-text("Support settings saved")');
      await hp.waitForSelector('#cats'); assert.equal(await hp.inputValue('#cats'), 'Question\nProblem\nHardware'); assert.equal(await hp.inputValue('#mf'), '2');
      assert.ok(await overflow(hp) <= 0, 'settings fit'); if (w <= 640) assert.deepEqual(await smallTaps(hp), []); await shot(hp, 'host-settings');
      await hp.click('#purge'); await hp.waitForSelector('#tc'); assert.equal(await hp.isDisabled('#ok'), true); await hp.fill('#tc', 'purge'); assert.equal(await hp.isDisabled('#ok'), true); await hp.fill('#tc', 'PURGE'); assert.equal(await hp.isDisabled('#ok'), false);
      await hp.waitForTimeout(450); if (w <= 640) assert.deepEqual(await smallTaps(hp), []); await shot(hp, 'host-purge'); await hp.keyboard.press('Escape');
      assert.match(await hp.textContent('.side, .tabbar'), /Support/);

      // the reseller form follows the Host's new categories and screenshot limit
      await rp.goto(srv.base + '/app/#/support/new'); await rp.waitForSelector('#tc'); await rp.click('#tc'); assert.deepEqual(await rp.locator('.select.open .select-option').allTextContents(), ['Question', 'Problem', 'Hardware']); await rp.keyboard.press('Escape');
      assert.match(await rp.textContent('#pk'), /2 at most/);
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); fs.rmSync(tmp, { recursive: true, force: true }); }
  });
}
