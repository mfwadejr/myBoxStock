// APP / catalog — the Make and Model lists. Built from the devices already entered plus names the Administrator pre-loads in Settings.
// Capitalisation never creates a second entry: "ACME" typed next to an existing "Acme" reuses "Acme".
(() => {
  const A = AccountApp, C = A.commerce, S = A.store;
  const NEW = '__new', key = (s) => String(s || '').trim().toLowerCase();

  // Group names that differ only by capitalisation. Shown spelling: the pre-loaded one, else the most common one on devices.
  function collect(pre, used) {
    const g = new Map();
    const at = (n) => { const k = key(n); if (!k) return null; if (!g.has(k)) g.set(k, { pre: '', spell: new Map(), devices: 0 }); return g.get(k); };
    for (const n of pre) { const e = at(n); if (e && !e.pre) e.pre = String(n).trim(); }
    for (const n of used) { const e = at(n), s = String(n || '').trim(); if (e) { e.devices++; e.spell.set(s, (e.spell.get(s) || 0) + 1); } }
    return [...g.values()].map(e => {
      const seen = [...e.spell].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(x => x[0]);
      const name = e.pre || seen[0], variants = [...new Set([e.pre, ...seen].filter(Boolean))];
      return { name, devices: e.devices, variants };
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
  const items = () => S.all('item').map(e => e.data);
  const preMakes = () => S.config().catalog.makes;
  const preMake = (make) => preMakes().find(m => key(m.name) === key(make));

  const cat = C.catalog = {
    NEW, key,
    makes: () => collect(preMakes().map(m => m.name), items().map(d => d.make)),
    // Models for one make; with no make chosen, every model.
    models: (make) => {
      if (!key(make)) return collect(preMakes().flatMap(m => m.models || []), items().map(d => d.model));
      return collect(preMake(make)?.models || [], items().filter(d => key(d.make) === key(make)).map(d => d.model));
    },
    canon: (list, value) => { const v = String(value || '').trim(); return list.find(x => key(x.name) === key(v))?.name || v; },

    // Form fields for the device sheet.
    makeField: (d = {}) => {
      const list = cat.makes(), cur = cat.canon(list, d.make);
      return `<div class="field"><label>Make</label>${UI.select.html({ id: 'make', options: [['', '—'], ...list.map(m => [m.name, m.name]), [NEW, 'Add new…']], value: list.length ? cur : NEW })}<input type="text" id="make_new" class="mt-sm" placeholder="Type the new make" autocomplete="off" ${list.length ? 'hidden' : ''}></div>`;
    },
    modelField: (d = {}) => `<div class="field"><label>Model</label><div id="modelw">${cat.modelBlock(cat.canon(cat.makes(), d.make), d.model)}</div></div>`,
    modelBlock: (make, current) => {
      const list = key(make) && !cat.makes().some(m => key(m.name) === key(make)) ? [] : cat.models(make), cur = cat.canon(list, current);
      return `${UI.select.html({ id: 'model', options: [['', '—'], ...list.map(m => [m.name, m.name]), [NEW, 'Add new…']], value: list.length ? cur : NEW })}<input type="text" id="model_new" class="mt-sm" placeholder="Type the new model" autocomplete="off" ${list.length ? 'hidden' : ''}>`;
    },
    // Reads the chosen (or typed) make and model back out of a device sheet.
    read: (el) => {
      const pick = (id, list) => { const v = UI.select.value(el.querySelector('#' + id)); return v === NEW ? cat.canon(list, el.querySelector(`#${id}_new`).value) : v; };
      const make = pick('make', cat.makes());
      return { make, model: pick('model', cat.models(make)) };
    },
    wire: (el) => {
      const sel = (id) => el.querySelector('#' + id), show = (id) => { sel(id + '_new').hidden = UI.select.value(sel(id)) !== NEW; };
      const modelChange = () => { show('model'); };
      const bindModel = () => sel('model').addEventListener('change', modelChange);
      sel('make').addEventListener('change', () => {
        show('make');
        const v = UI.select.value(sel('make')), keep = UI.select.value(sel('model'));
        el.querySelector('#modelw').innerHTML = cat.modelBlock(v === NEW ? '__none__' : v, keep === NEW ? '' : keep); bindModel();
      });
      bindModel();
    },

    // For CSV import: spells makes and models the same way as the list, learning new ones as it goes.
    normalizer: () => {
      const mk = new Map(cat.makes().map(m => [key(m.name), m.name])), md = new Map();
      const modelsOf = (k) => { if (!md.has(k)) md.set(k, new Map(cat.models(mk.get(k) || '__none__').map(m => [key(m.name), m.name]))); return md.get(k); };
      return (make, model) => {
        const mv = String(make || '').trim(), k = key(mv); let outMake = '';
        if (k) { if (!mk.has(k)) mk.set(k, mv); outMake = mk.get(k); }
        const ov = String(model || '').trim(), ok = key(ov); let outModel = '';
        if (ok) { const m = modelsOf(k); if (!m.has(ok)) m.set(ok, ov); outModel = m.get(ok); }
        return { make: outMake, model: outModel };
      };
    },

    // ---- Administrator changes (Settings). Each one saves the list and updates affected devices together. ----
    save: async (catalog, puts = []) => {
      const all = [{ type: 'config', id: S.CONFIG_ID, data: { ...S.config(), catalog } }, ...puts];
      for (let i = 0; i < all.length; i += 200) await S.commit({ puts: all.slice(i, i + 200) });
    },
    copy: () => JSON.parse(JSON.stringify(S.config().catalog)),
    // Rename a make. If the new name is already in the list, the two are merged.
    renameMake: async (from, to) => {
      const c = cat.copy(), target = cat.canon(cat.makes(), to), src = c.makes.find(m => key(m.name) === key(from)), dst = c.makes.find(m => key(m.name) === key(target) && m !== src);
      if (src && dst) { dst.models = [...new Set([...(dst.models || []), ...(src.models || [])])]; c.makes.splice(c.makes.indexOf(src), 1); }
      else if (src) src.name = target; else c.makes.push({ name: target, models: [] });
      const puts = S.all('item').filter(e => key(e.data.make) === key(from) && e.data.make !== target).map(e => ({ type: 'item', id: e.id, data: { ...e.data, make: target } }));
      await cat.save(c, puts); return puts.length;
    },
    // Rename a model within one make. If the new name already exists under that make, the two are merged (and a stock reorder level is kept).
    renameModel: async (make, from, to) => {
      const c = cat.copy(), target = cat.canon(cat.models(make), to), m = c.makes.find(x => key(x.name) === key(make));
      if (m) { const rest = (m.models || []).filter(x => key(x) !== key(from)); m.models = rest.some(x => key(x) === key(target)) ? rest : [...rest, target]; }
      const hit = S.all('item').filter(e => key(e.data.make) === key(make) && key(e.data.model) === key(from) && e.data.model !== target);
      const puts = hit.map(e => ({ type: 'item', id: e.id, data: { ...e.data, model: target } })), deletes = [];
      const stillUsed = S.all('item').some(e => key(e.data.model) === key(from) && !hit.includes(e));
      const old = S.all('model').find(r => key(r.data.name) === key(from)), dst = S.all('model').find(r => key(r.data.name) === key(target));
      if (old && !stillUsed && key(from) !== key(target)) { if (dst) deletes.push({ type: 'model', id: old.id }); else puts.push({ type: 'model', id: old.id, data: { ...old.data, name: target } }); }
      const all = [{ type: 'config', id: S.CONFIG_ID, data: { ...S.config(), catalog: c } }, ...puts];
      for (let i = 0; i < all.length; i += 200) await S.commit({ puts: all.slice(i, i + 200), deletes: i === 0 ? deletes : [] });
      return hit.length;
    },
    addMake: async (name, models = []) => {
      const c = cat.copy(), have = c.makes.find(m => key(m.name) === key(name)), nm = cat.canon(cat.makes(), name);
      if (have) have.models = [...new Set([...(have.models || []), ...models])]; else c.makes.push({ name: nm, models: [...new Set(models)] });
      await cat.save(c);
    },
    addModel: async (make, name) => {
      const c = cat.copy(), m = c.makes.find(x => key(x.name) === key(make)) || (c.makes.push({ name: cat.canon(cat.makes(), make), models: [] }), c.makes.at(-1));
      const nm = cat.canon(cat.models(make), name); if (!(m.models || []).some(x => key(x) === key(nm))) m.models = [...(m.models || []), nm];
      await cat.save(c);
    },
    // Only names no device uses can be removed.
    removeMake: async (name) => { const c = cat.copy(); c.makes = c.makes.filter(m => key(m.name) !== key(name)); await cat.save(c); },
    removeModel: async (make, name) => { const c = cat.copy(), m = c.makes.find(x => key(x.name) === key(make)); if (m) m.models = (m.models || []).filter(x => key(x) !== key(name)); await cat.save(c); },
  };
})();
