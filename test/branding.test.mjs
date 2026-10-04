// Branding: icons are linked from every page head, the files are served, and the logo is in the auth card and the header markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './helpers.mjs';

test('every page links the site icons and the icon files are served', async () => {
  const srv = await startServer();
  try {
    for (const page of ['/app/', '/host/']) {
      const html = await (await fetch(srv.base + page)).text();
      for (const href of ['/assets/favicon-32.png', '/favicon.ico', '/assets/apple-touch-icon.png', '/site.webmanifest']) assert.ok(html.includes(`href="${href}"`), `${page} links ${href}`);
    }
    for (const f of ['/assets/favicon-32.png', '/favicon.ico', '/assets/apple-touch-icon.png', '/assets/logo-512.png', '/site.webmanifest']) assert.equal((await fetch(srv.base + f)).status, 200, f);
    assert.match(await (await fetch(srv.base + '/host/')).text(), /<title>myBoxStock Host<\/title>/);
  } finally { srv.stop(); }
});

test('the logo image replaces the placeholder in auth cards and headers', () => {
  for (const f of ['public/js/app/main.js', 'public/js/host/main.js']) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(s.includes('class="logo" src="/assets/logo-512.png"'), `${f} auth card logo`);
    assert.ok(s.includes('class="brand-mark" src="/assets/logo-512.png"'), `${f} header logo`);
    assert.ok(!s.includes('▦'), `${f} no placeholder glyph`);
  }
});
