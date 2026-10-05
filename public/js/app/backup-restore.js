// APP / backup-restore — making the backup file, saving it, and restoring from one (chunked, with a safety copy and automatic rollback). No screens here.
(() => {
  const A = AccountApp, S = A.store, api = (...a) => A.api(...a), E = A.backupEngine = {};
  const CHUNK_OPS = 150, CHUNK_CHARS = 1200000; // keep each save small enough for a phone and for the server's body limit
  let version = '';
  E.appVersion = async () => { if (!version) { try { version = (await (await fetch('/healthz')).json()).version || ''; } catch {} } return version || 'unknown'; };
  const serverRecords = async () => (await api('GET', '/vault/records')).records;

  // Reads everything the server holds (ciphertext), adds the wrapped keys, and returns the file text and counts for the log.
  E.makeFile = async () => {
    const records = await serverRecords(), rec = await api('GET', '/vault/recovery'), v = A.vault.state;
    const text = await A.backupFile.build({ adk: A.vault.adk, accountCode: A.me.accountCode, appVersion: await E.appVersion(), records, keys: v?.keys || null, recoveryWrappedAdk: rec.wrappedAdk });
    const c = { devices: 0, customers: 0, sales: 0, records: records.length }; for (const r of records) { if (r.type === 'item') c.devices++; else if (r.type === 'customer') c.customers++; else if (r.type === 'sale') c.sales++; }
    return { text, counts: c, name: A.backupFile.fileName(A.me.accountCode) };
  };
  // iPhone and iPad offer "Save to Files" through the share sheet; everything else gets a normal download. Returns true when the file was handed over.
  E.canShareFiles = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.mbsbackup', { type: 'application/octet-stream' })] })); } catch { return false; } };
  E.saveFile = async (text, name) => {
    const type = 'application/octet-stream';
    if (E.canShareFiles()) { try { await navigator.share({ files: [new File([text], name, { type })], title: name }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; } }
    UI.downloadBlob(name, new Blob([text], { type })); return true;
  };
  E.markMade = (counts) => api('POST', '/backup/made', counts);

  // Numbers and dates for the preview, from what the server holds right now (including anything this browser could not open).
  E.snapshot = async () => {
    const recs = await serverRecords(), c = { devices: 0, customers: 0, sales: 0, records: recs.length }; let newest = 0;
    for (const r of recs) { if (r.type === 'item') c.devices++; else if (r.type === 'customer') c.customers++; else if (r.type === 'sale') c.sales++; newest = Math.max(newest, Number(r.updated_at) || 0); }
    return { counts: c, newestAt: newest, recs };
  };

  const sizeOf = (p) => p.blob.length + 80;
  const chunks = (list) => { const out = []; let cur = [], n = 0; for (const x of list) { const w = x.blob ? sizeOf(x) : 60; if (cur.length && (cur.length >= CHUNK_OPS || n + w > CHUNK_CHARS)) { out.push(cur); cur = []; n = 0; } cur.push(x); n += w; } if (cur.length) out.push(cur); return out; };

  // Plan from the file and the server's current list. merge = only ids the account does not have. replace = make the account match the file.
  E.plan = (parsed, mode, current) => {
    const have = new Map(current.map(r => [r.id, r])), inFile = new Set(parsed.records.map(r => r.id)), puts = [], deletes = []; let unchanged = 0, replaced = 0, added = 0;
    for (const r of parsed.records) {
      const cur = have.get(r.id);
      if (!cur) { puts.push({ id: r.id, type: r.type, rev: 0, blob: r.blob }); added++; }
      else if (mode === 'replace') {
        if (cur.type !== r.type) { deletes.push({ id: r.id }); puts.push({ id: r.id, type: r.type, rev: 0, blob: r.blob }); replaced++; }
        else if (cur.blob === r.blob) unchanged++; else { puts.push({ id: r.id, type: r.type, rev: Number(cur.rev), blob: r.blob }); replaced++; }
      } else unchanged++;
    }
    let removed = 0; if (mode === 'replace') for (const cur of current) if (!inFile.has(cur.id)) { deletes.push({ id: cur.id }); removed++; }
    return { puts, deletes, added, replaced, removed, unchanged };
  };

  // progress(done, total). On any failure the safety copy is put back and the error says so.
  E.run = async (parsed, mode, progress = () => {}) => {
    await api('POST', '/backup/restore/begin', { accountCode: A.me.accountCode, mode }); // refuses a different account's file, then saves the safety copy
    try {
      const plan = E.plan(parsed, mode, (await E.snapshot()).recs), steps = [...chunks(plan.deletes).map(c => ({ deletes: c })), ...chunks(plan.puts).map(c => ({ puts: c }))], total = steps.length; let done = 0; progress(0, total);
      for (const step of steps) { await api('POST', '/vault/batch', { puts: step.puts || [], deletes: step.deletes || [] }); progress(++done, total); }
      await api('POST', '/backup/restore/done', { added: plan.added, replaced: plan.replaced, removed: plan.removed });
      S.reset(); await S.load(); return plan;
    } catch (e) {
      let back = false; try { await api('POST', '/backup/undo', { failed: true }); back = true; } catch {}
      S.reset(); try { await S.load(); } catch {}
      throw new Error(`The restore did not finish (${e.message}). ${back ? 'Your data was put back exactly as it was.' : 'Use “Undo last restore” on this page to put your data back as it was.'}`);
    }
  };
  E.undo = async () => { const r = await api('POST', '/backup/undo', {}); S.reset(); await S.load(); return r; };
})();
