// TEST / e2e-lists — long lists: feeds scroll in a capped box with Load more (not on phones); working lists page 25/50/100.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, fillLogin, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const SHOTS = process.env.SHOTS_DIR;   // set to also save screenshots
const relax = async (srv) => { const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW }); await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 }); };
const seedLog = (srv, n) => {
  const db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout=5000');
  const ins = db.prepare("INSERT INTO event_log (id, ts, level, area, event, actor, account_id, ip, message, raw) VALUES (?, ?, 'info', 'host', 'test.seed', 'admin', NULL, '203.0.113.9', ?, '{}')");
  const t = Date.now() - 60000; for (let i = 0; i < n; i++) ins.run('seed-' + String(i).padStart(4, '0'), t - i * 10, `Seeded entry ${i}`);
  db.close();
};
const rows = (page, sel) => page.locator(sel).count();

test('browser: Host feeds scroll in a capped box with Load more; phones have no cap', { skip, timeout: 170000 }, async () => {
  const srv = await startServer(); await relax(srv); seedLog(srv, 130);
  const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter');
    await page.waitForSelector('.side');
    for (const view of ['audit', 'logs']) {
      await page.goto(srv.base + '/host/#/' + view); await page.waitForSelector(view === 'audit' ? '#actor' : '#area'); await page.waitForSelector('.feed .log-line');
      const info = await page.evaluate(() => { const f = document.querySelector('.feed'), cs = getComputedStyle(f); return { max: cs.maxHeight, token: getComputedStyle(document.documentElement).getPropertyValue('--feed-max-h').trim(), oy: cs.overflowY, sh: f.scrollHeight, ch: f.clientHeight, h: f.getBoundingClientRect().height }; });
      assert.equal(info.max, info.token, `${view}: max-height comes from --feed-max-h`); assert.ok(info.oy === 'auto' && info.sh > info.ch, `${view}: the box scrolls inside`); assert.ok(info.h <= parseFloat(info.token) + 1, `${view}: the box is capped`);
      assert.ok(info.h < 800, `${view}: the box fits on a laptop screen`);
      await page.waitForSelector('.more-row [data-more]');
      if (SHOTS) { await page.waitForTimeout(700); await page.evaluate(() => scrollTo(0, 260)); await page.screenshot({ path: path.join(SHOTS, `feed-${view}-1280.png`) }); }
      const first = await rows(page, '.feed .log-line'); assert.equal(first, 100, `${view}: first chunk is 100 rows`);
      assert.match(await page.textContent('.more-row'), /Showing 100 of \d{3}/);
      assert.ok(await page.evaluate(() => { const q = document.querySelector('#q'), f = document.querySelector('.feed'); return q.getBoundingClientRect().bottom <= f.getBoundingClientRect().top; }), `${view}: the search box stays above the box`);
      await page.click('.more-row [data-more]'); await page.waitForFunction((n) => document.querySelectorAll('.feed .log-line').length > n, first);
      assert.match(await page.textContent('.more-row'), /Showing 1\d\d of \d{3}/); assert.ok(await rows(page, '.feed .log-line') > 100);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    for (const view of ['audit', 'logs']) {
      await page.goto(srv.base + '/host/#/' + view); await page.waitForSelector(view === 'audit' ? '#actor' : '#area'); await page.waitForSelector('.feed .log-line');
      const info = await page.evaluate(() => { const f = document.querySelector('.feed'), cs = getComputedStyle(f); return { max: cs.maxHeight, over: document.documentElement.scrollWidth - innerWidth, h: f.getBoundingClientRect().height }; });
      assert.equal(info.max, 'none', `${view}: no cap on phones`); assert.ok(info.h > 812, `${view}: the page scrolls, not the box`); assert.ok(info.over <= 1, `${view}: no sideways scrolling`);
      if (SHOTS && view === 'audit') { await page.waitForTimeout(700); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(SHOTS, 'feed-audit-375.png') }); }
    }
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});

test('browser: Inventory pages 25 / 25 / 10, the size select works, searching returns to page 1', { skip, timeout: 170000 }, async () => {
  const srv = await startServer(); await relax(srv);
  const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Pages Co'); await page.fill('#em', 'p@example.com'); await page.fill('#un', 'pat'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, 'pat@' + id); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.main');
    await page.evaluate(async () => { const S = AccountApp.store;
      await S.commit({ puts: Array.from({ length: 60 }, (_, i) => ({ type: 'item', data: { uid: 'Q-' + String(i + 1).padStart(3, '0'), make: 'Roku', model: 'Ultra', status: 'available', cost: 10000, price: 34000, addedAt: Date.now() + i } })) }); });
    await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('tr.click');
    const info = () => page.evaluate(() => ({ n: document.querySelectorAll('tr.click').length, text: document.querySelector('.pager')?.textContent.replace(/\s+/g, ' ') || '', feed: !!document.querySelector('.main .feed'), max: getComputedStyle(document.querySelector('.card .tablewrap')).maxHeight }));
    let i = await info(); assert.equal(i.n, 25); assert.match(i.text, /Showing 1–25 of 60/); assert.ok(!i.feed && i.max === 'none', 'a working list is never in a capped box');
    assert.ok(await page.locator('[data-prev]').isDisabled());
    if (SHOTS) { await page.waitForTimeout(700); await page.evaluate(() => document.querySelector('.pager').scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, 'inventory-page1-1280.png') }); }
    await page.click('[data-next]'); await page.waitForFunction(() => /Showing 26–50/.test(document.querySelector('.pager').textContent)); assert.equal((await info()).n, 25);
    await page.click('[data-next]'); await page.waitForFunction(() => /Showing 51–60 of 60/.test(document.querySelector('.pager').textContent)); assert.equal((await info()).n, 10);
    assert.ok(await page.locator('[data-next]').isDisabled());
    await page.fill('#q', 'Q-0'); await page.waitForFunction(() => /Showing 1–25 of 60/.test(document.querySelector('.pager').textContent)); assert.equal((await info()).n, 25, 'searching goes back to page 1');
    await page.click('[data-next]'); await page.waitForFunction(() => /Showing 26–50/.test(document.querySelector('.pager').textContent));
    await page.click('#pgsize'); await page.click('#pgsize + .select-list [data-value="50"]'); await page.waitForFunction(() => /Showing 1–50 of 60/.test(document.querySelector('.pager').textContent)); assert.equal((await info()).n, 50, 'size 50 shows 50 rows, from page 1');
    await page.fill('#q', 'Q-05'); await page.waitForFunction(() => document.querySelectorAll('tr.click').length === 10); assert.equal(await page.locator('.pager').isHidden(), true, 'no page controls when everything fits');
    await page.setViewportSize({ width: 375, height: 812 }); await page.fill('#q', ''); await page.waitForFunction(() => document.querySelectorAll('tr.click').length === 50);
    const phone = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('.pager .btn, .pager .select-btn')].filter(e => e.getBoundingClientRect().height < 43.5).length }));
    assert.ok(phone.over <= 1, 'no sideways scrolling on a phone'); assert.equal(phone.small, 0, 'page controls are at least 44px tall on a phone');
    if (SHOTS) { await page.waitForTimeout(700); await page.evaluate(() => document.querySelector('.pager').scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, 'inventory-pager-375.png') }); }
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
