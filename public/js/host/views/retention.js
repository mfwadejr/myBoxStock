// HOST / views / retention — Data and retention: what is using space, one retention rule per kind of Host-side data, Prune now with a preview and a typed
// confirmation, Compact the database (a background job with the progress strip), and nightly automatic pruning. The Owner changes things; other
// administrators read. Customer business data is encrypted and is not on this page. Styling is the standard classes only.
(() => {
  const { esc, fmt, toast, busy, sheet, swap } = UI, api = (m, p, b) => Host.api(m, '/retention' + p, b);
  const n = (v) => Number(v).toLocaleString('en-US');
  const KINDS = {
    logs: { title: 'Activity log', unit: 'rows', suggest: 90, value: (d) => `${d} days`, blurb: 'The general log kept in the database: sign-ins, firewall events, mail delivery, system messages. The audit trail is not part of it.' },
    audit: { title: 'Audit trail', unit: 'entries', suggest: 730, value: (d) => d ? `${d} days` : 'Forever', blurb: 'What Host administrators did. Kept apart from the activity log. Never kept for less than a year, and the entries about retention itself are never pruned.' },
    tickets: { title: 'Closed support tickets', unit: 'tickets', suggest: 90, value: (d) => d ? `Purged after ${d} days closed` : 'Kept until purged', blurb: 'Closed tickets with their messages and screenshots. Open tickets are never touched.' },
    mail: { title: 'Mail history', unit: 'records', suggest: 30, value: (d) => `${d} days`, blurb: 'Sent and failed messages in the mail queue. Mail still waiting to go out is never touched.' },
    temp: { title: 'Temporary files', unit: 'items', suggest: 1, value: (d) => `${d} ${d === 1 ? 'day' : 'days'}`, blurb: 'Scratch folders from Test a backup file, files waiting in the holding folder, and half-made backup copies.' },
  };
  const SAVED = { logs: 'Saved in the server options (also on the Settings page).', audit: 'Saved in the database.', tickets: 'Saved in the database.', mail: 'Saved in the database.', temp: 'Saved in the database.' };
  const hours = Array.from({ length: 24 }, (_, h) => [String(h), `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`]);
  const stat = (label, value, note = '') => `<div class="card stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;

  Host.views.retention = async (main) => {
    const d = await api('GET', ''), R = d.rules, S = d.space, own = d.isOwner;
    const dbNote = S.database.reclaimable != null ? `${fmt.bytes(S.database.reclaimable)} of it is free space inside the file` : S.database.client;
    const rows = Object.keys(KINDS).map(k => {
      const K = KINDS[k], saved = k === 'logs' || R.saved[k];
      return `<div class="setting" data-kind="${k}"><div><div class="setting-title">${K.title} <span class="chip blue" data-val>${esc(K.value(R[k].days))}</span></div>
        <div class="setting-desc">${esc(K.blurb)}</div><div class="hint">${esc(saved ? SAVED[k] : 'Using the built-in default; nothing saved yet.')}${k === 'logs' ? ` Log files on disk rotate by size: ${d.logFiles.maxMb} MB each, ${d.logFiles.keep} kept.` : ''}</div>
        ${own ? `<div class="row wrap mt-sm"><button class="btn secondary small" data-change="${k}">Change</button><button class="btn secondary small" data-prune="${k}">Prune now</button></div>` : ''}</div></div>`;
    }).join('');
    const th = d.backups.frequentThin;
    swap(main, `${Host.head('Data and retention', 'What is using space, how long each kind of Host-side data is kept, and how to clean it up. Customer business data is encrypted and never touched here.')}
      <div id="job-strip"></div>
      ${own ? '' : '<div class="banner blue mb-lg">Only the Owner administrator can change rules, prune data or compact the database. You can read everything on this page.</div>'}
      <div class="grid g3">${stat('Database', S.database.bytes == null ? '—' : fmt.bytes(S.database.bytes), esc(dbNote))}${stat('Log files', fmt.bytes(S.logFiles.bytes), `${S.logFiles.files} files`)}${stat('Backup files', fmt.bytes(S.backups.bytes), 'in the backup folder')}
        ${stat('Ticket screenshots', fmt.bytes(S.screenshots.bytes), `${n(S.screenshots.count)} stored in the database`)}${stat('Temporary files', fmt.bytes(S.temp.bytes), `${S.temp.count} items`)}${stat('Free disk space', S.disk ? fmt.bytes(S.disk.free) : '—', S.disk ? `of ${fmt.bytes(S.disk.total)}` : '')}</div>
      <div class="card mt-lg"><h3>Biggest tables</h3><div class="sub">Size on disk, including indexes. Names only; the Host cannot open reseller records.</div>
        <div class="tablewrap">${S.database.tables.length ? `<table><thead><tr><th>Table</th><th class="right">Rows</th><th class="right">Size</th></tr></thead><tbody>${S.database.tables.map(t => `<tr><td class="ident">${esc(t.name)}</td><td class="right tab-num">${t.rows == null ? '—' : n(t.rows)}</td><td class="right tab-num">${fmt.bytes(t.bytes)}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Table sizes are not available for this database.</p>'}</div></div>
      <div class="card mt-lg"><h3>Retention rules</h3><div class="sub">One rule for each kind of data. Prune now shows what would go first and asks you to type PRUNE.</div>${rows}
        <div class="setting"><div><div class="setting-title">Backups <span class="chip">set on the Backups page</span></div><div class="setting-desc">Frequent snapshots keep every copy for ${th.fullHours} hours, then one an hour for ${th.hourlyHours} hours, one a day for ${th.dailyDays} days and one a week for ${th.weeklyWeeks} weeks. Safety copies are kept ${d.backups.safety.keepDays} days (the newest ${d.backups.safety.keepMin} always stay). Offsite copies are ${d.backups.offsite ? 'on' : 'off'}.</div>
          <div class="row wrap mt-sm"><a class="btn secondary small" href="#/backups">Open Backups</a></div></div></div></div>
      <div class="card mt-lg"><h3>Compact the database</h3><div class="sub">Deleting rows does not make the database file smaller; the space is only reused. Compacting rewrites the file and gives the unused space back to the disk. It runs as a background job, never beside a backup or restore, and the site may pause for a moment.</div>
        <div class="setting"><div><div class="setting-title">${S.database.reclaimable != null ? `About ${fmt.bytes(S.database.reclaimable)} can be given back` : 'Compact the database'}</div><div class="setting-desc">${d.sqlite ? 'Needs free disk space for a second copy of the database while it runs; this is checked first.' : 'Only needed for the built-in SQLite database. Your database server manages its own space.'}</div>
          ${own && d.sqlite ? '<div class="row wrap mt-sm"><button class="btn secondary small" id="compact">Compact database</button></div>' : ''}</div></div></div>
      <div class="card mt-lg"><div class="row spread"><div><h3>Automatic pruning</h3><div class="sub">Once a night, at the hour below (server time), rows older than their rule are removed and each prune is written to the audit trail as System. Nothing is removed from a row that is off.</div></div>
        <label class="switch"><input type="checkbox" id="auto-on" ${R.auto.enabled ? 'checked' : ''} ${own ? '' : 'disabled'} aria-label="Automatic pruning"><i></i></label></div>
        <div class="field mt-md"><label for="auto-hour">Hour of the night</label>${UI.select.html({ id: 'auto-hour', value: String(R.auto.hour), options: hours })}</div>
        ${Object.keys(KINDS).map(k => `<div class="setting"><div><div class="setting-title">${KINDS[k].title}</div><div class="setting-desc">${R.auto.kinds[k] ? 'Pruned automatically' : 'Manual only'}${!R[k].days ? '; has no age set, so nothing is pruned' : ''}</div></div><label class="switch"><input type="checkbox" data-auto="${k}" ${R.auto.kinds[k] ? 'checked' : ''} ${own ? '' : 'disabled'} aria-label="Prune ${esc(KINDS[k].title)} automatically"><i></i></label></div>`).join('')}
        <p class="hint mt-md">${d.state.lastRunAt ? `Last nightly run ${esc(fmt.date(d.state.lastRunAt))}${d.state.lastResult.length ? ': ' + d.state.lastResult.map(x => `${n(x.count)} ${KINDS[x.kind].title.toLowerCase()}`).join(', ') : ', nothing to remove'}.` : 'The nightly run has not happened yet.'}</p></div>`);

    Host.backups?.syncJob?.(d.job, d.busy);
    if (Host.backups) Host.backups.afterCompact = () => { if (Host.current === 'retention') Host.route(); };

    main.querySelectorAll('[data-change]').forEach(b => b.addEventListener('click', () => changeSheet(b.dataset.change, R, d)));
    main.querySelectorAll('[data-prune]').forEach(b => b.addEventListener('click', () => pruneSheet(b.dataset.prune, R)));
    main.querySelector('#compact')?.addEventListener('click', () => compactSheet(S));
    const saveAuto = async (body, undo) => { try { await api('PUT', '/auto', body); toast('Saved'); } catch (e) { undo?.(); toast(e.message, true); } Host.route(); };
    main.querySelector('#auto-on').addEventListener('change', (e) => saveAuto({ enabled: e.target.checked }, () => { e.target.checked = !e.target.checked; }));
    main.querySelector('#auto-hour').addEventListener('change', (e) => saveAuto({ hour: Number(UI.select.value(e.target)) }));
    main.querySelectorAll('[data-auto]').forEach(c => c.addEventListener('change', () => saveAuto({ kinds: { [c.dataset.auto]: c.checked } }, () => { c.checked = !c.checked; })));
  };

  async function changeSheet(kind, R, d) {
    const K = KINDS[kind], cur = R[kind].days, zero = kind === 'audit' ? '0 keeps it forever. Otherwise 365 days or more.' : kind === 'tickets' ? '0 means no automatic age: closed tickets stay until purged.' : '';
    const hint = { logs: 'From 7 to 730 days.', audit: zero, tickets: zero, mail: 'From 1 to 3650 days.', temp: 'From 1 to 365 days.' }[kind];
    const done = await sheet(`<h2>${esc(K.title)}</h2><p class="muted">${esc(K.blurb)}</p>
      <div class="field mt-md"><label for="rd">Days to keep</label><input type="number" class="num" id="rd" value="${cur}" min="0" inputmode="numeric"><div class="hint">${esc(hint)}</div></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="ok">Save</button></div>`,
    { onMount: (el, close) => { const ok = el.querySelector('#ok'); ok.addEventListener('click', () => busy(ok, async () => { try { close(await api('PUT', `/rules/${kind}`, { days: el.querySelector('#rd').value })); } catch (e) { toast(e.message, true); } })); } });
    if (done) { toast('Rule saved'); Host.route(); }
  }

  async function pruneSheet(kind, R) {
    const K = KINDS[kind], start = R[kind].days || K.suggest;
    const done = await sheet(`<h2>Prune ${esc(K.title.toLowerCase())}</h2><p class="muted">This permanently removes the ${esc(K.unit)} below. It cannot be undone, and it is recorded in the audit trail. Backups made earlier still hold them until those backups age out.</p>
      <div class="field mt-md"><label for="pd">Remove anything older than this many days</label><input type="number" class="num" id="pd" value="${start}" min="1" inputmode="numeric"></div>
      <div class="banner blue" id="pv" role="status">Checking…</div>
      <div class="field mt-md"><label for="tc">Type <b>PRUNE</b> to confirm</label><input type="text" id="tc" autocomplete="off"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="ok" disabled>Prune</button></div>`,
    { onMount: (el, close) => {
      const ok = el.querySelector('#ok'), tc = el.querySelector('#tc'), pd = el.querySelector('#pd'), pv = el.querySelector('#pv'); let seq = 0, count = 0;
      const sync = () => { ok.disabled = tc.value !== 'PRUNE' || !count; };
      const preview = async () => {
        const me = ++seq; count = 0; sync();
        try {
          const r = await api('GET', `/preview?kind=${kind}&days=${encodeURIComponent(pd.value)}`); if (me !== seq) return; count = r.count;
          pv.className = 'banner blue'; pv.textContent = r.count ? `This would remove ${n(r.count)} ${r.unit}, about ${fmt.bytes(r.bytes)}${r.detail ? ` (${r.detail})` : ''}, the oldest from ${r.oldest ? new Date(r.oldest).toLocaleDateString([], { dateStyle: 'medium' }) : 'n/a'}.` : `Nothing is older than ${r.days} days.`;
        } catch (e) { if (me === seq) { pv.className = 'banner red'; pv.textContent = e.message; } }
        sync();
      };
      let t; pd.addEventListener('input', () => { clearTimeout(t); t = setTimeout(preview, 250); }); tc.addEventListener('input', sync); preview();
      ok.addEventListener('click', () => busy(ok, async () => { try { close(await api('POST', '/prune', { kind, days: Number(pd.value), confirm: tc.value })); } catch (e) { toast(e.message, true); } }));
    } });
    if (done) { toast(`Removed ${n(done.count)} ${done.unit}`); Host.route(); }
  }

  async function compactSheet(S) {
    const done = await sheet(`<h2>Compact the database</h2><p class="muted">The database file is rewritten without its unused space${S.database.reclaimable != null ? ` (about ${fmt.bytes(S.database.reclaimable)})` : ''}. Nothing is lost. It runs in the background and the site may pause for a moment. It cannot start while a backup or restore is running.</p>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="ok">Compact now</button></div>`,
    { onMount: (el, close) => { const ok = el.querySelector('#ok'); ok.addEventListener('click', () => busy(ok, async () => { try { close(await api('POST', '/compact')); } catch (e) { toast(e.message, true); } })); } });
    if (done?.job) { Host.backups?.jobs?.set(done.job); toast('Compacting started'); }
  }
})();
