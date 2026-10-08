// HOST / views / alerts — server problems found by the automatic checks. Repeats are grouped into one line with a counter.
(() => {
  const { esc, fmt, toast, busy, swap } = UI;
  const CHIP = { error: 'red', warn: 'amber', info: 'blue' };
  const row = (a, quiet) => `<div class="log-line"><div class="log-meta"><span class="chip ${CHIP[a.level] || ''}">${esc(a.level === 'info' ? 'heads-up' : a.level === 'warn' ? 'warning' : 'problem')}</span><span>${esc(fmt.dateTime(a.last_at))}</span>${a.occurrences > 1 ? `<span class="chip">seen ${a.occurrences} times</span>` : ''}${a.emailed_at ? '<span class="chip green">emailed</span>' : ''}${quiet ? '' : `<button class="linkish" data-dismiss="${esc(a.id)}">set aside</button>`}</div>
    <div class="log-message"><b>${esc(a.title)}</b><div class="hint">${/^backup\./.test(a.kind) ? esc(a.detail || '').replace('Open Backups.', '<a href="#/backups">Open Backups</a>.') : esc(a.detail || '')}</div></div></div>`;
  // History sections (set aside, cleared) are feeds: a capped scrolling box with "Showing N of M" and Load more.
  const section = (title, sub, items, quiet, empty, key) => `<div class="card"><h3>${title}</h3><div class="sub">${sub}</div>${items.length ? `<div ${key ? `class="feed" id="f-${key}"` : ''}>${items.map(a => row(a, quiet)).join('')}</div>${key ? `<div id="m-${key}"></div>` : ''}` : `<div class="empty">${empty}</div>`}</div>`;

  Host.views.alerts = async (main) => {
    const paint = (d) => {
      swap(main, `${Host.head('Alerts', 'Problems the server noticed on its own: email, backups, sign-in floods, storage, database and trials about to end. Each problem is listed once with a counter, and the Owner is emailed once.')}
        <div class="row mb-lg"><button class="btn secondary" id="chk">Check now</button></div>
        ${section('Needs a look', 'These clear by themselves when the problem is gone.', d.open, false, 'All clear. Nothing needs attention.')}
        ${d.quiet.length ? section('Set aside', 'Hidden from the banner. They clear by themselves when the problem is gone.', d.quiet, true, '', 'quiet') : ''}
        ${section('Recently cleared', 'Problems that went away.', d.recent, true, 'Nothing cleared recently.', 'recent')}`);
      for (const [key, status, list] of [['quiet', 'dismissed', d.quiet], ['recent', 'resolved', d.recent]]) {
        const box = main.querySelector('#m-' + key); if (!box) continue;
        let shown = list.length;
        const paint = () => UI.more(box, { shown, total: d.totals[key], noun: 'alerts', load });
        const load = async () => { try { const n = await Host.api('GET', `/alerts/more?status=${status}&offset=${shown}`); main.querySelector('#f-' + key).insertAdjacentHTML('beforeend', n.rows.map(a => row(a, true)).join('')); shown += n.rows.length; if (!n.rows.length) d.totals[key] = shown; paint(); } catch (er) { toast(er.message, true); } };
        paint();
      }
      main.querySelector('#chk').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { paint(await Host.api('POST', '/alerts/check')); Host.alertBanner(); toast('Checked'); } catch (er) { toast(er.message, true); } }));
      main.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', () => busy(b, async () => { try { await Host.api('POST', `/alerts/${encodeURIComponent(b.dataset.dismiss)}/dismiss`); paint(await Host.api('GET', '/alerts')); Host.alertBanner(); } catch (er) { toast(er.message, true); } })));
    };
    paint(await Host.api('GET', '/alerts'));
  };
})();
