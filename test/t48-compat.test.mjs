// TEST / t48-compat — old backups still restore and test cleanly, and the fields added in v0.25.0 default safely. The records in test/fixtures/old-records-v021.json are
// the shape the app saved before delivery, addresses, returns, labels and return settings existed (v0.21.0 to v0.24.0). They are sealed into a backup file the way earlier
// builds made it (no Team list in the file, keys for the password only), restored into a wiped account, and the new code reads them: every sale is Immediate, nothing is
// returned, the label and return settings take their defaults, every screen and export still works. A file from a NEWER build, and damaged files, are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, fillLogin, ROOT } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const OLD = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/old-records-v021.json'), 'utf8'));

test('browser: a backup of the older record shapes restores, reads safely and exports', { skip, timeout: 280000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
  const page = await br.newPage({ viewport: { width: 1280, height: 900 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Old Co'); await page.fill('#em', 'old@example.com'); await page.fill('#un', 'olga'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'olga@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');

    // The account holds the old shapes (ids in the fixture are swapped for real record ids, everywhere they appear).
    const saved = await page.evaluate(async (old) => {
      const S = AccountApp.store, ids = {}; let text = JSON.stringify(old);
      for (const m of text.matchAll(/"((?:c|m|i|s)-old-\d)"/g)) ids[m[1]] ??= Vault.newId();
      for (const [k, v] of Object.entries(ids)) text = text.split(`"${k}"`).join(`"${v}"`);
      const o = JSON.parse(text), put = (type, list) => list.map(x => ({ type, id: x.id, data: x.data }));
      await S.commit({ puts: [{ type: 'config', id: S.CONFIG_ID, data: o.config }, ...put('customer', o.customers), ...put('model', o.models), ...put('item', o.items), ...put('sale', o.sales)] });
      const snap = []; for (const t of ['item', 'customer', 'model', 'sale', 'config']) for (const e of S.all(t)) snap.push([t, e.id, e.data]);
      return snap.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
    }, OLD);
    assert.equal(saved.length, 1 + 2 + 1 + 4 + 3);
    assert.ok(!saved.some(r => r[0] === 'sale' && ('delivery' in r[2] || 'returns' in r[2])), 'the fixture sales carry no v0.25.0 fields');

    // The file as an earlier build wrote it: no Team list.
    const text = await page.evaluate(async () => { const A = AccountApp, E = A.backupEngine, recs = (await A.api('GET', '/vault/records')).records, rec = await A.api('GET', '/vault/recovery');
      return A.backupFile.build({ adk: A.vault.adk, accountCode: A.me.accountCode, appVersion: '0.21.0', records: recs, keys: A.vault.state?.keys || null, recoveryWrappedAdk: rec.wrappedAdk }); });
    const head = JSON.parse(text); assert.equal(head.v, 1); assert.equal(head.app, '0.21.0'); assert.ok(!('team' in head), 'an older file has no Team list');
    const verdict = await page.evaluate(async (t) => { const A = AccountApp, r = await A.backupFile.check(t, { adk: A.vault.adk, accountCode: A.me.accountCode, records: true }); return { steps: r.steps.map(x => [x.id, x.ok]), team: r.parsed?.team, counts: r.parsed?.manifest.counts }; }, text);
    assert.deepEqual(verdict.steps, [['format', true], ['account', true], ['key', true], ['complete', true], ['records', true]], 'tests cleanly; no Team step because the file has none');
    assert.equal(verdict.team, null); assert.deepEqual(verdict.counts, { devices: 4, customers: 2, sales: 3, records: 11 });

    // Refusals: a newer format, a cut-off file, a changed record, a file that is not a backup.
    const refuse = (t) => page.evaluate(async (t) => { const A = AccountApp; try { await A.backupFile.read(t, { adk: A.vault.adk, accountCode: A.me.accountCode }); return 'accepted'; } catch (e) { return e.message; } }, t);
    assert.match(await refuse(JSON.stringify({ ...head, v: 2 })), /newer version of myBoxStock/);
    assert.match(await refuse(text.slice(0, text.length - 40)), /not a myBoxStock backup/);
    assert.match(await refuse(JSON.stringify({ ...head, records: head.records.slice(1) })), /damaged or incomplete/);
    assert.match(await refuse('id,name\n1,x'), /not a myBoxStock backup/);
    assert.match(await refuse(JSON.stringify({ ...head, account: 'other-001' })), /belongs to a different account/);

    // Wipe and restore from the old-format file.
    await page.evaluate(async () => { const S = AccountApp.store, deletes = []; for (const t of ['item', 'customer', 'model', 'sale', 'config']) for (const e of S.all(t)) deletes.push({ type: t, id: e.id }); await S.commit({ deletes }); });
    await page.goto(srv.base + '/app/#/backup'); await page.waitForSelector('#pk');
    await page.setInputFiles('#fl', { name: 'old.mbsbackup', mimeType: 'application/octet-stream', buffer: Buffer.from(text) }); await page.waitForSelector('.compare');
    await page.click('#go'); await page.waitForSelector('.sheet h2:has-text("Restore finished")'); await page.click('[data-cancel]');
    const after = await page.evaluate(() => { const S = AccountApp.store, snap = []; for (const t of ['item', 'customer', 'model', 'sale', 'config']) for (const e of S.all(t)) snap.push([t, e.id, e.data]); return snap.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1])); });
    assert.deepEqual(after, saved, 'every old record comes back exactly as it was, with no new fields invented');

    // The new code reads the old data safely.
    const read = await page.evaluate(() => { const A = AccountApp, C = A.commerce, S = A.store, R = A.returns, D = C.delivery, sales = S.all('sale');
      return {
        types: sales.map(e => D.typeOf(e.data)), statuses: sales.map(e => D.status(e.data)), fees: sales.map(e => D.feeOf(e.data)), costs: sales.map(e => D.costOf(e.data)), due: sales.map(e => D.due(e.data) - e.data.total),
        states: sales.map(e => R.state(e.data)), nets: sales.map(e => { const n = R.net(e.data); return n.revenue === e.data.total && n.refunds === 0 && n.profit === e.data.total - (e.data.cost || 0); }), chips: sales.map(e => R.chip(e.data)),
        toShip: sales.filter(e => D.isToShip(e)).length, tags: sales.map(e => D.tag(e.data)), receipts: sales.map(e => C.receiptText(e)), recHtml: sales.map(e => D.receiptHtml(e.data) + D.receiptFeeHtml(e.data)),
        label: A.labels.cfg(), ret: R.settings(), dcfg: D.cfg(), cfg: { delivery: S.config().delivery, label: S.config().label, returns: S.config().returns },
        canProcess: R.canProcess(), mailLogo: S.config().mail.logo };
    });
    assert.deepEqual(read.types, ['immediate', 'immediate', 'immediate']); assert.deepEqual(read.statuses, ['', '', '']); assert.deepEqual(read.fees, [0, 0, 0]); assert.deepEqual(read.costs, [0, 0, 0]); assert.deepEqual(read.due, [0, 0, 0]);
    assert.deepEqual(read.states, ['', '', '']); assert.deepEqual(read.nets, [true, true, true]); assert.equal(read.toShip, 0); assert.deepEqual(read.tags, ['', '', '']); assert.deepEqual(read.recHtml, ['', '', '']);
    assert.ok(read.chips.every(c => c === ''), 'no Returned or Partly returned tag on an old sale');
    assert.ok(read.receipts.every(t => !/Ship to|Shipping|Credit note|Delivery/i.test(t)), 'old receipts read as before');
    assert.deepEqual(read.label, { size: '4x6', look: 'themed', logo: 'business', customLogo: '', returnAddress: { name: '', street: '', unit: '', city: '', state: '', zip: '', country: '' } });
    assert.equal(read.ret.standardCan, true); assert.equal(read.ret.limit, 0); assert.deepEqual(read.ret.fee, { mode: 'none', value: 0 }); assert.equal(read.ret.reasons.length, 5);
    assert.deepEqual(read.dcfg, { country: false, receiptNote: false, receiptDeliveryNote: false });
    assert.equal(read.cfg.delivery, undefined, 'a default is not written back by reading'); assert.equal(read.mailLogo, '');

    // Every screen opens, and the exports run, on the old data.
    for (const r of ['sales', 'customers', 'inventory', 'home', 'settings', 'backup']) { await page.goto(srv.base + '/app/#/' + r); await page.waitForTimeout(500); assert.ok(await page.locator('.page-head, h1').count() > 0, `${r} opens`); }
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click'); assert.equal(await page.locator('tr.click').count(), 3);
    const ex = await page.evaluate(() => { const A = AccountApp, S = A.store, sales = S.all('sale'), t = A.salesTable(sales), inv = A.inventoryTable(), ret = A.returns.table(sales);
      const col = (h, n) => t.rows.map(r => r[t.headers.indexOf(n)]); return { dl: col(t.headers, 'delivery'), fee: col(t.headers, 'shipping_fee'), rs: col(t.headers, 'return_status'), refund: col(t.headers, 'refund'), net: col(t.headers, 'net_total'), invRows: inv.rows.length, retRows: ret.rows.length, models: A.modelsTable().rows }; });
    assert.deepEqual(ex.dl, ['Immediate', 'Immediate', 'Immediate']); assert.deepEqual(ex.fee, ['', '', '']); assert.deepEqual(ex.rs, ['', '', '']); assert.deepEqual(ex.refund, ['', '', '']); assert.equal(ex.invRows, 4); assert.equal(ex.retRows, 0); assert.deepEqual(ex.models, [['Roku Ultra', 3]]);
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
