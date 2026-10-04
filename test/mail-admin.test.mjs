// TEST / mail-admin — Host email: port/TLS rules, failed messages can be resent, queue endpoint.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startServer, Client, sleep } from './helpers.mjs';

const sqlite = (process.env.DB_CLIENT || 'sqlite') === 'sqlite';
let srv, host;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  assert.equal((await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw })).status, 200);
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: 'Sup3rSecretPass!' });
});
test.after(() => srv?.stop());
const smtp = (o) => ({ enabled: true, mode: 'smtp', fromName: 'T', fromAddress: 'noreply@example.com', smtp: { host: '127.0.0.1', user: '', pass: '', ...o } });

test('TLS from the start forces port 465; port 465 without it, or a bad port, is refused', async () => {
  assert.equal((await host.req('PUT', '/api/host/mail', smtp({ secure: true, port: 587 }))).status, 200);
  assert.equal((await host.req('GET', '/api/host/mail')).data.settings.smtp.port, 465, 'TLS on stores 465');
  assert.equal((await host.req('PUT', '/api/host/mail', smtp({ secure: false, port: 465 }))).status, 400);
  assert.equal((await host.req('PUT', '/api/host/mail', smtp({ secure: false, port: 70000 }))).status, 400);
  assert.equal((await host.req('PUT', '/api/host/mail', smtp({ secure: false, port: 587 }))).status, 200);
  assert.equal((await host.req('GET', '/api/host/mail')).data.settings.smtp.port, 587);
});

test('failed messages go back to the queue one at a time or all at once', { skip: !sqlite && 'SQLite-only (edits the database file)' }, async () => {
  const { DatabaseSync } = await import('node:sqlite'), d = new DatabaseSync(path.join(srv.dir, 'myboxstock.db'));
  for (const id of ['f1', 'f2']) d.prepare("INSERT INTO mail_queue (id,to_addr,subject,body_text,body_html,status,attempts,last_error,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, `${id}@example.com`, 'Hello', 't', '<p>t</p>', 'failed', 5, 'boom', Date.now());
  d.close();
  let q = (await host.req('GET', '/api/host/mail/queue')).data.queue; assert.equal(q.filter(x => x.status === 'failed').length, 2);
  assert.equal((await host.req('POST', '/api/host/mail/f1/resend')).data.count, 1);
  q = (await host.req('GET', '/api/host/mail/queue')).data.queue; assert.notEqual(q.find(x => x.id === 'f1').status, 'failed', 'f1 was requeued');
  assert.equal(q.find(x => x.id === 'f2').status, 'failed', 'f2 untouched');
  assert.equal((await host.req('POST', '/api/host/mail/resend-failed')).data.count, 1);
  await sleep(300); q = (await host.req('GET', '/api/host/mail/queue')).data.queue; assert.equal(q.find(x => x.id === 'f2').attempts <= 1, true);
});
