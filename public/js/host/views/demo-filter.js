// HOST / views / demo-filter — the DEMO chip and the "Show demo accounts" choice used wherever demo accounts are counted (Overview, Accounts).
// The choice is remembered in this browser only; if the browser will not store it, demo accounts simply stay shown.
(() => {
  const KEY = 'mbs.host.demo.hide';
  const D = Host.demoFilter = {};
  D.hidden = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
  D.set = (hide) => { try { hide ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch { /* not remembered */ } };
  D.chip = () => '<span class="chip amber">DEMO</span>';
  // "?demo=hide" or "&demo=hide" for the Host API when demo accounts are hidden, else nothing.
  D.query = (lead = '?') => D.hidden() ? `${lead}demo=hide` : '';
  // The checkbox row. Wire it with D.wire(root, onChange).
  D.checkHtml = (id = 'demo-show') => `<label class="check tap" for="${id}"><input type="checkbox" id="${id}" ${D.hidden() ? '' : 'checked'}><span>Show demo accounts</span></label>`;
  D.wire = (root, onChange, id = 'demo-show') => root.querySelector('#' + id)?.addEventListener('change', (e) => { D.set(!e.target.checked); onChange(); });
})();
