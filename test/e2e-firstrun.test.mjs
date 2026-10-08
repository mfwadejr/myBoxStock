// TEST / e2e-firstrun — a real browser: the first-run checklist on reseller Home (step states, ticking as work is done, Dismiss, Administrators only, phone layout)
// and the Host disaster-recovery page's printable checklist.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : (process.env.DB_CLIENT || 'sqlite') !== 'sqlite' ? 'SQLite only' : false;
const PW = 'Sup3rSecretPass!', TEMP = 'Temp-pass-12345', SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mbs-firstrun-shots');

async function setup(width = 1280, height = 800) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const ctx = await br.newContext({ viewport: { width, height } }), page = await ctx.newPage(), errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
  await page.fill('#bn', 'Test Co'); await page.fill('#em', 't@example.com'); await page.fill('#un', 'tess'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(), login = 'tess@' + id; await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
  await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
  return { srv, br, ctx, page, id, errors, writes };
}
const states = (page) => page.$$eval('#frc .setting', rows => Object.fromEntries(rows.map(r => [r.dataset.step, r.dataset.done === '1'])));
const home = async (page, srv) => { await page.evaluate(() => { if (location.hash === '#/home') AccountApp.route(); else location.hash = '#/home'; }); await page.waitForSelector('.stat-grid'); await page.waitForTimeout(600); };
const reload = async (page) => { await page.reload(); await page.waitForSelector('#pw'); await page.fill('#pw', PW); await page.click('button.block'); await page.waitForSelector('.side', { state: 'attached' }); await page.waitForSelector('.stat-grid'); await page.waitForTimeout(600); };
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('browser: first-run checklist (states, ticking, Dismiss, role visibility, phone)', { skip, timeout: 300000 }, async () => {
  const { srv, br, page, id, errors, writes } = await setup();
  try {
    // 1. a brand-new account: only the recovery key is done
    await home(page, srv);
    assert.equal(await page.locator('#frc').count(), 1);
    assert.equal(await page.textContent('#frc h3'), 'Get set up');
    assert.deepEqual(await states(page), { device: false, payments: false, sale: false, team: false, backup: false, tested: false, recovery: true });
    assert.match(await page.textContent('#frp'), /1 of 7 done/);
    assert.equal(await page.locator('#frc [data-step=team] .chip').textContent(), 'Optional');
    assert.equal(await page.locator('#frc [data-step=device] .chip').textContent(), 'To do');
    assert.equal(await page.locator('#frc [data-step=recovery] .chip').textContent(), 'Done');
    assert.equal(await page.locator('#frc [data-step=recovery] a').count(), 0, 'a finished step has no button');
    assert.equal(await page.locator('#frc [data-step=device] a').getAttribute('href'), '#/inventory');
    assert.ok(await page.evaluate(() => document.querySelector('#frc').previousElementSibling.classList.contains('page-head')), 'sits at the top of Home, under the heading');
    assert.ok(await page.evaluate(() => document.querySelector('#frc').classList.contains('mb-lg')), 'cards never touch');
    await page.screenshot({ path: path.join(SHOTS, 'firstrun-1280.png'), fullPage: true });

    // 2. work gets done, steps tick (all worked out from the account's own data in the browser)
    await page.evaluate(async () => { await AccountApp.store.commit({ puts: [{ type: 'item', data: { uid: 'SN-1', serial: 'SN-1', make: 'Roku', model: 'Ultra', status: 'available', cost: 2000, price: 5000, addedAt: Date.now() } }] }); });
    await home(page, srv); assert.equal((await states(page)).device, true); assert.equal((await states(page)).payments, false);
    await page.evaluate(async () => { const c = AccountApp.store.config(); c.payments.methods.push({ key: 'zelle', label: 'Zelle' }); await AccountApp.store.saveConfig(c); });
    await home(page, srv); assert.equal((await states(page)).payments, true);
    await page.evaluate(async () => { await AccountApp.api('POST', '/users', { username: 'stan', email: '', role: 'Standard', password: 'Temp-pass-12345', keys: await Vault.keysFor('Temp-pass-12345', AccountApp.vault.adk) }); });
    await home(page, srv); assert.equal((await states(page)).team, true);
    await page.evaluate(async () => { const f = await AccountApp.backupEngine.makeFile(); await AccountApp.backupEngine.markMade(f.counts); window.__file = f.text; });
    await home(page, srv); assert.equal((await states(page)).backup, true); assert.equal((await states(page)).tested, false);
    assert.match(await page.textContent('#frp'), /5 of 7 done/);

    // 3. Test a backup file ticks its step, and it is the only thing that does (a failed file does not)
    const good = await page.evaluate(() => window.__file); void good;
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#tk');
    await page.setInputFiles('#tf', { name: 'bad.mbsbackup', mimeType: 'application/octet-stream', buffer: Buffer.from('not a backup') });
    await page.waitForSelector('.sheet'); await page.click('.sheet [data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' });
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), `mbs.fr.tested.${await page.evaluate(() => AccountApp.me.accountCode)}`), null);
    const file = await page.evaluate(async () => (await AccountApp.backupEngine.makeFile()).text);
    writes.length = 0;
    await page.setInputFiles('#tf', { name: 'b.mbsbackup', mimeType: 'application/octet-stream', buffer: Buffer.from(file) }); await page.waitForSelector('.sheet #sm'); assert.match(await page.textContent('#sm'), /passed every check/);
    await page.click('.sheet [data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' });
    assert.deepEqual(writes, [], 'testing still sends nothing');
    await home(page, srv); assert.equal((await states(page)).tested, true); assert.match(await page.textContent('#frp'), /6 of 7 done/);

    // 4. Dismiss: gone now, gone after a reload, remembered by the account, and logged without business data
    writes.length = 0; await page.click('#frx'); await page.waitForSelector('#frc', { state: 'detached' });
    await page.waitForTimeout(500); assert.ok(writes.includes('POST /api/app/account/firstrun-note'), writes.join());
    await reload(page); assert.equal(await page.locator('#frc').count(), 0);
    assert.equal(await page.evaluate(() => AccountApp.store.config().firstRun.dismissed), true);
    const r = await page.evaluate(async () => { try { await AccountApp.api('POST', '/account/firstrun-note', { event: 'nonsense' }); return 'ok'; } catch (e) { return e.message; } });
    assert.match(r, /not recognised/);

    // 5. a Standard user never sees it (and the server refuses the note)
    await page.evaluate(async () => { const c = AccountApp.store.config(); c.firstRun.dismissed = false; await AccountApp.store.saveConfig(c); });
    await home(page, srv); assert.equal(await page.locator('#frc').count(), 1, 'an Administrator sees it again when it is not dismissed');
    const o = await (await br.newContext()).newPage(); await o.goto(srv.base + '/app/'); await fillLogin(o, 'stan@' + id); await o.fill('#p', TEMP); await o.click('button.block');
    await o.waitForSelector('#a'); await o.fill('#a', TEMP); await o.fill('#b', 'Brand-new-pass-678'); await o.click('button.block'); await o.waitForSelector('.side');
    await o.goto(srv.base + '/app/#/home'); await o.waitForSelector('.stat-grid'); await o.waitForTimeout(600);
    assert.equal(await o.locator('#frc').count(), 0, 'Standard users do not see the checklist');
    assert.notEqual(await o.evaluate(async () => { try { await AccountApp.api('POST', '/account/firstrun-note', { event: 'dismissed' }); return 'ok'; } catch { return 'refused'; } }), 'ok');

    // 6. phone layout
    await page.setViewportSize({ width: 375, height: 800 }); await home(page, srv);
    assert.equal(await page.locator('#frc').count(), 1); assert.equal(await wide(page), 0, 'no sideways scroll');
    for (const sel of ['#frx', '#frc [data-step=sale] a']) assert.ok((await page.locator(sel).boundingBox()).height >= 44, `${sel} is at least 44px tall`);
    const gap = await page.evaluate(() => { const a = document.querySelector('#frc').getBoundingClientRect(), b = document.querySelector('.stat-grid').getBoundingClientRect(); return b.top - a.bottom; });
    assert.ok(gap > 0, 'the card does not touch the tiles');
    await page.screenshot({ path: path.join(SHOTS, 'firstrun-375.png'), fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});

