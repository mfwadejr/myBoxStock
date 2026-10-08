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

  // The Backups card: one look at whether the backups would save the site. Counts, times and destination names only.
  const backupsCard = (d) => {
    const h = d.backupHealth;
    if (!h) return `<div class="card mt-lg" id="bk-health"><div class="card-head"><div><h3>Backups</h3><div class="sub mb-0">${esc(d.backupHealthError || 'Backup health could not be read.')} <a href="#/backups">Open Backups</a></div></div><span class="chip red">Unknown</span></div></div>`;
    const stat = (label, value, note, cls = '') => `<div class="card stat"><div class="stat-label">${esc(label)}</div><div class="stat-value small ${cls}">${value}</div><div class="stat-note">${note}</div></div>`;
    const n = h.problems.length, ago = (t) => esc(fmt.ago(t)), t = h.test, dests = h.destinations;
    const chip = n ? `<span class="chip red">${n} need${n === 1 ? 's' : ''} attention</span>` : h.protected ? '<span class="chip green">Protected</span>' : '<span class="chip amber">Not protected yet</span>';
    const testNote = t.lastFail ? `<span class="danger-text">A test failed ${ago(t.lastFail.at)}</span>` : t.lastPass ? esc(t.lastPass.kind) : `Run one every ${t.windowDays} days`;
    const failing = dests.filter(x => x.failing).length;
    return `<div class="card mt-lg" id="bk-health"><div class="card-head"><div><h3>Backups</h3><div class="sub mb-0">${h.protected ? 'A tested copy is held off this server.' : 'No tested copy is held off this server yet.'} <a href="#/backups">Open Backups</a></div></div><div class="row wrap">${chip}</div></div></div>
        <div class="grid g4 mt-lg" id="bk-health-a">
          ${stat('Last snapshot', h.snapshot ? ago(h.snapshot.at) : 'None yet', h.snapshot ? esc(fmt.dateTime(h.snapshot.at)) : 'No snapshot has been taken')}
          ${stat('Last full-site backup', h.full.last ? ago(h.full.last.at) : 'None yet', h.full.last ? `${fmt.bytes(h.full.last.size)} · verified` : h.full.enabled ? 'Scheduled, none completed' : 'Scheduled backups are off', h.full.late ? 'danger-text' : '')}
          ${stat('Last test restore', t.lastPass ? ago(t.lastPass.at) : 'Never', testNote, t.late ? 'danger-text' : '')}
          ${stat('Copy off this server', h.offServer.exists ? 'Yes' : 'No', h.offServer.exists ? esc(h.offServer.where.join(', ')) : h.offServer.configured ? 'Set up, none sent yet' : 'Nothing leaves this server')}
        </div>
        <div class="grid g4 mt-lg" id="bk-health-b">
          ${stat('Destinations', dests.length ? `${dests.length - failing} of ${dests.length} working` : 'None', dests.length ? (failing ? `<span class="danger-text">${failing} failing</span>` : 'No failures') : 'Add one on the Backups page', failing ? 'danger-text' : '')}
          ${stat('Backup space left', h.space.free != null ? fmt.bytes(h.space.free) : 'Unknown', h.space.freePct != null ? `${h.space.freePct}% of the disk is free · ${fmt.bytes(h.space.used)} used by backups` : '', h.space.low ? 'danger-text' : '')}
          ${stat('Protected', h.protected ? 'Yes' : 'Not yet', h.protected ? 'Off-site and verified' : 'Needs a tested off-server copy')}
          ${stat('Background job', h.job ? 'Failed' : 'None failed', h.job ? `${esc(h.job.label)} · ${ago(h.job.at)}` : 'Nothing needs a look', h.job ? 'danger-text' : '')}
        </div>
        ${dests.length ? `<div class="card mt-lg" id="bk-health-dests"><h3>Destinations</h3>${dests.map(x => `<div class="sum-line"><span>${esc(x.name)}</span><span>${x.failing ? '<span class="chip red">Failing</span> ' : ''}${x.lastSend ? `last sent ${ago(x.lastSend)}` : 'nothing sent yet'}${x.lastFailAt ? ` · last failure ${ago(x.lastFailAt)}` : ''}</span></div>`).join('')}</div>` : ''}`;
  };

  Host.views.overview = async (main) => {
    const paint = async (first) => {
      const d = await Host.api('GET', '/dashboard');
      const mp = fmt.pct(d.memory.used, d.memory.total), dp = d.disk ? fmt.pct(d.disk.used, d.disk.total) : 0, cpu = d.history.at(-1)?.cpu ?? 0;
      const html = `${Host.head('Overview', `${esc(d.hostname)} · up ${fmt.dur(d.uptimeSec)} · v${esc(d.version)}`)}
        ${d.siteUrlProblem ? `<div class="banner mb-lg">Email links will not work: ${esc(d.siteUrlProblem)} <a href="#/settings">Set the site address</a></div>` : ''}
        ${d.restorePending ? '<div class="banner mb-lg">A database restore is staged and will be applied on the next restart.</div>' : ''}
        <div class="grid g4">
          <div class="card stat"><div class="stat-label">Accounts</div><div class="stat-value">${d.accounts}</div><div class="stat-note">${d.accountsByStatus.suspended || 0} suspended</div></div>
          <div class="card stat"><div class="stat-label">Users</div><div class="stat-value">${d.users}</div><div class="stat-note">across all accounts</div></div>
          <div class="card stat"><div class="stat-label">Signed in now</div><div class="stat-value">${d.activeSessions}</div><div class="stat-note">people active in the last 15 minutes</div></div>
          <div class="card stat"><div class="stat-label">Database</div><div class="stat-value small">${esc(d.database.label)}</div><div class="stat-note">${d.dbFileSize != null ? fmt.bytes(d.dbFileSize) : 'external server'}</div></div>
        </div>
        ${backupsCard(d)}
        <div class="card mt-lg"><div class="card-head"><div><h3>Plans</h3><div class="sub mb-0">Trials, free (comped) and paid accounts</div></div><div class="row wrap"><span class="chip blue">${d.plans.trial} on trial</span><span class="chip ${d.plans.endingSoon ? 'amber' : ''}">${d.plans.endingSoon} ending within 7 days</span><span class="chip green">${d.plans.free} free</span><span class="chip green">${d.plans.paid} paid</span><span class="chip ${d.plans.expired ? 'red' : ''}">${d.plans.expired} ended</span></div></div></div>
        <div class="card mt-lg"><div class="card-head"><div><h3>Support</h3><div class="sub mb-0">Tickets from resellers. Resolved tickets close by themselves; closed ones stay until the Owner purges them.</div></div><div class="row wrap"><span class="chip ${d.support.open ? 'blue' : ''}">${d.support.open} open</span><span class="chip ${d.support.awaitingHost ? 'amber' : ''}">${d.support.awaitingHost} waiting on Host</span><span class="chip ${d.support.overdue ? 'red' : ''}">${d.support.overdue} overdue (target ${d.support.responseDays} business day${d.support.responseDays === 1 ? '' : 's'})</span><span class="chip ${d.support.unassigned ? 'amber' : ''}">${d.support.unassigned} unassigned</span><a class="btn secondary small" href="#/support">Open Support</a></div></div></div>
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
