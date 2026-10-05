// HOST / views / alerts — server problems found by the automatic checks. Repeats are grouped into one line with a counter.
(() => {
  const { esc, fmt, toast, busy, swap } = UI;
  const CHIP = { error: 'red', warn: 'amber', info: 'blue' };
  const row = (a, quiet) => `<div class="log-line"><div class="log-meta"><span class="chip ${CHIP[a.level] || ''}">${esc(a.level === 'info' ? 'heads-up' : a.level === 'warn' ? 'warning' : 'problem')}</span><span>${esc(fmt.dateTime(a.last_at))}</span>${a.occurrences > 1 ? `<span class="chip">seen ${a.occurrences} times</span>` : ''}${a.emailed_at ? '<span class="chip green">emailed</span>' : ''}${quiet ? '' : `<button class="linkish" data-dismiss="${esc(a.id)}">set aside</button>`}</div>
    <div class="log-message"><b>${esc(a.title)}</b><div class="hint">${esc(a.detail || '')}</div></div></div>`;
  const section = (title, sub, items, quiet, empty) => `<div class="card"><h3>${title}</h3><div class="sub">${sub}</div>${items.length ? items.map(a => row(a, quiet)).join('') : `<div class="empty">${empty}</div>`}</div>`;

  Host.views.alerts = async (main) => {
    const paint = (d) => {
      swap(main, `${Host.head('Alerts', 'Problems the server noticed on its own: email, backups, sign-in floods, storage, database and trials about to end. Each problem is listed once with a counter, and the Owner is emailed once.')}
        <div class="row mb-lg"><button class="btn secondary" id="chk">Check now</button></div>
        ${section('Needs a look', 'These clear by themselves when the problem is gone.', d.open, false, 'All clear. Nothing needs attention.')}
        ${d.quiet.length ? section('Set aside', 'Hidden from the banner. They clear by themselves when the problem is gone.', d.quiet, true, '') : ''}
        ${section('Recently cleared', 'Problems that went away.', d.recent, true, 'Nothing cleared recently.')}`);
      main.querySelector('#chk').addEventListener('click', (e) => busy(e.currentTarget, async () => { try { paint(await Host.api('POST', '/alerts/check')); Host.alertBanner(); toast('Checked'); } catch (er) { toast(er.message, true); } }));
      main.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', () => busy(b, async () => { try { await Host.api('POST', `/alerts/${encodeURIComponent(b.dataset.dismiss)}/dismiss`); paint(await Host.api('GET', '/alerts')); Host.alertBanner(); } catch (er) { toast(er.message, true); } })));
    };
    paint(await Host.api('GET', '/alerts'));
  };
})();
