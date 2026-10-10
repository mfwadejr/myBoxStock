// HOST / views / logs — search every platform log: area, level, time range, free text (message, event, person, IP, Reseller ID),
// quick filters, "Load more" paging, and CSV/JSON export. Filters live in the page address so a search can be bookmarked.
(() => {
  const { esc, fmt, swap, toast } = UI;
  const LEVEL_CHIP = { debug: '', info: 'blue', warn: 'amber', error: 'red' };
  const H = 3600e3, D = 24 * H;
  const RANGES = [['1h', 'Last hour', H], ['24h', 'Last 24 hours', D], ['7d', 'Last 7 days', 7 * D], ['30d', 'Last 30 days', 30 * D], ['all', 'All time', 0], ['custom', 'Custom dates…', 0]];
  // Quick filters: one click sets several filters at once.
  const QUICK = [
    ['Problems today', { level: 'warn,error', range: '24h' }],
    ['Failed sign-ins', { area: 'auth', event: 'login.failed,login.blocked,mfa.failed', range: '7d' }],
    ['Lockouts and bans', { event: 'lockout.started,ban.created,request.banned,rate_limit.auth,rate_limit.requests', range: '7d' }],
    ['Errors', { area: 'error', range: '7d' }],
  ];
  const DEFAULTS = { area: '', level: '', range: '24h', q: '', event: '', account: '', from: '', to: '' };

  Host.views.logs = async (main) => {
    const areas = await Host.api('GET', '/logs/areas');
    const f = { ...DEFAULTS, ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || '')) };
    let next = null, shown = 0, total = null;
    const areaOpts = [['', 'All areas'], ...areas.map(a => [a.area, a.area])];
    const levelOpts = [['', 'All levels'], ['debug', 'debug'], ['info', 'info'], ['warn', 'warn'], ['error', 'error']];
    swap(main, `${Host.head('Logs', 'Every action is recorded in plain English and as raw JSON. Files are also written to the server’s log folder, one set per area.')}
      <div class="card"><div class="row wrap">
        ${UI.select.html({ id: 'area', options: areaOpts, value: f.area })}${UI.select.html({ id: 'level', options: levelOpts, value: f.level })}${UI.select.html({ id: 'range', options: RANGES.map(r => [r[0], r[1]]), value: f.range })}
        <input type="search" id="q" aria-label="Search the logs" placeholder="Search messages, events, people, IP addresses, Reseller IDs" class="grow" value="${esc(f.q)}"></div>
        <div class="row wrap mt-md" id="custom" hidden><div class="field mb-0"><label for="from">From</label><input type="date" id="from" value="${esc(f.from)}"></div><div class="field mb-0"><label for="to">To</label><input type="date" id="to" value="${esc(f.to)}"></div></div>
        <div class="row wrap mt-md">${QUICK.map(([l], i) => `<button class="btn secondary small" data-quick="${i}">${esc(l)}</button>`).join('')}<button class="btn secondary small" id="clear">Clear filters</button></div>
        <div class="hint" id="hint"></div>
        <div id="list" class="feed mt-md"></div><div id="more"></div>
        <div class="row wrap mt-md"><button class="btn secondary small" data-export="csv">Export CSV</button><button class="btn secondary small" data-export="json">Export JSON</button></div></div>`);
    const el = (id) => main.querySelector(id);

    // Turn the filter state into the API query string (time range -> from/to in milliseconds).
    const query = (extra = {}) => {
      const p = new URLSearchParams();
      for (const k of ['area', 'level', 'q', 'event', 'account']) if (f[k]) p.set(k, f[k]);
      if (f.range === 'custom') { if (f.from) p.set('from', Date.parse(f.from + 'T00:00:00')); if (f.to) p.set('to', Date.parse(f.to + 'T23:59:59')); }
      else { const r = RANGES.find(x => x[0] === f.range); if (r && r[2]) p.set('from', Date.now() - r[2]); }
      for (const [k, v] of Object.entries(extra)) p.set(k, v);
      return p.toString();
    };
    const remember = () => { const p = new URLSearchParams(); for (const k of Object.keys(DEFAULTS)) if (f[k] && f[k] !== DEFAULTS[k]) p.set(k, f[k]); history.replaceState(null, '', '#/logs' + (p.size ? '?' + p : '')); };
    const row = (r) => `<div class="log-line"><div class="log-meta"><span class="chip ${LEVEL_CHIP[r.level] || ''}">${esc(r.level)}</span><span class="chip">${esc(r.area)}</span><span class="ident">${esc(r.event)}</span><span>${fmt.dateTime(r.ts)}</span>
      ${r.actor ? `<span>${esc(r.actor)}</span>` : ''}${r.account_code ? `<span class="ident">${esc(r.account_code)}</span>` : ''}${r.ip ? `<span class="tab-num">${esc(r.ip)}</span>` : ''}<button class="linkish" data-raw="${r.id}">raw</button></div>
      <div class="log-message">${esc(r.message)}</div><pre class="log-raw hide" id="raw-${r.id}">${esc(JSON.stringify(JSON.parse(r.raw || '{}'), null, 2))}</pre></div>`;

    const paint = (more) => {
      const a = areas.find(x => x.area === f.area);
      el('#hint').textContent = a ? a.description : '';
      el('#custom').hidden = f.range !== 'custom';
      UI.more(el('#more'), { shown, total, noun: shown === 1 ? 'entry' : 'entries', more: !!next, load: () => load(true).catch(e => toast(e.message, true)) });
    };
    const load = async (more) => {
      const d = await Host.api('GET', '/logs?' + query(more && next ? { before: next } : {}));
      next = d.next; shown = (more ? shown : 0) + d.rows.length; if (!more) total = d.total;
      const html = d.rows.map(row).join('');
      if (more) el('#list').insertAdjacentHTML('beforeend', html); else el('#list').innerHTML = html || '<div class="empty">No matching entries. Try a wider time range or clear the filters.</div>';
      remember(); paint();
    };
    const refresh = () => load(false).catch(e => toast(e.message, true));

    for (const id of ['area', 'level', 'range']) el('#' + id).addEventListener('change', (e) => { f[id] = UI.select.value(e.target); if (id === 'area') f.event = ''; refresh(); });
    for (const id of ['from', 'to']) el('#' + id).addEventListener('change', (e) => { f[id] = e.target.value; refresh(); });
    let t; el('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; refresh(); }, 300); });
    el('#clear').addEventListener('click', () => { Object.assign(f, DEFAULTS); history.replaceState(null, '', '#/logs'); Host.route(); });
    main.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => { Object.assign(f, DEFAULTS, QUICK[b.dataset.quick][1]); history.replaceState(null, '', '#/logs?' + new URLSearchParams(f)); Host.route(); }));
    main.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/host/logs/export?format=${b.dataset.export}&${query()}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error((await res.json()).error);
        const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = /filename="([^"]+)"/.exec(res.headers.get('content-disposition'))?.[1] || 'logs'; a.click(); URL.revokeObjectURL(a.href);
        toast('Export downloaded');
      } catch (e) { toast(e.message, true); }
    }));
    el('#list').addEventListener('click', (e) => { const b = e.target.closest('[data-raw]'); if (b) el('#raw-' + b.dataset.raw).classList.toggle('hide'); });
    await load(false);
  };
})();
