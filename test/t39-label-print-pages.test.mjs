import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { startServer, fillLogin } from './helpers.mjs';
const exe = '/opt/pw-browsers/chromium'; const pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lblpdf-'));
const PW = 'Sup3rSecretPass!';
test('a 4x6 label prints on exactly one page, with no blank page before it', { timeout: 200000 }, async () => {
  const srv = await startServer(), br = await pw.chromium.launch({ executablePath: exe }), page = await br.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
    await page.fill('#bn', 'Label Co'); await page.fill('#em', 'l@example.com'); await page.fill('#un', 'lia'); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
    await page.waitForSelector('#go'); const login = 'lia@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
    await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.side');
    await page.evaluate(async () => {
      const A = AccountApp, S = A.store;
      const to = { name: 'Matt Avila', street: '64 Breakers Court', unit: '', city: 'St. Augustine', state: 'FL', zip: '32092', country: '' };
      await S.commit({ puts: [{ type: 'sale', data: { no: 'S-1', ts: Date.now() - 1000, customerId: null, customerName: 'Matt Avila', items: [{ id: 'x', make: 'Roku', model: 'Ultra', uid: 'U1', listPrice: 10000, pct: 0, price: 10000 }], total: 10000, subtotal: 10000, delivery: { type: 'shipping', shipTo: to, fee: 900, cost: 600, carrier: '', tracking: '', note: '', status: 'toship', shippedAt: 0, labelRef: '' } } }] });
      await S.saveConfig({ ...S.config(), label: { size: '4x6', look: 'plain', logo: 'none', customLogo: '', returnAddress: { name: 'myBoxStock.com', street: '13504 Halifax Drive', unit: '', city: 'Hagerstown', state: 'MD', zip: '21742', country: '' } } });
    });
    await page.goto(srv.base + '/app/#/sales'); await page.waitForSelector('tr.click'); await page.click('tr.click'); await page.waitForSelector('#dlabel'); await page.click('#dlabel'); await page.waitForSelector('.label');
    await page.evaluate(() => document.documentElement.classList.add('printing', 'printing-label')); await page.emulateMedia({ media: 'print' });
    const info = await page.evaluate(() => { const l = document.querySelector('.label'), r = l.getBoundingClientRect(); let chain = []; for (let e = l; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e), b = e.getBoundingClientRect(); chain.push(`${e.tagName.toLowerCase()}.${(e.className+'').split(' ').join('.')} pos=${cs.position} disp=${cs.display} ov=${cs.overflow} top=${Math.round(b.top)} h=${Math.round(b.height)} pad=${cs.paddingTop} mt=${cs.marginTop}`); } return { top: Math.round(r.top), chain }; });
    assert.equal(Math.round(info.top), 0, 'the label starts at the top of the page, not shifted by the window animation');
    for (const [name, opts] of [['css', { preferCSSPageSize: true }], ['104x159', { width: '104mm', height: '159mm', preferCSSPageSize: false }]]) {
      await page.pdf({ path: `${tmp}/real-${name}.pdf`, printBackground: true, ...opts });
      const d = fs.readFileSync(`${tmp}/real-${name}.pdf`); assert.equal((d.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length, 1, name + ': one label prints on exactly one page, no blank page first');
    }
  } finally { await br.close(); srv.stop(); }
});
