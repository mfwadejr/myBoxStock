// APP / store — the account's records, decrypted in memory. Everything here happens in the browser; the server only holds ciphertext.
(() => {
  const TYPES = ['item', 'model', 'customer', 'sale'];
  const maps = () => Object.fromEntries(TYPES.map(t => [t, new Map()]));
  const S = AccountApp.store = { data: maps(), unreadable: 0 };

  S.reset = () => { S.data = maps(); S.unreadable = 0; };
  S.all = (type) => [...S.data[type].values()];
  S.get = (type, id) => S.data[type].get(id);

  // Fetch records; decrypt only the ones that are new or changed since last time.
  S.load = async () => {
    const { records } = await AccountApp.api('GET', '/vault/records'), seen = new Set(); S.unreadable = 0;
    for (const r of records) {
      seen.add(r.id); const cur = S.data[r.type]?.get(r.id); if (!S.data[r.type] || (cur && cur.rev === r.rev)) continue;
      try { S.data[r.type].set(r.id, { id: r.id, type: r.type, rev: r.rev, ts: r.updated_at, data: await Vault.open(AccountApp.vault.adk, r.blob, r.id, r.type) }); } catch { S.unreadable++; }
    }
    for (const t of TYPES) for (const id of [...S.data[t].keys()]) if (!seen.has(id)) S.data[t].delete(id);
  };

  // Save changes together, or not at all. puts: [{ type, id?, data }] (id omitted = new record); deletes: [{ type, id }]. Returns the ids of the puts.
  S.commit = async ({ puts = [], deletes = [] }) => {
    const body = { puts: [], deletes: deletes.map(d => ({ id: d.id })) }, ids = [];
    for (const p of puts) { const id = p.id || Vault.newId(), cur = S.get(p.type, id); ids.push(id); body.puts.push({ id, type: p.type, rev: cur ? cur.rev : 0, blob: await Vault.seal(AccountApp.vault.adk, p.data, id, p.type) }); }
    try { var res = await AccountApp.api('POST', '/vault/batch', body); }
    catch (e) { if (e.status === 409) await S.load(); throw e; }
    const now = Date.now();
    for (const r of res.records) { const p = body.puts.find(x => x.id === r.id), d = puts[ids.indexOf(r.id)].data; S.data[p.type].set(r.id, { id: r.id, type: p.type, rev: r.rev, ts: r.updated_at || now, data: d }); }
    for (const d of deletes) S.data[d.type].delete(d.id);
    return ids;
  };

  // ---- helpers shared by the views ----
  AccountApp.fmt = {
    money: (c) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((Number(c) || 0) / 100),
    cents: (str) => { const n = Number(String(str).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : 0; },
    dollars: (c) => c ? (c / 100).toFixed(2) : '',
    day: (t) => t ? new Date(t).toLocaleDateString([], { dateStyle: 'medium' }) : '—',
    when: (t) => t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—',
    ymd: (t) => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; },
  };
  // Reads the latest changes before showing a page, so two people working at once see each other's updates.
  AccountApp.fresh = async () => { await S.load(); };
})();
