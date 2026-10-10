// TEST / t42-accounts-ui — in the browser at laptop and phone widths: tick boxes, the bulk bar, the Extend trial walk-through with typed confirmation,
// sortable column titles (remembered), the Needs attention option, 44px targets and no sideways scroll.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw, skip = false; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch { skip = 'playwright not installed'; } }
const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';

test('Accounts page: select, bulk bar, Extend trial flow, sorting and layout at 1280px and 375px', { skip: skip || (!sqlite && 'SQLite-only'), timeout: 240000 }, async () => {
  const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const api = new Client(srv.base), { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000');
  const noSideways = async (what) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${what}: no sideways scroll`);
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('main');
    await api.req('POST', '/api/host/login', { login: 'admin', password: PW });
    await api.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
    for (const [biz, user] of [['Beta Boxes', 'bea'], ['Alpha Boxes', 'alan'], ['Gamma Boxes', 'gus']]) { const sr = await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email: `${user}@example.com`, username: user, password: PW }); assert.equal(sr.status, 200, JSON.stringify(sr.data)); }
    const names = () => page.$$eval('#tbl tbody tr td:nth-child(2)', els => els.map(e => e.textContent.trim()));
    const tapOk = async (sel, what) => { for (const h of await page.$$eval(sel, els => els.filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height))) assert.ok(h >= 43.5, `${what}: ${h}px tall`); };

    await page.goto(srv.base + '/host/#/accounts'); await page.waitForSelector('#tbl tbody tr'); await sleep(300);
    assert.equal(await page.isHidden('#bulk'), true, 'the bulk bar is hidden until something is ticked');
    await page.click('th [data-sort="business"]'); await page.waitForFunction(() => document.querySelector('th [data-sort="business"]').closest('th').getAttribute('aria-sort') === 'ascending');
    assert.deepEqual(await names(), ['Alpha Boxes', 'Beta Boxes', 'Gamma Boxes']);
    await page.click('th [data-sort="business"]'); await page.waitForFunction(() => document.querySelector('th [data-sort="business"]').closest('th').getAttribute('aria-sort') === 'descending');
    assert.deepEqual(await names(), ['Gamma Boxes', 'Beta Boxes', 'Alpha Boxes']);
    await page.goto(srv.base + '/host/#/alerts'); await sleep(400); await page.goto(srv.base + '/host/#/accounts'); await page.waitForSelector('#tbl tbody tr'); await sleep(300);
    assert.deepEqual(await names(), ['Gamma Boxes', 'Beta Boxes', 'Alpha Boxes'], 'the sort is remembered while the page is open');

    await page.click('#hf'); await page.click('[role=option]:has-text("Needs attention")'); await page.waitForSelector('#adwrap:not([hidden])'); await sleep(300);
    assert.match(await page.textContent('#adwrap'), /Trial ends within 7 days/);
    await page.click('#hf'); await page.click('[role=option]:has-text("Any health")'); await sleep(300);

    await page.click('[data-pick]:nth-of-type(1) >> nth=0'); await page.click('[data-pick] >> nth=1'); await page.waitForSelector('#bulk:not([hidden])');
    assert.match(await page.textContent('#bulk [data-count]'), /2 selected/); assert.equal(await page.isVisible('#bulk [data-all]'), true);
    await page.click('#bulk [data-all]'); assert.match(await page.textContent('#bulk [data-count]'), /3 selected/);
    await tapOk('.check-cell', 'tick box'); await tapOk('.sort-btn', 'sort button');
    for (const w of [1280, 375]) { await page.setViewportSize({ width: w, height: 900 }); await sleep(250); await noSideways(`Accounts at ${w}px`); }

    await page.click('[data-bulk="extend_trial"]'); await page.waitForSelector('#bd'); await page.fill('#bd', '7'); await page.click('#bpv'); await page.waitForSelector('#bc');
    assert.match(await page.textContent('.banner.blue'), /This will extend 3 trials by 7 days\./); assert.equal(await page.isDisabled('#bgo'), true);
    await page.fill('#br', 'Launch week'); await page.fill('#bc', 'EXTEND'); assert.equal(await page.isDisabled('#bgo'), true, 'not until the words are typed in full');
    await page.fill('#bc', 'extend 3'); await tapOk('#bgo', 'confirm button'); await noSideways('bulk sheet at 375px'); await page.click('#bgo');
    await page.waitForSelector('#bx'); assert.match(await page.textContent('.banner'), /3 accounts done/);
    await page.click('#bx'); await sleep(400);
    const rows = (await api.req('GET', '/api/host/accounts')).data; assert.ok(rows.every(r => r.billing.daysLeft >= 20), 'the trials were extended: ' + rows.map(r => r.billing.daysLeft));
    assert.deepEqual(errors, []);
  } finally { d.close(); await br.close(); srv.stop(); }
});
