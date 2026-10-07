// APP / backup-file — the full backup file: build it, read it, check it belongs to this account. Pure functions, no screens.
// The file is JSON. Readable on purpose: format, version, Reseller ID, time made, app version. Everything else is ciphertext:
// the records exactly as the server holds them (sealed with the account key) and a sealed index (ids, types, counts, newest date, a checksum).
// A sealed Team list (usernames, emails, roles; never passwords, two-factor secrets or sessions) travels with it, sealed with the same account key.
// The key is wrapped inside the file under the person's password and under the recovery key, so the file is useless without one of them.
(() => {
  const FORMAT = 'myboxstock-backup', VERSION = 1, EXT = '.mbsbackup';
  const B = AccountApp.backupFile = { FORMAT, VERSION, EXT };
  const sha = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');
  const count = (index, type) => index.filter(r => r[1] === type).length;
  B.fileName = (accountCode, at = Date.now()) => { const d = new Date(at); return `myboxstock-backup-${accountCode}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${EXT}`; };

  const PEOPLE_MAX = 500, ROLES = ['Administrator', 'Standard', 'View'];
  // Only these three fields ever go into the file. Passwords, two-factor secrets and sessions are never read here.
  B.cleanPeople = (list) => (Array.isArray(list) ? list : []).slice(0, PEOPLE_MAX).map(p => ({ username: String(p?.username || '').slice(0, 100), email: String(p?.email || '').slice(0, 254), role: String(p?.role || '').slice(0, 60) })).filter(p => p.username);
  B.teamBreakdown = (people) => { const o = {}; for (const p of people) o[p.role] = (o[p.role] || 0) + 1; return o; };
  B.teamText = (people) => { const b = B.teamBreakdown(people), names = [...ROLES.filter(r => b[r]), ...Object.keys(b).filter(r => !ROLES.includes(r))]; return names.map(r => `${b[r]} ${r}`).join(', '); };

  // records: [{ id, type, rev, blob, created_at, updated_at }] as the server returned them. keys: the person's { salt, iters, wrappedAdk }. recoveryWrappedAdk: from /vault/recovery.
  // team: [{ username, email, role }] (optional). When given, it is sealed with the account key and stored in the file.
  B.build = async ({ adk, accountCode, appVersion, records, keys, recoveryWrappedAdk, team, now = Date.now() }) => {
    const blobs = records.map(r => r.blob), index = records.map(r => [r.id, r.type, r.rev, r.created_at || 0]);
    const manifest = { createdAt: now, newestAt: records.reduce((m, r) => Math.max(m, Number(r.updated_at) || 0), 0), index, digest: await sha(blobs.join('|')),
      counts: { devices: count(index, 'item'), customers: count(index, 'customer'), sales: count(index, 'sale'), records: records.length } };
    const file = { format: FORMAT, v: VERSION, account: accountCode, createdAt: now, app: appVersion, keys: { password: keys || null, recovery: recoveryWrappedAdk || null }, manifest: await Vault.seal(adk, manifest, accountCode, 'backup'), records: blobs };
    if (team) file.team = await Vault.seal(adk, { people: B.cleanPeople(team) }, accountCode, 'team');
    return JSON.stringify(file);
  };

  const NOT_BACKUP = 'That file is not a myBoxStock backup. Choose a file that ends in ' + EXT + '.';
  const LABELS = { format: 'Is a myBoxStock backup file', account: 'Made for this account', key: 'Opens with this account’s key', complete: 'Complete and not damaged', records: 'Every record can be opened', team: 'Team list can be opened' };

  // Runs the checks one at a time and stops at the first failure. Never throws for a bad file. Returns { steps: [{ id, label, ok, detail?, message? }], parsed }.
  // ok is true (passed), false (failed) or null (not checked, because an earlier check failed). parsed is set only when every check passed.
  // records: true also opens every record (the test does; a restore does not need to).
  B.check = async (text, { adk, accountCode, records: deep = false }) => {
    const steps = []; let f, m, team = null, bad = false;
    const run = async (id, fn) => {
      if (bad) { steps.push({ id, label: LABELS[id], ok: null }); return; }
      try { steps.push({ id, label: LABELS[id], ok: true, detail: (await fn()) || '' }); } catch (e) { bad = true; steps.push({ id, label: LABELS[id], ok: false, message: e.message }); }
    };
    await run('format', async () => {
      try { f = JSON.parse(text); } catch { throw new Error(NOT_BACKUP); }
      if (!f || f.format !== FORMAT || typeof f.manifest !== 'string' || !Array.isArray(f.records)) throw new Error(NOT_BACKUP);
      if (!Number.isInteger(f.v) || f.v > VERSION) throw new Error('That backup was made by a newer version of myBoxStock. Refresh this page to get the latest version, then try again.');
    });
    await run('account', async () => {
      if (String(f.account || '').toLowerCase() !== String(accountCode).toLowerCase()) throw new Error(`That backup belongs to a different account (Reseller ID ${f.account || 'unknown'}). This account is ${accountCode}, so it cannot be restored here.`);
      return `Reseller ID ${f.account}`;
    });
    await run('key', async () => {
      try { m = await Vault.open(adk, f.manifest, accountCode, 'backup'); } catch { throw new Error('That backup was made with a different key, so this account cannot open it. If the account was set up again since, use the recovery key from the time the backup was made.'); }
    });
    await run('complete', async () => {
      if (!Array.isArray(m.index) || m.index.length !== f.records.length || await sha(f.records.join('|')) !== m.digest) throw new Error('That backup file is damaged or incomplete (it may not have finished downloading). Use another copy.');
      return `${m.index.length} records, checksum matches`;
    });
    if (deep) await run('records', async () => {
      for (let i = 0; i < m.index.length; i++) { try { await Vault.open(adk, f.records[i], m.index[i][0], m.index[i][1]); } catch { throw new Error('That backup file is damaged: one of its records cannot be opened (it may have been changed). Use another copy.'); } }
      return `${m.index.length} opened`;
    });
    if (f && typeof f.team === 'string') await run('team', async () => {
      try { team = B.cleanPeople((await Vault.open(adk, f.team, accountCode, 'team')).people); } catch { throw new Error('That backup file is damaged: its team list cannot be opened. Use another copy.'); }
      return `${team.length} team member${team.length === 1 ? '' : 's'}`;
    });
    const parsed = bad ? null : { header: { account: f.account, createdAt: f.createdAt, app: f.app, v: f.v }, manifest: m, team, records: m.index.map((x, i) => ({ id: x[0], type: x[1], rev: x[2], blob: f.records[i] })) };
    return { steps, parsed };
  };

  // ---- compare a file with the account as it is now (used by "Test a backup file"; nothing is changed) ----
  const KIND = { item: 'devices', customer: 'customers', sale: 'sales' }, kindOf = (t) => KIND[t] || 'other';
  // parsed: from check/read. recs: what the server holds now [{ id, type, rev }]. Works from ids and revisions only.
  // For each group: added (in the account, not in the file: made since), changed (both, revision differs), missing (in the file, not in the account now), same.
  B.compare = (parsed, recs) => {
    const now = new Map(recs.map(r => [r.id, r])), inFile = new Set(), by = { devices: {}, customers: {}, sales: {}, other: {} };
    for (const g of Object.values(by)) Object.assign(g, { added: 0, changed: 0, missing: 0, same: 0 });
    for (const r of parsed.records) { inFile.add(r.id); const c = now.get(r.id), g = by[kindOf(r.type)]; if (!c) g.missing++; else if (c.type !== r.type || Number(c.rev) !== Number(r.rev)) g.changed++; else g.same++; }
    for (const c of recs) if (!inFile.has(c.id)) by[kindOf(c.type)].added++;
    const total = { added: 0, changed: 0, missing: 0, same: 0 }; for (const g of Object.values(by)) for (const k of Object.keys(total)) total[k] += g[k];
    return { by, total, older: total.added > 0 || total.changed > 0 };
  };
  // people: the file's Team list. existing: the account's current members [{ username, email }]. Same matching as the restore: username or email.
  B.compareTeam = (people, existing) => {
    const names = new Set(existing.map(u => String(u.username || '').toLowerCase())), mails = new Set(existing.map(u => String(u.email || '').trim().toLowerCase()).filter(Boolean)); let already = 0;
    for (const p of people) if (names.has(String(p.username).toLowerCase()) || (p.email && mails.has(String(p.email).trim().toLowerCase()))) already++;
    return { already, wouldAdd: people.length - already };
  };

  // Reads and checks a file for a restore. Throws an Error whose message is plain English for the person.
  // Returns { header, manifest, team, records: [{ id, type, rev, blob }] }. team is null when the file has no Team list.
  B.read = async (text, ctx) => {
    const r = await B.check(text, ctx); if (r.parsed) return r.parsed;
    throw new Error(r.steps.find(s => s.ok === false).message);
  };
})();
