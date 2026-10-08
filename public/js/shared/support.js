// SHARED / support — the pieces both consoles use for support tickets: status chips, the conversation, and the screenshot picker.
// Text is always escaped. Screenshots are shown from the realm's own attachment address (cookie sign-in), never from data in the message.
(() => {
  const { esc, fmt, toast } = UI;
  const CHIP = { open: 'blue', waiting_host: 'amber', waiting_reseller: '', resolved: 'green', closed: '' };
  const statusChip = (status, label) => `<span class="chip ${CHIP[status] || ''}">${esc(label)}</span>`;

  // One message. m = { kind: 'mine' | 'theirs' | 'team' | 'note' | 'system', ts, author, tag?, body, diagnostics?, attachments? }
  const msg = (m, base) => {
    if (m.kind === 'system') return `<div class="msg system">${esc(fmt.dateTime(m.ts))} · ${esc(m.body)}</div>`;
    const shots = (m.attachments || []).map(a => `<a href="${base}/attachments/${esc(a.id)}" target="_blank" rel="noopener"><img class="shot" src="${base}/attachments/${esc(a.id)}" alt="Screenshot ${esc(a.name)}" loading="lazy"></a>`).join('');
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
    const draw = () => { list.innerHTML = held.map(h => `<span class="chip">${esc(h.name)} <button type="button" class="linkish" data-rm="${esc(h.id)}" aria-label="Remove ${esc(h.name)}">Remove</button></span>`).join(''); add.disabled = held.length + uploading >= cfg.maxFiles; };
    add.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const files = [...input.files]; input.value = '';
      for (const f of files) {
        if (!/^image\/(png|jpeg)$/.test(f.type)) { toast('Screenshots must be PNG or JPG pictures.', true); continue; }
        if (f.size > cfg.maxKB * 1024) { toast('That screenshot is larger than the size limit. Make it smaller and try again.', true); continue; }
        if (held.length + uploading >= cfg.maxFiles) { toast('You have already attached the most screenshots allowed.', true); break; }
        uploading++; draw();
        try { const r = await api.upload(`/support/upload?name=${encodeURIComponent(f.name)}`, f); held.push(r); } catch (e) { toast(e.message, true); }
        uploading--; draw();
      }
    });
    list.addEventListener('click', async (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; const i = held.findIndex(h => h.id === b.dataset.rm); if (i < 0) return; const [h] = held.splice(i, 1); draw(); try { await api('DELETE', `/support/upload/${encodeURIComponent(h.id)}`); } catch {} });
    draw();
    return { ids: () => held.map(h => h.id), reset() { held.length = 0; draw(); }, busy: () => uploading > 0 };
  };

  // "3d 4h" style: how long ago something started.
  const waited = (since) => since ? fmt.dur(Math.max(0, (Date.now() - Number(since)) / 1000)) : '—';
  UI.support = { statusChip, thread, picker, waited };
})();
