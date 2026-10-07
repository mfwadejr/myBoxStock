// TEST / e2e-backup-jobs-ui — long jobs in a real browser at phone and laptop width: the status strip shows the running job with its step and bar,
// survives a reload, refuses a second job with a clear message, then shows the result (open it, dismiss it). No sideways scrolling, 44px taps.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', PASS = 'a long backup passphrase', SHOTS = process.env.SHOT_DIR || '';
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: a full-site backup runs as a background job at ${w}px (${label})`, { skip, timeout: 170000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401|409/.test(m.text())) errors.push(m.text()); });
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Job Boxes', email: 'j@example.com', username: 'joe', password: PW });
      await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      await c.req('PUT', '/api/host/backups/full', { enabled: false, passphrase: PASS, keepDaily: 14, keepWeekly: 8 });
      const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout=5000'); const acc = d.prepare('SELECT id FROM accounts').get().id;
      for (let i = 0; i < 150; i++) d.prepare('INSERT INTO records (id, account_id, type, blob, rev, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(), acc, 'item', crypto.randomBytes(1 << 20), 1, Date.now(), Date.now()); d.close();
      await page.goto(srv.base + '/host/'); await page.waitForSelector('input'); const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(PW); await page.keyboard.press('Enter'); await page.waitForSelector('.main');
      await page.goto(srv.base + '/host/#/backups'); await page.waitForSelector('#tabs'); await page.click('#tabs [data-t="full"]'); await page.waitForSelector('#pane #now');
      assert.equal(await page.locator('#job-strip *').count(), 0, 'nothing in the strip while nothing runs');

      await page.click('#pane #now');
      await page.waitForSelector('#job-card'); const card = await page.textContent('#job-card'); assert.match(card, /Full-site backup/); assert.match(card, /Running/); assert.match(card, /Only one backup job runs at a time/);
      assert.equal(await page.getAttribute('#job-card [role=progressbar]', 'aria-valuenow') !== null, true);
      assert.ok(await overflow(page) <= 0, 'no sideways scrolling while a job shows');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `backups-job-running-${w}.png`) });

      // a second job is refused with a plain message
      assert.equal((await c.req('POST', '/api/host/backups/jobs', { kind: 'bundle', passphrase: PASS })).data.code, 'HOST_JOB_RUNNING');
      await page.click('#pane #hand'); await page.waitForSelector('.sheet #pp'); await page.fill('.sheet #pp', PASS); await page.click('.sheet #go');
      await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /Another backup job is already running/.test(t.textContent))); await page.waitForSelector('.sheet');
      await page.click('.sheet [data-cancel]');

      // the page survives a reload and still shows the job (or, if it was quick, its result)
      await page.reload(); await page.waitForSelector('#tabs'); await page.waitForSelector('#job-card, #job-done');
      await page.waitForSelector('#job-done', { timeout: 120000 });
      const done = await page.textContent('#job-done'); assert.match(done, /finished/); assert.match(done, /made and verified/);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `backups-job-done-${w}.png`) });
      if (w <= 640) { const small = await page.evaluate(() => [...document.querySelectorAll('#job-strip .btn')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim())); assert.deepEqual(small, [], 'strip buttons are at least 44px tall'); }
      // the file list got the new file, without a reload (the page opens on its first tab after a reload, so go back to the Full-site tab)
      await page.click('#tabs [data-t="full"]');
      await page.waitForFunction(() => /myboxstock-fullsite/.test(document.querySelector('#list')?.textContent || ''));

      // a Test restore started from a row: progress in the sheet; closing the sheet leaves the job in the strip, and its result opens from there
      await page.click('#job-dismiss'); await page.waitForSelector('#job-done', { state: 'detached' });
      await page.locator('#list [data-test]').first().click(); await page.waitForSelector('.sheet #go'); await page.fill('.sheet #pp', PASS); await page.click('.sheet #go');
      await page.waitForSelector('.sheet .meter'); await page.click('.sheet [data-cancel]');
      await page.waitForSelector('#job-done', { timeout: 60000 }); assert.match(await page.textContent('#job-done'), /Test restore of myboxstock-fullsite/);
      await page.click('#job-view'); await page.waitForSelector('.sheet'); assert.match(await page.textContent('.sheet'), /passed|The passphrase opens the backup/);
      await page.click('.sheet [data-cancel]'); await page.click('#job-dismiss'); await page.waitForSelector('#job-done', { state: 'detached' });
      assert.ok(await overflow(page) <= 0, 'no sideways scrolling at the end');
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); }
  });
}
