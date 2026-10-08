// APP / views / support — Support: My tickets, New ticket and one ticket's conversation. Reached from the account menu.
// Tickets are plain text that the myBoxStock team can read (unlike the encrypted account data), so the form says what not to paste.
(() => {
  const { esc, fmt, toast, busy, swap } = UI, A = AccountApp, api = (m, p, b) => A.api(m, '/support' + p, b);
  const PRIVACY = 'Tickets can be read by the myBoxStock team. Don’t paste customer details, passwords or your recovery key.';
  const KEPT = 'Closed tickets are kept until the owner of this site removes them.';
  const sub = () => location.hash.replace(/^#\//, '').split('?')[0].split('/')[1] || '';
  const head = (title, text, extra = '') => `<div class="page-head row spread wrap"><div><h1>${title}</h1>${text ? `<p>${text}</p>` : ''}</div>${extra}</div>`;

  // The opt-in "Attach diagnostics" control: reads what would be sent first, adds it only when switched on.
  const diagControl = (box) => {
    box.innerHTML = `<div class="setting"><div><div class="setting-title">Attach diagnostics</div><div class="setting-desc">Adds your app version, plan, people counts and recent warnings. It never includes inventory, customers or sales. You can read it before it is sent.</div></div><button type="button" class="btn secondary" data-dg>Attach diagnostics</button></div><div data-dgbox hidden><div class="codeblock" data-dgtext></div></div>`;
    const b = box.querySelector('[data-dg]'), pane = box.querySelector('[data-dgbox]'); let on = false;
    b.addEventListener('click', () => busy(b, async () => {
      if (on) { on = false; pane.hidden = true; b.textContent = 'Attach diagnostics'; return; }
      try { box.querySelector('[data-dgtext]').textContent = (await api('GET', '/diagnostics')).text; on = true; pane.hidden = false; b.textContent = 'Remove diagnostics'; } catch (e) { toast(e.message, true); }
    }));
    return { on: () => on, reset() { on = false; pane.hidden = true; b.textContent = 'Attach diagnostics'; } };
  };

  async function list(main) {
    const d = await api('GET', '/tickets');
    swap(main, `${head('Support', 'Ask for help and follow your tickets.', '<a class="btn" href="#/support/new">New ticket</a>')}
      <div class="banner blue mb-lg">${esc(PRIVACY)}</div>
      <div class="card"><h3>${d.isAdmin ? 'Tickets for this account' : 'My tickets'}</h3><div class="sub">${d.isAdmin ? 'You are an Administrator, so you see every ticket opened in this account.' : 'You see the tickets you opened.'} The newest activity is first. When the myBoxStock team replies, a red number appears beside your name at the top of every page.</div>
      ${d.tickets.length ? `<div class="tablewrap"><table><thead><tr><th>Ticket</th><th>Subject</th><th>Status</th><th>Category</th>${d.isAdmin ? '<th>Opened by</th>' : ''}<th>Last activity</th></tr></thead><tbody>${d.tickets.map(t => `<tr class="click" data-no="${t.number}"><td class="ident">${esc(t.label)}</td><td>${esc(t.subject)} ${t.unread ? '<span class="chip red">New reply</span>' : ''}</td><td>${UI.support.statusChip(t.status, t.statusLabel)}</td><td class="muted">${esc(t.category)}</td>${d.isAdmin ? `<td class="muted">${esc(t.requester)}</td>` : ''}<td class="muted">${esc(fmt.ago(t.updatedAt))}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">No tickets yet. Use New ticket when you need help.</div>'}</div>`);
    main.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', () => { location.hash = `#/support/${tr.dataset.no}`; }));
  }

  async function form(main) {
    const cfg = await api('GET', '/config');
    swap(main, `${head('New ticket', 'Tell us what you need. One ticket per question keeps things easy to follow.')}
      <div class="card"><div class="banner blue mb-lg">${esc(PRIVACY)} ${esc(KEPT)}</div>
        <div class="field"><label for="tc">Category</label>${UI.select.html({ id: 'tc', options: cfg.categories.map(c => [c, c]) })}</div>
        <div class="field"><label for="ts">Subject</label><input type="text" id="ts" maxlength="120" autocomplete="off"></div>
        <div class="field"><label for="tm">Message</label><textarea id="tm" maxlength="8000" rows="8"></textarea></div>
        <div class="field" id="pk"></div><div id="dg"></div>
        <div class="row row-end mt-lg"><a class="btn secondary" href="#/support">Cancel</a><button type="button" class="btn" id="go">Send ticket</button></div></div>`);
    const pk = UI.support.picker(main.querySelector('#pk'), { api: A.api, cfg }), dg = diagControl(main.querySelector('#dg'));
    main.querySelector('#go').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      if (pk.busy()) return toast('Wait for the screenshot to finish uploading.', true);
      try {
        const r = await api('POST', '/tickets', { category: UI.select.value(main.querySelector('#tc')), subject: main.querySelector('#ts').value, message: main.querySelector('#tm').value, attachmentIds: pk.ids(), diagnostics: dg.on() });
        toast(`Ticket ${r.ticket.label} sent`); location.hash = `#/support/${r.ticket.number}`;
      } catch (er) { toast(er.message, true); }
    }));
  }

  async function ticket(main, no) {
    let d; try { d = await api('GET', `/tickets/${no}`); } catch (e) { if (e.status === 404) { location.hash = '#/support'; return; } throw e; }
    const t = d.ticket, cfg = d.canReply ? await api('GET', '/config') : null, kind = (m) => m.who === 'system' ? 'system' : m.who === 'team' ? 'team' : m.who === 'you' ? 'mine' : 'theirs';
    const items = d.messages.map(m => ({ kind: kind(m), ts: m.ts, author: m.who === 'you' ? `You (${m.author})` : m.author, tag: m.who === 'team' ? 'Reply' : '', body: m.body, diagnostics: m.diagnostics, attachments: m.attachments }));
    swap(main, `${head(`${esc(t.label)} · ${esc(t.subject)}`, '', '<a class="btn secondary" href="#/support">All tickets</a>')}
      <div class="card"><div class="row wrap">${UI.support.statusChip(t.status, t.statusLabel)}<span class="chip">${esc(t.category)}</span><span class="muted text-sm">Opened ${esc(fmt.date(t.createdAt))} by ${esc(t.requester)}${t.own ? ' (you)' : ''}</span></div></div>
      <div class="card mt-lg"><h3>Conversation</h3><div class="sub">Replies from the myBoxStock team are shaded blue.</div>${UI.support.thread(items, '/api/app/support')}</div>
      ${d.canReply ? `<div class="card mt-lg"><h3>Reply</h3><div class="banner blue my-md">${esc(PRIVACY)}</div><div class="field"><label for="rm">Your message</label><textarea id="rm" maxlength="8000" rows="5"></textarea></div><div class="field" id="pk"></div><div id="dg"></div><div class="row row-end mt-lg"><button type="button" class="btn" id="go">Send reply</button></div></div>`
        : `<div class="card mt-lg"><div class="banner blue row spread wrap"><span>This ticket is closed. If you still need help, open a new ticket and mention ${esc(t.label)}.</span><a class="btn secondary small" href="#/support/new">New ticket</a></div></div>`}`);
    if (!d.canReply) return;
    const pk = UI.support.picker(main.querySelector('#pk'), { api: A.api, cfg }), dg = diagControl(main.querySelector('#dg'));
    main.querySelector('#go').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      if (pk.busy()) return toast('Wait for the screenshot to finish uploading.', true);
      try { const r = await api('POST', `/tickets/${no}/messages`, { message: main.querySelector('#rm').value, attachmentIds: pk.ids(), diagnostics: dg.on() }); toast(r.reopened ? 'Reply sent. The ticket is open again.' : 'Reply sent'); A.route(); }
      catch (er) { toast(er.message, true); }
    }));
  }

  A.views.support = async (main) => { const s = sub(); if (s === 'new') return form(main); if (/^\d+$/.test(s)) return ticket(main, Number(s)); return list(main); };
})();
