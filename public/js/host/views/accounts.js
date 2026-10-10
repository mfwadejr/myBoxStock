// HOST / views / accounts — search accounts; support actions per account and user (never business data).
(() => {
  const { esc, fmt, toast, sheet, confirmBox, busy, swap } = UI;

  const PLAN_CHIP = { trial: ['blue', 'Trial'], trial_expired: ['red', 'Trial ended'], free: ['green', 'Free'], paid: ['green', 'Paid'], paid_expired: ['red', 'Paid ended'] };
  const planChip = (b) => { const [c, l] = PLAN_CHIP[b.state]; return `<span class="chip ${c}">${l}${b.daysLeft != null && b.canWrite ? ` · ${b.daysLeft}d left` : ''}</span>`; };

  // Support actions ask for a short reason first; it is saved in the log and shown in the account's Support history.
  const askReason = (title, body = 'It is saved in the log, with your name.') => sheet(`<h2>${esc(title)}</h2><p class="sub">${body}</p><div class="field mt-md"><label for="rs">Reason (a few words)</label><input type="text" id="rs" maxlength="200" autocomplete="off"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Continue</button></div>`,
    { onMount: (el, close) => { const go = () => { const v = el.querySelector('#rs').value.trim(); if (v.length < 3) return toast('Say why, in a few words.', true); close(v); }; el.querySelector('#go').addEventListener('click', go); el.querySelector('#rs').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); } });
  const healthChips = (a) => [a.encrypted && !a.recovery_saved ? '<span class="chip amber">No recovery key</span>' : '', !a.encrypted ? '<span class="chip">Not encrypted</span>' : '', !a.admins_2fa ? '<span class="chip">2FA off</span>' : '', a.unverified ? '<span class="chip amber">Email not verified</span>' : ''].filter(Boolean).join(' ') || '<span class="chip green">Good</span>';

  // Sorting is remembered while the page is open (and when you come back to it from another page).
  const memory = { sort: '', dir: 'asc', attentionDays: '7' };
  const SORT_COLS = { business: 'Business', days: 'Plan days left', users: 'Users', last_login: 'Last sign-in' };
  const sortHead = (key, label) => { const on = memory.sort === key; return `<th aria-sort="${on ? (memory.dir === 'desc' ? 'descending' : 'ascending') : 'none'}"><button type="button" class="sort-btn${on ? ' on' : ''}" data-sort="${key}" aria-label="Sort by ${esc(SORT_COLS[key])}">${esc(label)}<span class="sort-mark" aria-hidden="true">${on ? (memory.dir === 'desc' ? '▼' : '▲') : ''}</span></button></th>`; };

  Host.views.accounts = async (main) => {
    let q = '', plan = '', health = '', page = 1, size = 25, rows = [];
    const picked = new Set();      // ticked account ids (kept across pages and searches until cleared)
    let allMatching = false;       // "Select all N matching": the bulk action takes everything the current search and filter shows
    // The server returns every match (up to 500); the table shows one page of them. Searching or filtering goes back to page 1.
    const reasonsOf = (a) => (a.attention || []).map(r => `<span class="chip amber">${esc(r)}</span>`).join(' ');
    const bar = () => {
      const box = main.querySelector('#bulk'); if (!box) return;
      const n = allMatching ? rows.length : picked.size;
      box.hidden = !n;
      box.querySelector('[data-count]').textContent = `${n} selected`;
      const all = box.querySelector('[data-all]'); all.hidden = allMatching || rows.length <= picked.size || !rows.length;
      all.textContent = `Select all ${rows.length} matching`;
    };
    const draw = () => {
      const pg = UI.pager(main.querySelector('#pg'), { page, size, total: rows.length, change: (n) => { page = n.page; size = n.size; draw(); } }); page = pg.page;
      const shown = rows.slice(pg.from, pg.to), everyShown = shown.length && shown.every(a => allMatching || picked.has(a.id));
      main.querySelector('#tbl').innerHTML = shown.length ? `<table><thead><tr><th><label class="check-cell"><input type="checkbox" id="selpage" aria-label="Select all accounts on this page" ${everyShown ? 'checked' : ''}></label></th>${sortHead('business', 'Business')}<th>Reseller ID</th><th>Owner</th>${sortHead('users', 'Users')}${sortHead('days', 'Plan')}<th>Status</th><th>Health</th>${sortHead('last_login', 'Last sign-in')}</tr></thead><tbody>${shown.map(a => `
        <tr class="click" data-id="${a.id}"><td data-label=""><label class="check-cell"><input type="checkbox" data-pick="${a.id}" aria-label="Select ${esc(a.business_name)}" ${allMatching || picked.has(a.id) ? 'checked' : ''}></label></td><td data-label="Business"><b>${esc(a.business_name)}</b>${a.demo ? ' ' + Host.demoFilter.chip() : ''}</td><td data-label="Reseller ID" class="ident">${esc(a.account_code)}</td><td data-label="Owner" class="muted">${esc(a.owner_email)}</td><td data-label="Users">${a.user_count}</td><td data-label="Plan">${planChip(a.billing)}</td>
        <td data-label="Status">${a.closing_at ? `<span class="chip red">Closing, erases ${fmt.date(a.closing_at)}</span>` : `<span class="chip ${a.status === 'active' ? 'green' : 'red'}">${esc(a.status)}</span>`}</td><td data-label="Health">${health === 'attention' && a.attention?.length ? reasonsOf(a) : healthChips(a)}</td><td data-label="Last sign-in" class="muted">${a.last_login ? fmt.ago(a.last_login) : 'never'}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${rows.length ? 'No accounts on this page.' : 'No accounts match.'}</div>`;
      bar();
    };
    const query = () => '?q=' + encodeURIComponent(q) + '&plan=' + encodeURIComponent(plan) + '&health=' + encodeURIComponent(health) + (health === 'attention' ? '&attentionDays=' + encodeURIComponent(memory.attentionDays) : '') + (memory.sort ? '&sort=' + memory.sort + '&dir=' + memory.dir : '') + Host.demoFilter.query('&');
    const load = async (reset) => {
      rows = await Host.api('GET', '/accounts' + query());
      if (reset) { page = 1; allMatching = false; }
      draw();
    };
    swap(main, `${Host.head('Accounts', 'Support tools for signed-up businesses. Their inventory, sales and customers are private and never shown here.')}
      <div class="card"><div class="row wrap"><div class="field grow"><input type="search" id="q" aria-label="Search accounts" placeholder="Search by business, Reseller ID or email"></div>
        <div class="field">${UI.select.html({ id: 'pf', options: [['', 'All plans'], ['trial', 'On trial'], ['free', 'Free (comped)'], ['paid', 'Paid'], ['expired', 'Ended / read-only']] })}</div>
        <div class="field">${UI.select.html({ id: 'hf', options: [['', 'Any health'], ['attention', 'Needs attention'], ['no_recovery', 'No recovery key saved'], ['no_2fa', 'No two-factor'], ['unverified', 'Email not verified'], ['inactive30', 'Inactive 30 days'], ['not_encrypted', 'Encryption not set up'], ['closing', 'Closing'], ['suspended', 'Suspended']] })}</div><div class="field">${Host.demoFilter.checkHtml()}</div>
        <div class="field" id="adwrap" hidden>${UI.select.html({ id: 'ad', value: memory.attentionDays, options: [['3', 'Trial ends within 3 days'], ['7', 'Trial ends within 7 days'], ['14', 'Trial ends within 14 days'], ['30', 'Trial ends within 30 days']] })}</div></div>
        <div class="bulkbar" id="bulk" role="region" aria-label="Bulk actions" hidden><b data-count>0 selected</b><button type="button" class="linkbtn" data-all hidden>Select all</button><button type="button" class="linkbtn" data-clear>Clear</button>
          <span class="bulkbar-actions"><button type="button" class="btn secondary small" data-bulk="extend_trial">Extend trial</button><button type="button" class="btn secondary small" data-bulk="change_plan">Change plan</button><button type="button" class="btn secondary small" data-bulk="announce">Send announcement</button><button type="button" class="btn secondary small" data-bulk="export">Export list</button></span></div>
        <div class="tablewrap" id="tbl"></div><div id="pg"></div></div>`);
    Host.demoFilter.wire(main, () => load(true));
    let t; main.querySelector('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; load(true); }, 250); });
    main.querySelector('#pf').addEventListener('change', (e) => { plan = UI.select.value(e.target); load(true); });
    main.querySelector('#hf').addEventListener('change', (e) => { health = UI.select.value(e.target); main.querySelector('#adwrap').hidden = health !== 'attention'; load(true); });
    main.querySelector('#ad').addEventListener('change', (e) => { memory.attentionDays = UI.select.value(e.target); load(true); });
    const tbl = main.querySelector('#tbl');
    tbl.addEventListener('click', (e) => {
      const sb = e.target.closest('[data-sort]');
      if (sb) { const k = sb.dataset.sort; memory.dir = memory.sort === k && memory.dir === 'asc' ? 'desc' : 'asc'; memory.sort = k; load(); return; }
      if (e.target.closest('.check-cell')) return;     // ticking a box never opens the account
      const tr = e.target.closest('tr[data-id]'); if (tr) accountSheet(tr.dataset.id, load);
    });
    tbl.addEventListener('change', (e) => {
      if (e.target.id === 'selpage') { const ids = rows.slice((page - 1) * size, page * size).map(a => a.id); if (!e.target.checked) allMatching = false; for (const id of ids) e.target.checked ? picked.add(id) : picked.delete(id); draw(); }
      else if (e.target.dataset.pick) { const id = e.target.dataset.pick; if (allMatching) { allMatching = false; rows.forEach(a => picked.add(a.id)); } e.target.checked ? picked.add(id) : picked.delete(id); draw(); }
    });
    const box = main.querySelector('#bulk');
    box.querySelector('[data-all]').addEventListener('click', () => { allMatching = true; draw(); });
    box.querySelector('[data-clear]').addEventListener('click', () => { allMatching = false; picked.clear(); draw(); });
    box.querySelectorAll('[data-bulk]').forEach(b => b.addEventListener('click', async () => {
      const selection = allMatching ? { all: true, query: { q, plan, health, attentionDays: memory.attentionDays } } : { ids: [...picked] };
      await Host.bulk.open(b.dataset.bulk, selection, allMatching ? rows.length : picked.size);
      load();
    }));
    await load();
    const open = (location.hash.replace(/^#\//, '').split('?')[0].split('/')[1] || '');   // #/accounts/<id> opens that account (links from a ticket)
    if (open) { history.replaceState(null, '', '#/accounts'); accountSheet(open, load); }
  };

  async function accountSheet(id, refresh) {
    const [d, sup] = await Promise.all([Host.api('GET', `/accounts/${id}`), Host.api('GET', `/support/accounts/${id}`).catch(() => ({ tickets: [], note: null }))]), a = d.account;
    const ticketRows = sup.tickets.length ? sup.tickets.map(t => `<div class="setting"><div><a href="#/support/${t.number}" class="setting-title">${esc(t.label)} · ${esc(t.subject)}</a><div class="setting-desc">${esc(t.category)} · ${esc(fmt.date(t.createdAt))} · ${esc(t.priority)}</div></div>${UI.support.statusChip(t.status, t.statusLabel)}</div>`).join('') : '<div class="setting-desc">This reseller has not opened any tickets.</div>';
    const rows = d.users.map(u => `<div class="setting"><div><div class="setting-title">${esc(u.username)} <span class="chip">${esc(u.role)}</span> ${u.totp_enabled ? '<span class="chip green">2FA</span>' : ''} ${u.disabled ? '<span class="chip red">disabled</span>' : ''} ${u.locked ? '<span class="chip red">locked out</span>' : ''} ${u.email ? (u.email_verified_at ? '<span class="chip green">Verified</span>' : '<span class="chip amber">Not verified</span>') : ''}</div>
      <div class="setting-desc">${esc(u.login)} · last sign-in ${fmt.ago(u.last_login)}</div></div><button class="btn secondary small" data-u="${u.id}">Manage</button></div>`).join('');
    await sheet(`<div class="row spread"><h2>${esc(a.business_name)} ${a.demo ? Host.demoFilter.chip() : ''}</h2><span class="chip ${a.status === 'active' ? 'green' : 'red'}">${esc(a.status)}</span></div>
      <p class="muted"><span class="ident">${esc(a.account_code)}</span> · created ${fmt.date(a.created_at)}</p>
      <div class="seg tabs my-md" id="atabs" role="tablist"><button type="button" data-p="account" class="on" role="tab">Account</button><button type="button" data-p="tickets" role="tab">Tickets (${sup.tickets.length})</button><button type="button" data-p="notes" role="tab">Host notes</button></div>
      <div data-pane="tickets" hidden><h3 class="mt-sm">Support tickets</h3>${ticketRows}<div class="row mt-md"><a class="btn secondary small" href="#/support">Open Support</a></div></div>
      <div data-pane="notes" hidden><h3 class="mt-sm">Host notes</h3><div class="setting-desc">Your own notes about this reseller, shared by all Host administrators. The reseller never sees them.${sup.note ? ` Last edited by ${esc(sup.note.updatedBy || '')} on ${esc(fmt.dateTime(sup.note.updatedAt))}.` : ''}</div>
        <div class="field mt-md"><label for="hn">Notes</label><textarea id="hn" maxlength="4000" rows="8">${esc(sup.note?.body || '')}</textarea></div><div class="row row-end"><button type="button" class="btn" id="hns">Save notes</button></div></div>
      <div data-pane="account">
      ${a.closing_at ? `<div class="banner red row spread wrap my-md"><span>Closing: erases on ${fmt.date(a.closing_at)}.</span><button class="btn secondary small" id="unclose">Restore</button></div>` : ''}
      <div class="banner blue my-md">You can help with sign-in and security. Business data is not visible to host administrators.</div>
      <h3 class="mt-sm">Data</h3>
      <div class="setting"><div><div class="setting-title">${d.data.encrypted ? '<span class="chip green">Encrypted</span>' : '<span class="chip amber">Not set up yet</span>'}</div><div class="setting-desc">${d.data.recordCount} stored record${d.data.recordCount === 1 ? '' : 's'}. Their contents are unreadable to you by design — only the account's own people can open them.</div></div></div>
      <h3 class="mt-sm">Terms</h3>
      <div class="setting"><div><div class="setting-title">${d.terms.version ? `<span class="chip ${d.terms.outdated ? 'amber' : 'green'}">${d.terms.outdated ? 'Older terms accepted' : 'Terms accepted'}</span>` : '<span class="chip amber">Not accepted yet</span>'}</div><div class="setting-desc">${d.terms.version ? `Version ${esc(d.terms.version)}, accepted ${fmt.date(d.terms.acceptedAt)}.` : 'This account was created before the Terms were introduced.'}${d.terms.outdated ? ` The current version is ${esc(d.terms.current)}; an Administrator is asked to accept it at their next sign-in.` : ''}</div></div></div>
      <h3 class="mt-sm">Plan</h3>
      <div class="setting"><div><div class="setting-title">${planChip(a.billing)} ${a.plan_note ? `<span class="muted text-sm">${esc(a.plan_note)}</span>` : ''}</div>
        <div class="setting-desc">${a.billing.endsAt ? `${a.billing.canWrite ? 'Ends' : 'Ended'} ${fmt.date(a.billing.endsAt)}` : a.plan === 'free' ? 'Free account — never expires' : 'No end date'}${a.billing.canWrite ? '' : ' · account is read-only'}</div></div>
        <button class="btn secondary small" id="plan">Change plan</button></div>
      ${d.history.length ? `<details class="mt-sm"><summary class="muted text-sm">Plan history (${d.history.length})</summary>${d.history.map(h => `<div class="setting-desc">${fmt.date(h.ts)} · ${esc(h.kind.replace(/_/g, ' '))}${h.to_plan && h.kind.startsWith('plan') ? ` → ${esc(h.to_plan)}` : ''} · ${esc(h.actor || '')}${h.note ? ` — ${esc(h.note)}` : ''}</div>`).join('')}</details>` : ''}
      <h3 class="mt-sm">Support tools</h3>
      <div class="setting"><div><div class="setting-title">Account access</div><div class="setting-desc">${a.status === 'active' ? 'Suspending signs everyone out until you reactivate.' : 'Suspended: nobody can sign in.'} Password resets, temporary passwords, two-factor resets and sign-out are under each person below. Each asks for a reason.</div></div>
        <div class="row">${a.plan === 'trial' ? '<button class="btn secondary small" id="ext">Extend trial</button>' : ''}<button class="btn secondary small" id="sus">${a.status === 'active' ? 'Suspend' : 'Reactivate'}</button></div></div>
      <h3 class="mt-sm">Receipts</h3>
      <div class="setting"><div><div class="setting-title">Money received</div><div class="setting-desc">${d.receipts.length ? '' : 'None recorded yet. '}Write down a payment received outside the app. Online payments can fill this in later.</div></div><button class="btn secondary small" id="rcp">Record a receipt</button></div>
      ${d.receipts.map(x => `<div class="setting"><div><div class="setting-title tab-num">${esc((x.amount_cents / 100).toFixed(2))} ${esc(x.currency)}</div><div class="setting-desc">${fmt.date(x.ts)} · ${esc(x.method || 'payment')}${x.reference ? ` · ${esc(x.reference)}` : ''}${x.period_end ? ` · paid through ${fmt.date(x.period_end)}` : ''}${x.note ? ` — ${esc(x.note)}` : ''} · ${esc(x.actor || '')}</div></div><button class="btn danger small" data-rr="${x.id}">Remove</button></div>`).join('')}
      <h3 class="mt-sm">Support history</h3>
      ${d.support.length ? d.support.slice(0, 15).map(s => `<div class="setting-desc">${fmt.date(s.ts)} · ${esc(s.actor || 'system')} · ${esc(s.event.replace(/[._]/g, ' '))}${s.reason ? ` — ${esc(s.reason)}` : ''}</div>`).join('') : '<div class="setting-desc">Nothing yet.</div>'}
      <h3 class="mt-sm">Site admin linking</h3>
      <div class="setting"><div><div class="setting-title">Allow this account to link a Host administrator</div><div class="setting-desc">Shows the Link option in the account's Security page, so a person who also runs the site can switch between the two. Off by default. ${d.isOwner ? 'Switching it off removes any existing links.' : 'Only the Owner administrator can change this.'}</div></div><label class="switch"><input type="checkbox" id="hla" ${a.host_link_allowed ? 'checked' : ''} ${d.isOwner ? '' : 'disabled'}><i></i></label></div>
      <h3 class="mt-sm">People</h3>${rows}
      </div>
      <div class="actions split"><div class="row"><button class="btn danger small" id="del">Delete</button></div><button class="btn" data-cancel>Done</button></div>`, {
      onMount: (el, close) => {
        const tabs = el.querySelector('#atabs'); UI.tabRow(tabs);
        tabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-p]'); if (!b) return; tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); el.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.p; }); UI.tabRow.sync(tabs); });
        el.querySelectorAll('[data-pane=tickets] a').forEach(l => l.addEventListener('click', () => close(null)));
        el.querySelector('#hns').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await Host.api('PUT', `/support/accounts/${id}/notes`, { body: el.querySelector('#hn').value }); toast('Notes saved'); } catch (er) { toast(er.message, true); } }));
        el.querySelector('#plan').addEventListener('click', () => { close(); planSheet(a, () => accountSheet(id, refresh)); });
        el.querySelector('#hla').addEventListener('change', async (e) => { try { await Host.api('POST', `/accounts/${id}/host-link`, { allowed: e.target.checked }); toast(e.target.checked ? 'Linking allowed' : 'Linking turned off'); } catch (er) { e.target.checked = !e.target.checked; toast(er.message, true); } });
        el.querySelector('#sus').addEventListener('click', async () => { const reason = await askReason(a.status === 'active' ? 'Suspend this account?' : 'Reactivate this account?', a.status === 'active' ? 'Everyone is signed out and cannot sign in until it is reactivated.' : 'People can sign in again.'); if (!reason) return; try { await Host.api('POST', `/accounts/${id}/status`, { status: a.status === 'active' ? 'suspended' : 'active', reason }); toast('Updated'); close(); refresh(); } catch (er) { toast(er.message, true); } });
        el.querySelector('#ext')?.addEventListener('click', () => { close(); planSheet(a, () => accountSheet(id, refresh), { extend: true }); });
        el.querySelector('#rcp').addEventListener('click', () => { close(); receiptSheet(a, () => accountSheet(id, refresh)); });
        el.querySelectorAll('[data-rr]').forEach(b => b.addEventListener('click', async () => { const reason = await askReason('Remove this receipt record?'); if (!reason) return; try { await Host.api('DELETE', `/accounts/${id}/receipts/${b.dataset.rr}`, { reason }); toast('Removed'); close(); accountSheet(id, refresh); } catch (er) { toast(er.message, true); } }));
        el.querySelector('#unclose')?.addEventListener('click', async () => { try { await Host.api('POST', `/accounts/${id}/restore-closing`); toast('Closing cancelled'); close(); refresh(); } catch (er) { toast(er.message, true); } });
        el.querySelector('#del').addEventListener('click', async () => {
          close();
          const r = await deleteSheet(a, d.mailReady);
          if (r) { try { await Host.api('DELETE', `/accounts/${id}`, r); toast('Account deleted'); refresh(); } catch (er) { toast(er.message, true); } }
        });
        el.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { const u = d.users.find(x => x.id === b.dataset.u); close(); userSheet(a, u, () => accountSheet(id, refresh)); }));
      } });
  }

  // Delete sheet: type the Reseller ID, optional reason (goes in the "account erased" email). Warns in red when Email is not set up, so nobody will be told.
  const deleteSheet = (a, mailReady) => sheet(`<h2>Delete account?</h2><p class="muted">This permanently erases the account, its users and all of its data. It cannot be undone. The Host cannot recover it: the data is encrypted, and the only way back is the customer's own backup file.</p>
      ${mailReady ? '<p class="muted">One “account erased” email is sent to the owner and the Administrators after the delete. The delete never waits for it.</p>' : '<div class="banner red my-md" role="alert">Email is not set up, so nobody will be told this account was deleted. Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway.</div>'}
      <div class="field mt-md"><label for="rs">Reason (included in the email, optional)</label><input type="text" id="rs" maxlength="200" autocomplete="off"></div>
      <div class="field"><label for="tc">Type <b>${esc(a.account_code)}</b> to confirm</label><input type="text" id="tc" autocomplete="off"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="ok" disabled>Delete forever</button></div>`,
    { onMount: (el, close) => { const ok = el.querySelector('#ok'), tc = el.querySelector('#tc'); tc.addEventListener('input', () => { ok.disabled = tc.value !== a.account_code; }); ok.addEventListener('click', () => close({ confirm: tc.value, reason: el.querySelector('#rs').value.trim() })); } });

  async function userSheet(a, u, back) {
    await sheet(`<h2>${esc(u.username)}</h2><p class="muted">${esc(u.login)}</p>
      <div class="stack mt-lg">
        <button class="btn secondary" id="link" ${u.email ? '' : 'disabled'}>Email a password reset link</button>
        <button class="btn secondary" id="vr" ${u.email && !u.email_verified_at ? '' : 'disabled'}>Resend the confirmation email</button>
        <button class="btn secondary" id="mv" ${u.email && !u.email_verified_at ? '' : 'disabled'}>Mark email as confirmed</button>
        <button class="btn secondary" id="tmp">Set a temporary password</button>
        <button class="btn secondary" id="mfa" ${u.totp_enabled ? '' : 'disabled'}>Reset two-factor authentication</button>
        <button class="btn secondary" id="unl" ${u.locked ? '' : 'disabled'}>${u.locked ? 'Unlock this sign-in' : 'Not locked out'}</button>
        <button class="btn secondary" id="so">Sign out everywhere</button>
        <button class="btn ${u.disabled ? 'secondary' : 'danger'}" id="dis">${u.disabled ? 'Enable sign-in' : 'Disable sign-in'}</button>
        <button class="btn danger" id="rm">Delete this user</button></div>
      <div class="actions"><button class="btn" data-cancel>Back</button></div>`, { onMount: (el, close) => {
        const act = (sel, fn) => el.querySelector(sel).addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await fn(); } catch (er) { toast(er.message, true); } }));
        act('#link', async () => { const reason = await askReason('Email a password reset link', `A link goes to ${esc(u.email)}. It is saved in the log, with your name.`); if (!reason) return; await Host.api('POST', `/accounts/${a.id}/users/${u.id}/reset-link`, { reason }); toast('Reset link queued for ' + u.email); });
        act('#vr', async () => { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/verify-resend`); toast('Confirmation email queued for ' + u.email); });
        act('#mv', async () => {
          close(); const ok = await sheet(`<h2>Mark email as confirmed</h2><p class="sub">Use this only when you have checked it another way. It is recorded in the log with your reason.</p><div class="field mt-md"><label for="rs">Reason</label><input type="text" id="rs" placeholder="e.g. confirmed by phone"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Mark as confirmed</button></div>`,
            { onMount: (el, cl) => el.querySelector('#go').addEventListener('click', async () => { try { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/mark-verified`, { reason: el.querySelector('#rs').value }); cl(true); } catch (er) { toast(er.message, true); } }) });
          if (ok) toast('Marked as confirmed'); back?.();
        });
        act('#tmp', async () => {
          const reason = await askReason('Set a temporary password', 'They are signed out everywhere and must choose a new password. It is saved in the log, with your name.'); if (!reason) return;
          const r = await Host.api('POST', `/accounts/${a.id}/users/${u.id}/temp-password`, { reason }); close();
          await sheet(`<h2>Temporary password</h2><p class="muted">Share this securely with ${esc(u.username)}. They must change it at next sign-in, and it is shown only now.</p><div class="codeblock mt-md">${esc(r.tempPassword)}</div><div class="actions"><button class="btn" data-cancel>Done</button></div>`);
        });
        act('#mfa', async () => { const reason = await askReason('Reset two-factor?', `${esc(u.username)} will be signed out and must set up two-factor again.`); if (reason) { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/reset-mfa`, { reason }); toast('Two-factor reset'); close(); } });
        act('#unl', async () => { const reason = await askReason('Unlock this sign-in?', `${esc(u.username)} can try again right away. Their password is not shown or changed. It is saved in the log and the Audit trail, with your name.`); if (reason) { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/unlock`, { reason }); toast('Unlocked'); close(); } });
        act('#so', async () => { const reason = await askReason('Sign out everywhere?', `${esc(u.username)} is signed out on every device.`); if (reason) { await Host.api('POST', `/accounts/${a.id}/users/${u.id}/sign-out`, { reason }); toast('Signed out everywhere'); close(); } });
        act('#rm', async () => {
          close(); const c = await confirmBox({ title: 'Delete user?', body: `${esc(u.login)} is removed from the account and can no longer sign in. This cannot be undone.`, confirmLabel: 'Delete user', danger: true, typeToConfirm: u.login });
          if (c) { try { await Host.api('DELETE', `/accounts/${a.id}/users/${u.id}`, { confirm: c }); toast('User deleted'); } catch (er) { toast(er.message, true); } }
          back();
        });
        act('#dis', async () => { const reason = await askReason(u.disabled ? 'Enable sign-in?' : 'Disable sign-in?'); if (!reason) return; await Host.api('POST', `/accounts/${a.id}/users/${u.id}/disabled`, { disabled: !u.disabled, reason }); toast('Updated'); close(); });
      } });
    back();
  }

  async function receiptSheet(a, back) {
    await sheet(`<h2>Record a receipt</h2><p class="muted">${esc(a.business_name)} · <span class="ident">${esc(a.account_code)}</span></p>
      <div class="grid g2 mt-md"><div class="field"><label for="am">Amount received</label><input type="text" id="am" inputmode="decimal" placeholder="29.00"></div><div class="field"><label for="cu">Currency</label><input type="text" id="cu" value="USD" maxlength="3"></div></div>
      <div class="grid g2"><div class="field"><label for="me">How it was paid</label><input type="text" id="me" placeholder="Bank transfer" maxlength="40"></div><div class="field"><label for="re">Reference</label><input type="text" id="re" placeholder="Invoice or transfer number" maxlength="120"></div></div>
      <div class="field"><label for="pt">Paid through (optional)</label><input type="date" id="pt"><label class="check mt-sm"><input type="checkbox" id="ap"> Also set the plan to Paid through that date</label></div>
      <div class="field"><label for="no">Note</label><input type="text" id="no" maxlength="255"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save receipt</button></div>`, { onMount: (el, close) => {
        el.querySelector('#go').addEventListener('click', (e) => busy(e.currentTarget, async () => {
          try { await Host.api('POST', `/accounts/${a.id}/receipts`, { amount: el.querySelector('#am').value, currency: el.querySelector('#cu').value, method: el.querySelector('#me').value, reference: el.querySelector('#re').value, paidThrough: el.querySelector('#pt').value, applyPlan: el.querySelector('#ap').checked, note: el.querySelector('#no').value }); toast('Receipt saved'); close(true); }
          catch (er) { toast(er.message, true); }
        }));
      } });
    back();
  }

  // Change plan: free (comped), trial (start / extend), paid. Everything is recorded in the account's plan history.
  async function planSheet(a, back, { extend = false } = {}) {
    await sheet(`<h2>Change plan</h2><p class="muted">${esc(a.business_name)} · <span class="ident">${esc(a.account_code)}</span></p>
      <div class="field mt-md"><label for="pl">Plan</label>${UI.select.html({ id: 'pl', value: extend ? 'trial' : ['free', 'trial', 'paid'].includes(a.plan) ? a.plan : 'free', options: [['free', 'Free — comped, never expires'], ['trial', 'Free trial'], ['paid', 'Paid']] })}</div>
      <div class="field" id="f-days"><label for="days">Trial length (days)</label><input type="number" id="days" class="num" min="1" max="730" value="14"><label class="check mt-sm"><input type="checkbox" id="ext" ${extend ? 'checked' : ''}> Add to the current end date instead of starting today</label></div>
      <div class="field" id="f-until"><label for="until">Paid through (optional)</label><input type="date" id="until"><div class="hint">Leave empty for no end date.</div></div>
      <div class="field"><label for="note">Reason (saved in the account's history)</label><input type="text" id="note" maxlength="255" placeholder="e.g. Comped for launch partner"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save plan</button></div>`, { onMount: (el, close) => {
        const pl = el.querySelector('#pl'), plan = () => UI.select.value(pl);
        const sync = () => { el.querySelector('#f-days').hidden = plan() !== 'trial'; el.querySelector('#f-until').hidden = plan() !== 'paid'; };
        pl.addEventListener('change', sync); sync();
        el.querySelector('#go').addEventListener('click', (e) => busy(e.currentTarget, async () => {
          try { await Host.api('POST', `/accounts/${a.id}/plan`, { plan: plan(), days: Number(el.querySelector('#days').value), extend: el.querySelector('#ext').checked, until: el.querySelector('#until').value, reason: el.querySelector('#note').value }); toast('Plan updated'); close(); }
          catch (er) { toast(er.message, true); }
        }));
      } });
    back();
  }
})();
