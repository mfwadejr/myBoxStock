// TEST / docs — both documentation sets are complete, well formed, linked correctly and searchable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, search, page, render } from '../src/services/docs/index.mjs';
import { startServer, Client } from './helpers.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const navKeys = (file, re) => [...fs.readFileSync(path.join(ROOT, file), 'utf8').matchAll(re)].map(m => m[1]);
// Menu keys come straight from the app's own menus, so a new menu item without a page fails this test.
const MENU = {
  reseller: navKeys('public/js/app/main.js', /\['([a-z]+)', '[^']+', (?:null|'[a-z.]+')\]/g),
  host: navKeys('public/js/host/icons.js', /\['([a-z]+)', '[A-Z][^']*'\]/g),
};

for (const realm of ['reseller', 'host']) {
  test(`${realm} docs: every menu item has a page, every page is well formed`, () => {
    const pages = load(realm), covered = new Set(pages.flatMap(p => p.covers));
    assert.ok(MENU[realm].length >= 9, 'found the menu');
    for (const k of MENU[realm]) assert.ok(covered.has(`nav:${k}`), `no ${realm} page covers the menu item "${k}"`);
    assert.ok(pages.length >= 14);
    const slugs = new Set(pages.map(p => p.slug)); assert.equal(slugs.size, pages.length, 'unique slugs');
    for (const p of pages) {
      assert.ok(p.title && p.summary && p.keywords.length >= 3 && p.covers.length >= 1, `${p.slug}: header is complete`);
      assert.ok(p.body.split(/\s+/).length >= 700, `${p.slug}: is a substantial page`);
      assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(p.body), `${p.slug}: no emoji`);
      for (const m of p.body.matchAll(/\]\(#\/docs\/([a-z0-9-]+)\)/g)) assert.ok(slugs.has(m[1]), `${realm}/${p.slug} links to a page that does not exist: ${m[1]}`);
      assert.ok(!/\]\((?!#\/docs\/)/.test(p.body), `${p.slug}: links stay inside the documentation`);
      assert.ok(!/<[a-z]/i.test(p.body.replace(/`[^`]*`/g, '')), `${p.slug}: no HTML`);
    }
  });

  test(`${realm} docs: search finds the page for every menu item and every thing a page says it covers`, () => {
    for (const p of load(realm)) for (const term of p.covers.filter(c => !c.startsWith('nav:') && c.length > 2)) {
      assert.ok(search(realm, term).some(r => r.slug === p.slug), `${realm}: searching "${term}" does not find ${p.slug}`);
    }
    for (const k of MENU[realm]) { const p = load(realm).find(x => x.covers.includes(`nav:${k}`)); assert.ok(search(realm, p.title).some(r => r.slug === p.slug), `${realm}: searching the title of ${p.slug}`); }
  });
}

test('reseller docs state that customers own their data and are responsible for it', () => {
  const all = load('reseller').map(p => p.body.toLowerCase()).join(' ');
  for (const phrase of ['recovery key', 'export', '100%']) assert.ok(all.includes(phrase), `mentions ${phrase}`);
  const own = load('reseller').find(p => p.slug === 'your-data-your-responsibility').body.toLowerCase();
  assert.match(own, /own/); assert.match(own, /responsib/); assert.match(own, /cannot (?:recover|read|see|open)/);
});

test('host docs cover the operator essentials', () => {
  const all = load('host').map(p => p.body).join(' ');
  for (const t of ['HOST_ALLOW_ANY', 'reset-host-admin', 'reset-server-options', 'Cloudflare', 'Site address', 'two-factor']) assert.ok(all.includes(t), `mentions ${t}`);
});

test('the renderer escapes HTML and only allows in-app links', () => {
  const h = render('## Hi <b>\n\nText with <script>x</script> and [bad](https://evil.example) and [ok](#/docs/inventory).\n\n- one\n- two\n\n> note').html;
  assert.ok(!h.includes('<script>') && !h.includes('<b>')); assert.ok(!h.includes('href="https://')); assert.ok(h.includes('href="#/docs/inventory"')); assert.ok(h.includes('<ul>') && h.includes('doc-note'));
});

test('docs are served to each console, behind sign-in, and kept apart', async () => {
  const srv = await startServer(); try {
    const host = new Client(srv.base), anon = new Client(srv.base);
    assert.equal((await anon.req('GET', '/api/host/docs')).status, 401); assert.equal((await anon.req('GET', '/api/app/docs')).status, 401);
    await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: 'Sup3rSecretPass!' });
    const toc = (await host.req('GET', '/api/host/docs')).data.pages; assert.ok(toc.some(p => p.slug === 'firewall')); assert.ok(!toc.some(p => p.slug === 'inventory'), 'the Host set has no reseller pages');
    const pg = (await host.req('GET', '/api/host/docs/firewall')).data; assert.ok(pg.html.includes('<h2>') && pg.next && pg.prev);
    assert.equal((await host.req('GET', '/api/host/docs/nope')).status, 404);
    assert.ok((await host.req('GET', '/api/host/docs/search?q=cloudflare')).data.results.length >= 1);
    const boss = new Client(srv.base); await boss.req('POST', '/api/app/signup', { businessName: 'Doc Co', email: 'doc@example.com', username: 'dora', password: 'Sup3rSecretPass!' });
    const login = (await boss.req('GET', '/api/host/me')).status; void login;
  } finally { await srv.stop(); }
});

test('the documentation viewer has one layout: contents menu and an open topic, no grid of topic boxes', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/shared/docs.js'), 'utf8');
  assert.ok(src.includes('doc-toc') && src.includes('doc-layout') && src.includes('doc-main'), 'menu-driven layout');
  assert.ok(!/grid g\d|class="card doc-hit"/.test(src), 'no grid of topic cards');
  for (const realm of ['reseller', 'host']) assert.equal(load(realm)[0].slug, 'getting-started', `${realm}: the landing page opens Getting started`);
});
