#!/usr/bin/env node
// TOOLS / a11y / audit — runs the axe-core accessibility checker over every reseller and Host screen (and the common sheets) at laptop and phone size, on Demo mode data.
//   node tools/a11y/audit.mjs [--axe PATH_TO_axe.min.js] [--out report.json] [--only reseller|host]
// Prints a summary by rule and writes the full list (rule, impact, page, size, selector, html) to --out. Made-up data only; nothing is changed in the app.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemo, startServer, prepareHost, launch, SIZES } from '../docs-shots/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const AXE = arg('axe', process.env.AXE_PATH || path.join(HERE, '../../node_modules/axe-core/axe.min.js'));
const OUT = arg('out', path.join(os.tmpdir(), 'a11y-report.json')), ONLY = arg('only', '');
const axeSrc = fs.readFileSync(AXE, 'utf8');
const RESELLER = ['home', 'sell', 'inventory', 'customers', 'sales', 'reports', 'team', 'settings', 'backup', 'activity', 'security', 'docs', 'support'];
const HOST = ['overview', 'alerts', 'accounts', 'support', 'pipeline', 'onboarding', 'plans', 'backups', 'email', 'firewall', 'security', 'settings', 'logs', 'audit', 'retention', 'demo', 'updates', 'docs'];
// Sheets and menus worth checking: [name, route, async open(page)]
const SHEETS = [
  ['inventory: add device', 'inventory', async (p) => { await p.click('#add'); await p.waitForSelector('.sheet'); }],
  ['inventory: device detail', 'inventory', async (p) => { await p.locator('tr.click, .card.click').first().click(); await p.waitForSelector('.sheet'); }],
  ['inventory: select mode', 'inventory', async (p) => { await p.click('#selmode'); await p.waitForTimeout(300); }],
  ['sales: sale detail', 'sales', async (p) => { await p.locator('tr.click, .card.click').first().click(); await p.waitForSelector('.sheet'); }],
  ['customers: customer detail', 'customers', async (p) => { await p.locator('tr.click, .card.click').first().click(); await p.waitForSelector('.sheet'); }],
];
const ctxOpts = (size) => { const S = SIZES[size]; return { viewport: { width: S.width, height: S.height }, deviceScaleFactor: 1, isMobile: S.mobile, hasTouch: S.mobile }; };

const findings = [];
const scan = async (page, where, size, kind) => {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] }));
  for (const v of r.violations) for (const n of v.nodes) findings.push({ kind, where, size, rule: v.id, impact: v.impact, help: v.help, selector: n.target.join(' '), html: n.html.slice(0, 160), why: (n.any[0]?.message || n.all[0]?.message || n.none[0]?.message || '').slice(0, 160) });
};
const settle = async (page) => { await page.waitForFunction(() => (document.querySelector('.main')?.innerText || '').trim().length > 20, null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(500); };
const closeSheets = async (page) => { await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.scrim').forEach(x => x.querySelector('[data-cancel], #done')?.click())); await page.waitForTimeout(250); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-a11y-')); let srv, br;
try {
  const logins = await buildDemo('demo3', dir); srv = await startServer(dir); const host = await prepareHost(srv); br = await launch();
  for (const size of ['laptop', 'phone']) {
    if (ONLY !== 'host') {
      const ctx = await br.newContext(ctxOpts(size)), page = await ctx.newPage(); page.setDefaultTimeout(20000); const L = logins.Owner, at = L.login.lastIndexOf('@');
      await page.goto(srv.base + '/app/'); await page.waitForSelector('#p'); await page.fill('#r', L.login.slice(at + 1)); await page.fill('#l', L.login.slice(0, at)); await page.fill('#p', L.password); await page.click('button.block'); await page.waitForSelector('.main'); await page.waitForTimeout(800);
      for (const k of RESELLER) { await page.evaluate((h) => { location.hash = h; }, '#/' + k); await settle(page); await scan(page, 'app/' + k, size, 'page'); }
      for (const [name, route, open] of SHEETS) { try { await closeSheets(page); await page.evaluate((h) => { location.hash = h; }, '#/' + route); await settle(page); await open(page); await page.waitForTimeout(400); await scan(page, 'app: ' + name, size, 'sheet'); } catch (e) { console.error(`skipped "${name}" (${size}): ${e.message.split('\n')[0]}`); } }
      await ctx.close();
    }
    if (ONLY !== 'reseller') {
      const ctx = await br.newContext(ctxOpts(size)), page = await ctx.newPage(); page.setDefaultTimeout(20000);
      await page.goto(srv.base + '/host/'); await page.waitForSelector('#u'); await page.fill('#u', host.login); await page.fill('#p', host.password); await page.click('#go'); await page.waitForSelector('.main'); await page.waitForTimeout(800);
      for (const k of HOST) { await page.evaluate((h) => { location.hash = h; }, '#/' + k); await settle(page); await scan(page, 'host/' + k, size, 'page'); }
      await ctx.close();
    }
  }
} finally { await br?.close(); srv?.stop(); }

fs.writeFileSync(OUT, JSON.stringify(findings, null, 1));
const by = {}; for (const f of findings) { const b = by[f.rule] ||= { rule: f.rule, impact: f.impact, help: f.help, nodes: 0, pages: new Set() }; b.nodes++; b.pages.add(f.where); }
console.log(`\n${findings.length} findings, ${Object.keys(by).length} kinds. Full list: ${OUT}\n`);
for (const b of Object.values(by).sort((a, b) => b.nodes - a.nodes)) console.log(`${String(b.nodes).padStart(5)}  ${b.impact.padEnd(9)} ${b.rule.padEnd(32)} ${b.pages.size} screens  ${b.help}`);
