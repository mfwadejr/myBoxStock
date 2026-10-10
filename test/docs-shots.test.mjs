// TEST / docs-shots — screenshot lines in the documentation: ![Alt text](shot:NAME "Caption") must point at two real, small PNG files
// (public/assets/docs/NAME-laptop.png and NAME-phone.png) and carry alt text and a caption. Passes with no screenshots referenced yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, render, search, SHOT_RE, SHOT_DIR } from '../src/services/docs/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'), DIR = path.join(ROOT, 'public', 'assets', 'docs'), MAX = 250 * 1024;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('every shot: reference is well formed, has alt text and a caption, and both PNG files exist under 250 KB', () => {
  for (const realm of ['reseller', 'host']) for (const p of load(realm)) {
    for (const [i, raw] of p.body.split('\n').entries()) {
      const line = raw.trim(), where = `${realm}/${p.slug} line ${i + 1}`;
      if (!/\]\(shot:/.test(line) && !/^!\[/.test(line)) continue;
      const m = line.match(SHOT_RE); assert.ok(m, `${where}: an image must be exactly ![Alt text](shot:NAME "Caption text") on its own line`);
      const [, alt, name, cap] = m;
      assert.ok(alt.trim().length >= 5, `${where}: alt text is empty or too short`); assert.ok(cap.trim().length >= 5, `${where}: caption is empty or too short`);
      for (const size of ['laptop', 'phone']) {
        const f = path.join(DIR, `${name}-${size}.png`); assert.ok(fs.existsSync(f), `${where}: missing public/assets/docs/${name}-${size}.png`);
        assert.ok(fs.statSync(f).size <= MAX, `${where}: ${name}-${size}.png is over 250 KB`);
        assert.ok(fs.readFileSync(f).subarray(0, 8).equals(PNG), `${where}: ${name}-${size}.png is not a PNG`);
      }
    }
  }
});

test('every image file in public/assets/docs is a small PNG', () => {
  if (!fs.existsSync(DIR)) return;
  for (const f of fs.readdirSync(DIR).filter(f => !f.startsWith('.'))) {
    assert.match(f, /^[a-z0-9][a-z0-9-]*-(laptop|phone)\.png$/, `${f}: name is NAME-laptop.png or NAME-phone.png`);
    assert.ok(fs.statSync(path.join(DIR, f)).size <= MAX, `${f} is over 250 KB`);
  }
});

test('the renderer turns a shot line into a lazy, self-hosted picture with a caption, and never breaks the text around it', () => {
  const md = '## Step\n\nBefore the picture.\n\n![The Home page with stock counts](shot:reseller-home "Home on a laptop and a phone")\n\n1. First\n2. Second\n\nAfter.';
  const { html, sections } = render(md);
  assert.match(html, /<figure class="doc-shot"><picture><source media="\(max-width: 600px\)" srcset="\/assets\/docs\/reseller-home-phone\.png"><img src="\/assets\/docs\/reseller-home-laptop\.png" alt="The Home page with stock counts" loading="lazy" decoding="async"><\/picture><figcaption>Home on a laptop and a phone<\/figcaption><\/figure>/);
  assert.ok(html.includes('<p>Before the picture.</p>') && html.includes('<ol>') && html.includes('<p>After.</p>'));
  assert.doesNotMatch(html, /https?:|style=/); assert.ok(html.includes(SHOT_DIR));
  assert.match(sections[1].text, /Home on a laptop and a phone/, 'the caption is part of the searchable text');
  const hostile = render('![x" onerror="y](shot:a-b "c <script>")').html; assert.ok(!hostile.includes('<script>') && !hostile.includes('onerror="y'));
  const bad = render('![Alt](shot:../etc "Cap")\n\n![Alt](https://evil.example/x.png)').html; assert.ok(!bad.includes('<img') && !bad.includes('<figure'), 'only well formed shot: names become pictures');
});

test('a caption is found by the documentation search', async () => {
  const mod = await import('../src/services/docs/index.mjs');
  const withCaps = ['reseller', 'host'].flatMap(r => mod.load(r).flatMap(p => [...p.body.matchAll(/\]\(shot:[a-z0-9-]+\s+"([^"]+)"\)/g)].map(m => [r, p, m[1]])));
  for (const [r, p, cap] of withCaps) assert.ok(mod.search(r, cap.split(/\s+/).slice(0, 3).join(' ')).some(x => x.slug === p.slug), `${r}/${p.slug}: caption "${cap}" is searchable`);
  assert.ok(typeof search === 'function');
});
