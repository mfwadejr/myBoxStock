// TEST / bundle-stream — full-site backups are written and opened as streams: round trip, old-format files still open, wrong passphrase, cut and
// changed files are refused with nothing left behind, and memory stays flat on a large file (set MBS_BIG_MB=3000 for the multi-GB run).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sealBundle, writeBundleFile, extractBundle, openBundle } from '../src/services/backup/bundle.mjs';

const PASS = 'a long backup passphrase';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mbs-bs-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const manifest = Buffer.from(JSON.stringify({ format: 2, app: 'myBoxStock', version: '0.0.1', engine: 'sqlite', createdAt: '2026-01-01T00:00:00Z', database: 'database.db' }));
const dbBytes = crypto.randomBytes(3_000_000);
const mk = async (name = 'v2.mbsbak') => { const f = path.join(tmp, name); fs.writeFileSync(path.join(tmp, name + '.db'), dbBytes); await writeBundleFile([['manifest.json', manifest], ['database.db', { file: path.join(tmp, name + '.db'), size: dbBytes.length }], ['secret.key', Buffer.from('KEYKEYKEY')]], f, PASS); return f; };
const leftovers = () => fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('mbs-bundle-'));

test('a new file is chunked (MBSBAK2), encrypted, and opens to the same bytes', async () => {
  const f = await mk(); assert.equal(fs.readFileSync(f).subarray(0, 8).toString(), 'MBSBAK2\n');
  assert.ok(!fs.readFileSync(f).includes(Buffer.from('KEYKEYKEY')));
  const x = await extractBundle(f, PASS); try {
    assert.equal(x.format, 2); assert.equal(x.manifest.engine, 'sqlite'); assert.ok(fs.readFileSync(x.files['database.db']).equals(dbBytes)); assert.equal(fs.readFileSync(x.files['secret.key'], 'utf8'), 'KEYKEYKEY');
  } finally { x.cleanup(); }
  assert.ok(!fs.existsSync(x.dir), 'the scratch folder is removed');
});

test('an existing (MBSBAK1) file still opens, by the streaming reader, and its damage is caught the same way', async () => {
  const f = path.join(tmp, 'v1.mbsbak'), buf = sealBundle([['manifest.json', manifest], ['database.db', dbBytes], ['secret.key', Buffer.from('OLDKEY')]], PASS); fs.writeFileSync(f, buf);
  assert.equal(openBundle(buf, PASS)['secret.key'].toString(), 'OLDKEY');
  const x = await extractBundle(f, PASS); try { assert.equal(x.format, 1); assert.ok(fs.readFileSync(x.files['database.db']).equals(dbBytes)); assert.equal(fs.readFileSync(x.files['secret.key'], 'utf8'), 'OLDKEY'); } finally { x.cleanup(); }
  const bad = Buffer.from(buf); bad[Math.floor(bad.length / 2)] ^= 1; fs.writeFileSync(path.join(tmp, 'v1bad.mbsbak'), bad);
  await assert.rejects(extractBundle(path.join(tmp, 'v1bad.mbsbak'), PASS), /Wrong passphrase, or the backup file is damaged/);
  fs.writeFileSync(path.join(tmp, 'v1cut.mbsbak'), buf.subarray(0, buf.length - 100)); await assert.rejects(extractBundle(path.join(tmp, 'v1cut.mbsbak'), PASS), /damaged/);
  await assert.rejects(extractBundle(f, 'not the passphrase!!'), /Wrong passphrase/);
});

test('wrong passphrase, foreign, empty, cut-short and changed files are refused and nothing is left behind', async () => {
  const f = await mk('v2b.mbsbak'), buf = fs.readFileSync(f), before = leftovers().length;
  await assert.rejects(extractBundle(f, 'not the passphrase!!'), /Wrong passphrase, or the backup file is damaged/);
  await assert.rejects(extractBundle(f, ''), /Wrong passphrase/);
  fs.writeFileSync(path.join(tmp, 'foreign'), 'hello world, definitely not a backup file at all'); await assert.rejects(extractBundle(path.join(tmp, 'foreign'), PASS), /not a myBoxStock full-site backup/);
  fs.writeFileSync(path.join(tmp, 'empty'), ''); await assert.rejects(extractBundle(path.join(tmp, 'empty'), PASS), /not a myBoxStock/);
  fs.writeFileSync(path.join(tmp, 'enc.mbsbak'), Buffer.concat([Buffer.from('MBSENC1\n'), buf.subarray(8)])); await assert.rejects(extractBundle(path.join(tmp, 'enc.mbsbak'), PASS), /not a myBoxStock/);
  for (const [label, edit] of [['cut mid-chunk', (b) => b.subarray(0, b.length - 5000)], ['cut at a chunk boundary', (b) => { let o = 8 + 4 + b.readUInt32BE(8); o += 4 + b.readUInt32BE(o); return b.subarray(0, o); }], ['one byte changed in the middle', (b) => { const c = Buffer.from(b); c[c.length >> 1] ^= 1; return c; }], ['last byte changed', (b) => { const c = Buffer.from(b); c[c.length - 1] ^= 1; return c; }], ['header changed', (b) => { const c = Buffer.from(b); c[8 + 4 + 20] ^= 1; return c; }], ['extra bytes appended', (b) => Buffer.concat([b, Buffer.from('xxxx')])]]) {
    const p = path.join(tmp, 'bad.mbsbak'); fs.writeFileSync(p, edit(buf));
    await assert.rejects(extractBundle(p, PASS), /Wrong passphrase, or the backup file is damaged|not a myBoxStock/, label);
  }
  assert.equal(leftovers().length, before, 'no scratch folder is left after a refusal');
  const own = fs.mkdtempSync(path.join(tmp, 'own-')); await assert.rejects(extractBundle(path.join(tmp, 'bad.mbsbak'), PASS, { dir: own })); assert.deepEqual(fs.readdirSync(own), [], 'a refused file leaves no part behind in a given folder either');
});

test('a part with an unexpected name is refused', async () => {
  const f = path.join(tmp, 'evil.mbsbak'); await writeBundleFile([['manifest.json', manifest], ['../escape.txt', Buffer.from('x')]], f, PASS);
  await assert.rejects(extractBundle(f, PASS), /damaged/); assert.ok(!fs.existsSync(path.join(tmp, '..', 'escape.txt')));
});

test('memory stays flat while a large full-site file is written and opened', { timeout: 900000 }, async () => {
  const mb = Number(process.env.MBS_BIG_MB) || 300, src = path.join(tmp, 'big.db'), out = path.join(tmp, 'big.mbsbak');
  const fd = fs.openSync(src, 'w'); const piece = crypto.randomBytes(1 << 20); for (let i = 0; i < mb; i++) { piece.writeUInt32BE(i, 0); fs.writeSync(fd, piece); } fs.closeSync(fd);
  let peak = 0; const base = process.memoryUsage().rss, t = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 25);
  try {
    await writeBundleFile([['manifest.json', manifest], ['database.db', { file: src, size: mb * (1 << 20) }], ['secret.key', Buffer.from('K')]], out, PASS);
    const x = await extractBundle(out, PASS); try { assert.equal(fs.statSync(x.files['database.db']).size, mb * (1 << 20)); } finally { x.cleanup(); }
  } finally { clearInterval(t); }
  const growth = (peak - base) / 1048576;
  console.log(`# ${mb} MB database: peak memory grew ${growth.toFixed(0)} MB (a load-everything version needs about ${Math.round(mb * 4.7)} MB)`);
  assert.ok(growth < 200, `memory grew ${growth.toFixed(0)} MB for a ${mb} MB file`);
});