test('browser: Host disaster-recovery page, links, and a printable one-page checklist (print styles only from the stylesheets)', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 375, height: 812 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('main');
    // linked from Backups (docs), Recovery and emergencies, Running the server and the Overview page
    for (const from of ['backups', 'recovery-and-emergencies', 'running-the-server', 'overview']) {
      await page.goto(`${srv.base}/host/#/docs/${from}`); await page.waitForSelector('.doc h1');
      assert.ok(await page.locator('.doc a[href="#/docs/disaster-recovery"]').count() >= 1, `${from} links to Disaster recovery`);
    }
    await page.goto(`${srv.base}/host/#/docs/disaster-recovery`); await page.waitForSelector('.doc-print');
    for (const slug of ['recovery-and-emergencies', 'backups', 'running-the-server']) assert.ok(await page.locator(`.doc a[href="#/docs/${slug}"]`).count() >= 1, `links to ${slug}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0, 'no sideways scroll at 375px');
    assert.ok((await page.locator('.doc-print button').boundingBox()).height >= 44);
    assert.equal(await page.locator('.doc-print h2').textContent(), 'Printable checklist');
    assert.equal(await page.locator('.doc-print li').count(), 10);
    // on paper: only the checklist shows
    await page.evaluate(() => document.documentElement.classList.add('printing-doc')); await page.emulateMedia({ media: 'print' });
    const shown = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some(e => e.getClientRects().length > 0), sel);
    assert.equal(await shown('.doc-print'), true); assert.equal(await shown('.doc-print li'), true);
    for (const sel of ['.topbar', '.side', '.doc-toc', '.doc-pager', '.doc > h1', '.doc > .lead', '.doc > h2', '.doc-print button']) assert.equal(await shown(sel), false, `${sel} is not printed`);
    await page.evaluate(() => document.documentElement.classList.remove('printing-doc')); await page.emulateMedia({ media: 'screen' });
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
