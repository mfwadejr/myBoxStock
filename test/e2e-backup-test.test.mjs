// TEST / e2e-backup-test — a real browser: "Test a backup file" (good file, other account's file, different key, damaged file, tampered record, read-only account, phone layout)
// and Team members in the backup (restore sheet switch on and off, no duplicates, Replace never removes people, undo removes the added invitations).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : (process.env.DB_CLIENT || 'sqlite') !== 'sqlite' ? 'SQLite only' : false;
const PW = 'Sup3rSecretPass!', TEMP = 'Temp-pass-12345', SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mbs-backup-test-shots');

// Sign up, finish encryption setup and add a little data. Returns { srv, br, page, id, errors, writes }.
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
  await page.evaluate(async () => {
    const S = AccountApp.store, mkItem = (uid) => ({ type: 'item', data: { uid, serial: uid, make: 'Roku', model: 'Ultra', status: 'available', cost: 2000, price: 5000, addedAt: Date.now() } });
    await S.commit({ puts: [{ type: 'customer', data: { name: 'Zed Buyer', createdAt: Date.now() } }, ...['SN-1', 'SN-2', 'SN-3'].map(mkItem)] });
  });
  return { srv, br, page, id, errors, writes };
}
const addPerson = (page, username, role, email = '') => page.evaluate(async ([username, role, email, TEMP]) => AccountApp.api('POST', '/users', { username, email, role, password: TEMP, keys: await Vault.keysFor(TEMP, AccountApp.vault.adk) }), [username, role, email, TEMP]);
const people = (page) => page.evaluate(async () => (await AccountApp.api('GET', '/users')).map(u => `${u.username}${u.pending ? '*' : ''}:${u.role}`).sort());
const makeFile = (page) => page.evaluate(async () => (await AccountApp.backupEngine.makeFile()).text);
const pick = async (page, sel, text) => { await page.setInputFiles(sel, { name: 'b.mbsbackup', mimeType: 'application/octet-stream', buffer: Buffer.from(text) }); };
const testFile = async (page, text) => { await page.goto(page.url().split('#')[0] + '#/backup'); await page.waitForSelector('#tk'); await pick(page, '#tf', text); await page.waitForSelector('.sheet #sm'); };
const closeSheet = async (page) => { await page.click('.sheet [data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' }); };
const chips = (page) => page.$$eval('#ck .setting', rows => rows.map(r => [r.querySelector('.setting-title').textContent.trim(), r.querySelector('.chip').textContent.trim()]));
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('browser: Test a backup file (good, other account, different key, damaged, tampered, read-only, phone)', { skip, timeout: 400000 }, async () => {
  const { srv, br, page, id, errors, writes } = await setup();
  try {
    await addPerson(page, 'stan', 'Standard', 'stan@example.com'); await addPerson(page, 'vera', 'View');
    const good = await makeFile(page);
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#tk');
    // the card sits between Restore and Spreadsheets
    assert.deepEqual(await page.$$eval('.card h3', hs => hs.map(h => h.textContent.trim()).slice(0, 4)), ['Full backup', 'Restore from a backup file', 'Test a backup file', 'Spreadsheets']);
    await page.screenshot({ path: path.join(SHOTS, 'test-card-1280.png'), fullPage: true });

    // 1. a good file, nothing changed since: every check passes, what is inside, matches the account
    writes.length = 0; await testFile(page, good);
    assert.match(await page.textContent('#sm'), /passed every check/); assert.equal(await page.locator('.sheet .banner.blue#sm').count(), 1);
    assert.deepEqual(await chips(page), [['Is a myBoxStock backup file', 'Passed'], ['Made for this account', 'Passed'], ['Opens with this account’s key', 'Passed'], ['Complete and not damaged', 'Passed'], ['Every record can be opened', 'Passed'], ['Team list can be opened', 'Passed']]);
    assert.deepEqual(await page.$$eval('.compare .tab-num', els => els.map(e => e.textContent.trim())), ['3', '3', '1', '1', '0', '0', '3', '3']);
    assert.match(await page.textContent('#tt'), /1 Administrator, 1 Standard, 1 View/); assert.match(await page.textContent('#tt'), /3 already in your account, 0 would be added/);
    assert.deepEqual(await page.$$eval('#cmp tbody tr', trs => trs.map(t => [...t.querySelectorAll('td')].map(d => d.textContent.trim()))), [['Devices', '0', '0', '0', '3'], ['Customers', '0', '0', '0', '1'], ['Sales', '0', '0', '0', '0']]);
    assert.match(await page.textContent('#vd'), /matches your account as it is now/);
    await page.screenshot({ path: path.join(SHOTS, 'test-good-1280.png') }); await closeSheet(page);
    assert.deepEqual(writes, [], 'testing sends nothing and changes nothing');

    // 2. the account changes after the file was made: older file, with the numbers by group; a team member the file has is missing now
    const stan = await page.evaluate(async () => (await AccountApp.api('GET', '/users')).find(u => u.username === 'stan').id);
    await page.evaluate(async ([stan, code]) => {
      const S = AccountApp.store, items = S.all('item'), sn1 = items.find(e => e.data.uid === 'SN-1'), sn2 = items.find(e => e.data.uid === 'SN-2');
      await S.commit({ puts: [{ type: 'item', id: sn1.id, data: { ...sn1.data, notes: 'EDITED' } }, { type: 'item', data: { uid: 'NEW-1', serial: 'NEW-1', status: 'available', cost: 1, price: 2, addedAt: Date.now() } }, { type: 'customer', data: { name: 'Late', createdAt: Date.now() } }], deletes: [{ type: 'item', id: sn2.id }] });
      await AccountApp.api('DELETE', `/users/${stan}`, { confirm: `stan@${code}` });
    }, [stan, id]);
    writes.length = 0; await testFile(page, good);
    assert.deepEqual(await page.$$eval('#cmp tbody tr', trs => trs.map(t => [...t.querySelectorAll('td')].map(d => d.textContent.trim()))), [['Devices', '1', '1', '1', '1'], ['Customers', '1', '0', '0', '1'], ['Sales', '0', '0', '0', '0']]);
    assert.match(await page.textContent('#vd'), /This file is older than your latest changes/); assert.equal(await page.locator('.sheet .banner:not(.blue):not(.red)#vd').count(), 1);
    assert.match(await page.textContent('#tt'), /2 already in your account, 1 would be added/);
    await closeSheet(page);

    // 3. another account's file: stops at that check, the rest are not checked
    const forged = async (fn) => page.evaluate(fn, id);
    const other = await forged(async () => { const f = JSON.parse((await AccountApp.backupEngine.makeFile()).text); f.account = 'amber-fox-0000'; return JSON.stringify(f); });
    await testFile(page, other); assert.equal(await page.locator('.sheet .banner.red#sm').count(), 1); assert.match(await page.textContent('#sm'), /different account \(Reseller ID amber-fox-0000\)/);
    assert.deepEqual((await chips(page)).map(c => c[1]), ['Passed', 'Failed', 'Not checked', 'Not checked', 'Not checked', 'Not checked']); assert.equal(await page.locator('#cmp').count(), 0, 'no summary for a file that failed');
    await page.screenshot({ path: path.join(SHOTS, 'test-other-account-1280.png') }); await closeSheet(page);

    // 4. made with a different key
    const diffKey = await forged(async (id) => { const adk = await Vault.newAdk(), recs = (await AccountApp.api('GET', '/vault/records')).records; return AccountApp.backupFile.build({ adk, accountCode: id, appVersion: 'x', records: recs, keys: null, recoveryWrappedAdk: null }); });
    await testFile(page, diffKey); assert.match(await page.textContent('#sm'), /different key/); assert.deepEqual((await chips(page)).map(c => c[1]), ['Passed', 'Passed', 'Failed', 'Not checked', 'Not checked']); await closeSheet(page);

    // 5. damaged (a record missing) and a file that is not a backup
    const damaged = await forged(async () => { const f = JSON.parse((await AccountApp.backupEngine.makeFile()).text); f.records.pop(); return JSON.stringify(f); });
    await testFile(page, damaged); assert.match(await page.textContent('#sm'), /damaged or incomplete/); assert.deepEqual((await chips(page)).map(c => c[1]), ['Passed', 'Passed', 'Passed', 'Failed', 'Not checked', 'Not checked']); await closeSheet(page);
    await testFile(page, 'hello'); assert.match(await page.textContent('#sm'), /not a myBoxStock backup/); await closeSheet(page);

    // 6. one record tampered with: changed in the file, and (the clever way) changed with the checksum made to match, which only opening every record can catch
    const flipped = await forged(async () => { const f = JSON.parse((await AccountApp.backupEngine.makeFile()).text); f.records[0] = f.records[0].slice(0, -3) + 'AAA'; return JSON.stringify(f); });
    await testFile(page, flipped); assert.match(await page.textContent('#sm'), /damaged or incomplete/); await closeSheet(page);
    const clever = await forged(async (id) => { const recs = (await AccountApp.api('GET', '/vault/records')).records; recs[0].blob = recs[0].blob.slice(0, -3) + 'AAA'; return AccountApp.backupFile.build({ adk: AccountApp.vault.adk, accountCode: id, appVersion: 'x', records: recs, keys: null, recoveryWrappedAdk: null }); });
    await testFile(page, clever); assert.match(await page.textContent('#sm'), /one of its records cannot be opened/); assert.deepEqual((await chips(page)).map(c => c[1]), ['Passed', 'Passed', 'Passed', 'Passed', 'Failed']); await page.screenshot({ path: path.join(SHOTS, 'test-tampered-1280.png') }); await closeSheet(page);
    assert.deepEqual(writes, [], 'no failed test changed anything');
    assert.deepEqual(await people(page), ['tess:Administrator', 'vera:View']);

    // 7. phone layout
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#tk'); await page.waitForTimeout(300);
    assert.ok(await wide(page) <= 0, 'no sideways scroll on the page'); assert.ok((await page.locator('#tk').boundingBox()).height >= 44, 'Test file is a 44px button'); await page.screenshot({ path: path.join(SHOTS, 'test-card-375.png'), fullPage: true });
    await testFile(page, good); await page.waitForTimeout(800);
    assert.ok(await wide(page) <= 0, 'no sideways scroll with the sheet'); const box = await page.locator('.sheet').boundingBox(); assert.ok(box.width >= 370 && box.y + box.height >= 810, 'the sheet rises from the bottom, full width');
    assert.ok(await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth; }), 'nothing inside the sheet is wider than it');
    assert.ok((await page.locator('.sheet [data-cancel]').boundingBox()).height >= 44); await page.screenshot({ path: path.join(SHOTS, 'test-good-375.png') });
    await page.evaluate(() => document.querySelector('.sheet').scrollTo(0, 99999)); await page.waitForTimeout(200); await page.screenshot({ path: path.join(SHOTS, 'test-good-375-bottom.png') }); await closeSheet(page);

    // 8. read-only account (trial ended): the test still works because it only reads
    const db = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); db.exec('PRAGMA busy_timeout=5000'); db.prepare("UPDATE accounts SET plan = 'trial', trial_ends_at = 1").run(); db.close();
    await page.reload(); await page.waitForSelector('#pw'); await page.fill('#pw', PW); await page.click('button.block'); await page.waitForSelector('.side', { state: 'attached' }); await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#tk'); assert.equal(await page.evaluate(() => AccountApp.me.billing.canWrite), false, 'the account is read-only now');
    writes.length = 0; await testFile(page, good); assert.match(await page.textContent('#sm'), /passed every check/); assert.deepEqual(writes, []); await closeSheet(page);
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});

