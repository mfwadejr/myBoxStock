// SHARED / api — fetch wrapper with CSRF header and uniform errors.
(() => {
  let csrf = '';
  UI.setCsrf = (t) => { csrf = t || ''; };
  UI.client = (base) => {
    const api = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
      let data = {}; try { data = await res.json(); } catch {}
      if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; e.data = data; throw e; }
      return data;
    };
    // Sends a file as raw bytes (the browser streams it from disk, the server streams it to disk). onProgress(fraction) while it goes; abort() cancels.
    api.upload = (path, file, onProgress) => {
      const xhr = new XMLHttpRequest(); const done = new Promise((resolve, reject) => {
        xhr.open('POST', base + path); xhr.setRequestHeader('Content-Type', 'application/octet-stream'); xhr.setRequestHeader('X-CSRF-Token', csrf);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
        xhr.onload = () => { let data = {}; try { data = JSON.parse(xhr.responseText); } catch {} if (xhr.status >= 200 && xhr.status < 300) return resolve(data); const e = new Error(data.error || `Upload failed (${xhr.status})`); e.status = xhr.status; e.data = data; reject(e); };
        xhr.onerror = () => reject(new Error('The upload was interrupted. Check the connection and try again.')); xhr.onabort = () => reject(new Error('The upload was cancelled.'));
        xhr.send(file);
      });
      return Object.assign(done, { abort: () => xhr.abort() });
    };
    return api;
  };
})();
