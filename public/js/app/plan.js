// APP / plan — the plan's limits and how much of each is used, shown on Home. Counts only (the server cannot read your records).
// A limit set to "Block adding new" stops adding at the cap; "Warn only" shows this notice and lets you carry on.
(() => {
  const { esc } = UI, A = AccountApp, P = A.plan = { usage: [], at: 0 };
  const PERIOD = { all: '', d365: ' in the last 12 months', d30: ' in the last 30 days' };

  P.load = async () => { if (Date.now() - P.at < 30000) return; try { P.usage = (await A.api('GET', '/account/plan')).usage; P.at = Date.now(); } catch { P.usage = []; } };
  P.reset = () => { P.at = 0; };

  P.homeHtml = () => {
    const list = P.usage; if (!list.length) return '';
    const worst = list.find(u => u.state === 'full') || list.find(u => u.state === 'warn');
    const note = worst ? `<div class="banner ${worst.state === 'full' ? 'red' : ''} mb-lg" role="status">${worst.state === 'full'
      ? `You have reached the limit for ${esc(worst.name.toLowerCase())} (${worst.used} of ${worst.limit}${PERIOD[worst.period]}). ${worst.action === 'block' ? 'You cannot add more until you are on a larger plan.' : 'You can keep going, but you are over what your plan includes.'}`
      : `You have used ${worst.pct}% of the ${esc(worst.name.toLowerCase())} your plan includes (${worst.used} of ${worst.limit}${PERIOD[worst.period]}).`} Ask your provider about a larger plan.</div>` : '';
    return `<div class="card"><h3>Your plan</h3><div class="sub">What your plan includes and how much you have used.</div>${note}${list.map(u => `<div class="plan-use"><div class="row spread"><span>${esc(u.name)}<span class="hint">${esc(PERIOD[u.period])}</span></span><b>${u.used} of ${u.limit}</b></div><div class="meter"><i class="${u.state === 'full' ? 'bad' : u.state === 'warn' ? 'warn' : ''}" data-pct="${Math.min(100, u.pct)}"></i></div></div>`).join('')}</div>`;
  };
})();
