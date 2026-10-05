// APP / scan-core — pure scanning logic (no browser needed): MAC shape and normalizing, nearest-to-center choice, repeat-frame agreement, crop math.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.ScanCore = api; })(typeof self !== 'undefined' ? self : this, function () {
  // The only universal rule: a MAC is 12 hex digits, plain or separated by ':' '-' '.' (pairs, or Cisco groups of four). Result is XX:XX:XX:XX:XX:XX.
  const MAC_SHAPES = [/^[0-9a-f]{12}$/i, /^(?:[0-9a-f]{2}([:-]))(?:[0-9a-f]{2}\1){4}[0-9a-f]{2}$/i, /^(?:[0-9a-f]{4}([.-]))[0-9a-f]{4}\1[0-9a-f]{4}$/i];
  function normalizeMac(v) {
    const t = String(v ?? '').trim().replace(/^mac(?:\s*address)?\s*[:#=-]?\s*(?=\S)/i, '').trim();
    if (!MAC_SHAPES.some(r => r.test(t))) return '';
    return t.replace(/[^0-9a-f]/gi, '').toUpperCase().replace(/(..)(?=.)/g, '$1:');
  }
  // What a field accepts from a scan: text fields take whatever was read (trimmed), the MAC field only a MAC (normalized). Returns '' when it does not fit.
  const accept = (mode, v) => mode === 'mac' ? normalizeMac(v) : String(v ?? '').trim();

  // Candidates are { value, x, y } in box pixels. Keep the ones the field accepts, then rank by distance to the center of the box (w x h).
  // Returns { pick, tied }: tied is a list (nearest first) when the best two are about equally close, so the person can choose.
  function ranked(cands, box, mode = 'text') {
    const cx = box.w / 2, cy = box.h / 2, seen = new Map();
    for (const c of cands || []) { const value = accept(mode, c.value); if (!value) continue; const d = Math.hypot(c.x - cx, c.y - cy); if (!seen.has(value) || seen.get(value).d > d) seen.set(value, { value, d, x: c.x, y: c.y, format: c.format }); }
    return [...seen.values()].sort((a, b) => a.d - b.d);
  }
  function choose(cands, box, mode = 'text', tolerance = 0.08) {
    const list = ranked(cands, box, mode);
    if (!list.length) return { pick: null, tied: [] };
    const tol = tolerance * Math.min(box.w, box.h), tied = list.filter(c => c.d - list[0].d <= tol);
    return tied.length > 1 ? { pick: null, tied: tied.slice(0, 4) } : { pick: list[0], tied: [] };
  }

  // A read counts only after the same answer appears in `need` frames in a row. push(key) returns true once reached; push(null) (nothing read) starts over.
  function consensus(need = 2) {
    let last = null, n = 0;
    return { push(key, want = need) { if (key == null) { last = null; n = 0; return false; } n = key === last ? n + 1 : 1; last = key; return n >= want; }, reset() { last = null; n = 0; }, get count() { return n; } };
  }

  // The scan box is drawn in CSS pixels over a video shown with object-fit: cover. Which rectangle of the real video frame is under the box?
  // view = { w, h } of the video element, video = { w, h } of the frame, box = { x, y, w, h } relative to the element. Returns whole pixels inside the frame.
  function cropRect(view, video, box) {
    const s = Math.max(view.w / video.w, view.h / video.h), ox = (view.w - video.w * s) / 2, oy = (view.h - video.h * s) / 2;
    const x0 = Math.max(0, Math.round((box.x - ox) / s)), y0 = Math.max(0, Math.round((box.y - oy) / s));
    const x1 = Math.min(video.w, Math.round((box.x + box.w - ox) / s)), y1 = Math.min(video.h, Math.round((box.y + box.h - oy) / s));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  return { normalizeMac, accept, ranked, choose, consensus, cropRect };
});
