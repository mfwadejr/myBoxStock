// TEST / helpers-scan — a pretend camera for browser tests: a canvas stream that shows a fixture picture, placed where the test says.
import fs from 'node:fs';
import path from 'node:path';
import { fillLogin, ROOT } from './helpers.mjs';

export const FIX = path.join(ROOT, 'test', 'fixtures', 'labels');
export const dataUrl = (name) => { const f = path.join(FIX, name); return `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64'); };
export const PW = 'Sup3rSecretPass!';

// Installed before every page script. window.__cam controls what getUserMedia does; window.__camShow(url, { ix, iy, scale, vw, vh, aim }) draws the picture.
export const CAMERA_INIT = `(() => {
  const cam = window.__cam = { mode: 'ok', stopped: 0, started: 0, constraints: null, torch: false, img: null, vw: 720, vh: 1280, scale: 1, px: 0, py: 0, ax: 0, ay: 0 };
  Object.defineProperty(window, 'isSecureContext', { get: () => !window.__insecure, configurable: true });
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const draw = () => { cv.width = cam.vw; cv.height = cam.vh; ctx.fillStyle = '#555'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (cam.img) ctx.drawImage(cam.img, cam.ax - cam.px * cam.scale, cam.ay - cam.py * cam.scale, cam.img.width * cam.scale, cam.img.height * cam.scale); };
  setInterval(draw, 60);
  // Put image point (ix, iy) at video point (ax, ay).
  window.__camShow = (url, o = {}) => new Promise((ok) => { const im = new Image(); im.onload = () => { Object.assign(cam, { img: im, px: o.ix ?? im.width / 2, py: o.iy ?? im.height / 2, scale: o.scale ?? 1, vw: o.vw ?? cam.vw, vh: o.vh ?? cam.vh, ax: o.ax ?? (o.vw ?? cam.vw) / 2, ay: o.ay ?? (o.vh ?? cam.vh) / 2 }); draw(); ok(); }; im.src = url; });
  // Where the middle of the scan box sits in video pixels (what the aim line points at).
  window.__camAim = () => { const v = document.querySelector('.scan-video'), b = document.querySelector('.scan-box'); const vr = v.getBoundingClientRect(), br = b.getBoundingClientRect();
    const s = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight), ox = (vr.width - v.videoWidth * s) / 2, oy = (vr.height - v.videoHeight * s) / 2;
    return { x: (br.left - vr.left + br.width / 2 - ox) / s, y: (br.top - vr.top + br.height / 2 - oy) / s }; };
  // Where image point (ix, iy) is on the screen right now (client pixels): where to tap to aim at it.
  window.__camPoint = (ix, iy) => { const v = document.querySelector('.scan-video'), vr = v.getBoundingClientRect();
    const s = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight), ox = (vr.width - v.videoWidth * s) / 2, oy = (vr.height - v.videoHeight * s) / 2;
    return { x: vr.left + ox + (cam.ax + (ix - cam.px) * cam.scale) * s, y: vr.top + oy + (cam.ay + (iy - cam.py) * cam.scale) * s }; };
  const md = navigator.mediaDevices || (navigator.mediaDevices = {});
  md.getUserMedia = async (c) => {
    cam.constraints = c; cam.started++; cam.img = null;   // a new camera session starts on an empty picture
    if (cam.mode !== 'ok') { const names = { denied: 'NotAllowedError', none: 'NotFoundError', busy: 'NotReadableError' }; throw Object.assign(new Error('x'), { name: names[cam.mode] }); }
    draw(); const stream = cv.captureStream(15);
    for (const t of stream.getVideoTracks()) { const stop = t.stop.bind(t); t.stop = () => { cam.stopped++; stop(); };
      if (cam.torchCap || cam.focusCap) { t.getCapabilities = () => ({ ...(cam.torchCap ? { torch: true } : {}), ...(cam.focusCap ? { focusMode: ['continuous', 'single-shot'] } : {}) });
        t.applyConstraints = async (c2) => { const a = c2.advanced?.[0] || {}; if ('torch' in a) cam.torch = !!a.torch; if (a.pointsOfInterest) (cam.focus = cam.focus || []).push(a.pointsOfInterest[0]); }; } }
    return stream; };
})();`;

export async function signup(page, srv, name = 'sam') {
  await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
  await page.fill('#bn', 'Scan Co'); await page.fill('#em', name + '@example.com'); await page.fill('#un', name); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const login = name + '@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block');
  await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go'); await page.waitForSelector('.main');
}

// Aim the pretend camera so image point (ix, iy) is under the middle of the scan box.
export async function aim(page, url, ix, iy, scale = 1) {
  await page.waitForFunction(() => { const v = document.querySelector('.scan-video'); return v && v.videoWidth > 0; });
  const a = await page.evaluate(() => window.__camAim());
  await page.evaluate(([u, o]) => window.__camShow(u, o), [url, { ix, iy, scale, ax: Math.round(a.x), ay: Math.round(a.y) }]);
}
