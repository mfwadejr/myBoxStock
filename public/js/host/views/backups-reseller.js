// HOST / views / backups-reseller — the "Restore a reseller" tab: find a reseller, pick one of the backups the Host already holds, look inside it (counts only),
// then add what is missing or replace that one account's data. Nobody else's data is touched. Styling is the standard classes only.
(() => {
  const { esc, fmt, toast, sheet, busy } = UI;
  const B = Host.backups = Host.backups || {};
  const LOSS = 'The account goes back to the backup you choose, which may be a day or more old. Anything the reseller entered after that time is not in it, and the reseller owns that loss.';
  const row = (label, a, b) => `<span>${esc(label)}</span><span class="tab-num">${a}</span><span class="tab-num">${b}</span>`;

  B.resellerPane = (pane, d) => {
    let acct = null, sources = null, chosen = '', preview = null, h = null, uploaded = null;
    pane.innerHTML = `<div class="card"><h3>Restore a reseller</h3><div class="setting-desc">Put one reseller’s data back from a backup this server already holds, without touching anyone else. ${esc(LOSS)}</div>
      ${d.engine !== 'sqlite' ? '<div class="banner mt-md">This works on SQLite only. On an external database, restore from the database’s own snapshots.</div>' : `
      <div class="field mt-md"><label for="rr-q">Find the reseller</label><input type="search" id="rr-q" autocomplete="off" placeholder="Business name, Reseller ID or owner email"></div><div id="rr-found"></div>`}</div>
      <div id="rr-step2"></div>`;
    if (d.engine !== 'sqlite') return;
    const q = pane.querySelector('#rr-q'), found = pane.querySelector('#rr-found'), step2 = pane.querySelector('#rr-step2');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => {
      const v = q.value.trim(); if (v.length < 2) { found.innerHTML = ''; return; }
      try {
        const list = (await Host.api('GET', '/accounts?q=' + encodeURIComponent(v))).slice(0, 8);
        found.innerHTML = list.length ? list.map(a => `<div class="setting"><div><div class="setting-title">${esc(a.business_name)}</div><div class="setting-desc"><span class="ident">${esc(a.account_code)}</span> · ${esc(a.owner_email)}</div></div><button type="button" class="btn secondary small" data-pick="${esc(a.id)}" data-name="${esc(a.business_name)}" data-code="${esc(a.account_code)}">Choose</button></div>`).join('') : '<div class="empty">No reseller matches that.</div>';
      } catch (e) { toast(e.message, true); }
    }, 250); });
    found.addEventListener('click', (ev) => { const b = ev.target.closest('[data-pick]'); if (!b) return; acct = { id: b.dataset.pick, name: b.dataset.name, code: b.dataset.code }; found.innerHTML = ''; q.value = ''; preview = null; chosen = ''; loadSources(); });

    const loadSources = async () => {
      step2.innerHTML = '<div class="card"><p class="hint" role="status">Looking for backups…</p></div>';
      try { sources = await Host.api('GET', `/backups/reseller/${acct.id}/sources`); } catch (e) { step2.innerHTML = ''; return toast(e.message, true); }
      const first = sources.rows.find(r => !r.disabled); if (!chosen && first) chosen = first.key;
      drawSources();
    };
    const drawSources = () => {
      const rows = sources.rows;
      step2.innerHTML = `<div class="card"><h3>${esc(acct.name)} <span class="ident">${esc(acct.code)}</span></h3>
        <div class="setting-desc">Choose the backup to restore from. The newest is selected for you. Nothing changes until you look inside it and confirm.</div>
        ${sources.problems.length ? `<div class="banner mt-md">${sources.problems.map(p => `${esc(p.destination)} could not be read: ${esc(p.error)}`).join(' · ')}</div>` : ''}
        <div class="feed mt-md" id="rr-list">${rows.length ? rows.map(r => `<label class="choice mb-sm"><input type="radio" name="rr-src" value="${esc(r.key)}" ${r.key === chosen ? 'checked' : ''} ${r.disabled ? 'disabled' : ''}><span><b>${esc(fmt.dateTime(r.takenAt))}</b> · ${esc(r.kind)}<span class="setting-desc">${esc(r.from)} · ${esc(fmt.bytes(r.size))} · <span class="ident">${esc(r.name)}</span>${r.disabled ? ` · ${esc(r.why)}` : ''}</span></span></label>`).join('') : '<div class="empty">No backups are held that could hold this reseller. Add a file from your computer below.</div>'}</div>
        <div class="row wrap mt-md"><button type="button" class="btn secondary" id="rr-pick">Add a file from this computer</button><input type="file" id="rr-file" accept=".mbsbak,.mbsenc,.db" hidden><span class="hint" id="rr-up" role="status"></span></div>
        <div class="field mt-md"><label for="rr-pp">Backup passphrase (only for encrypted files)</label><input type="password" id="rr-pp" autocomplete="off" placeholder="Leave blank to use the saved passphrase"></div>
        <div class="row wrap mt-md"><button type="button" class="btn" id="rr-look" ${chosen ? '' : 'disabled'}>Look inside this backup</button></div>
        <div id="rr-out" class="mt-lg"></div></div>`;
      step2.querySelectorAll('input[name=rr-src]').forEach(i => i.addEventListener('change', () => { chosen = i.value; step2.querySelector('#rr-look').disabled = false; step2.querySelector('#rr-out').innerHTML = ''; preview = null; }));
      const file = step2.querySelector('#rr-file'), up = step2.querySelector('#rr-up');
      step2.querySelector('#rr-pick').addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        const f = file.files[0]; file.value = ''; if (!f) return;
        if (!/\.(mbsbak|mbsenc|db)$/.test(f.name)) return toast('Choose a myBoxStock backup file: .mbsbak, .mbsenc or .db.', true);
        up.textContent = 'Uploading…';
        try { uploaded = await Host.api.upload(`/backups/file-test/upload?name=${encodeURIComponent(f.name)}`, f, (p) => { up.textContent = `Uploading… ${Math.round(p * 100)}%`; }); chosen = 'u:' + uploaded.id; await loadSources(); }
        catch (e) { up.textContent = ''; toast(e.message, true); }
      });
      step2.querySelector('#rr-look').addEventListener('click', () => look());
    };

    const look = () => {
      const src = sources.rows.find(r => r.key === chosen); if (!src) return; const out = step2.querySelector('#rr-out'), btn = step2.querySelector('#rr-look');
      btn.disabled = true; preview = null; out.innerHTML = B.progressHtml('rrp');
      try { h?.release(); } catch {}
      h = B.jobs.run('reseller-preview', { accountId: acct.id, source: src.source, passphrase: step2.querySelector('#rr-pp').value }, (j) => B.progressPaint(out, j));
      h.done.then((j) => {
        btn.disabled = false;
        if (j.status === 'failed') return (out.innerHTML = `<div class="banner red" role="alert">${esc(j.error.message)}</div>`);
        preview = j.result; showPreview(out, src);
      }, (e) => { btn.disabled = false; out.innerHTML = `<div class="banner red" role="alert">${esc(e.message)}</div>`; });
    };

    const showPreview = (out, src) => {
      const r = preview, checks = B.checkRows(r.checks);
      if (!r.ok) return (out.innerHTML = `<div class="banner red" role="alert">${esc(r.summary)}</div><div>${checks}</div>`);
      const a = r.inBackup.counts, l = r.live.counts, age = Date.now() - r.backup.takenAt;
      out.innerHTML = `<div class="banner blue" role="status">${esc(r.summary)}</div>
        <div class="banner mt-md" id="rr-loss"><b>This backup was taken ${esc(fmt.dateTime(r.backup.takenAt))} (${esc(fmt.ago(r.backup.takenAt))}).</b> ${esc(LOSS)}</div>
        <div class="compare mt-md"><span></span><b>In the backup</b><b>On the site now</b>
          ${row('Devices', a.devices, l.devices)}${row('Customers', a.customers, l.customers)}${row('Sales', a.sales, l.sales)}${row('Models (reorder levels)', a.models, l.models)}${row('Settings records', a.settings, l.settings)}${row('Team members', a.team, l.team)}</div>
        <p class="hint mt-sm">${r.inBackup.newest ? `Newest entry in the backup: ${esc(fmt.dateTime(r.inBackup.newest))}. ` : ''}${r.live.newest ? `Newest entry on the site now: ${esc(fmt.dateTime(r.live.newest))}.` : ''} Counts only; the Host cannot read the records.</p>
        <details class="mt-sm"><summary class="muted text-sm">Checks</summary>${checks}</details>
        <h4 class="mt-lg">What should happen?</h4>
        <label class="choice mb-sm"><input type="radio" name="rr-mode" value="add" checked><span><b>Add what is missing</b><span class="setting-desc">Brings back what the backup has and the account does not. Nothing the reseller has now is changed or removed.</span></span></label>
        <label class="choice mb-sm"><input type="radio" name="rr-mode" value="replace"><span><b>Replace this account’s data</b><span class="setting-desc">Makes the account match the backup exactly. Anything newer in the account is lost. A safety copy of the account is saved first for 7 days, and the reseller can use Undo last restore.</span></span></label>
        <label class="check mt-sm" id="rr-teamrow" hidden><input type="checkbox" id="rr-team"> Also restore the team and sign-ins (${a.team} in the backup, ${l.team} now)</label>
        <div class="hint" id="rr-teamnote" hidden>People, roles, passwords and two-factor setup go back to how the backup had them. Everyone in this account is signed out. Plan and billing are not changed.</div>
        <label class="check mt-sm"><input type="checkbox" id="rr-mail"> Also email the reseller (a notice is always shown inside their app)</label>
        <div class="row wrap mt-lg"><button type="button" class="btn danger" id="rr-go">Restore ${esc(acct.name)}…</button></div>`;
      const mode = () => out.querySelector('input[name=rr-mode]:checked').value, sync = () => { const rep = mode() === 'replace' && a.team > 0; out.querySelector('#rr-teamrow').hidden = !rep; out.querySelector('#rr-teamnote').hidden = !rep; };
      out.querySelectorAll('input[name=rr-mode]').forEach(i => i.addEventListener('change', sync)); sync();
      out.querySelector('#rr-go').addEventListener('click', () => confirmSheet(out, src, mode(), mode() === 'replace' && out.querySelector('#rr-team').checked, out.querySelector('#rr-mail').checked));
    };

    const confirmSheet = async (out, src, mode, includeTeam, notify) => {
      const r = preview; let job = null;
      await sheet(`<h2>${mode === 'replace' ? 'Replace' : 'Add to'} ${esc(acct.name)}</h2>
        <div class="banner red"><b>${mode === 'replace' ? `${esc(acct.name)} goes back to ${esc(fmt.dateTime(r.backup.takenAt))}.` : `Records from ${esc(fmt.dateTime(r.backup.takenAt))} that are missing are added.`}</b> ${mode === 'replace' ? esc(LOSS) : 'Nothing the reseller has now is removed.'}</div>
        <ul class="hint"><li>A safety copy of this account is saved first, for 7 days.</li><li>${includeTeam ? 'The team and sign-ins go back too, and everyone in the account is signed out.' : 'The team and sign-ins are not changed.'}</li><li>The reseller sees a notice inside their app${notify ? ' and gets an email' : ''} saying what happened and how to bring newer entries back from their own backup file.</li><li>Nobody else’s data is touched, and the site stays up.</li></ul>
        <div class="field mt-md"><label for="rr-cn">Type the business name to confirm: <b>${esc(acct.name)}</b></label><input type="text" id="rr-cn" autocomplete="off"></div><div id="rr-j" class="mt-md"></div>
        <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="rr-do" disabled>${mode === 'replace' ? 'Replace this account’s data' : 'Add what is missing'}</button></div>`, {
        onMount: (el, close) => {
          const cn = el.querySelector('#rr-cn'), go = el.querySelector('#rr-do');
          cn.addEventListener('input', () => { go.disabled = cn.value.trim() !== acct.name; });
          go.addEventListener('click', () => {
            go.disabled = true; cn.disabled = true; const j = el.querySelector('#rr-j'); j.innerHTML = B.progressHtml('rrr');
            job = B.jobs.run('reseller-restore', { token: r.token, accountId: acct.id, mode, includeTeam, notify, confirmName: cn.value, passphrase: step2.querySelector('#rr-pp')?.value || '' }, (x) => B.progressPaint(j, x));
            job.done.then((x) => {
              if (x.status === 'failed') { go.disabled = false; cn.disabled = false; return (j.innerHTML = `<div class="banner red" role="alert">${esc(x.error.message)}</div>`); }
              const res = x.result; close(true); out.innerHTML = `<div class="banner blue" role="status" id="rr-done"><b>Done.</b> ${esc(acct.name)}: ${esc(res.summary)}. Backup taken ${esc(fmt.dateTime(res.takenAt))}. A safety copy of the account is kept until ${esc(fmt.date(res.safetyUntil))}; the reseller can undo from their Backup page.</div>`;
              preview = null; toast('Reseller restored');
            }, (e) => { go.disabled = false; cn.disabled = false; j.innerHTML = `<div class="banner red" role="alert">${esc(e.message)}</div>`; });
          });
        },
      });
      job?.release();
    };
  };
})();
