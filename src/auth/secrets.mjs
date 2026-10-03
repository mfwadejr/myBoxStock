// AUTH / secrets — AES-256-GCM encryption for secrets stored in the database (TOTP seeds, SMTP password).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../core/config.mjs';
import { areaLogger } from '../logging/logger.mjs';

const L = areaLogger('system');
let key;
function getKey() {
  if (key) return key;
  if (config.secretKey) { key = crypto.createHash('sha256').update(config.secretKey).digest(); return key; }
  const f = path.join(config.dataDir, 'secret.key');
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(f)) { fs.writeFileSync(f, crypto.randomBytes(32).toString('base64'), { mode: 0o600 }); L.warn('secret.key.created', 'Generated a new encryption key file. Back it up with your database.'); }
  key = Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'base64');
  return key;
}
export function seal(plain) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}
export function unseal(blob) {
  const [, iv, tag, enc] = blob.split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}
