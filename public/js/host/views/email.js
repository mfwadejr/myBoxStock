// HOST / views / email — outbound email settings, test, recent queue.
(() => {
  const { esc, fmt, toast, busy, swap } = UI;

  const rowHtml = (q) => `<tr><td>${esc(q.to_addr)}</td><td class="muted">${esc(q.subject)}${q.last_error ? `<div class="hint danger-text">${esc(q.last_error)}</div>` : ''}</td><td><span class="chip ${q.status === 'sent' ? 'green' : q.status === 'failed' ? 'red' : 'amber'}">${q.status}</span></td><td class="muted">${fmt.ago(q.created_at)}</td><td class="right">${q.status === 'failed' ? `<button class="btn secondary small" data-resend="${esc(q.id)}">Resend</button>` : ''}</td></tr>`;
  const queueHtml = (queue) => queue.length ? `<table><thead><tr><th>To</th><th>Subject</th><th>Status</th><th>When</th><th></th></tr></thead><tbody>${queue.map(rowHtml).join('')}</tbody></table>` : '<div class="empty">Nothing sent yet.</div>';

  // Email page: two tabs. Delivery = how mail is sent; Messages = the wording of each message (views/messages.js).
  let tab = 'delivery';
  Host.views.email = async (main) => {
    swap(main, `${Host.head('Email', 'Outbound only — for password resets, welcome messages and security notices. This server never receives mail.')}
      <div class="banner blue mb-lg">Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway.</div>
      <div class="seg tabs mb-lg" id="etabs" role="tablist"><button type="button" data-t="delivery" class="${tab === 'delivery' ? 'on' : ''}">Delivery</button><button type="button" data-t="messages" class="${tab === 'messages' ? 'on' : ''}">Messages</button><button type="button" data-t="health" class="${tab === 'health' ? 'on' : ''}">Health</button></div><div id="pane"></div>`);
    const show = async () => { main.querySelectorAll('#etabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab)); UI.tabRow(main.querySelector('#etabs')); UI.tabRow.sync(main.querySelector('#etabs')); const pane = main.querySelector('#pane'); try { await (tab === 'messages' ? Host.emailMessages(pane) : tab === 'health' ? health(pane) : delivery(pane)); } catch (er) { toast(er.message, true); } };
    main.querySelectorAll('#etabs button').forEach(b => b.addEventListener('click', () => { if (tab !== b.dataset.t) { tab = b.dataset.t; show(); } }));
    show();
  };

  // Health tab: is mail getting out? Times and counts only.
  async function health(main) {
    const h = await Host.api('GET', '/mail/health'), ok = h.enabled && !h.failed24h && !(h.oldestQueuedAt && Date.now() - h.oldestQueuedAt > 30 * 60e3);
    swap(main, `<div class="card"><div class="card-head"><div><h3>Is email getting out?</h3><div class="sub mb-0">${h.enabled ? `Sending ${h.mode === 'smtp' ? 'through your SMTP relay' : 'directly to recipients'} from ${esc(h.fromAddress || 'no address set')}.` : 'Sending is turned off on the Delivery tab.'}</div></div><span class="chip ${ok ? 'green' : 'red'}">${ok ? 'Working' : 'Needs a look'}</span></div></div>
      <div class="grid g4"><div class="card stat"><div class="stat-label">Last successful send</div><div class="stat-value small">${h.lastSentAt ? esc(fmt.ago(h.lastSentAt)) : 'never'}</div></div>
        <div class="card stat"><div class="stat-label">Failed, last 24 hours</div><div class="stat-value">${h.failed24h}</div><div class="stat-note">${h.sent24h} sent</div></div>
        <div class="card stat"><div class="stat-label">Failed, last 7 days</div><div class="stat-value">${h.failed7d}</div><div class="stat-note">${h.sent7d} sent</div></div>
        <div class="card stat"><div class="stat-label">Waiting to send</div><div class="stat-value">${h.queued}</div><div class="stat-note">${h.oldestQueuedAt ? `oldest ${esc(fmt.ago(h.oldestQueuedAt))}` : 'queue is empty'}</div></div></div>
      ${h.lastFailureAt ? `<div class="card"><h3>Last failure</h3><div class="sub">${esc(fmt.ago(h.lastFailureAt))}. A message that fails five times is given up on; the receiving server’s refusal (a bounce) is shown here.</div><div class="hint danger-text">${esc(h.lastError)}</div></div>` : '<div class="card"><h3>No failures</h3><div class="sub mb-0">Nothing has failed recently.</div></div>'}
      <div class="card" id="sender"><h3>Sender checks</h3><div class="sub">Public DNS records of your From address’s domain that help receivers trust your mail. This app does not sign mail itself: your mail relay normally does, so “DKIM not found” is only a problem if your relay does not sign.</div>
        <div class="row wrap"><input type="text" id="dsel" placeholder="DKIM selector (optional, e.g. default)" class="maxw-md" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="DKIM selector"><button class="btn secondary" id="dgo">Check again</button></div>
        <div id="dres" class="mt-md" aria-live="polite"></div></div>`);
    const dres = main.querySelector('#dres'), STATUS = { found: ['green', 'Found'], missing: ['amber', 'Not found'], unknown: ['red', 'Could not check'] };
    const row = (name, c) => `<div class="setting"><div><div class="setting-title">${name}</div><div class="setting-desc">${esc(c.advice)}${c.record ? `<div class="hint ident">${esc(c.record)}</div>` : ''}</div></div><span class="chip ${STATUS[c.status][0]}">${STATUS[c.status][1]}</span></div>`;
    const run = async () => {
      dres.innerHTML = '<div class="hint">Checking…</div>';
      try {
        const sel = main.querySelector('#dsel').value.trim(), r = await Host.api('GET', '/mail/sender-checks' + (sel ? `?selector=${encodeURIComponent(sel)}` : ''));
        dres.innerHTML = r.error ? `<div class="hint">${esc(r.error)}</div>` : `<div class="hint mb-sm">Checked ${esc(r.domain)} just now.</div>${row('SPF', r.spf)}${row('DMARC', r.dmarc)}${row(`DKIM${r.dkim.selector ? ` (${esc(r.dkim.selector)})` : ''}`, r.dkim)}`;
      } catch (er) { dres.innerHTML = `<div class="hint danger-text">${esc(er.message)}</div>`; }
    };
    main.querySelector('#dgo').addEventListener('click', (e) => busy(e.currentTarget, run)); run();
  }

  async function delivery(main) {
    const d = await Host.api('GET', '/mail'), m = d.settings;
    swap(main, `
      <div class="card"><div class="setting"><div><div class="setting-title">Send email</div><div class="setting-desc">Turn off to pause all outgoing messages.</div></div><label class="switch"><input type="checkbox" id="en" ${m.enabled ? 'checked' : ''}><i></i></label></div>
        <div class="field mt-xs"><label>Delivery method</label><div class="seg" id="mode"><button data-m="direct" class="${m.mode === 'direct' ? 'on' : ''}">Direct to recipient</button><button data-m="smtp" class="${m.mode === 'smtp' ? 'on' : ''}">SMTP relay</button></div><div class="hint" id="modehint"></div></div>
        <div class="grid g2"><div class="field"><label>From name</label><input type="text" id="fn" value="${esc(m.fromName)}"></div><div class="field"><label>From address</label><input type="email" id="fa" value="${esc(m.fromAddress)}" placeholder="no-reply@yourdomain.com"></div></div>
        <div id="direct" class="field"><label>Server name announced when sending (HELO)</label><input type="text" id="helo" value="${esc(m.heloName)}" placeholder="mail.yourdomain.com"></div>
        <div id="smtp"><div class="grid g2"><div class="field"><label>SMTP host</label><input type="text" id="sh" value="${esc(m.smtp.host)}" placeholder="smtp.example.com"></div><div class="field"><label>Port</label><input type="number" id="sp" class="num" min="1" max="65535" value="${m.smtp.secure ? 465 : m.smtp.port === 465 ? 587 : m.smtp.port}" ${m.smtp.secure ? 'disabled' : ''}><div class="hint" id="sphint"></div></div>
          <div class="field"><label>Username</label><input type="text" id="su" value="${esc(m.smtp.user)}" autocomplete="off"></div><div class="field"><label>Password</label><input type="password" id="sw" value="${esc(m.smtp.pass)}" autocomplete="new-password"></div></div>
          <div class="setting"><div><div class="setting-title">Use TLS from the start of the connection (port 465)</div><div class="setting-desc">Leave off for port 587, which upgrades to TLS automatically.</div></div><label class="switch"><input type="checkbox" id="ss" ${m.smtp.secure ? 'checked' : ''}><i></i></label></div></div>
        <div class="row mt-md"><button class="btn" id="save">Save</button></div></div>
      <div class="card"><h3>Send a test</h3><div class="sub">Save first, then try it.</div><div class="row wrap"><input type="email" id="to" placeholder="you@example.com" class="maxw-md" value="${esc(Host.me.email || '')}"><button class="btn secondary" id="test">Send test email</button></div><div id="testres" class="hint"></div></div>
      <div class="card"><div class="row spread wrap"><h3>Recent messages</h3><button class="btn secondary small" id="resendall" hidden>Resend all failed</button></div><div class="tablewrap mt-sm" id="queue"></div></div>`);
    let mode = m.mode;
    const sync = () => {
      main.querySelector('#direct').classList.toggle('hide', mode !== 'direct'); main.querySelector('#smtp').classList.toggle('hide', mode !== 'smtp');
      main.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      main.querySelector('#modehint').textContent = mode === 'direct' ? 'Delivers straight to each recipient’s mail server. Works best from a server with a static IP, reverse DNS, and SPF/DKIM on your domain; many home connections are blocked.' : 'Hands messages to a relay you trust (SES, Mailgun, Postfix…). Recommended for production.';
    };
    main.querySelectorAll('#mode button').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; sync(); })); sync();
    const ss = main.querySelector('#ss'), sp = main.querySelector('#sp'), sphint = main.querySelector('#sphint');
    const syncTls = () => {
      if (ss.checked) { sp.value = 465; sp.disabled = true; sphint.textContent = 'Fixed at 465 while TLS from the start is on.'; }
      else { sp.disabled = false; if (Number(sp.value) === 465 || !sp.value) sp.value = 587; sphint.textContent = 'Usually 587.'; }
    };
    ss.addEventListener('change', syncTls); syncTls();
    const gather = () => ({ enabled: main.querySelector('#en').checked, mode, fromName: main.querySelector('#fn').value, fromAddress: main.querySelector('#fa').value, heloName: main.querySelector('#helo').value,
      smtp: { host: main.querySelector('#sh').value, port: main.querySelector('#sp').value, user: main.querySelector('#su').value, pass: main.querySelector('#sw').value, secure: main.querySelector('#ss').checked } });
    main.querySelector('#save').addEventListener('click', async () => { try { await Host.api('PUT', '/mail', gather()); toast('Email settings saved'); } catch (er) { toast(er.message, true); } });
    main.querySelector('#test').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      const res = main.querySelector('#testres'); res.textContent = 'Sending…'; res.className = 'hint';
      try { const r = await Host.api('POST', '/mail/test', { to: main.querySelector('#to').value }); res.textContent = r.ok ? 'Delivered to the recipient’s server.' : `Not sent: ${r.error || r.status}`; res.className = 'hint ' + (r.ok ? 'success-text' : 'danger-text'); poll(); }
      catch (er) { res.textContent = er.message; res.className = 'hint danger-text'; }
    }));

    // Recent messages refresh by themselves; failed ones can be resent.
    const box = main.querySelector('#queue'), all = main.querySelector('#resendall'); let last = '';
    const paint = (queue) => {
      const sig = JSON.stringify(queue.map(q => [q.id, q.status, q.attempts])); all.hidden = !queue.some(q => q.status === 'failed'); if (sig === last) return; last = sig;
      box.innerHTML = queueHtml(queue);
      box.querySelectorAll('[data-resend]').forEach(b => b.addEventListener('click', () => busy(b, async () => { try { await Host.api('POST', `/mail/${encodeURIComponent(b.dataset.resend)}/resend`); toast('Sent back to the queue'); poll(); } catch (er) { toast(er.message, true); } })));
    };
    const poll = async () => { try { if (!box.isConnected) return; paint((await Host.api('GET', '/mail/queue')).queue); } catch {} };
    paint(d.queue); const timer = setInterval(() => { if (!box.isConnected || document.hidden) { if (!box.isConnected) clearInterval(timer); return; } poll(); }, 3000);
    all.addEventListener('click', (e) => busy(e.currentTarget, async () => { try { const r = await Host.api('POST', '/mail/resend-failed'); toast(`${r.count} message${r.count === 1 ? '' : 's'} sent back to the queue`); poll(); } catch (er) { toast(er.message, true); } }));
  }
})();
