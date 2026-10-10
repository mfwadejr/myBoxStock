// APP / views / settings — the Administrator chooses which device details to track and what the test checklist contains. Saved encrypted like everything else.
(() => {
  const { esc, toast, sheet, swap } = UI, A = AccountApp, S = A.store, C = A.commerce;
  const TYPES = [['text', 'Text'], ['number', 'Number'], ['date', 'Date'], ['bool', 'Yes / No'], ['choice', 'Choice from a list']];
  const typeLabel = (f) => (TYPES.find(t => t[0] === f.type) || ['', f.type])[1];

  // Reads a picture and returns it as a small data URL (at most 256 px, under about 140 KB) so it can be saved with the account and attached to emails.
  A.shrinkLogo = (file) => new Promise((ok, no) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return no(new Error('Choose a PNG, JPEG, WebP or GIF picture.'));
    const rd = new FileReader(); rd.onerror = () => no(new Error('That file could not be read.'));
    rd.onload = () => { const img = new Image(); img.onerror = () => no(new Error('That picture could not be opened.'));
      img.onload = () => { const k = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/png'); if (out.length > 60000) out = c.toDataURL('image/jpeg', 0.8); out.length > 100000 ? no(new Error('That picture is too detailed. Try a simpler one.')) : ok(out); };
      img.src = rd.result; };
    rd.readAsDataURL(file); });

  A.views.settings = async (main) => {
    if (!A.can('users.manage')) return swap(main, '<div class="page-head"><h1>Settings</h1></div><div class="card"><div class="empty">Only Administrators can change these settings.</div></div>');
    const cfg = S.defaults(), saved = S.config(); cfg.fields = JSON.parse(JSON.stringify(saved.fields)); cfg.steps = JSON.parse(JSON.stringify(saved.steps)); cfg.tests = { ...saved.tests }; cfg.warranty = JSON.parse(JSON.stringify(saved.warranty)); cfg.payments = JSON.parse(JSON.stringify(saved.payments)); cfg.unlock = { ...saved.unlock }; cfg.discount = { ...saved.discount }; cfg.mail = JSON.parse(JSON.stringify(saved.mail)); cfg.returns = JSON.parse(JSON.stringify(saved.returns));
    A.deliverySettings.init(cfg, saved);
    let tpl = null; try { tpl = (await A.api('GET', '/receipt-email/templates')).templates; } catch { tpl = null; }
    const cm = { key: 'receipt', seq: 0 };
    const usedPay = new Set(S.all('sale').map(e => e.data.payment).filter(Boolean));
    const usedKeys = new Set(S.all('sale').map(e => e.data.warranty?.key).filter(Boolean));
    const CHK_LABEL = { fe: 'Track', fk: 'Look up in sale', fu: 'Must be unique', fs: 'On sale record' }; // shown beside the box on phones, where the column headings are hidden
    const chk = (k, on, i) => { const idOnly = (k === 'fk' || k === 'fu') && cfg.fields[i].type && cfg.fields[i].type !== 'text'; return `<label class="check"><input type="checkbox" data-k="${k}" data-i="${i}" ${on && !idOnly ? 'checked' : ''} ${idOnly ? 'disabled' : ''}><span class="check-text">${esc(CHK_LABEL[k] || '')}</span></label>`; };

    const K = C.catalog, key = K.key;
    const variantNote = (x) => x.variants.length > 1 ? `<div class="hint">Also entered as ${x.variants.filter(v => v !== x.name).map(esc).join(', ')}. Use Rename or merge to combine them.</div>` : '';
    const devs = (n) => `<span class="chip gray nowrap">${n} device${n === 1 ? '' : 's'}</span>`;
    const catHtml = () => { const makes = K.makes(); return makes.length ? makes.map(m => `<div class="cat-row cat-make"><div><div class="cat-name">${esc(m.name)}</div>${variantNote(m)}</div>${devs(m.devices)}<button type="button" class="btn secondary small" data-k="mkr" data-n="${esc(m.name)}">Rename or merge</button><button type="button" class="btn secondary small" data-k="mda" data-n="${esc(m.name)}">Add model</button>${m.devices ? '<span class="icon-slot"></span>' : `<button type="button" class="icon-btn" data-k="mkx" data-n="${esc(m.name)}" aria-label="Remove ${esc(m.name)}" title="Remove">✕</button>`}</div>`
      + K.models(m.name).map(x => `<div class="cat-row cat-model"><div><div class="cat-name">${esc(x.name)}</div>${variantNote(x)}</div>${devs(x.devices)}<button type="button" class="btn secondary small" data-k="mdr" data-m="${esc(m.name)}" data-n="${esc(x.name)}">Rename or merge</button><span class="icon-slot"></span>${x.devices ? '<span class="icon-slot"></span>' : `<button type="button" class="icon-btn" data-k="mdx" data-m="${esc(m.name)}" data-n="${esc(x.name)}" aria-label="Remove ${esc(x.name)}" title="Remove">✕</button>`}</div>`).join('')).join('') : '<div class="empty">No makes yet. They appear as you add devices, or add some here first.</div>'; };
    const nameSheet = (title, body, value, label) => sheet(`<h2>${esc(title)}</h2><p class="sub">${body}</p><div class="field mt-md"><label for="n">${esc(label)}</label><input type="text" id="n" value="${esc(value)}" autocomplete="off"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div>`, { onMount: (el, close) => { const go = () => { const v = el.querySelector('#n').value.trim(); if (!v) return toast('Enter a name.', true); close(v); }; el.querySelector('#go').addEventListener('click', go); el.querySelector('#n').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); el.querySelector('#n').focus(); } });
    const catDo = async (fn, msg) => { try { const n = await fn(); toast(typeof msg === 'function' ? msg(n) : msg); main.querySelector('#catlist').innerHTML = catHtml(); wireCat(); } catch (er) { toast(er.message, true); } };
    const wireCat = () => {
      const q = (s) => main.querySelectorAll(s);
      q('[data-k=mkr]').forEach(b => b.addEventListener('click', async () => {
        const from = b.dataset.n, to = await nameSheet('Rename or merge make', `Type a new name for “${esc(from)}”. If you type a name that is already in the list, the two are merged and every device moves to it.`, from, 'Make'); if (!to || to === from) return;
        const other = K.makes().find(m => key(m.name) === key(to) && key(m.name) !== key(from));
        if (other && !await UI.confirmBox({ title: `Merge into “${other.name}”?`, body: `Every device and model under “${from}” moves to “${other.name}”.`, confirmLabel: 'Merge' })) return;
        catDo(() => K.renameMake(from, to), (n) => `Updated ${n} device${n === 1 ? '' : 's'}`);
      }));
      q('[data-k=mdr]').forEach(b => b.addEventListener('click', async () => {
        const make = b.dataset.m, from = b.dataset.n, to = await nameSheet('Rename or merge model', `Type a new name for “${esc(from)}” under ${esc(make)}. If you type a model that is already listed there, the two are merged.`, from, 'Model'); if (!to || to === from) return;
        catDo(() => K.renameModel(make, from, to), (n) => `Updated ${n} device${n === 1 ? '' : 's'}`);
      }));
      q('[data-k=mda]').forEach(b => b.addEventListener('click', async () => { const make = b.dataset.n, name = await nameSheet('Add a model', `A new model under ${esc(make)}.`, '', 'Model'); if (name) catDo(() => K.addModel(make, name), 'Model added'); }));
      q('[data-k=mkx]').forEach(b => b.addEventListener('click', async () => { if (await UI.confirmBox({ title: `Remove “${b.dataset.n}”?`, body: 'No device uses it, so nothing else changes.', confirmLabel: 'Remove', danger: true })) catDo(() => K.removeMake(b.dataset.n), 'Removed'); }));
      q('[data-k=mdx]').forEach(b => b.addEventListener('click', async () => { if (await UI.confirmBox({ title: `Remove “${b.dataset.n}”?`, body: 'No device uses it, so nothing else changes.', confirmLabel: 'Remove', danger: true })) catDo(() => K.removeModel(b.dataset.m, b.dataset.n), 'Removed'); }));
    };

    // ---- Reorder: each list has a Reorder switch. Off = rows are locked (no handle column). On = each row has a six-dot grip; only the grip moves a row (pointer drag, or Space + arrow keys). ----
    const LISTS = { fields: () => cfg.fields, steps: () => cfg.steps, pay: () => cfg.payments.methods, war: () => cfg.warranty.periods };
    const NOUN = { fields: 'device details', steps: 'test steps', pay: 'payment methods', war: 'warranty periods' };
    const reorderOn = { fields: false, steps: false, pay: false, war: false };
    const rc = (l) => reorderOn[l] ? ' reordering' : '';
    const GRIP_DOTS = [6, 12, 18].map(y => `<circle cx="9" cy="${y}" r="1.6"/><circle cx="15" cy="${y}" r="1.6"/>`).join('');
    const grip = (l, name) => reorderOn[l] ? `<button type="button" class="grip" data-grip="${l}" aria-pressed="false" aria-roledescription="drag handle" aria-label="Reorder ${esc((name || '').trim() || 'this row')}"><svg class="icon grip-icon" viewBox="0 0 24 24" aria-hidden="true">${GRIP_DOTS}</svg></button>` : '';
    const rswitch = (l) => `<span class="row"><span class="text-sm muted">Reorder</span><label class="switch"><input type="checkbox" data-reorder="${l}" aria-label="Reorder ${NOUN[l]}" ${reorderOn[l] ? 'checked' : ''}><i></i></label></span>`;
    const rhint = (l) => reorderOn[l] ? '<p class="hint reorder-hint">Drag the dots to move a row. With a keyboard: focus the dots, press Space to pick the row up, use the arrow keys to move it, then press Space to drop it. Turn Reorder off to lock the order.</p>' : '';
    const nameOf = (row) => row.querySelector('input[type=text]')?.value.trim() || 'This row';
    const say = (t) => { const live = main.querySelector('#rlive'); if (live) live.textContent = t; };
    let busyKb = null;   // the row picked up with the keyboard, if any

    const wireReorder = () => {
      // Writes the rows' current on-screen order back into the list, redraws, and optionally puts focus back on the moved row's grip.
      const commit = (l, box, row, refocus, verb) => {
        const arr = LISTS[l](), order = [...box.children].map(r => Number(r.dataset.ri)), at = order.indexOf(Number(row.dataset.ri)), name = nameOf(row), changed = order.some((v, n) => v !== n);
        if (changed) { const next = order.map(n => arr[n]); arr.splice(0, arr.length, ...next); }
        draw();
        if (refocus) main.querySelector(`[data-list="${l}"] [data-ri="${at}"] .grip`)?.focus();
        say(changed || verb === 'Dropped' ? `${verb} ${name} at position ${at + 1} of ${order.length}.` : '');
      };
      main.querySelectorAll('[data-reorder]').forEach(sw => sw.addEventListener('change', () => {
        reorderOn[sw.dataset.reorder] = sw.checked; draw();
        main.querySelector(`[data-reorder="${sw.dataset.reorder}"]`)?.focus();
        say(sw.checked ? `Reorder is on for ${NOUN[sw.dataset.reorder]}. Each row has a handle.` : `Reorder is off. The order of ${NOUN[sw.dataset.reorder]} is locked in.`);
      }));
      main.querySelectorAll('.grip').forEach(g => {
        const row = g.closest('[data-ri]'), box = row.parentElement, l = g.dataset.grip;
        // pointer (mouse, pen or finger): drag the grip; rows move as the pointer crosses their middles; the page scrolls near the top and bottom edges
        g.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 || busyKb) return;
          e.preventDefault(); const id = e.pointerId; let y = e.clientY, raf = 0;
          const zone = g.offsetHeight * 2, step = g.offsetHeight / 3;
          row.classList.add('drag-row'); document.documentElement.classList.add('reorder-drag');
          const place = () => {
            let before = null;
            for (const sib of box.children) { if (sib === row) continue; const b = sib.getBoundingClientRect(); if (y < b.top + b.height / 2) { before = sib; break; } }
            if (before !== row.nextElementSibling) box.insertBefore(row, before);
          };
          const tick = () => {
            raf = 0; const dir = y < zone ? -(zone - Math.max(y, 0)) / zone : y > innerHeight - zone ? (y - (innerHeight - zone)) / zone : 0;
            if (!dir) return; scrollBy(0, Math.ceil(Math.max(-1, Math.min(1, dir)) * step)); place(); raf = requestAnimationFrame(tick);
          };
          const move = (ev) => { if (ev.pointerId !== id) return; y = ev.clientY; place(); if (!raf) raf = requestAnimationFrame(tick); };
          const end = (ev) => {
            if (ev.pointerId !== id) return;
            removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
            if (raf) cancelAnimationFrame(raf); document.documentElement.classList.remove('reorder-drag'); row.classList.remove('drag-row');
            commit(l, box, row, false, 'Moved');
          };
          addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
        });
        // keyboard and screen reader: Space picks the row up, the arrow keys move it, Space drops it, Escape puts it back
        const stop = (refocus, verb) => { const k = busyKb; busyKb = null; k.row.classList.remove('drag-row'); commit(l, box, row, refocus, verb); };
        g.addEventListener('keydown', (e) => {
          const n = box.children.length, pos = () => [...box.children].indexOf(row) + 1;
          if (e.key === ' ') {
            e.preventDefault();
            if (busyKb) return stop(true, 'Dropped');
            busyKb = { row, start: [...box.children] }; row.classList.add('drag-row'); g.setAttribute('aria-pressed', 'true');
            say(`Picked up ${nameOf(row)}, position ${pos()} of ${n}. Use the up and down arrow keys to move it, Space to drop it, Escape to cancel.`);
          } else if (busyKb && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const up = e.key === 'ArrowUp' || e.key === 'ArrowLeft', sib = e.key === 'Home' ? box.firstElementChild : e.key === 'End' ? null : up ? row.previousElementSibling : row.nextElementSibling;
            if (e.key === 'Home' || e.key === 'End') { if (e.key === 'Home' ? row === box.firstElementChild : row === box.lastElementChild) return say(`Already ${e.key === 'Home' ? 'first' : 'last'}.`); box.insertBefore(row, sib); }
            else if (!sib) return say(up ? 'Already first.' : 'Already last.');
            else if (up) box.insertBefore(row, sib); else box.insertBefore(sib, row);
            g.focus(); row.scrollIntoView({ block: 'nearest' });
            say(`${nameOf(row)}, position ${pos()} of ${n}.`);
          } else if (busyKb && e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation(); busyKb.start.forEach(r => box.append(r)); stop(true, 'Put back');
            say(`Move cancelled. ${nameOf(row)} is back at its place.`);
          }
        });
        g.addEventListener('blur', () => setTimeout(() => { if (busyKb && busyKb.row === row && document.activeElement !== g && document.body.contains(g)) stop(false, 'Dropped'); }));
      });
    };

    const draw = () => {
      swap(main, `<div class="sr-only" id="rlive" role="status" aria-live="assertive" aria-atomic="true"></div><div class="page-head row spread wrap"><div><h1>Settings</h1><p>What you track for each device, and the checks you do before selling it.</p></div><button class="btn" id="save">Save changes</button></div>
        <div class="card${rc('fields')}"><div class="card-head"><div><h3>Device details to track</h3><div class="sub mb-0">Turn on what you record for each device. Identifiers you can scan or type at the till are looked up in Quick sale. Anything ticked for the sale record is copied onto the sale.</div></div>${rswitch('fields')}</div>${rhint('fields')}
          <div class="check-row check-head mt-md"><span>Name</span><span>Track</span><span>Look up in sale</span><span>Must be unique</span><span>On sale record</span><span></span>${reorderOn.fields ? '<span></span>' : ''}</div>
          <div data-list="fields">${cfg.fields.map((f, i) => `<div class="check-row" data-ri="${i}"><div class="row"><input type="text" data-k="fl" data-i="${i}" value="${esc(f.label)}" aria-label="Name">${f.type === 'choice' ? `<button type="button" class="btn secondary small type-btn" data-k="ech" data-i="${i}" title="Change the choices">Choices (${(f.options || []).length})</button>` : `<span class="chip gray nowrap">${esc(typeLabel(f))}</span>`}</div>${chk('fe', f.enabled, i)}${chk('fk', f.lookup, i)}${chk('fu', f.unique, i)}${chk('fs', f.onSale, i)}<button type="button" class="icon-btn" data-k="rmf" data-i="${i}" aria-label="Remove ${esc(f.label)}" title="Remove">✕</button>${grip('fields', f.label)}</div>`).join('')}</div>
          <div class="row mt-md"><button class="btn secondary" id="addf" type="button">Add a detail</button></div>
          <p class="hint mt-md">Make, model, cost, selling price, status and notes are always available. Turning a detail off, or removing it, hides it but keeps what was entered.</p></div>
        <div class="card mt-lg${rc('war')}"><div class="card-head"><div><h3>Warranty periods</h3><div class="sub mb-0">The choices offered at Quick sale. The chosen period is saved on each sale, so changing this list never alters past sales. A period that has been used on a sale can be archived but not removed.</div></div>${rswitch('war')}</div>${rhint('war')}
          <div class="mt-md" data-list="war">${cfg.warranty.periods.map((p, i) => `<div class="war-row" data-ri="${i}"><input type="text" data-k="wl" data-i="${i}" value="${esc(p.label)}" aria-label="Name"><span class="chip gray nowrap">${esc(p.amount ? C.periodLabel(p) : 'No cover')}</span>${cfg.warranty.default === p.key ? '<span class="chip green nowrap">Default</span>' : `<button type="button" class="btn secondary small" data-k="wd" data-i="${i}" ${p.archived ? 'disabled' : ''}>Make default</button>`}<button type="button" class="btn secondary small" data-k="wa" data-i="${i}" ${cfg.warranty.default === p.key ? 'disabled' : ''}>${p.archived ? 'Restore' : 'Archive'}</button>${usedKeys.has(p.key) || p.key === 'none' ? '<span class="icon-slot"></span>' : `<button type="button" class="icon-btn" data-k="wr" data-i="${i}" aria-label="Remove ${esc(p.label)}" title="Remove">✕</button>`}${grip('war', p.label)}</div>`).join('')}</div>
          <div class="row mt-md"><button class="btn secondary" id="addw" type="button">Add a period</button></div></div>
        <div class="card mt-lg${rc('pay')}"><div class="card-head"><div><h3>Payment methods</h3><div class="sub mb-0">The "Paid by" choices at Quick sale. Each sale keeps the name it was sold under, so renaming never alters past receipts. A method that has been used on a sale can be archived but not removed.</div></div>${rswitch('pay')}</div>${rhint('pay')}
          <div class="mt-md" data-list="pay">${cfg.payments.methods.map((p, i) => `<div class="pay-row" data-ri="${i}"><input type="text" data-k="pl" data-i="${i}" value="${esc(p.label)}" aria-label="Name" maxlength="40">${cfg.payments.default === p.key ? '<span class="chip green nowrap">Default</span>' : `<button type="button" class="btn secondary small" data-k="pd" data-i="${i}" ${p.archived ? 'disabled' : ''}>Make default</button>`}<button type="button" class="btn secondary small" data-k="pa" data-i="${i}" ${cfg.payments.default === p.key ? 'disabled' : ''}>${p.archived ? 'Restore' : 'Archive'}</button>${usedPay.has(p.key) || cfg.payments.methods.length < 2 ? '<span class="icon-slot"></span>' : `<button type="button" class="icon-btn" data-k="pr" data-i="${i}" aria-label="Remove ${esc(p.label)}" title="Remove">✕</button>`}${grip('pay', p.label)}</div>`).join('')}</div>
          <div class="row mt-md"><button class="btn secondary" id="addp" type="button">Add a method</button></div></div>
        <div class="card mt-lg"><div class="row spread wrap"><div><h3>Makes and models</h3><div class="sub mb-0">The lists offered when you add a device. They are built from your devices; add names here ahead of time, rename them, or merge two spellings of the same name. Changes here are saved straight away and update the devices that use them. Past sales keep the name they were sold under.</div></div><button class="btn secondary" id="addmk">Add a make</button></div>
          <div class="mt-md" id="catlist">${catHtml()}</div></div>
        <div class="card mt-lg"><h3>Unlock behaviour</h3><div class="sub">Your data is encrypted in the browser. This decides what happens when someone on your team refreshes the page. It applies to everyone on the account.</div>
          <div class="field mt-md"><label for="um">After a browser refresh</label>${UI.select.html({ id: 'um', options: [['ask', 'Ask for the password again (most private)'], ['stay', 'Stay unlocked while this tab is open']], value: cfg.unlock.mode })}</div>
          <div class="field" id="uiw" ${cfg.unlock.mode === 'stay' ? '' : 'hidden'}><label for="ui">Lock automatically after (minutes without activity)</label><input type="number" id="ui" class="num" min="1" max="1440" step="1" value="${esc(cfg.unlock.idleMin)}"></div>
          <p class="hint">Staying unlocked keeps the account key in this tab’s temporary browser storage. It is cleared when the tab closes, when someone signs out, and after the idle time. The trade-off: malicious script running on the page while the tab is open could use that key, so keep it on the default if the device is shared or untrusted.</p></div>
        ${A.deliverySettings.html(cfg)}
        <div class="card mt-lg"><h3>Email sending</h3><div class="sub">Receipts (and later newsletters) can go out from your own mail server, so they come from your address and do not use the site’s shared sender. Leave it off to use the site’s sender, with replies going to your email address.</div>
          <div class="setting mt-md"><div><div class="setting-title">Send from my own mail server</div><div class="setting-desc">Your mail provider’s details (Gmail, Outlook, your web host, an email service…).</div></div><label class="switch"><input type="checkbox" id="mon" ${cfg.mail.enabled ? 'checked' : ''}><i></i></label></div>
          <div id="mbox" ${cfg.mail.enabled ? '' : 'hidden'}>
            <div class="grid g2"><div class="field"><label for="mfn">From name</label><input type="text" id="mfn" value="${esc(cfg.mail.fromName)}" placeholder="${esc(A.me.businessName)}"></div>
              <div class="field"><label for="mfa">From address</label><input type="email" id="mfa" value="${esc(cfg.mail.fromAddress)}" placeholder="sales@yourbusiness.com" autocapitalize="none"></div>
              <div class="field"><label for="mh">SMTP host</label><input type="text" id="mh" value="${esc(cfg.mail.host)}" placeholder="smtp.example.com" autocapitalize="none" spellcheck="false"></div>
              <div class="field"><label for="mp">Port</label><input type="number" id="mp" class="num" min="1" max="65535" value="${cfg.mail.secure ? 465 : cfg.mail.port === 465 ? 587 : esc(cfg.mail.port)}" ${cfg.mail.secure ? 'disabled' : ''}><div class="hint" id="mphint"></div></div>
              <div class="field"><label for="mu">Username</label><input type="text" id="mu" value="${esc(cfg.mail.user)}" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
              <div class="field"><label for="mw">Password</label><input type="password" id="mw" value="${esc(cfg.mail.pass)}" autocomplete="new-password"></div></div>
            <div class="setting"><div><div class="setting-title">Use TLS from the start of the connection (port 465)</div><div class="setting-desc">Leave off for port 587, which upgrades to TLS automatically.</div></div><label class="switch"><input type="checkbox" id="mtls" ${cfg.mail.secure ? 'checked' : ''}><i></i></label></div>
            <div class="row mt-md"><button class="btn secondary" id="mtest" type="button">Send a test email to me</button></div>
            <p class="hint">These details are saved encrypted with the rest of your account data. When you send, they pass through the site once to reach your mail server and are not stored, logged or queued there. Anyone on your team who can send receipts can use them, so give your Administrator role only to people you trust with this. Press Save changes at the top of the page to keep them.</p>
          </div></div>
        ${tpl ? `<div class="card mt-lg"><h3>Customer emails</h3><div class="sub">The emails your customers receive, such as receipts. They show your business name and your logo, not ours. Change the words and see the result as you type. Everything here is saved encrypted with the rest of your account data.</div>
          <div class="row mt-md"><div id="clpic">${cfg.mail.logo ? `<img class="brand-logo" src="${esc(cfg.mail.logo)}" alt="Your logo">` : '<span class="brand-logo empty">No logo</span>'}</div><button class="btn secondary" id="clpick" type="button">Choose logo</button><button class="btn secondary" id="clrm" type="button" ${cfg.mail.logo ? '' : 'disabled'}>Remove logo</button><input type="file" id="clfile" accept="image/png,image/jpeg,image/webp,image/gif" hidden></div>
          <div class="hint">A square picture works best. It is made small automatically (up to 256 pixels).</div>
          <div class="grid g2 mt-md"><div>
            <div class="field">${UI.select.html({ id: 'cmk', options: tpl.map(t => [t.key, t.name]), value: cm.key })}</div>
            <div class="field"><label for="cs">Subject</label><input type="text" id="cs" autocomplete="off"></div>
            <div class="field"><label for="ct">Heading</label><input type="text" id="ct" autocomplete="off"></div>
            <div class="field"><label for="cb">Body</label><textarea id="cb" rows="9"></textarea><div class="hint">A blank line starts a new paragraph. Keep {{message}} where the receipt details should appear.</div></div>
            <div class="field"><label>Insert a detail</label><div class="row wrap" id="cph"></div></div>
            <div class="hint danger-text" id="cprob"></div>
            <div class="row mt-md"><button class="btn secondary" id="creset" type="button">Back to default wording</button></div></div>
            <div><div class="sub mb-sm" id="csub"></div><iframe class="mail-frame" id="cfr" title="Email preview" sandbox=""></iframe><div class="hint">Shown with sample details. Updates as you type.</div></div></div></div>` : ''}
        <div class="card mt-lg"><h3>Discounts</h3><div class="sub">Quick sale lets you take a % off a single device or the whole order. Administrators can give any discount. Set the most a Standard user may give in total on one sale.</div>
          <div class="field mt-md"><label for="dc">Most a Standard user can discount (%)</label><input type="number" id="dc" class="num" min="0" max="100" step="1" value="${esc(cfg.discount.maxStandardPct)}"></div>
          <p class="hint">This limit is checked in the app when the sale is completed. Because your data is encrypted, the server cannot enforce it, so treat it as a guard rail for honest mistakes rather than a security control.</p></div>
        ${A.returns.settingsHtml(cfg.returns)}
        <div class="card mt-lg${rc('steps')}"><div class="card-head"><div><h3>Test checklist</h3><div class="sub mb-0">Steps you perform on each device. When you tick them in Inventory, who and when is recorded and copied into the sale, so you can show what was done if a customer says it did not work.</div></div>${rswitch('steps')}</div>${rhint('steps')}
          <label class="check mt-md"><input type="checkbox" id="ten" ${cfg.tests.enabled ? 'checked' : ''}><span>Use a test checklist</span></label>
          <div class="hint">Turn this off if you do not test devices. The test record is then hidden in Inventory, Quick sale, receipts and CSV files. Nothing already recorded is deleted.</div>
          <label class="check mt-md"><input type="checkbox" id="treq" ${cfg.tests.requireBeforeSale ? 'checked' : ''} ${cfg.tests.enabled ? '' : 'disabled'}><span>Sell only tested devices</span></label>
          <div class="hint">When on, a device stays "Awaiting test" until its required steps are ticked (every step if none are marked required). It is not counted as available and cannot be added to a sale. Turn it off if you sell devices as they arrive.</div>
          <div class="mt-md" data-list="steps" ${cfg.tests.enabled ? '' : 'hidden'}>${cfg.steps.length ? cfg.steps.map((st, i) => `<div class="step-row" data-ri="${i}"><input type="text" data-k="sl" data-i="${i}" value="${esc(st.label)}" aria-label="Step"><button type="button" class="btn secondary small type-btn" data-k="sdt" data-i="${i}" title="Extra items under this step">Details (${(st.details || []).length})</button><label class="check"><input type="checkbox" data-k="sr" data-i="${i}" ${st.required ? 'checked' : ''}><span class="text-sm">Required before sale</span></label><button type="button" class="icon-btn" data-k="rms" data-i="${i}" aria-label="Remove step" title="Remove">✕</button>${grip('steps', st.label)}</div>`).join('') : '<div class="empty">No steps. Add the checks you do on each device.</div>'}</div>
          <div class="row mt-md" ${cfg.tests.enabled ? '' : 'hidden'}><button class="btn secondary" id="adds" type="button">Add a step</button></div></div>`);
      const q = (s) => main.querySelectorAll(s);
      wireReorder(); A.deliverySettings.wire(main, cfg, draw);
      q('[data-k=fl]').forEach(e => e.addEventListener('input', () => { cfg.fields[e.dataset.i].label = e.value; }));
      for (const [cls, k] of [['[data-k=fe]', 'enabled'], ['[data-k=fk]', 'lookup'], ['[data-k=fu]', 'unique'], ['[data-k=fs]', 'onSale']]) q(cls).forEach(e => e.addEventListener('change', () => { cfg.fields[e.dataset.i][k] = e.checked; }));
      const mailBody = () => ({ enabled: main.querySelector('#mon').checked, host: main.querySelector('#mh').value.trim(), port: Number(main.querySelector('#mp').value) || 587, secure: main.querySelector('#mtls').checked, user: main.querySelector('#mu').value.trim(), pass: main.querySelector('#mw').value, fromName: main.querySelector('#mfn').value.trim(), fromAddress: main.querySelector('#mfa').value.trim() });
      main.querySelector('#mon').addEventListener('change', (e) => { main.querySelector('#mbox').hidden = !e.target.checked; });
      const mp = main.querySelector('#mp'), mtls = main.querySelector('#mtls'), mphint = main.querySelector('#mphint');
      const syncTls = () => { if (mtls.checked) { mp.value = 465; mp.disabled = true; mphint.textContent = 'Fixed at 465 while TLS from the start is on.'; } else { mp.disabled = false; if (Number(mp.value) === 465 || !mp.value) mp.value = 587; mphint.textContent = 'Usually 587.'; } };
      mtls.addEventListener('change', syncTls); syncTls();
      main.querySelector('#mtest').addEventListener('click', (e) => UI.busy(e.currentTarget, async () => { const m = mailBody(); try { await A.api('POST', '/receipt-email/test', { smtp: { ...m, fromName: m.fromName || A.me.businessName }, wording: cfg.mail.wording.own_mail_test || undefined, logo: cfg.mail.logo || undefined }); toast(`Test email sent to ${A.me.email || 'you'}`); } catch (err) { toast(err.message, true); } }));
      if (tpl) {
        const tp = () => tpl.find(t => t.key === cm.key), wd = () => cfg.mail.wording[cm.key] || tp().current, qq = (id) => main.querySelector('#' + id);
        const fill = () => { const w = wd(); qq('cs').value = w.subject; qq('ct').value = w.title; qq('cb').value = w.body; qq('cph').innerHTML = tp().placeholders.map(p => `<button type="button" class="btn secondary small" data-cph="${esc(p.key)}" title="${esc(p.label)}">{{${esc(p.key)}}}</button>`).join(''); qq('creset').disabled = !cfg.mail.wording[cm.key]; };
        const preview = async () => { const mine = ++cm.seq; try { const r = await A.api('POST', '/receipt-email/preview', { key: cm.key, wording: { subject: qq('cs').value, title: qq('ct').value, body: qq('cb').value }, logo: cfg.mail.logo || undefined }); if (mine !== cm.seq) return; qq('csub').textContent = `Subject: ${r.subject}`; qq('cprob').innerHTML = r.problems.map(x => `<div>${esc(x)}</div>`).join(''); qq('cfr').src = `/api/app/receipt-email/preview/${encodeURIComponent(r.token)}`; } catch (er) { if (mine === cm.seq) toast(er.message, true); } };
        let timer; const soon = () => { clearTimeout(timer); timer = setTimeout(preview, 250); };
        const edited = () => { const w = { subject: qq('cs').value, title: qq('ct').value, body: qq('cb').value }, d = tp().current; if (w.subject === d.subject && w.title === d.title && w.body === d.body) delete cfg.mail.wording[cm.key]; else cfg.mail.wording[cm.key] = w; qq('creset').disabled = !cfg.mail.wording[cm.key]; soon(); };
        let focus = 'cb'; for (const id of ['cs', 'ct', 'cb']) { qq(id).addEventListener('input', edited); qq(id).addEventListener('focus', () => { focus = id; }); }
        main.querySelector('#cph').addEventListener('click', (e) => { const b = e.target.closest('[data-cph]'); if (!b) return; const el = qq(focus), tag = `{{${b.dataset.cph}}}`, a = el.selectionStart ?? el.value.length, z = el.selectionEnd ?? a; el.value = el.value.slice(0, a) + tag + el.value.slice(z); el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); edited(); });
        qq('cmk').addEventListener('change', (e) => { cm.key = UI.select.value(e.target); fill(); preview(); });
        qq('creset').addEventListener('click', () => { delete cfg.mail.wording[cm.key]; fill(); preview(); });
        qq('clpick').addEventListener('click', () => qq('clfile').click());
        qq('clrm').addEventListener('click', () => { cfg.mail.logo = ''; draw(); });
        qq('clfile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { cfg.mail.logo = await A.shrinkLogo(f); draw(); } catch (er) { toast(er.message, true); } });
        fill(); preview();
      }
      q('[data-k=sl]').forEach(e => e.addEventListener('input', () => { cfg.steps[e.dataset.i].label = e.value; }));
      q('[data-k=sr]').forEach(e => e.addEventListener('change', () => { cfg.steps[e.dataset.i].required = e.checked; }));
      q('[data-k=ech]').forEach(b => b.addEventListener('click', async () => {
        const f = cfg.fields[Number(b.dataset.i)];
        const list = await sheet(`<h2>Choices for “${esc(f.label.trim() || 'this detail')}”</h2><p class="sub">One choice per line. Devices that already use a choice you remove keep it; it just stops being offered.</p><div class="field mt-md"><textarea id="o" rows="6" aria-label="Choices, one per line">${esc((f.options || []).join('\n'))}</textarea></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save choices</button></div>`, { onMount: (el, close) => el.querySelector('#go').addEventListener('click', () => {
          const opts = [...new Set(el.querySelector('#o').value.split('\n').map(x => x.trim()).filter(Boolean))];
          if (!opts.length) return toast('Keep at least one choice.', true); close(opts);
        }) });
        if (list) { f.options = list; draw(); }
      }));
      q('[data-k=rmf]').forEach(b => b.addEventListener('click', async () => {
        const f = cfg.fields[Number(b.dataset.i)];
        if (!await UI.confirmBox({ title: `Remove “${f.label.trim() || 'this detail'}”?`, body: 'It stops showing in Inventory, Quick sale and new sale records. What was already entered on your devices, and on past sales, is kept — it is only hidden. This takes effect when you press Save changes.', confirmLabel: 'Remove', danger: true })) return;
        cfg.fields.splice(Number(b.dataset.i), 1); draw();
      }));
      wireCat();
      main.querySelector('#addmk').addEventListener('click', async () => {
        const name = await nameSheet('Add a make', 'Add a make ahead of time. You can add its models afterwards.', '', 'Make'); if (name) catDo(() => K.addMake(name), 'Make added');
      });
      main.querySelector('#um').addEventListener('change', (e) => { cfg.unlock.mode = UI.select.value(e.target); main.querySelector('#uiw').hidden = cfg.unlock.mode !== 'stay'; });
      main.querySelector('#ui').addEventListener('input', (e) => { cfg.unlock.idleMin = Math.floor(Number(e.target.value)) || 0; });
      A.returns.settingsWire(main, cfg.returns, draw);
      main.querySelector('#dc').addEventListener('input', (e) => { cfg.discount.maxStandardPct = e.target.value; });
      q('[data-k=wl]').forEach(e => e.addEventListener('input', () => { cfg.warranty.periods[e.dataset.i].label = e.value; }));
      q('[data-k=wd]').forEach(b => b.addEventListener('click', () => { cfg.warranty.default = cfg.warranty.periods[b.dataset.i].key; draw(); }));
      q('[data-k=wa]').forEach(b => b.addEventListener('click', () => { const p = cfg.warranty.periods[b.dataset.i]; p.archived = !p.archived; draw(); }));
      q('[data-k=wr]').forEach(b => b.addEventListener('click', () => { cfg.warranty.periods.splice(Number(b.dataset.i), 1); draw(); }));
      q('[data-k=pl]').forEach(e => e.addEventListener('input', () => { cfg.payments.methods[e.dataset.i].label = e.value; }));
      q('[data-k=pd]').forEach(b => b.addEventListener('click', () => { cfg.payments.default = cfg.payments.methods[b.dataset.i].key; draw(); }));
      q('[data-k=pa]').forEach(b => b.addEventListener('click', () => { const p = cfg.payments.methods[b.dataset.i]; p.archived = !p.archived; draw(); }));
      q('[data-k=pr]').forEach(b => b.addEventListener('click', () => { cfg.payments.methods.splice(Number(b.dataset.i), 1); draw(); }));
      main.querySelector('#addp').addEventListener('click', () => { cfg.payments.methods.push({ key: 'p' + Vault.newId().slice(0, 7), label: '' }); draw(); const ins = q('[data-k=pl]'); ins[ins.length - 1]?.focus(); });
      main.querySelector('#addw').addEventListener('click', async () => {
        const p = await sheet(`<h2>Add a warranty period</h2><div class="grid g2 mt-md"><div class="field"><label for="a">Length</label><input type="number" id="a" class="num" min="1" max="120" step="1" value="6"></div><div class="field"><label for="u">Unit</label>${UI.select.html({ id: 'u', options: C.WARRANTY_UNITS, value: 'months' })}</div></div><div class="field"><label for="n">Name (optional)</label><input type="text" id="n" placeholder="Shown at Quick sale, for example 6 months"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Add</button></div>`, { onMount: (el, close) => el.querySelector('#go').addEventListener('click', () => {
          const amount = Math.floor(Number(el.querySelector('#a').value)), unit = UI.select.value(el.querySelector('#u'));
          if (!(amount >= 1 && amount <= 120)) return toast('Enter a length from 1 to 120.', true);
          const np = { key: 'w' + Vault.newId().slice(0, 7), amount, unit }; np.label = el.querySelector('#n').value.trim() || C.periodLabel(np); close(np);
        }) });
        if (p) { cfg.warranty.periods.push(p); draw(); }
      });
      main.querySelector('#ten').addEventListener('change', (e) => { cfg.tests.enabled = e.target.checked; draw(); });
      main.querySelector('#treq').addEventListener('change', (e) => { cfg.tests.requireBeforeSale = e.target.checked; });
      // Details: extra items shown under a step when it is ticked (text, From → To, or a choice from a list).
      q('[data-k=sdt]').forEach(b => b.addEventListener('click', async () => {
        const st = cfg.steps[Number(b.dataset.i)], list = JSON.parse(JSON.stringify(st.details || []));
        const TYPES3 = [['text', 'Text'], ['fromto', 'From → To'], ['choice', 'Choice from a list']];
        const rows = () => list.length ? list.map((it, n) => `<div class="field"><input type="text" data-d="l" data-n="${n}" value="${esc(it.label)}" aria-label="Item name" placeholder="Item name" autocomplete="off"><div class="grid g2 mt-sm">${UI.select.html({ id: 'dt' + n, options: TYPES3, value: it.type })}<button type="button" class="btn secondary" data-d="rm" data-n="${n}">Remove item</button></div>${it.type === 'choice' ? `<input type="text" class="mt-sm" data-d="o" data-n="${n}" value="${esc((it.options || []).join(', '))}" placeholder="Choices, separated by commas" aria-label="Choices" autocomplete="off">` : ''}</div>`).join('') : '<div class="empty">No extra items.</div>';
        await sheet(`<h2>Details for “${esc(st.label.trim() || 'this step')}”</h2><p class="sub">Extra items to fill in when this step is ticked, for example Launcher or Firmware as From → To. They are optional, even if the step is required before sale.</p><div id="dl" class="mt-md">${rows()}</div><div class="actions split"><button class="btn secondary" id="da">Add an item</button><div class="row"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Save</button></div></div>`, { onMount: (el, close) => {
          const sync = () => el.querySelectorAll('[data-d=l]').forEach(i => { list[i.dataset.n].label = i.value; }), syncO = () => el.querySelectorAll('[data-d=o]').forEach(i => { list[i.dataset.n].options = i.value.split(',').map(x => x.trim()).filter(Boolean); });
          const paint = () => { sync(); syncO(); el.querySelector('#dl').innerHTML = rows(); wire(); };
          const wire = () => { el.querySelectorAll('[data-d=rm]').forEach(x => x.addEventListener('click', () => { sync(); list.splice(Number(x.dataset.n), 1); paint(); }));
            list.forEach((it, n) => el.querySelector('#dt' + n).addEventListener('change', (e) => { it.type = UI.select.value(e.target); if (it.type === 'choice' && !it.options) it.options = []; paint(); })); };
          wire();
          el.querySelector('#da').addEventListener('click', () => { sync(); syncO(); list.push({ key: 'i' + Vault.newId().slice(0, 7), label: '', type: 'text' }); paint(); });
          el.querySelector('#go').addEventListener('click', () => { sync(); syncO(); const names = list.map(x => x.label.trim().toLowerCase());
            if (names.some(x => !x)) return toast('Every item needs a name.', true); if (new Set(names).size !== names.length) return toast('Two items have the same name.', true);
            if (list.some(x => x.type === 'choice' && !(x.options || []).length)) return toast('Enter at least one choice.', true);
            st.details = list.map(x => ({ ...x, label: x.label.trim(), options: x.type === 'choice' ? x.options : undefined })); close(true); });
        } });
        draw();
      }));
      q('[data-k=rms]').forEach(b => b.addEventListener('click', () => { cfg.steps.splice(Number(b.dataset.i), 1); draw(); }));
      main.querySelector('#adds').addEventListener('click', () => { cfg.steps.push({ key: Vault.newId().slice(0, 8), label: '', required: false, details: [] }); draw(); main.querySelectorAll('[data-k=sl]')[cfg.steps.length - 1].focus(); });
      main.querySelector('#addf').addEventListener('click', async () => {
        const f = await sheet(`<h2>Add a detail</h2><div class="field mt-md"><label for="n">Name</label><input type="text" id="n" placeholder="For example: State, Firmware version, Remote model"></div><div class="field"><label for="t">Type</label>${UI.select.html({ id: 't', options: TYPES })}</div><div class="field" id="ow" hidden><label for="o">Choices (separated by commas)</label><input type="text" id="o" placeholder="Good, Fair, Poor"></div><div class="actions"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" id="go">Add</button></div>`, { onMount: (el, close) => {
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
        for (const f of cfg.fields) if (f.type && f.type !== 'text') { f.lookup = false; f.unique = false; }
        const labels = cfg.fields.map(f => f.label.trim().toLowerCase());
        if (cfg.fields.some(f => !f.label.trim()) || cfg.steps.some(s => !s.label.trim())) return toast('Every detail and step needs a name.', true);
        if (new Set(labels).size !== labels.length) return toast('Two details have the same name.', true);
        if (!cfg.fields.some(f => f.enabled && f.lookup)) return toast('Turn on at least one detail to look up in Quick sale.', true);
        const wl = cfg.warranty.periods.map(x => x.label.trim().toLowerCase());
        if (wl.some(x => !x)) return toast('Every warranty period needs a name.', true); if (new Set(wl).size !== wl.length) return toast('Two warranty periods have the same name.', true);
        const pl = cfg.payments.methods.map(x => x.label.trim().toLowerCase());
        if (pl.some(x => !x)) return toast('Every payment method needs a name.', true); if (new Set(pl).size !== pl.length) return toast('Two payment methods have the same name.', true);
        if (cfg.unlock.mode === 'stay' && !(cfg.unlock.idleMin >= 1 && cfg.unlock.idleMin <= 1440)) return toast('Enter an idle lock time from 1 to 1440 minutes.', true);
        const dcap = Number(cfg.discount.maxStandardPct); if (!(dcap >= 0 && dcap <= 100)) return toast('Enter a discount limit from 0 to 100.', true);
        const rerr = A.returns.settingsCheck(cfg.returns); if (rerr) return toast(rerr, true);
        const mail = { ...mailBody(), wording: cfg.mail.wording, logo: cfg.mail.logo }; if (mail.enabled && (!mail.host || !mail.fromAddress)) return toast('Enter the mail server and a From address, or turn off sending from your own mail server.', true);
        try { await S.saveConfig({ ...S.config(), ...A.deliverySettings.save(cfg), mail, returns: A.returns.settingsClean(cfg.returns), discount: { maxStandardPct: dcap }, unlock: { mode: cfg.unlock.mode, idleMin: cfg.unlock.idleMin || 30 }, payments: { default: cfg.payments.default, methods: cfg.payments.methods.map(x => ({ ...x, label: x.label.trim() })) }, warranty: { default: cfg.warranty.default, periods: cfg.warranty.periods.map(x => ({ ...x, label: x.label.trim() })) }, tests: { enabled: cfg.tests.enabled, requireBeforeSale: !!cfg.tests.requireBeforeSale && cfg.tests.enabled }, fields: cfg.fields.map(f => ({ ...f, label: f.label.trim() })), steps: cfg.steps.map(s => ({ ...s, label: s.label.trim() })) }); await A.vault.policy(); toast('Settings saved'); } catch (er) { toast(er.message, true); }
      }));
    };
    draw();
  };
})();
