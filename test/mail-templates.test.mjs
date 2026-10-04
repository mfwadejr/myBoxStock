// TEST / mail-templates — editable message wording: rules, live preview, saved wording is what gets sent, reset, plain-text twin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from './helpers.mjs';
import { render, TEMPLATES, problems, wording } from '../src/services/mail/templates.mjs';

let srv, host;
test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  assert.equal((await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw })).status, 200);
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: 'Sup3rSecretPass!' });
});
test.after(() => srv?.stop());

test('both versions are built from the same words; the button link also appears in the plain text; text is escaped; identifiers are bold', () => {
  const vars = { name: 'Sam <b>', link: 'https://example.com/r?a=1&b=2', accountCode: 'BX-1' };
  const m = render('password_reset', vars);
  assert.ok(m.html.includes('Sam &lt;b&gt;') && !m.html.includes('Sam <b>'), 'body is escaped');
  assert.ok(m.html.includes('href="https://example.com/r?a=1&amp;b=2"') && m.text.includes('Choose a new password: https://example.com/r?a=1&b=2'));
  assert.match(render('welcome', { ...vars, login: 'x@BX-1', url: 'https://e.com', trialLine: 't' }).html, /<b>BX-1<\/b>/);
  const custom = render('test', {}, { subject: 'Hi', title: 'Heading', body: 'One\n\nTwo\nlines' });
  assert.equal(custom.subject, 'Hi'); assert.ok(custom.html.includes('<h1') && custom.html.includes('>Heading<') && custom.html.includes('<p>One</p><p>Two<br>lines</p>'));
  assert.ok(custom.text.startsWith('Heading\n\nOne\n\nTwo\nlines'));
});

test('wording rules: unknown placeholders, missing required ones, empty and over-long fields are refused', () => {
  const base = wording('welcome', null);
  assert.deepEqual(problems('welcome', base), []);
  assert.ok(problems('welcome', { ...base, body: 'Hi {{nope}}' }).some(p => p.includes('{{nope}}')));
  assert.ok(problems('welcome', { ...base, subject: 'Hello', body: 'No id here' }).some(p => p.includes('{{accountCode}}')));
  assert.ok(problems('welcome', { ...base, title: '' }).length && problems('welcome', { ...base, body: 'x'.repeat(4001) + '{{accountCode}}' }).length && problems('welcome', { ...base, buttonLabel: ' ' }).length);
  assert.ok(problems('test', wording('test', null)).length === 0);
  assert.ok(problems('welcome', { ...base, body: 'Link {{link}} {{accountCode}}' }).some(p => p.includes('{{link}}')), 'a placeholder from another message is not allowed');
});

test('Messages API: list, live preview, save, sent wording follows the save, reset', async () => {
  let r = await host.req('GET', '/api/host/mail/templates'); assert.equal(r.status, 200);
  assert.deepEqual(r.data.templates.map(t => t.key).sort(), Object.keys(TEMPLATES).sort()); assert.ok(r.data.templates.every(t => !t.custom));
  const w = { subject: 'Custom subject', title: 'Custom heading', body: 'Line {{name}}', buttonLabel: '' };
  r = await host.req('POST', '/api/host/mail/templates/test/preview', w); assert.equal(r.status, 200);
  assert.equal(r.data.subject, 'Custom subject'); assert.ok(r.data.text.includes('Custom heading') && r.data.problems.length === 1, 'preview reports {{name}} is not allowed in this message');
  const page = await fetch(`${srv.base}/api/host/mail/templates/preview/${r.data.token}`, { headers: { Cookie: Object.entries(host.jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
  assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self'/); const html = await page.text(); assert.ok(html.includes('/assets/logo-email.png') && !html.includes('cid:'), 'logo points at the public file');
  assert.equal((await host.req('PUT', '/api/host/mail/templates/test', w)).status, 400, 'invalid wording is refused');
  assert.equal((await host.req('PUT', '/api/host/mail/templates/nope', w)).status, 404);
  const good = { ...w, body: 'Hello from the custom wording.' };
  r = await host.req('PUT', '/api/host/mail/templates/test', good); assert.equal(r.status, 200); assert.equal(r.data.template.custom, true);
  await host.req('POST', '/api/host/mail/test', { to: 'x@example.com' });
  let q = (await host.req('GET', '/api/host/mail/queue')).data.queue; assert.ok(q.some(m => m.subject === 'Custom subject'), 'the message sent uses the saved subject');
  r = await host.req('POST', '/api/host/mail/templates/test/test', { ...good, to: 'y@example.com' });
  q = (await host.req('GET', '/api/host/mail/queue')).data.queue; assert.ok(q.some(m => m.to_addr === 'y@example.com' && m.subject === '[Test] Custom subject'), 'a draft test is marked as a test');
  r = await host.req('DELETE', '/api/host/mail/templates/test'); assert.equal(r.data.template.custom, false);
  await host.req('POST', '/api/host/mail/test', { to: 'z@example.com' });
  q = (await host.req('GET', '/api/host/mail/queue')).data.queue; assert.ok(q.some(m => m.to_addr === 'z@example.com' && m.subject === 'myBoxStock test email'), 'back to the default wording');
});
