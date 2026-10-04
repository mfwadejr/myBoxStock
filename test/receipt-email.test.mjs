// TEST / receipt-email — a receipt is relayed to the customer straight away and never saved: not in the mail queue, not in the logs.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const PW = 'Sup3rSecretPass!', sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, host, smtp, got = [], port;
test.before(async () => {
  smtp = net.createServer((s) => {
    let data = '', inData = false; s.write('220 test\r\n');
    s.on('data', (b) => { for (const line of b.toString().split('\r\n')) {
      if (inData) { if (line === '.') { inData = false; got.push(data); data = ''; s.write('250 ok\r\n'); } else data += line + '\n'; continue; }
      if (/^(EHLO|HELO)/i.test(line)) s.write('250 test\r\n'); else if (/^(MAIL|RCPT)/i.test(line)) s.write('250 ok\r\n'); else if (/^DATA/i.test(line)) { inData = true; s.write('354 go\r\n'); } else if (/^QUIT/i.test(line)) { s.write('221 bye\r\n'); s.end(); } } });
  });
  await new Promise(r => smtp.listen(0, '127.0.0.1', r)); port = smtp.address().port;
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  await host.req('PUT', '/api/host/firewall/limits', { enabled: true, maxRequests: 5000, windowSec: 60, authMaxAttempts: 500, authWindowSec: 60, banAfterViolations: 50, banMinutes: 1 });
});
test.after(() => { srv?.stop(); smtp?.close(); });
const mailOn = (on) => host.req('PUT', '/api/host/mail', { enabled: on, mode: 'smtp', fromName: 'Site', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', port, secure: false, user: '', pass: '' } });

test('receipt email: refused while email is off, relayed when on, never stored', { skip: !sqlite && 'SQLite-only' }, async () => {
  const c = new Client(srv.base), r = await c.req('POST', '/api/app/signup', { businessName: 'Rec Co', email: 'rec@example.com', username: 'rita', password: PW });
  await c.req('POST', '/api/app/login', { resellerId: r.data.resellerId, username: 'rita', password: PW });
  const body = { to: 'buyer@example.com', receiptNo: 'S-1', text: 'Rec Co\nReceipt S-1\nTotal: $40.00' };
  let x = await c.req('POST', '/api/app/receipt-email', body); assert.equal(x.status, 400); assert.equal(x.data.code, 'RECEIPT_MAIL_OFF');
  await mailOn(true); await sleep(100);
  x = await c.req('POST', '/api/app/receipt-email', { ...body, to: 'not an address' }); assert.equal(x.status, 400); assert.equal(x.data.code, 'RECEIPT_MAIL_BAD');
  x = await c.req('POST', '/api/app/receipt-email', body); assert.equal(x.status, 200);
  const sent = got.find(m => /Total: \$40\.00/.test(m)); assert.ok(sent, 'the receipt reached the mail server');
  assert.match(sent, /Reply-To: rec@example\.com/i); assert.match(sent, /Receipt S-1 from Rec Co/);
  const { DatabaseSync } = await import('node:sqlite'); const d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db')); d.exec('PRAGMA busy_timeout = 5000');
  assert.equal(d.prepare('SELECT COUNT(*) n FROM mail_queue WHERE to_addr = ?').get('buyer@example.com').n, 0, 'not in the mail queue');
  await sleep(600);
  const logs = d.prepare('SELECT message, raw FROM event_log').all().map(l => l.message + ' ' + l.raw).join('\n');
  assert.ok(!/buyer@example\.com|\$40\.00/.test(logs), 'no address or content in the logs');
  assert.equal(d.prepare('SELECT n FROM receipt_mail_usage').get().n, 1);
});
