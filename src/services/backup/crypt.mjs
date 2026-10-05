// SERVICES / backup / crypt — encrypts a backup file before it leaves the server, and opens it again.
// Format "MBSENC1" (written by encryptFile, read by decryptFile and `node server.mjs decrypt-backup <file> <out>`):
//   8 bytes  magic "MBSENC1\n"
//   4 bytes  header length (big endian), then the header: JSON { kdf:"scrypt", N, r, p, salt, iv, chunk, gz:true } (salt and iv in base64)
//   then chunks until the end: 4 bytes ciphertext length (big endian) + AES-256-GCM ciphertext + 16-byte tag.
// The key is scrypt(passphrase, salt). Each chunk (1 MiB of the gzip-compressed file) has its own nonce (iv with the chunk number mixed
// into its last 4 bytes) and authenticates the header, the chunk number and whether it is the last one, so a swapped, cut or changed
// file is refused. Large files are processed a chunk at a time, never all in memory. Full-site bundles (.mbsbak) already use their own
// passphrase encryption and are sent as they are.
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('MBSENC1\n'), CHUNK = 1 << 20, KDF = { N: 1 << 15, r: 8, p: 1 };
const key = (pass, salt, k = KDF) => crypto.scryptSync(pass, salt, 32, { N: k.N, r: k.r, p: k.p, maxmem: 128 * 1024 * 1024 });
const nonce = (iv, n) => { const b = Buffer.from(iv); b.writeUInt32BE((b.readUInt32BE(8) ^ n) >>> 0, 8); return b; };
const aad = (header, n, last) => { const b = Buffer.alloc(5); b.writeUInt32BE(n); b[4] = last ? 1 : 0; return Buffer.concat([header, b]); };
export const ENC_EXT = '.mbsenc';
export const isEncryptedName = (n) => n.endsWith(ENC_EXT) || n.endsWith('.mbsbak');

async function* rechunk(readable) {
  let buf = Buffer.alloc(0);
  for await (const c of readable) { buf = buf.length ? Buffer.concat([buf, c]) : c; while (buf.length > CHUNK) { yield { data: buf.subarray(0, CHUNK), last: false }; buf = buf.subarray(CHUNK); } }
  yield { data: buf, last: true };
}

export async function encryptFile(src, dest, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), k = key(passphrase, salt);
  const header = Buffer.from(JSON.stringify({ kdf: 'scrypt', ...KDF, salt: salt.toString('base64'), iv: iv.toString('base64'), chunk: CHUNK, gz: true })), lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(header.length);
  const out = fs.createWriteStream(dest, { mode: 0o600 });
  const gz = fs.createReadStream(src).pipe(zlib.createGzip());
  const write = (b) => new Promise((res, rej) => out.write(b, (e) => e ? rej(e) : res()));
  try {
    await write(Buffer.concat([MAGIC, lenBuf, header]));
    let n = 0;
    for await (const { data, last } of rechunk(gz)) {
      const c = crypto.createCipheriv('aes-256-gcm', k, nonce(iv, n)); c.setAAD(aad(header, n, last));
      const ct = Buffer.concat([c.update(data), c.final(), c.getAuthTag()]), l = Buffer.alloc(4); l.writeUInt32BE(ct.length);
      await write(Buffer.concat([l, ct])); n++;
    }
    await new Promise((res, rej) => out.end((e) => e ? rej(e) : res()));
  } catch (e) { out.destroy(); fs.rmSync(dest, { force: true }); throw e; }
}

export async function decryptFile(src, dest, passphrase) {
  const fd = await fs.promises.open(src, 'r');
  try {
    const st = await fd.stat(), head = Buffer.alloc(MAGIC.length + 4);
    if (st.size < head.length + 20) throw new Error('This is not a myBoxStock encrypted backup copy.');
    await fd.read(head, 0, head.length, 0);
    if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('This is not a myBoxStock encrypted backup copy.');
    const hl = head.readUInt32BE(MAGIC.length), header = Buffer.alloc(hl); await fd.read(header, 0, hl, head.length);
    const h = JSON.parse(header.toString()), iv = Buffer.from(h.iv, 'base64'), k = key(passphrase, Buffer.from(h.salt, 'base64'), h);
    const gunzip = zlib.createGunzip(), done = pipeline(gunzip, fs.createWriteStream(dest, { mode: 0o600 })); done.catch(() => {});
    let pos = head.length + hl, n = 0;
    try {
      while (pos < st.size) {
        const l = Buffer.alloc(4); await fd.read(l, 0, 4, pos); const len = l.readUInt32BE(0); pos += 4;
        if (len < 16 || pos + len > st.size) throw new Error('truncated');
        const ct = Buffer.alloc(len); await fd.read(ct, 0, len, pos); pos += len;
        const d = crypto.createDecipheriv('aes-256-gcm', k, nonce(iv, n)); d.setAAD(aad(header, n, pos >= st.size)); d.setAuthTag(ct.subarray(len - 16));
        const plain = Buffer.concat([d.update(ct.subarray(0, len - 16)), d.final()]);
        if (!gunzip.write(plain)) await new Promise(r => gunzip.once('drain', r));
        n++;
      }
      if (!n) throw new Error('empty');
      gunzip.end(); await done;
    } catch (e) { gunzip.destroy(); await done.catch(() => {}); fs.rmSync(dest, { force: true }); throw new Error('Wrong passphrase, or the backup copy is damaged.'); }
  } finally { await fd.close(); }
}
