// HOST / views / support — Support: the ticket list with filters, one ticket (header, conversation, requester panel, reply and internal notes) and Support settings.
// The Host reads what the reseller wrote in the ticket (never their encrypted data). Every change here is written to the audit trail by the server.
(() => {
  const { esc, fmt, toast, busy, sheet, swap } = UI, api = (m, p, b) => Host.api(m, '/support' + p, b), S = () => UI.support;
  const parts = () => location.hash.replace(/^#\//, '').split('?')[0].split('/');
  const F = { status: 'active', priority: '', category: '', assignee: '', q: '' };   // the list filters survive opening a ticket and coming back
  const STATUS_FILTER = [['active', 'Active tickets'], ['open', 'Open'], ['waiting_host', 'Waiting on Host'], ['waiting_reseller', 'Waiting on reseller'], ['overdue', 'Overdue'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['all', 'All tickets']];
  const PLAN = { trial: ['blue', 'Trial'], trial_expired: ['red', 'Trial ended'], free: ['green', 'Free'], paid: ['green', 'Paid'], paid_expired: ['red', 'Paid ended'] };
  const waitText = (t) => t.waiting.on ? `${S().waited(t.waiting.since)} for ${t.waiting.on === 'host' ? 'Host' : 'reseller'}` : '—';
  const tabs = (on) => `<div class="seg tabs mb-lg" id="tabs" role="tablist"><button type="button" data-t="tickets" class="${on === 'tickets' ? 'on' : ''}" role="tab">Tickets</button><button type="button" data-t="settings" class="${on === 'settings' ? 'on' : ''}" role="tab">Settings</button></div>`;
  const wireTabs = (main) => { const row = main.querySelector('#tabs'); UI.tabRow(row); row.addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) location.hash = b.dataset.t === 'settings' ? '#/support/settings' : '#/support'; }); };

  // ---------------------------------------------------------------- the list
  async function listPage(main) {
    const [cfg, staff, sm] = await Promise.all([api('GET', '/settings'), api('GET', '/staff'), api('GET', '/summary')]), s = cfg.settings;
    swap(main, `${Host.head('Support', 'Tickets that signed-in resellers opened from their app. You can read what they write here, so they are told not to paste customer details, passwords or recovery keys.')}${tabs('tickets')}
      <div class="row wrap mb-lg" id="stats"><button type="button" class="chip" id="od" aria-pressed="false" aria-label="Overdue tickets"></button><span class="hint mt-0" id="odh"></span></div>
      <div id="live" aria-live="polite"></div>
      <div class="card"><div class="row wrap">
        <div class="field">${UI.select.html({ id: 'fs', options: STATUS_FILTER, value: F.status })}</div>
        <div class="field">${UI.select.html({ id: 'fp', options: [['', 'Any priority'], ...s.priorities.map(p => [p, p])], value: F.priority })}</div>
        <div class="field">${UI.select.html({ id: 'fc', options: [['', 'Any category'], ...s.categories.map(c => [c, c])], value: F.category })}</div>
        <div class="field">${UI.select.html({ id: 'fa', options: [['', 'Anyone'], ['none', 'Unassigned'], ...staff.map(a => [a.id, a.username])], value: F.assignee })}</div>
        <div class="field grow"><input type="search" id="q" placeholder="Search tickets: number, subject, reseller, person, message" value="${esc(F.q)}" aria-label="Search tickets"></div></div>
        <div id="tbl" class="mt-md"></div><div id="more"></div></div>`);
    wireTabs(main);
    let shown = 0, total = 0, baseline = 0, marker = '', pending = null, checking = false;
    const row = (t) => `<tr class="click" data-no="${t.number}"><td class="ident">${esc(t.label)}</td><td><b>${esc(t.subject)}</b><div class="hint mt-0">${esc(t.category)}</div></td><td>${esc(t.accountName || '')} <span class="ident muted">${esc(t.accountCode || '')}</span></td>
      <td>${S().statusChip(t.status, t.statusLabel)}</td><td>${esc(t.priority)}</td><td class="muted">${esc(t.assignee || 'Unassigned')}</td><td class="muted">${esc(fmt.ago(t.updatedAt))}</td><td class="muted">${esc(waitText(t))} ${t.overdue ? '<span class="chip red">Overdue</span>' : ''}</td></tr>`;
    const query = (offset, limit) => { const p = new URLSearchParams({ status: F.status, offset }); if (limit) p.set('limit', limit); for (const k of ['priority', 'category', 'assignee', 'q']) if (F[k]) p.set(k, F[k]); return api('GET', '/tickets?' + p); };
    const hideBar = () => { pending = null; main.querySelector('#live').innerHTML = ''; };
    // The Overdue number is the one the menu count, the alert and the Overview card use (the summary). Red when above zero, neutral at zero.
    const paintOverdue = (n, days) => {
      const od = main.querySelector('#od'); if (!od) return;
      od.textContent = `${n} overdue`; od.classList.toggle('red', n > 0); od.setAttribute('aria-pressed', String(F.status === 'overdue')); od.classList.toggle('on', F.status === 'overdue');
      od.setAttribute('aria-label', `${n} overdue ticket${n === 1 ? '' : 's'}, past the response target. ${F.status === 'overdue' ? 'Showing them; select to go back to active tickets.' : 'Select to show only these.'}`);
      main.querySelector('#odh').textContent = `Past the response target of ${days} business day${days === 1 ? '' : 's'}.`;
    };
    const paint = (d, more) => {
      total = d.total; shown = (more ? shown : 0) + d.tickets.length; baseline = Math.max(baseline, d.newest || 0); if (!more) marker = d.latest;
      const box = main.querySelector('#tbl'), keep = !more && document.activeElement?.closest?.('#tbl tr[data-no]')?.dataset.no;   // the row being used with the keyboard keeps focus through a refresh
      if (!more) box.innerHTML = d.tickets.length ? `<div class="tablewrap"><table><thead><tr><th>Ticket</th><th>Subject</th><th>Reseller</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Last activity</th><th>Waiting</th></tr></thead><tbody>${d.tickets.map(row).join('')}</tbody></table></div>` : '<div class="empty">No tickets match. Change the filters, or enjoy the quiet.</div>';
      else box.querySelector('tbody').insertAdjacentHTML('beforeend', d.tickets.map(row).join(''));
      if (keep) box.querySelector(`tr[data-no="${keep}"]`)?.focus({ preventScroll: true });
      UI.more(main.querySelector('#more'), { shown, total, noun: total === 1 ? 'ticket' : 'tickets', load: () => load(true).catch(e => toast(e.message, true)) });
    };
    const load = async (more) => { const d = await query(more ? shown : 0); if (!more) { hideBar(); baseline = d.newest || 0; } paint(d, more); };
    const refresh = () => load(false).catch(e => toast(e.message, true));
    // Live refresh (T36): the menu poll hands over the light summary. Only when its change marker moved is the list asked again, with as many rows as are on screen.
    // Rows that changed are swapped in place (filters, search text, scroll and the ticket being read are untouched); new tickets wait behind a bar so the list never jumps.
    Host.onSummary = async (sum) => {
      if (!main.isConnected) { Host.onSummary = null; return; }
      paintOverdue(sum.overdue, sum.responseDays);
      if (checking || sum.latest === marker) return;
      checking = true;
      try {
        const d = await query(0, Math.max(shown, 100)), fresh = d.tickets.filter(t => t.number > baseline).length;
        if (fresh) { pending = d; marker = d.latest; main.querySelector('#live').innerHTML = `<div class="banner blue mb-lg">${fresh} new ticket${fresh === 1 ? '' : 's'} <button type="button" class="linkish" id="showlive">show</button></div>`; }
        else { hideBar(); const y = window.scrollY, top = main.scrollTop; paint(d, false); window.scrollTo(0, y); main.scrollTop = top; }
      } catch {} finally { checking = false; }
    };
    main.querySelector('#live').addEventListener('click', (e) => { if (!e.target.closest('#showlive') || !pending) return; const d = pending; hideBar(); baseline = d.newest || 0; paint(d, false); window.scrollTo(0, 0); main.querySelector('#tbl tr[data-no]')?.focus({ preventScroll: true }); });
    paintOverdue(sm.overdue, sm.responseDays);
    main.querySelector('#od').addEventListener('click', () => { F.status = F.status === 'overdue' ? 'active' : 'overdue'; UI.select.set(main.querySelector('#fs'), F.status); paintOverdue(Host.support?.overdue ?? sm.overdue, sm.responseDays); refresh(); });
    for (const [id, key] of [['fs', 'status'], ['fp', 'priority'], ['fc', 'category'], ['fa', 'assignee']]) main.querySelector('#' + id).addEventListener('change', (e) => { F[key] = UI.select.value(e.target); paintOverdue(Host.support?.overdue ?? sm.overdue, sm.responseDays); refresh(); });
    let t; main.querySelector('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { F.q = e.target.value.trim(); refresh(); }, 300); });
    main.querySelector('#tbl').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-no]'); if (tr) location.hash = `#/support/${tr.dataset.no}`; });
    await load(false);
  }

  // ---------------------------------------------------------------- one ticket
  const planChip = (a) => { if (a.gone) return '<span class="chip red">Account erased</span>'; const [c, l] = PLAN[a.plan] || ['', a.plan || '—']; return `<span class="chip ${c}">${esc(l)}${a.daysLeft != null && a.canWrite ? ` · ${a.daysLeft}d left` : ''}</span>`; };
  const days = (ts) => ts ? `${Math.max(0, Math.floor((Date.now() - ts) / 86400e3))} days` : '—';

  async function ticketPage(main, no) {
    let d; try { d = await api('GET', `/tickets/${no}`); } catch (e) { if (e.status === 404) { toast('That ticket could not be found.', true); location.hash = '#/support'; return; } throw e; }
    const t = d.ticket, r = d.requester, o = d.options, opt = (list) => list.map(x => Array.isArray(x) ? x : [x, x]);
    const cats = o.categories.includes(t.category) ? o.categories : [...o.categories, t.category];
    const items = d.messages.map(m => m.side === 'system' ? { kind: 'system', ts: m.ts, body: m.internal ? `${m.body} (Host only)` : m.body }
      : m.side === 'host' ? { kind: m.internal ? 'note' : 'team', ts: m.ts, author: m.author, tag: m.internal ? 'Internal note, hidden from the reseller' : 'Reply', body: m.body, diagnostics: m.diagnostics, attachments: m.attachments }
      : { kind: 'theirs', ts: m.ts, author: m.author || r.person.username, tag: '', body: m.body, diagnostics: m.diagnostics, attachments: m.attachments });
    const others = r.others.length ? r.others.map(x => `<div class="setting"><div><a href="#/support/${x.number}" class="setting-title">${esc(x.label)} · ${esc(x.subject)}</a><div class="setting-desc">${esc(fmt.date(x.createdAt))}</div></div>${S().statusChip(x.status, x.statusLabel)}</div>`).join('') : '<div class="setting-desc">None. This is their first ticket.</div>';
    swap(main, `${Host.head(`${esc(t.label)} · ${esc(t.subject)}`)}
      <div class="card"><div class="card-head"><div class="row wrap">${S().statusChip(t.status, t.statusLabel)}${t.overdue ? '<span class="chip red">Overdue</span>' : ''}<span class="chip">${esc(t.priority)}</span><span class="chip">${esc(t.category)}</span></div><a class="btn secondary" href="#/support">All tickets</a></div>
        <div class="grid g2">
          <div class="field"><label for="st">Status</label>${UI.select.html({ id: 'st', options: o.statuses, value: t.status })}</div>
          <div class="field"><label for="pr">Priority</label>${UI.select.html({ id: 'pr', options: opt(o.priorities), value: t.priority })}</div>
          <div class="field"><label for="ct">Category</label>${UI.select.html({ id: 'ct', options: opt(cats), value: t.category })}</div>
          <div class="field"><label for="as">Assigned to</label>${UI.select.html({ id: 'as', options: [['', 'Unassigned'], ...o.staff.map(a => [a.id, a.username])], value: t.assigneeId || '' })}</div></div>
        <dl class="facts"><dt>Ticket</dt><dd class="ident">${esc(t.label)}</dd><dt>Created</dt><dd>${esc(fmt.date(t.createdAt))}</dd><dt>Last activity</dt><dd>${esc(fmt.date(t.updatedAt))} (${esc(fmt.ago(t.updatedAt))})</dd><dt>Time waiting</dt><dd>${esc(waitText(t))}${t.overdue ? ` <span class="danger-text">past the response target</span>` : ''}</dd></dl></div>
      <div class="support-layout mt-lg"><div class="support-col">
        <div class="card"><h3>Conversation</h3><div class="sub">Notes shaded yellow are for the Host only. The reseller sees the blue replies and the status lines.</div>${S().thread(items, '/api/host/support')}</div>
        <div class="card"><div class="seg wide mb-lg" id="mode" role="tablist"><button type="button" data-m="reply" class="on" role="tab">Reply to reseller</button><button type="button" data-m="note" role="tab">Internal note</button></div>
          <div class="field" id="cn">${UI.select.html({ id: 'cr', options: [['', 'Insert a canned reply'], ...o.canned.map(c => [c.id, c.title])], value: '' })}</div>
          <div class="field"><label for="rb" id="rl">Your reply</label><textarea id="rb" maxlength="8000" rows="6"></textarea><div class="hint" id="rh">${esc(o.mailReady ? 'The reseller is also emailed that there is a reply (the email does not contain the reply).' : o.mailNote)}</div></div>
          <div class="field" id="pk"></div>
          <div class="field" id="sa"><label for="ss">After sending, set the status to</label>${UI.select.html({ id: 'ss', options: o.statuses, value: 'waiting_reseller' })}</div>
          <div class="row row-end"><button type="button" class="btn" id="send">Send reply</button></div></div></div>
        <div class="support-col"><div class="card"><h3>Requester</h3><div class="sub">Who this is and what they run.</div>
          <dl class="facts"><dt>Reseller</dt><dd>${r.account.gone ? esc(r.account.name || '—') : `<a href="#/accounts/${esc(r.account.id)}">${esc(r.account.name)}</a>`}</dd><dt>Reseller ID</dt><dd class="ident">${esc(r.account.code || '—')}</dd>
            <dt>Plan</dt><dd>${planChip(r.account)}</dd><dt>Account</dt><dd><span class="chip ${r.account.status === 'active' ? 'green' : 'red'}">${esc(r.account.status)}</span></dd><dt>Account age</dt><dd>${esc(days(r.account.createdAt))}</dd>
            <dt>Opened by</dt><dd>${esc(r.person.username || '—')} <span class="chip">${esc(r.person.role || '—')}</span>${r.person.removed ? ' <span class="chip red">removed</span>' : ''}</dd><dt>Email</dt><dd>${esc(r.person.email || 'none on file')}</dd>
            <dt>App version</dt><dd class="tab-num">${esc(r.appVersion || '—')}${r.appVersion && r.appVersion !== r.currentVersion ? ` <span class="muted">(server is now ${esc(r.currentVersion)})</span>` : ''}</dd><dt>Browser or device</dt><dd>${esc(r.device || '—')}</dd></dl>
          ${r.account.gone ? '' : `<div class="row mt-md"><a class="btn secondary small" href="#/accounts/${esc(r.account.id)}">Open the account</a></div>`}</div>
          <div class="card"><h3>Their other tickets</h3><div class="sub">Open and past, newest first.</div>${others}</div>
          <div class="card"><h3>Host note</h3>${r.hostNote ? `<div class="msg note mt-sm"><div class="msg-meta"><b>${esc(r.hostNote.updatedBy || '')}</b><span class="tab-num">${esc(fmt.dateTime(r.hostNote.updatedAt))}</span></div><div class="msg-body">${esc(r.hostNote.body)}</div></div>` : '<div class="setting-desc">No note yet.</div>'}
            ${r.account.gone ? '' : `<div class="hint">Edit it in the account, on the Host notes tab. The reseller never sees it.</div>`}</div></div></div>`);
    // status, priority, category and assignee save as soon as they change
    for (const [id, field] of [['st', 'status'], ['pr', 'priority'], ['ct', 'category'], ['as', 'assignee']]) main.querySelector('#' + id).addEventListener('change', async (e) => {
      try { await api('PATCH', `/tickets/${no}`, { [field]: UI.select.value(e.target) }); toast('Saved'); Host.route(); } catch (er) { toast(er.message, true); Host.route(); }
    });
    const pk = S().picker(main.querySelector('#pk'), { api: Host.api, cfg: { maxFiles: o.maxFiles, maxKB: o.maxKB } }); let mode = 'reply';
    const body = main.querySelector('#rb');
    const setMode = (m) => {
      mode = m; main.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
      main.querySelector('#cn').hidden = m !== 'reply'; main.querySelector('#sa').hidden = m !== 'reply'; main.querySelector('#rl').textContent = m === 'reply' ? 'Your reply' : 'Internal note (the reseller never sees this)'; main.querySelector('#rh').hidden = m !== 'reply'; main.querySelector('#send').textContent = m === 'reply' ? 'Send reply' : 'Add note';
    };
    main.querySelector('#mode').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) setMode(b.dataset.m); });
    main.querySelector('#cr').addEventListener('change', (e) => { const c = o.canned.find(x => x.id === UI.select.value(e.target)); if (c) { body.value = body.value.trim() ? `${body.value.trimEnd()}\n\n${c.body}` : c.body; body.focus(); } UI.select.set(e.target, ''); });
    main.querySelector('#send').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      if (pk.busy()) return toast('Wait for the screenshot to finish uploading.', true);
      try {
        const res = await api('POST', `/tickets/${no}/reply`, { message: body.value, internal: mode === 'note', status: mode === 'reply' ? UI.select.value(main.querySelector('#ss')) : undefined, attachmentIds: pk.ids() });
        toast(res.internal ? 'Note added' : res.email?.sent ? 'Reply sent and the reseller was emailed' : `Reply sent. ${res.email?.why || ''}`.trim()); Host.route();
      } catch (er) { toast(er.message, true); }
    }));
  }

  // ---------------------------------------------------------------- settings
  async function settingsPage(main) {
    const cfg = await api('GET', '/settings'), s = cfg.settings; let canned = s.canned.map(c => ({ ...c }));
    const num = (id, label, val, hint) => `<div class="field"><label for="${id}">${label}</label><input type="number" class="num" id="${id}" value="${esc(val)}" inputmode="numeric">${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
    const sw = (id, title, desc, on, off) => `<div class="setting"><div><div class="setting-title">${title}</div><div class="setting-desc">${desc}</div></div><label class="switch"><input type="checkbox" id="${id}" aria-label="${esc(title)}" ${on ? 'checked' : ''} ${off ? 'disabled' : ''}><i></i></label></div>`;
    const chosen = cfg.staffList.map(a => `<div class="setting"><div class="setting-title">${esc(a.username)}</div><label class="switch"><input type="checkbox" data-ch="${esc(a.id)}" aria-label="Send notices to ${esc(a.username)}" ${s.notifyChosen.includes(a.id) ? 'checked' : ''}><i></i></label></div>`).join('');
    const cannedHtml = () => canned.map((c, i) => `<div class="setting"><div class="grow"><div class="field"><label for="cn${i}">Title</label><input type="text" id="cn${i}" data-i="${i}" data-f="title" maxlength="60" value="${esc(c.title)}"></div><div class="field mb-0"><label for="cb${i}">Text</label><textarea id="cb${i}" data-i="${i}" data-f="body" maxlength="2000" rows="3">${esc(c.body)}</textarea></div></div><button type="button" class="icon-btn" data-rm="${i}" aria-label="Remove canned reply ${esc(c.title)}">&times;</button></div>`).join('') || '<div class="empty">No canned replies yet.</div>';
    swap(main, `${Host.head('Support', 'Tickets that signed-in resellers opened from their app. You can read what they write here, so they are told not to paste customer details, passwords or recovery keys.')}${tabs('settings')}
      ${cfg.mailReady ? '' : `<div class="banner mb-lg">Email is not set up, so resellers are not emailed about replies; they see a red number in their app instead. ${esc(cfg.mailNote)} <a href="#/email">Open Email</a></div>`}
      <div class="card"><h3>Categories and priorities</h3><div class="sub">The lists resellers and you choose from. One per line. Tickets keep the wording they were opened with.</div>
        <div class="grid g2"><div class="field"><label for="cats">Categories (up to 12)</label><textarea id="cats" rows="6">${esc(s.categories.join('\n'))}</textarea></div>
          <div class="field"><label for="pris">Priorities (2 to 6, lowest first)</label><textarea id="pris" rows="6">${esc(s.priorities.join('\n'))}</textarea><div class="mt-md"><label for="dp">New tickets start as</label>${UI.select.html({ id: 'dp', options: s.priorities.map(p => [p, p]), value: s.defaultPriority })}</div></div></div></div>
      <div class="card"><div class="card-head"><div><h3>Canned replies</h3><div class="sub mb-0">Ready-made answers you can insert into a reply. Edit the text after inserting.</div></div><button type="button" class="btn secondary" id="addc">Add canned reply</button></div><div id="canned">${cannedHtml()}</div></div>
      <div class="card"><h3>Targets and limits</h3><div class="sub">Business days are Monday to Friday. A ticket nobody has answered for the response target raises an alert.</div>
        <div class="grid g2"><div>${num('rd', 'Response target (business days)', s.responseDays, '1 to 30. Default 2.')}${num('ac', 'Days before Resolved closes by itself', s.autoCloseDays, '1 to 90. Default 7. A reply from the reseller reopens a Resolved ticket first.')}${num('pt', 'New tickets per account per hour', s.perHour, '1 to 60.')}${num('oc', 'Open tickets per account', s.openCap, '1 to 100.')}</div>
          <div>${num('mf', 'Screenshots per message', s.maxFiles, `0 turns screenshots off. Up to ${cfg.limits.maxFilesMax}. Only PNG or JPG are accepted.`)}${num('mk', 'Largest screenshot (KB)', s.maxKB, `50 to ${cfg.limits.maxKBMax}.`)}</div></div>
        <div class="row row-end mt-md"><button type="button" class="btn" id="save">Save support settings</button></div></div>
      <div class="card"><h3>New-ticket notices</h3><div class="sub">How the Host hears about a new ticket right away. Alerts always show in Alerts and raise its count; the email goes out through Email.</div>
        ${sw('ni', 'Show new tickets in Alerts', 'A line in Alerts links to the ticket and clears when the ticket is opened or replied to. High and Urgent show red.', s.notifyInApp)}
        ${sw('ne', 'Email the Host about new tickets', cfg.mailReady ? 'Sends the reseller name, priority, category and the first lines of the message. No screenshots. Switch on after a test email from Email has worked.' : 'Off until Email is set up and a test email has worked. Open Email first.', s.notifyEmail, !cfg.mailReady && !s.notifyEmail)}
        ${sw('rni', 'Show reseller replies in Alerts', 'When a reseller answers a ticket that is now waiting on the Host.', s.notifyReplyInApp)}
        ${sw('rne', 'Email the Host about reseller replies', cfg.mailReady ? 'Same email, for replies on a ticket waiting on the Host.' : 'Off until Email is set up and a test email has worked.', s.notifyReplyEmail, !cfg.mailReady && !s.notifyReplyEmail)}
        <div class="grid g2 mt-md"><div class="field"><label for="nr">Send emails to</label>${UI.select.html({ id: 'nr', options: [['all', 'All Host administrators'], ['owner', 'Owner only'], ['chosen', 'A chosen list']], value: s.notifyRecipients })}</div>
          <div class="field"><label for="nt">Which tickets</label>${UI.select.html({ id: 'nt', options: [['every', 'Every ticket'], ['high', 'Only High and Urgent']], value: s.notifyThreshold })}</div></div>
        <div class="field" id="nch"><label>Chosen list</label>${chosen}<div class="hint">Only administrators with an email address can be chosen.</div></div>
        ${sw('nd', 'Daily digest instead of one email per ticket', 'One email a day listing new tickets and reseller replies. Alerts are not affected.', s.notifyDigest)}
        ${num('np', 'Notice emails per hour', s.notifyPerHour, '1 to 200. Default 20. When the limit is reached the rest are not emailed (they still show in Alerts) and this is logged.')}
        <div class="row row-end mt-md"><button type="button" class="btn" id="savenote">Save support settings</button></div></div>
      <div class="card"><h3>Retention</h3><div class="sub">Closed tickets are kept, with their messages and screenshots, until the Owner administrator purges them. This is stated in the Terms and Privacy Policy and on the reseller’s form. ${cfg.closed} closed ticket${cfg.closed === 1 ? '' : 's'} held now.</div>
        ${cfg.isOwner ? '<button type="button" class="btn danger" id="purge">Purge closed tickets</button>' : '<div class="setting-desc">Only the Owner administrator can purge tickets.</div>'}</div>`);
    wireTabs(main);
    const reads = () => { main.querySelectorAll('#canned [data-i]').forEach(el => { canned[Number(el.dataset.i)][el.dataset.f] = el.value; }); };
    const wireCanned = () => main.querySelectorAll('#canned [data-rm]').forEach(b => b.addEventListener('click', () => { reads(); canned.splice(Number(b.dataset.rm), 1); main.querySelector('#canned').innerHTML = cannedHtml(); wireCanned(); }));
    wireCanned();
    main.querySelector('#addc').addEventListener('click', () => { reads(); canned.push({ id: '', title: '', body: '' }); main.querySelector('#canned').innerHTML = cannedHtml(); wireCanned(); main.querySelector(`#cn${canned.length - 1}`).focus(); });
    const on = (id) => main.querySelector('#' + id).checked, pick = (id) => UI.select.value(main.querySelector('#' + id));
    const showChosen = () => { main.querySelector('#nch').hidden = pick('nr') !== 'chosen'; }; showChosen(); main.querySelector('#nr').addEventListener('change', showChosen);
    const save = (e) => busy(e.currentTarget, async () => {
      reads(); const v = (id) => main.querySelector('#' + id).value;
      try { await api('PUT', '/settings', { categories: v('cats'), priorities: v('pris'), defaultPriority: pick('dp'), canned, responseDays: v('rd'), autoCloseDays: v('ac'), perHour: v('pt'), openCap: v('oc'), maxFiles: v('mf'), maxKB: v('mk'),
        notifyInApp: on('ni'), notifyEmail: on('ne'), notifyReplyInApp: on('rni'), notifyReplyEmail: on('rne'), notifyRecipients: pick('nr'), notifyThreshold: pick('nt'), notifyDigest: on('nd'), notifyPerHour: v('np'), notifyChosen: [...main.querySelectorAll('[data-ch]')].filter(x => x.checked).map(x => x.dataset.ch) });
        toast('Support settings saved'); Host.route(); }
      catch (er) { toast(er.message, true); }
    });
    main.querySelector('#save').addEventListener('click', save); main.querySelector('#savenote').addEventListener('click', save);
    main.querySelector('#purge')?.addEventListener('click', () => purgeSheet(cfg.closed));
  }

  // Owner only: remove closed tickets for good. Needs the word PURGE.
  async function purgeSheet(closed) {
    const done = await sheet(`<h2>Purge closed tickets</h2><p class="muted">This permanently deletes closed tickets, their messages and their screenshots. It cannot be undone, and it is recorded in the audit trail. Backups made earlier still hold them until those backups age out.</p>
      <div class="field mt-md"><label for="pd">Only tickets closed at least this many days ago (0 means every closed ticket)</label><input type="number" class="num" id="pd" value="90" min="0" max="3650" inputmode="numeric"><div class="hint" id="pc">${closed} closed ticket${closed === 1 ? '' : 's'} in total.</div></div>
      <div class="field"><label for="tc">Type <b>PURGE</b> to confirm</label><input type="text" id="tc" autocomplete="off"></div>
      <div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" id="ok" disabled>Purge</button></div>`,
    { onMount: (el, close) => {
      const ok = el.querySelector('#ok'), tc = el.querySelector('#tc'), pd = el.querySelector('#pd'); let seq = 0;
      const preview = async () => { const me = ++seq; try { const r = await api('GET', `/purge-preview?days=${encodeURIComponent(pd.value)}`); if (me === seq) el.querySelector('#pc').textContent = `${r.count} closed ticket${r.count === 1 ? '' : 's'} match.`; } catch (e) { el.querySelector('#pc').textContent = e.message; } };
      pd.addEventListener('input', preview); preview();
      tc.addEventListener('input', () => { ok.disabled = tc.value !== 'PURGE'; });
      ok.addEventListener('click', () => busy(ok, async () => { try { close(await api('POST', '/purge', { confirm: tc.value, days: Number(pd.value) })); } catch (e) { toast(e.message, true); } }));
    } });
    if (done) { toast(`Purged ${done.tickets} ticket${done.tickets === 1 ? '' : 's'}`); Host.route(); }
  }

  Host.views.support = async (main) => {
    const p = parts()[1] || ''; if (/^\d+$/.test(p)) return ticketPage(main, Number(p));
    return p === 'settings' ? settingsPage(main) : listPage(main);
  };
})();
