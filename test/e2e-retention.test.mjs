// TEST / e2e-retention — Host > Data and retention in a real browser at phone and laptop width: the page lays out cleanly, a rule can be changed, Prune now shows a
// preview and needs the typed word, Compact database shows the progress strip.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', DAY = 86400e3, SHOTS = process.env.SHOT_DIR || '';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: Data and retention lays out cleanly and works at ${w}px (${label})`, { skip, timeout: 150000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|status of 40\d/.test(m.text())) errors.push(m.text()); });
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000');
      const ins = d.prepare('INSERT INTO event_log (id, ts, level, area, event, actor, message, raw) VALUES (?,?,?,?,?,?,?,?)'); d.exec('BEGIN'); for (let i = 0; i < 300; i++) ins.run('seedrow' + i, Date.now() - (200 + i) * DAY, 'info', 'mail', 'sent', null, 'old row ' + 'x'.repeat(1500), 'r'); d.exec('COMMIT');
      await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
      const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
      await page.goto(srv.base + '/host/#/retention'); await page.waitForSelector('[data-kind=logs]');
      const t = await page.textContent('.main'); for (const s of ['Data and retention', 'Database', 'Log files', 'Backup files', 'Ticket screenshots', 'Temporary files', 'Free disk space', 'Biggest tables', 'Retention rules', 'Activity log', 'Audit trail', 'Forever', 'Closed support tickets', 'Kept until purged', 'Mail history', 'Compact the database', 'Automatic pruning']) assert.ok(t.includes(s), 'shows ' + s);
      assert.equal(await page.locator('[data-change]').count(), 5); assert.equal(await page.locator('[data-prune]').count(), 5); assert.ok(await page.locator('a[href="#/backups"]').count() >= 1);
      assert.ok(await overflow(page) <= 0, 'no sideways scrolling');
      const gaps = await page.evaluate(() => { const cs = [...document.querySelectorAll('.main .card')].map(e => e.getBoundingClientRect()); const out = []; for (const a of cs) for (const b of cs) if (a !== b && b.top >= a.bottom - 0.5 && b.top - a.bottom < 8 && b.left < a.right && b.right > a.left) out.push([a.bottom, b.top]); return out; });
      assert.deepEqual(gaps, [], 'cards have a gap between them');
      if (w < 700) { const small = await page.evaluate(() => [...document.querySelectorAll('.main button.btn, .main a.btn, .main .switch')].filter(b => b.offsetHeight < 44).map(b => b.outerHTML.slice(0, 80))); assert.deepEqual(small, [], 'taps are at least 44px'); }
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `retention-${w}.png`), fullPage: true });
      if (w < 700) { await page.click('.tabbar [data-more], .tabbar button:last-child'); await page.waitForSelector('.sheet'); assert.ok((await page.textContent('.sheet')).includes('Data and retention'), 'in the More sheet'); await page.keyboard.press('Escape'); }
      else assert.ok((await page.textContent('nav.side')).includes('Data and retention'));

      // a rule below the floor is refused with the reason; a valid one saves
      await page.click('[data-change=audit]'); await page.waitForSelector('.sheet #rd'); await page.fill('.sheet #rd', '100'); await page.click('.sheet #ok');
      await page.waitForSelector('.toast'); assert.match(await page.textContent('.toast'), /at least 365 days/); await page.fill('.sheet #rd', '500'); await page.click('.sheet #ok'); await page.waitForSelector('[data-kind=audit] [data-val]:has-text("500 days")');
      // Prune now: preview, typed confirmation
      await page.click('[data-prune=logs]'); await page.waitForSelector('.sheet #pv:has-text("This would remove")');
      assert.match(await page.textContent('.sheet #pv'), /This would remove 300 activity-log rows, about .* the oldest from/); assert.equal(await page.locator('.sheet #ok').isDisabled(), true);
      assert.ok(await overflow(page) <= 0); await page.fill('.sheet #tc', 'PRUNE'); assert.equal(await page.locator('.sheet #ok').isDisabled(), false); await page.click('.sheet #ok');
      await page.waitForSelector('.toast:has-text("Removed 300")'); await page.waitForSelector('[data-kind=logs]');
      assert.equal(d.prepare("SELECT COUNT(*) n FROM event_log WHERE id LIKE 'seedrow%'").get().n, 0);
      // Compact: the progress strip appears, then the result
      await page.click('#compact'); await page.click('.sheet #ok'); await page.waitForSelector('#job-strip :is(#job-card, #job-done)');
      await page.waitForSelector('#job-done, .toast:has-text("Compacted")'); assert.ok(await overflow(page) <= 0);
      assert.deepEqual(errors, []); d.close();
    } finally { await br.close(); srv.stop(); }
  });
}
