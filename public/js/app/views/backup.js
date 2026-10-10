// APP / views / backup — the Backup and restore page (Administrators), the Home reminder, and Copy diagnostics.
(() => {
  const { esc, toast, sheet, swap, busy } = UI, A = AccountApp, F = A.fmt, E = A.backupEngine, api = (...a) => A.api(...a);
  const DAY = 86400000, STALE_DAYS = 7;
  let working = false;

  const ago = (t) => { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`; };

  // Make the file, then hand it to the person (share sheet to Save to Files on iPhone and iPad, a download elsewhere). The "last backup" time is set only once it was saved.
  A.backupNow = async () => {
    if (working) return false; working = true;
    try {
      toast('Preparing your backup…'); const f = await E.makeFile();
      let saved;
      if (E.canShareFiles()) saved = await sheet(`<h2>Your backup is ready</h2><p class="sub">Save it somewhere safe, away from this device: Files, iCloud Drive, email to yourself or a USB drive.</p><div class="ident mb-lg">${esc(f.name)}</div><div class="actions"><button class="btn secondary" data-cancel>Not now</button><button class="btn" id="sv">Save backup file</button></div>`,
        { onMount: (el, close) => el.querySelector('#sv').addEventListener('click', async () => { if (await E.saveFile(f.text, f.name)) close(true); }) });
      else saved = await E.saveFile(f.text, f.name);
      if (!saved) return false;
      await E.markMade(f.counts); toast('Backup saved. Keep the file somewhere safe.'); return true;
    } catch (e) { toast(e.message, true); return false; } finally { working = false; }
  };

  // ---- restore ----
  const row = (label, a, b) => `<span>${esc(label)}</span><span class="tab-num">${a}</span><span class="tab-num">${b}</span>`;
  const problem = (msg) => sheet(`<h2>This file cannot be used</h2><p class="muted">${esc(msg)}</p><div class="actions"><button class="btn" data-cancel>OK</button></div>`);
  async function chooseAndRestore(file) {
    if (working) return; let parsed, snap;
    try { parsed = await A.backupFile.read(await file.text(), { adk: A.vault.adk, accountCode: A.me.accountCode }); snap = await E.snapshot(); } catch (e) { return problem(e.message); }
    const people = parsed.team, m = parsed.manifest, c = snap.counts, fc = m.counts, newer = snap.newestAt > (m.newestAt || 0); // both times are the server's clock, so a phone with the wrong time still compares correctly
    const mode = await sheet(`<h2>Restore from backup</h2><p class="sub">Made ${esc(F.when(m.createdAt))}${parsed.header.app ? ` with myBoxStock ${esc(parsed.header.app)}` : ''}.</p>
      ${newer ? `<div class="banner red mb-md" id="nw"><b>Your account is newer than this file.</b> The latest change in your account is ${esc(F.when(snap.newestAt))}, after this backup was made. “Replace everything” would lose that newer work.</div>` : ''}
      <div class="compare"><span></span><b>In the file</b><b>In your account</b>${row('Devices', fc.devices, c.devices)}${row('Customers', fc.customers, c.customers)}${row('Sales', fc.sales, c.sales)}${row('Backup made / newest change', esc(F.day(m.createdAt)), esc(F.day(snap.newestAt)))}</div>
      <label class="choice mb-md"><input type="radio" name="md" value="merge" checked><span><b>Add what is missing</b><span class="setting-desc">Adds what the file has and your account does not. Nothing already in your account is changed.</span></span></label>
      <label class="choice"><input type="radio" name="md" value="replace"><span><b>Replace everything</b><span class="setting-desc">Makes your account match the file exactly. Anything newer in your account is lost.</span></span></label>
      ${people?.length ? `<div class="setting mt-md"><div><div class="setting-title">Add team members (${people.length} in this file)</div><div class="setting-desc" id="tmd">${esc(A.backupFile.teamText(people))}. They come back as pending invitations: you give each person a temporary password with Reset access, then they choose their own password and set up their own two-factor. Anyone already on your team (same username or email) is skipped. “Replace everything” never removes a team member.</div></div><label class="switch"><input type="checkbox" id="tm" aria-label="Add team members (${people.length} in this file)" checked><i></i></label></div>` : ''}
      <p class="hint mt-lg">Before anything changes we save a safety copy for 7 days, so you can undo.</p>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Add what is missing</button></div>`,
      { onMount: (el, close) => {
        const go = el.querySelector('#go'), pick = () => el.querySelector('input[name=md]:checked').value;
        el.querySelectorAll('input[name=md]').forEach(i => i.addEventListener('change', () => { go.textContent = pick() === 'replace' ? 'Replace everything' : 'Add what is missing'; go.classList.toggle('danger', pick() === 'replace'); }));
        go.addEventListener('click', () => run(el, close, parsed, pick(), !!el.querySelector('#tm')?.checked));
      } });
    return mode;
  }
  // Runs inside the same sheet so the screen shows progress; a failure rolls back by itself.
  async function run(el, close, parsed, mode, team) {
    working = true; el.innerHTML = `<h2>Restoring…</h2><p class="sub" id="pt">Saving a safety copy first.</p><div class="meter"><i id="pb" data-pct="0"></i></div><p class="hint mt-lg">Keep this page open until it finishes.</p>`;
    const bar = el.querySelector('#pb'), txt = el.querySelector('#pt');
    try {
      const p = await E.run(parsed, mode, (d, t) => { bar.dataset.pct = t ? Math.round(d * 100 / t) : 100; UI.dynamic(el); txt.textContent = `Writing your data (${d} of ${t} steps).`; }, { team });
      el.innerHTML = `<h2>Restore finished</h2><p class="muted">${p.added} added${mode === 'replace' ? `, ${p.replaced} replaced, ${p.removed} removed` : ''}, ${p.unchanged} already the same.</p>${team && parsed.team?.length ? `<p class="muted" id="tdn">${p.invited ? `${p.invited} team member${p.invited === 1 ? '' : 's'} added as pending invitations${p.teamSkipped ? `, ${p.teamSkipped} already on your team` : ''}. Give each a temporary password with Reset access on the Team page.` : 'No team members were added (everyone in the file is already on your team).'}</p>` : ''}<p class="hint">Changed your mind? Use “Undo last restore” on the Backup and restore page for the next 7 days.</p><div class="actions"><button class="btn" data-cancel>Done</button></div>`;
      el.querySelector('[data-cancel]').addEventListener('click', () => close(true)); toast('Restore finished');
    } catch (e) {
      el.innerHTML = `<h2>The restore did not finish</h2><p class="muted">${esc(e.message)}</p><div class="actions"><button class="btn" data-cancel>OK</button></div>`; el.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    } finally { working = false; if (location.hash === '#/backup') A.route(); }
  }

  // ---- diagnostics: copy a plain-text summary to paste to the Host admin ----
  A.copyDiagnostics = async () => {
    let text; try { text = (await api('GET', '/diagnostics')).text; } catch (e) { return toast(e.message, true); }
    text = text.replace(/^(Device: .*)$/m, `$1 · screen ${screen.width}x${screen.height} · ${navigator.language || 'language unknown'}`);
    try { await navigator.clipboard.writeText(text); toast('Diagnostics copied. Paste them into your message to the Host admin.'); }
    catch { await sheet(`<h2>Copy diagnostics</h2><p class="sub">Your browser did not allow copying. Select all of this text, copy it, and paste it into your message to the Host admin.</p><div class="field"><textarea id="dg" rows="12" readonly aria-label="Diagnostics text to copy">${esc(text)}</textarea></div><div class="actions"><button class="btn" data-cancel>Close</button></div>`, { onMount: (el) => { const t = el.querySelector('#dg'); t.focus(); t.select(); } }); }
  };

  A.views.backup = async (main) => {
    if (!A.can('users.manage')) return swap(main, '<div class="card"><div class="empty">Only Administrators can use Backup and restore.</div></div>');
    const st = await api('GET', '/backup/status'), rp = st.restorePoint, last = st.lastBackupAt, stale = !last || Date.now() - last > STALE_DAYS * DAY;
    swap(main, `<div class="page-head"><h1>Backup and restore</h1><p>Your data is yours, and keeping it safe is your job. The host stores it encrypted and cannot read it or recover it for you. A backup file kept somewhere safe is your protection.</p></div>
      <div class="card"><div class="card-head"><div><h3>Full backup</h3><div class="sub mb-0">Everything in your account in one file: devices, customers, sales, receipts, settings, catalog and your team list (names, usernames, emails and user types; never passwords). It stays encrypted, so it is useless without your password or recovery key.</div></div><span class="chip ${stale ? 'amber' : 'green'}" id="lb">${last ? `Last backup ${esc(ago(last))}` : 'No backup yet'}</span></div>
        <div class="setting"><div><div class="setting-title">Back up now</div><div class="setting-desc">Saves <span class="ident">myboxstock-backup-${esc(A.me.accountCode)}-date.mbsbackup</span>. Keep a copy away from this device.</div></div><button class="btn" id="mk">Back up now</button></div></div>
      <div class="card"><h3>Restore from a backup file</h3><div class="sub">Use this if data was lost or the host had to restore an older copy. You see what is in the file before anything changes.</div>
        <div class="setting"><div><div class="setting-title">Choose a backup file</div><div class="setting-desc">A file ending in .mbsbackup, made from this account.</div></div><button class="btn secondary" id="pk">Choose file</button><input type="file" id="fl"></div>
        ${rp ? `<div class="setting"><div><div class="setting-title">Undo last restore</div><div class="setting-desc">Puts your data back as it was before the restore on ${esc(F.when(rp.createdAt))}. Available until ${esc(F.when(rp.expiresAt))}.</div></div><button class="btn secondary" id="ud">Undo last restore</button></div>` : ''}</div>
      <div class="card"><h3>Test a backup file</h3><div class="sub">Check that a backup file is good before you need it. It is tested here in your browser: nothing is restored, changed or sent, and the host sees nothing.</div>
        <div class="setting"><div><div class="setting-title">Test a file</div><div class="setting-desc">Shows whether the file is complete and opens with this account’s key, what is inside, and how it compares with your account now.</div></div><button class="btn secondary" id="tk">Test file</button><input type="file" id="tf"></div></div>
      <div class="card"><h3>Spreadsheets</h3><div class="sub">Open your data in Excel, Numbers or Google Sheets.</div>
        <div class="setting"><div><div class="setting-title">Export everything</div><div class="setting-desc">CSV spreadsheets and settings in one file, readable by anyone who has it. This is not a backup you can restore from.</div></div><button class="btn secondary" id="xall">Export everything</button></div></div>
      <div class="card"><h3>Help</h3><div class="sub">Having a problem? Copy a short summary of your account's health and paste it to the Host admin. It has no inventory, customer or sales information.</div>
        <div class="setting"><div><div class="setting-title">Copy diagnostics</div><div class="setting-desc">Version, plan, people counts and recent warnings.</div></div><button class="btn secondary" id="dg">Copy diagnostics</button></div></div>`);
    main.querySelector('#mk').addEventListener('click', (e) => busy(e.currentTarget, async () => { if (await A.backupNow()) A.route(); }));
    const fl = main.querySelector('#fl'); main.querySelector('#pk').addEventListener('click', () => fl.click());
    fl.addEventListener('change', async () => { const f = fl.files[0]; fl.value = ''; if (f) await chooseAndRestore(f); });
    const tf = main.querySelector('#tf'); main.querySelector('#tk').addEventListener('click', () => tf.click());
    tf.addEventListener('change', async () => { const f = tf.files[0]; tf.value = ''; if (f) await A.testBackupFile(f); });
    main.querySelector('#xall').addEventListener('click', () => { const n = A.exportEverything(); toast(`Exported ${n} files`); });
    main.querySelector('#dg').addEventListener('click', (e) => busy(e.currentTarget, A.copyDiagnostics));
    main.querySelector('#ud')?.addEventListener('click', async () => {
      if (!await UI.confirmBox({ title: 'Undo the last restore?', body: `Your data goes back to how it was before the restore on ${esc(F.when(rp.createdAt))}. Anything you changed since then is lost.`, confirmLabel: 'Undo restore', danger: true })) return;
      try { const r = await E.undo(); toast(`Undone: ${r.count} records back as they were`); A.route(); } catch (e) { toast(e.message, true); }
    });
  };

  // ---- Home reminder (Administrators): shown when there is no backup or it is older than 7 days; closing it hides it until tomorrow ----
  const KEY = 'mbs.backupNudge', today = () => F.ymd(Date.now());
  const hiddenToday = () => { try { return localStorage.getItem(KEY) === today(); } catch { return false; } };
  A.backupReminder = async (main) => {
    if (!A.can('users.manage') || hiddenToday()) return;
    let st; try { st = await api('GET', '/backup/status'); } catch { return; }
    if (st.lastBackupAt && Date.now() - st.lastBackupAt <= STALE_DAYS * DAY) return;
    if (!main.isConnected || main.querySelector('#bkb')) return;
    main.insertAdjacentHTML('afterbegin', `<div class="banner row spread wrap mb-lg" id="bkb" role="status"><span>${st.lastBackupAt ? `Your last backup was ${Math.floor((Date.now() - st.lastBackupAt) / DAY)} days ago.` : 'You have not made a backup yet.'}</span><span class="row"><button class="btn small" id="bkn">Back up now</button><button class="btn secondary small" id="bkx">Not today</button></span></div>`);
    main.querySelector('#bkn').addEventListener('click', async () => { if (await A.backupNow()) main.querySelector('#bkb')?.remove(); });
    main.querySelector('#bkx').addEventListener('click', () => { try { localStorage.setItem(KEY, today()); } catch {} main.querySelector('#bkb')?.remove(); });
  };
})();
