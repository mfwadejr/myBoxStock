// HOST / views / backups — the Backups page: a status strip on top, then tabs for frequent snapshots, offsite copies, full-site backups, safety copies and destinations.
// File lists and the Restore / Test restore sheets are in backups-files.js, the Destinations tab in backups-destinations.js.
(() => {
  const { esc, fmt, toast, sheet, busy, swap } = UI;
  const B = Host.backups = Host.backups || {};
  const TABS = [['frequent', 'Frequent snapshots'], ['offsite', 'Offsite copies'], ['full', 'Full-site backups'], ['safety', 'Safety copies'], ['destinations', 'Destinations']];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const EVERY = [[5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, 'hour'], [120, '2 hours'], [360, '6 hours'], [720, '12 hours'], [1440, 'day']];
  const TIER_NAME = { frequent: 'Frequent snapshot', manual: 'Manual snapshot', offsite: 'Offsite copy', full: 'Full-site backup' };
  let tab = 'frequent';

  const num = (id, label, v, min, max, hint = '') => `<div class="field"><label for="${id}">${esc(label)}</label><input type="number" class="num" id="${id}" min="${min}" max="${max}" value="${esc(v)}" inputmode="numeric">${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
  const thinHtml = (p, t, count) => `<div class="setting-title mt-md">How long to keep them</div><div class="setting-desc">Every copy is kept for a while, then thinned out: one an hour, then one a day, then one a week.${count ? ` These settings keep about <b>${count}</b> files.` : ''}</div>
    <div class="grid g2 mt-md">${num(`${p}-fh`, 'Keep every copy for (hours)', t.fullHours, 1, 168)}${num(`${p}-hh`, 'Then one an hour for (hours)', t.hourlyHours, 0, 720)}${num(`${p}-dd`, 'Then one a day for (days)', t.dailyDays, 0, 365)}${num(`${p}-ww`, 'Then one a week for (weeks)', t.weeklyWeeks, 0, 520)}</div>`;
  const readThin = (root, p) => ({ fullHours: root.querySelector(`#${p}-fh`).value, hourlyHours: root.querySelector(`#${p}-hh`).value, dailyDays: root.querySelector(`#${p}-dd`).value, weeklyWeeks: root.querySelector(`#${p}-ww`).value });
  const everySel = (id, v, from = 0) => UI.select.html({ id, options: EVERY.filter(([m]) => m >= from), value: v });
  const destChecks = (d, ids) => { const list = d.destinations.filter(x => !x.builtin && x.enabled); return list.length ? list.map(x => `<label class="check mb-sm"><input type="checkbox" data-dest="${esc(x.id)}" ${ids.includes(x.id) ? 'checked' : ''}> ${esc(x.name)} <span class="chip">${esc(x.typeLabel)}</span></label>`).join('') : '<div class="banner">No destination is turned on yet. Add one on the Destinations tab first.</div>'; };
  const chosen = (root) => [...root.querySelectorAll('[data-dest]')].filter(i => i.checked).map(i => i.dataset.dest);
  const saveBtn = (pane, fn, label = 'Saved') => pane.querySelector('[data-save]').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await fn(); toast(label); await B.reload(); } catch (er) { toast(er.message, true); } }));
  const runBtn = (pane, sel, path, done, d) => pane.querySelector(sel)?.addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await Host.api('POST', path); toast(done); } catch (er) { toast(er.message, true); } await B.reload(); }));

  function strip(d) {
    const o = d.overview, last = o.last, next = o.next, fails = Object.entries(o.failing).filter(([k, v]) => k !== 'detail' && v);
    const stat = (label, value, note) => `<div class="card stat"><div class="stat-label">${esc(label)}</div><div class="stat-value small">${value}</div><div class="stat-note">${note}</div></div>`;
    return `<div class="grid g4 mb-lg">
      ${stat('Last backup', last ? esc(fmt.ago(last.at)) : 'None yet', last ? `${esc(TIER_NAME[last.tier] || 'Backup')} · ${last.verified ? 'verified' : 'not verified'}<br>${esc(fmt.date(last.at))}` : 'No backup has completed yet')}
      ${stat('Next run', next ? `in ${esc(B.ageText(next.at - Date.now()))}` : 'Nothing scheduled', next ? esc(TIER_NAME[next.tier]) : 'Turn on a schedule below')}
      ${stat('Offsite copy', o.offsite.exists ? 'Yes' : 'No', o.offsite.exists ? `${esc(o.offsite.where.join(', '))}${o.offsite.at ? `<br>${esc(fmt.ago(o.offsite.at))}` : ''}` : (o.offsite.configured ? 'Set up, none sent yet' : 'Nothing leaves this server yet'))}
      ${stat('Space used', fmt.bytes(o.space.used), o.space.free != null ? `${fmt.bytes(o.space.free)} free on this server` : '')}
    </div>
    ${fails.map(([k]) => `<div class="banner red mb-md">The ${k === 'full' ? 'full-site backup' : k === 'frequent' ? 'snapshot' : 'offsite copy'} is failing: ${esc(o.failing.detail[k]?.error || 'unknown problem')}</div>`).join('')}
    <div class="banner ${o.cost.warning ? 'red' : 'blue'} mb-lg" id="cost">${esc(o.cost.line)}${o.cost.warning ? `<br>${esc(o.cost.warning)}` : ''}</div>`;
  }

  // A locked tab shows why and cannot be changed until step 1 of Backup setup is done (the server refuses it as well).
  const lockPane = (pane, reason) => {
    if (!reason) return;
    pane.insertAdjacentHTML('afterbegin', `<div class="banner red mb-lg" id="lock-note">${esc(reason)}</div>`);
    pane.querySelectorAll('input, textarea, button:not([data-test]):not([data-folder]), .select-btn').forEach(x => { x.disabled = true; });
  };

  const panes = {
    frequent(pane, d) {
      const f = d.tiers.frequent, s = d.schedule;
      pane.innerHTML = `<div class="card"><div class="row spread wrap"><div><h3>Frequent snapshots</h3><div class="setting-desc">Small, quick copies of the database kept on this server so a restore loses as little as possible. They are taken while the site keeps running; nobody waits for them.</div></div><label class="switch"><input type="checkbox" id="fen" aria-label="Take frequent snapshots" ${f.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="field mt-md"><label>Take a snapshot every</label>${everySel('fev', f.everyMinutes)}</div>${thinHtml('f', f.thin, d.overview.counts.frequent)}
        <div class="setting"><div><div class="setting-title">Also keep a plain copy every night</div><div class="setting-desc">The older nightly database backup.</div></div><label class="switch"><input type="checkbox" id="nen" aria-label="Keep a plain copy every night" ${s.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="grid g2">${num('nhr', 'Nightly hour (UTC)', s.hourUtc, 0, 23)}${num('nkeep', 'Keep nightly copies', s.keep, 1, 365)}</div>
        <div class="row wrap mt-md"><button class="btn" data-save>Save</button><button class="btn secondary" id="now">Take a snapshot now</button></div></div>
        <div class="card"><h3>Are snapshots protected?</h3><div class="setting-desc">${esc(d.plainNote)}</div><div class="hint">Backup folder: <span class="ident">${esc(d.localDir)}</span> (you can change it on the Destinations tab).</div></div>
        <div class="card"><h3>Snapshots on this server</h3><div class="mt-sm" id="list"></div></div>`;
      saveBtn(pane, async () => {
        await Host.api('PUT', '/backups/tiers', { frequent: { enabled: pane.querySelector('#fen').checked, everyMinutes: UI.select.value(pane.querySelector('#fev')), thin: readThin(pane, 'f') } });
        await Host.api('PUT', '/backups/schedule', { enabled: pane.querySelector('#nen').checked, hourUtc: pane.querySelector('#nhr').value, keep: pane.querySelector('#nkeep').value });
      }, 'Snapshot settings saved');
      pane.querySelector('#now').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await Host.api('POST', '/backups/run/frequent'); toast('Snapshot taken and checked'); } catch (er) { toast(er.message, true); } await B.reload(); }));
      B.localList(pane.querySelector('#list'), 'frequent', d.engine, B.reloadStrip);
    },
    offsite(pane, d) {
      const o = d.tiers.offsite;
      pane.innerHTML = `<div class="card"><div class="row spread wrap"><div><h3>Offsite copies</h3><div class="setting-desc">A fresh snapshot, compressed and encrypted with your backup passphrase, sent away from this server so a lost disk or machine does not take your backups with it.</div></div><label class="switch"><input type="checkbox" id="oen" aria-label="Send offsite copies on a schedule" ${o.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="field mt-md"><label>Send a copy every</label>${everySel('oev', o.everyMinutes, 15)}</div>
        <div class="field"><label>Send them to</label>${destChecks(d, o.destinations)}</div>${thinHtml('o', o.thin, d.overview.counts.offsite)}
        <div class="row wrap mt-md"><button class="btn" data-save>Save</button><button class="btn secondary" id="now">Send one now</button></div></div>
        <div class="card"><h3>Copies held at the destinations</h3><div class="mt-sm" id="list"></div></div>`;
      saveBtn(pane, () => Host.api('PUT', '/backups/tiers', { offsite: { enabled: pane.querySelector('#oen').checked, everyMinutes: UI.select.value(pane.querySelector('#oev')), destinations: chosen(pane), thin: readThin(pane, 'o') } }), 'Offsite settings saved');
      runBtn(pane, '#now', '/backups/run/offsite', 'Offsite copy sent and checked');
      B.remoteList(pane.querySelector('#list'), B.reloadStrip);
      lockPane(pane, d.setup.locks.offsite);
    },
    full(pane, d) {
      const f = d.full, fs = d.fullStatus;
      pane.innerHTML = `<div class="card"><div class="row spread wrap"><div><h3>Full-site backups</h3><div class="setting-desc">One passphrase-protected file with the whole site: every account, user and setting, plus the encryption key. Each one is opened and checked after it is written. Restore it on a new server with <span class="ident">node server.mjs restore-bundle</span>.</div></div></div>
        <div class="setting"><div><div class="setting-title">Make a full-site backup on a schedule</div><div class="setting-desc">Turn this on to run the schedule below. You can still run one by hand at any time.</div></div><label class="switch"><input type="checkbox" id="fen" aria-label="Make a full-site backup on a schedule" ${f.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="grid g2 mt-md"><div class="field"><label for="ff">How often</label>${UI.select.html({ id: 'ff', options: [['nightly', 'Every night'], ['weekly', 'Once a week']], value: f.frequency })}</div><div class="field"><label for="fwd" id="fwl">Weekly copy is taken on</label>${UI.select.html({ id: 'fwd', options: DAYS.map((x, i) => [i, x]), value: f.weekday })}</div>
          ${num('fhr', 'Hour (UTC)', f.hourUtc, 0, 23)}${num('fkd', 'Keep daily copies', f.keepDaily, 1, 90)}${num('fkw', 'Keep weekly copies', f.keepWeekly, 1, 52)}
          <div class="field"><label for="fob">Extra folder (optional)</label><input type="text" id="fob" value="${esc(f.offboxDir)}" placeholder="/backups" autocomplete="off"><div class="hint">A folder outside the data folder, for example a mounted NAS share.</div></div></div>
        <div class="field"><label>Also send them to</label>${destChecks(d, f.destinationIds || [])}</div>
        ${f.hasPassphrase ? '<div class="field"><label>Backup passphrase</label><div class="setting-desc">Saved on this server (sealed). Offsite copies and every destination use it too. You need it to restore, so keep your own copy somewhere safe.</div><div class="row wrap mt-sm"><button class="btn secondary" id="fp-check">Check my passphrase</button><button class="btn secondary" id="fp-change">Change passphrase</button></div></div>' : '<div class="field"><label for="fpp">Backup passphrase</label><input type="password" id="fpp" autocomplete="new-password" placeholder="At least 12 characters"><div class="hint">Kept encrypted on this server so backups can run unattended. Offsite copies and every destination use it too. You need it to restore, so keep your own copy somewhere safe.</div></div>'}
        <div class="setting"><div><div class="setting-title">Email Host administrators if a backup fails</div></div><label class="switch"><input type="checkbox" id="fem" aria-label="Email Host administrators if a backup fails" ${f.emailOnFailure ? 'checked' : ''}><i></i></label></div>
        ${d.setup.mail.ready ? '' : `<div class="banner" id="mail-warn">No mail is set up, so a failure email will not be sent. ${esc(d.setup.mail.note)}</div>`}
        <div class="row wrap mt-md"><button class="btn" data-save>Save</button><button class="btn secondary" id="now">Run one now</button><button class="btn secondary" id="hand">Make one with a new passphrase</button></div></div>
        <div class="card"><h3>Full-site backups on this server</h3><div class="mt-sm" id="list"></div></div>`;
      const gather = () => ({ enabled: pane.querySelector('#fen').checked, frequency: UI.select.value(pane.querySelector('#ff')), weekday: UI.select.value(pane.querySelector('#fwd')), hourUtc: pane.querySelector('#fhr').value, keepDaily: pane.querySelector('#fkd').value, keepWeekly: pane.querySelector('#fkw').value, offboxDir: pane.querySelector('#fob').value, destinationIds: chosen(pane), passphrase: pane.querySelector('#fpp')?.value || '', emailOnFailure: pane.querySelector('#fem').checked });
      const wl = () => { pane.querySelector('#fwl').textContent = UI.select.value(pane.querySelector('#ff')) === 'weekly' ? 'Backup runs on' : 'Weekly copy is taken on'; };
      pane.querySelector('#ff').addEventListener('change', wl); wl();
      pane.querySelector('#fp-check')?.addEventListener('click', () => B.passSheet('check')); pane.querySelector('#fp-change')?.addEventListener('click', () => B.passSheet('change'));
      saveBtn(pane, () => Host.api('PUT', '/backups/full', gather()), 'Full-site settings saved');
      pane.querySelector('#now').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await Host.api('PUT', '/backups/full', gather()); await B.jobs.start('full-backup'); toast('Backup started. Its progress is shown at the top of the page.'); } catch (er) { toast(er.message, true); } await B.reload(); }));
      pane.querySelector('#hand').addEventListener('click', async () => {
        const ok = await sheet(`<h2>Full-site backup</h2><div class="field mt-md"><label for="pp">Backup passphrase</label><input type="password" id="pp" autocomplete="new-password"><div class="hint">At least 12 characters. You will need it to restore. It is not stored.</div></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Create backup</button></div>`,
          { onMount: (el, close) => el.querySelector('#go').addEventListener('click', async () => { try { await B.jobs.start('bundle', { passphrase: el.querySelector('#pp').value }); close(true); } catch (e) { toast(e.message, true); } }) });
        if (ok) toast('Backup started. Its progress is shown at the top of the page.');
      });
      B.localList(pane.querySelector('#list'), 'full', d.engine, B.reloadStrip);
      lockPane(pane, d.setup.locks.full);
      B.fileTestCard(pane); // added after the lock so it stays usable: a file from a lost server needs no setup
    },
    safety(pane, d) {
      const s = d.tiers.safety;
      pane.innerHTML = `<div class="card"><h3>Safety copies</h3><div class="setting-desc">Every restore first saves the site as it is now, so a restore can itself be undone. These are kept until they are old enough to remove, but the newest few always stay.</div>
        <div class="grid g2 mt-md">${num('sd', 'Remove safety copies older than (days)', s.keepDays, 1, 3650)}${num('sm', 'Always keep the newest', s.keepMin, 1, 100, 'copies, however old')}</div>
        <div class="row wrap mt-md"><button class="btn" data-save>Save</button></div></div>
        <div class="card"><h3>Safety copies on this server</h3><div class="mt-sm" id="list"></div></div>`;
      saveBtn(pane, () => Host.api('PUT', '/backups/tiers', { safety: { keepDays: pane.querySelector('#sd').value, keepMin: pane.querySelector('#sm').value } }), 'Safety copy settings saved');
      B.localList(pane.querySelector('#list'), 'safety', d.engine, B.reloadStrip);
    },
    destinations(pane, d) { B.destinationsPane(pane, d, () => B.reload()); lockPane(pane, d.setup.locks.destinations); },
  };

  Host.views.backups = async (main) => {
    let data = await Host.api('GET', '/backups');
    swap(main, `${Host.head('Backups', 'Frequent, small copies of the site, kept in layers and sent away from this server.')}
      ${data.engine !== 'sqlite' ? '<div class="banner mb-lg">You are on an external database. Backups here use pg_dump / mysqldump and need those tools in the container; test restore can only check the files, and managed databases usually have their own snapshots too.</div>' : ''}
      <div id="setup-panel" class="mb-lg"></div><div id="job-strip"></div><div id="strip"></div><div class="seg tabs mb-lg" id="tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-t="${k}" class="${k === tab ? 'on' : ''}">${esc(l)}</button>`).join('')}</div><div id="pane"></div>`);
    const tabs = main.querySelector('#tabs'), goTab = (k) => { tab = k; paint(); tabs.scrollIntoView({ block: 'nearest' }); };
    const paintStrip = () => { main.querySelector('#strip').innerHTML = strip(data); B.syncJob(data.job, data.busy); };
    const paintSetup = () => B.setupPanel(main.querySelector('#setup-panel'), data, () => B.reload(), goTab);
    const paint = () => { B.engine = data.engine; main.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab)); UI.tabRow.sync(tabs); paintSetup(); paintStrip(); panes[tab](main.querySelector('#pane'), data); };
    B.reload = async () => { try { data = await Host.api('GET', '/backups'); paint(); } catch (e) { toast(e.message, true); } };
    B.reloadStrip = async () => { try { data = await Host.api('GET', '/backups'); paintStrip(); paintSetup(); } catch {} };
    main.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { if (tab !== b.dataset.t) { tab = b.dataset.t; paint(); } }));
    UI.tabRow(tabs);
    paint();
  };
})();
