// HOST / views / audit — what Host administrators did, searchable. Settings changed, accounts suspended, passwords reset, backups run.
(() => {
  const { esc, fmt, swap, toast } = UI;
  const H = 3600e3, D = 24 * H;
  const RANGES = [['24h', 'Last 24 hours', D], ['7d', 'Last 7 days', 7 * D], ['30d', 'Last 30 days', 30 * D], ['all', 'All time', 0]];

  Host.views.audit = async (main) => {
    const [actors, types] = await Promise.all([Host.api('GET', '/audit/actors'), Host.api('GET', '/audit/types')]); let f = { actor: '', type: '', range: '30d', q: '' }, next = null, shown = 0, total = null;
    swap(main, `${Host.head('Audit trail', 'A plain record of what Host administrators did and who signed in to the Host Console: settings, accounts, firewall rules, bans, sign-ins and two-factor changes. Who, what, when and from where. It never includes anything from inside a reseller’s account.')}
      <div class="card"><div class="row wrap">${UI.select.html({ id: 'actor', options: [['', 'Everyone'], ...actors.map(a => [a, a])], value: '' })}${UI.select.html({ id: 'type', options: [['', 'All kinds of entry'], ...types.map(t => [t.id, t.label])], value: '' })}${UI.select.html({ id: 'range', options: RANGES.map(r => [r[0], r[1]]), value: f.range })}
        <input type="search" id="q" placeholder="Search actions, people, addresses, Reseller IDs" class="grow"></div>
        <div id="list" class="feed mt-md"></div><div id="more"></div></div>`);
    const el = (s) => main.querySelector(s);
    const query = (extra = {}) => { const p = new URLSearchParams(); if (f.actor) p.set('actor', f.actor); if (f.type) p.set('type', f.type); if (f.q) p.set('q', f.q); const r = RANGES.find(x => x[0] === f.range); if (r && r[2]) p.set('from', Date.now() - r[2]); for (const [k, v] of Object.entries(extra)) p.set(k, v); return p.toString(); };
    const line = (r) => `<div class="log-line"><div class="log-meta"><span>${esc(fmt.dateTime(r.ts))}</span><b>${esc(r.actor || 'System')}</b>${r.account_code ? `<span class="ident">${esc(r.account_code)}</span>` : ''}${r.ip ? `<span class="tab-num">${esc(r.ip)}</span>` : ''}<span class="chip" title="${esc(r.event)}">${esc(r.label || r.event)}</span></div><div class="log-message">${esc(r.message)}</div></div>`;
    const load = async (more) => {
      const d = await Host.api('GET', '/audit?' + query(more && next ? { before: next } : {})); next = d.next; shown = (more ? shown : 0) + d.rows.length; if (!more) total = d.total;
      const html = d.rows.map(line).join(''); if (more) el('#list').insertAdjacentHTML('beforeend', html); else el('#list').innerHTML = html || '<div class="empty">Nothing matches. Try a wider time range.</div>';
      UI.more(el('#more'), { shown, total, noun: shown === 1 ? 'action' : 'actions', more: !!next, load: () => load(true).catch(e => toast(e.message, true)) });
    };
    const refresh = () => load(false).catch(e => toast(e.message, true));
    for (const id of ['actor', 'type', 'range']) el('#' + id).addEventListener('change', (e) => { f[id] = UI.select.value(e.target); refresh(); });
    let t; el('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; refresh(); }, 300); });
    await load(false);
  };
})();
