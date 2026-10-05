// TEST / e2e-backup — a real browser: back up to a .mbsbackup file, check it is unreadable, restore (add what is missing, replace), see the preview and warning, undo, refuse wrong files, copy diagnostics.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mbs-backup-shots');
const NAMES = ['Zed Buyer', 'Amelia Quartz', 'SN-ALPHA-90210', 'SN-BRAVO-90211', 'SN-CHARLIE-90212', 'S-TEST-0001'];

test('browser: back up, restore (add missing and replace), preview, undo, refusals, diagnostics', { skip, timeout: 280000 }, async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] }), page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const counts = () => page.evaluate(() => { const S = AccountApp.store; return { d: S.all('item').length, c: S.all('customer').length, s: S.all('sale').length }; });
  const openRestore = async (buffer) => { await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#pk'); await page.setInputFiles('#fl', { name: 'b.mbsbackup', mimeType: 'application/octet-stream', buffer }); await page.waitForSelector('.compare'); };
  const nums = () => page.$$eval('.compare .tab-num', els => els.map(e => e.textContent.trim()));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Backup Co'); await page.fill('#em', 'b@example.com'); await page.fill('#un', 'bea'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const id = (await page.textContent('.codeblock')).trim(), login = 'bea@' + id; await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.evaluate(async () => {
      const S = AccountApp.store, mkItem = (uid) => ({ type: 'item', data: { uid, serial: uid, make: 'Roku', model: 'Ultra', status: 'available', cost: 2000, price: 5000, addedAt: Date.now() } });
      const [c1] = await S.commit({ puts: [{ type: 'customer', data: { name: 'Zed Buyer', phone: '555-0100', email: 'zed@example.com', createdAt: Date.now() } }, { type: 'customer', data: { name: 'Amelia Quartz', createdAt: Date.now() } }] });
      await S.commit({ puts: ['SN-ALPHA-90210', 'SN-BRAVO-90211', 'SN-CHARLIE-90212'].map(mkItem) });
      await S.commit({ puts: [{ type: 'sale', data: { no: 'S-TEST-0001', ts: Date.now(), customerId: c1, customerName: 'Zed Buyer', items: [{ make: 'Roku', model: 'Ultra', uid: 'SN-ALPHA-90210', price: 5000 }], subtotal: 5000, total: 5000, cost: 2000, payment: 'cash' } }] });
    });
    assert.deepEqual(await counts(), { d: 3, c: 2, s: 1 });

    // reminder on Home: no backup yet; closing it hides it until tomorrow
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('#bkb');
    assert.match(await page.textContent('#bkb'), /not made a backup yet/);
    await page.screenshot({ path: path.join(SHOTS, 'home-reminder-1280.png') });
    await page.click('#bkx'); await page.goto(srv.base + '/app/#/inventory'); await page.waitForSelector('.page-head'); await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.stat-grid'); await page.waitForTimeout(600); assert.equal(await page.locator('#bkb').count(), 0, 'dismissed until tomorrow');
    await page.evaluate(() => localStorage.removeItem('mbs.backupNudge'));

    // the backup file
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#mk'); assert.match(await page.textContent('#lb'), /No backup yet/);
    await page.screenshot({ path: path.join(SHOTS, 'backup-page-1280.png'), fullPage: true });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#mk')]);
    assert.match(dl.suggestedFilename(), new RegExp(`^myboxstock-backup-${id}-\\d{8}\\.mbsbackup$`));
    const file = fs.readFileSync(await dl.path()); const fileText = file.toString('utf8');
    for (const s of NAMES) assert.ok(!fileText.includes(s), `the file has no readable "${s}"`);
    assert.ok(!fileText.includes('zed@example.com') && !fileText.includes('Roku'));
    await page.waitForFunction(() => /Last backup today/.test(document.querySelector('#lb')?.textContent || ''));
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.stat-grid'); await page.waitForTimeout(500); assert.equal(await page.locator('#bkb').count(), 0, 'no reminder after a fresh backup');

    // change the account after the backup: remove a device and a customer, edit a device, add new ones
    await page.evaluate(async () => {
      const S = AccountApp.store, items = S.all('item'), bravo = items.find(e => e.data.uid === 'SN-BRAVO-90211'), charlie = items.find(e => e.data.uid === 'SN-CHARLIE-90212'), amelia = S.all('customer').find(e => e.data.name === 'Amelia Quartz');
      await S.commit({ puts: [{ type: 'item', id: charlie.id, data: { ...charlie.data, notes: 'EDITED-AFTER' } }, { type: 'item', data: { uid: 'NEW-AFTER-1', serial: 'NEW-AFTER-1', status: 'available', cost: 1, price: 2, addedAt: Date.now() } }, { type: 'customer', data: { name: 'Late Customer', createdAt: Date.now() } }], deletes: [{ type: 'item', id: bravo.id }, { type: 'customer', id: amelia.id }] });
    });
    assert.deepEqual(await counts(), { d: 3, c: 2, s: 1 });

    // restore: preview shows the file next to the account, with the newer-account warning; Add what is missing
    await openRestore(file);
    assert.deepEqual(await nums(), ['3', '3', '2', '2', '1', '1', await page.evaluate(() => AccountApp.fmt.day(Date.now())), await page.evaluate(() => AccountApp.fmt.day(Date.now()))]);
    assert.ok(await page.locator('#nw').count(), 'warning: the account is newer than the file');
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, 'restore-preview-1280.png') });
    await page.click('#go'); await page.waitForSelector('.sheet h2:has-text("Restore finished")'); await page.screenshot({ path: path.join(SHOTS, 'restore-done-1280.png') }); await page.click('[data-cancel]');
    let state = await page.evaluate(() => ({ uids: AccountApp.store.all('item').map(e => e.data.uid).sort(), names: AccountApp.store.all('customer').map(e => e.data.name).sort(), notes: AccountApp.store.all('item').map(e => e.data.notes).filter(Boolean) }));
    assert.deepEqual(state.uids, ['NEW-AFTER-1', 'SN-ALPHA-90210', 'SN-BRAVO-90211', 'SN-CHARLIE-90212'], 'missing device came back, newer one kept');
    assert.deepEqual(state.names, ['Amelia Quartz', 'Late Customer', 'Zed Buyer']); assert.deepEqual(state.notes, ['EDITED-AFTER'], 'an existing record is not overwritten');

    // restore again: Replace everything makes the account match the file; the edit and the new records go away
    await openRestore(file); assert.deepEqual((await nums()).slice(0, 6), ['3', '4', '2', '3', '1', '1']);
    await page.check('input[value=replace]'); assert.equal(await page.textContent('#go'), 'Replace everything'); await page.click('#go'); await page.waitForSelector('.sheet h2:has-text("Restore finished")'); await page.click('[data-cancel]');
    state = await page.evaluate(() => ({ uids: AccountApp.store.all('item').map(e => e.data.uid).sort(), names: AccountApp.store.all('customer').map(e => e.data.name).sort(), notes: AccountApp.store.all('item').map(e => e.data.notes).filter(Boolean) }));
    assert.deepEqual(state.uids, ['SN-ALPHA-90210', 'SN-BRAVO-90211', 'SN-CHARLIE-90212']); assert.deepEqual(state.names, ['Amelia Quartz', 'Zed Buyer']); assert.deepEqual(state.notes, []);
    assert.deepEqual(await counts(), { d: 3, c: 2, s: 1 });

    // undo the replace: the account is exactly as before it
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#ud'); await page.screenshot({ path: path.join(SHOTS, 'backup-undo-1280.png'), fullPage: true });
    await page.click('#ud'); await page.click('#ok'); await page.waitForSelector('#ud', { state: 'detached' }); await page.waitForSelector('.scrim', { state: 'detached' });
    state = await page.evaluate(() => ({ uids: AccountApp.store.all('item').map(e => e.data.uid).sort(), names: AccountApp.store.all('customer').map(e => e.data.name).sort(), notes: AccountApp.store.all('item').map(e => e.data.notes).filter(Boolean) }));
    assert.deepEqual(state.uids, ['NEW-AFTER-1', 'SN-ALPHA-90210', 'SN-BRAVO-90211', 'SN-CHARLIE-90212']); assert.deepEqual(state.names, ['Amelia Quartz', 'Late Customer', 'Zed Buyer']); assert.deepEqual(state.notes, ['EDITED-AFTER']);

    // refusals: another account's file, a file made with a different key, a file that is not a backup
    const forged = async (fn) => Buffer.from(await page.evaluate(fn, id));
    const otherAcct = await forged(async (id) => { const f = JSON.parse(await (async () => { const E = AccountApp.backupEngine; return (await E.makeFile()).text; })()); f.account = 'amber-fox-0000'; return JSON.stringify(f); });
    const otherKey = await forged(async (id) => { const adk = await Vault.newAdk(), recs = (await AccountApp.api('GET', '/vault/records')).records; return AccountApp.backupFile.build({ adk, accountCode: id, appVersion: 'x', records: recs, keys: null, recoveryWrappedAdk: null }); });
    for (const [buf, re] of [[otherAcct, /different account/], [otherKey, /different key/], [Buffer.from('hello'), /not a myBoxStock backup/]]) {
      await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#pk'); await page.setInputFiles('#fl', { name: 'x.mbsbackup', mimeType: 'application/octet-stream', buffer: buf });
      await page.waitForSelector('.sheet h2:has-text("cannot be used")'); assert.match(await page.textContent('.sheet'), re); if (re.source === 'different account') await page.screenshot({ path: path.join(SHOTS, 'restore-refused-1280.png') }); await page.click('[data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' });
    }
    assert.deepEqual(await counts(), { d: 4, c: 3, s: 1 }, 'refused files change nothing');

    // diagnostics: copied to the clipboard, and a fallback sheet when copying is blocked
    await page.click('#dg'); await page.waitForFunction(() => document.querySelector('.toast, [class*=toast]')?.textContent.includes('Diagnostics copied'));
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(clip.includes('myBoxStock diagnostics') && clip.includes(`Reseller ID: ${id}`) && clip.includes('Encryption: on') && /screen \d+x\d+/.test(clip), clip);
    for (const s of NAMES.concat(['NEW-AFTER-1', 'Late Customer', 'Roku'])) assert.ok(!clip.includes(s), `diagnostics has no "${s}"`);
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('blocked')); });
    await page.click('#dg'); await page.waitForSelector('.sheet textarea#dg'); assert.ok((await page.inputValue('textarea#dg')).includes('Reseller ID')); await page.click('[data-cancel]');

    // phone: no sideways scroll, 44px controls, sheets from the bottom
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#mk'); await page.waitForTimeout(400);
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(await wide() <= 0, 'no sideways scroll on the page'); await page.screenshot({ path: path.join(SHOTS, 'backup-page-375.png'), fullPage: true });
    for (const sel of ['#mk', '#pk', '#xall', '#dg']) { const h = (await page.locator(sel).boundingBox())?.height; assert.ok(h >= 44, `${sel} is ${h}px tall`); }
    await openRestore(file); await page.waitForTimeout(900); assert.ok(await wide() <= 0, 'no sideways scroll with the sheet'); await page.screenshot({ path: path.join(SHOTS, 'restore-preview-375.png') });
    const box = await page.locator('.sheet').boundingBox(); assert.ok(box.y + box.height >= 812 - 2 && box.width >= 370, 'the sheet rises from the bottom, full width');
    for (const sel of ['.sheet #go', '.sheet [data-cancel]', '.choice']) assert.ok((await page.locator(sel).first().boundingBox()).height >= 44, `${sel} is at least 44px`);
    await page.click('[data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' });
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.stat-grid'); await page.screenshot({ path: path.join(SHOTS, 'home-375.png') });
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
