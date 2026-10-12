// TEST / t60-reseller-restore-ui — a real browser: Backups > Restore a reseller. Find a reseller, look inside a backup, read the data-loss notice, type the name, restore.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, Client } from './helpers.mjs';
import { enableVault, putRecord } from './vault-helper.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';

test('browser: restore a reseller from a backup', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 1200 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    const x = (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Alpha Shop', email: 'a@example.com', username: 'alpha', password: PW })).data;
    const c = new Client(srv.base); await c.req('POST', '/api/app/login', { resellerId: x.resellerId, username: 'alpha', password: PW }); const { adk } = await enableVault(c, PW);
    for (let i = 0; i < 3; i++) await putRecord(c, adk, 'item', { n: i });
    const host = new Client(srv.base); await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    const h2 = new Client(srv.base); await h2.req('POST', '/api/host/login', { login: 'admin', password: PW }); await h2.req('POST', '/api/host/backups', {});
    await putRecord(c, adk, 'item', { n: 'later' });

    await page.goto(srv.base + '/host/#/backups'); await page.waitForSelector('#tabs');
    await page.click('#tabs button[data-t=reseller]'); await page.waitForSelector('#rr-q');
    await page.fill('#rr-q', 'Alpha'); await page.waitForSelector('[data-pick]'); await page.click('[data-pick]');
    await page.waitForSelector('input[name=rr-src]'); assert.ok(await page.locator('input[name=rr-src]:checked').count(), 'the newest backup is pre-selected');
    await page.click('#rr-look'); await page.waitForSelector('#rr-loss', { timeout: 60000 });
    assert.match(await page.textContent('#rr-loss'), /owns that loss/);
    const compare = await page.textContent('.compare'); assert.match(compare, /Devices/);
    await page.check('input[name=rr-mode][value=replace]');
    await page.click('#rr-go'); await page.waitForSelector('#rr-cn'); assert.equal(await page.locator('#rr-do').isDisabled(), true);
    await page.fill('#rr-cn', 'Alpha Shop'); await page.click('#rr-do');
    await page.waitForSelector('#rr-done', { timeout: 60000 }); assert.match(await page.textContent('#rr-done'), /safety copy/);
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
