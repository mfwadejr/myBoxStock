// TEST / site-url — the site address used in email links: Host setting wins over PUBLIC_URL, bad addresses are flagged, links use it.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';
import { urlProblem } from '../src/services/site/index.mjs';

const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';

test('which addresses are flagged', () => {
  assert.equal(urlProblem('https://app.myboxstock.com'), ''); assert.equal(urlProblem('https://app.myboxstock.com/'), '');
  for (const bad of ['', 'http://zimaos.local:9080', 'http://localhost:8080', 'http://192.168.1.118:9080', 'http://10.0.0.5', 'https://172.20.1.1', 'https://boxes.example.com', 'myserver', 'https://app.myboxstock.com/app', 'ftp://x.com']) assert.ok(urlProblem(bad), bad);
  assert.match(urlProblem('http://app.myboxstock.com'), /not secure/);
});

test('Host setting wins over PUBLIC_URL; the dashboard warns; emails link to the right address', { skip: !sqlite && 'SQLite-only (reads the mail queue)' }, async () => {
  const srv = await startServer({ PUBLIC_URL: 'http://zimaos.local:9080' }), host = new Client(srv.base);
  try {
    await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw }); await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
    await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
    let s = (await host.req('GET', '/api/host/settings')).data.site; assert.equal(s.fromEnv, true); assert.equal(s.url, 'http://zimaos.local:9080'); assert.ok(s.problem);
    assert.ok((await host.req('GET', '/api/host/dashboard')).data.siteUrlProblem, 'the Overview shows a warning');
    assert.equal((await host.req('PUT', '/api/host/settings', { siteUrl: 'not a url' })).status, 400);
    assert.equal((await host.req('PUT', '/api/host/settings', { siteUrl: 'https://app.myboxstock.com/path' })).status, 400);
    assert.equal((await host.req('PUT', '/api/host/settings', { siteUrl: 'https://app.myboxstock.com/' })).status, 200);
    s = (await host.req('GET', '/api/host/settings')).data.site; assert.deepEqual([s.saved, s.url, s.problem, s.fromEnv], ['https://app.myboxstock.com', 'https://app.myboxstock.com', '', false]);
    assert.equal((await host.req('GET', '/api/host/dashboard')).data.siteUrlProblem, '');
    await host.req('PUT', '/api/host/mail', { enabled: true, mode: 'smtp', fromName: 'T', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port: 587, secure: false, user: '', pass: '' } });
    await new Client(srv.base).req('POST', '/api/app/signup', { businessName: 'Link Co', email: 'link@example.com', username: 'lina', password: PW }); await sleep(300);
    const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000');
    const mails = d.prepare("SELECT subject, body_text FROM mail_queue WHERE to_addr = 'link@example.com'").all();
    assert.ok(mails.length >= 2); for (const m of mails) { assert.ok(!m.body_text.includes('zimaos.local'), m.subject); }
    assert.ok(mails.find(m => /Confirm your email/.test(m.subject)).body_text.includes('https://app.myboxstock.com/app/#/confirm/'));
    await host.req('PUT', '/api/host/settings', { siteUrl: '' }); assert.equal((await host.req('GET', '/api/host/settings')).data.site.url, 'http://zimaos.local:9080', 'cleared: back to PUBLIC_URL');
  } finally { srv.stop(); }
});
