// TEST / e2e-host-v021 — in the browser, on a phone: Onboarding shows Free and ended plans, the Firewall page unlocks a locked sign-in, the account sheet unlocks one person,
// and the delete sheet warns in red when Email is not set up (no warning once it is), with 44px buttons and no sideways scroll at 375px.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw, skip = false; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch { skip = 'playwright not installed'; } }
const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';

test('browser at 375px: onboarding plan chips, unlock on Firewall and account sheet, delete sheet email warning', { skip: skip || (!sqlite && 'SQLite-only'), timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 375, height: 812 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const api = new Client(srv.base), { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000');
  const noSideways = async (what) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${what}: no sideways scroll at 375px`);
  const tall = async (sel, what) => { await sleep(450); for (const h of await page.$$eval(sel, els => els.filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height))) assert.ok(h >= 43.5, `${what}: ${h}px tall`); };
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('main');
    await api.req('POST', '/api/host/login', { login: 'admin', password: PW });
    await api.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
    const mk = async (biz, user) => (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email: `${user}@example.com`, username: user, password: PW })).data.resellerId;
    const free = await mk('Free Chip Co', 'frank'), ended = await mk('Ended Chip Co', 'enid'), lock = await mk('Locked Co', 'lena');
    d.prepare("UPDATE accounts SET plan = 'free' WHERE account_code = ?").run(free);
    d.prepare("UPDATE accounts SET plan = 'trial', trial_ends_at = ? WHERE account_code = ?").run(Date.now() - 86400e3, ended);

    // Onboarding
    await page.goto(srv.base + '/host/#/onboarding'); await page.waitForSelector('#acc-body tr'); await sleep(300);
    const body = await page.textContent('main'); assert.match(body, /Free accounts:\s*1/); assert.match(body, /Trial or paid period ended:\s*1/);
    assert.equal(await page.locator('#acc-body tr', { hasText: 'Free Chip Co' }).locator('.chip.blue', { hasText: 'free' }).count(), 1, 'free chip');
    assert.equal(await page.locator('#acc-body tr', { hasText: 'Ended Chip Co' }).locator('.chip.red', { hasText: 'Trial ended' }).count(), 1, 'trial ended chip');
    await noSideways('onboarding');

    // Firewall: locked sign-in listed and unlocked
    const login = (pwd) => new Client(srv.base).req('POST', '/api/app/login', { resellerId: lock, username: 'lena', password: pwd });
    for (let i = 0; i < 6; i++) await login('wrong-password-1'); assert.equal((await login(PW)).status, 429);
    await page.goto(srv.base + '/host/#/firewall'); await page.waitForSelector('[data-unlock]'); await noSideways('firewall'); await tall('[data-unlock]', 'Unlock button');
    await page.click('[data-unlock]'); await page.waitForSelector('#ok'); await tall('#ok', 'confirm button'); await page.click('#ok'); await page.waitForSelector('text=Unlocked');
    await sleep(500); assert.equal((await login(PW)).status, 200, 'sign-in works again');
    assert.equal(await page.locator('[data-unlock]').count(), 0, 'the lockout card is gone');

    // Account sheet: unlock one person
    for (let i = 0; i < 6; i++) await login('wrong-password-1');
    await page.goto(srv.base + '/host/#/accounts'); await page.waitForSelector('#tbl tr[data-id], #tbl [data-id]'); await page.fill('#q', lock); await sleep(700);
    await page.click(`#tbl [data-id]`); await page.waitForSelector('[data-u]'); assert.equal(await page.locator('.sheet .chip.red', { hasText: 'locked out' }).count(), 1);
    await page.click('[data-u]'); await page.waitForSelector('#unl:not([disabled])'); await tall('#unl', 'Unlock this sign-in'); await page.click('#unl'); await page.fill('#rs', 'Caller asked'); await tall('#go', 'Continue'); await page.click('#go'); await page.waitForSelector('text=Unlocked');
    assert.equal((await login(PW)).status, 200);

    // Delete sheet: red warning while Email is not set up, none once it is
    const openDelete = async (code) => { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sleep(300); await page.goto(srv.base + '/host/#/accounts'); await page.waitForSelector('#tbl [data-id]'); await page.fill('#q', code); await sleep(700); await page.click('#tbl [data-id]'); await page.waitForSelector('#del'); await page.click('#del'); await page.waitForSelector('#tc'); };
    await openDelete(free);
    const warn = page.locator('.sheet:has(#tc) .banner.red[role=alert]'); assert.equal(await warn.count(), 1); assert.match(await warn.textContent(), /Email is not set up, so nobody will be told this account was deleted/); assert.match(await page.textContent('.sheet:has(#tc)'), /Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway\./);
    assert.equal(await page.locator('#ok').isDisabled(), true); await noSideways('delete sheet'); await tall('.sheet:has(#tc) .btn', 'delete sheet buttons');
    assert.equal(await page.evaluate(() => { const s = document.querySelector('.sheet:has(#tc)'); return s.scrollWidth <= s.clientWidth; }), true, 'sheet does not scroll sideways');
    await page.click('[data-cancel]');
    await api.req('PUT', '/api/host/mail', { enabled: true, mode: 'smtp', fromName: 'T', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port: 1, user: '', pass: '', secure: false } });
    await openDelete(ended); assert.equal(await page.locator('.sheet:has(#tc) .banner.red').count(), 0, 'no warning when email is set up'); assert.match(await page.textContent('.sheet:has(#tc)'), /One “account erased” email is sent/);
    await page.fill('#rs', 'Phone test'); await page.fill('#tc', ended); await page.click('#ok'); await page.waitForSelector('text=Account deleted'); await sleep(500);
    assert.equal(d.prepare("SELECT COUNT(*) AS n FROM accounts WHERE account_code = ?").get(ended).n, 0);
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
