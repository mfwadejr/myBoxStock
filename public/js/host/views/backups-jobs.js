// HOST / views / backups-jobs — long jobs (Test restore, restore, full-site backup, Test a backup file) run on the server in the background, one at a time.
// B.jobs starts a job, polls it, and tells the sheet that started it (and the status strip at the top of the Backups page) how far it has got.
// Closing a sheet does not stop the job: the strip keeps showing it, and its result can be opened from there, also after a reload.
// Styling is the standard classes only (.card, .banner, .meter, .chip).
(() => {
  const { esc, fmt, toast, sheet } = UI;
  const B = Host.backups = Host.backups || {};
  const J = B.jobs = { cur: null, subs: new Set(), timer: null, restarting: false, busyBy: '' };
  const POLL_MS = 1000, RELOAD_MS = 4500;

  const bytesText = (j) => (j.bytesTotal ? ` · ${fmt.bytes(j.bytesDone)} of ${fmt.bytes(j.bytesTotal)}` : '');
  const stepText = (j) => `${j.step}${j.status === 'running' ? ` · ${j.pct}%${bytesText(j)}` : ''}`;

  // The progress block used inside a sheet: the step in words and the bar.
  B.progressHtml = (id = 'jp') => `<div id="${id}" role="status" aria-live="polite"><p class="hint" data-step>Starting…</p><div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-pct="0"></i></div></div>`;
  B.progressPaint = (root, j, note = true) => {
    if (!root) return; const t = root.querySelector('[data-step]'), m = root.querySelector('.meter'), bar = root.querySelector('.meter > i');
    if (t) t.textContent = note ? `${stepText(j)}. You can close this window; the job keeps going and is shown at the top of the page.` : stepText(j);
    if (bar) { bar.dataset.pct = String(j.pct); UI.dynamic(root); m.setAttribute('aria-valuenow', String(j.pct)); }
  };

  const stop = () => { clearInterval(J.timer); J.timer = null; };
  J.set = (job) => {
    const was = J.cur; J.cur = job;
    for (const fn of [...J.subs]) fn(job);
    if (job?.status === 'running') { if (!J.timer) J.timer = setInterval(J.poll, POLL_MS); } else stop();
    if (job?.restarting && !J.restarting) { J.restarting = true; toast('Restoring… the console will reload'); setTimeout(() => location.reload(), RELOAD_MS); }
    if (job && was && was.id === job.id && was.status === 'running' && job.status !== 'running') {
      if (!J.subs.size) toast(job.status === 'failed' ? job.error.message : job.summary, job.status === 'failed' || job.ok === false);
      if (job.kind === 'compact') B.afterCompact?.(); else if (job.kind === 'full-backup' || job.kind === 'bundle') B.reload?.(); else B.reloadStrip?.(); // a new backup file: redraw the lists too
    }
    B.paintJobStrip?.();
  };
  J.poll = async () => {
    if (!document.querySelector('#job-strip') && !J.subs.size) return stop();
    try {
      const r = await Host.api('GET', '/backups/jobs/current'); J.busyBy = r.busy || '';
      if (!r.job && J.cur?.status === 'running') J.set({ ...J.cur, status: 'failed', ok: false, error: { message: 'The server restarted while this job was running, so it did not finish. Nothing was changed by it. Start it again.' }, summary: 'The server restarted while this job was running.', step: 'Failed' });
      else J.set(r.job);
    } catch { /* the connection dropped (a restore restarts the server): keep trying */ }
  };
  J.start = async (kind, params = {}) => { const r = await Host.api('POST', '/backups/jobs', { kind, ...params }); J.set(r.job); return r.job; };
  J.load = (id) => Host.api('GET', `/backups/jobs/${id}`).then(r => r.job);
  // Starts a job and reports every step to onUpdate. h.done resolves with the finished job (with its result); h.release() lets go when the sheet closes.
  J.run = (kind, params, onUpdate) => {
    const h = { id: null, sub: null };
    h.done = (async () => {
      const job = await J.start(kind, params); h.id = job.id;
      const fin = await new Promise((resolve) => {
        h.sub = (j) => { if (!j || j.id !== h.id) return; onUpdate?.(j); if (j.status !== 'running') { J.subs.delete(h.sub); resolve(j); } };
        J.subs.add(h.sub); h.sub(job);
      });
      return fin.status === 'done' && fin.hasResult && !fin.restarting ? J.load(fin.id) : fin;
    })();
    h.release = () => { if (h.sub) J.subs.delete(h.sub); if (h.id && J.cur?.id === h.id && J.cur.status === 'running') Host.api('POST', `/backups/jobs/${h.id}/detach`).catch(() => {}); };
    return h;
  };
  J.dismiss = async (id) => { try { await Host.api('POST', `/backups/jobs/${id}/dismiss`); } catch {} if (J.cur?.id === id) J.cur = null; B.paintJobStrip?.(); };

  // ---- the status strip at the top of the Backups page ----
  let shown = '';
  B.paintJobStrip = () => {
    const el = document.querySelector('#job-strip'); if (!el) return;
    const j = J.cur, key = j ? `${j.id}:${j.status}` : J.busyBy ? 'busy:' + J.busyBy : '';
    if (j && key === shown) { const c = el.querySelector('#job-card'); if (c) B.progressPaint(c, j, false); return; }
    shown = key;
    if (!j) { el.innerHTML = J.busyBy ? `<div class="banner blue mb-lg" id="job-busy" role="status">Another backup is running (${esc(J.busyBy)}). A new job cannot start until it finishes.</div>` : ''; return; }
    if (j.status === 'running') {
      el.innerHTML = `<div class="card mb-lg" id="job-card"><div class="row spread wrap"><div><div class="setting-title">${esc(j.label)}</div><div class="hint">Started ${esc(fmt.ago(j.startedAt))}</div></div><span class="chip blue">Running</span></div>
        ${B.progressHtml('job-progress')}<p class="hint">Only one backup job runs at a time. You can leave this page; the job keeps going.</p></div>`;
      B.progressPaint(el.querySelector('#job-progress'), j, false);
    } else {
      const bad = j.status === 'failed' || j.ok === false;
      el.innerHTML = `<div class="banner ${bad ? 'red' : 'blue'} mb-lg" id="job-done" role="${bad ? 'alert' : 'status'}"><b>${esc(j.label)}: ${j.status === 'failed' ? 'failed' : j.ok === false ? 'did not pass' : j.restarting ? 'restoring' : 'finished'}.</b> ${esc(j.status === 'failed' ? j.error.message : j.summary)}
        <div class="row wrap mt-sm">${j.hasResult && !j.restarting ? '<button class="btn secondary small" id="job-view">View result</button>' : ''}<button class="btn secondary small" id="job-dismiss">Dismiss</button></div></div>`;
      el.querySelector('#job-view')?.addEventListener('click', () => B.jobResultSheet(j.id));
      el.querySelector('#job-dismiss').addEventListener('click', () => J.dismiss(j.id));
    }
  };
  // Called by the page after it draws: shows the job the server reported, and starts polling if it is running.
  B.syncJob = (job, busyBy = '') => { J.busyBy = busyBy; shown = ''; if (job) { if (!J.cur || J.cur.id !== job.id || J.cur.status !== job.status) J.set(job); else J.cur = job; } else if (J.cur && J.cur.status !== 'running') J.cur = null; B.paintJobStrip(); if (J.cur?.status === 'running' && !J.timer) J.timer = setInterval(J.poll, POLL_MS); };

  // ---- reading a finished job's result from the strip ----
  B.jobResultSheet = async (id) => {
    let j; try { j = await J.load(id); } catch (e) { return toast(e.message, true); }
    const r = j.result || {};
    const body = r.checks ? `<div class="banner ${r.ok ? 'blue' : 'red'}">${esc(r.summary)}</div>${B.checkRows(r.checks)}${r.report ? '<div id="jr-report"></div>' : r.note ? `<p class="hint mt-md">${esc(r.note)}</p>` : ''}`
      : `<div class="banner ${j.ok ? 'blue' : 'red'}">${esc(j.summary)}</div>`;
    await sheet(`<h2>${esc(j.label)}</h2><p class="muted">${esc(fmt.date(j.finishedAt))}</p>${body}${r.checks && r.ok && (j.kind === 'offsite-test' || j.kind === 'file-test') ? '<p class="hint">To restore from it, run the test again from its own button; a restore needs a test made in the window you restore from.</p>' : ''}<div class="actions"><button class="btn" data-cancel>Close</button></div>`, {
      wide: !!r.report, onMount: (el) => { if (r.report) { const box = el.querySelector('#jr-report'); box.innerHTML = B.fileReportHtml(r); B.fileReportWire(box, r); } },
    });
  };
})();
