// HOST / views / accounts-bulk — the bulk actions on the Accounts page: Extend trial, Change plan, Send announcement, Export list.
// One window walks through the steps: choose -> preview (what would change, in words) -> type the confirmation -> run (a progress strip when large) -> result.
// Nothing here suspends, closes or deletes an account. Standard classes only.
(() => {
  const { esc, toast, sheet, busy } = UI;
  const B = Host.bulk = {};
  const API = '/accounts/bulk';
  const TITLES = { extend_trial: 'Extend trial', change_plan: 'Change plan', announce: 'Send announcement', export: 'Export list' };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const formHtml = (action) => {
    if (action === 'extend_trial') return '<div class="field"><label for="bd">Days to add to each running trial</label><input type="number" id="bd" class="num" min="1" max="365" value="14"></div><p class="hint">Only accounts on a running trial are extended. The days are added to the trial’s current end date.</p>';
    if (action === 'change_plan') return `<div class="field"><label for="bp">Change the selected accounts to</label>${UI.select.html({ id: 'bp', value: 'keep', options: [['keep', 'Keep the plan, change only the note'], ['free', 'Free (comped)'], ['trial', 'Trial'], ['paid', 'Paid']] })}</div>
      <div class="field" id="bdw" hidden><label for="bd">Trial length in days, from today</label><input type="number" id="bd" class="num" min="1" max="365" value="14"></div>
      <div class="field" id="buw" hidden><label for="bu">Paid through (optional)</label><input type="date" id="bu"></div>
      <div class="field"><label for="bn">Plan note</label><input type="text" id="bn" maxlength="255" autocomplete="off" placeholder="Shown on each account’s plan"></div>`;
    if (action === 'announce') return `<div class="field"><label for="bt">Message</label><textarea id="bt" maxlength="400" rows="4" placeholder="Keep it short and plain."></textarea></div>
      <div class="field"><label for="bl">Style</label>${UI.select.html({ id: 'bl', value: 'info', options: [['info', 'Information (blue)'], ['warning', 'Heads-up (amber)'], ['important', 'Important (red)']] })}</div>
      <div class="setting"><div><div class="setting-title">Also email the account owners</div><div class="setting-desc">Sent through your Email setup. Demo accounts never get email.</div></div><label class="switch"><input type="checkbox" id="be" aria-label="Also email the account owners"><i></i></label></div>
      <p class="hint">Each account sees the message as a banner in the app for 14 days, until its people close it.</p>`;
    return '';
  };

  const gather = (el, action) => {
    const v = (id) => el.querySelector(id)?.value;
    if (action === 'extend_trial') return { days: Number(v('#bd')) };
    if (action === 'change_plan') { const plan = UI.select.value(el.querySelector('#bp')); return { plan, days: Number(v('#bd')), until: v('#bu') || '', note: (v('#bn') || '').trim() }; }
    return { text: (v('#bt') || '').trim(), level: UI.select.value(el.querySelector('#bl')), email: !!el.querySelector('#be')?.checked };
  };

  // Downloads the CSV the server built (Host-visible fields only).
  async function exportList(selection) {
    const r = await Host.api('POST', `${API}/export`, { selection });
    UI.downloadBlob(r.filename, new Blob([r.csv], { type: 'text/csv' })); toast(`Exported ${plural(r.count, 'account')}`);
  }

  B.open = async (action, selection, count) => {
    if (action === 'export') { try { await exportList(selection); } catch (er) { toast(er.message, true); } return; }
    await sheet(`<h2>${esc(TITLES[action])}</h2><p class="sub" data-sub>${plural(count, 'account')} selected. You will see what would change before anything happens.</p><div data-step></div>`, {
      onMount: (el, close) => {
        const step = el.querySelector('[data-step]');
        const chooseStep = () => {
          step.innerHTML = `${formHtml(action)}<div class="actions"><button class="btn secondary" data-cancel2>Cancel</button><button class="btn" id="bpv">Preview</button></div>`;
          step.querySelector('[data-cancel2]').addEventListener('click', () => close(null));
          const sync = () => { if (action !== 'change_plan') return; const p = UI.select.value(step.querySelector('#bp')); step.querySelector('#bdw').hidden = p !== 'trial'; step.querySelector('#buw').hidden = p !== 'paid'; };
          step.querySelector('#bp')?.addEventListener('change', sync); sync();
          step.querySelector('#bpv').addEventListener('click', (e) => busy(e.currentTarget, async () => {
            const params = gather(step, action);
            try { confirmStep(params, await Host.api('POST', `${API}/preview`, { action, params, selection })); } catch (er) { toast(er.message, true); }
          }));
        };
        const confirmStep = (params, pv) => {
          const skipped = pv.skipped.length ? pv.skipped.map(s => `<p class="hint">${plural(s.count, 'account')} skipped: ${esc(s.reason)}.</p>`).join('') : '';
          const sample = pv.sample.length ? `<p class="hint">For example: ${pv.sample.map(s => esc(s.name)).join(', ')}${pv.count > pv.sample.length ? ' and more' : ''}.</p>` : '';
          const blockedMail = pv.emailOff ? '<div class="banner red my-md">Email is not set up, so the emails cannot be sent. Turn the email option off, or set up Email first.</div>' : '';
          step.innerHTML = `<div class="banner blue my-md" role="status">${esc(pv.text)}</div>${skipped}${sample}${blockedMail}
            ${pv.count ? `${pv.asJob ? '<p class="hint">This is a large selection, so it runs in the background and shows its progress.</p>' : ''}
            <div class="field mt-md"><label for="br">Reason (a few words, saved in the audit trail)</label><input type="text" id="br" maxlength="200" autocomplete="off"></div>
            <div class="field"><label for="bc">Type <b>${esc(pv.confirm)}</b> to confirm</label><input type="text" id="bc" autocomplete="off"></div>` : '<p class="hint">Nothing would change for this selection.</p>'}
            <div class="actions"><button class="btn secondary" data-back>Back</button><button class="btn" id="bgo" disabled>${esc(TITLES[action])}</button></div>`;
          step.querySelector('[data-back]').addEventListener('click', chooseStep);
          const go = step.querySelector('#bgo'), bc = step.querySelector('#bc'), br = step.querySelector('#br');
          if (!bc) return;
          const ok = () => { go.disabled = pv.emailOff || bc.value.trim().toUpperCase() !== pv.confirm || br.value.trim().length < 3; };
          bc.addEventListener('input', ok); br.addEventListener('input', ok);
          go.addEventListener('click', (e) => busy(e.currentTarget, async () => {
            try { const r = await Host.api('POST', `${API}/run`, { action, params, selection, expect: pv.count, confirm: bc.value.trim(), reason: br.value.trim() }); r.job ? progressStep(r.job) : resultStep(r.result); } catch (er) { toast(er.message, true); }
          }));
        };
        const resultStep = (r) => {
          step.innerHTML = `<div class="banner ${r.ok ? 'blue' : 'red'} my-md" role="status">${esc(r.summary)}</div>${r.failed ? '<p class="hint">Some accounts could not be changed. Each one is listed in the audit trail under Bulk account actions.</p>' : '<p class="hint">Each account has its own entry in the audit trail, and there is one summary entry.</p>'}<div class="actions"><button class="btn" id="bx">Close</button></div>`;
          step.querySelector('#bx').addEventListener('click', () => close(true));
        };
        const progressStep = (job) => {
          step.innerHTML = `<p class="hint">Working through ${plural(job.total, 'account')}. You can keep this window open; it finishes by itself.</p>${Host.backups.progressHtml('bjp')}`;
          const root = step.querySelector('#bjp');
          const tick = async () => {
            if (!root.isConnected) return;
            try {
              const { job: j } = await Host.api('GET', `${API}/job`); if (!j || j.id !== job.id) return setTimeout(tick, 1000);
              Host.backups.progressPaint(root, { step: `${j.done} of ${j.total} accounts`, pct: j.pct, status: j.status }, false);
              if (j.status === 'running') return setTimeout(tick, 1000);
              await Host.api('POST', `${API}/job/${j.id}/dismiss`).catch(() => {});
              resultStep({ ok: j.ok, failed: j.status === 'failed' ? 1 : 0, summary: j.summary });
            } catch { setTimeout(tick, 2000); }
          };
          tick();
        };
        chooseStep();
      } });
  };
})();
