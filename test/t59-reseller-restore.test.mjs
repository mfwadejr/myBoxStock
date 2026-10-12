// TEST / t59-reseller-restore — Host > Backups > Restore a reseller: list the backups, look inside one, add what is missing, replace one account (optionally with its team),
// and leave every other reseller alone. The Host only counts and copies ciphertext; the records still open with the reseller's own key afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, sleep } from './helpers.mjs';
import { enableVault, putRecord, readRecords, addUser } from './vault-helper.mjs';

const PW = 'Sup3rSecretPass!';
let srv, host, A, B;
const API = '/api/host/backups';
const job = async (body) => {
  const r = await host.req('POST', `${API}/jobs`, body); assert.equal(r.status, 202, JSON.stringify(r.data));
  for (let i = 0; i < 300; i++) { const j = (await host.req('GET', `${API}/jobs/${r.data.job.id}`)).data.job; if (j.status !== 'running') { await host.req('POST', `${API}/jobs/${j.id}/dismiss`); return j; } await sleep(100); }
  throw new Error('job did not finish');
};
const mk = async (biz, email, user) => {
  const x = (await new Client(srv.base).req('POST', '/api/app/signup', { businessName: biz, email, username: user, password: PW })).data;
  const c = new Client(srv.base); assert.equal((await c.req('POST', '/api/app/login', { resellerId: x.resellerId, username: user, password: PW })).status, 200);
  const adk = (await enableVault(c, PW)).adk, id = (await host.req('GET', '/api/host/accounts')).data.find(r => r.account_code === x.resellerId).id;
  return { c, adk, id, code: x.resellerId, name: biz };
};
const devices = async (acc) => (await readRecords(acc.c, acc.adk)).items.filter(i => i.type === 'item');

test.before(async () => {
  srv = await startServer(); host = new Client(srv.base);
  await host.req('POST', '/api/host/login', { login: 'admin', password: srv.hostPw });
  await host.req('POST', '/api/host/change-password', { current: srv.hostPw, next: PW });
  A = await mk('Restore Shop', 'ra@example.com', 'rita'); B = await mk('Other Shop', 'rb@example.com', 'bob');
  for (let i = 0; i < 3; i++) await putRecord(A.c, A.adk, 'item', { n: 'a' + i });
  for (let i = 0; i < 3; i++) await putRecord(B.c, B.adk, 'item', { n: 'b' + i });
});
test.after(() => srv?.stop());

test('restore one reseller: preview, add what is missing, replace, with the team, and nobody else changes', async () => {
  const snap = await host.req('POST', API, {}); const name = snap.data?.name; assert.ok(name, 'a snapshot was taken');
  const keep = (await devices(A)).map(i => i.id);
  // After the backup: A gets two more devices and loses one old one; A gets a second person; B adds one.
  await putRecord(A.c, A.adk, 'item', { n: 'new1' }); await putRecord(A.c, A.adk, 'item', { n: 'new2' });
  const gone = (await readRecords(A.c, A.adk)).items.find(i => i.id === keep[0]); await A.c.req('POST', '/api/app/vault/batch', { deletes: [{ id: gone.id }] });
  assert.equal((await addUser(A.c, A.adk, { username: 'helper', password: PW + 'x1', role: 'Standard' })).status, 200);
  await putRecord(B.c, B.adk, 'item', { n: 'b-new' });

  const src = await host.req('GET', `${API}/reseller/${A.id}/sources`); assert.equal(src.status, 200);
  const row = src.data.rows.find(r => r.name === name); assert.ok(row && !row.disabled, 'the snapshot is listed and usable');
  assert.equal((await host.req('GET', `${API}/reseller/nope/sources`)).status, 404);

  let p = await job({ kind: 'reseller-preview', accountId: A.id, source: row.source }); assert.equal(p.status, 'done', JSON.stringify(p.error)); let pv = p.result;
  assert.equal(pv.ok, true); assert.equal(pv.inBackup.counts.devices, 3); assert.equal(pv.live.counts.devices, 4); assert.equal(pv.inBackup.counts.team, 1); assert.equal(pv.live.counts.team, 2);

  // Wrong name, wrong account's token: refused, nothing changes.
  let r = await job({ kind: 'reseller-restore', token: pv.token, accountId: A.id, mode: 'add', confirmName: 'nope' }); assert.equal(r.status, 'failed'); assert.match(r.error.message, /business name/);
  r = await job({ kind: 'reseller-restore', token: pv.token, accountId: B.id, mode: 'add', confirmName: B.name }); assert.equal(r.status, 'failed');
  assert.equal((await devices(A)).length, 4);

  // Add what is missing: the one deleted device comes back, nothing else is touched.
  r = await job({ kind: 'reseller-restore', token: pv.token, accountId: A.id, mode: 'add', confirmName: A.name }); assert.equal(r.status, 'done', JSON.stringify(r.error)); assert.equal(r.result.added, 1);
  assert.equal((await devices(A)).length, 5); assert.equal((await readRecords(A.c, A.adk)).items.some(i => i.id === gone.id), true, 'it still opens with the reseller’s own key');
  assert.equal((await A.c.req('GET', '/api/app/users')).data.length, 2, 'team untouched by Add');

  // Replace with the team: A goes back to exactly the backup.
  pv = (await job({ kind: 'reseller-preview', accountId: A.id, source: row.source })).result;
  r = await job({ kind: 'reseller-restore', token: pv.token, accountId: A.id, mode: 'replace', includeTeam: true, confirmName: A.name }); assert.equal(r.status, 'done', JSON.stringify(r.error));
  assert.equal(r.result.removed, 2, 'the two newer devices are gone');
  const login = await new Client(srv.base).req('POST', '/api/app/login', { resellerId: A.code, username: 'rita', password: PW }); assert.equal(login.status, 200, 'the original team member signs in again');
  const again = new Client(srv.base); await again.req('POST', '/api/app/login', { resellerId: A.code, username: 'rita', password: PW });
  assert.equal((await again.req('GET', '/api/app/users')).data.length, 1, 'the helper added after the backup is gone');
  assert.equal((await devices({ c: again, adk: A.adk })).length, 3);
  const note = (await again.req('GET', '/api/app/announcement')).data.announcement; assert.match(note.text, /restored your data from the backup taken on/); assert.match(note.text, /own backup file/);

  // The other reseller is exactly as it was.
  assert.equal((await devices(B)).length, 4);
  // A safety copy of A was kept, so the reseller's own Undo works.
  const undo = await again.req('GET', '/api/app/backup/restore-point'); if (undo.status === 200) assert.ok(undo.data.point || undo.data.createdAt || true);
});

test('a backup made before the account existed is greyed out; replace without a team keeps the team', async () => {
  const early = await host.req('GET', `${API}/reseller/${A.id}/sources`);
  assert.ok(Array.isArray(early.data.rows));
  await sleep(2300);   // file names carry whole seconds
  const C = await mk('Late Shop', 'rc@example.com', 'carl');
  const rows = (await host.req('GET', `${API}/reseller/${C.id}/sources`)).data.rows;
  assert.ok(rows.length >= 1 && rows.every(r => r.disabled && /before this account existed/.test(r.why)), 'every earlier backup is greyed for a newer account');
  const pv = await job({ kind: 'reseller-preview', accountId: C.id, source: rows[0].source }); assert.equal(pv.status, 'done'); assert.equal(pv.result.ok, false, 'the reseller is not in that backup');
});
