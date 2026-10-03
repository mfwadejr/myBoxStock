// HOST / views / logs — human-readable log viewer with raw JSON on demand (area, level and text filters).
(() => {
  const { esc, fmt, swap } = UI;
  const LEVEL_CHIP = { debug: '', info: 'blue', warn: 'amber', error: 'red' };

  Host.views.logs = async (main) => {
    const areas = await Host.api('GET', '/logs/areas');
    swap(main, `${Host.head('Logs', 'Every action is recorded in plain English and as raw JSON. Files are also written to the server’s log folder, one set per area.')}
      <div class="card"><div class="row wrap">
        <select id="area" class="maxw-sm"><option value="">All areas</option>${areas.map(a => `<option value="${a.area}">${esc(a.area)} — ${esc(a.description.split(' (')[0])}</option>`).join('')}</select>
        <select id="level" class="w-xs"><option value="">All levels</option><option value="warn">Warnings</option><option value="error">Errors</option><option value="info">Info</option></select>
        <input type="search" id="q" placeholder="Search messages, events, people" class="grow"></div>
        <div id="list" class="mt-md"></div></div>`);
    const load = async () => {
      const qs = new URLSearchParams({ area: main.querySelector('#area').value, level: main.querySelector('#level').value, q: main.querySelector('#q').value });
      const rows = await Host.api('GET', '/logs?' + qs);
      main.querySelector('#list').innerHTML = rows.length ? rows.map(r => `<div class="log-line">
        <div class="log-meta"><span class="chip ${LEVEL_CHIP[r.level] || ''}">${esc(r.level)}</span><span class="chip">${esc(r.area)}</span><span class="mono">${esc(r.event)}</span><span>${fmt.dateTime(r.ts)}</span>${r.actor ? `<span>${esc(r.actor)}</span>` : ''}${r.ip ? `<span class="mono">${esc(r.ip)}</span>` : ''}<button class="linkish" data-raw="${r.id}">raw</button></div>
        <div class="log-message">${esc(r.message)}</div><pre class="log-raw hide" id="raw-${r.id}">${esc(JSON.stringify(JSON.parse(r.raw || '{}'), null, 2))}</pre></div>`).join('') : '<div class="empty">No matching entries.</div>';
    };
    let t; main.querySelectorAll('#area, #level').forEach(el => el.addEventListener('change', load)); main.querySelector('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 300); });
    main.querySelector('#list').addEventListener('click', (e) => { const b = e.target.closest('[data-raw]'); if (b) main.querySelector('#raw-' + b.dataset.raw).classList.toggle('hide'); });
    await load();
  };
})();
