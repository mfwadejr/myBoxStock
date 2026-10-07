// HOST / views / backups-setup — the "Backup setup" panel at the top of the Backups page: four steps that unlock one after another,
// the status line (Local only / Copy off this server / Off-site and verified) and the mail warning. The server enforces the same order.
(() => {
  const { esc, fmt, toast, busy, sheet } = UI;
  const B = Host.backups = Host.backups || {};
  const chipFor = (s) => s.done ? '<span class="chip green">Done</span>' : s.locked ? '<span class="chip">Locked</span>' : '<span class="chip blue">Next</span>';
  const checkRows = (checks) => checks.map(c => `<div class="setting"><div><div class="setting-title">${esc(c.label)}</div>${c.detail ? `<div class="setting-desc">${esc(c.detail)}</div>` : ''}</div><span class="chip ${c.ok ? 'green' : 'red'}">${c.ok ? 'Passed' : 'Failed'}</span></div>`).join('');
  const MAIL = (s) => s.mail.ready ? '' : `<div class="banner mt-md" id="setup-mail">Failure emails will not be sent: no mail is set up. ${esc(s.mail.note)}</div>`;


  // ---- Passphrase care: Check, Change and Reset. Always on the card once a passphrase exists (also reachable from the Full-site backups tab). ----
  const passRow = (s) => !s.passphrase.set ? '' : `<div class="row wrap mt-sm" id="pass-care"><button class="btn secondary small" id="pc-check">Check my passphrase</button><button class="btn secondary small" id="pc-change">Change passphrase</button><button class="btn danger small" id="pc-reset">Reset (forgotten)</button></div>
      ${s.passphrase.changedAt ? `<div class="setting-desc mt-sm">The passphrase was ${s.passphrase.lastAction === 'reset' ? 'reset' : 'changed'} ${esc(fmt.ago(s.passphrase.changedAt))}. Copies made before that need the earlier passphrase${s.passphrase.lastAction === 'reset' ? ' and can no longer be opened' : ''}.</div>` : ''}`;
  const newFields = (id) => `<div class="grid g2 mt-md"><div class="field"><label for="${id}-new">New passphrase</label><input type="password" id="${id}-new" autocomplete="new-password" placeholder="At least 12 characters"></div>
      <div class="field"><label for="${id}-conf">Type it again</label><input type="password" id="${id}-conf" autocomplete="new-password"></div></div>
      <label class="check"><input type="checkbox" id="${id}-saved"> I have saved the new passphrase somewhere other than this server</label>`;
  const PASS = {
    check: { title: 'Check my passphrase', go: 'Check it', body: () => `<p class="hint">Type your passphrase and the server tells you whether it matches the one saved here. Nothing is changed, and it is never shown or stored.</p><div class="field mt-md"><label for="pk-cur">Your passphrase</label><input type="password" id="pk-cur" autocomplete="off"></div><div id="pk-out"></div>`,
      send: (el) => ({ passphrase: el.querySelector('#pk-cur').value }), done: (r, el) => { el.querySelector('#pk-out').innerHTML = `<div class="banner ${r.match ? 'blue' : 'red'}">${r.match ? 'That matches the saved passphrase.' : 'That does not match the saved passphrase. Check for typing mistakes, capital letters and spaces.'}</div>`; return false; } },
    change: { title: 'Change passphrase', go: 'Change it', body: () => `<div class="banner">New copies will use the new passphrase. Copies made before the change still need the old passphrase to open, so keep it.</div><div class="field mt-md"><label for="pc-cur">Current passphrase</label><input type="password" id="pc-cur" autocomplete="off"></div>${newFields('pc')}`,
      send: (el) => ({ current: el.querySelector('#pc-cur').value, next: el.querySelector('#pc-new').value, confirm: el.querySelector('#pc-conf').value, saved: el.querySelector('#pc-saved').checked }), done: () => true, toast: 'Passphrase changed' },
    reset: { title: 'Reset a forgotten passphrase', go: 'Reset it', body: () => `<div class="banner red">Every encrypted copy made with the old passphrase can never be opened again, by anyone. Only copies made from now on will use the new one. If you might still find the old passphrase, stop and look for it first.</div>${newFields('pr')}
      <label class="check mt-md"><input type="checkbox" id="pr-ack"> I understand that older copies stay unreadable</label>`,
      send: (el) => ({ next: el.querySelector('#pr-new').value, confirm: el.querySelector('#pr-conf').value, saved: el.querySelector('#pr-saved').checked, acknowledge: el.querySelector('#pr-ack').checked }), done: () => true, toast: 'Passphrase reset' },
  };
  B.passSheet = async (kind) => {
    const k = PASS[kind], ok = await sheet(`<h2>${k.title}</h2>${k.body()}<div class="actions"><button class="btn secondary" data-cancel>${kind === 'check' ? 'Close' : 'Cancel'}</button><button class="btn ${kind === 'reset' ? 'danger' : ''}" id="pgo">${k.go}</button></div>`, {
      onMount: (el, close) => { const go = el.querySelector('#pgo'); go.addEventListener('click', () => busy(go, async () => { try { const r = await Host.api('POST', `/backups/setup/passphrase/${kind}`, k.send(el)); if (k.done(r, el)) close(true); } catch (e) { toast(e.message, true); } })); } });
    if (ok) { toast(k.toast); B.reload(); }
  };

  const bodies = {
    passphrase: (s) => s.passphrase.set
      ? `<div class="setting-desc">A backup passphrase is already set on this server. Confirm that you keep a copy of it somewhere other than this server.</div>
         <label class="check mt-md"><input type="checkbox" id="sp-saved"> I have saved the passphrase somewhere other than this server</label>
         <div class="row wrap mt-md"><button class="btn" id="sp-go">Confirm</button></div>${passRow(s)}`
      : `<div class="banner red">If this passphrase is lost, every encrypted copy can never be opened. Nobody can recover it for you, including the people who run this software.</div>
         <div class="grid g2 mt-md"><div class="field"><label for="sp-pass">Backup passphrase</label><input type="password" id="sp-pass" autocomplete="new-password" placeholder="At least ${s.passphrase.minLength} characters"></div>
         <div class="field"><label for="sp-conf">Type it again</label><input type="password" id="sp-conf" autocomplete="new-password"></div></div>
         <label class="check"><input type="checkbox" id="sp-saved"> I have saved this passphrase somewhere other than this server</label>
         <div class="row wrap mt-md"><button class="btn" id="sp-go">Set the passphrase</button></div>`,
    where: (s) => `<div class="setting-desc">Should copies also go somewhere off this server, such as a NAS, cloud storage or both? Copies kept only on this server share the same disk as the database.</div>
      <label class="check mt-md"><input type="radio" name="sw" value="yes" ${s.where.offServer === true ? 'checked' : ''}> Yes, also copy off this server</label>
      <label class="check mt-sm"><input type="radio" name="sw" value="no" ${s.where.offServer === false ? 'checked' : ''}> No, keep copies on this server only (not recommended)</label>
      <div id="sw-more" class="mt-md"></div>
      <div class="row wrap mt-md"><button class="btn" id="sw-go">Save this choice</button></div>`,
    keep: (s) => `<div class="setting-desc">How long copies are kept before they are thinned out. The estimate is worked out from the real database size.</div>
      ${s.keep.options.map(o => `<label class="check mt-md"><input type="radio" name="sk" value="${esc(o.id)}" ${s.keep.choice === o.id ? 'checked' : ''}><span><b>${esc(o.label)}</b><br><span class="setting-desc">${esc(o.desc)}<br>${esc(o.line)}${o.warning ? `<br>${esc(o.warning)}` : ''}</span></span></label>`).join('')}
      <div class="row wrap mt-md"><button class="btn" id="sk-go">Use this</button></div>`,
    prove: (s) => `<div class="setting-desc">Makes the first full-site backup, opens it again as a test restore${s.where.offServer ? ', sends a copy off this server, fetches it back and tests that too' : ''}. The live site is not touched. It can take a minute.</div>
      <div class="row wrap mt-md"><button class="btn" id="sv-go">Run the first backup and test restore</button></div><div id="sv-out" class="mt-md"></div>`,
  };
  const summary = {
    passphrase: (s) => 'The passphrase is set and confirmed as saved elsewhere.',
    where: (s) => s.where.offServer ? `Copies also go off this server${s.where.tested.length ? ` (${s.where.tested.join(', ')})` : ''}.` : 'Copies stay on this server only.',
    keep: (s) => s.legacy && !s.keep.choice ? 'Existing settings are kept.' : `${(s.keep.options.find(o => o.id === s.keep.choice) || {}).label || 'Custom'} retention.`,
    prove: (s) => s.prove.at ? `First backup and test restore passed ${fmt.ago(s.prove.at)}.` : 'Existing install: shown as complete. You can run the check again at any time.',
  };

  B.setupPanel = (el, d, reload, goTab) => {
    const s = d.setup, active = s.steps.find(x => !x.locked && !x.done), tone = s.status === 'local' ? 'red' : 'blue';
    el.innerHTML = `<div class="card" id="setup"><div class="row spread wrap"><div><h3>Backup setup</h3><div class="setting-desc">Four short steps. Each one unlocks the next, so nothing is turned on before what it depends on is ready.</div></div>
        <span class="chip ${s.protected ? 'green' : 'amber'}" id="setup-state">${s.protected ? 'Protected' : 'Not protected yet'}</span></div>
      <div class="banner ${tone} mt-md" id="setup-status"><b>${esc(s.statusLabel)}.</b> ${esc(s.statusNote)}</div>${MAIL(s)}
      ${s.steps.map((st, i) => `<div class="setup-step ${st.locked ? 'locked' : ''}" data-step="${st.id}"><div class="row spread wrap"><div class="setting-title">${i + 1}. ${esc(st.label)}</div>${chipFor(st)}</div>
        ${st.done ? `<div class="setting-desc">${esc(summary[st.id](s))}</div>${st.id === 'passphrase' ? passRow(s) : ''}${st.id === 'prove' ? '<div class="row wrap mt-sm"><button class="btn secondary small" id="sv-go">Run it again</button></div><div id="sv-out" class="mt-sm"></div>' : ''}`
          : st.locked ? `<div class="setting-desc">Locked until step ${i} is done.</div>` : `<div class="mt-sm" data-body>${bodies[st.id](s)}</div>`}</div>`).join('')}</div>`;
    const api = async (path, body) => { try { const r = await Host.api('POST', `/backups/setup/${path}`, body); toast('Saved'); await reload(); return r; } catch (e) { toast(e.message, true); } };
    const val = (n) => el.querySelector(`input[name=${n}]:checked`)?.value;
    el.querySelector('#sp-go')?.addEventListener('click', (e) => busy(e.currentTarget, () => api('passphrase', { passphrase: el.querySelector('#sp-pass')?.value || '', confirm: el.querySelector('#sp-conf')?.value || '', saved: el.querySelector('#sp-saved').checked })));
    for (const k of ['check', 'change', 'reset']) el.querySelector(`#pc-${k}`)?.addEventListener('click', () => B.passSheet(k));
    el.querySelector('#sw-go')?.addEventListener('click', (e) => busy(e.currentTarget, () => api('where', { offServer: val('sw') === 'yes' ? true : val('sw') === 'no' ? false : null })));
    const more = el.querySelector('#sw-more'), moreText = () => { more.innerHTML = val('sw') === 'yes' ? `<div class="banner blue">Add a destination on the Destinations tab, press Test connection until it passes, then switch it on. This step finishes when a destination has passed its test.${s.where.tested.length ? ` Passed so far: ${esc(s.where.tested.join(', '))}.` : ''}</div><div class="row wrap mt-sm"><button class="btn secondary small" id="sw-dest">Go to Destinations</button></div>` : val('sw') === 'no' ? '<div class="banner red">Copies on the same disk are lost with the disk. You can add a destination later.</div>' : ''; more.querySelector('#sw-dest')?.addEventListener('click', () => goTab('destinations')); };
    if (more) { el.querySelectorAll('input[name=sw]').forEach(i => i.addEventListener('change', moreText)); moreText(); }
    el.querySelector('#sk-go')?.addEventListener('click', (e) => busy(e.currentTarget, () => api('keep', { choice: val('sk') })));
    el.querySelector('#sv-go')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
      const out = el.querySelector('#sv-out'); out.innerHTML = '<p class="hint">Working…</p>';
      try { const r = await Host.api('POST', '/backups/setup/prove'); out.innerHTML = `<div class="banner ${r.ok ? 'blue' : 'red'}">${r.ok ? 'The first backup and test restore passed.' : 'Something failed. Fix it and run it again.'}</div>${checkRows(r.checks)}`; toast(r.ok ? 'Protected' : 'The check failed', !r.ok); if (r.ok) setTimeout(reload, 1500); } catch (er) { out.innerHTML = `<div class="banner red">${esc(er.message)}</div>`; }
    }));
    return active;
  };
})();
