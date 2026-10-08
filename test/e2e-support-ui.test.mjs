// TEST / e2e-support-ui — the ticket pages in a real browser at phone and laptop width: the facts blocks line up (T31) and the screenshot viewer (T32):
// opens in a sheet without leaving the page, closes four ways and returns to the same spot, Previous/Next with a count, zoom, Download, Open in new tab,
// attach-preview thumbnails, and a Host-note screenshot still cannot be fetched by the reseller.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, Client, fillLogin } from './helpers.mjs';

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
const PW = 'Sup3rSecretPass!';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const smallTaps = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(e => `${e.tagName}.${e.className}:${Math.round(e.getBoundingClientRect().height)}`), sel);

// Opens a thumbnail's viewer, then proves each way of closing it leaves the page where it was.
async function closesFourWays(page, opener, w) {
  const url = page.url();
  for (const how of ['button', 'escape', 'outside', 'back']) {
        await page.locator(opener).first().click(); await page.waitForSelector('.sheet .viewer-img'); const y = await page.evaluate(() => scrollY); assert.equal(page.url(), url, `${how}: opening the viewer does not navigate`);
    assert.ok(await page.evaluate(() => document.querySelector('.viewer-img').complete), 'the picture loaded');
    if (how === 'button') await page.click('.sheet [data-cancel]');
    else if (how === 'escape') await page.keyboard.press('Escape');
    else if (how === 'outside') await page.mouse.click(5, 5);
    else await page.goBack();
    await page.waitForSelector('.scrim', { state: 'detached' });
    assert.equal(page.url(), url, `${how}: back on the same page`); assert.equal(await page.evaluate(() => scrollY), y, `${how}: same scroll position`);
    assert.equal(await page.evaluate(() => !!history.state?.mbsViewer), false, `${how}: no leftover history step`);
  }
}

