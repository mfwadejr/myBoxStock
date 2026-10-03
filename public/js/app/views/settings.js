// APP / views / settings — the Administrator chooses which device details to track and what the test checklist contains. Saved encrypted like everything else.
(() => {
  const { esc, toast, sheet, swap } = UI, A = AccountApp, S = A.store;
  const TYPES = [['text', 'Text'], ['number', 'Number'], ['date', 'Date'], ['bool', 'Yes / No'], ['choice', 'Choice from a list']];
  const typeLabel = (f) => (TYPES.find(t => t[0] === f.type) || ['', f.type])[1];

  A.views.settings = async (main) => {
    if (!A.can('users.manage')) return swap(main, '<div class="page-head"><h1>Settings</h1></div><div class="card"><div class="empty">Only Administrators can change these settings.</div></div>');
    const cfg = S.defaults(), saved = S.config(); cfg.fields = JSON.parse(JSON.stringify(saved.fields)); cfg.steps = JSON.parse(JSON.stringify(saved.steps));
    const chk = (k, on, i) => `<label class="check"><input type="checkbox" data-k="${k}" data-i="${i}" ${on ? 'checked' : ''}></label>`;

    const draw = () => {
      swap(main, `<div class="page-head row spread wrap"><div><h1>Settings</h1><p>What you track for each device, and the checks you do before selling it.</p></div><button class="btn" id="save">Save changes</button></div>
        <div class="card"><div class="row spread wrap"><div><h3>Device details to track</h3><div class="sub mb-0">Turn on what you record for each device. Identifiers you can scan or type at the till are looked up in Quick sale. Anything ticked for the sale record is copied onto the sale.</div></div><button class="btn secondary" id="addf">Add a detail</button></div>
          <div class="check-row check-head mt-md"><span>Name</span><span>Track</span><span>Look up in sale</span><span>Must be unique</span><span>On sale record</span></div>
          ${cfg.fields.map((f, i) => `<div class="check-row"><div class="row"><input type="text" data-k="fl" data-i="${i}" value="${esc(f.label)}" aria-label="Name"><span class="chip gray nowrap">${esc(typeLabel(f))}</span>${f.core ? '' : `<button class="btn danger small" data-k="rmf" data-i="${i}" aria-label="Remove">✕</button>`}</div>${chk('fe', f.enabled, i)}${chk('fk', f.lookup, i)}${chk('fu', f.unique, i)}${chk('fs', f.onSale, i)}</div>`).join('')}
          <p class="hint mt-md">Model, cost, selling price, status and notes are always available. Turning a detail off hides it but keeps what was entered.</p></div>
        <div class="card mt-lg"><div class="row spread wrap"><div><h3>Test checklist</h3><div class="sub mb-0">Steps you perform on each device. When you tick them in Inventory, who and when is recorded and copied into the sale, so you can show what was done if a customer says it did not work.</div></div><button class="btn secondary" id="adds">Add a step</button></div>
          <div class="mt-md">${cfg.steps.length ? cfg.steps.map((st, i) => `<div class="step-row"><input type="text" data-k="sl" data-i="${i}" value="${esc(st.label)}" aria-label="Step"><label class="check"><input type="checkbox" data-k="sr" data-i="${i}" ${st.required ? 'checked' : ''}><span class="text-sm">Required before sale</span></label><button class="btn danger small" data-k="rms" data-i="${i}" aria-label="Remove">✕</button></div>`).join('') : '<div class="empty">No steps. Add the checks you do on each device.</div>'}</div></div>`);
      const q = (s) => main.querySelectorAll(s);
      q('[data-k=fl]').forEach(e => e.addEventListener('input', () => { cfg.fields[e.dataset.i].label = e.value; }));
      for (const [cls, k] of [['[data-k=fe]', 'enabled'], ['[data-k=fk]', 'lookup'], ['[data-k=fu]', 'unique'], ['[data-k=fs]', 'onSale']]) q(cls).forEach(e => e.addEventListener('change', () => { cfg.fields[e.dataset.i][k] = e.checked; }));
      q('[data-k=sl]').forEach(e => e.addEventListener('input', () => { cfg.steps[e.dataset.i].label = e.value; }));
      q('[data-k=sr]').forEach(e => e.addEventListener('change', () => { cfg.steps[e.dataset.i].required = e.checked; }));
      q('[data-k=rmf]').forEach(b => b.addEventListener('click', () => { cfg.fields.splice(Number(b.dataset.i), 1); draw(); }));
      q('[data-k=rms]').forEach(b => b.addEventListener('click', () => { cfg.steps.splice(Number(b.dataset.i), 1); draw(); }));
      main.querySelector('#adds').addEventListener('click', () => { cfg.steps.push({ key: Vault.newId().slice(0, 8), label: '', required: false }); draw(); main.querySelectorAll('[data-k=sl]')[cfg.steps.length - 1].focus(); });
      main.querySelector('#addf').addEventListener('click', async () => {
        const f = await sheet(`<h2>Add a detail</h2><div class="field mt-md"><label>Name</label><input type="text" id="n" placeholder="For example: State, Firmware version, Remote model"></div><div class="field"><label>Type</label>${UI.select.html({ id: 't', options: TYPES })}</div><div class="field" id="ow" hidden><label>Choices (separated by commas)</label><input type="text" id="o" placeholder="Good, Fair, Poor"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Add</button></div>`, { onMount: (el, close) => {
          el.querySelector('#t').addEventListener('change', () => { el.querySelector('#ow').hidden = UI.select.value(el.querySelector('#t')) !== 'choice'; });
          el.querySelector('#go').addEventListener('click', () => {
            const label = el.querySelector('#n').value.trim(), type = UI.select.value(el.querySelector('#t')), options = el.querySelector('#o').value.split(',').map(x => x.trim()).filter(Boolean);
            if (!label) return toast('Give the detail a name.', true); if (type === 'choice' && !options.length) return toast('Enter at least one choice.', true);
            close({ key: 'c' + Vault.newId().slice(0, 7), label, type, options: type === 'choice' ? options : undefined, core: false, enabled: true, lookup: false, unique: false, onSale: false });
          });
        } });
        if (f) { cfg.fields.push(f); draw(); }
      });
      main.querySelector('#save').addEventListener('click', (e) => UI.busy(e.currentTarget, async () => {
        const labels = cfg.fields.map(f => f.label.trim().toLowerCase());
        if (cfg.fields.some(f => !f.label.trim()) || cfg.steps.some(s => !s.label.trim())) return toast('Every detail and step needs a name.', true);
        if (new Set(labels).size !== labels.length) return toast('Two details have the same name.', true);
        if (!cfg.fields.some(f => f.enabled && f.lookup)) return toast('Turn on at least one detail to look up in Quick sale.', true);
        try { await S.saveConfig({ fields: cfg.fields.map(f => ({ ...f, label: f.label.trim() })), steps: cfg.steps.map(s => ({ ...s, label: s.label.trim() })) }); toast('Settings saved'); } catch (er) { toast(er.message, true); }
      }));
    };
    draw();
  };
})();
