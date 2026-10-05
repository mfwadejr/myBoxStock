// TEST / e2e-host-hardening — in the browser: the proxy menu shows a container value as Custom and keeps it, the Audit page filters by kind, and Sender checks show on the Email Health tab.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, sleep } from './helpers.mjs';

const pwPath = '/opt/npm-tools/node_modules/playwright/index.mjs', exe = '/opt/pw-browsers/chromium';
let pw, skip = false; try { pw = await import(pwPath); } catch { skip = 'playwright not installed'; }
const PW = 'Sup3rSecretPass!', SHOTS = process.env.SHOT_DIR;

test('browser: custom proxy value is shown and kept, Audit filters by kind, Sender checks appear', { skip, timeout: 150000 }, async () => {
  const srv = await startServer({ TRUST_PROXY: 'loopback' }), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const api = new Client(srv.base);
  try {
    await page.goto(srv.base + '/host/'); await page.waitForSelector('input');
    const inputs = await page.$$('input'); await inputs[0].fill('admin'); await inputs[1].fill(srv.hostPw); await page.keyboard.press('Enter');
    await page.waitForSelector('#a'); await page.fill('#a', srv.hostPw); await page.fill('#b', PW); await page.click('#go'); await page.waitForSelector('.side');
    await api.req('POST', '/api/host/login', { login: 'admin', password: PW });
    const state = async () => (await api.req('GET', '/api/host/settings')).data.runtime.trustProxy;

    await page.goto(srv.base + '/host/#/settings'); await page.waitForSelector('#rtp');
    assert.match(await page.textContent('#rtp'), /Custom \(set by the container: loopback\)/);
    await page.click('#rsave'); await page.waitForSelector('text=Saved'); await sleep(400);
    let t = await state(); assert.equal(t.value, 'loopback'); assert.equal(t.saved, false, 'saving the card did not replace the container value');
    await page.waitForSelector('#rtp'); await page.click('#rtp'); await page.click('#rtp + .select-list [data-value="1"]'); await page.click('#rsave'); await sleep(800);
    t = await state(); assert.equal(t.value, '1'); assert.equal(t.saved, true);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-1280.png` });

    await page.goto(srv.base + '/host/#/audit'); await page.waitForSelector('#type');
    await page.click('#type'); const kinds = await page.$$eval('#type + .select-list [data-value]', o => o.map(x => x.textContent)); assert.ok(kinds.includes('Firewall and access') && kinds.includes('Bans and lockouts') && kinds.includes('Host Console sign-ins') && kinds.includes('Two-factor'));
    await page.click('#type + .select-list [data-value="signins"]'); await page.waitForSelector('.log-line'); await sleep(300);
    assert.match(await page.textContent('#list'), /Host Console sign-in/); assert.doesNotMatch(await page.textContent('#list'), /Server options changed/);
    await page.click('#type'); await page.click('#type + .select-list [data-value=""]'); await page.fill('#q', 'Server options'); await page.waitForSelector('text=Server options changed');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/audit-1280.png` });

    await page.goto(srv.base + '/host/#/email'); await page.waitForSelector('#etabs'); await page.click('#etabs [data-t=health]'); await page.waitForSelector('#dgo');
    await page.fill('#dsel', 'default'); await page.click('#dgo'); await page.waitForSelector('#dres .setting', { timeout: 15000 }).catch(() => {});
    const txt = await page.textContent('#dres'); assert.match(txt, /Set a From address|SPF/);
    assert.match(await page.textContent('#sender'), /does not sign mail itself/);
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/health-1280.png` }); await page.setViewportSize({ width: 375, height: 812 }); await sleep(300); await page.screenshot({ path: `${SHOTS}/health-375.png`, fullPage: true });
      await page.goto(srv.base + '/host/#/settings'); await page.waitForSelector('#rtp'); await sleep(300); await page.screenshot({ path: `${SHOTS}/settings-375.png`, fullPage: true }); }
    assert.deepEqual(errors, []);
  } finally { await br.close(); srv.stop(); }
});
