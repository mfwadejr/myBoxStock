// TEST / e2e-hostlink — a Host administrator who is also a reseller links the two and gets a switcher on both sides.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, Client } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!', STRONG = 'H0stSecretPass!x';

test('browser: link Host administrator, switcher on both sides, wrong password refused, unlink', { skip, timeout: 180000 }, async () => {
  const srv = await startServer(), owner = new Client(srv.base);
  await owner.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await owner.req('POST', '/api/host/change-password', { current: srv.hostPw, next: STRONG });
  const br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Dual Co'); await page.fill('#em', 'd@example.com'); await page.fill('#un', 'dana'); await page.fill('#pw', PW); await page.click('button.block');
    await page.waitForSelector('#go'); const login = (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await page.fill('#l', login); await page.fill('#p', PW); await page.click('button.block');
    await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    assert.equal(await page.locator('#sw').count(), 0, 'no switcher before linking');

    // off by default: no card, and the endpoint refuses
    await page.goto(srv.base + '/app/#/security'); await page.waitForSelector('#pw'); assert.equal(await page.locator('#hl').count(), 0, 'no Link option until the Owner allows it');
    assert.equal((await page.evaluate(async () => (await fetch('/api/app/hostlink', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.cookie } , body: '{}' })).status)) >= 400, true);
    // the Owner allows this account in the Host Console
    const list = (await owner.req('GET', '/api/host/accounts')).data, acct = list[0].id;
    await owner.req('POST', `/api/host/accounts/${acct}/host-link`, { allowed: true });
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.side'); await page.goto(srv.base + '/app/#/security'); await page.waitForSelector('#hl'); await page.click('#hl');
    await page.fill('.sheet #u', 'admin'); await page.fill('.sheet #p', 'wrong-password-1'); await page.click('.sheet #go');
    await page.waitForSelector('.toast'); const msgWrong = await page.textContent('.toast'); assert.equal(await page.locator('#hlo').count(), 0, 'wrong password does not link');
    await page.fill('.sheet #u', 'nobody-here'); await page.click('.sheet #go'); await page.waitForFunction((m) => [...document.querySelectorAll('.toast')].some(t => t.textContent === m), msgWrong); // same answer for an unknown username
    await page.fill('.sheet #u', 'admin'); await page.fill('.sheet #p', STRONG); await page.click('.sheet #go'); await page.waitForSelector('#sw'); await page.waitForSelector('#hlo');
    assert.match(await page.textContent('#sw'), /Reseller · Dual Co/);
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/switch-app.png` : '/tmp/switch-app.png' });
    await page.click('#sw'); assert.ok(await page.locator('.select-option', { hasText: 'Site admin' }).count());

    // Host side: the same person sees their reseller account in the switcher
    const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addCookies(Object.entries(owner.jar).map(([name, value]) => ({ name, value, url: srv.base })));
    const hp = await ctx.newPage(); hp.on('pageerror', e => errors.push(e.message)); await hp.goto(srv.base + '/host/'); await hp.waitForSelector('#sw');
    assert.match(await hp.textContent('#sw'), /Site admin/); await hp.click('#sw'); assert.ok(await hp.locator('.select-option', { hasText: 'Reseller · Dual Co' }).count());
    await hp.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/switch-host.png` : '/tmp/switch-host.png' });
    // choosing the reseller opens the app sign-in with the login filled in
    const [popup] = await Promise.all([ctx.waitForEvent('page'), hp.locator('.select-option', { hasText: 'Reseller · Dual Co' }).click()]);
    await popup.waitForSelector('#l'); assert.equal(await popup.inputValue('#l'), login.toLowerCase());

    // the Owner turns linking off for the account: the link and switcher go away
    await owner.req('POST', `/api/host/accounts/${acct}/host-link`, { allowed: false });
    assert.equal((await owner.req('GET', '/api/host/links')).data.accounts.length, 0, 'Host switcher list is empty again');
    await page.goto(srv.base + '/app/#/home'); await page.waitForSelector('.side'); await page.goto(srv.base + '/app/#/security'); await page.waitForSelector('#pw'); assert.equal(await page.locator('#hl, #hlo').count(), 0, 'card is gone');
    return assert.deepEqual(errors, []);
    // unlink: switcher disappears
    await page.keyboard.press('Escape'); await page.click('#hlo'); await page.click('.sheet .btn:not(.secondary), .modal .btn:not(.secondary)').catch(() => {});
    await page.waitForFunction(() => !document.querySelector('#sw'));
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