test('browser: team members in the backup (switch on and off, no duplicates, Replace never removes people, undo)', { skip, timeout: 400000 }, async () => {
  const { srv, br, page, errors } = await setup();
  try {
    await addPerson(page, 'stan', 'Standard', 'stan@example.com'); await addPerson(page, 'vera', 'View', 'vera@example.com');
    const file = await makeFile(page);
    assert.ok(!file.includes('stan') && !file.includes('vera@example.com'), 'the team list in the file is sealed');
    const gone = async () => { for (const u of await page.evaluate(async () => (await AccountApp.api('GET', '/users')).filter(u => u.username !== 'tess').map(u => [u.id, u.login]))) await page.evaluate(([id, login]) => AccountApp.api('DELETE', `/users/${id}`, { confirm: login }), u); };
    await gone(); await addPerson(page, 'zed', 'Administrator');
    assert.deepEqual(await people(page), ['tess:Administrator', 'zed:Administrator']);
    const open = async (mode) => { await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#pk'); await pick(page, '#fl', file); await page.waitForSelector('.compare'); if (mode) await page.check(`input[value=${mode}]`); };
    const finish = async () => { await page.click('.sheet #go'); await page.waitForSelector('.sheet h2:has-text("Restore finished")'); const t = await page.locator('#tdn').count() ? await page.textContent('#tdn') : ''; await page.click('.sheet [data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' }); return t; };

    // the restore sheet offers the switch, on by default, with the count and the plain explanation
    await open(); assert.equal(await page.isChecked('#tm'), true); assert.match(await page.textContent('.sheet'), /Add team members \(3 in this file\)/); assert.match(await page.textContent('#tmd'), /1 Administrator, 1 Standard, 1 View.*pending invitations.*Replace everything” never removes a team member/s);
    await page.screenshot({ path: path.join(SHOTS, 'restore-team-1280.png') });
    // switch off: records come back, people do not
    await page.uncheck('#tm'); assert.equal(await finish(), ''); assert.deepEqual(await people(page), ['tess:Administrator', 'zed:Administrator']);
    // switch on, Replace everything: the missing people come back as pending, nobody (zed) is removed, tess is not duplicated
    await open('replace'); const msg = await finish(); assert.match(msg, /2 team members added as pending invitations, 1 already on your team/);
    assert.deepEqual(await people(page), ['stan*:Standard', 'tess:Administrator', 'vera*:View', 'zed:Administrator']);
    await page.goto(srv.base + '/app/#/team'); await page.waitForSelector('table'); assert.equal(await page.locator('.chip:has-text("Pending invitation")').count(), 2); assert.equal(await page.locator('button:has-text("Set up access")').count(), 2); await page.screenshot({ path: path.join(SHOTS, 'team-pending-1280.png'), fullPage: true });
    // the same file again: nobody is added twice
    await open(); assert.match(await finish(), /No team members were added/); assert.equal((await people(page)).length, 4);
    // undo that restore: the first restore's invitations are not its own, so they stay
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#ud'); await page.click('#ud'); await page.click('#ok'); await page.waitForSelector('#ud', { state: 'detached' }); await page.waitForSelector('.scrim', { state: 'detached' });
    assert.equal((await people(page)).length, 4, 'undo removes only what that restore added');
    // a new restore that adds people, then undo removes exactly those
    await page.evaluate(async () => { for (const u of (await AccountApp.api('GET', '/users')).filter(u => u.pending)) await AccountApp.api('DELETE', `/users/${u.id}`, { confirm: u.login }); });
    assert.deepEqual(await people(page), ['tess:Administrator', 'zed:Administrator']);
    await open(); assert.match(await finish(), /2 team members added/); assert.equal((await people(page)).length, 4);
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#ud'); await page.click('#ud'); await page.click('#ok'); await page.waitForSelector('#ud', { state: 'detached' }); await page.waitForSelector('.scrim', { state: 'detached' });
    assert.deepEqual(await people(page), ['tess:Administrator', 'zed:Administrator'], 'undo removed the invitations the restore added and nobody else');

    // a file with no team list leaves the switch out
    const noTeam = await page.evaluate(async () => { const f = JSON.parse((await AccountApp.backupEngine.makeFile()).text); delete f.team; return JSON.stringify(f); });
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#pk'); await pick(page, '#fl', noTeam); await page.waitForSelector('.compare'); assert.equal(await page.locator('#tm').count(), 0); await page.click('.sheet [data-cancel]'); await page.waitForSelector('.scrim', { state: 'detached' });

    // phone layout of the sheet
    await page.setViewportSize({ width: 375, height: 812 });
    await open(); await page.waitForTimeout(900);
    assert.ok(await wide(page) <= 0, 'no sideways scroll with the sheet'); assert.ok(await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollWidth <= s.clientWidth; }));
    assert.ok((await page.locator('.sheet .setting').first().boundingBox()).height >= 44, 'the switch row is at least 44px tall'); assert.ok((await page.locator('.sheet #go').boundingBox()).height >= 44);
    await page.screenshot({ path: path.join(SHOTS, 'restore-team-375.png') }); await page.click('.sheet [data-cancel]');
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