for (const [w, h, label] of [[375, 812, 'phone'], [1280, 800, 'laptop']]) {
  test(`browser: ticket facts line up and the screenshot viewer works, at ${w}px (${label})`, { skip, timeout: 280000 }, async () => {
    const srv = await startServer(), br = await (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
    const rctx = await br.newContext({ viewport: { width: w, height: h } }), hctx = await br.newContext({ viewport: { width: w, height: h } }), rp = await rctx.newPage(), hp = await hctx.newPage(), errors = [];
    for (const p of [rp, hp]) { p.setDefaultTimeout(30000); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/401|403|404|status of 4/.test(m.text())) errors.push(m.text()); }); }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-viewer-')), files = ['one.png', 'two.png', 'three.png'].map(n => { const f = path.join(tmp, n); fs.writeFileSync(f, PNG); return f; });
    try {
      const c = new Client(srv.base); await c.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await c.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
      await c.req('PUT', '/api/host/firewall/limits', { enabled: false, windowSec: 60, maxRequests: 100000, authMaxAttempts: 1000, authWindowSec: 60, banAfterViolations: 1000, banMinutes: 1 });
      await rp.goto(srv.base + '/app/'); await rp.click('[data-mode=signup]');
      await rp.fill('#bn', 'Viewer Co'); await rp.fill('#em', 'v@example.com'); await rp.fill('#un', 'vera'); await rp.fill('#pw', PW); await rp.check('#tc'); await rp.click('button.block');
      await rp.waitForSelector('#go'); const login = 'vera@' + (await rp.textContent('.codeblock')).trim(); await rp.click('#go');
      await fillLogin(rp, login); await rp.fill('#p', PW); await rp.click('button.block');
      await rp.waitForSelector('.recovery-key'); await rp.check('#ok'); await rp.click('#go'); await rp.waitForSelector('.menu-btn');

      // ---- the attach-preview thumbnails open the viewer too
      await rp.goto(srv.base + '/app/#/support/new'); await rp.waitForSelector('#ts');
      await rp.fill('#ts', 'Three pictures'); await rp.fill('#tm', 'See the screenshots.\n'.repeat(30));
      await rp.setInputFiles('[data-file]', files); await rp.waitForFunction(() => document.querySelectorAll('#pk .thumb').length === 3);
      assert.ok(await overflow(rp) <= 0, 'form with previews fits');
      await rp.click('#pk .shot-link >> nth=1'); await rp.waitForSelector('.sheet .viewer-img');
      assert.equal((await rp.textContent('.viewer-count')).trim(), '2 of 3'); assert.equal((await rp.textContent('.viewer-name')).trim(), 'two.png');
      assert.equal(await rp.locator('[data-tab]').isHidden(), true, 'a picture not sent yet has no new-tab link');
      await rp.keyboard.press('Escape'); await rp.waitForSelector('.scrim', { state: 'detached' });
      assert.equal(await rp.locator('#pk .thumb').count(), 3, 'the previews are still there'); assert.match(rp.url(), /#\/support\/new$/);
      await rp.click('#go'); await rp.waitForSelector('h1:has-text("T-1001")'); await rp.waitForSelector('.thread img.shot >> nth=2');

      // ---- in the ticket: opens in a sheet, fits, zooms, previous and next, download, new tab
      const ticketUrl = rp.url(); assert.equal(await rp.locator('.thread a[data-shot]').count(), 3);
      await rp.click('.thread .shot-link >> nth=0'); await rp.waitForSelector('.sheet .viewer-img'); await rp.waitForTimeout(350);
      assert.equal(rp.url(), ticketUrl, 'opening does not navigate'); assert.equal((await rp.textContent('.viewer-count')).trim(), '1 of 3');
      assert.equal(await rp.locator('[data-prev]').isDisabled(), true); assert.equal(await rp.locator('[data-next]').isDisabled(), false);
      const geo = await rp.evaluate(() => { const s = document.querySelector('.sheet').getBoundingClientRect(); return { l: s.left, r: s.right, vw: innerWidth, vh: innerHeight, b: s.bottom, t: s.top }; });
      assert.ok(geo.l >= 0 && geo.r <= geo.vw && geo.t >= 0 && geo.b <= geo.vh, 'the viewer fits the screen'); assert.ok(await overflow(rp) <= 0);
      if (w <= 640) assert.deepEqual(await smallTaps(rp, '.sheet .btn, .sheet .linkish'), [], 'taps are 44px'); if (w <= 640) assert.ok(geo.b >= geo.vh - 1, 'a bottom sheet on phones');
      assert.match(await rp.getAttribute('[data-dl]', 'href'), /^\/api\/app\/support\/attachments\//); assert.ok(await rp.getAttribute('[data-dl]', 'download'), 'Download has a file name');
      assert.equal(await rp.getAttribute('[data-tab]', 'target'), '_blank'); assert.match(await rp.getAttribute('[data-tab]', 'rel'), /noopener/); assert.ok(await rp.locator('[data-tab].linkish').count() === 1, 'Open in new tab is the small secondary link');
      await rp.click('[data-next]'); assert.equal((await rp.textContent('.viewer-count')).trim(), '2 of 3'); assert.equal((await rp.textContent('.viewer-name')).trim(), 'two.png');
      await rp.click('[data-next]'); assert.equal((await rp.textContent('.viewer-count')).trim(), '3 of 3'); assert.equal(await rp.locator('[data-next]').isDisabled(), true);
      await rp.keyboard.press('ArrowLeft'); assert.equal((await rp.textContent('.viewer-count')).trim(), '2 of 3'); await rp.click('[data-prev]'); assert.equal((await rp.textContent('.viewer-count')).trim(), '1 of 3');
      assert.equal(await rp.locator('.viewer-stage.zoomed').count(), 0); await rp.click('.viewer-img'); assert.equal(await rp.locator('.viewer-stage.zoomed').count(), 1, 'tap zooms in'); await rp.click('.viewer-img'); assert.equal(await rp.locator('.viewer-stage.zoomed').count(), 0, 'tap again zooms out');
      await rp.keyboard.press('Escape'); await rp.waitForSelector('.scrim', { state: 'detached' });
      await closesFourWays(rp, '.thread .shot-link', w); assert.ok(await overflow(rp) <= 0);

      // ---- the Host: facts line up, the viewer, and a Host-note screenshot stays Host-only
      await hp.goto(srv.base + '/host/'); await hp.waitForSelector('input'); const ins = await hp.$$('input'); await ins[0].fill('admin'); await ins[1].fill(PW); await hp.keyboard.press('Enter'); await hp.waitForSelector('.main');
      await hp.goto(srv.base + '/host/#/support/1001'); await hp.waitForSelector('h1:has-text("T-1001")'); await hp.waitForSelector('.thread img.shot >> nth=2');
      const pos = await hp.evaluate(() => { const first = (card) => { const dd = card.querySelector('.facts dd'), dt = card.querySelector('.facts dt'); const a = dd.getBoundingClientRect(), b = dt.getBoundingClientRect(); return { ddX: Math.round(a.left), dtX: Math.round(b.left), ddTop: Math.round(a.top), dtBottom: Math.round(b.bottom) }; };
        const cards = [...document.querySelectorAll('.card')].filter(x => x.querySelector('.facts')); return { n: cards.length, cards: cards.map(first), allDd: cards.flatMap(x => [...x.querySelectorAll('.facts dd')].map(d => Math.round(d.getBoundingClientRect().left))) }; });
      assert.equal(pos.n, 2, 'the ticket details card and the Requester card');
      if (w > 820) { assert.equal(pos.cards[0].ddX - pos.cards[0].dtX, pos.cards[1].ddX - pos.cards[1].dtX, 'the label column is the same width in both cards'); assert.ok(pos.cards[0].ddX - pos.cards[0].dtX >= 100, 'a real label column'); }
      else { for (const k of pos.cards) { assert.ok(k.ddTop >= k.dtBottom - 1, 'on a phone the label sits above its value'); assert.equal(k.ddX, k.dtX, 'and starts at the same left edge'); } }
      assert.ok(await overflow(hp) <= 0, 'Host ticket page does not scroll sideways');
      await closesFourWays(hp, '.thread .shot-link', w);
      await hp.click('.thread .shot-link >> nth=1'); await hp.waitForSelector('.sheet .viewer-img'); assert.equal((await hp.textContent('.viewer-count')).trim(), '2 of 3'); await hp.click('[data-next]'); assert.equal((await hp.textContent('.viewer-count')).trim(), '3 of 3'); await hp.keyboard.press('Escape');
      // a screenshot on an internal note: the Host can open it, the reseller cannot fetch it
      await hp.click('#mode [data-m=note]'); await hp.fill('#rb', 'Host-only picture.'); await hp.setInputFiles('#pk [data-file]', files[0]); await hp.waitForSelector('#pk .thumb'); await hp.click('#pk .shot-link'); await hp.waitForSelector('.sheet .viewer-img'); await hp.keyboard.press('Escape'); await hp.waitForSelector('.scrim', { state: 'detached' });
      await hp.click('#send'); await hp.waitForSelector('.msg.note img.shot');
      const href = await hp.getAttribute('.msg.note .shot-link', 'href'), id = href.split('/').pop();
      const hostGet = await hp.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, nosniff: r.headers.get('x-content-type-options'), csp: r.headers.get('content-security-policy'), type: r.headers.get('content-type') }; }, href);
      assert.equal(hostGet.s, 200); assert.equal(hostGet.nosniff, 'nosniff'); assert.match(hostGet.csp, /sandbox/); assert.equal(hostGet.type, 'image/png');
      assert.equal(await rp.evaluate(async (i) => (await fetch('/api/app/support/attachments/' + i)).status, id), 404, 'the reseller cannot fetch a Host-note screenshot');
      assert.ok(await overflow(hp) <= 0);
      assert.deepEqual(errors, []);
    } finally { await br.close(); srv.stop(); fs.rmSync(tmp, { recursive: true, force: true }); }
  });
}
