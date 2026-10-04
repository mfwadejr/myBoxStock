// SHARED / vault — browser-side encryption for account data (Web Crypto). The server only ever stores what this produces.
// Keys: ADK (account data key) encrypts records; each person's KEK (from their password) and the recovery key each wrap the ADK.
(() => {
  const subtle = globalThis.crypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
  const V = { ITERS: 600000, VERSION: 'v1' };

  const b64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
  const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
  V.b64 = b64; V.unb64 = unb64; V.random = rand;

  // Crockford base32 for the recovery key (no 0/O or 1/I/L mix-ups when typed back in).
  const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const toBase32 = (bytes) => { let bits = 0, val = 0, out = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += ALPHA[(val << (5 - bits)) & 31]; return out; };
  const fromBase32 = (text) => {
    const clean = String(text).toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1'); let bits = 0, val = 0; const out = [];
    for (const ch of clean) { const i = ALPHA.indexOf(ch); if (i < 0) throw new Error('That recovery key has a character that is not allowed.'); val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
    if (out.length < 32) throw new Error('That recovery key is too short.');
    return Uint8Array.from(out.slice(0, 32));
  };

  const aesKey = (raw, usages, extractable = false) => subtle.importKey('raw', raw, 'AES-GCM', extractable, usages);
  async function sealBytes(key, bytes, aad) {
    const iv = rand(12), ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad || '') }, key, bytes);
    return `${V.VERSION}.${b64(iv)}.${b64(ct)}`;
  }
  async function openBytes(key, blob, aad) {
    const [v, iv, ct] = String(blob).split('.'); if (v !== V.VERSION || !iv || !ct) throw new Error('Unreadable data.');
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc.encode(aad || '') }, key, unb64(ct)));
  }

  // ---- keys ----
  V.newAdk = () => subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  // Password-derived key-encryption key. Separate random salt from the sign-in hash, so the server cannot use its copy to unlock data.
  V.deriveKek = async (password, saltB64, iters = V.ITERS) => {
    const base = await subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iters }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };
  V.newSalt = () => b64(rand(16));
  V.wrapAdk = async (adk, kek) => sealBytes(kek, new Uint8Array(await subtle.exportKey('raw', adk)), 'adk');
  V.exportAdk = async (adk) => b64(await subtle.exportKey('raw', adk));
  V.importAdk = (b64) => aesKey(unb64(b64), ['encrypt', 'decrypt'], true);
  V.unwrapAdk = async (blob, kek) => aesKey(await openBytes(kek, blob, 'adk'), ['encrypt', 'decrypt'], true);
  // A person's key material for the server: { salt, iters, wrappedAdk }.
  V.keysFor = async (password, adk, iters = V.ITERS) => { const salt = V.newSalt(); return { salt, iters, wrappedAdk: await V.wrapAdk(adk, await V.deriveKek(password, salt, iters)) }; };
  V.unlock = async (password, keys) => V.unwrapAdk(keys.wrappedAdk, await V.deriveKek(password, keys.salt, keys.iters));

  // Recovery key: shown once, wraps the ADK for the account.
  V.newRecoveryKey = () => { const raw = rand(32), t = toBase32(raw); return { text: t.match(/.{1,4}/g).join('-'), raw }; };
  V.wrapWithRecovery = async (adk, recoveryText) => sealBytes(await aesKey(fromBase32(recoveryText), ['encrypt', 'decrypt']), new Uint8Array(await subtle.exportKey('raw', adk)), 'adk-recovery');
  V.unwrapWithRecovery = async (blob, recoveryText) => aesKey(await openBytes(await aesKey(fromBase32(recoveryText), ['encrypt', 'decrypt']), blob, 'adk-recovery'), ['encrypt', 'decrypt'], true);

  // ---- records ----  The id and type are bound into the ciphertext, so a record cannot be swapped for another.
  V.seal = (adk, obj, id, type) => sealBytes(adk, enc.encode(JSON.stringify(obj)), `${type}:${id}`);
  V.open = async (adk, blob, id, type) => JSON.parse(dec.decode(await openBytes(adk, blob, `${type}:${id}`)));
  V.newId = () => b64(rand(12)).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' })[c]);

  globalThis.Vault = V;
})();
