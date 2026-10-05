// APP / backup-file — the full backup file: build it, read it, check it belongs to this account. Pure functions, no screens.
// The file is JSON. Readable on purpose: format, version, Reseller ID, time made, app version. Everything else is ciphertext:
// the records exactly as the server holds them (sealed with the account key) and a sealed index (ids, types, counts, newest date, a checksum).
// The key is wrapped inside the file under the person's password and under the recovery key, so the file is useless without one of them.
(() => {
  const FORMAT = 'myboxstock-backup', VERSION = 1, EXT = '.mbsbackup';
  const B = AccountApp.backupFile = { FORMAT, VERSION, EXT };
  const sha = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');
  const count = (index, type) => index.filter(r => r[1] === type).length;
  B.fileName = (accountCode, at = Date.now()) => { const d = new Date(at); return `myboxstock-backup-${accountCode}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${EXT}`; };

  // records: [{ id, type, rev, blob, created_at, updated_at }] as the server returned them. keys: the person's { salt, iters, wrappedAdk }. recoveryWrappedAdk: from /vault/recovery.
  B.build = async ({ adk, accountCode, appVersion, records, keys, recoveryWrappedAdk, now = Date.now() }) => {
    const blobs = records.map(r => r.blob), index = records.map(r => [r.id, r.type, r.rev, r.created_at || 0]);
    const manifest = { createdAt: now, newestAt: records.reduce((m, r) => Math.max(m, Number(r.updated_at) || 0), 0), index, digest: await sha(blobs.join('|')),
      counts: { devices: count(index, 'item'), customers: count(index, 'customer'), sales: count(index, 'sale'), records: records.length } };
    return JSON.stringify({ format: FORMAT, v: VERSION, account: accountCode, createdAt: now, app: appVersion, keys: { password: keys || null, recovery: recoveryWrappedAdk || null }, manifest: await Vault.seal(adk, manifest, accountCode, 'backup'), records: blobs });
  };

  // Reads and checks a file. Throws an Error whose message is plain English for the person. Returns { header, manifest, records: [{ id, type, rev, blob }] }.
  B.read = async (text, { adk, accountCode }) => {
    let f; try { f = JSON.parse(text); } catch { throw new Error('That file is not a myBoxStock backup. Choose a file that ends in ' + EXT + '.'); }
    if (!f || f.format !== FORMAT || typeof f.manifest !== 'string' || !Array.isArray(f.records)) throw new Error('That file is not a myBoxStock backup. Choose a file that ends in ' + EXT + '.');
    if (!Number.isInteger(f.v) || f.v > VERSION) throw new Error('That backup was made by a newer version of myBoxStock. Refresh this page to get the latest version, then try again.');
    if (String(f.account || '').toLowerCase() !== String(accountCode).toLowerCase()) throw new Error(`That backup belongs to a different account (Reseller ID ${f.account || 'unknown'}). This account is ${accountCode}, so it cannot be restored here.`);
    let m; try { m = await Vault.open(adk, f.manifest, accountCode, 'backup'); } catch { throw new Error('That backup was made with a different key, so this account cannot open it. If the account was set up again since, use the recovery key from the time the backup was made.'); }
    if (!Array.isArray(m.index) || m.index.length !== f.records.length || await sha(f.records.join('|')) !== m.digest) throw new Error('That backup file is damaged or incomplete (it may not have finished downloading). Use another copy.');
    return { header: { account: f.account, createdAt: f.createdAt, app: f.app, v: f.v }, manifest: m, records: m.index.map((x, i) => ({ id: x[0], type: x[1], rev: x[2], blob: f.records[i] })) };
  };
})();
