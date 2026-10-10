// HOST / views / demo — Demo mode: the switch, the backup prompt, the size sets (Demo3, Demo300, Demo1000, Demo5000 and Custom) with their editable recipes, Build / Remove / Reset demo
// as background jobs, and the demo logins table (Show, Copy, Open, Reset password). Only demo-tagged accounts are ever touched. Styling is the standard classes only.
(() => {
  const { esc, fmt, toast, busy, sheet, confirmBox, swap } = UI, api = (m, p, b) => Host.api(m, '/demo' + p, b);
  const n = (v) => Number(v).toLocaleString('en-US');
  const mins = (s) => s < 90 ? `${s} seconds` : `${Math.max(1, Math.round(s / 60))} minutes`;
  const B = () => Host.backups, J = () => Host.backups.jobs;
  let data = null;   // the last page data, for the sheets

  const input = (id, label, value, hint = '') => `<div class="field"><label for="${id}">${esc(label)}</label><input type="number" class="num" id="${id}" value="${esc(value)}" min="0" inputmode="numeric">${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
  const mix = (id, label, obj, names) => `<div class="field"><label>${esc(label)}</label><div class="row wrap">${names.map(k => `<div class="field"><label for="${id}-${k}">${esc(k[0].toUpperCase() + k.slice(1))}</label><input type="number" class="num" id="${id}-${k}" value="${esc(obj[k])}" min="0" inputmode="numeric"></div>`).join('')}</div><div class="hint">Relative numbers: 20, 50, 30 means one in five, half and three in ten.</div></div>`;
  const ROLES = ['Administrator', 'Standard', 'View'], SHARES = ['sold', 'available', 'reserved', 'returned', 'damaged', 'archived'], PLANS = ['trial', 'free', 'paid'];

  // The recipe form (used by Edit recipe and Add a Custom set). Returns the HTML; recipeOf(el) reads it back.
  const recipeForm = (s) => `${input('r-accounts', 'Reseller accounts', s.accounts, 'The number of accounts signed up in this set.')}
    <div class="grid g3">${input('r-dmin', 'Fewest devices in an account', s.devices.min)}${input('r-dmax', 'Most devices in an account (the largest account)', s.devices.max)}${input('r-dbig', 'Very large accounts', s.devices.big, 'How many accounts get close to the most.')}</div>
    <div class="grid g2">${input('r-tmin', 'Fewest team members besides the Owner', s.team.min)}${input('r-tmax', 'Most team members besides the Owner', s.team.max)}</div>
    ${mix('r-role', 'Team roles', s.roles, ROLES)}${mix('r-share', 'Device states', s.shares, SHARES)}${mix('r-plan', 'Account status', s.status, PLANS)}
    <div class="grid g3">${input('r-cust', 'Customers per 100 sold devices', s.customersPer100Sold)}${input('r-per', 'Most devices in one sale', s.maxPerSale)}${input('r-hist', 'Months of sales history', s.historyMonths)}</div>
    ${input('r-seed', 'Random seed', s.seed, 'The same seed makes identical data every time.')}`;
  const recipeOf = (el) => {
    const v = (id) => Number(el.querySelector('#' + id).value), group = (id, names) => Object.fromEntries(names.map(k => [k, v(`${id}-${k}`)]));
    return { accounts: v('r-accounts'), devices: { min: v('r-dmin'), max: v('r-dmax'), big: v('r-dbig') }, team: { min: v('r-tmin'), max: v('r-tmax') }, roles: group('r-role', ROLES), shares: group('r-share', SHARES), status: group('r-plan', PLANS), customersPer100Sold: v('r-cust'), maxPerSale: v('r-per'), historyMonths: v('r-hist'), seed: v('r-seed') };
  };
  const estLine = (e) => `${n(e.accounts)} accounts, about ${n(e.users)} people, about ${n(e.devices)} devices (largest account ${n(e.largest)}), about ${n(e.records)} records, about ${fmt.bytes(e.bytes)}, about ${mins(e.seconds)}.`;

  // ---- the backup prompt, shared by Build, Remove and Reset demo ----
  // Resolves { backupConfirm } to send along, or null when the person cancels. A recent backup passes straight through.
  async function ensureBackup(what) {
    const { backup, overrideText } = await api('GET', '/backup');
    if (backup.recent) return { backupConfirm: '' };
    const last = backup.lastAt ? `The last full-site backup was ${esc(fmt.ago(backup.lastAt))}.` : 'No full-site backup is on record yet.';
    return sheet(`<h2>Take a backup first</h2><p class="muted">${esc(what)} changes a lot of rows. ${last} A backup is wanted from the last ${n(backup.maxAgeHours)} hours${backup.firstBuild ? ', and always before the first Build' : ''}. Backups leave demo accounts out by default, so restoring never brings demo data back.</p>
      <div id="bk-run" hidden>${B().progressHtml('bk-jp')}</div>
      <div class="field mt-md" id="bk-over"><label for="bk-t">Owner only: to go on without a backup, type <b>${esc(overrideText)}</b></label><input type="text" id="bk-t" autocomplete="off" ${data.isOwner ? '' : 'disabled'}></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn secondary" id="bk-skip" disabled>Continue without a backup</button><button class="btn" id="bk-now">Back up now</button></div>`,
    { onMount: (el, close) => {
      const skip = el.querySelector('#bk-skip'), t = el.querySelector('#bk-t'), now = el.querySelector('#bk-now');
      t.addEventListener('input', () => { skip.disabled = !data.isOwner || t.value !== overrideText; });
      skip.addEventListener('click', () => close({ backupConfirm: t.value }));
      now.addEventListener('click', async () => {
        now.disabled = true; skip.disabled = true; el.querySelector('#bk-run').hidden = false;
        const h = J().run('full-backup', {}, (j) => B().progressPaint(el.querySelector('#bk-jp'), j));
        try { const j = await h.done; if (j.status === 'done' && j.ok !== false) { toast('Backup made'); close({ backupConfirm: '' }); } else { toast(j.error?.message || j.summary || 'The backup did not finish.', true); now.disabled = false; } }
        catch (e) { toast(e.message, true); now.disabled = false; }
      });
    } });
  }

  // ---- actions ----
  const startJobCall = async (path, body) => { const r = await api('POST', path, body); J().set(r.job); };
  async function build(s) {
    const e = (await api('POST', '/estimate', { key: s.key })), heavy = e.heavy ? `<div class="banner mt-md">Building ${esc(s.name)} puts real load on this server while it runs. For Demo1000 and Demo5000, a test copy of the site is the better place.</div>` : '';
    const ok = await sheet(`<h2>Build ${esc(s.name)}</h2><p class="muted">This makes ${esc(estLine(e.estimate))} Real accounts are not read or changed.</p>${e.problem ? `<div class="banner red">${esc(e.problem.message)}${e.problem.clashes ? `<ul>${e.problem.clashes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</div>` : ''}${heavy}
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go" ${e.problem ? 'disabled' : ''}>Build</button></div>`, { onMount: (el, close) => el.querySelector('#go').addEventListener('click', () => close(true)) });
    if (!ok) return;
    const bk = await ensureBackup(`Building ${s.name}`); if (!bk) return;
    try { await startJobCall('/build', { set: s.key, backupConfirm: bk.backupConfirm }); toast('Build started'); } catch (er) { toast(er.message, true); }
  }
  async function removeOrReset(kind, s) {
    const set = s?.key || null, word = kind === 'reset' ? 'RESET' : 'REMOVE', label = kind === 'reset' ? 'Reset demo' : 'Remove';
    const pv = await api('GET', '/preview' + (set ? `?set=${encodeURIComponent(set)}` : ''));
    if (!pv.accounts) return toast('Nothing is built to ' + (kind === 'reset' ? 'reset' : 'remove') + '.', true);
    const bk = await ensureBackup(`${label} of ${s ? s.name : 'the demo data'}`); if (!bk) return;
    const body = kind === 'reset' ? 'The demo data is removed and built again with the current settings (the same seed gives the same data).' : 'The demo data is deleted for good. It cannot be undone, but real accounts are never selected.';
    const typed = await sheet(`<h2>${esc(label)}${s ? ' ' + esc(s.name) : ' all demo data'}</h2><p class="muted">${body}</p>
      <div class="banner blue">${n(pv.accounts)} demo accounts, ${n(pv.users)} people and about ${n(pv.records)} records (about ${fmt.bytes(pv.bytes)}) will be removed. ${n(pv.realAccounts)} real accounts will not be touched.</div>
      <div class="field mt-md"><label for="tc">Type <b>${word}</b> to confirm</label><input type="text" id="tc" autocomplete="off"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="go" disabled>${esc(label)}</button></div>`,
    { onMount: (el, close) => { const go = el.querySelector('#go'), tc = el.querySelector('#tc'); tc.addEventListener('input', () => { go.disabled = tc.value !== word; }); go.addEventListener('click', () => close(tc.value)); } });
    if (!typed) return;
    try { await startJobCall(kind === 'reset' ? '/reset' : '/remove', { set, confirm: typed, backupConfirm: bk.backupConfirm }); toast(kind === 'reset' ? 'Reset started' : 'Removal started'); } catch (er) { toast(er.message, true); }
  }
  async function editSet(s) {
    const done = await sheet(`<h2>${esc(s.name)} recipe</h2><p class="muted">Every number can be changed. Changes apply to the next Build.</p>${recipeForm(s)}<div class="banner blue mt-md" id="est" role="status">Working it out…</div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn secondary" id="rd">Reset to defaults</button><button class="btn" id="ok">Save</button></div>`,
    { wide: true, onMount: (el, close) => {
      const est = el.querySelector('#est'); let t, seq = 0;
      const refresh = async () => { const me = ++seq; try { const r = await api('POST', '/estimate', { key: s.key, recipe: recipeOf(el) }); if (me !== seq) return; est.className = r.problem ? 'banner red' : 'banner blue'; est.textContent = r.problem ? r.problem.message : estLine(r.estimate); } catch (e) { if (me === seq) { est.className = 'banner red'; est.textContent = e.message; } } };
      el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 300); }); refresh();
      const ok = el.querySelector('#ok'); ok.addEventListener('click', () => busy(ok, async () => { try { close(await api('PUT', `/sets/${s.key}`, recipeOf(el))); } catch (e) { toast(e.message, true); } }));
      const rd = el.querySelector('#rd'); rd.addEventListener('click', async () => { if (!await confirmBox({ title: `Reset ${s.name} to its defaults?`, body: 'Every number in this recipe goes back to its built-in default. Accounts already built are not changed.', confirmLabel: 'Reset to defaults' })) return; try { await api('POST', `/sets/${s.key}/reset`); close('reset'); } catch (e) { toast(e.message, true); } });
    } });
    if (done) { toast(done === 'reset' ? 'Reset to defaults' : 'Saved'); Host.route(); }
  }
  async function addCustom() {
    const base = { accounts: 10, devices: { min: 10, max: 300, big: 1 }, team: { min: 1, max: 3 }, roles: { Administrator: 20, Standard: 50, View: 30 }, shares: { sold: 55, available: 33, reserved: 2, returned: 4, damaged: 2, archived: 4 }, status: { trial: 40, free: 20, paid: 40 }, customersPer100Sold: 55, maxPerSale: 3, historyMonths: 12, seed: 1 };
    const done = await sheet(`<h2>Add a Custom set</h2><p class="muted">A Custom set has its own name and login, for example the name Pilot2 gives the logins pilot2, pilot2-std and pilot2-view. Use 3 to 20 letters and numbers, starting with a letter.</p>
      <div class="field"><label for="cn">Name</label><input type="text" id="cn" maxlength="20" autocomplete="off"></div>${recipeForm(base)}<div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="ok">Add set</button></div>`,
    { wide: true, onMount: (el, close) => { const ok = el.querySelector('#ok'); ok.addEventListener('click', () => busy(ok, async () => { try { close(await api('POST', '/sets', { name: el.querySelector('#cn').value.trim(), ...recipeOf(el) })); } catch (e) { toast(e.message, true); } })); } });
    if (done) { toast('Custom set added'); Host.route(); }
  }

  // ---- credentials ----
  const pwCell = (l) => l.id ? `<span class="ident" data-pw="${l.id}" aria-live="polite">••••••••••••</span>` : '<span class="muted">not built</span>';
  async function credAction(kind, l, cell) {
    try {
      if (kind === 'show') {
        const el = cell.querySelector('[data-pw]'); if (el.dataset.shown) { el.textContent = '••••••••••••'; delete el.dataset.shown; return; }
        const r = await api('POST', `/logins/${l.id}/show`); el.textContent = r.password; el.dataset.shown = '1';
        setTimeout(() => { if (el.isConnected && el.dataset.shown) { el.textContent = '••••••••••••'; delete el.dataset.shown; } }, 15000);
      } else if (kind === 'copy') {
        const r = await api('POST', `/logins/${l.id}/copy`); await navigator.clipboard.writeText(r.password); toast('Password copied');
      } else if (kind === 'open') {
        const r = await api('POST', `/logins/${l.id}/open`); window.open(r.url, '_blank', 'noopener');
      } else if (kind === 'reset') await resetPassword(l);
    } catch (e) { toast(e.message, true); }
  }
  async function resetPassword(l) {
    const own = data.isOwner ? `<div class="field mt-md"><label for="np">Choose your own password (12 or more characters), or leave empty to generate one</label><input type="password" id="np" autocomplete="new-password"></div>` : '<p class="hint">A strong password is generated for you.</p>';
    const done = await sheet(`<h2>Reset password</h2><p class="muted">${l.kind === 'filler' ? 'This changes the shared password of every other account in the set.' : `This changes the password of ${esc(l.username)}.`} Anyone signed in with it is signed out.</p>${own}
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="ok">Reset password</button></div>`,
    { onMount: (el, close) => { const ok = el.querySelector('#ok'); ok.addEventListener('click', () => busy(ok, async () => { try { close(await api('POST', `/logins/${l.id}/reset`, { password: el.querySelector('#np')?.value || '' })); } catch (e) { toast(e.message, true); } })); } });
    if (done) { toast('Password changed. Use Show to read it.'); }
  }
  const credHtml = (sets, canManage) => sets.map(s => `<div class="mt-lg" data-cred-set="${esc(s.key)}"><div class="row spread wrap"><h3>${esc(s.name)}</h3>${s.built ? `<span class="chip green">Built · ${n(s.counts.accounts)} accounts · ${n(s.counts.users)} people</span>` : '<span class="chip">Not built</span>'}</div>
    ${s.built ? `<div class="hint">Built ${esc(fmt.dateTime(s.builtAt))}.</div>` : ''}
    <div class="tablewrap"><table><thead><tr><th>Login</th><th>Sign-in name</th><th>Password</th><th>Actions</th></tr></thead><tbody>${s.logins.map(l => `<tr data-login="${l.id || ''}"><td>${esc(l.label)}<div class="hint">${esc(l.role)}</div></td><td class="ident">${esc(l.login || l.username)}</td><td>${pwCell(l)}</td>
      <td>${l.id && canManage ? `<div class="row wrap"><button class="btn secondary small" data-act="show" data-id="${l.id}" aria-label="Show or hide the password for ${esc(l.username)}">Show</button><button class="btn secondary small" data-act="copy" data-id="${l.id}" aria-label="Copy the password for ${esc(l.username)}">Copy</button>${l.kind === 'filler' ? '' : `<button class="btn secondary small" data-act="open" data-id="${l.id}" aria-label="Open as ${esc(l.username)}">Open as this reseller</button>`}<button class="btn secondary small" data-act="reset" data-id="${l.id}" aria-label="Reset the password for ${esc(l.username)}">Reset password</button></div>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></div>`).join('');

  const setCard = (s, can, busyNow) => {
    const b = s.built, e = s.estimate, partial = b && b.accounts < s.accounts;
    return `<div class="card mt-lg" data-set="${esc(s.key)}"><div class="card-head"><div><h3>${esc(s.name)}${s.custom ? ' <span class="chip">Custom</span>' : ''}</h3><div class="sub mb-0">${n(s.accounts)} reseller accounts. Logins: ${esc(s.key)}, ${esc(s.key)}-std and ${esc(s.key)}-view; the rest are filler for the Host numbers.</div></div>
        ${b ? `<span class="chip ${partial ? 'amber' : 'green'}">${partial ? 'Partly built' : 'Built'} · ${n(b.accounts)} accounts</span>` : '<span class="chip">Not built</span>'}</div>
      <div class="grid g4"><div class="card stat"><div class="stat-label">People</div><div class="stat-value small">${n(b ? b.users : e.users)}</div><div class="stat-note">${b ? 'built' : 'about, with the Owner'}</div></div>
        <div class="card stat"><div class="stat-label">Devices</div><div class="stat-value small">${n(e.devices)}</div><div class="stat-note">${n(s.devices.min)} to ${n(s.devices.max)} per account</div></div>
        <div class="card stat"><div class="stat-label">Largest account</div><div class="stat-value small">${n(e.largest)}</div><div class="stat-note">${n(s.devices.big)} very large</div></div>
        <div class="card stat"><div class="stat-label">Records</div><div class="stat-value small">${n(b ? b.records : e.records)}</div><div class="stat-note">${b ? 'stored, encrypted' : `about ${fmt.bytes(e.bytes)}, ${mins(e.seconds)}`}</div></div></div>
      ${s.accounts >= 1000 ? '<p class="hint">A set this big loads the live server while it builds. A test copy of the site is the better place for it.</p>' : ''}
      ${can ? `<div class="row wrap mt-md"><button class="btn" data-do="build" ${busyNow || b || !data.enabled ? 'disabled' : ''}>Build</button><button class="btn secondary" data-do="edit">Edit recipe</button><button class="btn secondary" data-do="defaults">Reset to defaults</button>${b ? '<button class="btn secondary" data-do="reset">Reset demo</button><button class="btn danger" data-do="remove">Remove</button>' : ''}${s.custom && !b ? '<button class="btn secondary" data-do="delete">Delete set</button>' : ''}</div>` : ''}</div>`;
  };

  Host.views.demo = async (main) => {
    const [d, logins] = await Promise.all([api('GET', ''), api('GET', '/logins')]);
    data = d; const can = d.canManage, bk = d.backup, j = d.job, offerCompact = j && /^demo-(remove|reset)$/.test(j.kind) && j.status === 'done' && j.ok !== false && d.sqlite;
    swap(main, `${Host.head('Demo mode', 'Made-up reseller accounts for testing, screenshots and measuring. Real accounts, data and settings are never touched.')}
      <div id="job-strip"></div>
      ${can ? '' : '<div class="banner blue mb-lg">Only the Owner and Administrator roles can change Demo mode or see demo passwords. You can read this page.</div>'}
      ${offerCompact ? `<div class="banner blue mb-lg" id="dm-compact"><b>Demo data removed.</b> The database file does not shrink by itself. <div class="row wrap mt-sm"><button class="btn secondary small" id="dm-compact-go">Compact the database</button><a class="btn secondary small" href="#/retention">Open Data and retention</a></div></div>` : ''}
      <div class="banner blue mb-lg">Demo accounts are marked DEMO, count in the Host numbers, never send email and are never billed. Only accounts carrying the demo tag are ever built, reset or removed. ${n(d.realAccounts)} real accounts are not touched.</div>
      <div class="card"><div class="row spread"><div><h3>Demo mode</h3><div class="sub mb-0">Off by default. While it is off, demo logins cannot sign in.${d.totals.accounts ? ` ${n(d.totals.accounts)} demo accounts exist now.` : ''}</div></div>
        <label class="switch"><input type="checkbox" id="dm-on" ${d.enabled ? 'checked' : ''} ${can ? '' : 'disabled'} aria-label="Demo mode"><i></i></label></div></div>
      <div class="card mt-lg" id="dm-backup"><div class="card-head"><div><h3>Backup first</h3><div class="sub mb-0">Build, Remove and Reset demo ask for a full-site backup made in the last ${n(bk.maxAgeHours)} hours. The existing full-site backup runs as a background job and the action continues.</div></div>
        <span class="chip ${bk.recent ? 'green' : 'amber'}">${bk.recent ? 'Recent backup' : 'No recent backup'}</span></div>
        <div class="setting"><div><div class="setting-title">${bk.lastAt ? `Last full-site backup ${esc(fmt.ago(bk.lastAt))}` : 'No full-site backup yet'}</div><div class="setting-desc">${bk.lastAt ? `${esc(fmt.dateTime(bk.lastAt))} · ${esc(bk.name || '')} · ${bk.size ? esc(fmt.bytes(bk.size)) : ''}${bk.verified ? ' · verified' : ''}` : 'Set a backup passphrase on the Backups page first.'}${bk.lastFail ? ` Last failure: ${esc(fmt.ago(bk.lastFail.at))}.` : ''}</div></div>
        ${can ? `<button class="btn secondary small" id="dm-bk" ${d.busy ? 'disabled' : ''}>Back up now</button>` : ''}</div></div>
      ${d.sets.map(s => setCard(s, can, !!d.busy)).join('')}
      ${can ? '<div class="row wrap mt-lg"><button class="btn secondary" id="dm-add">Add a Custom set</button></div>' : ''}
      <div class="card mt-lg" id="dm-creds"><h3>Demo logins</h3><div class="sub">Passwords are made when a set is built and kept sealed with the server key. Show, Copy, Open and Reset password are recorded in the audit trail. Open signs you in without typing; normal sign-in limits still apply.</div>${credHtml(logins.sets, can && logins.canManage)}</div>
      <div class="card mt-lg" id="dm-opts"><h3>Options and safety limits</h3><div class="sub">These apply to every set.</div>
        <div class="grid g3">${input('o-age', 'Hours before a backup counts as old', d.options.backupMaxAgeHours)}${input('o-acc', 'Most accounts in one build', d.options.limits.accounts)}${input('o-dev', 'Most devices in one account', d.options.limits.devicesPerAccount)}</div>
        <div class="grid g3">${input('o-rec', 'Most records in one build', d.options.limits.records)}</div>
        <div class="setting"><div><div class="setting-title">Leave demo accounts out of backups</div><div class="setting-desc">On by default, so restoring a full-site backup never brings demo data back. Applies to SQLite full-site backups; a PostgreSQL or MariaDB dump is always whole.</div></div><label class="switch"><input type="checkbox" id="o-ex" ${d.options.excludeFromBackups ? 'checked' : ''} ${can ? '' : 'disabled'} aria-label="Leave demo accounts out of backups"><i></i></label></div>
        <div class="setting"><div><div class="setting-title">Use the real Plans page as a ceiling</div><div class="setting-desc">Off by default. When on, no demo account gets more devices than the largest plan allows. The Plans page itself is never changed.</div></div><label class="switch"><input type="checkbox" id="o-plan" ${d.options.usePlanCeiling ? 'checked' : ''} ${can ? '' : 'disabled'} aria-label="Use the real Plans page as a ceiling"><i></i></label></div>
        ${can ? '<div class="row wrap mt-md"><button class="btn" id="o-save">Save options</button><button class="btn secondary" id="o-reset">Reset all demo settings to defaults</button></div>' : ''}</div>
      ${can && d.totals.accounts ? '<div class="card mt-lg"><h3>Remove or reset everything</h3><div class="sub">Works on every built set at once. A preview and a typed confirmation come first.</div><div class="row wrap mt-md"><button class="btn secondary" id="dm-reset-all">Reset demo</button><button class="btn danger" id="dm-remove-all">Remove all demo data</button></div></div>' : ''}`);
    B().syncJob(d.job, d.busy);
    B().afterDemo = () => { if (Host.current === 'demo') Host.route(); };

    main.querySelector('#dm-on').addEventListener('change', async (e) => {
      const on = e.target.checked;
      try { await api('PUT', '/enabled', { enabled: on }); toast(on ? 'Demo mode is on' : 'Demo mode is off'); Host.route(); } catch (er) { e.target.checked = !on; toast(er.message, true); }
    });
    main.querySelector('#dm-bk')?.addEventListener('click', async () => { try { await J().start('full-backup'); toast('Backup started'); } catch (e) { toast(e.message, true); } });
    main.querySelector('#dm-compact-go')?.addEventListener('click', async () => { try { const r = await Host.api('POST', '/retention/compact'); J().set(r.job); toast('Compacting started'); } catch (e) { toast(e.message, true); } });
    main.querySelector('#dm-add')?.addEventListener('click', addCustom);
    main.querySelectorAll('[data-set]').forEach(card => {
      const s = d.sets.find(x => x.key === card.dataset.set);
      card.querySelectorAll('[data-do]').forEach(b => b.addEventListener('click', async () => {
        const a = b.dataset.do;
        if (a === 'build') build(s); else if (a === 'edit') editSet(s); else if (a === 'remove') removeOrReset('remove', s); else if (a === 'reset') removeOrReset('reset', s);
        else if (a === 'defaults') { if (!await confirmBox({ title: `Reset ${s.name} to its defaults?`, body: 'Every number in this recipe goes back to its built-in default. Accounts already built are not changed.', confirmLabel: 'Reset to defaults' })) return; try { await api('POST', `/sets/${s.key}/reset`); toast('Reset to defaults'); Host.route(); } catch (e) { toast(e.message, true); } }
        else if (a === 'delete') { if (!await confirmBox({ title: `Delete the set ${s.name}?`, body: 'The set is removed from this list. Nothing is built, so nothing else changes.', confirmLabel: 'Delete', danger: true })) return; try { await api('DELETE', `/sets/${s.key}`); Host.route(); } catch (e) { toast(e.message, true); } }
      }));
    });
    main.querySelector('#dm-creds').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const row = b.closest('tr'), set = logins.sets.find(s => s.logins.some(l => l.id === b.dataset.id)), l = set.logins.find(x => x.id === b.dataset.id);
      busy(b, () => credAction(b.dataset.act, l, row));
    });
    main.querySelector('#o-save')?.addEventListener('click', async (e) => {
      const v = (id) => Number(main.querySelector('#' + id).value);
      busy(e.target, async () => { try { await api('PUT', '/options', { backupMaxAgeHours: v('o-age'), excludeFromBackups: main.querySelector('#o-ex').checked, usePlanCeiling: main.querySelector('#o-plan').checked, limits: { accounts: v('o-acc'), devicesPerAccount: v('o-dev'), records: v('o-rec') } }); toast('Saved'); Host.route(); } catch (er) { toast(er.message, true); } });
    });
    main.querySelector('#o-reset')?.addEventListener('click', async () => {
      if (!await confirmBox({ title: 'Reset all demo settings?', body: 'Every recipe, option and limit on this page goes back to its built-in default and Custom sets leave the list. Demo mode stays as it is, and nothing already built is changed.', confirmLabel: 'Reset all demo settings to defaults' })) return;
      try { await api('POST', '/reset-settings'); toast('All demo settings reset'); Host.route(); } catch (e) { toast(e.message, true); }
    });
    main.querySelector('#dm-reset-all')?.addEventListener('click', () => removeOrReset('reset', null));
    main.querySelector('#dm-remove-all')?.addEventListener('click', () => removeOrReset('remove', null));
  };
})();
