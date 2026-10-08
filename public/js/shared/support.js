// SHARED / support — the pieces both consoles use for support tickets: status chips, the conversation, and the screenshot picker.
// Text is always escaped. Screenshots are shown from the realm's own attachment address (cookie sign-in), never from data in the message.
(() => {
  const { esc, fmt, toast } = UI;
  const CHIP = { open: 'blue', waiting_host: 'amber', waiting_reseller: '', resolved: 'green', closed: '' };
  const statusChip = (status, label) => `<span class="chip ${CHIP[status] || ''}">${esc(label)}</span>`;

  // One message. m = { kind: 'mine' | 'theirs' | 'team' | 'note' | 'system', ts, author, tag?, body, diagnostics?, attachments? }
  const msg = (m, base) => {
    if (m.kind === 'system') return `<div class="msg system">${esc(fmt.dateTime(m.ts))} · ${esc(m.body)}</div>`;
    const shots = (m.attachments || []).map(a => `<a class="shot-link" href="${base}/attachments/${esc(a.id)}" data-shot data-name="${esc(a.name)}" target="_blank" rel="noopener"><img class="shot" src="${base}/attachments/${esc(a.id)}" alt="Screenshot ${esc(a.name)}" loading="lazy"></a>`).join('');
    return `<div class="msg ${m.kind === 'team' ? 'team' : m.kind === 'note' ? 'note' : ''}"><div class="msg-meta"><b>${esc(m.author)}</b>${m.tag ? `<span class="chip ${m.kind === 'note' ? 'amber' : ''}">${esc(m.tag)}</span>` : ''}<span class="tab-num">${esc(fmt.dateTime(m.ts))}</span></div>
      <div class="msg-body">${esc(m.body)}</div>${shots ? `<div class="shots">${shots}</div>` : ''}${m.diagnostics ? `<details><summary>Diagnostics attached</summary><div class="codeblock">${esc(m.diagnostics)}</div></details>` : ''}</div>`;
  };
  const thread = (list, base) => `<div class="thread">${list.map(m => msg(m, base)).join('')}</div>`;

  // The "Add screenshot" control. Each picture is sent on its own as raw bytes, checked by the server, and held until the message is sent.
  //   const p = UI.support.picker(box, { api, cfg: { maxFiles, maxKB } });   p.ids() -> ids to send;  p.reset() after sending;  p.busy() while a file is still uploading
  const picker = (box, { api, cfg }) => {
    const held = []; let uploading = 0;
    if (!cfg.maxFiles) { box.innerHTML = '<div class="hint">Screenshots are turned off.</div>'; return { ids: () => [], reset() {}, busy: () => false }; }
    box.innerHTML = `<div class="row wrap"><button type="button" class="btn secondary small" data-add>Add screenshot</button><span class="hint mt-0">PNG or JPG, up to ${esc(fmt.bytes(cfg.maxKB * 1024))} each, ${esc(cfg.maxFiles)} at most.</span></div><div class="attached" data-list></div><input type="file" accept="image/png,image/jpeg" multiple data-file aria-label="Choose screenshots">`;
    const list = box.querySelector('[data-list]'), input = box.querySelector('[data-file]'), add = box.querySelector('[data-add]');
    const draw = () => { list.innerHTML = held.map(h => `<span class="thumb-item">${h.url ? `<a class="shot-link" href="${esc(h.url)}" data-shot data-name="${esc(h.name)}" target="_blank" rel="noopener" aria-label="View ${esc(h.name)}"><img class="thumb" src="${esc(h.url)}" alt=""></a>` : ''}<span class="chip">${esc(h.name)} <button type="button" class="linkish" data-rm="${esc(h.id)}" aria-label="Remove ${esc(h.name)}">Remove</button></span></span>`).join(''); add.disabled = held.length + uploading >= cfg.maxFiles; };
    add.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const files = [...input.files]; input.value = '';
      for (const f of files) {
        if (!/^image\/(png|jpeg)$/.test(f.type)) { toast('Screenshots must be PNG or JPG pictures.', true); continue; }
        if (f.size > cfg.maxKB * 1024) { toast('That screenshot is larger than the size limit. Make it smaller and try again.', true); continue; }
        if (held.length + uploading >= cfg.maxFiles) { toast('You have already attached the most screenshots allowed.', true); break; }
        uploading++; draw();
        try { const r = await api.upload(`/support/upload?name=${encodeURIComponent(f.name)}`, f); held.push({ ...r, url: await new Promise((ok) => { const rd = new FileReader(); rd.onload = () => ok(String(rd.result)); rd.onerror = () => ok(''); rd.readAsDataURL(f); }) }); } catch (e) { toast(e.message, true); }
        uploading--; draw();
      }
    });
    list.addEventListener('click', async (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; const i = held.findIndex(h => h.id === b.dataset.rm); if (i < 0) return; const [h] = held.splice(i, 1); draw(); try { await api('DELETE', `/support/upload/${encodeURIComponent(h.id)}`); } catch {} });
    draw();
    return { ids: () => held.map(h => h.id), reset() { held.length = 0; draw(); }, busy: () => uploading > 0 };
  };

  // The screenshot viewer: opens a picture in the app's sheet on top of the page (nothing navigates away). The picture is scaled to fit; tap it to zoom in and out.
  // Close button, Esc, a tap outside and the phone back gesture all close it and leave the page exactly where it was. Several screenshots in one message get Previous/Next and "2 of 3".
  const viewer = (items, start, opener) => {
    let i = start, popped = false, closeSheet = null, onKey = null;
    history.pushState({ mbsViewer: true }, '');   // so the back gesture closes the viewer instead of leaving the page
    const onPop = () => { popped = true; closeSheet?.(null); };
    window.addEventListener('popstate', onPop);
    const html = `<h2 class="viewer-name" data-vname></h2><div class="viewer-stage" data-stage><img class="viewer-img" data-img alt=""></div>
      <div class="viewer-bar"><span class="viewer-count" data-count></span><span class="row"><button type="button" class="btn secondary small" data-prev>Previous</button><button type="button" class="btn secondary small" data-next>Next</button></span></div>
      <div class="actions"><a class="linkish" data-tab target="_blank" rel="noopener">Open in new tab</a><a class="btn secondary" data-dl>Download</a><button type="button" class="btn" data-cancel>Close</button></div>`;
    UI.sheet(html, { wide: true, onMount: (el, close) => {
      closeSheet = close; const q = (a) => el.querySelector(`[${a}]`), stage = q('data-stage'), img = q('data-img'), many = items.length > 1;
      const show = () => {
        const it = items[i]; stage.classList.remove('zoomed'); img.src = it.src; img.alt = `Screenshot ${it.name}`; q('data-vname').textContent = it.name;
        q('data-tab').href = it.src; q('data-tab').hidden = it.src.startsWith('data:');
        q('data-dl').href = it.src; q('data-dl').setAttribute('download', it.name);
        q('data-count').textContent = many ? `${i + 1} of ${items.length}` : ''; for (const a of ['data-prev', 'data-next']) q(a).hidden = !many;
        q('data-prev').disabled = i === 0; q('data-next').disabled = i === items.length - 1;
      };
      img.addEventListener('click', () => stage.classList.toggle('zoomed'));
      q('data-prev').addEventListener('click', () => { if (i > 0) { i--; show(); } });
      q('data-next').addEventListener('click', () => { if (i < items.length - 1) { i++; show(); } });
      onKey = (e) => { if (e.key === 'ArrowLeft' && i > 0) { i--; show(); } else if (e.key === 'ArrowRight' && i < items.length - 1) { i++; show(); } };
      document.addEventListener('keydown', onKey); show(); q('data-cancel').focus();
    } }).then(() => {
      window.removeEventListener('popstate', onPop); document.removeEventListener('keydown', onKey);
      if (!popped && history.state?.mbsViewer) history.back();   // closed by Close, Esc or a tap outside: undo the history step we added
      if (opener?.isConnected) opener.focus();
    });
  };
  // One listener for every screenshot link on the page (conversation thumbnails and the previews of pictures waiting to be sent).
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-shot]'); if (!a || e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const group = [...(a.closest('.shots, .attached') || a.parentNode).querySelectorAll('a[data-shot]')];
    viewer(group.map(x => ({ src: x.getAttribute('href'), name: x.dataset.name || 'Screenshot' })), Math.max(0, group.indexOf(a)), a);
  });

  // "3d 4h" style: how long ago something started.
  const waited = (since) => since ? fmt.dur(Math.max(0, (Date.now() - Number(since)) / 1000)) : '—';
  UI.support = { statusChip, thread, picker, waited, viewer };
})();
