// HOST / views / overview — system resources and platform counters.
(() => {
  const { esc, fmt, swap } = UI;
  const meter = (p) => `<div class="meter"><i class="${p > 90 ? 'bad' : p > 75 ? 'warn' : ''}" data-pct="${Math.min(100, p)}"></i></div>`;

  function spark(points, key, cls) {
    if (points.length < 2) return '';
    const w = 300, h = 64, xs = (i) => i / (points.length - 1) * w, ys = (v) => h - 4 - (v / 100) * (h - 8);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(' ');
    return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="spark-grad-${key}" x1="0" y1="0" x2="0" y2="1"><stop class="spark-stop" offset="0"/><stop class="spark-stop end" offset="1"/></linearGradient></defs>
      <path class="spark-fill" d="${d} L${w},${h} L0,${h} Z"/><path class="spark-line" d="${d}"/></svg>`;
  }

  Host.views.overview = async (main) => {
    const paint = async (first) => {
      const d = await Host.api('GET', '/dashboard');
      const mp = fmt.pct(d.memory.used, d.memory.total), dp = d.disk ? fmt.pct(d.disk.used, d.disk.total) : 0, cpu = d.history.at(-1)?.cpu ?? 0;
      const html = `${Host.head('Overview', `${esc(d.hostname)} · up ${fmt.dur(d.uptimeSec)} · v${esc(d.version)}`)}
        ${d.restorePending ? '<div class="banner mb-lg">A database restore is staged and will be applied on the next restart.</div>' : ''}
        <div class="grid g4">
          <div class="card stat"><div class="stat-label">Accounts</div><div class="stat-value">${d.accounts}</div><div class="stat-note">${d.accountsByStatus.suspended || 0} suspended</div></div>
          <div class="card stat"><div class="stat-label">Users</div><div class="stat-value">${d.users}</div><div class="stat-note">across all accounts</div></div>
          <div class="card stat"><div class="stat-label">Signed in now</div><div class="stat-value">${d.activeSessions}</div><div class="stat-note">active sessions</div></div>
          <div class="card stat"><div class="stat-label">Database</div><div class="stat-value small">${esc(d.database.label)}</div><div class="stat-note">${d.dbFileSize != null ? fmt.bytes(d.dbFileSize) : 'external server'}</div></div>
        </div>
        <div class="grid g3 mt-lg">
          <div class="card"><div class="row spread"><h3>CPU</h3><span class="chip">${d.cpuCount} cores</span></div><div class="text-stat">${cpu}%</div>${meter(cpu)}${spark(d.history, 'cpu', 'spark-cpu')}<div class="hint">Load ${d.load.map(x => x.toFixed(2)).join(' · ')}</div></div>
          <div class="card"><div class="row spread"><h3>Memory</h3><span class="chip">${fmt.bytes(d.memory.total)}</span></div><div class="text-stat">${mp}%</div>${meter(mp)}${spark(d.history, 'mem', 'spark-mem')}<div class="hint">${fmt.bytes(d.memory.used)} used · app uses ${fmt.bytes(d.processRss)}</div></div>
          <div class="card"><div class="row spread"><h3>Storage</h3><span class="chip">${d.disk ? fmt.bytes(d.disk.total) : '—'}</span></div><div class="text-stat">${dp}%</div>${meter(dp)}<div class="hint mt-md">${d.disk ? `${fmt.bytes(d.disk.free)} free of ${fmt.bytes(d.disk.total)}` : 'Unavailable'}</div></div>
        </div>
        <div class="grid g2 mt-lg">
          <div class="card"><h3>Server</h3><div class="sub">${esc(d.platform)} · Node ${esc(d.node)}</div><div class="faint text-sm">${esc(d.cpuModel)}</div></div>
          <div class="card"><h3>Protection</h3><div class="sub">Firewall activity since start</div><div class="row wrap"><span class="chip green">${d.firewall.blocked} blocked</span><span class="chip amber">${d.firewall.limited} rate-limited</span><span class="chip">${d.firewall.activeBans} banned now</span>
            <span class="chip ${d.mail.failed ? 'red' : 'blue'}">mail: ${d.mail.sent || 0} sent, ${d.mail.queued || 0} queued${d.mail.failed ? `, ${d.mail.failed} failed` : ''}</span></div></div>
        </div>`;
      if (first) swap(main, html); else { main.innerHTML = html; UI.dynamic(main); }
    };
    await paint(true); Host.timer = setInterval(() => paint(false).catch(() => {}), 10000);
  };
})();
