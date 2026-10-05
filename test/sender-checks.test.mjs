// TEST / sender-checks — SPF, DMARC and DKIM lookups for the From address's domain, with a fake DNS resolver.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { openSqlite } from '../src/db/drivers.mjs';
import { migrate } from '../src/db/schema.mjs';
import { saveMailSettings } from '../src/services/mail/index.mjs';
import { mailRoutes } from '../src/routes/host/mail.mjs';
import { checkSender, domainOf, cleanSelector } from '../src/services/mail/sender-checks.mjs';

const dnsErr = (code) => Object.assign(new Error(code), { code });
// A fake resolver: name -> array of TXT chunk-lists, or an error code string.
const fake = (zone, asked = []) => ({ resolveTxt: async (name) => { asked.push(name); const v = zone[name]; if (typeof v === 'string') throw dnsErr(v); if (!v) throw dnsErr('ENOTFOUND'); return v; } });

test('finds SPF, DMARC and DKIM (joining split TXT strings), and names the selector that matched', async () => {
  const asked = [], r = await checkSender({ fromAddress: 'no-reply@example.com' }, fake({
    'example.com': [['v=spf1 include:_spf.relay.test ', '~all'], ['google-site-verification=abc']], '_dmarc.example.com': [['v=DMARC1; p=none; rua=mailto:d@example.com']], 'selector1._domainkey.example.com': [['v=DKIM1; k=rsa; p=MIGf']] }, asked));
  assert.equal(r.domain, 'example.com'); assert.equal(r.spf.status, 'found'); assert.equal(r.spf.record, 'v=spf1 include:_spf.relay.test ~all');
  assert.equal(r.dmarc.status, 'found'); assert.equal(r.dmarc.policy, 'none'); assert.match(r.dmarc.advice, /monitoring/);
  assert.equal(r.dkim.status, 'found'); assert.equal(r.dkim.selector, 'selector1'); assert.match(r.dkim.advice, /does not sign mail itself/);
  for (const s of ['default', 'selector1', 'selector2', 'google', 'k1', 'mail', 'dkim']) assert.ok(asked.includes(`${s}._domainkey.example.com`), 'tried ' + s);
});

test('reports Not found with plain advice, and only tries the selector the administrator typed', async () => {
  const asked = [], r = await checkSender({ fromAddress: 'a@example.org', selector: 'MySel' }, fake({ 'example.org': [['some other txt']] }, asked));
  assert.equal(r.spf.status, 'missing'); assert.match(r.spf.advice, /SPF tells receiving mail servers/); assert.equal(r.dmarc.status, 'missing'); assert.match(r.dmarc.advice, /_dmarc\.example\.org/);
  assert.equal(r.dkim.status, 'missing'); assert.equal(r.dkim.selector, 'mysel'); assert.match(r.dkim.advice, /only a problem if your relay does not sign/);
  assert.deepEqual(asked.filter(n => n.includes('_domainkey')), ['mysel._domainkey.example.org']);
});

test('a failing lookup is "could not check", not "not found"; a second SPF record is flagged', async () => {
  let r = await checkSender({ fromAddress: 'a@example.net' }, fake({ 'example.net': 'ESERVFAIL', '_dmarc.example.net': 'ETIMEOUT', ...Object.fromEntries(['default', 'selector1', 'selector2', 'google', 'k1', 'mail', 'dkim'].map(s => [`${s}._domainkey.example.net`, 'ECONNREFUSED'])) }));
  assert.equal(r.spf.status, 'unknown'); assert.equal(r.dmarc.status, 'unknown'); assert.equal(r.dkim.status, 'unknown');
  r = await checkSender({ fromAddress: 'a@example.net' }, fake({ 'example.net': [['v=spf1 -all'], ['v=spf1 +all']] })); assert.equal(r.spf.status, 'found'); assert.match(r.spf.advice, /more than one SPF record/);
});

test('no usable From address, and selector and domain parsing', async () => {
  assert.match((await checkSender({ fromAddress: '' }, fake({}))).error, /From address/);
  assert.equal(domainOf('No Reply <x@y.com>'), ''); assert.equal(domainOf('x@Sub.Example.COM'), 'sub.example.com'); assert.equal(cleanSelector('a b'), ''); assert.equal(cleanSelector('s1._x'), 's1._x');
});

test('the Health route uses the injected resolver, exposes DNS facts only, and refuses a bad selector', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-sc-')), db = await openSqlite(path.join(dir, 't.db')); await migrate(db);
  await saveMailSettings(db, { enabled: true, mode: 'smtp', fromName: 'X', fromAddress: 'no-reply@example.com', heloName: '', smtp: { host: 'smtp.example.com', port: 587, user: 'u', pass: 'secret-pass', secure: false } }, 'tester');
  const app = express(); app.use('/mail', mailRoutes(db, { resolver: fake({ 'example.com': [['v=spf1 -all']] }) }));
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}/mail/sender-checks`;
  try {
    const r = await (await fetch(base)).json(); assert.equal(r.domain, 'example.com'); assert.equal(r.spf.status, 'found'); assert.equal(r.dmarc.status, 'missing');
    assert.deepEqual(Object.keys(r).sort(), ['checkedAt', 'dkim', 'dmarc', 'domain', 'spf']); assert.doesNotMatch(JSON.stringify(r), /secret-pass|smtp\.example/);
    assert.equal((await fetch(base + '?selector=' + encodeURIComponent('bad name!'))).status, 400);
  } finally { srv.close(); await db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
