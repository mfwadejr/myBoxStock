// SHARED / api — fetch wrapper with CSRF header and uniform errors.
(() => {
  let csrf = '';
  UI.setCsrf = (t) => { csrf = t || ''; };
  UI.client = (base) => async function api(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let data = {}; try { data = await res.json(); } catch {}
    if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; e.data = data; throw e; }
    return data;
  };
})();
