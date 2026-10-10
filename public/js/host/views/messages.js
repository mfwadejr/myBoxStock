// HOST / views / messages — the Messages tab on the Email page: edit the wording of every message with a live preview.
// The Host administrator changes words only; colours, fonts and layout come from the site theme and cannot be changed here.
(() => {
  const { esc, toast, busy, swap } = UI;
  const GROUPS = ['Account', 'Trial', 'System'];
  const FIELDS = [['subject', 'sub'], ['title', 'ttl'], ['body', 'body'], ['buttonLabel', 'btn']];

  Host.emailMessages = async (pane) => {
    const { templates } = await Host.api('GET', '/mail/templates');
    const st = { key: templates[0].key, view: 'styled', device: 'desktop', seq: 0, focus: 'body', last: null }, timer = {};
    const cur = () => templates.find(t => t.key === st.key);
    const options = () => GROUPS.flatMap(g => templates.filter(t => t.group === g).map(t => [t.key, `${g} · ${t.name}${t.custom ? ' (edited)' : ''}`]));
    const q = (s) => pane.querySelector(s);
    const read = () => Object.fromEntries(FIELDS.map(([k, id]) => [k, q('#' + id)?.value ?? '']));
    const dirty = () => { const t = cur(), w = read(); return FIELDS.some(([k]) => (k === 'buttonLabel' && !t.hasButton) ? false : w[k] !== t.current[k]); };

    const paint = () => {
      const r = st.last, box = q('#pbody'); if (!r || !box.isConnected) return;
      q('#psub').textContent = `Subject: ${r.subject}`;
      q('#dv').classList.toggle('hide', st.view !== 'styled');
      q('#vw').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === st.view));
      q('#dv').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.d === st.device));
      const prob = q('#prob'); prob.innerHTML = r.problems.map(p => `<div>${esc(p)}</div>`).join(''); q('#save').disabled = r.problems.length > 0;
      if (st.view === 'text') { box.innerHTML = '<pre class="mail-text" id="ptext"></pre>'; q('#ptext').textContent = r.text; return; }
      let fr = q('#fr'); if (!fr) { box.innerHTML = '<iframe class="mail-frame" id="fr" title="Email preview" sandbox=""></iframe>'; fr = q('#fr'); }
      fr.classList.toggle('phone', st.device === 'phone'); const src = `/api/host/mail/templates/preview/${encodeURIComponent(r.token)}`; if (fr.dataset.src !== src) { fr.dataset.src = src; fr.src = src; }
    };
    const refresh = async () => {
      const mine = ++st.seq;
      try { const r = await Host.api('POST', `/mail/templates/${st.key}/preview`, read()); if (mine !== st.seq) return; st.last = r; paint(); } catch (er) { toast(er.message, true); }
    };
    const soon = () => { clearTimeout(timer.t); timer.t = setTimeout(refresh, 200); };

    const draw = () => {
      const t = cur(), c = t.current, need = t.placeholders.filter(p => p.required);
      swap(pane, `<div class="grid g2">
        <div class="card"><h3>Message</h3><div class="hint mb-md">These messages are global wording, in English only. Every account receives the same text.</div>
          <div class="field">${UI.select.html({ id: 'mk', options: options(), value: st.key })}</div>
          <div class="field"><label for="sub">Subject</label><input type="text" id="sub" value="${esc(c.subject)}" autocomplete="off"></div>
          <div class="field"><label for="ttl">Heading</label><input type="text" id="ttl" value="${esc(c.title)}" autocomplete="off"></div>
          <div class="field"><label for="body">Body</label><textarea id="body" rows="10">${esc(c.body)}</textarea><div class="hint">A blank line starts a new paragraph. Plain words only: the look comes from the site theme.</div></div>
          ${t.hasButton ? `<div class="field"><label for="btn">Button label</label><input type="text" id="btn" value="${esc(c.buttonLabel)}" autocomplete="off"></div>` : ''}
          ${t.placeholders.length ? `<div class="field"><label>Insert a detail</label><div class="row wrap">${t.placeholders.map(p => `<button type="button" class="btn secondary small" data-ph="${esc(p.key)}" title="${esc(p.label)}">{{${esc(p.key)}}}</button>`).join('')}</div><div class="hint">Click to add at the cursor.${need.length ? ` Must stay in the message: ${need.map(p => `{{${esc(p.key)}}}`).join(', ')}.` : ''}</div></div>` : ''}
          <div class="hint danger-text" id="prob"></div>
          <div class="row mt-md"><button class="btn" id="save">Save</button><button class="btn secondary" id="reset" ${t.custom ? '' : 'disabled'}>Reset to default</button></div>
          <div class="field mt-lg mb-0"><label for="to">Send a test of this message</label><div class="row wrap"><input type="email" id="to" class="maxw-md" value="${esc(Host.me.email || '')}" placeholder="you@example.com"><button class="btn secondary" id="test">Send test</button></div><div class="hint" id="testres">Sent with sample details, using the wording above (saved or not).</div></div></div>
        <div class="card"><div class="row spread wrap"><h3>Live preview</h3><div class="row"><div class="seg" id="vw"><button type="button" data-v="styled" class="on">Styled</button><button type="button" data-v="text">Plain text</button></div><div class="seg" id="dv"><button type="button" data-d="desktop" class="on">Desktop</button><button type="button" data-d="phone">Phone</button></div></div></div>
          <div class="sub mt-sm" id="psub"></div><div id="pbody"></div><div class="hint">Shown with sample details. Updates as you type.</div></div></div>`);

      for (const [, id] of FIELDS) q('#' + id)?.addEventListener('input', soon);
      for (const id of ['sub', 'ttl', 'body']) q('#' + id).addEventListener('focus', () => { st.focus = id; });
      q('#mk').addEventListener('change', async (e) => {
        const next = UI.select.value(e.target);
        if (dirty() && !await UI.confirmBox({ title: 'Discard your changes?', body: 'The wording you changed has not been saved.', confirmLabel: 'Discard', danger: true })) return draw();
        st.key = next; st.focus = 'body'; draw();
      });
      pane.querySelectorAll('[data-ph]').forEach(b => b.addEventListener('click', () => {
        const el = q('#' + st.focus), tag = `{{${b.dataset.ph}}}`, a = el.selectionStart ?? el.value.length, z = el.selectionEnd ?? a;
        el.value = el.value.slice(0, a) + tag + el.value.slice(z); el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); soon();
      }));
      q('#vw').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { st.view = b.dataset.v; paint(); }));
      q('#dv').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { st.device = b.dataset.d; paint(); }));
      q('#save').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        try { const r = await Host.api('PUT', `/mail/templates/${st.key}`, read()); templates[templates.findIndex(x => x.key === st.key)] = r.template; toast('Message saved'); draw(); } catch (er) { toast(er.message, true); }
      }));
      q('#reset').addEventListener('click', async () => {
        if (!await UI.confirmBox({ title: 'Reset to the default wording?', body: 'Your changes to this message are removed and the original wording is used again.', confirmLabel: 'Reset', danger: true })) return;
        try { const r = await Host.api('DELETE', `/mail/templates/${st.key}`); templates[templates.findIndex(x => x.key === st.key)] = r.template; toast('Message reset'); draw(); } catch (er) { toast(er.message, true); }
      });
      q('#test').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        const res = q('#testres'); res.textContent = 'Sending…'; res.className = 'hint';
        try { const r = await Host.api('POST', `/mail/templates/${st.key}/test`, { ...read(), to: q('#to').value }); res.textContent = r.ok ? 'Delivered to the recipient’s server.' : `Not sent: ${r.error || r.status}`; res.className = 'hint ' + (r.ok ? 'success-text' : 'danger-text'); }
        catch (er) { res.textContent = er.message; res.className = 'hint danger-text'; }
      }));
      st.last = null; refresh();
    };
    draw();
  };
})();
